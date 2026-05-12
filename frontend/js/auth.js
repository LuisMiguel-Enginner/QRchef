// Configurações de API do Cloudflare
const CF_CONFIG = {
    BASE_URL: (window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' || 
               window.location.hostname.startsWith('192.168.')) 
        ? `${window.location.protocol}//${window.location.hostname}:8787` 
        : 'https://qrchef-worker.claudio-m-martins.workers.dev', // URL atualizada
};

// Utilitários de UI
const UI = {
    setLoading(btnId, isLoading, originalText) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processando...`;
            btn.style.opacity = '0.7';
        } else {
            btn.disabled = false;
            btn.innerHTML = `<span>${originalText}</span>`;
            btn.style.opacity = '1';
        }
    },

    showNotification(message, type = 'success') {
        // Remove notificações existentes
        const existingContainer = document.querySelector('.notification-container');
        if (existingContainer) existingContainer.remove();

        // Cria o container
        const container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);

        // Cria a notificação
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        const title = type === 'success' ? 'Sucesso!' : 'Ops!';

        notification.innerHTML = `
            <i class="fas ${icon}"></i>
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
        `;

        container.appendChild(notification);

        // Animação de entrada
        setTimeout(() => notification.classList.add('active'), 100);

        // Auto-remove após 4 segundos
        setTimeout(() => {
            notification.classList.remove('active');
            setTimeout(() => container.remove(), 500);
        }, 4000);
    },

    showAlert(message, type = 'error') {
        this.showNotification(message, type);
    }
};

// Utilitários de Formulário
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Validação de Senha em Tempo Real
const passwordInput = document.getElementById('password');
if (passwordInput && document.getElementById('registerForm')) {
    passwordInput.addEventListener('input', function() {
        const password = this.value;
        
        // Requisitos
        const hasLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        updateRequirement('req-length', hasLength);
        updateRequirement('req-upper', hasUpper);
        updateRequirement('req-special', hasSpecial);
    });
}

function updateRequirement(id, isValid) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (isValid) {
        el.classList.add('valid');
        el.querySelector('i').className = 'fas fa-check-circle';
    } else {
        el.classList.remove('valid');
        el.querySelector('i').className = 'fas fa-circle';
    }
}

// Funções de Autenticação
const AuthService = {
    async login(email, password) {
        const btnText = "Entrar no Sistema";
        const errorEl = document.getElementById('loginError');
        if (errorEl) errorEl.style.display = 'none';
        
        UI.setLoading('loginBtn', true, btnText);

        try {
            const response = await fetch(`${CF_CONFIG.BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.token) {
                localStorage.setItem('qrchef_token', data.token);
                localStorage.setItem('qrchef_user', JSON.stringify(data.user));
                window.location.href = 'dashboard.html';
            } else {
                if (errorEl) {
                    errorEl.querySelector('.error-text').textContent = data.message || 'E-mail ou senha incorretos.';
                    errorEl.style.display = 'block';
                } else {
                    UI.showAlert(data.message || 'E-mail ou senha incorretos.');
                }
            }
        } catch (error) {
            console.error('Erro no login:', error);
            if (errorEl) {
                errorEl.querySelector('.error-text').textContent = 'Não foi possível conectar ao servidor.';
                errorEl.style.display = 'block';
            } else {
                UI.showAlert('Não foi possível conectar ao servidor.');
            }
        } finally {
            UI.setLoading('loginBtn', false, btnText);
        }
    },

    async register(name, email, password, confirmPassword) {
        // Validações antes do fetch
        if (password !== confirmPassword) {
            UI.showAlert('As senhas não coincidem!');
            return;
        }

        const hasLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (!hasLength || !hasUpper || !hasSpecial) {
            UI.showAlert('Sua senha não atende aos requisitos de segurança.');
            return;
        }

        const btnText = "Criar meu cardápio agora";
        UI.setLoading('registerBtn', true, btnText);

        try {
            const response = await fetch(`${CF_CONFIG.BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                UI.showAlert('Conta criada com sucesso! Redirecionando...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                UI.showAlert(data.message || 'Erro ao criar conta.');
            }
        } catch (error) {
            console.error('Erro no cadastro:', error);
            UI.showAlert('Erro de conexão com o servidor.');
        } finally {
            UI.setLoading('registerBtn', false, btnText);
        }
    },

    logout() {
        localStorage.removeItem('qrchef_token');
        localStorage.removeItem('qrchef_user');
        window.location.href = 'login.html';
    }
};

// Event Listeners
document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    AuthService.login(email, password);
});

document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('restaurantName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    AuthService.register(name, email, password, confirmPassword);
});

document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    AuthService.logout();
});
