(function () {
    var form = document.getElementById('loginForm');
    var toggleBtn = document.getElementById('togglePassword');
    var passwordInput = document.getElementById('password');

    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function () {
            var isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            toggleBtn.textContent = isPassword ? '隐藏' : '显示';
            toggleBtn.setAttribute('aria-label', isPassword ? '隐藏密码' : '显示密码');
        });
    }

    if (form) {
        form.addEventListener('submit', function (event) {
            var userName = document.getElementById('userName');
            var password = document.getElementById('password');
            var userNameError = document.getElementById('userNameError');
            var passwordError = document.getElementById('passwordError');
            var valid = true;

            if (userNameError) {
                userNameError.textContent = '';
            }
            if (passwordError) {
                passwordError.textContent = '';
            }

            if (userName && userName.value.trim() === '') {
                if (userNameError) {
                    userNameError.textContent = '请输入用户名';
                }
                valid = false;
            }
            if (password && password.value === '') {
                if (passwordError) {
                    passwordError.textContent = '请输入密码';
                }
                valid = false;
            }

            if (!valid) {
                event.preventDefault();
                return;
            }

            var submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.setAttribute('aria-busy', 'true');
                submitButton.textContent = '登录中';
            }
        });
    }
})();
