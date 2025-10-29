const socket = io();

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Login form
    document.getElementById('login-btn').addEventListener('click', loginUser);
    setupPasswordToggle('password-input', 'password-toggle');

    // Registration form
    document.getElementById('register-btn').addEventListener('click', registerUser);
    setupPasswordToggle('register-password', 'register-password-toggle');
    setupPasswordToggle('confirm-password', 'confirm-password-toggle');

    // Password strength and match indicators
    document.getElementById('register-password').addEventListener('input', function() {
        checkPasswordStrength(this.value);
        checkPasswordMatch();
    });

    document.getElementById('confirm-password').addEventListener('input', checkPasswordMatch);

    // Form switching
    document.getElementById('show-register').addEventListener('click', showRegisterForm);
    document.getElementById('show-login').addEventListener('click', showLoginForm);

    // Chat functionality
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('emoji-btn').addEventListener('click', toggleEmojiPicker);

    // NEW: Typing indicators
    setupTypingIndicators();

    // Enter key support
    setupEnterKeySupport();

    // Set up emoji picker
    setupEmojiPicker();
}

function setupPasswordToggle(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleBtn = document.getElementById(toggleId);
    const eyeIcon = toggleBtn.querySelector('.eye-icon');

    toggleBtn.addEventListener('click', function() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.textContent = '🔒';
            toggleBtn.title = 'Hide password';
        } else {
            passwordInput.type = 'password';
            eyeIcon.textContent = '👁️';
            toggleBtn.title = 'Show password';
        }
        passwordInput.focus();
    });
}

function checkPasswordStrength(password) {
    const strengthBar = document.getElementById('register-strength-bar');
    const strengthText = document.getElementById('register-strength-text');

    let strength = 0;
    let text = '';
    let className = '';

    if (password.length === 0) {
        strength = 0;
        text = '';
    } else if (password.length < 4) {
        strength = 33;
        text = 'Weak';
        className = 'strength-weak password';
    } else if (password.length < 8) {
        strength = 66;
        text = 'Medium';
        className = 'strength-medium password';
    } else {
        strength = 100;
        text = 'Strong';
        className = 'strength-strong password';
    }

    strengthBar.className = 'strength-bar ' + className;
    strengthBar.style.width = strength + '%';
    strengthText.textContent = text;
}

function checkPasswordMatch() {
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const matchIndicator = document.getElementById('password-match-indicator');

    if (confirmPassword.length === 0) {
        matchIndicator.classList.remove('visible', 'valid', 'invalid');
        return;
    }

    if (password === confirmPassword) {
        matchIndicator.classList.add('visible', 'valid');
        matchIndicator.classList.remove('invalid');
    } else {
        matchIndicator.classList.add('visible', 'invalid');
        matchIndicator.classList.remove('valid');
    }
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    hideError();
    hideSuccess();
    // Clear registration form
    document.getElementById('register-username').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('confirm-password').value = '';
    document.getElementById('register-strength-bar').style.width = '0%';
    document.getElementById('register-strength-text').textContent = '';
    document.getElementById('password-match-indicator').classList.remove('visible', 'valid', 'invalid');
}

function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    hideError();
    hideSuccess();
}

// NEW: Typing indicators setup
function setupTypingIndicators() {
    let typingTimer;
    const messageInput = document.getElementById('message-input');

    messageInput.addEventListener('input', function() {
        socket.emit('typing_start');
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            socket.emit('typing_stop');
        }, 1000);
    });
}

function setupEnterKeySupport() {
    // Login form
    document.getElementById('username-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') loginUser();
    });

    document.getElementById('password-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') loginUser();
    });

    // Registration form
    document.getElementById('register-username').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') registerUser();
    });

    document.getElementById('register-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') registerUser();
    });

    document.getElementById('confirm-password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') registerUser();
    });

    // Chat
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
}

async function registerUser() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Clear previous messages
    hideError();
    hideSuccess();

    // Validate inputs
    if (username.length < 2) {
        showError('Username must be at least 2 characters long');
        return;
    }

    if (username.length > 20) {
        showError('Username must be less than 20 characters');
        return;
    }

    if (password.length < 3) {
        showError('Password must be at least 3 characters long');
        return;
    }

    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }

    // Show loading state
    const registerBtn = document.getElementById('register-btn');
    const originalText = registerBtn.textContent;
    registerBtn.classList.add('btn-loading');
    registerBtn.disabled = true;

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Account created successfully! You can now login.');
            // Switch to login form after delay
            setTimeout(() => {
                showLoginForm();
                // Pre-fill username in login form
                document.getElementById('username-input').value = username;
                document.getElementById('password-input').focus();
            }, 2000);
        } else {
            showError(result.message);
        }
    } catch (error) {
        showError('Error connecting to server');
        console.error('Registration error:', error);
    } finally {
        // Restore button state
        registerBtn.classList.remove('btn-loading');
        registerBtn.disabled = false;
        registerBtn.textContent = originalText;
    }
}

