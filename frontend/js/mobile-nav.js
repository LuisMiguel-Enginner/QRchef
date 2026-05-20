/**
 * Menu mobile QRchef — hambúrguer + painel fixo (sem conflitar com drawer do dashboard)
 */
(function () {
    const BP = 992;

    function isMobile() {
        return window.innerWidth <= BP;
    }

    function createToggle() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nav-toggle';
        btn.setAttribute('aria-label', 'Abrir menu');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span></span><span></span><span></span>';
        return btn;
    }

    function getOverlay() {
        let el = document.querySelector('.nav-overlay');
        if (!el) {
            el = document.createElement('div');
            el.className = 'nav-overlay';
            el.setAttribute('aria-hidden', 'true');
            document.body.appendChild(el);
        }
        return el;
    }

    function getDropdown() {
        let el = document.getElementById('qrchef-mobile-nav-dropdown');
        if (!el) {
            el = document.createElement('div');
            el.id = 'qrchef-mobile-nav-dropdown';
            el.className = 'mobile-nav-dropdown';
            document.body.appendChild(el);
        }
        return el;
    }

    function closeAll() {
        document.body.classList.remove('nav-open');
        document.querySelectorAll('.nav-toggle').forEach((t) => {
            t.setAttribute('aria-expanded', 'false');
            t.setAttribute('aria-label', 'Abrir menu');
        });
        getDropdown().classList.remove('open');
    }

    function openDropdown(toggle, sourceEl) {
        const dropdown = getDropdown();
        dropdown.innerHTML = '';

        const menus = sourceEl.querySelectorAll('.nav-menu');
        let activeMenu = null;

        if (menus.length) {
            menus.forEach((m) => {
                const style = window.getComputedStyle(m);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    activeMenu = m;
                }
            });
            if (!activeMenu) activeMenu = menus[0];
        } else {
            activeMenu = sourceEl;
        }

        if (activeMenu) {
            activeMenu.querySelectorAll('a').forEach((link) => {
                const clone = link.cloneNode(true);
                clone.addEventListener('click', () => {
                    if (isMobile()) closeAll();
                });
                dropdown.appendChild(clone);
            });
        }

        dropdown.classList.add('open');
        document.body.classList.add('nav-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Fechar menu');
    }

    function setupSimpleNav(parent, menuEl) {
        if (!parent || !menuEl || parent.querySelector('.nav-toggle')) return;

        const toggle = createToggle();
        parent.insertBefore(toggle, menuEl);

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isMobile()) return;

            const open = document.body.classList.toggle('nav-open');
            if (open) {
                toggle.setAttribute('aria-expanded', 'true');
                toggle.setAttribute('aria-label', 'Fechar menu');
            } else {
                closeAll();
            }
        });

        menuEl.querySelectorAll('a').forEach((a) => {
            a.addEventListener('click', () => {
                if (isMobile()) closeAll();
            });
        });
    }

    function setupDashboardNav(inner) {
        if (!inner || inner.querySelector('.nav-toggle')) return;

        const navCenter = inner.querySelector('.header-nav-center');
        const dashNav = inner.querySelector('.dash-nav-v2');
        const source = navCenter || dashNav;
        if (!source) return;

        const profile = inner.querySelector('.header-profile, .dash-user-section');
        const toggle = createToggle();
        if (profile) inner.insertBefore(toggle, profile);
        else inner.appendChild(toggle);

        const overlay = getOverlay();

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isMobile()) return;

            const dropdown = getDropdown();
            const isOpen = dropdown.classList.contains('open');

            if (isOpen) {
                closeAll();
                return;
            }

            openDropdown(toggle, source);
        });

        overlay.addEventListener('click', closeAll);
    }

    function init() {
        const overlay = getOverlay();
        overlay.addEventListener('click', closeAll);

        const mainNav = document.querySelector('.main-nav-content');
        if (mainNav) {
            const links = mainNav.querySelector('.nav-links');
            setupSimpleNav(mainNav, links);
        }

        const demoNav = document.querySelector('nav .nav-content');
        if (demoNav) {
            setupSimpleNav(demoNav, demoNav.querySelector('.nav-links'));
        }

        document.querySelectorAll('.dashboard-header-top .header-inner').forEach(setupDashboardNav);
        document.querySelectorAll('.dash-header-container').forEach(setupDashboardNav);

        window.addEventListener('resize', () => {
            if (!isMobile()) closeAll();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAll();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
