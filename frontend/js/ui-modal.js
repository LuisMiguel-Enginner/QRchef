/**
 * Modais customizados no tema QRchef (substitui confirm/alert nativos)
 */
const QRchefModal = {
    _ready: false,

    _ensureDOM() {
        if (this._ready) return;

        const style = document.createElement('style');
        style.id = 'qrchef-modal-styles';
        style.textContent = `
            .qrchef-modal-overlay {
                position: fixed; inset: 0;
                background: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(8px);
                z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                padding: 20px;
                opacity: 0; visibility: hidden;
                transition: opacity 0.25s ease, visibility 0.25s ease;
            }
            .qrchef-modal-overlay.active {
                opacity: 1; visibility: visible;
            }
            .qrchef-modal-box {
                background: #111;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                max-width: 420px; width: 100%;
                padding: 32px 28px 24px;
                box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
                transform: scale(0.92) translateY(12px);
                transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
            }
            .qrchef-modal-overlay.active .qrchef-modal-box {
                transform: scale(1) translateY(0);
            }
            .qrchef-modal-icon {
                width: 52px; height: 52px; border-radius: 14px;
                display: flex; align-items: center; justify-content: center;
                font-size: 22px; margin-bottom: 18px;
            }
            .qrchef-modal-icon.primary {
                background: rgba(255, 92, 0, 0.15);
                color: var(--primary, #FF5C00);
            }
            .qrchef-modal-icon.danger {
                background: rgba(255, 71, 87, 0.15);
                color: #ff4757;
            }
            .qrchef-modal-icon.info {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
            }
            .qrchef-modal-title {
                font-family: 'Syne', sans-serif;
                font-size: 20px; font-weight: 800;
                text-transform: uppercase;
                letter-spacing: -0.02em;
                margin: 0 0 10px; color: #fff;
            }
            .qrchef-modal-message {
                font-size: 14px; line-height: 1.6;
                color: #a0a0a0; margin: 0 0 28px;
            }
            .qrchef-modal-actions {
                display: flex; gap: 10px;
            }
            .qrchef-modal-btn {
                flex: 1; padding: 14px 18px;
                border-radius: 12px; font-size: 14px; font-weight: 800;
                cursor: pointer; transition: 0.2s;
                border: none; font-family: inherit;
            }
            .qrchef-modal-btn-cancel {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #fff;
            }
            .qrchef-modal-btn-cancel:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            .qrchef-modal-btn-confirm.primary {
                background: var(--primary, #FF5C00);
                color: #fff;
            }
            .qrchef-modal-btn-confirm.primary:hover {
                filter: brightness(1.08);
            }
            .qrchef-modal-btn-confirm.danger {
                background: transparent;
                border: 1px solid #ff4757;
                color: #ff4757;
            }
            .qrchef-modal-btn-confirm.danger:hover {
                background: rgba(255, 71, 87, 0.12);
            }
            .qrchef-modal-btn-full { flex: 1; }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'qrchefModalOverlay';
        overlay.className = 'qrchef-modal-overlay';
        overlay.innerHTML = `
            <div class="qrchef-modal-box" role="dialog" aria-modal="true" aria-labelledby="qrchefModalTitle">
                <div class="qrchef-modal-icon primary" id="qrchefModalIcon">
                    <i class="fas fa-question"></i>
                </div>
                <h3 class="qrchef-modal-title" id="qrchefModalTitle">Confirmar</h3>
                <p class="qrchef-modal-message" id="qrchefModalMessage"></p>
                <div class="qrchef-modal-actions" id="qrchefModalActions"></div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && this._onCancel) this._close(false);
        });

        this._overlay = overlay;
        this._ready = true;
    },

    _close(result) {
        this._overlay.classList.remove('active');
        document.body.style.overflow = '';
        const resolve = result ? this._onConfirm : this._onCancel;
        this._onConfirm = null;
        this._onCancel = null;
        if (resolve) resolve(result);
    },

    confirm({
        title = 'Confirmar ação',
        message = 'Deseja continuar?',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        variant = 'primary'
    }) {
        this._ensureDOM();

        return new Promise((resolve) => {
            const icon = document.getElementById('qrchefModalIcon');
            const titleEl = document.getElementById('qrchefModalTitle');
            const messageEl = document.getElementById('qrchefModalMessage');
            const actions = document.getElementById('qrchefModalActions');

            icon.className = `qrchef-modal-icon ${variant}`;
            icon.innerHTML = variant === 'danger'
                ? '<i class="fas fa-times-circle"></i>'
                : '<i class="fas fa-check-circle"></i>';

            titleEl.textContent = title;
            messageEl.textContent = message;

            actions.innerHTML = `
                <button type="button" class="qrchef-modal-btn qrchef-modal-btn-cancel">${cancelText}</button>
                <button type="button" class="qrchef-modal-btn qrchef-modal-btn-confirm ${variant}">${confirmText}</button>
            `;

            const btnCancel = actions.querySelector('.qrchef-modal-btn-cancel');
            const btnConfirm = actions.querySelector('.qrchef-modal-btn-confirm');

            this._onCancel = () => resolve(false);
            this._onConfirm = () => resolve(true);

            btnCancel.onclick = () => this._close(false);
            btnConfirm.onclick = () => this._close(true);

            const onKey = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', onKey);
                    this._close(false);
                }
            };
            document.addEventListener('keydown', onKey);

            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => this._overlay.classList.add('active'));
            setTimeout(() => btnConfirm.focus(), 100);
        });
    },

    alert({
        title = 'Aviso',
        message = '',
        buttonText = 'Entendi',
        variant = 'info'
    }) {
        this._ensureDOM();

        return new Promise((resolve) => {
            const icon = document.getElementById('qrchefModalIcon');
            const titleEl = document.getElementById('qrchefModalTitle');
            const messageEl = document.getElementById('qrchefModalMessage');
            const actions = document.getElementById('qrchefModalActions');

            icon.className = `qrchef-modal-icon ${variant}`;
            icon.innerHTML = variant === 'danger'
                ? '<i class="fas fa-exclamation-circle"></i>'
                : '<i class="fas fa-info-circle"></i>';

            titleEl.textContent = title;
            messageEl.textContent = message;

            actions.innerHTML = `
                <button type="button" class="qrchef-modal-btn qrchef-modal-btn-confirm primary qrchef-modal-btn-full">${buttonText}</button>
            `;

            const btn = actions.querySelector('button');
            this._onConfirm = () => resolve(true);
            this._onCancel = () => resolve(true);
            btn.onclick = () => this._close(true);

            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => this._overlay.classList.add('active'));
        });
    }
};
