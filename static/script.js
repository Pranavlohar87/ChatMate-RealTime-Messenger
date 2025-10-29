const socket = io(window.location.origin, {
    transports: ['websocket', 'polling']
});

// Safe initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - setting up safe listeners');
    setTimeout(initializeApp, 100);
});

function initializeApp() {
    console.log('Initializing app...');

    // Setup basic event listeners safely
    setupSafeEventListeners();
    setupFormSwitching();
    setupPasswordToggles();
    setupEmojiPicker();
}

function setupSafeEventListeners() {
    console.log('Setting up safe event listeners...');

    // Register button
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        console.log('✓ Register button found');
        registerBtn.addEventListener('click', handleRegister);
    } else {
        console.log('✗ Register button NOT found');
    }

    // Login button
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        console.log('✓ Login button found');
        loginBtn.addEventListener('click', handleLogin);
    }

    // Send button
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
    }

    // Emoji button
    const emojiBtn = document.getElementById('emoji-btn');
    if (emojiBtn) {
        emojiBtn.addEventListener('click', toggleEmojiPicker);
    }

    // Enter key for message input
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSendMessage();
        });
    }

    // Enter key for forms
    setupEnterKeySupport();
}

function setupFormSwitching() {
    // Show register form
    const showRegister = document.getElementById('show-register');
    if (showRegister) {
        showRegister.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('registerForm').style.display = 'block';
            clearMessages();
        });
    }

    // Show login form
    const showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            clearMessages();
        });
    }
}

function setupPasswordToggles() {
    setupPasswordToggle('password-input', 'password-toggle');
    setupPasswordToggle('register-password', 'register-password-toggle');
    setupPasswordToggle('confirm-password', 'confirm-password-toggle');
}

function setupPasswordToggle(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleBtn = document.getElementById(toggleId);

    if (!passwordInput || !toggleBtn) return;

    const eyeIcon = toggleBtn.querySelector('.eye-icon');
    if (!eyeIcon) return;

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

function setupEnterKeySupport() {
    // Login form
    const loginEmail = document.getElementById('login-email');
    const passwordInput = document.getElementById('password-input');

    if (loginEmail) {
        loginEmail.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleLogin();
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // Registration form
    const registerUsername = document.getElementById('register-username');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const confirmPassword = document.getElementById('confirm-password');

    if (registerUsername) {
        registerUsername.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleRegister();
        });
    }

    if (registerEmail) {
        registerEmail.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleRegister();
        });
    }

    if (registerPassword) {
        registerPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleRegister();
        });
    }

    if (confirmPassword) {
        confirmPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleRegister();
        });
    }
}

