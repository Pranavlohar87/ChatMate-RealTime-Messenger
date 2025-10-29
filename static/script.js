const socket = io(window.location.origin, {
    transports: ['websocket', 'polling']
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

function setupEventListeners() {
    // Login form
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', loginUser);
    }
    setupPasswordToggle('password-input', 'password-toggle');

    // Registration form
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', registerUser);
    }
    setupPasswordToggle('register-password', 'register-password-toggle');
    setupPasswordToggle('confirm-password', 'confirm-password-toggle');

    // Password strength and match indicators
    const registerPassword = document.getElementById('register-password');
    if (registerPassword) {
        registerPassword.addEventListener('input', function() {
            checkPasswordStrength(this.value);
            checkPasswordMatch();
        });
    }

    const confirmPassword = document.getElementById('confirm-password');
    if (confirmPassword) {
        confirmPassword.addEventListener('input', checkPasswordMatch);
    }

    // Form switching
    const showRegister = document.getElementById('show-register');
    if (showRegister) {
        showRegister.addEventListener('click', showRegisterForm);
    }

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', showLoginForm);
    }

    // Chat functionality
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    const emojiBtn = document.getElementById('emoji-btn');
    if (emojiBtn) {
        emojiBtn.addEventListener('click', toggleEmojiPicker);
    }

    // Enter key support
    setupEnterKeySupport();

    // Set up emoji picker
    setupEmojiPicker();
}

function setupPasswordToggle(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleBtn = document.getElementById(toggleId);

    if (!passwordInput || !toggleBtn) return;

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

    if (!strengthBar || !strengthText) return;

    let strength = 0;
    let text = '';
    let className = '';

    if (password.length === 0) {
        strength = 0;
        text = '';
    } else if (password.length < 4) {
        strength = 33;
        text = 'Weak';
        className = 'strength-weak';
    } else if (password.length < 8) {
        strength = 66;
        text = 'Medium';
        className = 'strength-medium';
    } else {
        strength = 100;
        text = 'Strong';
        className = 'strength-strong';
    }

    strengthBar.className = 'strength-bar ' + className;
    strengthBar.style.width = strength + '%';
    strengthText.textContent = text;
}

function checkPasswordMatch() {
    const password = document.getElementById('register-password') ? .value || '';
    const confirmPassword = document.getElementById('confirm-password') ? .value || '';
    const matchIndicator = document.getElementById('password-match-indicator');

    if (!matchIndicator) return;

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
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('confirm-password').value = '';

    const strengthBar = document.getElementById('register-strength-bar');
    const strengthText = document.getElementById('register-strength-text');
    const matchIndicator = document.getElementById('password-match-indicator');

    if (strengthBar) strengthBar.style.width = '0%';
    if (strengthText) strengthText.textContent = '';
    if (matchIndicator) matchIndicator.classList.remove('visible', 'valid', 'invalid');
}

function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    hideError();
    hideSuccess();
}

function setupEnterKeySupport() {
    // Login form - CHECK IF ELEMENTS EXIST FIRST
    const loginEmail = document.getElementById('login-email');
    const passwordInput = document.getElementById('password-input');

    if (loginEmail) {
        loginEmail.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') loginUser();
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') loginUser();
        });
    }

    // Registration form - CHECK IF ELEMENTS EXIST FIRST
    const registerUsername = document.getElementById('register-username');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const confirmPassword = document.getElementById('confirm-password');

    if (registerUsername) {
        registerUsername.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') registerUser();
        });
    }

    if (registerEmail) {
        registerEmail.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') registerUser();
        });
    }

    if (registerPassword) {
        registerPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') registerUser();
        });
    }

    if (confirmPassword) {
        confirmPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') registerUser();
        });
    }

    // Chat
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendMessage();
        });
    }
}

