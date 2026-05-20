/**
 * Menu mobile — QRchef
 * Injeta botão hambúrguer e controla painel em telas pequenas.
 */
(function () {
    function createToggle() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nav-toggle';
        btn.setAttribute('aria-label', 'Abrir menu de navegação');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span></span><span></span><span></span>';
        return btn;
    }

    function closeNav() {
        document.body.classList.remove('nav-open');
        document.querySelectorAll('.nav-toggle').forEach((t) => {
            t.setAttribute('aria-expanded', 'false');
            t.setAttribute('aria-label', 'Abrir menu de navegação');
        });
    }

    function toggleNav(btn) {
        const open = document.body.classList.toggle('nav-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu de navegação');
    }

    function bindMenuLinks(menu) {
        if (!menu) return;
        menu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992) closeNav();
            });
        });
    }

    function setupToggle(parent, menu, insertBefore) {
        if (!parent || !menu || parent.querySelector('.nav-toggle')) return;

        const toggle = createToggle();
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNav(toggle);
        });

        if (insertBefore && parent.contains(insertBefore)) {
            parent.insertBefore(toggle, insertBefore);
        } else {
            parent.appendChild(toggle);
        }

        bindMenuLinks(menu);
    }

    function init() {
        let overlay = document.querySelector('.nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.addEventListener('click', closeNav);
            document.body.appendChild(overlay);
        }

        const mainNav = document.querySelector('.main-nav-content');
        if (mainNav) {
            const links = mainNav.querySelector('.nav-links');
            setupToggle(mainNav, links, links);
        }

        const demoNav = document.querySelector('nav .nav-content');
        if (demoNav) {
            const links = demoNav.querySelector('.nav-links');
            setupToggle(demoNav, links, links);
        }

        document.querySelectorAll('.dashboard-header-top .header-inner').forEach((inner) => {
            const navCenter = inner.querySelector('.header-nav-center');
            const profile = inner.querySelector('.header-profile');
            if (navCenter) setupToggle(inner, navCenter, profile || navCenter);
        });

        document.querySelectorAll('.dash-header-container').forEach((container) => {
            const nav = container.querySelector('.dash-nav-v2');
            const user = container.querySelector('.dash-user-section');
            if (nav) setupToggle(container, nav, user || nav);
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 992) closeNav();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeNav();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
