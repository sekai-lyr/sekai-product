const form = document.getElementById('loginForm');

form.addEventListener('submit', function(e) {
  e.preventDefault(); // 阻止表单默认刷新

  // 1. 获取输入框的值
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  // 2. 简单前端验证
  if (!username) {
    alert('请输入账号');
    return;
  }
  if (!password) {
    alert('请输入密码');
    return;
  }

  // 3. 组装要发送给后端的数据
  const data = {
    userName: username,
    pwd: password
  };

  // 4. 发送登录请求（和注册格式完全一致）
  fetch('/login/api', {
    body: JSON.stringify(data),
    cache: 'no-cache',
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST'
  })
  .then(response => response.json())
  .then(result => {
    console.log("登录返回结果：", result);

    // 5. 根据后端返回判断登录是否成功
    if (result.isSuccess == true || result.success == true) {
      alert('登录成功！欢迎来到二次元电商～');
      // 登录成功跳转到首页 / 商品列表
      location.href = '/product.html';
    } else {
      alert('登录失败：账号或密码错误');
    }
  })
  .catch(error => {
    console.error('请求出错：', error);
    alert('网络异常，登录失败');
  });
});