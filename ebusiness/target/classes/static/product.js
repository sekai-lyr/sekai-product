const form = document.getElementById('pubForm');

form.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const description = document.getElementById('description').value.trim();
    const price = document.getElementById('price').value.trim();
    const stock = document.getElementById('stock').value.trim();
    const categoryIds = document.getElementById('categoryIds').value.trim();
    const images = document.getElementById('images').value.trim();
    const detail = document.getElementById('detail').value.trim();

    const data = {
        name: name,
        description: description,
        price: Number(price),
        stock: Number(stock),
        categoryIds: categoryIds,
        images: images,
        detail: detail
    };

    fetch('/product/pub/api', {
        body: JSON.stringify(data),
        cache: 'no-cache',
        headers: {
            'content-type': 'application/json'
        },
        method: 'POST'
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (result) {
            console.log('返回结果：', result);

            if (result.isSuccess === true || result.success === true) {
                alert(result.message || '商品发布成功！');
                location.href = '/product/list';
            } else {
                alert('商品发布失败：' + (result.message || '未知错误'));
            }
        })
        .catch(function (err) {
            console.error(err);
            alert('网络异常，发布失败');
        });
});
