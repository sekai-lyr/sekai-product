const registerForm = document.querySelector("#registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
        const userName = document.querySelector("#userName").value.trim();
        const password = document.querySelector("#password").value.trim();
        const confirmPassword = document.querySelector("#confirmPassword").value.trim();
        document.querySelector("#userNameError").textContent = userName ? "" : "请输入用户名";
        document.querySelector("#passwordError").textContent = password.length >= 6 ? "" : "密码至少 6 位";
        document.querySelector("#confirmPasswordError").textContent = password === confirmPassword ? "" : "两次密码不一致";
        if (!userName || password.length < 6 || password !== confirmPassword) {
            event.preventDefault();
        }
    });
}
