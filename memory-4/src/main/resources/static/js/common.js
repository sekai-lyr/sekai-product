window.apiFetch = async function (url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    headers.set("X-CSRF-Token", document.querySelector('meta[name="csrf-token"]')?.content || "");
    const response = await fetch(url, { ...options, headers, signal: options.signal || AbortSignal.timeout(20000) });
    if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || (response.status === 401 ? "登录已过期，请重新登录" : "服务暂时不可用，请稍后重试"));
    }
    return response;
};
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-confirm]").forEach(form => form.addEventListener("submit", event => {
        if (!window.confirm(form.dataset.confirm)) event.preventDefault();
    }));
});
