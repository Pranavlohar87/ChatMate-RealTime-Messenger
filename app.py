from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///chatmate.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)

# Socket.io configuration with better settings
socketio = SocketIO(app, 
                   cors_allowed_origins="*",
                   async_mode='eventlet',
                   logger=True,
                   engineio_logger=False,
                   ping_timeout=60,
                   ping_interval=25,
                   max_http_buffer_size=1e8)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    room = db.Column(db.String(50), default='general')
    
    user = db.relationship('User', backref=db.backref('messages', lazy=True))

class ActiveUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    sid = db.Column(db.String(100), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('active_sessions', lazy=True))

# Create tables
with app.app_context():
    db.create_all()

# Store active users in memory
active_users = {}

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'})
            
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()

        # Validation
        if not username or not email or not password:
            return jsonify({'success': False, 'message': 'All fields are required'})
        
        if len(username) < 3:
            return jsonify({'success': False, 'message': 'Username must be at least 3 characters'})
        
        if len(password) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'})

        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'})
        
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already registered'})

        # Create new user
        new_user = User(username=username, email=email)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            'success': True, 
            'message': 'User created successfully'
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"Registration error: {str(e)}")
        return jsonify({'success': False, 'message': 'Registration failed. Please try again.'})

# Socket Events
@socketio.on('connect')
def handle_connect():
    print('✅ Client connected:', request.sid)
    emit('connected', {'message': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('❌ Client disconnected:', request.sid)
    if request.sid in active_users:
        user_data = active_users[request.sid]
        
        # Notify others
        emit('user_left', {
            'username': user_data['username'],
            'timestamp': datetime.utcnow().strftime('%H:%M:%S')
        }, room='general', include_self=False)
        
        # Remove from database active users
        ActiveUser.query.filter_by(sid=request.sid).delete()
        db.session.commit()
        
        # Update online users
        emit('online_users_update', {
            'users': get_online_users_list()
        }, room='general')
        
        del active_users[request.sid]

def get_online_users_list():
    """Get list of currently online users"""
    return [{'username': user_data['username'], 'user_id': user_data['user_id']} 
            for user_data in active_users.values()]

@socketio.on('join_chat')
def handle_join_chat(data):
    try:
        if not data:
            emit('login_error', {'message': 'No data provided'})
            return
            
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        
        print(f'🔐 Login attempt for email: {email}')
        
        if not email or not password:
            emit('login_error', {'message': 'Email and password are required'})
            return

        # Authenticate user
        user = User.query.filter_by(email=email).first()
        if not user:
            print('❌ User not found')
            emit('login_error', {'message': 'Invalid email or password'})
            return
            
        if not user.check_password(password):
            print('❌ Invalid password')
            emit('login_error', {'message': 'Invalid email or password'})
            return

        # Store user session
        active_users[request.sid] = {
            'user_id': user.id,
            'username': user.username,
            'email': user.email
        }
        
        # Add to active users in database
        active_user = ActiveUser(user_id=user.id, sid=request.sid)
        db.session.add(active_user)
        db.session.commit()

        # Join room
        join_room('general')
        
        print(f'✅ Login successful for: {user.username}')
        
        # Notify others
        emit('user_joined', {
            'username': user.username,
            'timestamp': datetime.utcnow().strftime('%H:%M:%S')
        }, room='general', include_self=False)
        
        # Send success to user
        emit('join_success', {
            'username': user.username,
            'message': 'Successfully joined chat'
        })
        
        # Send online users list
        emit('online_users_update', {
            'users': get_online_users_list()
        }, room='general')
        
        # Send last 20 messages
        recent_messages = Message.query.join(User).filter(Message.room == 'general')\
            .order_by(Message.timestamp.asc()).limit(20).all()
        
        for msg in recent_messages:
            emit('new_message', {
                'username': msg.user.username,
                'message': msg.content,
                'timestamp': msg.timestamp.strftime('%H:%M:%S')
            })
    
    except Exception as e:
        print(f'❌ Login error: {str(e)}')
        emit('login_error', {'message': 'Login failed. Please try again.'})

@socketio.on('send_message')
def handle_send_message(data):
    try:
        if request.sid not in active_users:
            emit('error', {'message': 'Not authenticated'})
            return

        user_data = active_users[request.sid]
        message_content = data.get('message', '').strip()
        
        if not message_content:
            return

        # Save message to database
        new_message = Message(
            content=message_content,
            user_id=user_data['user_id'],
            room='general'
        )
        db.session.add(new_message)
        db.session.commit()

        # Broadcast message
        emit('new_message', {
            'username': user_data['username'],
            'message': message_content,
            'timestamp': datetime.utcnow().strftime('%H:%M:%S')
        }, room='general')
    
    except Exception as e:
        print(f'❌ Message send error: {str(e)}')
        emit('error', {'message': 'Failed to send message'})

@socketio.on('get_online_users')
def handle_get_online_users():
    try:
        emit('online_users_update', {
            'users': get_online_users_list()
        })
    except Exception as e:
        print(f'❌ Online users error: {str(e)}')

# Health check endpoint
@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    socketio.run(app, debug=debug, host='0.0.0.0', port=port)
