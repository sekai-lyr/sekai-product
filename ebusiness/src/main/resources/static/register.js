const form = document.getElementById('regForm');

form.addEventListener('submit', function(e) {
  e.preventDefault();

  // 获取输入框内容
  const userName = document.getElementById('userName').value.trim();
  const pwd = document.getElementById('pwd').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const email = document.getElementById('email').value.trim();
  const name = document.getElementById('name').value.trim();
  const gender = document.getElementById('gender').value.trim();

  // 组装数据
var data = {
  "userName": userName,
  "password": pwd,  // 👈 必须改成 password！
  "mobile": mobile,
  "email": email,
  "name": name,
  "gender": gender
};

  // 发送请求
  fetch('/reg/api', {
    body: JSON.stringify(data),
    cache: 'no-cache',
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST'
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(result) {
    console.log("data is :" + JSON.stringify(result));
    if (result.isSuccess == true || result.success == true) {
      alert("注册成功");
      location.href = "login"; // 跳登录页
    } else {
        // 强制兜底，就算 message 是 undefined，也显示友好提示
        const msg = result?.message || "未知错误，请检查后端IDEA控制台日志";
        alert("注册失败：" + msg);
      }
  });
});