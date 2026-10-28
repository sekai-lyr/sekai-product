(() => {
    const editor=document.querySelector('#song-cover-editor');
    const input=document.querySelector('#cover-file'),save=document.querySelector('#cover-save');
    const status=document.querySelector('#cover-status'),preview=document.querySelector('#cover-preview');
    const key=`user:${editor.dataset.userId}:song:${editor.dataset.songId}`;
    let selected,url;
    input.addEventListener('change',async()=>{
        selected=null;save.disabled=true;
        const file=input.files[0];if(!file)return;
        try{
            if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择 PNG、JPG 或 WebP 图片。');
            if(file.size>20*1024*1024)throw new Error('封面不能超过 20 MB。');
            const bitmap=await createImageBitmap(file);bitmap.close();
            if(url)URL.revokeObjectURL(url);
            selected=file;url=URL.createObjectURL(file);preview.src=url;save.disabled=false;
            status.textContent='预览已更新，请点击保存。';
        }catch(error){status.textContent=error.message || '图片无法读取，请重新选择。';}
    });
    save.addEventListener('click',async()=>{
        if(!selected)return;save.disabled=true;
        try{
            const db=await new Promise((resolve,reject)=>{
                const request=indexedDB.open('sekai-local-file-handles',1);
                request.onupgradeneeded=()=>request.result.createObjectStore('references');
                request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
            });
            try{await new Promise((resolve,reject)=>{
                const tx=db.transaction('references','readwrite'),store=tx.objectStore('references');
                const read=store.get(key);
                read.onsuccess=()=>store.put({...read.result,cover:undefined,coverBlob:selected},key);
                tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
            });}finally{db.close();}
            status.textContent='封面已保存到本机，歌曲库和播放器会使用这张图片。';
        }catch{status.textContent='保存失败，请检查浏览器存储空间或隐私设置后重试。';save.disabled=false;}
    });
    window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
})();
