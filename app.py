import os
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import json
import os
import random
from datetime import datetime
import hashlib

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_here_chatmate_2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active users and user database
users = {}
user_db_file = 'users.json'
MESSAGES_FILE = 'messages.json'

# Avatar colors for user profiles
AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

def get_avatar_color(username):
    """Generate consistent avatar color based on username"""
    random.seed(username)
    return random.choice(AVATAR_COLORS)

def load_users():
    """Load users from JSON file"""
    if os.path.exists(user_db_file):
        try:
            with open(user_db_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}
    return {}

def save_user(username, password):
    """Save user to database"""
    users_db = load_users()
    
    # Hash the password for security
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    
    users_db[username] = {
        'password': hashed_password,
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    try:
        with open(user_db_file, 'w', encoding='utf-8') as f:
            json.dump(users_db, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving user: {e}")
        return False

def verify_user(username, password):
    """Verify user credentials"""
    users_db = load_users()
    
    if username in users_db:
        # Verify hashed password
        hashed_input = hashlib.sha256(password.encode()).hexdigest()
        return users_db[username]['password'] == hashed_input
    
    return False

def user_exists(username):
    """Check if user exists"""
    users_db = load_users()
    return username in users_db

def load_messages():
    """Load messages from JSON file"""
    if os.path.exists(MESSAGES_FILE):
        try:
            with open(MESSAGES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    return []

def save_message(username, message):
    """Save a single message to JSON file"""
    message_data = {
        'username': username,
        'message': message,
        'timestamp': datetime.now().strftime('%H:%M:%S'),
        'date': datetime.now().strftime('%Y-%m-%d'),  # Added date
        'avatar_color': get_avatar_color(username)
    }
    
    messages = load_messages()
    messages.append(message_data)
    
    # Keep only last 1000 messages to prevent file from getting too big
    messages = messages[-1000:]
    
    try:
        with open(MESSAGES_FILE, 'w', encoding='utf-8') as f:
            json.dump(messages, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving message: {e}")
    
    return message_data

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register_user():
    """Register a new user"""
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or len(username) < 2:
        return jsonify({'success': False, 'message': 'Username must be at least 2 characters long'})
    
    if len(username) > 20:
        return jsonify({'success': False, 'message': 'Username must be less than 20 characters'})
    
    if not password or len(password) < 3:
        return jsonify({'success': False, 'message': 'Password must be at least 3 characters long'})
    
    if user_exists(username):
        return jsonify({'success': False, 'message': 'Username already exists'})
    
    if save_user(username, password):
        return jsonify({'success': True, 'message': 'User registered successfully'})
    else:
        return jsonify({'success': False, 'message': 'Error creating user'})

@socketio.on('connect')
def handle_connect():
    print('A user connected!')
    emit('connected', {'message': 'Connected to ChatMate server'})

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in users:
        username = users[request.sid]['username']
        avatar_color = users[request.sid]['avatar_color']
        del users[request.sid]
        emit('user_left', {
            'username': username,
            'avatar_color': avatar_color
        }, broadcast=True)
        print(f'{username} disconnected')

@socketio.on('join_chat')
def handle_join(data):
    username = data['username']
    password = data.get('password', '')
    
    # Basic validation
    if not username or len(username.strip()) == 0:
        emit('error', {'message': 'Username cannot be empty'})
        return
    
    if len(username) > 20:
        emit('error', {'message': 'Username too long (max 20 characters)'})
        return
    
    username = username.strip()
    
    # Verify user credentials
    if not verify_user(username, password):
        emit('error', {'message': 'Invalid username or password'})
        return
    
    # Store user data with avatar color
    users[request.sid] = {
        'username': username,
        'avatar_color': get_avatar_color(username)
    }
    
    # Send message history to the new user
    messages = load_messages()[-50:]  # Last 50 messages
    for msg in messages:
        emit('new_message', msg)
    
    print(f'{username} joined the chat')
    
    # Notify all users with avatar color
    emit('user_joined', {
        'username': username,
        'avatar_color': get_avatar_color(username)
    }, broadcast=True)

@socketio.on('send_message')
def handle_send_message(data):
    user_data = users.get(request.sid, {})
    username = user_data.get('username', 'Anonymous')
    
    # Basic message validation
    message = data.get('message', '').strip()
    if not message or len(message) == 0:
        return
    
    if len(message) > 1000:
        emit('error', {'message': 'Message too long (max 1000 characters)'})
        return
    
    # Save message and get message data with avatar color
    message_data = save_message(username, message)
    
    emit('new_message', message_data, broadcast=True)

# NEW: Typing indicators
@socketio.on('typing_start')
def handle_typing_start():
    """Handle when user starts typing"""
    user_data = users.get(request.sid, {})
    username = user_data.get('username', 'Someone')
    emit('user_typing', {'username': username}, broadcast=True, include_self=False)

@socketio.on('typing_stop')
def handle_typing_stop():
    """Handle when user stops typing"""
    emit('user_stopped_typing', broadcast=True)

# NEW: Private messaging
@socketio.on('private_message')
def handle_private_message(data):
    """Handle private/direct messages"""
    user_data = users.get(request.sid, {})
    username = user_data.get('username', 'Anonymous')
    target_user = data.get('target_user')
    message = data.get('message', '').strip()
    
    if not message or not target_user:
        return
    
    # Find target user's socket ID
    target_sid = None
    for sid, user_info in users.items():
        if user_info['username'] == target_user:
            target_sid = sid
            break
    
    if target_sid:
        private_message_data = {
            'from_user': username,
            'message': message,
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'avatar_color': get_avatar_color(username)
        }
        
        # Send to target user
        emit('private_message_received', private_message_data, room=target_sid)
        
        # Send confirmation to sender
        emit('private_message_sent', private_message_data)

@socketio.on('get_online_users')
def handle_get_online_users():
    """Send list of online users to requesting client"""
    online_users = []
    for user_data in users.values():
        online_users.append({
            'username': user_data['username'],
            'avatar_color': user_data['avatar_color']
        })
    emit('online_users_list', {'users': online_users})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"Starting ChatMate Server on port {port}...")
    socketio.run(app, debug=False, host='0.0.0.0', port=port)
