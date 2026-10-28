(() => {
    const page=document.querySelector('[data-website-page]');if(!page)return;
    const admin=page.dataset.websitePage==='overview',status=document.querySelector('#website-status');
    let csrf='',offset=0;
    const names={disc:'唱片舞台',lyrics:'字阵舞台','folia-classic':'Folia 经典',folia:'Folia · 商籁'};
    const stateNames={pending:'待审核',approved:'已公开',rejected:'未公开'};
    const element=(tag,text,className)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
    const duration=ms=>{const seconds=Math.floor(Number(ms || 0)/1000);return seconds>=3600?`${(seconds/3600).toFixed(1)}小时`:seconds>=60?`${(seconds/60).toFixed(1)}分钟`:`${seconds}秒`;};
    async function request(url,body){
        const response=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Feedback-CSRF':csrf},body:JSON.stringify(body)});
        if(!response.ok)throw new Error(({401:'请先登录。',403:'没有权限或登录已过期，请刷新后重试。',429:'评论发布过于频繁，请一分钟后重试。',400:'请写2～1000个字符的评论。'}[response.status]) || '加载或保存失败，请稍后重试。');
        return response.json();
    }
    function reviews(container,items,moderate=false){
        container.replaceChildren();if(!items.length){container.append(element('p',moderate?'暂无该状态的评论。':container.id==='own-reviews'?'你还没有留言。':'这里还很安静，来留下第一条评论吧。'));return;}
        for(const item of items){
            const card=element('article','', 'website-review');
            const heading=element('div','', 'website-comment-heading');heading.append(element('span',Array.from(String(item.author || '听友'))[0],'website-comment-avatar'),element('strong',item.author));card.append(heading);
            const meta=element('div','', 'website-review-meta');
            meta.append(element('span',new Date(item.createdMs).toLocaleString()));if(moderate || container.id==='own-reviews')meta.append(element('span',stateNames[item.status]));
            card.append(meta,element('p',item.content));
            if(item.parentId)card.append(element('small',`回复评论 #${item.parentId}${item.replyToId?` · 回复对象 #${item.replyToId}`:''}`));
            if(item.parentId && !item.parentVisible)card.append(element('small',' · 主评论未公开，楼内回复暂不可见'));
            if(moderate){const actions=element('div','', 'website-review-actions');for(const [value,label] of [['approved','通过并公开'],['rejected','不公开／撤下']]){
                if(item.status===value)continue;const button=element('button',label);button.type='button';button.addEventListener('click',async()=>{
                    if(!confirm(`${label}这条评论？`))return;button.disabled=true;
                    try{await request(`/api/admin/feedback/${item.id}`,{status:value});await loadOverview();await loadReviews();status.textContent='审核状态已保存。';}catch(error){status.textContent=error.message;button.disabled=false;}
                });actions.append(button);}card.append(actions);}
            container.append(card);
        }
    }
    function pagination(items){document.querySelector('#review-prev').disabled=offset===0;document.querySelector('#review-next').disabled=items.length<20;document.querySelector('#review-page').textContent=`第${offset+1}页`;}
    async function loadReviews(){
        const response=await request(admin?`/api/admin/feedback?status=${document.querySelector('#moderation-status').value}&page=${offset}`:`/api/feedback?page=${offset}`);
        if(admin)reviews(document.querySelector('#moderation-reviews'),response.reviews,true);
        else{
            csrf=response.csrf;document.querySelector('#website-review-form').hidden=!response.loggedIn;document.querySelector('#feedback-login').hidden=response.loggedIn;
            document.querySelector('#own-reviews-panel').hidden=!response.loggedIn;reviews(document.querySelector('#own-reviews'),response.own);reviews(document.querySelector('#public-reviews'),response.reviews);
        }pagination(response.reviews);
    }
    function trend(container,rows,field,format){
        container.replaceChildren();const max=Math.max(1,...rows.map(row=>Number(row[field])));
        for(const row of rows){const column=element('div','', 'website-trend-column'),bar=element('div','', 'website-trend-bar');bar.style.height=`${Number(row[field])/max*130}px`;column.append(element('span',format(row[field])),bar,element('span',row.day.slice(5)));container.append(column);}
    }
    async function loadOverview(){
        const response=await request('/api/admin/overview');csrf=response.csrf;const data=response.data;
        const cards=document.querySelector('#overview-cards');cards.replaceChildren();
        for(const [label,value] of [['注册用户',data.registeredUsers],['今日登录用户',data.todayLogins],['近7天活跃用户',data.active7Days],['近5分钟活跃',data.recentActive],['播放次数（≥5秒）',data.plays],['听过的歌曲数',data.songsHeard],['累计听歌时长',duration(data.playedMs)],['今日听歌时长',duration(data.todayPlayedMs)],['评论总数',data.comments],['待审核评论',data.pending],['已公开评论',data.approved],['未公开评论',data.rejected]]){
            const card=element('article','', 'website-stat');card.append(element('span',label),element('strong',String(value)));cards.append(card);
        }
        trend(document.querySelector('#login-trend'),data.trend,'logins',String);trend(document.querySelector('#listening-trend'),data.trend,'playedMs',duration);
        const distribution=document.querySelector('#stage-distribution');distribution.replaceChildren();const max=Math.max(1,...data.stages.map(item=>Number(item.playedMs)));
        for(const [mode,name] of Object.entries(names)){const ms=data.stages.find(item=>item.stage===mode)?.playedMs || 0,row=element('div','', 'website-stage-row'),bar=element('div','', 'website-stage-bar'),fill=element('div','', 'website-stage-fill');fill.style.width=`${Number(ms)/max*100}%`;bar.append(fill);row.append(element('span',name),bar,element('span',duration(ms)));distribution.append(row);}
        status.textContent=`更新于 ${new Date().toLocaleTimeString()} · ${data.trackingStarted?`已有统计始于 ${data.trackingStarted}`:'暂无登录或播放统计，启用后开始累计。'}`;
    }
    for(const [id,step] of [['review-prev',-1],['review-next',1]])document.querySelector(`#${id}`).addEventListener('click',async()=>{offset=Math.max(0,offset+step);try{await loadReviews();}catch(error){status.textContent=error.message;}});
    if(admin){document.querySelector('#moderation-status').addEventListener('change',async()=>{offset=0;try{await loadReviews();}catch(error){status.textContent=error.message;}});document.querySelector('#overview-refresh').addEventListener('click',()=>loadOverview().catch(error=>status.textContent=error.message));}
    else document.querySelector('#website-review-form').addEventListener('submit',async event=>{
        event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
        try{await request('/api/feedback',{content:document.querySelector('#review-content').value.trim()});event.target.reset();await loadReviews();status.textContent='留言已收到，审核后就会出现在评论区。';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}
    });
    (async()=>{if(admin)await loadOverview();await loadReviews();if(!admin)status.textContent='欢迎留下你的声音。';})().catch(error=>status.textContent=error.message);
})();
