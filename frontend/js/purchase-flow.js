/**
 * Fluxo de aquisição: pagamento via WhatsApp com admin → aprovação → cardápio liberado
 */
const WHATSAPP_ADMIN = '5514998364178'; // Altere para o número do admin (DDI + DDD + número)

let linkGerado = '';
let slugGerado = '';
let currentPurchase = null;
let pollInterval = null;

const API = typeof CF_CONFIG !== 'undefined' ? CF_CONFIG.BASE_URL : 'https://qrchef-worker.luismiguelgomesoliveira-014.workers.dev';

function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function buildWhatsAppMessage(purchase, user) {
    const planLine = purchase.planLabel ? `📦 *Plano:* ${purchase.planLabel}` : '';
    const lines = [
        '👋 *Bem-vindo ao QRchef!*',
        '',
        'Gostaria de *finalizar a aquisição* do meu cardápio digital e realizar o pagamento com vocês.',
        '',
        ...(planLine ? [planLine, ''] : []),
        `📋 *Sistema:* ${purchase.systemName}`,
        `🏪 *Restaurante:* ${purchase.restaurantName}`,
        `💳 *Forma de pagamento:* ${purchase.paymentMethod}`,
        `💰 *Valor:* ${formatBRL(purchase.amount)}`,
        '',
        `👤 *Cliente:* ${user.name}`,
        `📧 *E-mail:* ${user.email}`,
        '',
        'Podem me enviar os dados para pagamento? Obrigado!'
    ];
    return encodeURIComponent(lines.join('\n'));
}

function getWhatsAppPaymentUrl(purchase, user) {
    return `https://wa.me/${WHATSAPP_ADMIN}?text=${buildWhatsAppMessage(purchase, user)}`;
}

function abrirWhatsAppPagamento() {
    const userStr = localStorage.getItem('qrchef_user');
    if (!userStr || !currentPurchase?.restaurantName) return;
    const user = JSON.parse(userStr);
    window.open(getWhatsAppPaymentUrl(currentPurchase, user), '_blank', 'noopener');
}

