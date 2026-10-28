export const SITE_THEME_STORAGE_KEY = "sekai.site.theme";

export const SITE_THEMES = Object.freeze({
    a: "A · 清透星海",
    b: "B · 深色作战舱",
    c: "C · 樱花动漫",
    d: "D · 黑金典藏",
});

export function normalizeSiteTheme(value) {
    return Object.hasOwn(SITE_THEMES, value) ? value : "b";
}

export function getSiteTheme() {
    try {
        return normalizeSiteTheme(localStorage.getItem(SITE_THEME_STORAGE_KEY));
    } catch {
        return normalizeSiteTheme(document.documentElement.dataset.siteTheme);
    }
}

export function setSiteTheme(value, { persist = true } = {}) {
    const theme = normalizeSiteTheme(value);
    document.documentElement.dataset.siteTheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
        "content",
        { a: "#eaf7fb", b: "#081423", c: "#fff3f7", d: "#181510" }[theme],
    );
    document.querySelectorAll("[data-site-theme-select]").forEach(select => {
        select.value = theme;
    });
    if (persist) {
        try { localStorage.setItem(SITE_THEME_STORAGE_KEY, theme); } catch { /* Storage may be disabled. */ }
    }
    window.dispatchEvent(new CustomEvent("sekai:site-theme", { detail: { theme } }));
    return theme;
}

export function siteThemeOptionsHtml() {
    return Object.entries(SITE_THEMES)
        .map(([id, label]) => `<option value="${id}">${label}</option>`)
        .join("");
}

if (typeof window !== "undefined" && typeof document !== "undefined" && document.documentElement) setSiteTheme(getSiteTheme(), { persist: false });

if (typeof window !== "undefined") {
    window.addEventListener("storage", event => {
        if (event.key === SITE_THEME_STORAGE_KEY || event.key === null) {
            setSiteTheme(event.newValue, { persist: false });
        }
    });
}
