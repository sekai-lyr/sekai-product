// A fixed celestial sphere, rotated about one pole and projected through a wide-angle lens.
// Absolute audio time drives both the sky and its long-exposure trail, so seeking is reversible.
const random=n=>{const x=Math.sin(n*127.1+19.73)*43758.5453;return x-Math.floor(x);};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const rgb=c=>`rgb(${c.join(',')})`;
const axis=[.70,.68,Math.sqrt(1-.70**2-.68**2)];
const stars=Array.from({length:2300},(_,i)=>{
    const z=random(i*3+2)*2-1,a=random(i*3+3)*Math.PI*2,r=Math.sqrt(1-z*z);
    return {v:[r*Math.cos(a),r*Math.sin(a),z],light:random(i+8500)**3,
        color:random(i+9500)<.18?[255,210,157]:random(i+9500)>.76?[177,208,255]:[228,236,255]};
});
function project(v,angle,w,h){
    const c=Math.cos(angle),s=Math.sin(angle),dot=axis[0]*v[0]+axis[1]*v[1]+axis[2]*v[2];
    const x=v[0]*c+(axis[1]*v[2]-axis[2]*v[1])*s+axis[0]*dot*(1-c);
    const y=v[1]*c+(axis[2]*v[0]-axis[0]*v[2])*s+axis[1]*dot*(1-c);
    const z=v[2]*c+(axis[0]*v[1]-axis[1]*v[0])*s+axis[2]*dot*(1-c);
    if(z<.06)return null;
    const r=Math.hypot(x,y),theta=Math.acos(Math.min(1,z)),f=Math.max(w*.52,h*.7);
    return [w*.48+x/Math.max(r,.0001)*theta*f,h*.49-y/Math.max(r,.0001)*theta*f];
}

