(function () {
    var form = document.getElementById('registerForm');

    if (form) {
        form.addEventListener('submit', function (event) {
            var userName = document.getElementById('userName');
            var password = document.getElementById('password');
            var confirmPassword = document.getElementById('confirmPassword');
            var userNameError = document.getElementById('userNameError');
            var passwordError = document.getElementById('passwordError');
            var confirmPasswordError = document.getElementById('confirmPasswordError');
            var valid = true;

            if (userNameError) {
                userNameError.textContent = '';
            }
            if (passwordError) {
                passwordError.textContent = '';
            }
            if (confirmPasswordError) {
                confirmPasswordError.textContent = '';
            }

            if (userName && userName.value.trim() === '') {
                if (userNameError) {
                    userNameError.textContent = '请输入用户名';
                }
                valid = false;
            }
            if (password && password.value.length < 6) {
                if (passwordError) {
                    passwordError.textContent = '密码至少 6 位';
                }
                valid = false;
            }
            if (confirmPassword && confirmPassword.value !== password.value) {
                if (confirmPasswordError) {
                    confirmPasswordError.textContent = '两次输入的密码不一致';
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
                submitButton.textContent = '创建中';
            }
        });
    }
})();
