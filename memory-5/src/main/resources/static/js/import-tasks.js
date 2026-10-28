(() => {
    'use strict';
    const form=document.querySelector('[data-import-source]');if(!form)return;
    const status=document.createElement('p');status.className='import-task-status';status.setAttribute('role','status');form.after(status);
    form.addEventListener('submit',async event=>{
        event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='正在创建导入任务…';
        try {
            const auth=await fetch('/api/library-tools/session');if(!auth.ok)throw new Error('请先登录后再导入');const {csrf}=await auth.json();const fields=new FormData(form);
            const response=await fetch('/api/library-tools/import-tasks',{method:'POST',headers:{'Content-Type':'application/json','X-Library-CSRF':csrf},body:JSON.stringify({source:form.dataset.importSource,input:fields.get('songIds') || fields.get('link'),playlistId:fields.get('playlistId')?Number(fields.get('playlistId')):null})});
            const data=await response.json();if(!response.ok)throw new Error(data.message || '无法创建任务');
            status.textContent='任务已提交，关闭此页仍会继续处理。';const link=document.createElement('a');link.href='/library-tools#tasks-heading';link.textContent=' 查看进度与结果';status.append(link);
        }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
    });
})();