async function registerUser() {
    console.log('Register button clicked!');

    const username = document.getElementById('register-username') ? .value.trim() || '';
    const email = document.getElementById('register-email') ? .value.trim().toLowerCase() || '';
    const password = document.getElementById('register-password') ? .value || '';
    const confirmPassword = document.getElementById('confirm-password') ? .value || '';

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

    if (!email || !email.includes('@')) {
        showError('Please enter a valid email address');
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
    if (registerBtn) {
        const originalText = registerBtn.textContent;
        registerBtn.classList.add('btn-loading');
        registerBtn.disabled = true;
        registerBtn.textContent = 'Creating Account...';
    }

    try {
        console.log('Sending registration request...');
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                email: email,
                password: password
            })
        });

        const result = await response.json();
        console.log('Registration response:', result);

        if (result.success) {
            showSuccess('Account created successfully! You can now login.');
            // Switch to login form after delay
            setTimeout(() => {
                showLoginForm();
                // Pre-fill email in login form
                const loginEmail = document.getElementById('login-email');
                if (loginEmail) loginEmail.value = email;
                const passwordInput = document.getElementById('password-input');
                if (passwordInput) passwordInput.focus();
            }, 2000);
        } else {
            showError(result.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('Error connecting to server');
    } finally {
        // Restore button state
        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            registerBtn.classList.remove('btn-loading');
            registerBtn.disabled = false;
            registerBtn.textContent = 'Create Account';
        }
    }
}

function loginUser() {
    const email = document.getElementById('login-email') ? .value.trim().toLowerCase() || '';
    const password = document.getElementById('password-input') ? .value || '';

    // Clear previous errors
    hideError();

    // Validate inputs
    if (!email || !email.includes('@')) {
        showError('Please enter a valid email address');
        return;
    }

    if (password.length === 0) {
        showError('Password is required');
        return;
    }

    // Show loading state
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.classList.add('btn-loading');
        loginBtn.disabled = true;
    }

    // Join chat with credentials
    console.log('Attempting login with:', email);
    socket.emit('join_chat', {
        email: email,
        password: password
    });
}

// Socket event handlers
socket.on('error', function(data) {
    console.log('Socket error:', data);
    // Restore button state
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.classList.remove('btn-loading');
        loginBtn.disabled = false;
    }

    showError(data.message);
});

socket.on('join_success', function(data) {
    console.log('Login successful:', data);
    // Restore button state
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.classList.remove('btn-loading');
        loginBtn.disabled = false;
    }

    // Successful login
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('chatSection').style.display = 'flex';

    const messageInput = document.getElementById('message-input');
    if (messageInput) messageInput.focus();

    createOnlineUsersPanel();

    // Request online users list
    socket.emit('get_online_users');
});

socket.on('user_joined', function(data) {
    console.log('User joined:', data);
    updateOnlineUsers(data.online_users);
    showPopupNotification(`${data.username} joined the chat`, 'join');
});

socket.on('user_left', function(data) {
    console.log('User left:', data);
    updateOnlineUsers(data.online_users);
    showPopupNotification(`${data.username} left the chat`, 'leave');
});

socket.on('new_message', function(data) {
    console.log('New message:', data);
    addMessage(data.username, data.message, data.timestamp, data.avatar_color);
});

socket.on('online_users_list', function(data) {
    console.log('Online users:', data);
    updateOnlineUsers(data.users);
});

socket.on('connect', function() {
    console.log('Connected to server');
});

socket.on('disconnect', function() {
    console.log('Disconnected from server');
});

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput ? .value.trim() || '';

    if (message) {
        console.log('Sending message:', message);
        socket.emit('send_message', { message: message });
        messageInput.value = '';
        const emojiPicker = document.getElementById('emoji-picker');
        if (emojiPicker) emojiPicker.style.display = 'none';
    }
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    if (picker) {
        picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
    }
}

function setupEmojiPicker() {
    const emojiGrid = document.querySelector('.emoji-grid');
    if (!emojiGrid) return;

    const emojiSpans = emojiGrid.querySelectorAll('span');

    emojiSpans.forEach(span => {
        span.addEventListener('click', function() {
            const emoji = this.textContent;
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value += emoji;
                messageInput.focus();
            }
            const emojiPicker = document.getElementById('emoji-picker');
            if (emojiPicker) emojiPicker.style.display = 'none';
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
}

function addMessage(username, message, timestamp = 'Just now', avatarColor = '#666666') {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    const userInitial = username.charAt(0).toUpperCase();

    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="avatar" style="background: ${avatarColor}">${userInitial}</div>
            <span class="username">${username}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <div class="text">${message}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateOnlineUsers(users) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;

    usersList.innerHTML = '';
    users.forEach(user => {
        addOnlineUser(user.username, user.avatar_color);
    });
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
}

function removeOnlineUser(username) {
    const userElement = document.getElementById(`user-${username}`);
    if (userElement) {
        userElement.remove();
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.classList.add('show');
    }
}

function hideSuccess() {
    const successDiv = document.getElementById('success-message');
    if (successDiv) {
        successDiv.classList.remove('show');
    }
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
