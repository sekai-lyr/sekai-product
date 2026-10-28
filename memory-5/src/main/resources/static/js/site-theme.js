(() => {
    'use strict';
    const themes = { a: 'A · 清透玻璃', b: 'B · 深色音乐舱', c: 'C · 樱花动漫', d: 'D · 黑金唱片' };
    const key = 'sekai.site.theme';
    const root = document.documentElement;
    function apply(value) {
        root.dataset.siteTheme = Object.hasOwn(themes, value) ? value : 'a';
        document.querySelectorAll('[data-site-theme-select]').forEach(select => {
            select.value = root.dataset.siteTheme;
        });
    }
    let saved;
    try { saved = localStorage.getItem(key); } catch (_) { /* Storage may be disabled. */ }
    apply(saved);
    document.addEventListener('DOMContentLoaded', () => {
        const host = document.querySelector('.sidebar-panel') || document.querySelector('.login-card, .register-card');
        if (!host) return;
        const picker = document.createElement('label');
        picker.className = 'site-theme-picker';
        const title = document.createElement('span');
        title.textContent = '网站外观';
        const select = document.createElement('select');
        select.dataset.siteThemeSelect = '';
        select.setAttribute('aria-label', '网站外观');
        for (const [id, name] of Object.entries(themes)) select.add(new Option(name, id));
        select.value = root.dataset.siteTheme;
        select.addEventListener('change', () => {
            apply(select.value);
            try { localStorage.setItem(key, select.value); } catch (_) { /* Keep the current-page choice. */ }
        });
        picker.append(title, select);
        const userBox = host.querySelector('.user-box');
        if (userBox) host.insertBefore(picker, userBox);
        else host.append(picker);
    });
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) apply(event.newValue);
    });
})();