function handleRegister() {
    console.log('Register button clicked!');

    // Get form values safely
    const username = getValue('register-username');
    const email = getValue('register-email');
    const password = getValue('register-password');
    const confirmPassword = getValue('confirm-password');

    console.log('Form data:', { username, email, password, confirmPassword });

    // Validation
    if (!username || username.length < 2) {
        showMessage('Username must be at least 2 characters', 'error');
        return;
    }

    if (!email || !email.includes('@')) {
        showMessage('Please enter a valid email', 'error');
        return;
    }

    if (!password || password.length < 3) {
        showMessage('Password must be at least 3 characters', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }

    // Show loading state
    const btn = document.getElementById('register-btn');
    if (btn) {
        btn.textContent = 'Creating Account...';
        btn.disabled = true;
    }

    // Send registration request
    fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                email: email,
                password: password
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Registration response:', data);
            if (data.success) {
                showMessage('Account created successfully! You can now login.', 'success');
                // Switch to login form after delay
                setTimeout(() => {
                    document.getElementById('registerForm').style.display = 'none';
                    document.getElementById('loginForm').style.display = 'block';
                    // Pre-fill email
                    const loginEmail = document.getElementById('login-email');
                    if (loginEmail) loginEmail.value = email;
                    clearMessages();
                }, 2000);
            } else {
                showMessage(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Registration error:', error);
            showMessage('Error connecting to server', 'error');
        })
        .finally(() => {
            // Restore button
            if (btn) {
                btn.textContent = 'Create Account';
                btn.disabled = false;
            }
        });
}

function handleLogin() {
    const email = getValue('login-email');
    const password = getValue('password-input');

    if (!email || !password) {
        showMessage('Please enter email and password', 'error');
        return;
    }

    // Add socket connection check
    if (!socket || !socket.connected) {
        showMessage('Not connected to server. Please refresh the page.', 'error');
        return;
    }

    const btn = document.getElementById('login-btn');
    if (btn) {
        btn.textContent = 'Logging in...';
        btn.disabled = true;
    }

    console.log('Attempting login with:', email);
    socket.emit('join_chat', {
        email: email,
        password: password
    });
}

function handleSendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput ? messageInput.value.trim() : '';

    if (message && socket && socket.connected) {
        socket.emit('send_message', { message: message });
        messageInput.value = '';

        // Hide emoji picker
        const emojiPicker = document.getElementById('emoji-picker');
        if (emojiPicker) emojiPicker.style.display = 'none';
    } else if (message && (!socket || !socket.connected)) {
        showMessage('Not connected to server', 'error');
    }
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    if (picker) {
        picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
    }
}

// Setup emoji picker
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
        });
    });
}

// Close emoji picker when clicking outside
document.addEventListener('click', function(event) {
    const picker = document.getElementById('emoji-picker');
    const emojiBtn = document.getElementById('emoji-btn');

    if (picker && emojiBtn && !picker.contains(event.target) && !emojiBtn.contains(event.target)) {
        picker.style.display = 'none';
    }
});

// Socket event handlers
socket.on('join_success', function(data) {
    console.log('Login successful:', data);
    const btn = document.getElementById('login-btn');
    if (btn) {
        btn.textContent = 'Login to Chat';
        btn.disabled = false;
    }

    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('chatSection').style.display = 'flex';

    // Focus on message input
    const messageInput = document.getElementById('message-input');
    if (messageInput) messageInput.focus();
});

socket.on('error', function(data) {
    console.log('Socket error:', data);
    const btn = document.getElementById('login-btn');
    if (btn) {
        btn.textContent = 'Login to Chat';
        btn.disabled = false;
    }
    showMessage(data.message, 'error');
});

socket.on('new_message', function(data) {
    addMessage(data.username, data.message, data.timestamp, data.avatar_color);
});

socket.on('user_joined', function(data) {
    addSystemMessage(`${data.username} joined the chat`);
});

socket.on('user_left', function(data) {
    addSystemMessage(`${data.username} left the chat`);
});

socket.on('connect', function() {
    console.log('Connected to server');
    showMessage('Connected to server', 'success');
    setTimeout(clearMessages, 3000);
});

socket.on('disconnect', function() {
    console.log('Disconnected from server');
    showMessage('Disconnected from server', 'error');
});

socket.on('connect_error', function(error) {
    console.log('Connection error:', error);
    showMessage('Connection failed. Please refresh the page.', 'error');
});

// Helper functions
function getValue(elementId) {
    const element = document.getElementById(elementId);
    return element ? element.value.trim() : '';
}

function showMessage(message, type) {
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');

    if (type === 'error' && errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        if (successDiv) successDiv.style.display = 'none';
    } else if (type === 'success' && successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        if (errorDiv) errorDiv.style.display = 'none';
    }
}

function clearMessages() {
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
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

function addSystemMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const systemDiv = document.createElement('div');
    systemDiv.className = 'system-message';
    systemDiv.textContent = message;

    chatMessages.appendChild(systemDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleLogin,
        handleRegister,
        handleSendMessage,
        addMessage,
        addSystemMessage
    };
}

console.log('ChatMate JavaScript loaded safely!');
