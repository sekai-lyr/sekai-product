(() => {
    'use strict';
    const csrf=document.body.dataset.libraryCsrf;
    async function api(path,body) {
        const response=await fetch('/api/library-tools/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Library-CSRF':csrf},body:body===undefined?undefined:JSON.stringify(body)});
        const data=await response.json();if(!response.ok)throw new Error(data.message || data.detail || '操作未完成，请稍后重试');return data;
    }
    const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
    function action(id,status,fn){document.getElementById(id).addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await fn();}catch(error){document.getElementById(status).textContent=error.message;}finally{event.target.disabled=false;}});}
    let page=1,duplicatePage=1,merge=null,archive=null,confirmation=null;
    async function smart(){
        const target=document.querySelector('#smart-results');target.textContent='正在查找…';
        try {const data=await api(`smart?rule=${encodeURIComponent(document.querySelector('#smart-rule').value)}&page=${page}`);target.replaceChildren();
            for(const song of data.songs){const row=el('article');row.className='library-row';const a=el('a');a.href='/player/'+song.id;const label=el('span');label.append(el('strong',song.title),el('small',song.artist || '未知歌手'));a.append(label);row.append(a);target.append(row);}
            if(!data.songs.length)target.textContent='这里还没有歌曲。';document.querySelector('#smart-prev').disabled=page===1;document.querySelector('#smart-next').disabled=!data.hasMore;document.querySelector('#smart-page').textContent=page;
        } catch(error){target.textContent=error.message;}
    }
    document.querySelector('#smart-rule').addEventListener('change',()=>{page=1;smart();});
    document.querySelector('#smart-prev').addEventListener('click',()=>{page--;smart();});document.querySelector('#smart-next').addEventListener('click',()=>{page++;smart();});
    async function duplicates(){
        const data=await api('duplicates?page='+duplicatePage),list=document.querySelector('#duplicate-results');list.replaceChildren();
        for(const pair of data.pairs){const li=el('li',`${pair.title} · ${pair.artist || '未知歌手'} · ${pair.keepAlbum || '未标注专辑'} / ${pair.removeAlbum || '未标注专辑'} `);
            for(const swap of [false,true]){const button=el('button',swap?'保留第二首并预览':'保留第一首并预览');button.addEventListener('click',async()=>{try{const keep=swap?pair.removeId:pair.keepId,remove=swap?pair.keepId:pair.removeId;const preview=await api(`merge-preview?keep=${keep}&remove=${remove}`);merge={keep,remove,fingerprint:preview.fingerprint};document.querySelector('#merge-description').textContent=`保留：${preview.keep.title}（${preview.keep.albumName || '未标注专辑'}，#${keep}）\n移除：${preview.remove.title}（${preview.remove.albumName || '未标注专辑'}，#${remove}）\n收藏与歌单关系保留。已有歌词和播放偏好以保留歌曲为准。`;document.querySelector('#merge-preview').hidden=false;document.querySelector('#merge-preview').scrollIntoView({block:'nearest'});}catch(error){document.querySelector('#merge-status').textContent=error.message;}});li.append(button);}list.append(li);}
        if(!data.pairs.length)list.append(el('li','没有更多重复候选。'));document.querySelector('#duplicates-more').hidden=!data.hasMore;
    }
    action('scan-duplicates','merge-status',async()=>{duplicatePage=1;await duplicates();});action('duplicates-more','merge-status',async()=>{duplicatePage++;await duplicates();});
    action('merge-confirm','merge-status',async()=>{if(!merge)return;await api('merge',merge);merge=null;document.querySelector('#merge-preview').hidden=true;document.querySelector('#merge-status').textContent='已合并，收藏和歌单关系已保留。若无法播放，请重新关联本机文件。';await duplicates();await smart();});
    document.querySelector('#merge-cancel').addEventListener('click',()=>{merge=null;document.querySelector('#merge-preview').hidden=true;});
    document.querySelector('#backup-file').addEventListener('change',async event=>{
        archive=null;confirmation=null;document.querySelector('#restore-preview').hidden=true;const status=document.querySelector('#backup-status');const file=event.target.files[0];if(!file)return;
        try{if(file.size>8*1024*1024)throw new Error('备份文件不能超过 8 MB');const parsed=JSON.parse(await file.text());const data=await api('backup-preview',parsed);archive=parsed;confirmation=data.confirmation;
            document.querySelector('#restore-description').textContent=`${data.preview.songs} 首歌曲、${data.preview.playlists} 张歌单，其中 ${data.preview.conflicts} 首与当前资料匹配。`;
            document.querySelector('#restore-conflicts').replaceChildren(...data.preview.conflictTitles.map(title=>el('li',title)));document.querySelector('#restore-preview').hidden=false;status.textContent='预览完成，确认后才写入。';
        }catch(error){status.textContent=error.message;}
    });
    action('restore-confirm','backup-status',async()=>{if(!archive)return;const result=await api('restore',{archive,confirmation,mode:document.querySelector('#restore-mode').value});archive=null;confirmation=null;document.querySelector('#restore-preview').hidden=true;document.querySelector('#backup-status').textContent=`恢复完成：新增 ${result.added} 首，匹配 ${result.matched} 首，处理 ${result.playlists} 张歌单。请按需重新关联文件。`;await smart();});
    let timer;
    async function tasks(){
        clearTimeout(timer);const target=document.querySelector('#import-tasks');
        try{const list=await api('import-tasks');target.replaceChildren();let active=false;
            for(const task of list){const box=el('article');const done=task.items.filter(i=>i.state!=='queued').length;active ||= ['running','queued'].includes(task.state);box.append(el('h3',`${task.source==='qq'?'QQ 音乐':'网易云'} · ${done}/${task.items.length} 项 · ${{queued:'排队中',running:'处理中',complete:'已完成',partial:'有未完成项',interrupted:'已中断'}[task.state] || task.state}`));
                const details=el('details');details.append(el('summary','查看每项结果'));const rows=el('ul');task.items.forEach(item=>rows.append(el('li',`${item.input}：${item.message || '等待处理'}`)));details.append(rows);box.append(details);
                if(['partial','interrupted'].includes(task.state)){const retry=el('button','仅重试失败项');retry.addEventListener('click',async()=>{retry.disabled=true;try{await api(`import-tasks/${task.id}/retry`,{});await tasks();}catch(error){retry.disabled=false;box.append(el('p',error.message));}});box.append(retry);}target.append(box);
            }if(!list.length)target.textContent='暂无导入任务。';if(active)timer=setTimeout(tasks,2500);
        }catch(error){target.textContent=error.message;}
    }
    document.querySelector('#refresh-tasks').addEventListener('click',tasks);window.addEventListener('pagehide',()=>clearTimeout(timer));smart();tasks();
})();
