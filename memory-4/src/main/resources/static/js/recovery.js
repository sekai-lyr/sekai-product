const recoveryForm = document.querySelector("#recoveryForm");
const resetForm = document.querySelector("#resetForm");
const recoveryStatus = document.querySelector("#recoveryStatus");
async function submitRecovery(form, url) {
    const button = form.querySelector("button");
    button.disabled = true;
    recoveryStatus.textContent = "正在验证，请稍候…";
    try {
        const response = await apiFetch(url, { method: "POST", body: new URLSearchParams(new FormData(form)) });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        return result.data;
    } catch (error) {
        recoveryStatus.textContent = error.message || "连接失败，请重试";
        return null;
    } finally { button.disabled = false; }
}
recoveryForm.addEventListener("submit", async event => {
    event.preventDefault();
    const token = await submitRecovery(recoveryForm, "/user/recovery-token");
    if (!token) return;
    resetForm.elements.token.value = token;
    recoveryForm.hidden = true; resetForm.hidden = false;
    recoveryStatus.textContent = "身份已验证，请在 10 分钟内设置新密码。";
    resetForm.elements.newPassword.focus();
});
resetForm.addEventListener("submit", async event => {
    event.preventDefault();
    const password = resetForm.elements.newPassword.value;
    if (password !== resetForm.elements.confirmPassword.value) { recoveryStatus.textContent = "两次密码不一致"; return; }
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) { recoveryStatus.textContent = "密码至少 8 个字符，不超过 72 字节"; return; }
    if (await submitRecovery(resetForm, "/user/reset-password")) {
        resetForm.reset(); resetForm.hidden = true;
        recoveryStatus.textContent = "密码已更新，旧登录已失效。请返回登录，并生成新的恢复码。";
    }
});
