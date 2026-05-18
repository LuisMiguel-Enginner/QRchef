/**
 * Notificações do admin — solicitações de sistemas aguardando confirmação de pagamento
 */
const AdminNotifications = {
    get API() {
        return typeof CF_CONFIG !== 'undefined'
            ? CF_CONFIG.BASE_URL
            : 'https://qrchef-worker.luismiguelgomesoliveira-014.workers.dev';
    },

    formatBRL(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    },

    formatDate(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return iso;
        }
    },

    async fetchPending() {
        const token = localStorage.getItem('qrchef_token');
        if (!token) return [];
        const res = await fetch(`${this.API}/admin/purchase-requests?status=awaiting_admin`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        return data.success ? (data.requests || []) : [];
    },

    async updateBadge() {
        if (!document.body.classList.contains('is-admin')) return;
        try {
            const requests = await this.fetchPending();
            const count = requests.length;
            document.querySelectorAll('#notifBadge').forEach(badge => {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            });
            const pageCount = document.getElementById('notifPageCount');
            if (pageCount) pageCount.textContent = count;
        } catch (e) {
            console.error('Erro ao atualizar badge de notificações:', e);
        }
    },

    renderNotificationCard(req) {
        const card = document.createElement('article');
        card.className = 'notif-card';
        card.dataset.id = req.id;
        card.innerHTML = `
            <div class="notif-card-header">
                <span class="notif-type"><i class="fas fa-bell"></i> Nova solicitação</span>
                <span class="notif-date">${this.formatDate(req.created_at)}</span>
            </div>
            <div class="notif-card-body">
                <div class="notif-row">
                    <span class="notif-label">Cliente</span>
                    <strong>${req.user_name}</strong>image.png
                    <span class="notif-meta">${req.user_email}</span>
                </div>
                <div class="notif-row">
                    <span class="notif-label">Plano</span>
                    <strong>${['elite','quick','basic','pro'].includes(req.template_id) ? 'Plano Básico' : 'Plano Premium'}</strong>
                </div>
                <div class="notif-row">
                    <span class="notif-label">Sistema</span>
                    <strong>${req.system_name}</strong>
                </div>
                <div class="notif-row">
                    <span class="notif-label">Restaurante</span>
                    <strong>${req.restaurant_name}</strong>
                </div>
                <div class="notif-row notif-payment">
                    <span><i class="fas fa-credit-card"></i> ${req.payment_method}</span>
                    <span class="notif-amount">${this.formatBRL(req.amount)}</span>
                </div>
            </div>
            <div class="notif-card-footer">
                <p class="notif-hint"><i class="fab fa-whatsapp"></i> Confirme o pagamento no WhatsApp antes de liberar o cardápio.</p>
                <label class="notif-confirm-pay">
                    <input type="checkbox" class="notif-pay-checkbox">
                    <span>Pagamento confirmado via WhatsApp</span>
                </label>
                <div class="notif-actions">
                    <button type="button" class="btn-notif-reject" data-id="${req.id}">Recusar</button>
                    <button type="button" class="btn-notif-approve" data-id="${req.id}" disabled>
                        <i class="fas fa-check"></i> Aprovar e liberar cardápio
                    </button>
                </div>
            </div>`;
        return card;
    },

    bindCardEvents(card) {
        const checkbox = card.querySelector('.notif-pay-checkbox');
        const btnApprove = card.querySelector('.btn-notif-approve');
        const btnReject = card.querySelector('.btn-notif-reject');

        checkbox.addEventListener('change', () => {
            btnApprove.disabled = !checkbox.checked;
        });

        btnApprove.addEventListener('click', () => this.approve(btnApprove.dataset.id, btnApprove, card));
        btnReject.addEventListener('click', () => this.reject(btnReject.dataset.id, card));
    },

    async renderList(containerId = 'notificationsList', emptyId = 'notificationsEmpty') {
        const list = document.getElementById(containerId);
        const empty = document.getElementById(emptyId);
        if (!list) return;

        list.innerHTML = '<p class="notif-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>';

        try {
            const requests = await this.fetchPending();
            list.innerHTML = '';

            if (requests.length === 0) {
                if (empty) empty.style.display = 'block';
                return;
            }
            if (empty) empty.style.display = 'none';

            requests.forEach(req => {
                const card = this.renderNotificationCard(req);
                this.bindCardEvents(card);
                list.appendChild(card);
            });
        } catch (e) {
            list.innerHTML = '<p class="notif-error">Erro ao carregar notificações.</p>';
            console.error(e);
        }

        await this.updateBadge();
    },

    async approve(id, btn, card) {
        const ok = await QRchefModal.confirm({
            title: 'Liberar cardápio',
            message: 'O pagamento foi confirmado no WhatsApp? O cardápio será ativado para o cliente.',
            confirmText: 'Sim, liberar',
            cancelText: 'Cancelar',
            variant: 'primary'
        });
        if (!ok) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aprovando...';
        const token = localStorage.getItem('qrchef_token');

        try {
            const res = await fetch(`${this.API}/admin/purchase-requests/${id}/approve`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                card.classList.add('notif-card-done');
                card.innerHTML = `
                    <div class="notif-success">
                        <i class="fas fa-check-circle"></i>
                        <p><strong>Cardápio liberado!</strong></p>
                        <a href="${data.link}" target="_blank" rel="noopener">${data.link}</a>
                    </div>`;
                await this.updateBadge();
                const remaining = document.querySelectorAll('.notif-card:not(.notif-card-done)').length;
                const empty = document.getElementById('notificationsEmpty');
                if (remaining === 0 && empty) empty.style.display = 'block';
            } else {
                await QRchefModal.alert({ title: 'Erro', message: data.message || 'Erro ao aprovar.', variant: 'danger' });
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-check"></i> Aprovar e liberar cardápio';
            }
        } catch (_) {
            await QRchefModal.alert({ title: 'Erro', message: 'Erro de conexão com o servidor.', variant: 'danger' });
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Aprovar e liberar cardápio';
        }
    },

    async reject(id, card) {
        const ok = await QRchefModal.confirm({
            title: 'Recusar solicitação',
            message: 'Tem certeza que deseja recusar esta solicitação? Esta ação não pode ser desfeita.',
            confirmText: 'Sim, recusar',
            cancelText: 'Cancelar',
            variant: 'danger'
        });
        if (!ok) return;
        const token = localStorage.getItem('qrchef_token');
        try {
            await fetch(`${this.API}/admin/purchase-requests/${id}/reject`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            card.remove();
            await this.updateBadge();
            const list = document.getElementById('notificationsList');
            if (list && !list.querySelector('.notif-card')) {
                const empty = document.getElementById('notificationsEmpty');
                if (empty) empty.style.display = 'block';
            }
        } catch (_) {
            await QRchefModal.alert({ title: 'Erro', message: 'Erro ao recusar solicitação.', variant: 'danger' });
        }
    },

    init() {
        if (!document.body.classList.contains('is-admin')) return;
        this.updateBadge();
        if (document.getElementById('notificationsList')) {
            this.renderList();
        }
        setInterval(() => this.updateBadge(), 20000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('qrchef_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        if (user.email === 'adminsistema@sistema.com' || user.email === 'adminsistema2@sistema.com') {
            document.body.classList.add('is-admin');
            AdminNotifications.init();
        }
    }
});
