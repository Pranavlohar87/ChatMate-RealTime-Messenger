from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import json
import random
from datetime import datetime
import hashlib
import re

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_here_chatmate_2024'

# FIXED: Proper SocketIO configuration
socketio = SocketIO(app, 
                   cors_allowed_origins="*",
                   async_mode='threading')

# Store data in memory
users_db = {}
messages_storage = []
online_users = {}

# Avatar colors
AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']

def get_avatar_color(username):
    random.seed(username)
    return random.choice(AVATAR_COLORS)

def is_valid_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def save_user(username, email, password):
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    
    users_db[email] = {
        'username': username,
        'password': hashed_password,
        'email': email,
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    print(f"User registered: {username} ({email})")
    return True

def verify_user(email, password):
    if email in users_db:
        hashed_input = hashlib.sha256(password.encode()).hexdigest()
        return users_db[email]['password'] == hashed_input
    return False

def user_exists(email):
    return email in users_db

def save_message(username, message, email):
    message_data = {
        'username': username,
        'message': message,
        'email': email,
        'timestamp': datetime.now().strftime('%H:%M:%S'),
        'avatar_color': get_avatar_color(username)
    }
    
    messages_storage.append(message_data)
    if len(messages_storage) > 100:
        messages_storage.pop(0)
    
    print(f"Message from {username}: {message}")
    return message_data

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register_user():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data received'})
            
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        print(f"Registration attempt: {username}, {email}")
        
        if not username or len(username) < 2:
            return jsonify({'success': False, 'message': 'Username must be at least 2 characters long'})
        
        if len(username) > 20:
            return jsonify({'success': False, 'message': 'Username must be less than 20 characters'})
        
        if not is_valid_email(email):
            return jsonify({'success': False, 'message': 'Please enter a valid email address'})
        
        if not password or len(password) < 3:
            return jsonify({'success': False, 'message': 'Password must be at least 3 characters long'})
        
        if user_exists(email):
            return jsonify({'success': False, 'message': 'Email already registered'})
        
        if save_user(username, email, password):
            return jsonify({'success': True, 'message': 'User registered successfully'})
        else:
            return jsonify({'success': False, 'message': 'Error creating user'})
            
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({'success': False, 'message': 'Server error'})

# SocketIO Events
@socketio.on('connect')
def handle_connect():
    print('User connected:', request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in online_users:
        user_data = online_users[request.sid]
        username = user_data['username']
        del online_users[request.sid]
        emit('user_left', {'username': username}, broadcast=True)
        print(f'{username} disconnected')

@socketio.on('join_chat')
def handle_join(data):
    try:
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        print(f"Login attempt: {email}")
        
        if not email or not password:
            emit('error', {'message': 'Email and password required'})
            return
        
        if not verify_user(email, password):
            emit('error', {'message': 'Invalid email or password'})
            return
        
        user_data = users_db[email]
        username = user_data['username']
        
        online_users[request.sid] = {
            'username': username,
            'email': email,
            'avatar_color': get_avatar_color(username)
        }
        
        emit('join_success', {
            'username': username,
            'email': email
        })
        
        messages = messages_storage[-50:]
        for msg in messages:
            emit('new_message', msg)
        
        emit('user_joined', {'username': username}, broadcast=True)
        print(f'{username} joined the chat')
        
    except Exception as e:
        print(f"Login error: {e}")
        emit('error', {'message': 'Login failed'})

@socketio.on('send_message')
def handle_send_message(data):
    if request.sid not in online_users:
        return
    
    user_data = online_users[request.sid]
    username = user_data['username']
    email = user_data['email']
    
    message = data.get('message', '').strip()
    if not message:
        return
    
    message_data = save_message(username, message, email)
    emit('new_message', message_data, broadcast=True)

if __name__ == '__main__':
    print("Starting ChatMate Server...")
    socketio.run(app, debug=True, host='0.0.0.0', port=8080)
