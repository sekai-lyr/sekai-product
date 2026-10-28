(() => {
    const status=document.querySelector('#website-status'),form=document.querySelector('#website-review-form');
    let csrf='',logged=false,page=0,sort='latest',loading=false;
    const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
    const icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',({like:'M7 10v11H3V10h4Zm0 0 5-7c2 0 2 3 1 6h6c2 0 2 2 1 4l-2 7H7',reply:'M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z',smile:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 9h.01M16 9h.01M8 14c2 3 6 3 8 0',music:'M9 18V5l11-2v13M9 18c0 3-6 3-6 0s6-3 6 0Zm11-2c0 3-6 3-6 0s6-3 6 0Z'}[name]));svg.append(path);return svg;};
    const action=(name,text)=>{const button=el('button','', 'plaza-action');button.type='button';button.append(icon(name),el('span',text));return button;};
    const isAdmin=item=>item.isAdmin===true || item.isAdmin===1;
    const date=ms=>{const time=new Date(ms);return Number.isNaN(time.getTime())?'':time.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
    async function api(url,body){
        const response=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Feedback-CSRF':csrf},body:JSON.stringify(body)});
        if(!response.ok)throw new Error(({401:'请先登录，再来和大家聊聊。',403:'登录状态已过期，请刷新页面。',404:'这条评论暂不可用，请刷新看看。',429:'发布得太快啦，请一分钟后再试。',400:'请写2～1000个字符，回复对象也需要是已公开的评论。'}[response.status]) || '暂时连接不上，请稍后再试。');return response.json();
    }
    function requireLogin(){if(logged)return true;location.href='/login';return false;}
    function avatar(author){const node=el('span',Array.from(String(author || '听友'))[0],'website-comment-avatar');node.setAttribute('aria-hidden','true');return node;}
    function comment(item,root=item,own=false){
        const card=el('article','', 'website-review plaza-comment');card.id=`${own?'own-comment':'comment'}-${item.id}`;
        const heading=el('div','', 'website-comment-heading');heading.append(avatar(item.author),el('strong',item.author || '听友'));if(isAdmin(item))heading.append(el('span','站长','plaza-author-badge'));
        const meta=el('div','', 'website-review-meta');meta.append(el('time',date(item.createdMs)));if(own)meta.append(el('span',item.status==='approved' && item.parentId && !item.parentVisible?'已审核 · 原评论暂未公开':({pending:'待审核',approved:'已公开',rejected:'未公开'}[item.status])));
        card.append(heading,meta);
        const text=el('p','', 'plaza-comment-content');if(item.replyToAuthor)text.append(el('span',`回复 @${item.replyToAuthor}：`,'plaza-mention'));text.append(document.createTextNode(item.content));card.append(text);
        if(own){if(item.parentId)card.append(el('small',`回复了评论 #${item.parentId}`));return card;}
        const actions=el('div','', 'website-review-actions');let liked=!!item.liked;
        const like=action('like',String(item.likeCount || 0));like.classList.toggle('is-liked',liked);like.setAttribute('aria-pressed',String(liked));like.setAttribute('aria-label','点赞这条评论');
        like.addEventListener('click',async()=>{if(!requireLogin())return;like.disabled=true;try{const result=await api(`/api/feedback/${item.id}/like`,{liked:!liked});liked=result.liked;like.classList.toggle('is-liked',liked);like.setAttribute('aria-pressed',String(liked));like.querySelector('span').textContent=String(result.likeCount);}catch(error){status.textContent=error.message;}finally{like.disabled=false;}});
        const reply=action('reply',item.parentId?'回复':`回复${item.replyCount?` ${item.replyCount}`:''}`);
        reply.addEventListener('click',()=>{if(!requireLogin())return;const host=document.querySelector(`#comment-${root.id}`);if(!host)return;const previous=host.querySelector('.plaza-reply-composer'),draft=previous?.querySelector('textarea').value || '';previous?.remove();
            const editor=el('form','', 'plaza-reply-composer');const label=el('label',`回复 @${item.author}`),input=el('textarea');input.minLength=2;input.maxLength=1000;input.rows=2;input.required=true;input.placeholder='接着聊聊…';input.value=draft;label.append(input);
            const controls=el('div','', 'website-composer-footer'),cancel=el('button','取消');cancel.type='button';cancel.addEventListener('click',()=>editor.remove());const send=el('button','发布回复');send.type='submit';controls.append(cancel,send);editor.append(label,controls);host.append(editor);input.focus();
            editor.addEventListener('submit',async event=>{event.preventDefault();send.disabled=true;try{await api('/api/feedback',{content:input.value.trim(),parentId:root.id,replyToId:item.id});editor.remove();await load();status.textContent='回复已收到，审核后会显示在这一楼。';}catch(error){status.textContent=error.message;send.disabled=false;}});
        });actions.append(like,reply);card.append(actions);
        return card;
    }
    async function thread(card,item){
        if(!item.replyCount)return;
        const area=el('div','', 'plaza-replies');card.append(area);
        let replyPage=0,all=[],expanded=false;
        const more=el('button','展开更多回复','plaza-more-replies');more.type='button';
        function render(){area.replaceChildren(...(expanded?all:all.slice(0,3)).map(reply=>comment(reply,item)));if((!expanded && all.length>3) || all.length<item.replyCount)area.append(more);}
        try{const response=await api(`/api/feedback/${item.id}/replies?page=0`);all=response.replies;render();}catch(error){area.append(el('p',error.message));}
        more.addEventListener('click',async()=>{more.disabled=true;try{if(!expanded && all.length>3)expanded=true;else{expanded=true;const response=await api(`/api/feedback/${item.id}/replies?page=${++replyPage}`);all.push(...response.replies);if(!response.replies.length)item.replyCount=all.length;}render();more.textContent='查看更多回复';}catch(error){status.textContent=error.message;}finally{more.disabled=false;}});
    }
    function empty(){const node=el('div','', 'plaza-empty');node.append(icon('music'),el('h3','这张唱片，还等着第一道声音'),el('p','喜欢、吐槽、小建议，都可以从一句话开始。'));const focus=el('button',logged?'写下第一条留言':'登录，留下第一条留言');focus.type='button';focus.addEventListener('click',()=>{if(requireLogin())document.querySelector('#review-content').focus();});node.append(focus);return node;}
    async function load(){
        if(loading)return;loading=true;
        try{const response=await api(`/api/feedback?page=${page}&sort=${sort}`);logged=response.loggedIn;csrf=response.csrf;
            form.hidden=!logged;document.querySelector('#feedback-login').hidden=logged;document.querySelector('#own-reviews-panel').hidden=!logged;
            document.querySelector('#comment-self-name').textContent=logged?response.nickname || '听友':'和大家聊一聊';document.querySelector('#comment-self-avatar').textContent=Array.from(response.nickname || 'S')[0];
            const stats=response.community || {};for(const [id,value] of [['comment-total',stats.comments],['comment-participants',stats.participants],['comment-replies',stats.replies]])document.querySelector(`#${id}`).textContent=String(value || 0);
            document.querySelector('#own-reviews').replaceChildren(...response.own.map(item=>comment(item,item,true)));if(!response.own.length)document.querySelector('#own-reviews').append(el('p','还没有自己的留言。'));
            const feed=document.querySelector('#public-reviews');feed.replaceChildren();if(!response.reviews.length)feed.append(page===0?empty():el('p','这一页还没有留言，返回上一页看看吧。'));
            for(const item of response.reviews){const card=comment(item);feed.append(card);thread(card,item);}
            document.querySelector('#review-prev').disabled=page===0;document.querySelector('#review-next').disabled=response.reviews.length<20;document.querySelector('#review-page').textContent=`第${page+1}页`;
            document.querySelectorAll('[data-comment-sort]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.commentSort===sort)));
        }finally{loading=false;}
    }
    form.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;try{await api('/api/feedback',{content:document.querySelector('#review-content').value.trim()});form.reset();document.querySelector('#comment-length').textContent='0 / 1000';await load();status.textContent='留言已收到，审核后公开。';}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
    for(const button of document.querySelectorAll('[data-comment-sort]'))button.addEventListener('click',async()=>{if(loading)return;sort=button.dataset.commentSort;page=0;try{await load();}catch(error){status.textContent=error.message;}});
    for(const [id,step] of [['review-prev',-1],['review-next',1]])document.querySelector(`#${id}`).addEventListener('click',async()=>{if(loading)return;page=Math.max(0,page+step);try{await load();}catch(error){status.textContent=error.message;}});
    const emojiToggle=document.querySelector('#comment-emoji-toggle'),emojis=document.querySelector('#comment-emojis'),input=document.querySelector('#review-content');emojiToggle.prepend(icon('smile'));
    for(const emoji of ['😊','🥰','🎧','✨','👏','💛','😭','👍']){const button=el('button',emoji);button.type='button';button.setAttribute('aria-label',`插入表情 ${emoji}`);button.addEventListener('click',()=>{if(input.value.length+emoji.length>1000)return;input.setRangeText(emoji,input.selectionStart,input.selectionEnd,'end');input.dispatchEvent(new Event('input'));input.focus();});emojis.append(button);}
    emojiToggle.addEventListener('click',()=>{emojis.hidden=!emojis.hidden;emojiToggle.setAttribute('aria-expanded',String(!emojis.hidden));});input.addEventListener('input',()=>document.querySelector('#comment-length').textContent=`${input.value.length} / 1000`);
    load().then(()=>status.textContent='欢迎留下你的声音。').catch(error=>status.textContent=error.message);
})();
