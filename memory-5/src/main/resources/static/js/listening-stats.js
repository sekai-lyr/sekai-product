(() => {
    let current=null,events=null,tokenPromise;
    const active=audio=>!audio.paused && !audio.ended && !audio.seeking && audio.readyState>=3;
    const make=(track,stage)=>({key:track.key,songId:track.id,stage,cumulative:0,last:performance.now(),active:false,id:null,queue:Promise.resolve(),finished:false});
    function sample(state){
        const now=performance.now();if(state.active)state.cumulative+=Math.min(2000,Math.max(0,now-state.last));state.last=now;
        state.active=!!state.audio && !state.buffering && active(state.audio);
    }
    async function post(url,body){
        tokenPromise ||= fetch('/api/listening/token').then(async response=>{if(!response.ok)throw new Error('No account');return (await response.json()).csrf;});
        const token=await tokenPromise;
        const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Feedback-CSRF':token},body:JSON.stringify(body),keepalive:true});
        if(!response.ok)throw new Error('Statistics unavailable');return response.json();
    }
    function start(state){
        state.starting ||= post('/api/listening/start',{songId:state.songId,stage:state.stage}).then(result=>{state.id=result.id;}).catch(()=>{state.starting=null;});
        return state.starting;
    }
    function flush(state){
        if(!state || !state.cumulative)return;
        const cumulativeMs=Math.floor(state.cumulative),stage=state.stage;
        state.queue=state.queue.then(async()=>{await start(state);if(state.id)await post(`/api/listening/${state.id}`,{cumulativeMs,stage});}).catch(()=>{});
    }
    window.__sekaiListening={attach(audio,track,stage){
        if(!track.id || !String(track.key).startsWith('account:'))return;
        if(current){sample(current);current.active=false;flush(current);}
        events?.abort();events=new AbortController();
        let state=current?.key===track.key && !current.finished?current:make(track,stage);
        current=state;state.audio=audio;state.stage=stage;state.last=performance.now();state.active=active(audio);
        const update=()=>{sample(state);if(state.active)start(state);else flush(state);};
        for(const event of ['pause','seeking','seeked','canplay'])audio.addEventListener(event,update,{signal:events.signal});
        audio.addEventListener('waiting',()=>{sample(state);state.buffering=true;state.active=false;flush(state);},{signal:events.signal});
        audio.addEventListener('playing',()=>{if(state.finished){state=make(track,stage);state.audio=audio;current=state;}state.buffering=false;update();},{signal:events.signal});
        audio.addEventListener('ended',()=>{sample(state);state.active=false;state.finished=true;flush(state);},{signal:events.signal});
        if(state.active)start(state);
    }};
    let elapsed=0;setInterval(()=>{if(!current)return;sample(current);if(++elapsed%10===0)flush(current);},1000);
    window.addEventListener('pagehide',()=>{if(current){sample(current);current.active=false;flush(current);}});
})();
