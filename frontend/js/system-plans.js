/**
 * Planos e templates do catálogo QRchef
 */
const SystemPlans = {
    BASIC_TEMPLATES: ['elite', 'quick', 'basic', 'pro'],
    PREMIUM_TEMPLATES: ['coffee', 'premium'],

    isBasicTemplate(templateId) {
        return this.BASIC_TEMPLATES.includes(templateId);
    },

    isPremiumTemplate(templateId) {
        return this.PREMIUM_TEMPLATES.includes(templateId);
    },

    getPlanLabel(templateId) {
        return this.isBasicTemplate(templateId) ? 'Plano Básico' : 'Plano Premium';
    },

    async fetchPlanStatus() {
        const token = localStorage.getItem('qrchef_token');
        if (!token) return { hasBasic: false, hasPremium: false, plan: null };
        const api = typeof CF_CONFIG !== 'undefined'
            ? CF_CONFIG.BASE_URL
            : 'https://qrchef-worker.luismiguelgomesoliveira-014.workers.dev';
        try {
            const res = await fetch(`${api}/client/plan-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            return data.success ? data : { hasBasic: false, hasPremium: false, plan: null };
        } catch {
            return { hasBasic: false, hasPremium: false, plan: null };
        }
    },

    async canAcquire(templateId) {
        if (this.isBasicTemplate(templateId)) {
            return { ok: true, reason: 'basic' };
        }
        const status = await this.fetchPlanStatus();
        if (status.hasPremium) {
            return { ok: true, reason: 'premium' };
        }
        if (!status.hasBasic) {
            return {
                ok: false,
                message: 'Para adquirir sistemas Premium, primeiro assine o Plano Básico (Elite, Quick Bite, Green Garden ou Pizza Express). Depois use "Trocar de plano" nos sistemas Premium.'
            };
        }
        return { ok: true, reason: 'upgrade' };
    },

    async handleDeployClick(template, btn) {
        const status = await this.fetchPlanStatus();

        if (this.isPremiumTemplate(template) && !status.hasPremium) {
            if (!status.hasBasic) {
                await QRchefModal.alert({
                    title: 'Plano Básico primeiro',
                    message: 'Assine um sistema do Plano Básico antes de fazer upgrade para o Plano Premium.',
                    variant: 'info'
                });
                return;
            }
            abrirModalCriarRestaurante(template, btn);
            return;
        }

        const check = await this.canAcquire(template);
        if (!check.ok) {
            await QRchefModal.alert({
                title: 'Plano necessário',
                message: check.message,
                variant: 'info'
            });
            return;
        }
        abrirModalCriarRestaurante(template, btn);
    },

    applyShowcaseForClient(hasBasic, hasPremium) {
        document.querySelectorAll('.system-card').forEach(card => {
            const deployBtn = card.querySelector('.btn-deploy');
            if (!deployBtn) return;

            const template = deployBtn.dataset.template
                || deployBtn.getAttribute('href')?.split('template=')[1];
            if (!template) return;

            const isBasic = this.isBasicTemplate(template);
            const isPremium = this.isPremiumTemplate(template);

            card.classList.remove('system-card--locked', 'system-card--premium-active');
            card.classList.toggle('system-card--basic-tier', isBasic);
            card.classList.toggle('system-card--premium-tier', isPremium);

            deployBtn.href = '#';
            deployBtn.onclick = (e) => {
                e.preventDefault();
                this.handleDeployClick(template, deployBtn);
            };

            if (isBasic) {
                deployBtn.className = 'btn-action btn-deploy';
                deployBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Adquirir';
                if (hasBasic) {
                    card.classList.add('system-card--unlocked');
                }
                return;
            }

            if (isPremium) {
                const hint = card.querySelector('.system-lock-hint');
                if (hasPremium) {
                    card.classList.add('system-card--premium-active', 'system-card--unlocked');
                    deployBtn.className = 'btn-action btn-deploy';
                    deployBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Adquirir';
                    if (hint) hint.style.display = 'none';
                } else {
                    deployBtn.className = 'btn-action btn-deploy btn-upgrade-plan';
                    deployBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Trocar de plano';
                    if (hint) {
                        hint.style.display = 'block';
                        hint.textContent = 'Demo liberado. Assine o Plano Premium para adquirir este sistema.';
                    }
                }
            }
        });
    },

    async initClientShowcase() {
        document.querySelectorAll('.btn-deploy').forEach(btn => {
            if (!btn.dataset.template) {
                const fromHref = btn.getAttribute('href')?.split('template=')[1];
                if (fromHref) btn.dataset.template = fromHref;
            }
        });

        const status = await this.fetchPlanStatus();
        this.applyShowcaseForClient(status.hasBasic, status.hasPremium);
    }
};