function loginUser() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value;

    // Clear previous errors
    hideError();

    // Validate inputs
    if (username.length < 2) {
        showError('Username must be at least 2 characters long');
        return;
    }

    if (password.length === 0) {
        showError('Password is required');
        return;
    }

    // Show loading state
    const loginBtn = document.getElementById('login-btn');
    const originalText = loginBtn.textContent;
    loginBtn.classList.add('btn-loading');
    loginBtn.disabled = true;

    // Join chat with credentials
    socket.emit('join_chat', {
        username: username,
        password: password
    });
}

// Socket event handlers
socket.on('error', function(data) {
    // Restore button state
    const loginBtn = document.getElementById('login-btn');
    loginBtn.classList.remove('btn-loading');
    loginBtn.disabled = false;

    showError(data.message);
});

socket.on('user_joined', function(data) {
    // Restore button state
    const loginBtn = document.getElementById('login-btn');
    loginBtn.classList.remove('btn-loading');
    loginBtn.disabled = false;

    // Successful login
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('chatSection').style.display = 'flex';
    document.getElementById('message-input').focus();
    createOnlineUsersPanel();
});

socket.on('user_left', function(data) {
    removeOnlineUser(data.username);
    showPopupNotification(`${data.username} left the chat`, 'leave');
});

socket.on('new_message', function(data) {
    addMessage(data.username, data.message, data.timestamp, data.date, data.avatar_color);
});

socket.on('user_joined', function(data) {
    addOnlineUser(data.username, data.avatar_color);
    showPopupNotification(`${data.username} joined the chat`, 'join');
});

// NEW: Typing indicator events
socket.on('user_typing', function(data) {
    showTypingIndicator(data.username);
});

socket.on('user_stopped_typing', function() {
    hideTypingIndicator();
});

// NEW: Private messaging events
socket.on('private_message_received', function(data) {
    addPrivateMessage(data.from_user, data.message, data.timestamp, data.avatar_color);
});

socket.on('private_message_sent', function(data) {
    addPrivateMessage(`To ${data.from_user}`, data.message, data.timestamp, data.avatar_color, true);
});

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (message) {
        socket.emit('send_message', { message: message });
        messageInput.value = '';
        document.getElementById('emoji-picker').style.display = 'none';

        // Stop typing indicator
        socket.emit('typing_stop');
    }
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
}

function setupEmojiPicker() {
    const emojiGrid = document.querySelector('.emoji-grid');
    if (!emojiGrid) return;

    const emojiSpans = emojiGrid.querySelectorAll('span');

    emojiSpans.forEach(span => {
        span.addEventListener('click', function() {
            const emoji = this.textContent;
            const messageInput = document.getElementById('message-input');
            messageInput.value += emoji;
            messageInput.focus();
            document.getElementById('emoji-picker').style.display = 'none';
        });
    });
}

function createOnlineUsersPanel() {
    // Remove existing panel if any
    const existingPanel = document.querySelector('.online-users');
    if (existingPanel) {
        existingPanel.remove();
    }

    const onlineUsersDiv = document.createElement('div');
    onlineUsersDiv.className = 'online-users';
    onlineUsersDiv.innerHTML = `
        <h3>🟢 Online Users</h3>
        <div id="users-list"></div>
    `;
    document.body.appendChild(onlineUsersDiv);

    // Add click handlers for private messaging
    setTimeout(() => {
        setupPrivateMessageHandlers();
    }, 100);
}

// NEW: Setup private message handlers
function setupPrivateMessageHandlers() {
    const userItems = document.querySelectorAll('.user-item');
    userItems.forEach(item => {
        item.addEventListener('click', function() {
            const username = this.querySelector('.username').textContent;
            const currentUser = document.getElementById('username-input').value.trim();

            if (username !== currentUser) {
                const message = prompt(`Send private message to ${username}:`);
                if (message && message.trim()) {
                    sendPrivateMessage(username, message.trim());
                }
            }
        });

        // Add hover effect
        item.style.cursor = 'pointer';
        item.title = 'Click to send private message';
    });
}