function setupPaymentModalDOM() {
    const modal = document.getElementById('modalCriar');
    if (!modal || modal.dataset.purchaseFlowReady) return;

    const btnCriar = document.getElementById('btnCriar');
    if (!btnCriar) return;

    const inputNome = document.getElementById('inputNome');
    let fieldsWrap = document.getElementById('payStep1');
    if (!fieldsWrap && inputNome) {
        fieldsWrap = inputNome.closest('div[style*="flex-direction:column"]') || inputNome.parentElement?.parentElement;
    }
    if (fieldsWrap && !document.getElementById('payStep1')) {
        const step1 = document.createElement('div');
        step1.id = 'payStep1';
        step1.className = 'pay-step-panel';
        fieldsWrap.parentNode.insertBefore(step1, fieldsWrap);
        step1.appendChild(fieldsWrap);

        const btnContinue = document.createElement('button');
        btnContinue.type = 'button';
        btnContinue.style.cssText = btnCriar.style.cssText;
        btnContinue.style.marginTop = '24px';
        btnContinue.style.width = '100%';
        btnContinue.innerHTML = 'Continuar <i class="fas fa-arrow-right"></i>';
        btnContinue.onclick = () => avancarPagamento(2);
        step1.appendChild(btnContinue);
    }

    const legacyStep2 = document.getElementById('payStep2');
    if (legacyStep2 && !legacyStep2.querySelector('#payMethodPicker')) {
        legacyStep2.remove();
    }

    if (!document.getElementById('payStep2')) {
        const step2 = document.createElement('div');
        step2.id = 'payStep2';
        step2.className = 'pay-step-panel';
        step2.style.display = 'none';
        step2.innerHTML = `
            <label style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Forma de Pagamento</label>
            <div class="pay-method-picker" id="payMethodPicker">
                <button type="button" class="pay-method-trigger" id="payMethodTrigger" aria-haspopup="listbox" aria-expanded="false">
                    <span id="payMethodLabel">PIX</span>
                    <i class="fas fa-chevron-down pay-method-chevron"></i>
                </button>
                <ul class="pay-method-list" id="payMethodList" role="listbox" hidden>
                    <li role="option" data-value="PIX" class="active">PIX</li>
                    <li role="option" data-value="Cartão de Crédito">Cartão de Crédito</li>
                    <li role="option" data-value="Cartão de Débito">Cartão de Débito</li>
                    <li role="option" data-value="Boleto Bancário">Boleto Bancário</li>
                </ul>
                <input type="hidden" id="inputPagamento" value="PIX">
            </div>
            <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;font-size:14px;color:#aaa;margin-bottom:20px;">
                <p style="margin:0 0 8px;"><strong style="color:white;">Resumo</strong></p>
                <p id="resumoSistema" style="margin:4px 0;"></p>
                <p id="resumoRestaurante" style="margin:4px 0;"></p>
                <p id="resumoValor" style="margin:8px 0 0;color:var(--primary);font-weight:800;font-size:18px;"></p>
            </div>
            <p id="payWhatsAppHint" style="font-size:13px;color:#888;line-height:1.5;margin:16px 0;">Ao continuar, você será direcionado ao WhatsApp para <strong style="color:#fff;">falar com o administrador</strong> e concluir o pagamento.</p>
            <div style="display:flex;gap:10px;">
                <button type="button" id="btnVoltarPay" style="flex:1;padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:white;border-radius:14px;font-weight:700;cursor:pointer;">Voltar</button>
                <button type="button" id="btnFinalizar" style="flex:2;padding:16px;background:#25D366;color:white;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;"><i class="fab fa-whatsapp"></i> Pagar pelo WhatsApp</button>
            </div>`;
        btnCriar.parentNode.insertBefore(step2, btnCriar);
        document.getElementById('btnVoltarPay').onclick = () => avancarPagamento(1);
        document.getElementById('btnFinalizar').onclick = finalizarPagamento;
        initPaymentMethodPicker();
    }

    if (!document.getElementById('payStep3')) {
        const step3 = document.createElement('div');
        step3.id = 'payStep3';
        step3.className = 'pay-step-panel';
        step3.style.display = 'none';
        step3.innerHTML = `
            <div style="text-align:center;padding:8px 0 20px;">
                <p style="font-weight:800;font-size:16px;margin-bottom:8px;">Solicitação enviada!</p>
                <p style="color:#888;font-size:14px;line-height:1.5;">Conclua o pagamento conversando com o administrador no WhatsApp. Seu cardápio será liberado após a confirmação.</p>
            </div>
            <a id="btnWhatsApp" href="#" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px;background:#25D366;color:white;border-radius:14px;font-weight:800;text-decoration:none;font-size:15px;margin-bottom:16px;">
                <i class="fab fa-whatsapp" style="font-size:22px;"></i> Abrir WhatsApp e falar com o admin
            </a>
            <div id="aguardandoAdmin" style="padding:16px;background:rgba(255,193,7,0.08);border:1px solid rgba(255,193,7,0.25);border-radius:12px;text-align:center;">
                <p style="margin:0;font-size:13px;color:#ffc107;"><i class="fas fa-hourglass-half"></i> Aguardando confirmação do administrador...</p>
            </div>`;
        btnCriar.parentNode.insertBefore(step3, btnCriar);
    }

    btnCriar.style.display = 'none';
    atualizarTextosPagamentoWhatsApp();
    modal.dataset.purchaseFlowReady = '1';
}

function atualizarTextosPagamentoWhatsApp() {
    const btnFin = document.getElementById('btnFinalizar');
    if (btnFin && !btnFin.disabled) {
        btnFin.style.background = '#25D366';
        btnFin.innerHTML = '<i class="fab fa-whatsapp"></i> Pagar pelo WhatsApp';
    }

    const flexRow = document.querySelector('#payStep2 div[style*="display:flex"]');
    let hint = document.getElementById('payWhatsAppHint');
    if (!hint) {
        hint = document.createElement('p');
        hint.id = 'payWhatsAppHint';
        hint.style.cssText = 'font-size:13px;color:#888;line-height:1.5;margin:16px 0;';
        hint.innerHTML = 'Ao continuar, você será direcionado ao WhatsApp para <strong style="color:#fff;">falar com o administrador</strong> e concluir o pagamento.';
        if (flexRow) flexRow.parentElement.insertBefore(hint, flexRow);
    } else if (flexRow?.contains(hint)) {
        flexRow.parentElement.insertBefore(hint, flexRow);
    }

    const btnWa = document.getElementById('btnWhatsApp');
    if (btnWa) {
        btnWa.innerHTML = '<i class="fab fa-whatsapp" style="font-size:22px;"></i> Abrir WhatsApp e falar com o admin';
    }
    const step3Texts = document.querySelectorAll('#payStep3 p');
    if (step3Texts[0]) step3Texts[0].textContent = 'Solicitação enviada!';
    if (step3Texts[1]) {
        step3Texts[1].textContent = 'Conclua o pagamento conversando com o administrador no WhatsApp. Seu cardápio será liberado após a confirmação.';
    }
}

