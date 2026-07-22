const loginForm = document.querySelector("#loginForm");
const togglePassword = document.querySelector("#togglePassword");
const password = document.querySelector("#password");

if (togglePassword && password) {
    togglePassword.addEventListener("click", () => {
        const visible = password.type === "text";
        password.type = visible ? "password" : "text";
        togglePassword.textContent = visible ? "显示" : "隐藏";
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
        const userName = document.querySelector("#userName").value.trim();
        const passwordValue = password.value.trim();
        document.querySelector("#userNameError").textContent = userName ? "" : "请输入用户名";
        document.querySelector("#passwordError").textContent = passwordValue ? "" : "请输入密码";
        if (!userName || !passwordValue) {
            event.preventDefault();
        }
    });
}