// NEW: Send private message function
function sendPrivateMessage(targetUser, message) {
    socket.emit('private_message', {
        target_user: targetUser,
        message: message
    });
}

// UPDATED: Message function with date support
function addMessage(username, message, timestamp = 'Just now', date = null, avatarColor = '#666666') {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    const userInitial = username.charAt(0).toUpperCase();

    // Format timestamp with date if available
    let timeDisplay = timestamp;
    if (date) {
        const today = new Date().toISOString().split('T')[0];
        const messageDate = date;

        if (messageDate === today) {
            timeDisplay = `Today ${timestamp}`;
        } else {
            timeDisplay = `${messageDate} ${timestamp}`;
        }
    }

    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="avatar" style="background: ${avatarColor}">${userInitial}</div>
            <span class="username">${username}</span>
            <span class="timestamp">${timeDisplay}</span>
        </div>
        <div class="text">${message}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// NEW: Add private message function
function addPrivateMessage(username, message, timestamp, avatarColor, isSent = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message private-message ${isSent ? 'sent' : 'received'}`;

    const userInitial = username.charAt(0).toUpperCase();

    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="avatar" style="background: ${avatarColor}">${userInitial}</div>
            <span class="username">${username} ${isSent ? '' : '(Private)'}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <div class="text">${message}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addOnlineUser(username, avatarColor) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;

    const userInitial = username.charAt(0).toUpperCase();

    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.id = `user-${username}`;
    userItem.innerHTML = `
        <div class="user-avatar" style="background: ${avatarColor}">${userInitial}</div>
        <span class="username">${username}</span>
        <span class="online-status">🟢</span>
    `;

    usersList.appendChild(userItem);

    // Setup private message handler for new user
    setTimeout(() => {
        userItem.addEventListener('click', function() {
            const currentUser = document.getElementById('username-input').value.trim();

            if (username !== currentUser) {
                const message = prompt(`Send private message to ${username}:`);
                if (message && message.trim()) {
                    sendPrivateMessage(username, message.trim());
                }
            }
        });

        userItem.style.cursor = 'pointer';
        userItem.title = 'Click to send private message';
    }, 100);
}

function removeOnlineUser(username) {
    const userElement = document.getElementById(`user-${username}`);
    if (userElement) {
        userElement.remove();
    }
}

// NEW: Typing indicator functions
function showTypingIndicator(username) {
    let typingDiv = document.getElementById('typing-indicator');
    if (!typingDiv) {
        typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'typing-indicator';
        document.getElementById('chat-messages').appendChild(typingDiv);
    }
    typingDiv.textContent = `${username} is typing...`;
    typingDiv.style.display = 'block';

    // Auto scroll to bottom
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) {
        typingDiv.style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    errorDiv.classList.remove('show');
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.classList.add('show');
}

function hideSuccess() {
    const successDiv = document.getElementById('success-message');
    successDiv.classList.remove('show');
}

function showPopupNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `popup-notification ${type}`;

    const icon = type === 'join' ? '🟢' : '🔴';

    notification.innerHTML = `
        <div class="popup-content">
            <span class="popup-icon">${icon}</span>
            <span class="popup-text">${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    // Position notification
    const onlinePanel = document.querySelector('.online-users');
    let topPosition = 15;
    if (onlinePanel) {
        const panelRect = onlinePanel.getBoundingClientRect();
        topPosition = panelRect.bottom + 10;
    }

    notification.style.top = `${topPosition}px`;
    notification.style.right = '15px';

    // Show animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Auto hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Close emoji picker when clicking outside
document.addEventListener('click', function(event) {
    const picker = document.getElementById('emoji-picker');
    const emojiBtn = document.getElementById('emoji-btn');

    if (picker && emojiBtn && !picker.contains(event.target) && !emojiBtn.contains(event.target)) {
        picker.style.display = 'none';
    }
});

// Request online users when joining chat
socket.on('connect', function() {
    console.log('Connected to server');
});

socket.on('online_users_list', function(data) {
    // Clear existing users
    const usersList = document.getElementById('users-list');
    if (usersList) {
        usersList.innerHTML = '';
    }

    // Add all online users
    data.users.forEach(user => {
        addOnlineUser(user.username, user.avatar_color);
    });
});

// Get online users when joining chat
socket.on('user_joined', function(data) {
    socket.emit('get_online_users');
});
