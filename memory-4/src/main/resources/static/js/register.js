const registerForm = document.querySelector("#registerForm");
if (registerForm) registerForm.addEventListener("submit", event => {
    const username = registerForm.elements.userName.value.trim();
    const password = registerForm.elements.password.value;
    const confirmation = registerForm.elements.confirmPassword.value;
    const validName = /^[a-zA-Z0-9_@.\-]{3,64}$/.test(username);
    const validPassword = password.length >= 8 && new TextEncoder().encode(password).length <= 72;
    document.querySelector("#userNameError").textContent = validName ? "" : "请输入 3–64 位有效用户名";
    document.querySelector("#passwordError").textContent = validPassword ? "" : "密码至少 8 个字符，不超过 72 字节";
    document.querySelector("#confirmPasswordError").textContent = password === confirmation ? "" : "两次密码不一致";
    if (!validName || !validPassword || password !== confirmation) event.preventDefault();
});
