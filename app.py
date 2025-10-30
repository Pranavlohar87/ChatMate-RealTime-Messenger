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

# SIMPLE Socket.io configuration - Remove eventlet
socketio = SocketIO(app, cors_allowed_origins="*")

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
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'})
        
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already registered'})

        new_user = User(username=username, email=email)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'success': True, 'message': 'User created successfully'})
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})

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
        emit('user_left', {
            'username': user_data['username'],
            'timestamp': datetime.utcnow().strftime('%H:%M:%S')
        }, room='general', include_self=False)
        del active_users[request.sid]

@socketio.on('join_chat')
def handle_join_chat(data):
    try:
        email = data.get('email')
        password = data.get('password')
        
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            emit('login_error', {'message': 'Invalid email or password'})
            return

        active_users[request.sid] = {
            'user_id': user.id,
            'username': user.username,
            'email': user.email
        }

        join_room('general')
        
        emit('user_joined', {
            'username': user.username,
            'timestamp': datetime.utcnow().strftime('%H:%M:%S')
        }, room='general', include_self=False)
        
        emit('join_success', {
            'username': user.username,
            'message': 'Successfully joined chat'
        })
        
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
        emit('login_error', {'message': 'Login failed'})

@socketio.on('send_message')
def handle_send_message(data):
    try:
        if request.sid not in active_users:
            return

        user_data = active_users[request.sid]
        message_content = data.get('message', '').strip()
        
        if not message_content:
            return

        new_message = Message(
            content=message_content,
            user_id=user_data['user_id'],
            room='general'
        )
        db.session.add(new_message)
        db.session.commit()

        emit('new_message', {
            'username': user_data['username'],
            'message': message_content,
            'timestamp': datetime.utcnow().strftime('%H:%M:%S')
        }, room='general')
    
    except Exception as e:
        print(f'❌ Message send error: {str(e)}')

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    print(f'🚀 Starting ChatMate server on port {port}')
    socketio.run(app, host='0.0.0.0', port=port)