function initPaymentMethodPicker() {
    const picker = document.getElementById('payMethodPicker');
    if (!picker || picker.dataset.ready) return;
    picker.dataset.ready = '1';

    const trigger = document.getElementById('payMethodTrigger');
    const list = document.getElementById('payMethodList');
    const label = document.getElementById('payMethodLabel');
    const hidden = document.getElementById('inputPagamento');

    const close = () => {
        list.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        picker.classList.remove('open');
    };

    const open = () => {
        list.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        picker.classList.add('open');
    };

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (list.hidden) open();
        else close();
    });

    list.querySelectorAll('li').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = item.dataset.value;
            hidden.value = value;
            label.textContent = value;
            list.querySelectorAll('li').forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            close();
        });
    });

    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target)) close();
    });
}

function getPaymentMethod() {
    const hidden = document.getElementById('inputPagamento');
    if (hidden) return hidden.value;
    const legacy = document.querySelector('#payStep2 select');
    return legacy?.value || 'PIX';
}

function setPayStep(step) {
    [1, 2, 3].forEach(n => {
        const panel = document.getElementById(`payStep${n}`);
        if (panel) panel.style.display = n === step ? 'block' : 'none';
    });
    document.querySelectorAll('.pay-step-dot').forEach(dot => {
        dot.classList.toggle('active', Number(dot.dataset.step) <= step);
    });
    const badge = document.getElementById('paySystemBadge');
    if (badge) badge.style.display = step >= 1 ? 'block' : 'none';

    const resultado = document.getElementById('resultadoCriar');
    if (resultado && step < 4) resultado.style.display = 'none';
}

function avancarPagamento(step) {
    if (step === 2) {
        const nome = document.getElementById('inputNome')?.value.trim();
        if (!nome) {
            const msg = document.getElementById('msgCriar');
            if (msg) {
                msg.style.display = 'block';
                msg.style.color = '#ff4757';
                msg.textContent = 'Digite o nome do restaurante.';
            }
            return;
        }
        document.getElementById('msgCriar').style.display = 'none';
        document.getElementById('resumoSistema').textContent = `Sistema: ${currentPurchase?.systemName || ''}`;
        document.getElementById('resumoRestaurante').textContent = `Restaurante: ${nome}`;
        document.getElementById('resumoValor').textContent = formatBRL(currentPurchase?.amount || 0);
    }
    setPayStep(step);
}

function abrirModalPagamento({ template, systemName, amount, planLabel }) {
    setupPaymentModalDOM();
    currentPurchase = { template, systemName, amount, planLabel: planLabel || '', requestId: null };

    const modal = document.getElementById('modalCriar');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const badge = document.getElementById('paySystemBadge');
    if (badge) badge.style.display = 'block';
    document.getElementById('paySystemName').textContent = systemName;
    document.getElementById('paySystemPrice').textContent = formatBRL(amount);
    document.getElementById('inputNome').value = '';
    document.getElementById('inputCor').value = '#e63946';
    const payHidden = document.getElementById('inputPagamento');
    const payLabel = document.getElementById('payMethodLabel');
    if (payHidden) payHidden.value = 'PIX';
    if (payLabel) payLabel.textContent = 'PIX';
    document.querySelectorAll('#payMethodList li').forEach(li => {
        li.classList.toggle('active', li.dataset.value === 'PIX');
    });
    document.getElementById('resultadoCriar').style.display = 'none';
    document.getElementById('msgCriar').style.display = 'none';

    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }

    setPayStep(1);
}

