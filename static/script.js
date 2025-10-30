document.addEventListener('DOMContentLoaded', function() {
    // Socket.IO connection
    const socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    // DOM Elements
    const loginSection = document.getElementById('loginSection');
    const chatSection = document.getElementById('chatSection');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');

    // Password toggle functionality
    const passwordToggle = document.getElementById('password-toggle');
    const registerPasswordToggle = document.getElementById('register-password-toggle');
    const confirmPasswordToggle = document.getElementById('confirm-password-toggle');
    const passwordInput = document.getElementById('password-input');
    const registerPassword = document.getElementById('register-password');
    const confirmPassword = document.getElementById('confirm-password');

    // Password strength elements
    const strengthBar = document.getElementById('register-strength-bar');
    const strengthText = document.getElementById('register-strength-text');
    const passwordMatch = document.getElementById('password-match-indicator');

    // Connection status
    let isConnected = false;
    let currentUser = null;

    // Socket.IO Events
    socket.on('connect', function() {
        console.log('✅ Connected to server');
        isConnected = true;
        showConnectionStatus('Connected to chat', 'connected');
    });

    socket.on('disconnect', function() {
        console.log('❌ Disconnected from server');
        isConnected = false;
        showConnectionStatus('Disconnected from chat', 'disconnected');
    });

    socket.on('connected', function(data) {
        console.log('Server:', data.message);
    });

    socket.on('join_success', function(data) {
        console.log('✅ Join success:', data.message);
        currentUser = { username: data.username };
        showSuccessMessage(`Welcome ${data.username}!`);
        switchToChat();
        updateOnlineUsers();
    });

    socket.on('login_error', function(data) {
        console.error('❌ Login error:', data.message);
        showErrorMessage(data.message);
        enableLoginButton();
    });

    socket.on('new_message', function(data) {
        console.log('📨 New message:', data);
        displayMessage(data);
    });

    socket.on('user_joined', function(data) {
        console.log('👋 User joined:', data);
        displaySystemMessage(`${data.username} joined the chat`, data.timestamp);
        socket.emit('get_online_users');
    });

    socket.on('user_left', function(data) {
        console.log('👋 User left:', data);
        displaySystemMessage(`${data.username} left the chat`, data.timestamp);
        socket.emit('get_online_users');
    });

    socket.on('online_users_update', function(data) {
        console.log('👥 Online users update:', data.users);
        updateOnlineUsersList(data.users);
    });

    socket.on('error', function(data) {
        console.error('❌ Error:', data.message);
        showErrorMessage(data.message);
    });

    // Form Toggle
    showRegister.addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        clearMessages();
    });

    showLogin.addEventListener('click', function(e) {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        clearMessages();
    });

    // Login Handler
    loginBtn.addEventListener('click', function() {
        const email = document.getElementById('login-email').value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            showErrorMessage('Please fill in all fields');
            return;
        }

        disableLoginButton();
        clearMessages();

        console.log('🔐 Attempting login...');
        socket.emit('join_chat', {
            email: email,
            password: password
        });
    });

    // Register Handler
    registerBtn.addEventListener('click', function() {
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = registerPassword.value.trim();
        const confirm = confirmPassword.value.trim();

        if (!username || !email || !password || !confirm) {
            showErrorMessage('Please fill in all fields');
            return;
        }

        if (password !== confirm) {
            showErrorMessage('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            showErrorMessage('Password must be at least 6 characters long');
            return;
        }

        disableRegisterButton();
        clearMessages();

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
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccessMessage('Account created successfully! Please login.');
                registerForm.style.display = 'none';
                loginForm.style.display = 'block';
                // Clear registration form
                document.getElementById('register-username').value = '';
                document.getElementById('register-email').value = '';
                registerPassword.value = '';
                confirmPassword.value = '';
            } else {
                showErrorMessage(data.message);
            }
            enableRegisterButton();
        })
        .catch(error => {
            console.error('Registration error:', error);
            showErrorMessage('Registration failed. Please try again.');
            enableRegisterButton();
        });
    });

    // Send Message - INSTANT DISPLAY
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && isConnected) {
            // Display message instantly
            displayOwnMessageInstantly(message);
            
            // Clear input immediately
            messageInput.value = '';
            hideEmojiPicker();
            
            // Send to server
            socket.emit('send_message', {
                message: message
            });
        }
    }

    // Password Toggle
    [passwordToggle, registerPasswordToggle, confirmPasswordToggle].forEach((toggle, index) => {
        toggle.addEventListener('click', function() {
            const inputs = [passwordInput, registerPassword, confirmPassword];
            const input = inputs[index];
            const eyeIcon = toggle.querySelector('.eye-icon');
            
            if (input.type === 'password') {
                input.type = 'text';
                eyeIcon.textContent = '👁️‍🗨️';
            } else {
                input.type = 'password';
                eyeIcon.textContent = '👁️';
            }
        });
    });

    // Password Strength Check
    registerPassword.addEventListener('input', checkPasswordStrength);
    confirmPassword.addEventListener('input', checkPasswordMatch);

    // Emoji Picker
    emojiBtn.addEventListener('click', function() {
        emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
    });

    // Add emoji click handlers
    emojiPicker.querySelectorAll('.emoji-grid span').forEach(emoji => {
        emoji.addEventListener('click', function() {
            messageInput.value += this.textContent;
            messageInput.focus();
        });
    });

    // Hide emoji picker when clicking outside
    document.addEventListener('click', function(e) {
        if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
            hideEmojiPicker();
        }
    });

    // ===== MESSAGE DISPLAY FUNCTIONS =====
    function displayMessage(data) {
        // Check if this is our own message (already displayed instantly)
        if (currentUser && data.username === currentUser.username) {
            return; // Skip duplicate display
        }
        
        const messageDiv = document.createElement('div');
        const isOwnMessage = currentUser && data.username === currentUser.username;
        messageDiv.className = `message ${isOwnMessage ? 'own-message' : ''}`;
        
        const avatarColor = stringToColor(data.username);
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="avatar" style="background-color: ${avatarColor}">
                    ${data.username.charAt(0).toUpperCase()}
                </div>
                <span class="username">${data.username}${isOwnMessage ? ' (You)' : ''}</span>
            </div>
            <div class="text">${escapeHtml(data.message)}</div>
            <div class="timestamp">${data.timestamp}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function displayOwnMessageInstantly(message) {
        if (!currentUser) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message own-message';
        
        const avatarColor = stringToColor(currentUser.username);
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="avatar" style="background-color: ${avatarColor}">
                    ${currentUser.username.charAt(0).toUpperCase()}
                </div>
                <span class="username">${currentUser.username} (You)</span>
            </div>
            <div class="text">${escapeHtml(message)}</div>
            <div class="timestamp">${timestamp}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function displaySystemMessage(message, timestamp) {
        const systemDiv = document.createElement('div');
        systemDiv.className = 'system-message';
        systemDiv.textContent = `${message} • ${timestamp}`;
        chatMessages.appendChild(systemDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ===== ONLINE USERS FUNCTIONS =====
    function updateOnlineUsers() {
        const onlineUsersPanel = document.getElementById('onlineUsersPanel');
        if (onlineUsersPanel) {
            onlineUsersPanel.style.display = 'block';
            socket.emit('get_online_users');
        }
    }

    function updateOnlineUsersList(users) {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        if (!users || users.length === 0) {
            usersList.innerHTML = '<div class="user-item">No users online</div>';
            return;
        }

        let usersHTML = '';
        users.forEach(user => {
            const isCurrentUser = currentUser && user.username === currentUser.username;
            const avatarColor = stringToColor(user.username);
            usersHTML += `
                <div class="user-item">
                    <div class="user-avatar" style="background-color: ${avatarColor}">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <span class="username">${user.username}${isCurrentUser ? ' (You)' : ''}</span>
                    <div class="online-status"></div>
                </div>
            `;
        });

        usersList.innerHTML = usersHTML;
    }

    // ===== UTILITY FUNCTIONS =====
    function switchToChat() {
        loginSection.style.display = 'none';
        chatSection.style.display = 'flex';
        messageInput.focus();
    }

    function showErrorMessage(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    }

    function showSuccessMessage(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    function clearMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    function disableLoginButton() {
        loginBtn.disabled = true;
        loginBtn.classList.add('btn-loading');
        loginBtn.textContent = 'Connecting...';
    }

    function enableLoginButton() {
        loginBtn.disabled = false;
        loginBtn.classList.remove('btn-loading');
        loginBtn.textContent = 'Login to Chat';
    }

    function disableRegisterButton() {
        registerBtn.disabled = true;
        registerBtn.classList.add('btn-loading');
        registerBtn.textContent = 'Creating Account...';
    }

    function enableRegisterButton() {
        registerBtn.disabled = false;
        registerBtn.classList.remove('btn-loading');
        registerBtn.textContent = 'Create Account';
    }

    function checkPasswordStrength() {
        const password = registerPassword.value;
        let strength = 0;
        let text = '';
        let className = '';

        if (password.length > 0) {
            if (password.length < 6) {
                strength = 1;
                text = 'Weak';
                className = 'weak';
            } else if (password.length < 10) {
                strength = 2;
                text = 'Medium';
                className = 'medium';
            } else {
                strength = 3;
                text = 'Strong';
                className = 'strong';
            }

            // Check for special characters
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                strength = Math.min(strength + 1, 3);
            }
        }

        strengthBar.className = 'strength-bar';
        if (strength > 0) {
            strengthBar.classList.add(`strength-${className}`);
            strengthText.textContent = text;
            strengthText.className = `password-strength-text ${className}`;
        } else {
            strengthText.textContent = '';
        }
    }

    function checkPasswordMatch() {
        const password = registerPassword.value;
        const confirm = confirmPassword.value;

        if (confirm.length === 0) {
            passwordMatch.classList.remove('visible', 'valid', 'invalid');
            return;
        }

        passwordMatch.classList.add('visible');
        
        if (password === confirm && password.length > 0) {
            passwordMatch.classList.add('valid');
            passwordMatch.classList.remove('invalid');
        } else {
            passwordMatch.classList.add('invalid');
            passwordMatch.classList.remove('valid');
        }
    }

    function hideEmojiPicker() {
        emojiPicker.style.display = 'none';
    }

    function showConnectionStatus(message, type) {
        // Remove existing status
        const existingStatus = document.querySelector('.connection-status');
        if (existingStatus) {
            existingStatus.remove();
        }

        const statusDiv = document.createElement('div');
        statusDiv.className = `connection-status ${type}`;
        statusDiv.innerHTML = `
            <span class="status-dot ${type}"></span>
            ${message}
        `;
        
        document.body.appendChild(statusDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.remove();
            }
        }, 3000);
    }

    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initialize
    console.log('🚀 ChatMate initialized');
});