export function createStarSky(){
    const surface=document.createElement('canvas'),cloud=document.createElement('canvas');
    const ctx=surface.getContext('2d'),dust=cloud.getContext('2d');
    let cacheKey='';
    function buildCloud(w,h){
        cloud.width=w;cloud.height=h;
        // Galactic dust: a broken, irregular band with dark lanes, not a neon stripe.
        for(let i=0;i<18000;i++){
            const u=random(i*7+31),v=(random(i*7+32)+random(i*7+33)+random(i*7+34)-1.5);
            const x=w*(.51+u*.17)+v*w*.09,y=h*(u*1.08-.04)+Math.sin(u*8)*h*.025;
            const lane=.35+.65*Math.abs(Math.sin(u*21+v*7));
            dust.fillStyle=`rgba(160,178,205,${(.014+random(i+60)*.06)*lane})`;
            dust.beginPath();dust.ellipse(x,y,.6+random(i+61)*5,.4+random(i+62)*2,-.8,0,Math.PI*2);dust.fill();
        }
    }
    function landscape(w,h,night){
        const horizon=h*.83;
        const haze=ctx.createLinearGradient(0,h*.66,0,h*.91);
        haze.addColorStop(0,'rgba(188,139,105,0)');haze.addColorStop(.62,`rgba(178,135,96,${.14*(1-night)+.035})`);haze.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=haze;ctx.fillRect(0,h*.66,w,h*.25);
        for(let layer=0;layer<3;layer++){
            ctx.beginPath();ctx.moveTo(0,h);
            for(let i=0;i<=90;i++){
                const x=i/90*w,y=horizon+layer*h*.043+Math.sin(i*.08+layer)*h*.025+Math.sin(i*.19+layer*2)*h*.012;
                ctx.lineTo(x,y);
            }
            ctx.lineTo(w,h);ctx.closePath();ctx.fillStyle=rgb(mix([40-layer*9,51-layer*10,56-layer*10],[9-layer*3,15-layer*4,22-layer*5],night));ctx.fill();
        }
        // Uneven tree crowns anchor the sky to a stationary, dark foreground.
        ctx.fillStyle=rgb(mix([18,29,29],[3,7,10],night));
        for(let i=0;i<180;i++){
            const x=random(i+4000)*w,base=h*(.91+random(i+4050)*.06);
            const edge=Math.abs(x/w-.5)*2;
            const size=h*(.012+random(i+4100)*.04)*(.55+edge*.9);
            ctx.fillRect(x-size*.045,base-size*1.8,size*.09,size*2.2);
            for(let j=0;j<32;j++){
                const px=x+(random(i*13+j+4200)-.5)*size*1.4,py=base-size*(.5+random(i*13+j+4400)*1.6);
                ctx.beginPath();
                for(let k=0;k<10;k++){
                    const a=k/10*Math.PI*2,r=size*(.08+random(i*113+j*11+k+4700)*.09);
                    const tx=px+Math.cos(a)*r,ty=py+Math.sin(a)*r;
                    if(k===0)ctx.moveTo(tx,ty);else ctx.lineTo(tx,ty);
                }
                ctx.closePath();ctx.fill();
            }
        }
    }
    return function draw(target,width,height,time,config,reducedMotion){
        const w=Math.round(Math.min(1440,width)),h=Math.round(w*height/width);
        const clock=reducedMotion?28:Math.floor(Math.max(0,time)*20)/20;
        const night=config.sky==='night'?1:config.sky==='dusk'?.35:.3+.7*smooth(clock/7);
        const rotation=(reducedMotion?0:clock)*.048*config.motion;
        const key=[w,h,Math.floor(clock*20),config.motion,config.density,config.sky,config.trail,reducedMotion].join(':');
        if(key!==cacheKey){
            cacheKey=key;
            if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;buildCloud(w,h);}
            ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
            const sky=ctx.createLinearGradient(0,0,0,h);
            sky.addColorStop(0,rgb(mix([52,91,135],[3,8,22],night)));
            sky.addColorStop(.55,rgb(mix([113,135,157],[9,20,43],night)));
            sky.addColorStop(.82,rgb(mix([224,164,115],[25,33,49],night)));
            sky.addColorStop(1,rgb(mix([96,88,88],[4,9,16],night)));
            ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
            ctx.save();ctx.globalAlpha=night*.7;ctx.translate(w*.66,h*.24);ctx.rotate(rotation*.4);ctx.translate(-w*.66,-h*.24);ctx.drawImage(cloud,0,0);ctx.restore();
            const count=Math.round(700+config.density*30),exposure=(config.trail??.8)*(.25+.9*night);
            const starAlpha=.3+.7*smooth((night-.12)/.75);
            ctx.lineCap='round';
            for(let i=0;i<Math.min(count,stars.length);i++){
                const star=stars[i],head=project(star.v,rotation,w,h);
                if(!head||head[0]<-w*.3||head[0]>w*1.3||head[1]>h*.9||head[1]<-h*.3)continue;
                const arc=exposure*(.7+random(i+6000)*.3),steps=8;
                for(let j=0;j<steps;j++){
                    const a=project(star.v,rotation-arc*(1-j/steps),w,h),b=project(star.v,rotation-arc*(1-(j+1)/steps),w,h);
                    if(!a||!b||Math.hypot(a[0]-b[0],a[1]-b[1])>w*.15)continue;
                    ctx.strokeStyle=`rgba(${star.color.join(',')},${starAlpha*(.045+star.light*.5)*(.35+.65*(j+1)/steps)})`;
                    ctx.lineWidth=.5+star.light*.8;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
                }
                ctx.fillStyle=`rgba(${star.color.join(',')},${starAlpha*(.18+star.light*.75)})`;
                ctx.beginPath();ctx.arc(...head,.35+star.light*.8,0,Math.PI*2);ctx.fill();
                if(star.light>.94){
                    const glow=ctx.createRadialGradient(...head,0,...head,4);
                    glow.addColorStop(0,`rgba(211,227,255,${starAlpha*.22})`);glow.addColorStop(1,'rgba(170,200,255,0)');
                    ctx.fillStyle=glow;ctx.fillRect(head[0]-4,head[1]-4,8,8);
                }
            }
            // Thin high clouds dissolve as the sky darkens, leaving the galactic band visible.
            if(night<.92){
                ctx.globalAlpha=(1-night)*.22;
                for(let i=0;i<12;i++){
                    const x=(random(i+7100)*w+clock*1.7*config.motion)%(w*1.4)-w*.2,y=h*(.18+random(i+7200)*.42);
                    const cloudLight=ctx.createRadialGradient(x,y,0,x,y,w*.24);
                    cloudLight.addColorStop(0,'rgba(241,218,199,.35)');cloudLight.addColorStop(1,'rgba(231,209,191,0)');
                    ctx.save();ctx.translate(x,y);ctx.scale(1,.11);ctx.fillStyle=cloudLight;ctx.translate(-x,-y);ctx.fillRect(x-w*.3,y-w*.3,w*.6,w*.6);ctx.restore();
                }
                ctx.globalAlpha=1;
            }
            landscape(w,h,night);
            const vignette=ctx.createRadialGradient(w*.5,h*.45,h*.1,w*.5,h*.45,w*.72);
            vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,2,9,.62)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
        }
        target.drawImage(surface,0,0,width,height);
    };
}