function fecharModalCriar() {
    document.getElementById('modalCriar').style.display = 'none';
    document.body.style.overflow = '';
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function finalizarPagamento() {
    const nome = document.getElementById('inputNome').value.trim();
    const cor = document.getElementById('inputCor').value;
    const paymentMethod = getPaymentMethod();
    const msg = document.getElementById('msgCriar');
    const token = localStorage.getItem('qrchef_token');
    const userStr = localStorage.getItem('qrchef_user');

    if (!nome || !currentPurchase) return;

    const btn = document.getElementById('btnFinalizar');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    }

    try {
        const res = await fetch(`${API}/purchase/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                template_id: currentPurchase.template,
                system_name: currentPurchase.systemName,
                restaurant_name: nome,
                cor_primaria: cor,
                amount: currentPurchase.amount,
                payment_method: paymentMethod
            })
        });
        const data = await res.json();

        if (!data.success) {
            msg.style.display = 'block';
            msg.style.color = '#ff4757';
            msg.textContent = data.message || 'Erro ao registrar pedido.';
            return;
        }

        currentPurchase.requestId = data.requestId;
        currentPurchase.restaurantName = nome;
        currentPurchase.paymentMethod = paymentMethod;

        const user = JSON.parse(userStr);
        const waUrl = getWhatsAppPaymentUrl(currentPurchase, user);
        const btnWa = document.getElementById('btnWhatsApp');
        if (btnWa) btnWa.href = waUrl;

        setPayStep(3);
        abrirWhatsAppPagamento();
        iniciarPollingAprovacao();
        if (typeof AdminNotifications !== 'undefined') AdminNotifications.updateBadge();
    } catch (e) {
        msg.style.display = 'block';
        msg.style.color = '#ff4757';
        msg.textContent = 'Erro de conexão com o servidor.';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fab fa-whatsapp"></i> Pagar pelo WhatsApp';
        }
    }
}

function mostrarCardapioAprovado(link, slug) {
    linkGerado = liimage.pngnk;
    slugGerado = slug;
    document.getElementById('linkCardapio').href = link;
    document.getElementById('linkCardapio').textContent = link;
    document.getElementById('payStep3').style.display = 'none';
    document.getElementById('aguardandoAdmin').style.display = 'none';
    document.getElementById('resultadoCriar').style.display = 'block';
    document.querySelectorAll('.pay-step-dot').forEach(d => d.classList.add('active'));
}

function iniciarPollingAprovacao() {
    if (!currentPurchase?.requestId) return;
    const token = localStorage.getItem('qrchef_token');

    const check = async () => {
        try {
            const res = await fetch(`${API}/purchase/request/${currentPurchase.requestId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.request?.status === 'approved') {
                clearInterval(pollInterval);
                pollInterval = null;
                mostrarCardapioAprovado(data.request.menu_link, data.request.restaurant_slug);
            }
        } catch (_) { /* ignore */ }
    };

    check();
    pollInterval = setInterval(check, 5000);
}

function copiarLink() {
    navigator.clipboard.writeText(linkGerado);
    alert('Link copiado!');
}

function irParaCardapio() {
    window.location.href = `admin-edit-menu.html?slug=${slugGerado}`;
}

function parsePriceFromCard(card) {
    const priceEl = card?.querySelector('.system-price');
    if (!priceEl) return 0;
    const match = priceEl.textContent.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(match) || 0;
}

async function abrirModalCriarRestaurante(template, btn) {
    if (typeof SystemPlans !== 'undefined') {
        const check = await SystemPlans.canAcquire(template);
        if (!check.ok) {
            if (typeof QRchefModal !== 'undefined') {
                await QRchefModal.alert({ title: 'Plano Básico necessário', message: check.message, variant: 'info' });
            } else {
                alert(check.message);
            }
            return;
        }
    }
    const card = btn?.closest('.system-card');
    const systemName = card?.querySelector('.system-title')?.textContent?.trim() || template;
    const amount = parsePriceFromCard(card);
    const planLabel = typeof SystemPlans !== 'undefined' ? SystemPlans.getPlanLabel(template) : '';
    abrirModalPagamento({ template, systemName, amount, planLabel });
}

document.addEventListener('DOMContentLoaded', () => {
    setupPaymentModalDOM();

    const style = document.createElement('style');
    style.textContent = `
        .pay-step-dot { flex:1; height:4px; border-radius:2px; background:rgba(255,255,255,0.15); transition:0.3s; }
        .pay-step-dot.active { background:var(--primary); }
        .pay-method-picker { position:relative; margin-top:8px; margin-bottom:16px; }
        .pay-method-trigger {
            width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px;
            padding:14px 16px; background:#1a1a1a; border:1px solid rgba(255,255,255,0.12);
            border-radius:12px; color:#fff; font-size:15px; font-weight:600; cursor:pointer;
            transition:border-color 0.2s, background 0.2s; text-align:left;
        }
        .pay-method-trigger:hover, .pay-method-picker.open .pay-method-trigger {
            border-color:var(--primary); background:rgba(255,255,255,0.08);
        }
        .pay-method-chevron { font-size:12px; opacity:0.7; transition:transform 0.2s; }
        .pay-method-picker.open .pay-method-chevron { transform:rotate(180deg); }
        .pay-method-list {
            position:absolute; top:calc(100% + 6px); left:0; right:0; margin:0; padding:6px;
            list-style:none; background:#1a1a1a; border:1px solid rgba(255,255,255,0.12);
            border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,0.5); z-index:3100;
            max-height:220px; overflow-y:auto;
        }
        .pay-method-list[hidden] { display:none !important; }
        .pay-method-list li {
            padding:12px 14px; border-radius:8px; color:#fff; font-size:14px; font-weight:600;
            cursor:pointer; transition:background 0.15s;
        }
        .pay-method-list li:hover { background:rgba(255,255,255,0.08); }
        .pay-method-list li.active { background:var(--primary); color:#fff; }
        #modalCriar select { display:none !important; }
    `;
    document.head.appendChild(style);

    initPaymentMethodPicker();

});
