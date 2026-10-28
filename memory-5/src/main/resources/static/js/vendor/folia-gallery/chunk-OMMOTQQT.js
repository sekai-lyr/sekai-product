import{$ as fo,T as G,U as Ze,V as St,W as so,_ as Xr,a as _,aa as mo,c as vt,ca as po,d as Ce,da as qr,g as Or,ga as Kr,h as Vr,ia as jr,la as Jr}from"./chunk-PHKKLDVU.js";import{a as K,b as lo,e as zr,g as Lr,i as Gr,j as Ut,l as Hr,m as Wr,q as Qr,s as dt,t as Yr,u as co,v as uo}from"./chunk-DGRFTYIX.js";import{a as E,b as At}from"./chunk-JJKG5VUT.js";import{b as ft,c as S}from"./chunk-OOJM4CTU.js";var mt=(e,t)=>{let o=255,r=0;for(let a of e)o=Math.min(o,a[t]),r=Math.max(r,a[t]);return r-o},Vi=e=>{if(e.colors.length<2)return null;let t={r:mt(e.colors,"r"),g:mt(e.colors,"g"),b:mt(e.colors,"b")},o=Object.keys(t).reduce((l,u)=>t[u]>t[l]?u:l,"r"),r=[...e.colors].sort((l,u)=>l[o]-u[o]),a=e.weight/2,n=0,i=1;for(let l=0;l<r.length-1&&(n+=r[l].weight,i=l+1,!(n>=a));l+=1);let s=r.slice(0,i),c=r.slice(i);return[{colors:s,weight:s.reduce((l,u)=>l+u.weight,0)},{colors:c,weight:c.reduce((l,u)=>l+u.weight,0)}]},zi=e=>{let t=e.colors.reduce((o,r)=>({r:o.r+r.r*r.weight,g:o.g+r.g*r.weight,b:o.b+r.b*r.weight}),{r:0,g:0,b:0});return{r:Math.round(t.r/e.weight),g:Math.round(t.g/e.weight),b:Math.round(t.b/e.weight),weight:e.weight}},Li=({r:e,g:t,b:o})=>`#${e.toString(16).padStart(2,"0")}${t.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}`,Zr=(e,t=5)=>{if(t<=0)return[];let o=new Map;for(let n=0;n<e.length;n+=4){if(e[n+3]<128)continue;let i=e[n],s=e[n+1],c=e[n+2],l=i>>4<<8|s>>4<<4|c>>4,u=o.get(l);u?(u.r+=i,u.g+=s,u.b+=c,u.weight+=1):o.set(l,{r:i,g:s,b:c,weight:1})}let r=[...o.values()].map(n=>({r:Math.round(n.r/n.weight),g:Math.round(n.g/n.weight),b:Math.round(n.b/n.weight),weight:n.weight}));if(r.length===0)return[];let a=[{colors:r,weight:r.reduce((n,i)=>n+i.weight,0)}];for(;a.length<Math.min(t,r.length);){let n=-1,i=-1;for(let c=0;c<a.length;c+=1){let l=a[c];if(l.colors.length<2)continue;let d=Math.max(mt(l.colors,"r"),mt(l.colors,"g"),mt(l.colors,"b"))*Math.sqrt(l.weight);d>i&&(i=d,n=c)}if(n<0)break;let s=Vi(a[n]);if(!s)break;a.splice(n,1,...s)}return a.map(zi).sort((n,i)=>i.weight-n.weight).map(Li)};var Gi=e=>new Promise(t=>{let o=new Image;o.crossOrigin="Anonymous",o.onload=()=>{let r=document.createElement("canvas"),a=r.getContext("2d");if(!a){t(null);return}let n=50,i=50;r.width=n,r.height=i,a.drawImage(o,0,0,n,i),t(a.getImageData(0,0,n,i).data)},o.onerror=r=>{console.warn("Failed to load image for color extraction",r),t(null)},o.src=e});var $r=async(e,t=5)=>{let o=await Gi(e);return o?Zr(o,t):[]};var ho={};ft(ho,{default:()=>os});var _e=e=>e;var go=S(_(),1),Ot=({onClick:e,label:t,title:o,isDaylight:r})=>(0,go.jsx)("button",{type:"button",onClick:e,className:`h-6 rounded-md px-1.5 text-[10px] font-bold transition-all ${r?"bg-white shadow-sm hover:bg-white/90":"bg-white/20 shadow-sm hover:bg-white/30"}`,title:o,"aria-label":o,children:t}),Ge=({active:e,onToggle:t,label:o,theme:r,children:a})=>(0,go.jsx)("button",{type:"button",onClick:t,className:`flex h-6 w-6 items-center justify-center rounded-md transition-all ${e?"":"opacity-40 hover:opacity-100"}`,style:e?{color:r.accentColor}:void 0,title:o,"aria-label":o,"aria-pressed":e,children:a});var He=S(_(),1),Hi=({label:e,description:t,checked:o,onChange:r,theme:a})=>(0,He.jsxs)("div",{className:"flex items-center justify-between gap-4",children:[(0,He.jsxs)("div",{className:"space-y-1",children:[(0,He.jsx)("div",{className:"text-sm font-medium",style:{color:a.primaryColor},children:e}),t&&(0,He.jsx)("div",{className:"max-w-[320px] text-xs opacity-70",style:{color:a.secondaryColor},children:t})]}),(0,He.jsx)("button",{type:"button","aria-pressed":o,disabled:!r,onClick:()=>r?.(!o),className:"h-6 w-12 shrink-0 rounded-full p-1 transition-colors disabled:opacity-45",style:{backgroundColor:o?a.secondaryColor:E(a.secondaryColor,.18)},children:(0,He.jsx)("div",{className:`h-4 w-4 rounded-full shadow-sm transition-transform ${o?"translate-x-6":"translate-x-0"}`,style:{backgroundColor:a.backgroundColor}})})]}),X=Hi;var $=S(_(),1),Wi=({config:e,actions:t,t:o,theme:r,controlCardBg:a,rangeInputClass:n,onSliderPointerDown:i,onSliderCommit:s})=>{let c=e?.common,l=t?.common,u=E(r.secondaryColor,.16),d=c?.opacity??.75;return(0,$.jsxs)($.Fragment,{children:[(0,$.jsxs)("div",{className:"rounded-[24px] border p-4 space-y-4",style:{backgroundColor:a,borderColor:u},children:[(0,$.jsx)(X,{label:o("options.disableVisualizerVignette"),description:o("options.disableVisualizerVignetteDesc"),checked:c?.disableVignette??!1,onChange:l?.onDisableVignetteChange,theme:r}),(0,$.jsx)(X,{label:o("options.disableVisualizerGeometricBackground"),description:o("options.disableVisualizerGeometricBackgroundDesc"),checked:c?.disableGeometricBackground??!1,onChange:l?.onDisableGeometricChange,theme:r})]}),(0,$.jsx)("div",{className:"rounded-[24px] border p-4 space-y-4",style:{backgroundColor:a,borderColor:u},children:(0,$.jsxs)("div",{className:"space-y-2",children:[(0,$.jsx)("div",{className:"text-sm font-medium",style:{color:r.primaryColor},children:o("options.previewCoverBackgroundSettings")}),(0,$.jsx)("div",{className:"text-xs opacity-70",style:{color:r.secondaryColor},children:o("options.previewCoverBackgroundSettingsDesc")}),(0,$.jsx)(X,{label:o("theme.addCoverColor"),description:o("options.coverColorBackgroundDesc"),checked:c?.useCoverColorBg??!1,onChange:l?.onCoverColorChange,theme:r}),(0,$.jsxs)("div",{className:"flex items-center justify-between text-sm",style:{color:r.primaryColor},children:[(0,$.jsx)("span",{children:o("options.previewCoverBackgroundOpacity")}),(0,$.jsxs)("span",{className:"font-mono opacity-70",style:{color:r.secondaryColor},children:[Math.round(d*100),"%"]})]}),(0,$.jsx)("input",{type:"range",min:"0",max:"1",step:"0.05",value:d,onChange:p=>l?.onOpacityChange?.(Number(p.target.value)),onPointerDown:i,onPointerUp:s,className:n})]})})]})},en=Wi;var re=S(K(),1);var oe=S(_(),1),We=24,$e=96,Qi=()=>{if(typeof navigator>"u")return!1;let e=navigator.userAgent,t=/iPad|iPhone|iPod/i.test(e)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1,o=/WebKit/i.test(e),r=/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|GSA/i.test(e);return t&&o&&!r},Yi=e=>new Promise(t=>{if(typeof document>"u"){t(null);return}let o=new Image;o.crossOrigin="anonymous",o.decoding="async",o.onload=()=>{try{let r=document.createElement("canvas"),a=document.createElement("canvas");r.width=We,r.height=We,a.width=$e,a.height=$e;let n=r.getContext("2d"),i=a.getContext("2d");if(!n||!i){t(null);return}let s=o.naturalWidth||o.width,c=o.naturalHeight||o.height,l=Math.min(s,c),u=Math.max(0,(s-l)/2),d=Math.max(0,(c-l)/2);n.imageSmoothingEnabled=!0,n.imageSmoothingQuality="high",n.drawImage(o,u,d,l,l,0,0,We,We),i.imageSmoothingEnabled=!0,i.imageSmoothingQuality="high",i.globalAlpha=1,i.drawImage(r,0,0,We,We,0,0,$e,$e),[{x:-8,y:-8,size:$e+16,alpha:.22},{x:6,y:0,size:$e,alpha:.14},{x:0,y:6,size:$e,alpha:.14}].forEach(({x:g,y:f,size:h,alpha:m})=>{i.globalAlpha=m,i.drawImage(r,0,0,We,We,g,f,h,h)}),i.globalAlpha=1,t(a.toDataURL("image/jpeg",.72))}catch(r){console.warn("[FluidBackground] Failed to build soft focus cover",r),t(null)}},o.onerror=()=>t(null),o.src=e}),Xi=384,qi=(e,t)=>new Promise(o=>{if(typeof document>"u"){o(null);return}let r=new Image;r.crossOrigin="anonymous",r.decoding="async",r.onload=()=>{try{let a=r.naturalWidth||r.width,n=r.naturalHeight||r.height;if(!a||!n){o(null);return}let i=Math.min(1,t/Math.max(a,n)),s=Math.max(1,Math.round(a*i)),c=Math.max(1,Math.round(n*i)),l=document.createElement("canvas");l.width=s,l.height=c;let u=l.getContext("2d");if(!u){o(null);return}u.imageSmoothingEnabled=!0,u.imageSmoothingQuality="high",u.drawImage(r,0,0,s,c),o(l.toDataURL("image/jpeg",.82))}catch(a){console.warn("[FluidBackground] Failed to downscale cover",a),o(null)}},r.onerror=()=>o(null),r.src=e}),Ki=(0,re.memo)(({coverUrl:e,theme:t})=>{let o=(0,re.useMemo)(Qi,[]),[r,a]=(0,re.useState)(null);(0,re.useEffect)(()=>{let f=!1;return!o||!e?(a(null),()=>{f=!0}):(a(null),Yi(e).then(h=>{f||a(h)}),()=>{f=!0})},[e,o]);let n=(0,re.useRef)(0),[i,s]=(0,re.useState)([]),[c,l]=(0,re.useState)(()=>new Set);(0,re.useEffect)(()=>{if(o)return;if(!e){s([]);return}let f=!1;return qi(e,Xi).then(h=>{if(f)return;let m=h??e;s(b=>{let y=b[b.length-1];return y&&y.sourceCover===e?b:(n.current+=1,[...y?[y]:[],{url:m,sourceCover:e,key:n.current}])})}),()=>{f=!0}},[e,o]);let u=(0,re.useCallback)(f=>{l(h=>h.has(f)?h:new Set(h).add(f))},[]),d=o?r??e??null:null,p=o&&!!r,g=(0,re.useMemo)(()=>o?{transform:`scale(${p?1.28:1.2}) translateZ(0)`,opacity:p?.94:.3,willChange:"transform, opacity",backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden"}:{filter:"blur(40px)",transform:"scale(1.5) translateZ(0)",opacity:1,willChange:"transform, opacity, filter",backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden"},[o,p]);return(0,oe.jsxs)("div",{className:"absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0",style:{isolation:"isolate",contain:"paint",transform:"translateZ(0)"},children:[e?(0,oe.jsxs)(oe.Fragment,{children:[o?(0,oe.jsx)("img",{src:d??e,alt:"","aria-hidden":"true",draggable:!1,decoding:"async",className:"absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out",style:g}):i.map((f,h)=>{let m=h===i.length-1,b=c.has(f.key);return(0,oe.jsx)(Ce.div,{className:"absolute inset-0 w-full h-full",style:{willChange:"opacity"},initial:{opacity:m?0:1},animate:{opacity:m&&!b?0:1},transition:{duration:1.5,ease:"easeInOut"},onAnimationComplete:()=>{m&&b&&(s(y=>y.filter(A=>A.key===f.key)),l(y=>y.has(f.key)?new Set([f.key]):y))},children:(0,oe.jsx)("img",{src:f.url,alt:"","aria-hidden":"true",draggable:!1,decoding:"async",className:"absolute inset-0 w-full h-full object-cover",style:g,ref:y=>{!y||c.has(f.key)||y.decode().then(()=>requestAnimationFrame(()=>u(f.key))).catch(()=>u(f.key))},onError:()=>{s(y=>y.length>1?y.filter(A=>A.key!==f.key):y)}})},f.key)}),o&&(0,oe.jsxs)(oe.Fragment,{children:[!p&&(0,oe.jsx)("img",{src:e,alt:"","aria-hidden":"true",draggable:!1,decoding:"async",className:"absolute inset-0 w-full h-full object-cover",style:{transform:"scale(1.36) translateZ(0)",opacity:.12,willChange:"transform, opacity",backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden"}}),(0,oe.jsx)("div",{className:"absolute inset-0 w-full h-full",style:{backgroundColor:t.backgroundColor,opacity:.28}}),(0,oe.jsx)("div",{className:"absolute inset-0 w-full h-full",style:{background:`radial-gradient(circle at 20% 20%, ${t.accentColor}55 0%, transparent 42%), radial-gradient(circle at 80% 28%, ${t.secondaryColor}50 0%, transparent 44%), radial-gradient(circle at 50% 78%, ${t.primaryColor}28 0%, transparent 52%)`,opacity:p?.52:.7}})]})]}):(0,oe.jsx)("div",{className:"absolute inset-0 w-full h-full transition-colors duration-1000",style:{backgroundColor:t.backgroundColor,opacity:.8}}),(0,oe.jsx)("div",{className:"absolute inset-0 w-full h-full",style:{background:`linear-gradient(to bottom right, ${t.primaryColor}, transparent, ${t.secondaryColor})`,opacity:o?.2:.4,mixBlendMode:o?"normal":"overlay"}})]})},(e,t)=>{if(e.coverUrl!==t.coverUrl)return!1;let o=e.theme,r=t.theme;return o.backgroundColor===r.backgroundColor&&o.primaryColor===r.primaryColor&&o.secondaryColor===r.secondaryColor}),tn=Ki;var Ct=S(K(),1);var H=S(_(),1),ji=e=>{switch(e.type){case"circle":return"bass";case"square":return"lowMid";case"triangle":return"mid";case"cross":return"treble";case"icon":return"vocal";default:return"default"}},Ji=e=>e==="triangle"?"polygon(50% 0%, 0% 100%, 100% 100%)":e==="cross"?"polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)":"none",on=(e,t)=>{let r=(e.type==="circle"||e.type==="square")&&!e.filled;return{left:`${e.initialX}%`,top:`${e.initialY}%`,width:e.size,height:e.size,border:r?`1px solid ${t.secondaryColor}`:"none",backgroundColor:r?"transparent":t.secondaryColor,borderRadius:e.type==="circle"?"50%":"0%",opacity:e.opacity,clipPath:Ji(e.type)}},rn=({disabled:e=!1})=>e?null:(0,H.jsx)("div",{className:"absolute inset-0 pointer-events-none",style:{background:"radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)"}}),Zi=({theme:e,shapes:t,particles:o,hideShapes:r,disableVignette:a})=>(0,H.jsxs)("div",{className:"absolute inset-0",children:[!r&&(0,H.jsxs)(H.Fragment,{children:[t.map(n=>{if(n.type==="icon"&&n.iconName){let i=uo[n.iconName];if(i)return(0,H.jsx)("div",{className:"absolute flex items-center justify-center",style:{left:`${n.initialX}%`,top:`${n.initialY}%`,width:n.size,height:n.size,color:e.secondaryColor,opacity:n.opacity,transform:`rotate(${n.initialRotation}deg)`},children:(0,H.jsx)(i,{size:n.size,strokeWidth:1,absoluteStrokeWidth:!0})},n.id)}return(0,H.jsx)("div",{className:"absolute",style:{...on(n,e),transform:`rotate(${n.initialRotation}deg)`}},n.id)}),o.map(n=>(0,H.jsx)("div",{className:"absolute rounded-full",style:{backgroundColor:e.accentColor,width:n.size,height:n.size,left:`${n.left}%`,top:`${n.top}%`,opacity:n.opacity}},`p-${n.id}`))]}),(0,H.jsx)(rn,{disabled:a})]}),$i=({theme:e,audioPower:t,audioBands:o,shapes:r,particles:a,hideShapes:n,disableVignette:i})=>{let s=l=>{let d=Vr(l||t,{stiffness:300,damping:30});return Or(d,[10,200],[.95,1.45])},c={bass:s(o?.bass),lowMid:s(o?.lowMid),mid:s(o?.mid),vocal:s(o?.vocal),treble:s(o?.treble),default:s(t)};return(0,H.jsxs)("div",{className:"absolute inset-0",children:[!n&&(0,H.jsxs)(H.Fragment,{children:[r.map(l=>{if(l.type==="icon"&&l.iconName){let u=uo[l.iconName];if(u)return(0,H.jsx)(Ce.div,{className:"absolute flex items-center justify-center",style:{left:`${l.initialX}%`,top:`${l.initialY}%`,width:l.size,height:l.size,color:e.secondaryColor,scale:c.vocal},animate:{y:l.reverse?[-30,30,-30]:[30,-30,30],x:l.reverse?[15,-15,15]:[-15,15,-15],rotate:[l.initialRotation,l.initialRotation+360],opacity:[0,l.opacity*3,0]},transition:{duration:l.duration,repeat:1/0,ease:"linear",delay:l.delay,opacity:{duration:l.duration*.5,repeat:1/0,ease:"easeInOut",delay:l.delay}},children:(0,H.jsx)(u,{size:l.size,strokeWidth:1,absoluteStrokeWidth:!0})},l.id)}return(0,H.jsx)(Ce.div,{className:"absolute",style:{...on(l,e),scale:c[ji(l)]},animate:{y:l.reverse?[-30,30,-30]:[30,-30,30],x:l.reverse?[15,-15,15]:[-15,15,-15],rotate:[l.initialRotation,l.initialRotation+360]},transition:{duration:l.duration,repeat:1/0,ease:"linear",delay:l.delay}},l.id)}),a.map(l=>(0,H.jsx)(Ce.div,{className:"absolute rounded-full",style:{backgroundColor:e.accentColor,width:l.size,height:l.size,left:`${l.left}%`,top:`${l.top}%`,opacity:l.opacity},animate:{y:[0,-100],opacity:[0,l.opacity,0]},transition:{duration:l.duration,repeat:1/0,ease:"linear",delay:l.delay}},`p-${l.id}`))]}),(0,H.jsx)(rn,{disabled:i})]})},es=({theme:e,audioPower:t,audioBands:o,seed:r,hideShapes:a=!1,disableVignette:n=!1,paused:i=!1})=>{let s=(0,Ct.useMemo)(()=>{let l=["circle","square","triangle","cross"],u=e.lyricsIcons||[],d=0;return Array.from({length:15}).map((p,g)=>{let h=u.length>0&&Math.random()>.7&&d<6;h&&(d+=1);let m=h?u[Math.floor(Math.random()*u.length)]:null;return{id:g,type:h?"icon":l[Math.floor(Math.random()*l.length)],iconName:m,initialX:Math.random()*100,initialY:Math.random()*100,size:40+Math.random()*100,duration:h?20+Math.random()*20:30+Math.random()*30,delay:Math.random()*5,opacity:.11+Math.random()*.08,reverse:Math.random()>.5,filled:Math.random()<.3,initialRotation:Math.random()*360}})},[e.lyricsIcons,r]),c=(0,Ct.useMemo)(()=>Array.from({length:20}).map((l,u)=>({id:u,size:Math.random()*4+1,left:Math.random()*100,top:Math.random()*100,opacity:Math.random()*.3,duration:15+Math.random()*20,delay:Math.random()*10})),[r]);return(0,H.jsx)(Ce.div,{className:"absolute inset-0",initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.6,ease:"easeInOut"},children:i?(0,H.jsx)(Zi,{theme:e,shapes:s,particles:c,hideShapes:a,disableVignette:n}):(0,H.jsx)($i,{theme:e,audioPower:t,audioBands:o,shapes:s,particles:c,hideShapes:a,disableVignette:n})})},ts=Ct.default.memo(e=>{let t=String(e.seed??"default");return(0,H.jsx)("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",children:(0,H.jsx)(vt,{mode:"sync",children:(0,H.jsx)(es,{...e},t)})})},(e,t)=>{if(e.seed!==t.seed||e.audioPower!==t.audioPower||e.hideShapes!==t.hideShapes||e.disableVignette!==t.disableVignette||e.paused!==t.paused)return!1;let o=e.audioBands,r=t.audioBands;if(!o!=!r)return!1;let a=!0;if(o&&r&&(a=o.bass===r.bass&&o.lowMid===r.lowMid&&o.mid===r.mid&&o.vocal===r.vocal&&o.treble===r.treble),!a)return!1;let n=e.theme,i=t.theme,s=n.backgroundColor===i.backgroundColor&&n.primaryColor===i.primaryColor&&n.secondaryColor===i.secondaryColor&&n.accentColor===i.accentColor,c=!!(n.lyricsIcons===i.lyricsIcons||n.lyricsIcons?.length===i.lyricsIcons?.length&&n.lyricsIcons?.every((l,u)=>l===i.lyricsIcons?.[u]));return s&&c}),nn=ts;var Ae=S(_(),1),os=_e({mode:"common",order:10,labelKey:"options.visualizerBackgroundModeCommon",labelFallback:"Common",render:({config:e,theme:t,coverUrl:o,audioPower:r,audioBands:a,seed:n,staticMode:i,paused:s})=>{let c=e?.common,l=c?.useCoverColorBg??!1;return(0,Ae.jsxs)(Ae.Fragment,{children:[l&&(0,Ae.jsx)(Ce.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:1},className:"absolute inset-0 z-0",children:(0,Ae.jsx)(tn,{coverUrl:o,theme:t})},"fluid-bg"),(0,Ae.jsx)("div",{className:"absolute inset-0 z-0 transition-all duration-1000",style:{backgroundColor:t.backgroundColor,opacity:l?c?.opacity??.75:1}}),!i&&(0,Ae.jsx)("div",{className:"absolute inset-0 z-0",children:(0,Ae.jsx)(nn,{theme:t,audioPower:r,audioBands:a,seed:n,hideShapes:c?.disableGeometricBackground??!1,disableVignette:c?.disableVignette??!1,paused:s})})]})},renderSettingsPanel:e=>(0,Ae.jsx)(en,{...e}),renderQuickControls:({config:e,actions:t,t:o,theme:r})=>{let a=e?.common?.useCoverColorBg??!1;return(0,Ae.jsx)(Ge,{active:a,theme:r,label:o(a?"theme.addCoverColor":"theme.useDefaultColor"),onToggle:()=>t?.common?.onCoverColorChange?.(!a),children:(0,Ae.jsx)(zr,{size:14})})},resetSettings:e=>{e?.common?.onOpacityChange?.(.75),e?.common?.onCoverColorChange?.(!1),e?.common?.onDisableVignetteChange?.(!1),e?.common?.onDisableGeometricChange?.(!1)}});var Go={};ft(Go,{default:()=>As});var me=S(K(),1);var fe=S(K(),1);var an=`#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_responsiveUV;
out vec2 v_responsiveBoxGivenSize;
out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_imageUV;

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
  vec2 box = vec2(0.);
  // fit = none
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) { // fit = contain
    box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
  } else if (u_fit == 2.) { // fit = cover
    box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);


  // ===================================================

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;

  // ===================================================

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;

  #ifdef ADD_HELPERS
  v_responsiveHelperBox = uv;
  v_responsiveHelperBox *= responsiveBoxScale;
  v_responsiveHelperBox += boxOrigin * (responsiveBoxScale - 1.);
  #endif

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  // ===================================================

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  // x100 is a default multiplier between vertex and fragmant shaders
  // we use it to avoid UV presision issues
  v_patternUV *= .01;

  // ===================================================

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;
}`;var sn=1920*1080*4,_t=class{parentElement;canvasElement;gl;program=null;uniformLocations={};fragmentShader;rafId=null;lastRenderTime=0;currentFrame=0;speed=0;currentSpeed=0;providedUniforms;mipmaps=[];hasBeenDisposed=!1;resolutionChanged=!0;textures=new Map;minPixelRatio;maxPixelCount;isSafari=as();uniformCache={};textureUnitMap=new Map;ownerDocument;constructor(t,o,r,a,n=0,i=0,s=2,c=sn,l=[]){if(t?.nodeType===1)this.parentElement=t;else throw new Error("Paper Shaders: parent element must be an HTMLElement");if(this.ownerDocument=t.ownerDocument,!this.ownerDocument.querySelector("style[data-paper-shader]")){let p=this.ownerDocument.createElement("style");p.innerHTML=ns,p.setAttribute("data-paper-shader",""),this.ownerDocument.head.prepend(p)}let u=this.ownerDocument.createElement("canvas");this.canvasElement=u,this.parentElement.prepend(u),this.fragmentShader=o,this.providedUniforms=r,this.mipmaps=l,this.currentFrame=i,this.minPixelRatio=s,this.maxPixelCount=c;let d=u.getContext("webgl2",a);if(!d)throw new Error("Paper Shaders: WebGL is not supported in this browser");this.gl=d,this.initProgram(),this.setupPositionAttribute(),this.setupUniforms(),this.setUniformValues(this.providedUniforms),this.setupResizeObserver(),visualViewport?.addEventListener("resize",this.handleVisualViewportChange),this.setupIntersectionObserver(),this.setSpeed(n),this.parentElement.setAttribute("data-paper-shader",""),this.parentElement.paperShaderMount=this,this.ownerDocument.addEventListener("visibilitychange",this.handleDocumentVisibilityChange)}initProgram=()=>{let t=rs(this.gl,an,this.fragmentShader);t&&(this.program=t)};setupPositionAttribute=()=>{let t=this.gl.getAttribLocation(this.program,"a_position"),o=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,o);let r=[-1,-1,1,-1,-1,1,-1,1,1,-1,1,1];this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array(r),this.gl.STATIC_DRAW),this.gl.enableVertexAttribArray(t),this.gl.vertexAttribPointer(t,2,this.gl.FLOAT,!1,0,0)};setupUniforms=()=>{let t={u_time:this.gl.getUniformLocation(this.program,"u_time"),u_pixelRatio:this.gl.getUniformLocation(this.program,"u_pixelRatio"),u_resolution:this.gl.getUniformLocation(this.program,"u_resolution")};Object.entries(this.providedUniforms).forEach(([o,r])=>{if(t[o]=this.gl.getUniformLocation(this.program,o),r instanceof HTMLImageElement){let a=`${o}AspectRatio`;t[a]=this.gl.getUniformLocation(this.program,a)}}),this.uniformLocations=t};renderScale=1;parentWidth=0;parentHeight=0;parentDevicePixelWidth=0;parentDevicePixelHeight=0;devicePixelsSupported=!1;intersectionObserver=null;isInViewport=!0;resizeObserver=null;setupResizeObserver=()=>{this.resizeObserver=new ResizeObserver(([t])=>{if(t?.borderBoxSize[0]){let o=t.devicePixelContentBoxSize?.[0];o!==void 0&&(this.devicePixelsSupported=!0,this.parentDevicePixelWidth=o.inlineSize,this.parentDevicePixelHeight=o.blockSize),this.parentWidth=t.borderBoxSize[0].inlineSize,this.parentHeight=t.borderBoxSize[0].blockSize}this.handleResize()}),this.resizeObserver.observe(this.parentElement)};setupIntersectionObserver=()=>{let t=this.ownerDocument.defaultView;t?.IntersectionObserver&&(this.intersectionObserver=new t.IntersectionObserver(([o])=>{this.isInViewport=o?.isIntersecting??!0,this.updateCurrentSpeed()}),this.intersectionObserver.observe(this.parentElement))};handleVisualViewportChange=()=>{this.resizeObserver?.disconnect(),this.setupResizeObserver()};handleResize=()=>{let t=0,o=0,r=Math.max(1,window.devicePixelRatio),a=visualViewport?.scale??1;if(this.devicePixelsSupported){let u=Math.max(1,this.minPixelRatio/r);t=this.parentDevicePixelWidth*u*a,o=this.parentDevicePixelHeight*u*a}else{let u=Math.max(r,this.minPixelRatio)*a;if(this.isSafari){let d=is(this.ownerDocument);u*=Math.max(1,d)}t=Math.round(this.parentWidth)*u,o=Math.round(this.parentHeight)*u}let n=Math.sqrt(this.maxPixelCount)/Math.sqrt(t*o),i=Math.min(1,n),s=Math.round(t*i),c=Math.round(o*i),l=s/Math.round(this.parentWidth);(this.canvasElement.width!==s||this.canvasElement.height!==c||this.renderScale!==l)&&(this.renderScale=l,this.canvasElement.width=s,this.canvasElement.height=c,this.resolutionChanged=!0,this.gl.viewport(0,0,this.gl.canvas.width,this.gl.canvas.height),this.render(performance.now()))};render=t=>{if(this.hasBeenDisposed)return;if(this.program===null){console.warn("Tried to render before program or gl was initialized");return}let o=t-this.lastRenderTime;this.lastRenderTime=t,this.currentSpeed!==0&&(this.currentFrame+=o*this.currentSpeed),this.gl.clear(this.gl.COLOR_BUFFER_BIT),this.gl.useProgram(this.program),this.gl.uniform1f(this.uniformLocations.u_time,this.currentFrame*.001),this.resolutionChanged&&(this.gl.uniform2f(this.uniformLocations.u_resolution,this.gl.canvas.width,this.gl.canvas.height),this.gl.uniform1f(this.uniformLocations.u_pixelRatio,this.renderScale),this.resolutionChanged=!1),this.gl.drawArrays(this.gl.TRIANGLES,0,6),this.currentSpeed!==0?this.requestRender():this.rafId=null};requestRender=()=>{this.rafId!==null&&cancelAnimationFrame(this.rafId),this.rafId=requestAnimationFrame(this.render)};setTextureUniform=(t,o)=>{if(!o.complete||o.naturalWidth===0)throw new Error(`Paper Shaders: image for uniform ${t} must be fully loaded`);let r=this.textures.get(t);r&&this.gl.deleteTexture(r),this.textureUnitMap.has(t)||this.textureUnitMap.set(t,this.textureUnitMap.size);let a=this.textureUnitMap.get(t);this.gl.activeTexture(this.gl.TEXTURE0+a);let n=this.gl.createTexture();this.gl.bindTexture(this.gl.TEXTURE_2D,n),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,o),this.mipmaps.includes(t)&&(this.gl.generateMipmap(this.gl.TEXTURE_2D),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR_MIPMAP_LINEAR));let i=this.gl.getError();if(i!==this.gl.NO_ERROR||n===null){console.error("Paper Shaders: WebGL error when uploading texture:",i);return}this.textures.set(t,n);let s=this.uniformLocations[t];if(s){this.gl.uniform1i(s,a);let c=`${t}AspectRatio`,l=this.uniformLocations[c];if(l){let u=o.naturalWidth/o.naturalHeight;this.gl.uniform1f(l,u)}}};areUniformValuesEqual=(t,o)=>t===o?!0:Array.isArray(t)&&Array.isArray(o)&&t.length===o.length?t.every((r,a)=>this.areUniformValuesEqual(r,o[a])):!1;setUniformValues=t=>{this.gl.useProgram(this.program),Object.entries(t).forEach(([o,r])=>{let a=r;if(r instanceof HTMLImageElement&&(a=`${r.src.slice(0,200)}|${r.naturalWidth}x${r.naturalHeight}`),this.areUniformValuesEqual(this.uniformCache[o],a))return;this.uniformCache[o]=a;let n=this.uniformLocations[o];if(!n){console.warn(`Uniform location for ${o} not found`);return}if(r instanceof HTMLImageElement)this.setTextureUniform(o,r);else if(Array.isArray(r)){let i=null,s=null;if(r[0]!==void 0&&Array.isArray(r[0])){let c=r[0].length;if(r.every(l=>l.length===c))i=r.flat(),s=c;else{console.warn(`All child arrays must be the same length for ${o}`);return}}else i=r,s=i.length;switch(s){case 2:this.gl.uniform2fv(n,i);break;case 3:this.gl.uniform3fv(n,i);break;case 4:this.gl.uniform4fv(n,i);break;case 9:this.gl.uniformMatrix3fv(n,!1,i);break;case 16:this.gl.uniformMatrix4fv(n,!1,i);break;default:console.warn(`Unsupported uniform array length: ${s}`)}}else typeof r=="number"?this.gl.uniform1f(n,r):typeof r=="boolean"?this.gl.uniform1i(n,r?1:0):console.warn(`Unsupported uniform type for ${o}: ${typeof r}`)})};getCurrentFrame=()=>this.currentFrame;setFrame=t=>{this.currentFrame=t,this.lastRenderTime=performance.now(),this.render(performance.now())};setSpeed=(t=1)=>{this.speed=t,this.updateCurrentSpeed()};updateCurrentSpeed=()=>{this.setCurrentSpeed(this.ownerDocument.hidden||!this.isInViewport?0:this.speed)};setCurrentSpeed=t=>{this.currentSpeed=t,this.rafId===null&&t!==0&&(this.lastRenderTime=performance.now(),this.rafId=requestAnimationFrame(this.render)),this.rafId!==null&&t===0&&(cancelAnimationFrame(this.rafId),this.rafId=null)};setMaxPixelCount=(t=sn)=>{this.maxPixelCount=t,this.handleResize()};setMinPixelRatio=(t=2)=>{this.minPixelRatio=t,this.handleResize()};setUniforms=t=>{this.setUniformValues(t),this.providedUniforms={...this.providedUniforms,...t},this.render(performance.now())};handleDocumentVisibilityChange=()=>{this.updateCurrentSpeed()};dispose=()=>{this.hasBeenDisposed=!0,this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),this.gl&&this.program&&(this.textures.forEach(t=>{this.gl.deleteTexture(t)}),this.textures.clear(),this.gl.deleteProgram(this.program),this.program=null,this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,null),this.gl.bindRenderbuffer(this.gl.RENDERBUFFER,null),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null),this.gl.getError()),this.resizeObserver&&(this.resizeObserver.disconnect(),this.resizeObserver=null),this.intersectionObserver&&(this.intersectionObserver.disconnect(),this.intersectionObserver=null),visualViewport?.removeEventListener("resize",this.handleVisualViewportChange),this.ownerDocument.removeEventListener("visibilitychange",this.handleDocumentVisibilityChange),this.uniformLocations={},this.canvasElement.remove(),delete this.parentElement.paperShaderMount}};function ln(e,t,o){let r=e.createShader(t);return r?(e.shaderSource(r,o),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.error("An error occurred compiling the shaders: "+e.getShaderInfoLog(r)),e.deleteShader(r),null)):null}function rs(e,t,o){let r=e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT),a=r?r.precision:null;a&&a<23&&(t=t.replace(/precision\s+(lowp|mediump)\s+float;/g,"precision highp float;"),o=o.replace(/precision\s+(lowp|mediump)\s+float/g,"precision highp float").replace(/\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g,"$1 highp $3"));let n=ln(e,e.VERTEX_SHADER,t),i=ln(e,e.FRAGMENT_SHADER,o);if(!n||!i)return null;let s=e.createProgram();return s?(e.attachShader(s,n),e.attachShader(s,i),e.linkProgram(s),e.getProgramParameter(s,e.LINK_STATUS)?(e.detachShader(s,n),e.detachShader(s,i),e.deleteShader(n),e.deleteShader(i),s):(console.error("Unable to initialize the shader program: "+e.getProgramInfoLog(s)),e.deleteProgram(s),e.deleteShader(n),e.deleteShader(i),null)):null}var ns=`@layer paper-shaders {
  :where([data-paper-shader]) {
    isolation: isolate;
    position: relative;

    & canvas {
      contain: strict;
      display: block;
      position: absolute;
      inset: 0;
      z-index: -1;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      corner-shape: inherit;
    }
  }
}`;function as(){let e=navigator.userAgent.toLowerCase();return e.includes("safari")&&!e.includes("chrome")&&!e.includes("android")}function is(e){let t=visualViewport?.scale??1,o=visualViewport?.width??window.innerWidth,r=window.innerWidth-e.documentElement.clientWidth,a=t*o+r,n=outerWidth/a,i=Math.round(100*n);return i%5===0?i/100:i===33?1/3:i===67?2/3:i===133?4/3:n}var N={fit:"contain",scale:1,rotation:0,offsetX:0,offsetY:0,originX:.5,originY:.5,worldWidth:0,worldHeight:0},Et={fit:"none",scale:1,rotation:0,offsetX:0,offsetY:0,originX:.5,originY:.5,worldWidth:0,worldHeight:0},ue={none:0,contain:1,cover:2};var xe=`
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
`,Qe=`
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
`,cn=`
  float hash11(float p) {
    p = fract(p * 0.3183099) + 0.1;
    p *= p + 19.19;
    return fract(p * p);
  }
`,be=`
  float hash21(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
`,un=`
  vec2 hash22(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
    p += dot(p, p.yx + 19.19);
    return fract(vec2(p.x * p.y, p.x + p.y));
  }
`;var fn=`
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;var xo={maxColorCount:10},bo=`#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colors[${xo.maxColorCount}];
uniform float u_colorsCount;

uniform float u_distortion;
uniform float u_swirl;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_objectUV;
out vec4 fragColor;

${xe}
${Qe}
${be}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float noise(vec2 n, vec2 seedOffset) {
  return valueNoise(n + seedOffset);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * .37;
  float b = .6 + fract(float(i) / 3.) * .9;
  float c = .8 + fract(float(i + 1) / 4.);

  float x = sin(t * b + a);
  float y = cos(t * c + a * 1.5);

  return .5 + .5 * vec2(x, y);
}

void main() {
  vec2 uv = v_objectUV;
  uv += .5;
  vec2 grainUV = uv * 1000.;

  float mixerGrain = 0.;
  if (u_grainMixer > 0.) {
    mixerGrain = .4 * u_grainMixer * (noise(grainUV, vec2(0.)) - .5);
  }

  const float firstFrameOffset = 41.5;
  float t = .5 * (u_time + firstFrameOffset);

  float radius = smoothstep(0., 1., length(uv - .5));
  float center = 1. - radius;
  for (float i = 1.; i <= 2.; i++) {
    uv.x += u_distortion * center / i * sin(t + i * .4 * smoothstep(.0, 1., uv.y)) * cos(.2 * t + i * 2.4 * smoothstep(.0, 1., uv.y));
    uv.y += u_distortion * center / i * cos(t + i * 2. * smoothstep(.0, 1., uv.x));
  }

  vec2 uvRotated = uv;
  uvRotated -= vec2(.5);
  float angle = 3. * u_swirl * radius;
  uvRotated = rotate(uvRotated, -angle);
  uvRotated += vec2(.5);

  vec3 color = vec3(0.);
  float opacity = 0.;
  float totalWeight = 0.;

  for (int i = 0; i < ${xo.maxColorCount}; i++) {
    if (i >= int(u_colorsCount)) break;

    vec2 pos = getPosition(i, t) + mixerGrain;
    vec3 colorFraction = u_colors[i].rgb * u_colors[i].a;
    float opacityFraction = u_colors[i].a;

    float dist = length(uvRotated - pos);

    dist = pow(dist, 3.5);
    float weight = 1. / (dist + 1e-3);
    color += colorFraction * weight;
    opacity += opacityFraction * weight;
    totalWeight += weight;
  }

  color /= max(1e-4, totalWeight);
  opacity /= max(1e-4, totalWeight);

  if (u_grainOverlay > 0.) {
    float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grainOverlay = pow(grainOverlay, 1.3);

    float grainOverlayV = grainOverlay * 2. - 1.;
    vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
    float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
    grainOverlayStrength = pow(grainOverlayStrength, .8);
    color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

    opacity += .5 * grainOverlayStrength;
  }
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`;var yo=`#version 300 es
precision mediump float;

uniform float u_time;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform float u_pxSize;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_type;

out vec4 fragColor;

${fn}
${xe}
${cn}
${be}

float getSimplexNoise(vec2 uv, float t) {
  float noise = .5 * snoise(uv - vec2(0., .3 * t));
  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));

  return noise;
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}


void main() {
  float t = .5 * u_time;

  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec2 shapeUV = normalizedUV;

  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 boxSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  
  if (u_shape > 3.5) {
    vec2 objectBoxSize = vec2(0.);
    // fit = none
    objectBoxSize.x = min(boxSize.x, boxSize.y);
    if (u_fit == 1.) { // fit = contain
      objectBoxSize.x = min(u_resolution.x, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      objectBoxSize.x = max(u_resolution.x, u_resolution.y);
    }
    objectBoxSize.y = objectBoxSize.x;
    vec2 objectWorldScale = u_resolution.xy / objectBoxSize;

    shapeUV *= objectWorldScale;
    shapeUV += boxOrigin * (objectWorldScale - 1.);
    shapeUV += vec2(-u_offsetX, u_offsetY);
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
  } else {
    vec2 patternBoxSize = vec2(0.);
    // fit = none
    patternBoxSize.x = patternBoxRatio * min(boxSize.x / patternBoxRatio, boxSize.y);
    float patternWorldNoFitBoxWidth = patternBoxSize.x;
    if (u_fit == 1.) { // fit = contain
      patternBoxSize.x = patternBoxRatio * min(u_resolution.x / patternBoxRatio, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      patternBoxSize.x = patternBoxRatio * max(u_resolution.x / patternBoxRatio, u_resolution.y);
    }
    patternBoxSize.y = patternBoxSize.x / patternBoxRatio;
    vec2 patternWorldScale = u_resolution.xy / patternBoxSize;

    shapeUV += vec2(-u_offsetX, u_offsetY) / patternWorldScale;
    shapeUV += boxOrigin;
    shapeUV -= boxOrigin / patternWorldScale;
    shapeUV *= u_resolution.xy;
    shapeUV /= u_pixelRatio;
    if (u_fit > 0.) {
      shapeUV *= (patternWorldNoFitBoxWidth / patternBoxSize.x);
    }
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
    shapeUV += boxOrigin / patternWorldScale;
    shapeUV -= boxOrigin;
    shapeUV += .5;
  }

  float shape = 0.;
  if (u_shape < 1.5) {
    // Simplex noise
    shapeUV *= .001;

    shape = 0.5 + 0.5 * getSimplexNoise(shapeUV, t);
    shape = smoothstep(0.3, 0.9, shape);

  } else if (u_shape < 2.5) {
    // Warp
    shapeUV *= .003;

    for (float i = 1.0; i < 6.0; i++) {
      shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
      shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
    }

    shape = .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
    shape = smoothstep(0.02, 1., shape);

  } else if (u_shape < 3.5) {
    // Dots
    shapeUV *= .05;

    float stripeIdx = floor(2. * shapeUV.x / TWO_PI);
    float rand = hash11(stripeIdx * 10.);
    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
    shape = sin(shapeUV.x) * cos(shapeUV.y - 5. * rand * t);
    shape = pow(abs(shape), 6.);

  } else if (u_shape < 4.5) {
    // Sine wave
    shapeUV *= 4.;

    float wave = cos(.5 * shapeUV.x - 2. * t) * sin(1.5 * shapeUV.x + t) * (.75 + .25 * cos(3. * t));
    shape = 1. - smoothstep(-1., 1., shapeUV.y + wave);

  } else if (u_shape < 5.5) {
    // Ripple

    float dist = length(shapeUV);
    float waves = sin(pow(dist, 1.7) * 7. - 3. * t) * .5 + .5;
    shape = waves;

  } else if (u_shape < 6.5) {
    // Swirl

    float l = length(shapeUV);
    float angle = 6. * atan(shapeUV.y, shapeUV.x) + 4. * t;
    float twist = 1.2;
    float offset = 1. / pow(max(l, 1e-6), twist) + angle / TWO_PI;
    float mid = smoothstep(0., 1., pow(l, twist));
    shape = mix(0., fract(offset), mid);

  } else {
    // Sphere
    shapeUV *= 2.;

    float d = 1. - pow(length(shapeUV), 2.);
    vec3 pos = vec3(shapeUV, sqrt(max(0., d)));
    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
    shape = .5 + .5 * dot(lightPos, pos);
    shape *= step(0., d);
  }


  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), shape);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  dithering -= .5;
  float res = step(.5, shape + dithering);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  fragColor = vec4(color, opacity);
}
`,vo={simplex:1,warp:2,dots:3,wave:4,ripple:5,swirl:6,sphere:7},Bt={random:1,"2x2":2,"4x4":3,"8x8":4};var Vt={maxCrumpleCount:15},So=`#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform bool u_isImage;
uniform float u_imageAspectRatio;

uniform vec4 u_colorBack;
uniform vec4 u_colorPaper;
uniform vec4 u_colorShadow;

uniform float u_blending;
uniform float u_distortion;
uniform bool u_clip;
uniform float u_angle;
uniform float u_seed;

uniform float u_roughness;
uniform float u_roughnessSize;
uniform float u_roughnessRows;
uniform float u_fiber;
uniform float u_fiberSize;
uniform float u_folds;
uniform float u_foldSizeX;
uniform float u_foldSizeY;
uniform float u_foldOffsetX;
uniform float u_foldOffsetY;
uniform float u_wrinkles;
uniform float u_wrinkleSize;
uniform float u_crumples;
uniform float u_crumpleCount;
uniform float u_drops;

uniform sampler2D u_noiseTexture;

in vec2 v_imageUV;
out vec4 fragColor;

float getUvFrame(vec2 uv) {
  vec2 invAA = .5 / clamp(fwidth(uv), 1e-5, .02);
  vec2 lo = clamp(uv * invAA + .5, 0., 1.);
  vec2 hi = clamp((1. - uv) * invAA + .5, 0., 1.);
  return lo.x * hi.x * lo.y * hi.y;
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

${xe}
${be}
${un}

float getRoughness(vec2 p, vec2 lightDir, vec2 seedShift, float basePixel) {
  vec2 u = p / vec2(2, 4);
  float w = 100. * basePixel;
  float eps = 4. * w;

  float size = mix(3.2, .8, u_roughnessSize);
  float logLac = log2(2.1);
  float level = -log2(w + 1e-8) / logLac;
  float baseLevel = floor(level) - 2.;
  float fade = fract(level);

  vec2 px = (u.x + vec2(eps, -eps)) * .1;
  float py = u.y * .1;

  vec2 sum = vec2(0.);
  float norm = 0., amp = .5;
  float freq = exp2(baseLevel * logLac);
  for (int i = 0; i < 4; i++) {
    float absIdx = baseLevel + float(i);
    vec2 qx = size * px * freq;
    float qy = size * py * freq;

    float wi = 1.;
    if (i == 0) wi = 1. - fade;
    if (i == 3) wi = fade;

    vec2 fx = fract(qx);
    float fy = fract(qy);
    vec2 shift = .5 + absIdx * .3 + seedShift;
    float uvY = floor(qy) / 50. + shift.y;
    vec2 s0a = textureLod(u_noiseTexture, fract(vec2(floor(qx.x) / 50. + shift.x, uvY)), 0.).rg;
    vec2 s1a = textureLod(u_noiseTexture, fract(vec2( ceil(qx.x) / 50. + shift.x, uvY)), 0.).rg;
    vec2 s0b = textureLod(u_noiseTexture, fract(vec2(floor(qx.y) / 50. + shift.x, uvY)), 0.).rg;
    vec2 s1b = textureLod(u_noiseTexture, fract(vec2( ceil(qx.y) / 50. + shift.x, uvY)), 0.).rg;
    vec2 ny0 = mix(vec2(s0a.r, s0b.r), vec2(s0a.g, s0b.g), fy);
    vec2 ny1 = mix(vec2(s1a.r, s1b.r), vec2(s1a.g, s1b.g), fy);
    vec2 n = mix(ny0, ny1, fx);

    sum += amp * wi * n;
    norm += amp * wi;
    amp *= .8;
    freq *= 2.1;
  }

  vec2 r = sum / norm;
  float dx = .5 + r.x - r.y;
  float grain = 3. * dx * dx - .7;

  float rowBand = fract(dot(p, lightDir) * .05 * size);
  return grain + .6 * u_roughnessRows * (rowBand - .5);
}

float getFiber(vec2 p, vec2 seedShift, float basePixel) {
  float size = mix(4., 1., u_fiberSize);
  float w = 50. * basePixel;
  float level = -log2(w + 1e-8);
  float baseLevel = floor(level) - 3.;
  float fade = fract(level);

  vec2 grad = vec2(0.);
  float scale = 1.;
  float amp = 1.;
  float freq = pow(1.7, baseLevel);
  for (int i = 0; i < 5; i++) {
    float absIdx = baseLevel + float(i);
    vec2 q = size * p * freq;

    float an = absIdx * .8;
    float rc = cos(an), rs = sin(an);
    q = vec2(rc * q.x - rs * q.y, rs * q.x + rc * q.y);

    float wi = 1.;
    if (i == 0) wi = 1. - fade;
    if (i == 4) wi = fade;

    vec2 iq = floor(q);
    vec2 fq = fract(q);
    float shift = absIdx * .3;
    vec4 uv = fract(vec4(iq, iq + 1.) / 50. + .5 + shift + seedShift.xyxy);
    float aF = textureLod(u_noiseTexture, uv.xy, 0.).b;
    float bF = textureLod(u_noiseTexture, uv.zy, 0.).b;
    float cF = textureLod(u_noiseTexture, uv.xw, 0.).b;
    float dF = textureLod(u_noiseTexture, uv.zw, 0.).b;
    vec2 u = fq * fq * (3. - 2. * fq);
    vec2 du = 8. * fq * (1. - fq);
    float dx = du.x * mix(bF - aF, dF - cF, u.y);
    float dy = du.y * mix(cF - aF, dF - bF, u.x);
    grad += wi * amp * scale * vec2(rc * dx + rs * dy, -rs * dx + rc * dy);
    scale *= 1.7;
    amp *= .5;
    freq *= 1.7;
  }

  return clamp(.333 * length(grad), 0., 1.);
}

vec2 smoothNoise(vec2 p) {
  vec2 t = p * 50. - .5;
  vec2 i = floor(t);
  vec2 f = fract(t);
  f = f * f * (3. - 2. * f);
  return textureLod(u_noiseTexture, fract((i + f + .5) / vec2(50.)), 0.).rg;
}

float getDrops(vec2 uv, vec2 seedShift) {
  vec2 iDropsUV = floor(uv);
  vec2 fDropsUV = fract(uv);
  float dropsMinDist = 1.;
  for (int y = -1; y < 2; y += 1) {
    for (int x = -1; x < 2; x += 1) {
      vec2 neighbor = vec2(float(y), float(x));
      vec2 offset = hash22(iDropsUV + neighbor + 50. * seedShift);
      vec2 pos = neighbor + offset - fDropsUV;
      dropsMinDist *= min(1., dot(pos, pos));
    }
  }
  return .5 * lst(.09, .08, sqrt(sqrt(dropsMinDist)));
}

vec2 getCellTilt(float idx, float radius) {
  vec2 rand = hash22(vec2(idx + 31., idx * u_seed + 17.));
  float an = rand.x * TWO_PI;
  return vec2(cos(an), sin(an)) * mix(.3, 1.7, rand.y * rand.y) * mix(.7, 1., radius);
}

vec2 getCrumpleDetail(vec2 uv, float freq, float shift, float basePixel, out float depth) {
  depth = 0.;
  vec2 v = uv * freq;
  float pixel = .9 * freq * basePixel;
  vec2 base = floor(v);
  float n1 = 9., n2 = 9.;
  vec2 s1 = vec2(0.), s2 = vec2(0.), q1 = vec2(0.), q2 = vec2(0.);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = base + vec2(float(x), float(y));
      vec2 q = hash22(vec2(cell.y * 1.9 + 3.1 + shift, cell.x * 1.3 + .11 * u_seed));
      float keep = .8;
      if (q.y > keep) continue;

      vec2 r = hash22(vec2(cell.x + .37 * u_seed + shift + 11.1, cell.y - .21 * u_seed + 5.7));
      vec2 s = cell + .06 + .88 * r;

      vec2 d = v - s;
      float dsq = dot(d, d);
      if (dsq < n1) {
        n2 = n1;
        s2 = s1;
        q2 = q1;
        n1 = dsq;
        s1 = s;
        q1 = q;
      } else if (dsq < n2) {
        n2 = dsq;
        s2 = s;
        q2 = q;
      }
    }
  }

  if (n1 > 8.) return vec2(0.);

  float an1 = q1.x * TWO_PI, mag1 = q1.y / .8;
  vec2 t1 = vec2(cos(an1), sin(an1)) * mix(.3, 1.7, mag1 * mag1);
  float an2 = q2.x * TWO_PI, mag2 = q2.y / .8;
  vec2 t2 = vec2(cos(an2), sin(an2)) * mix(.3, 1.7, mag2 * mag2);

  vec2 span = s1 - s2;
  float spanLen = max(length(span), 1e-4);
  float toEdge = (n2 - n1) / (2. * spanLen);

  float pair = hash21(s1 + s2 + 1.7 * abs(s1 - s2));
  float pairSoft = .05 + .1 * step(pair, .4);
  float b = clamp(toEdge / max(1.5 * pixel, .5 * pairSoft), 0., 1.);
  b = b * b * (3. - 2. * b);
  float d1 = max(sqrt(n1), 1e-4);
  depth = .2 * d1;
  float shoulderAmt = max(0., 1. - toEdge / .42) * b;
  vec2 shoulder = vec2(0.);
  if (shoulderAmt > 0.) {
    float d2 = max(sqrt(n2), 1e-4);
    shoulder = shoulderAmt * ((v - s2) / d2 - (v - s1) / d1);
  }

  vec2 mid = .5 * (t1 + t2);
  return mid + (t1 - mid) * b + .9 * shoulder;
}

vec4 getCrumples(vec2 uv) {
  float crumpleN = max(2., floor(u_crumpleCount + .5));
  float near = 60000., nearB = 60000.;
  float idx = 0., rad = 0.;
  vec2 nearP = vec2(0.), nearPb = vec2(0.);
  vec4 seeds[${Vt.maxCrumpleCount}];
  for (int i = 0; i < ${Vt.maxCrumpleCount}; i++) {
    if (float(i) >= crumpleN) break;
    vec2 rand = hash22(vec2(float(i), float(i) * u_seed));
    float an = rand.x * TWO_PI;
    vec2 p = vec2(cos(an), sin(an)) * rand.y;
    seeds[i] = vec4(p, rand);

    vec2 d = uv - p;
    float dsq = dot(d, d);
    if (dsq < near) {
      nearB = near;
      nearPb = nearP;
      near = dsq;
      idx = float(i);
      rad = rand.y;
      nearP = p;
    } else if (dsq < nearB) {
      nearB = dsq;
      nearPb = p;
    }
  }
  float l = sqrt(near), lb = sqrt(nearB);
  vec2 dir = (uv - nearP) / max(l, 1e-4);
  float edge = lst(0., .5, lb - l);

  float shoulderLimit = l + .5;

  vec2 tilt = getCellTilt(idx, rad);
  float tiltSum = 1.;
  vec2 wide = vec2(0.);
  float wideSum = 0.;
  float toEdge = 9., edgeSoft = 0.;

  for (int i = 0; i < ${Vt.maxCrumpleCount}; i++) {
    if (float(i) >= crumpleN) break;
    if (float(i) == idx) continue;
    vec4 seed = seeds[i];
    vec2 p = seed.xy;
    vec2 rand = seed.zw;

    vec2 d = uv - p;
    float dsq = dot(d, d);

    if (dsq < shoulderLimit * shoulderLimit) {
      float di = sqrt(dsq);
      float shoulder = lst(.5, 0., di - l);
      wide += shoulder * (d / max(di, 1e-4) - dir);
      wideSum += shoulder;
    }

    float pairSoft = .01 + .05 * step(.2, rand.x) + .3 * rand.y;
    float toBisector = (dsq - near) / (.2 * max(length(p - nearP), 1e-4));
    if (toBisector < toEdge) {
      toEdge = toBisector;
      edgeSoft = pairSoft;
    }

    float w = 1. - toBisector / pairSoft;
    if (w > 0.) {
      w *= w;
      tilt += w * getCellTilt(float(i), rand.y);
      tiltSum += w;
    }
  }

  float blend = clamp(toEdge / edgeSoft, 0., 1.);
  vec2 sharp = (1. - edge) * ((uv - nearPb) / max(lb, 1e-4) - dir);
  vec2 rounding = mix(sharp, wide / max(wideSum, 1.), min(2. * edgeSoft, 1.));
  float radial = l / max(l + toEdge, 1e-4);

  return vec4(tilt / tiltSum + rounding * blend * radial, .2 * l, edge);
}

void getFolds(vec2 coord, vec2 offset, vec2 count, vec2 noise, vec2 baseFwidth, out vec2 slope, out vec2 dark, out vec2 lift) {
  vec2 g = coord * count + .5 * offset + noise;
  vec2 dx = fract(g) - .5;
  vec2 adx = abs(dx);
  float foldRadius = .3;
  vec2 t = clamp(adx / foldRadius, 0., 1.);
  dark = t * t * (3. - 2. * t);
  lift = 1. - t;
  lift *= lift;

  vec2 crease = clamp(dx / max(count * baseFwidth, 1e-5), -1., 1.);
  slope = crease * (1. - dark);

  vec2 lineWidth = .02 * count * mix(vec2(2.5), vec2(.8), dark.yx) + .1 * noise;
  slope -= 1. - smoothstep(vec2(0.), lineWidth, adx);
}

void main() {

  vec2 patternUV = (v_imageUV - .5) * vec2(u_imageAspectRatio, 1.);
  float basePixel = max(length(dFdx(patternUV)), length(dFdy(patternUV)));
  vec2 baseFwidth = fwidth(patternUV);

  float pattern = 0.;

  float crumpleDepth = 0.;
  float wrinkleDepth = 0.;
  float foldDepth = 0.;
  float roughness = 0.;
  float fiber = 0.;
  float drops = 0.;

  float grazing = 0.7;
  float lightRad = radians(u_angle);
  vec2 lightDir = vec2(sin(lightRad), -cos(lightRad));
  float foldAngleInSector = mod(u_angle, 90.);
  float foldLightRad = radians(u_angle - foldAngleInSector + mix(12., 78., foldAngleInSector / 90.));
  vec2 foldLightDir = vec2(sin(foldLightRad), -cos(foldLightRad));
  vec2 relief = vec2(0.);
  vec2 foldSlope = vec2(0.);
  float reliefAmount = 0.;
  float foldInk = 1.;
  vec2 crumpleFlow = vec2(0.);

  vec2 warpNoise = vec2(0.);
  if (u_crumples > 0. || u_folds > 0. || u_wrinkles > 0.) {
    warpNoise = smoothNoise(patternUV * .1 + .2 + .6 * fract(.017 * u_seed)) - .5;
  }
  vec2 crumplesUV = (patternUV * .9) + .012 * warpNoise;

  if (u_crumples > 0.) {
    vec4 crumples = getCrumples(crumplesUV);

    vec2 crumpleTilt = .5 * u_crumples * crumples.xy;
    crumpleTilt -= .1 * max(dot(crumpleTilt, lightDir), 0.) * lightDir;
    relief += crumpleTilt;
    reliefAmount += .6 * u_crumples;
    crumpleFlow = crumples.w * crumpleTilt;

    crumpleDepth = clamp(5. * crumples.z, 0., 1.);
  }

  if (u_wrinkles > 0.) {
    float detailFreq = mix(10., 1., u_wrinkleSize);
    float detailAmp = .2;
    vec2 detailGrad = vec2(0.);
    float detailDepth = 0., depthSum = 0.;
    for (int i = 0; i < 3; i++) {
      float layerDepth;
      detailGrad += detailAmp * getCrumpleDetail(crumplesUV, detailFreq, 31. * float(i), basePixel, layerDepth);
      detailDepth += detailAmp * layerDepth;
      depthSum += detailAmp;
      detailAmp *= (.5 + .2 * detailGrad.x);
      detailFreq *= 2.1;
    }

    vec2 detailTilt = 1.5 * u_wrinkles * detailGrad;
    detailTilt -= .65 * max(dot(detailTilt, lightDir), 0.) * lightDir;
    relief += detailTilt;
    reliefAmount += .6 * u_wrinkles;

    wrinkleDepth = clamp(5. * detailDepth / max(depthSum, 1e-4), 0., 1.);
  }

  if (u_folds > 0.) {
    vec2 foldOffset = vec2(1. - 2. * u_foldOffsetX, 1. - 2. * u_foldOffsetY);
    vec2 foldCount = vec2(mix(3., .5, u_foldSizeX), mix(3., .5, u_foldSizeY));
    vec2 foldNoise = .005 * warpNoise * foldCount;
    vec2 uv = patternUV + .03 * crumpleFlow;

    vec2 slope, dark, lift;
    getFolds(uv, foldOffset, foldCount, foldNoise, baseFwidth, slope, dark, lift);

    foldSlope = u_folds * slope;
    reliefAmount += 1. * u_folds;
    vec2 ink = mix(vec2(.96), vec2(1.), dark);
    float flatness = dark.x * dark.y;
    foldInk *= mix(1., ink.x * ink.y * mix(.5, .3, flatness), u_folds);

    foldDepth = u_folds * (lift.y * foldLightDir.y - lift.x * foldLightDir.x);
  }

  float unlit = cos(grazing);
  float lit = unlit;

  if (reliefAmount > 0.) {
    float lightFalloff = clamp(.5 + dot(v_imageUV - .5, lightDir), 0., 1.);
    float lightPower = mix(.5, 1., lightFalloff);
    float slope = clamp(dot(relief, lightDir) + dot(foldSlope, foldLightDir), -1.2, 1.2);
    lit = max(cos(slope + grazing), 0.);

    pattern += (clamp(reliefAmount, 0., 1.) * unlit + (lit - unlit)) * foldInk * lightPower;
  }

  patternUV += .04 * crumpleFlow;

  vec2 seedShift = floor(fract(u_seed * vec2(.7548776662, .5698402909)) * 50.) / 50.;

  if (u_roughness > 0.) {
    roughness = u_roughness * getRoughness(1000. * patternUV, lightDir, seedShift, basePixel);
    pattern += roughness;
  }

  if (u_fiber > 0.) {
    fiber = u_fiber * getFiber(50. * patternUV, seedShift, basePixel);
    pattern += fiber;
  }

  if (u_drops > 0.) {
    drops = u_drops * getDrops(patternUV * 10., seedShift);
  }

  pattern = clamp(pattern, 0., 1.);

  vec3 backColor = u_colorBack.rgb * u_colorBack.a;
  float backOpacity = u_colorBack.a;
  vec3 baseColor = u_colorPaper.rgb * u_colorPaper.a;
  float baseOpacity = u_colorPaper.a;
  vec3 shadowColor = u_colorShadow.rgb * u_colorShadow.a;
  float shadowOpacity = u_colorShadow.a;

  float notClipped = u_clip ? .1 : 1.;
  vec2 imageCenteredUV = v_imageUV - .5;
  float edgeDist = 2. * max(abs(imageCenteredUV.x), abs(imageCenteredUV.y));
  float wrinkleDistortion = mix(.38, .0175, smoothstep(0., 1., edgeDist));
  float scaleDistortion = .15 * u_crumples * (crumpleDepth - .5) + wrinkleDistortion * u_wrinkles * (wrinkleDepth - .5) + .05 * foldDepth;
  vec2 linearDistortion = notClipped * .002 * lightDir * drops;
  float radialDistortion = notClipped * .02 * (roughness + fiber);
  vec2 centeredUV = imageCenteredUV * (1. - u_distortion * scaleDistortion);
  centeredUV -= u_distortion * linearDistortion;
  vec2 imageUV = .5 + centeredUV * (1. - abs(u_distortion) * radialDistortion * dot(centeredUV, centeredUV));

  vec3 color = shadowColor * pattern;
  float opacity = shadowOpacity * pattern;
  color += baseColor * (1. - opacity);
  opacity += baseOpacity * (1. - opacity);

  if (u_isImage) {
    float frame = getUvFrame(imageUV);
    vec4 image = texture(u_image, imageUV);
    frame *= image.a;

    float maxC = max(max(image.r, image.g), image.b);
    float minC = min(min(image.r, image.g), image.b);
    float sat = maxC > 0. ? (maxC - minC) / maxC : 0.;
    float midC = image.r + image.g + image.b - maxC - minC;
    float secondaryness = maxC > minC ? (midC - minC) / (maxC - minC) : 0.;
    float satDampen = sat * (1. - .5 * secondaryness);
    float darkDampen = 1. - dot(vec3(.2126, .7152, .0722), image.rgb);
    float dampen = mix(0., .7, u_blending) * max(satDampen, darkDampen);

    vec3 paper = vec3(1.) - opacity + color;
    vec3 pic = image.rgb * paper * u_blending + image.rgb * (1. - u_blending);
    pic = mix(pic, vec3(1.), .6 * pow(dampen, 2. + 3. * pattern));

    color = mix(color, pic, frame);
    opacity = frame + opacity * (1. - frame);

    if (u_clip) {
      color *= frame;
      opacity *= frame;
    }
  }

  color *= mix(vec3(1.), .5 * u_colorShadow.rgb, drops * shadowOpacity);

  color += backColor * (1. - opacity);
  opacity += backOpacity * (1. - opacity);

  fragColor = vec4(color, opacity);
}
`;var Ao=`#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;

uniform vec4 u_colorBack;
uniform vec4 u_colorShadow;
uniform vec4 u_colorHighlight;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_size;
uniform float u_shadows;
uniform float u_angle;
uniform float u_stretch;
uniform float u_shape;
uniform float u_distortion;
uniform float u_highlights;
uniform float u_distortionShape;
uniform float u_shift;
uniform float u_blur;
uniform float u_edges;
uniform float u_marginLeft;
uniform float u_marginRight;
uniform float u_marginTop;
uniform float u_marginBottom;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_imageUV;

out vec4 fragColor;

${xe}
${Qe}
${be}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float getUvFrame(vec2 uv, float softness) {
  float aax = 2. * fwidth(uv.x);
  float aay = 2. * fwidth(uv.y);
  float left   = smoothstep(0., aax + softness, uv.x);
  float right  = 1. - smoothstep(1. - softness - aax, 1., uv.x);
  float bottom = smoothstep(0., aay + softness, uv.y);
  float top    = 1. - smoothstep(1. - softness - aay, 1., uv.y);
  return left * right * bottom * top;
}

const int MAX_RADIUS = 50;
vec4 samplePremultiplied(sampler2D tex, vec2 uv) {
  vec4 c = texture(tex, uv);
  c.rgb *= c.a;
  return c;
}
vec4 getBlur(sampler2D tex, vec2 uv, vec2 texelSize, vec2 dir, float sigma) {
  if (sigma <= .5) return texture(tex, uv);
  int radius = int(min(float(MAX_RADIUS), ceil(3.0 * sigma)));

  float twoSigma2 = 2.0 * sigma * sigma;
  float gaussianNorm = 1.0 / sqrt(TWO_PI * sigma * sigma);

  vec4 sum = samplePremultiplied(tex, uv) * gaussianNorm;
  float weightSum = gaussianNorm;

  for (int i = 1; i <= MAX_RADIUS; i++) {
    if (i > radius) break;

    float x = float(i);
    float w = exp(-(x * x) / twoSigma2) * gaussianNorm;

    vec2 offset = dir * texelSize * x;
    vec4 s1 = samplePremultiplied(tex, uv + offset);
    vec4 s2 = samplePremultiplied(tex, uv - offset);

    sum += (s1 + s2) * w;
    weightSum += 2.0 * w;
  }

  vec4 result = sum / weightSum;
  if (result.a > 0.) {
    result.rgb /= result.a;
  }

  return result;
}

vec2 rotateAspect(vec2 p, float a, float aspect) {
  p.x *= aspect;
  p = rotate(p, a);
  p.x /= aspect;
  return p;
}

float smoothFract(float x) {
  float f = fract(x);
  float w = fwidth(x);

  float edge = abs(f - 0.5) - 0.5;
  float band = smoothstep(-w, w, edge);

  return mix(f, 1.0 - f, band);
}

void main() {

  float patternRotation = -u_angle * PI / 180.;
  float patternSize = mix(200., 5., u_size);

  vec2 uv = v_imageUV;

  vec2 uvMask = gl_FragCoord.xy / u_resolution.xy;
  vec2 sw = vec2(.005);
  vec4 margins = vec4(u_marginLeft, u_marginTop, u_marginRight, u_marginBottom);
  float mask =
  smoothstep(margins[0], margins[0] + sw.x, uvMask.x + sw.x) *
  smoothstep(margins[2], margins[2] + sw.x, 1.0 - uvMask.x + sw.x) *
  smoothstep(margins[1], margins[1] + sw.y, uvMask.y + sw.y) *
  smoothstep(margins[3], margins[3] + sw.y, 1.0 - uvMask.y + sw.y);
  float maskOuter =
  smoothstep(margins[0] - sw.x, margins[0], uvMask.x + sw.x) *
  smoothstep(margins[2] - sw.x, margins[2], 1.0 - uvMask.x + sw.x) *
  smoothstep(margins[1] - sw.y, margins[1], uvMask.y + sw.y) *
  smoothstep(margins[3] - sw.y, margins[3], 1.0 - uvMask.y + sw.y);
  float maskStroke = maskOuter - mask;
  float maskInner =
  smoothstep(margins[0] - 2. * sw.x, margins[0], uvMask.x) *
  smoothstep(margins[2] - 2. * sw.x, margins[2], 1.0 - uvMask.x) *
  smoothstep(margins[1] - 2. * sw.y, margins[1], uvMask.y) *
  smoothstep(margins[3] - 2. * sw.y, margins[3], 1.0 - uvMask.y);
  float maskStrokeInner = maskInner - mask;

  uv -= .5;
  uv *= patternSize;
  uv = rotateAspect(uv, patternRotation, u_imageAspectRatio);

  float curve = 0.;
  float patternY = uv.y / u_imageAspectRatio;
  if (u_shape > 4.5) {
    // pattern
    curve = .5 + .5 * sin(.5 * PI * uv.x) * cos(.5 * PI * patternY);
  } else if (u_shape > 3.5) {
    // zigzag
    curve = 10. * abs(fract(.1 * patternY) - .5);
  } else if (u_shape > 2.5) {
    // wave
    curve = 4. * sin(.23 * patternY);
  } else if (u_shape > 1.5) {
    // lines irregular
    curve = .5 + .5 * sin(.5 * uv.x) * sin(1.7 * uv.x);
  } else {
    // lines
  }

  vec2 UvToFract = uv + curve;
  vec2 fractOrigUV = fract(uv);
  vec2 floorOrigUV = floor(uv);

  float x = smoothFract(UvToFract.x);
  float xNonSmooth = fract(UvToFract.x) + .0001;

  float highlightsWidth = 2. * max(.001, fwidth(UvToFract.x));
  highlightsWidth += 2. * maskStrokeInner;
  float highlights = smoothstep(0., highlightsWidth, xNonSmooth);
  highlights *= smoothstep(1., 1. - highlightsWidth, xNonSmooth);
  highlights = 1. - highlights;
  highlights *= u_highlights;
  highlights = clamp(highlights, 0., 1.);
  highlights *= mask;

  float shadows = pow(x, 1.3);
  float distortion = 0.;
  float fadeX = 1.;
  float frameFade = 0.;

  float aa = fwidth(xNonSmooth);
  aa = max(aa, fwidth(uv.x));
  aa = max(aa, fwidth(UvToFract.x));
  aa = max(aa, .0001);

  if (u_distortionShape == 1.) {
    distortion = -pow(1.5 * x, 3.);
    distortion += (.5 - u_shift);

    frameFade = pow(1.5 * x, 3.);
    aa = max(.2, aa);
    aa += mix(.2, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion = mix(.5, distortion, fadeX);
  } else if (u_distortionShape == 2.) {
    distortion = 2. * pow(x, 2.);
    distortion -= (.5 + u_shift);

    frameFade = pow(abs(x - .5), 4.);
    aa = max(.2, aa);
    aa += mix(.2, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion = mix(.5, distortion, fadeX);
    frameFade = mix(1., frameFade, .5 * fadeX);
  } else if (u_distortionShape == 3.) {
    distortion = pow(2. * (xNonSmooth - .5), 6.);
    distortion -= .25;
    distortion -= u_shift;

    frameFade = 1. - 2. * pow(abs(x - .4), 2.);
    aa = .15;
    aa += mix(.1, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    frameFade = mix(1., frameFade, fadeX);

  } else if (u_distortionShape == 4.) {
    x = xNonSmooth;
    distortion = sin((x + .25) * TWO_PI);
    shadows = .5 + .5 * asin(distortion) / (.5 * PI);
    distortion *= .5;
    distortion -= u_shift;
    frameFade = .5 + .5 * sin(x * TWO_PI);
  } else if (u_distortionShape == 5.) {
    distortion -= pow(abs(x), .2) * x;
    distortion += .33;
    distortion -= 3. * u_shift;
    distortion *= .33;

    frameFade = .3 * (smoothstep(.0, 1., x));
    shadows = pow(x, 2.5);

    aa = max(.1, aa);
    aa += mix(.1, 0., u_size);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion *= fadeX;
  }

  vec2 dudx = dFdx(v_imageUV);
  vec2 dudy = dFdy(v_imageUV);
  vec2 grainUV = v_imageUV - .5;
  grainUV *= (.8 / vec2(length(dudx), length(dudy)));
  grainUV += .5;
  if (u_grainMixer > 0.) {
    float grain = valueNoise(grainUV);
    grain = smoothstep(.4, .7, grain);
    grain *= u_grainMixer;
    distortion = mix(distortion, 0., grain);
  }

  shadows = min(shadows, 1.);
  shadows += maskStrokeInner;
  shadows *= mask;
  shadows = min(shadows, 1.);
  shadows *= pow(u_shadows, 2.);
  shadows = clamp(shadows, 0., 1.);

  distortion *= 3. * u_distortion;
  frameFade *= u_distortion;

  fractOrigUV.x += distortion;
  floorOrigUV = rotateAspect(floorOrigUV, -patternRotation, u_imageAspectRatio);
  fractOrigUV = rotateAspect(fractOrigUV, -patternRotation, u_imageAspectRatio);

  uv = (floorOrigUV + fractOrigUV) / patternSize;
  uv += pow(maskStroke, 4.);

  uv += vec2(.5);

  uv = mix(v_imageUV, uv, smoothstep(0., .7, mask));
  float blur = mix(0., 50., u_blur);
  blur = mix(0., blur, smoothstep(.5, 1., mask));

  float edgeDistortion = mix(.0, .04, u_edges);
  edgeDistortion += .06 * frameFade * u_edges;
  edgeDistortion *= mask;
  float frame = getUvFrame(uv, edgeDistortion);

  float stretch = 1. - smoothstep(0., .5, xNonSmooth) * smoothstep(1., 1. - .5, xNonSmooth);
  stretch = pow(stretch, 2.);
  stretch *= mask;
  stretch *= getUvFrame(uv, .1 + .05 * mask * frameFade);
  uv.y = mix(uv.y, .5, u_stretch * stretch);

  vec4 image = getBlur(u_image, uv, 1. / u_resolution / u_pixelRatio, vec2(0., 1.), blur);
  image.rgb *= image.a;
  vec4 backColor = u_colorBack;
  backColor.rgb *= backColor.a;
  vec4 highlightColor = u_colorHighlight;
  highlightColor.rgb *= highlightColor.a;
  vec4 shadowColor = u_colorShadow;

  vec3 color = highlightColor.rgb * highlights;
  float opacity = highlightColor.a * highlights;

  shadows = mix(shadows * shadowColor.a, 0., highlights);
  color = mix(color, shadowColor.rgb * shadowColor.a, .5 * shadows);
  color += .5 * pow(shadows, .5) * shadowColor.rgb;
  opacity += shadows;
  color = clamp(color, vec3(0.), vec3(1.));
  opacity = clamp(opacity, 0., 1.);

  color += image.rgb * (1. - opacity) * frame;
  opacity += image.a * (1. - opacity) * frame;

  color += backColor.rgb * (1. - opacity);
  opacity += backColor.a * (1. - opacity);

  if (u_grainOverlay > 0.) {
    float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grainOverlay = pow(grainOverlay, 1.3);

    float grainOverlayV = grainOverlay * 2. - 1.;
    vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
    float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
    grainOverlayStrength = pow(grainOverlayStrength, .8);
    grainOverlayStrength *= mask;
    color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

    opacity += .5 * grainOverlayStrength;
  }
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`,Co={lines:1,linesIrregular:2,wave:3,zigzag:4,pattern:5},_o={prism:1,lens:2,contour:3,cascade:4,flat:5};var Eo=`#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_fit;

uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform vec4 u_colorFront;
uniform vec4 u_colorBack;
uniform vec4 u_colorHighlight;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_type;
uniform float u_pxSize;
uniform bool u_originalColors;
uniform bool u_inverted;
uniform float u_colorSteps;

out vec4 fragColor;


${be}
${xe}

float getUvFrame(vec2 uv, vec2 pad) {
  float aa = 0.0001;

  float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
  float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
  float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
  float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);

  return left * right * bottom * top;
}

vec2 getImageUV(vec2 uv) {
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  vec2 imageUV = uv;
  imageUV *= imageBoxScale;
  imageUV += boxOrigin * (imageBoxScale - 1.);
  imageUV += graphicOffset;
  imageUV /= u_scale;
  imageUV.x *= u_imageAspectRatio;
  imageUV = graphicRotation * imageUV;
  imageUV.x /= u_imageAspectRatio;

  imageUV += .5;
  imageUV.y = 1. - imageUV.y;

  return imageUV;
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}


void main() {

  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  vec2 imageUV = getImageUV(normalizedUV);
  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec4 image = texture(u_image, imageUV);
  float frame = getUvFrame(imageUV, pxSize / u_resolution);

  int type = int(floor(u_type));
  float dithering = 0.0;

  float lum = dot(vec3(.2126, .7152, .0722), image.rgb);
  lum = u_inverted ? (1. - lum) : lum;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), lum);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  float colorSteps = max(floor(u_colorSteps), 1.);
  vec3 color = vec3(0.0);
  float opacity = 1.;

  dithering -= .5;
  float brightness = clamp(lum + dithering / colorSteps, 0.0, 1.0);
  brightness = mix(0.0, brightness, frame);
  brightness = mix(0.0, brightness, image.a);
  float quantLum = floor(brightness * colorSteps + 0.5) / colorSteps;
  quantLum = mix(0.0, quantLum, frame);

  if (u_originalColors == true) {
    vec3 normColor = image.rgb / max(lum, 0.001);
    color = normColor * quantLum;

    float quantAlpha = floor(image.a * colorSteps + 0.5) / colorSteps;
    opacity = mix(quantLum, 1., quantAlpha);
  } else {
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;
    vec3 hlColor = u_colorHighlight.rgb * u_colorHighlight.a;
    float hlOpacity = u_colorHighlight.a;

    fgColor = mix(fgColor, hlColor, step(1.02 - .02 * u_colorSteps, brightness));
    fgOpacity = mix(fgOpacity, hlOpacity, step(1.02 - .02 * u_colorSteps, brightness));

    color = fgColor * quantLum;
    opacity = fgOpacity * quantLum;
    color += bgColor * (1.0 - opacity);
    opacity += bgOpacity * (1.0 - opacity);
  }

  fragColor = vec4(color, opacity);
}
`;var dn={maxSamples:50},Bo=`#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_spread;
uniform float u_bias;
uniform float u_angle;
uniform float u_perspective;
uniform float u_count;
uniform float u_dispersion;
uniform float u_dispersionShift;
uniform float u_dispersionColor;
uniform float u_focusCenter;
uniform float u_focusEdges;
uniform float u_swirl;
uniform float u_noise;
uniform float u_noiseFrequency;
uniform float u_noiseOffset;
uniform float u_lensBulge;
uniform float u_lensCircle;
uniform float u_grainMixer;
uniform float u_grainOverlay;
uniform float u_imageX;
uniform float u_imageY;

in vec2 v_imageUV;

out vec4 fragColor;

${xe}
${be}
${Qe}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1., 0.));
  float c = hash21(i + vec2(0., 1.));
  float d = hash21(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getUvFrame(vec2 uv) {
  vec2 invAA = 1. / clamp(fwidth(uv), 1e-5, .02);
  vec2 lo = clamp(uv * invAA + .5, 0., 1.);
  vec2 hi = clamp((1. - uv) * invAA + .5, 0., 1.);
  return lo.x * hi.x * lo.y * hi.y;
}

vec4 sampleOverWhite(vec2 uv) {
  vec4 img = texture(u_image, uv);
  float cover = img.a * getUvFrame(uv);
  vec3 colorOverWhite = mix(vec3(1.), img.rgb, cover);
  return vec4(colorOverWhite, cover);
}

vec3 hueColor(float hue) {
  vec3 rgb = clamp(abs(mod(hue * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.);
  rgb = rgb * rgb * (3. - 2. * rgb);
  return rgb;
}
                                            
float boxInradius() {
  return .5 * min(u_imageAspectRatio, 1.);
}

float boxOutradius() {
  return .5 * length(vec2(u_imageAspectRatio, 1.));
}

float spreadReach() {
  return .7 * pow(u_spread, 1.3 + 2.7 * u_spread);
}

float innerCircleMask(float radius, float inradius) {
  return 1. - smoothstep(.5 * inradius, 1.1 * inradius, radius);
}

float dispersionCurve(float t, float biasPow) {
  float mirroredT = u_bias < 0. ? 1. - t : t;
  float curved = pow(mirroredT, biasPow);
  return u_bias < 0. ? 1. - curved : curved;
}

vec2 getSpread(vec2 fromCenter, float radius, vec2 warpedUV, float edgeAA, float inradius, float outradius, float reach, out float outStrength) {
  float angleRad = radians(u_angle);
  vec2 uniformDir = vec2(cos(angleRad), sin(angleRad));

  float invInradius = 1. / inradius;
  vec2 radialDir = fromCenter * invInradius;
  float maxLen = (outradius + reach) * invInradius;
  float radialLen = radius * invInradius;
  if (radialLen > maxLen) radialDir *= maxLen / radialLen;
  vec2 spreadDir = mix(uniformDir, radialDir, u_perspective);

  float bandProximity = smoothstep(inradius * .8, inradius, radius);
  float lensCircleMaxing = bandProximity * u_lensCircle * u_lensCircle * u_lensCircle;
  spreadDir = mix(spreadDir, radialDir, lensCircleMaxing);

  vec2 warpedAbs = abs(warpedUV - .5);
  float inner = mix(1., smoothstep(0., mix(inradius, outradius, u_focusCenter), radius), u_focusCenter);
  float boxDist = max(warpedAbs.x, warpedAbs.y) * 2.;
  float outer = mix(1., 1. - min(boxDist, 1.), u_focusEdges);
  float strength = inner * outer;

  strength *= mix(1., mix(.15, .03, max(-u_lensBulge, 0.)), lensCircleMaxing);

  vec2 outside = max(warpedAbs - .5, 0.);
  float margin = max(reach * length(spreadDir) * (1. - u_lensCircle), edgeAA);
  strength *= 1. - smoothstep(0., margin, length(outside));

  outStrength = strength;
  vec2 axis = spreadDir * (reach * strength);

  if (u_noise > 0.) {
    float turn = (valueNoise(fromCenter * u_noiseFrequency * 18. + u_noiseOffset * 30.) - .5) * 2. * u_noise;
    float cs = cos(turn), sn = sin(turn);
    axis = mat2(cs, -sn, sn, cs) * axis;
  }

  axis.x /= u_imageAspectRatio;
  return axis;
}

vec2 lensWarp(vec2 fromCenter, float radius, float inradius, out float bulgeFade) {
  bulgeFade = 1.;
  if (u_lensBulge == 0. && u_lensCircle <= 0.) return fromCenter;
  if (radius < 1e-5) return fromCenter;
  
  float r = radius;

  if (u_lensBulge != 0.) {
    float rn = radius / inradius;
    float bulge = abs(u_lensBulge) * (u_lensBulge > 0. ? 1.4 : 1.2);
    if (u_lensBulge > 0.) bulgeFade = 1. - smoothstep(1.45, 1.53, rn * bulge);
    float map = u_lensBulge > 0.
      ? tan(min(rn * bulge, 1.53)) / tan(bulge)
      : atan(rn * tan(bulge)) / bulge;
    float bulgeScale = map / rn;
    fromCenter *= bulgeScale;
    r *= bulgeScale;
  }

  if (u_lensCircle > 0.) {
    vec2 dir = fromCenter / max(r, 1e-5);
    vec2 halfBox = vec2(u_imageAspectRatio, 1.) * .5;
    float rBox = min(halfBox.x / max(abs(dir.x), 1e-4), halfBox.y / max(abs(dir.y), 1e-4));
    float band = inradius * mix(.03, .2, .5 * (u_lensBulge + 1.));
    float innerEdge = inradius - band;
    float over = smoothstep(0., 1., (r - innerEdge) / band);
    float g = r + (rBox - inradius) * pow(over, 14.);
    fromCenter = dir * mix(r, g, u_lensCircle);
  }

  return fromCenter;
}

void main() {
  vec2 uv = v_imageUV;

  float invAspect = 1. / u_imageAspectRatio;
  float inradius = boxInradius();
  float outradius = boxOutradius();
  float reach = spreadReach();

  vec2 fromCenter = uv - .5;
  fromCenter.x *= u_imageAspectRatio;
  float radius = length(fromCenter);

  float bulgeFade;
  vec2 warpedFromCenter = lensWarp(fromCenter, radius, inradius, bulgeFade);
  vec2 baseUV = vec2(warpedFromCenter.x * invAspect, warpedFromCenter.y) + .5;

  vec2 baseDerivative = fwidth(baseUV);
  float edgeAA = clamp(2. * max(baseDerivative.x, baseDerivative.y), .001, .02);

  float spreadStrength;
  vec2 spreadAxis = getSpread(fromCenter, radius, baseUV, edgeAA, inradius, outradius, reach, spreadStrength);

  vec2 grainUV = vec2(0.);
  if (u_grainMixer > 0. || u_grainOverlay > 0.) {
    vec2 dudx = dFdx(v_imageUV);
    vec2 dudy = dFdy(v_imageUV);
    grainUV = (v_imageUV - .5) * (.8 / vec2(length(dudx), length(dudy))) + .5;
  }

  if (u_grainMixer > 0.) {
    float grainSeed = valueNoise(grainUV);
    vec2 jit = fract(grainSeed * vec2(157.31, 113.57)) * 2. - 1.;
    spreadAxis += jit * .3 * u_grainMixer * length(spreadAxis);
  }

  float count = floor(u_count);
  int countInteger = int(count);

  float invCount = 1. / count;
  float invSpan = 1. / max(count - 1., 1.);
  float hueBase = u_dispersionColor + .5;
  float biasPower = 1. + 2. * abs(u_bias);
  vec2 tapBias = .5 - vec2(u_imageX, u_imageY);

  float centerAmount = clamp(1. - u_dispersionShift, 0., 1.);
  float edgesAmount = clamp(1. + u_dispersionShift, 0., 1.);
  float dispersion = u_dispersion * mix(edgesAmount, centerAmount, innerCircleMask(radius, inradius));
  float dispersionPower = pow(dispersion, .8);

  float warpedRadius = length(warpedFromCenter);
  float swirlAngle = u_swirl * .4 * PI * spreadStrength * u_spread * min(1., inradius / max(warpedRadius, 1e-4));

  vec3 colorSum = vec3(0.);
  vec3 weightSum = vec3(0.);
  float coverSum = 0.;

  for (int i = 0; i < ${dn.maxSamples}; i++) {
    if (i >= countInteger) break;

    float layer = float(i);
    float hue = hueBase + layer * invCount;

    float spread = layer * invSpan;
    if (u_bias != 0.) spread = dispersionCurve(spread, biasPower);

    // mix(axis, -axis, spread) is axis scaled by the signed position along the fan
    float fanPos = 1. - 2. * spread;
    vec2 tapUV = baseUV + spreadAxis * fanPos - .5;

    if (u_swirl != 0.) {
      tapUV.x *= u_imageAspectRatio;
      tapUV = rotate(tapUV, swirlAngle * fanPos);
      tapUV.x *= invAspect;
    }

    vec4 tap = sampleOverWhite(tapUV + tapBias);
    vec3 weight = 1. - dispersionPower * hueColor(hue);

    colorSum += tap.rgb * weight;
    weightSum += weight;
    coverSum += tap.a;
  }

  vec3 color = colorSum / max(weightSum, 1e-4);
  float coverAvg = coverSum * invCount;

  float ground = min(color.r, min(color.g, color.b));
  float alpha = max(coverAvg, 1. - ground);
  vec3 premult = max(color - (1. - alpha), 0.);
  fragColor = vec4(premult, alpha) * bulgeFade;

  if (u_grainOverlay > 0.) {
    float grain = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grain = mix(grain, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grain = pow(grain, 1.3);
    float grainV = grain * 2. - 1.;
    float grainStrength = pow(u_grainOverlay * abs(grainV), .8) * fragColor.a;
    fragColor.rgb = mix(fragColor.rgb, vec3(step(0., grainV)) * fragColor.a, .35 * grainStrength);
  }
}
`;var wo=`#version 300 es
precision mediump float;

uniform vec4 u_colorFront;
uniform vec4 u_colorBack;
uniform float u_radius;
uniform float u_contrast;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform float u_size;
uniform float u_grainMixer;
uniform float u_grainOverlay;
uniform float u_grainSize;
uniform float u_grid;
uniform bool u_originalColors;
uniform bool u_inverted;
uniform float u_type;

in vec2 v_imageUV;

out vec4 fragColor;

${xe}
${Qe}
${be}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float sst(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

float getCircle(vec2 uv, float r, float baseR) {
  r = mix(.25 * baseR, 0., r);
  float d = length(uv - .5);
  float aa = fwidth(d);
  return 1. - smoothstep(r - aa, r + aa, d);
}

float getCell(vec2 uv) {
  float insideX = step(0.0, uv.x) * (1.0 - step(1.0, uv.x));
  float insideY = step(0.0, uv.y) * (1.0 - step(1.0, uv.y));
  return insideX * insideY;
}

float getCircleWithHole(vec2 uv, float r, float baseR) {
  float cell = getCell(uv);

  r = mix(.75 * baseR, 0., r);
  float rMod = mod(r, .5);

  float d = length(uv - .5);
  float aa = fwidth(d);
  float circle = 1. - smoothstep(rMod - aa, rMod + aa, d);
  if (r < .5) {
    return circle;
  } else {
    return cell - circle;
  }
}

float getGooeyBall(vec2 uv, float r, float baseR) {
  float d = length(uv - .5);
  float sizeRadius = .3;
  if (u_grid == 1.) {
    sizeRadius = .42;
  }
  sizeRadius = mix(sizeRadius * baseR, 0., r);
  d = 1. - sst(0., sizeRadius, d);

  d = pow(d, 2. + baseR);
  return d;
}

float getSoftBall(vec2 uv, float r, float baseR) {
  float d = length(uv - .5);
  float sizeRadius = clamp(baseR, 0., 1.);
  sizeRadius = mix(.5 * sizeRadius, 0., r);
  d = 1. - lst(0., sizeRadius, d);
  float powRadius = 1. - lst(0., 2., baseR);
  d = pow(d, 4. + 3. * powRadius);
  return d;
}

float getUvFrame(vec2 uv, vec2 pad) {
  float aa = 0.0001;

  float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
  float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
  float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
  float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);

  return left * right * bottom * top;
}

float sigmoid(float x, float k) {
  return 1.0 / (1.0 + exp(-k * (x - 0.5)));
}

float getLumAtPx(vec2 uv, float contrast) {
  vec4 tex = texture(u_image, uv);
  vec3 color = vec3(
  sigmoid(tex.r, contrast),
  sigmoid(tex.g, contrast),
  sigmoid(tex.b, contrast)
  );
  float lum = dot(vec3(0.2126, 0.7152, 0.0722), color);
  lum = mix(1., lum, tex.a);
  lum = u_inverted ? (1. - lum) : lum;
  return lum;
}

float getLumBall(vec2 p, vec2 pad, vec2 inCellOffset, float contrast, float baseR, float stepSize, out vec4 ballColor) {
  p += inCellOffset;
  vec2 uv_i = floor(p);
  vec2 uv_f = fract(p);
  vec2 samplingUV = (uv_i + .5 - inCellOffset) * pad + vec2(.5);
  float outOfFrame = getUvFrame(samplingUV, pad * stepSize);

  float lum = getLumAtPx(samplingUV, contrast);
  ballColor = texture(u_image, samplingUV);
  ballColor.rgb *= ballColor.a;
  ballColor *= outOfFrame;

  float ball = 0.;
  if (u_type == 0.) {
    // classic
    ball = getCircle(uv_f, lum, baseR);
  } else if (u_type == 1.) {
    // gooey
    ball = getGooeyBall(uv_f, lum, baseR);
  } else if (u_type == 2.) {
    // holes
    ball = getCircleWithHole(uv_f, lum, baseR);
  } else if (u_type == 3.) {
    // soft
    ball = getSoftBall(uv_f, lum, baseR);
  }

  return ball * outOfFrame;
}


void main() {

  float stepMultiplier = 1.;
  if (u_type == 0.) {
    // classic
    stepMultiplier = 2.;
  } else if (u_type == 1. || u_type == 3.) {
    // gooey & soft
    stepMultiplier = 6.;
  }

  float cellsPerSide = mix(300., 7., pow(u_size, .7));
  cellsPerSide /= stepMultiplier;
  float cellSizeY = 1. / cellsPerSide;
  vec2 pad = cellSizeY * vec2(1. / u_imageAspectRatio, 1.);
  if (u_type == 1. && u_grid == 1.) {
    // gooey diagonal grid works differently
    pad *= .7;
  }

  vec2 uv = v_imageUV;
  uv -= vec2(.5);
  uv /= pad;

  float contrast = mix(0., 15., pow(u_contrast, 1.5));
  float baseRadius = u_radius;
  if (u_originalColors == true) {
    contrast = mix(.1, 4., pow(u_contrast, 2.));
    baseRadius = 2. * pow(.5 * u_radius, .3);
  }

  float totalShape = 0.;
  vec3 totalColor = vec3(0.);
  float totalOpacity = 0.;

  vec4 ballColor;
  float shape;
  float stepSize = 1. / stepMultiplier;
  for (float x = -0.5; x < 0.5; x += stepSize) {
    for (float y = -0.5; y < 0.5; y += stepSize) {
      vec2 offset = vec2(x, y);

      if (u_grid == 1.) {
        float rowIndex = floor((y + .5) / stepSize);
        float colIndex = floor((x + .5) / stepSize);
        if (stepSize == 1.) {
          rowIndex = floor(uv.y + y + 1.);
          if (u_type == 1.) {
            colIndex = floor(uv.x + x + 1.);
          }
        }
        if (u_type == 1.) {
          if (mod(rowIndex + colIndex, 2.) == 1.) {
            continue;
          }
        } else {
          if (mod(rowIndex, 2.) == 1.) {
            offset.x += .5 * stepSize;
          }
        }
      }

      shape = getLumBall(uv, pad, offset, contrast, baseRadius, stepSize, ballColor);
      totalColor   += ballColor.rgb * shape;
      totalShape   += shape;
      totalOpacity += shape;
    }
  }

  const float eps = 1e-4;

  totalColor /= max(totalShape, eps);
  totalOpacity /= max(totalShape, eps);

  float finalShape = 0.;
  if (u_type == 0.) {
    finalShape = min(1., totalShape);
  } else if (u_type == 1.) {
    float aa = fwidth(totalShape);
    float th = .5;
    finalShape = smoothstep(th - aa, th + aa, totalShape);
  } else if (u_type == 2.) {
    finalShape = min(1., totalShape);
  } else if (u_type == 3.) {
    finalShape = totalShape;
  }

  vec2 grainSize = mix(2000., 200., u_grainSize) * vec2(1., 1. / u_imageAspectRatio);
  vec2 grainUV = v_imageUV - .5;
  grainUV *= grainSize;
  grainUV += .5;
  if (u_grainMixer > 0.) {
    float grain = valueNoise(grainUV);
    grain = smoothstep(.55, .7 + .2 * u_grainMixer, grain);
    grain *= u_grainMixer;
    finalShape = mix(finalShape, 0., grain);
  }

  vec3 color = vec3(0.);
  float opacity = 0.;

  if (u_originalColors == true) {
    color = totalColor * finalShape;
    opacity = totalOpacity * finalShape;

    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    color = color + bgColor * (1. - opacity);
    opacity = opacity + u_colorBack.a * (1. - opacity);
  } else {
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;

    color = fgColor * finalShape;
    opacity = fgOpacity * finalShape;
    color += bgColor * (1. - opacity);
    opacity += bgOpacity * (1. - opacity);
  }

  if (u_grainOverlay > 0.) {
    float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
    grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
    grainOverlay = pow(grainOverlay, 1.3);

    float grainOverlayV = grainOverlay * 2. - 1.;
    vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
    float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
    grainOverlayStrength = pow(grainOverlayStrength, .8);
    color = mix(color, grainOverlayColor, .5 * grainOverlayStrength);

    opacity += .5 * grainOverlayStrength;
  }
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`,ko={classic:0,gooey:1,holes:2,soft:3},Ro={square:0,hex:1};function q(e){if(Array.isArray(e))return e.length===4?e:e.length===3?[...e,1]:pt;if(typeof e!="string")return pt;let t,o,r,a=1;if(e.startsWith("#"))[t,o,r,a]=ss(e);else if(e.startsWith("rgb")){let n=ls(e);if(n===null)return pt;[t,o,r,a]=n}else if(e.startsWith("hsl")){let n=cs(e);if(n===null)return pt;[t,o,r,a]=us(n)}else return console.error("Unsupported color format",e),pt;return[zt(t,0,1),zt(o,0,1),zt(r,0,1),zt(a,0,1)]}function ss(e){if(e=e.replace(/^#/,""),(e.length===3||e.length===4)&&(e=e.split("").map(n=>n+n).join("")),e.length===6&&(e=e+"ff"),!/^[0-9a-f]{8}$/i.test(e))return console.warn("Invalid hex color"),pt;let t=parseInt(e.slice(0,2),16)/255,o=parseInt(e.slice(2,4),16)/255,r=parseInt(e.slice(4,6),16)/255,a=parseInt(e.slice(6,8),16)/255;return[t,o,r,a]}function ls(e){let t=e.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i);return t?[parseInt(t[1]??"0")/255,parseInt(t[2]??"0")/255,parseInt(t[3]??"0")/255,t[4]===void 0?1:parseFloat(t[4])]:null}function cs(e){let t=e.match(/^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([0-9.]+))?\s*\)$/i);return t?[parseInt(t[1]??"0"),parseInt(t[2]??"0"),parseInt(t[3]??"0"),t[4]===void 0?1:parseFloat(t[4])]:null}function us(e){let[t,o,r,a]=e,n=t/360,i=o/100,s=r/100,c,l,u;if(o===0)c=l=u=s;else{let d=(f,h,m)=>(m<0&&(m+=1),m>1&&(m-=1),m<.16666666666666666?f+(h-f)*6*m:m<.5?h:m<.6666666666666666?f+(h-f)*(.6666666666666666-m)*6:f),p=s<.5?s*(1+i):s+i-s*i,g=2*s-p;c=d(g,p,n+1/3),l=d(g,p,n),u=d(g,p,n-1/3)}return[c,l,u,a]}var zt=(e,t,o)=>Math.min(Math.max(e,t),o),pt=[.5,.5,.5,1];function To(){if(typeof window>"u")return;let e=new Image;return e.src=fs,e}var fs="data:image/png;base64,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";var Fo="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";var gt=S(K(),1);function mn(e){let t=gt.useRef(void 0),o=gt.useCallback(r=>{let a=e.map(n=>{if(n!=null){if(typeof n=="function"){let i=n,s=i(r);return typeof s=="function"?s:()=>{i(null)}}return n.current=r,()=>{n.current=null}}});return()=>{a.forEach(n=>n?.())}},e);return gt.useMemo(()=>e.every(r=>r==null)?null:r=>{t.current&&(t.current(),t.current=void 0),r!=null&&(t.current=o(r))},e)}function Mo(e){if(e.naturalWidth<1024&&e.naturalHeight<1024){if(e.naturalWidth<1||e.naturalHeight<1)return;let t=e.naturalWidth/e.naturalHeight;e.width=Math.round(t>1?1024*t:1024),e.height=Math.round(t>1?1024:1024/t)}}var gn=S(_(),1);async function pn(e){let t={},o=[],r=n=>{try{return n.startsWith("/")||new URL(n),!0}catch{return!1}},a=n=>{try{return n.startsWith("/")?!1:new URL(n,window.location.origin).origin!==window.location.origin}catch{return!1}};return Object.entries(e).forEach(([n,i])=>{if(typeof i=="string"){let s=i||Fo;if(!r(s)){console.warn(`Uniform "${n}" has invalid URL "${s}". Skipping image loading.`);return}let c=new Promise((l,u)=>{let d=new Image;a(s)&&(d.crossOrigin="anonymous"),d.onload=()=>{Mo(d),t[n]=d,l()},d.onerror=()=>{console.error(`Could not set uniforms. Failed to load image at ${s}`),u()},d.src=s});o.push(c)}else if(i instanceof HTMLImageElement){let s=i.decode().then(()=>{Mo(i),t[n]=i});o.push(s)}else t[n]=i}),await Promise.all(o),t}var de=(0,fe.forwardRef)(function({fragmentShader:t,uniforms:o,webGlContextAttributes:r,speed:a=0,frame:n=0,width:i,height:s,minPixelRatio:c,maxPixelCount:l,mipmaps:u,style:d,...p},g){let[f,h]=(0,fe.useState)(!1),m=(0,fe.useRef)(null),b=(0,fe.useRef)(null),y=(0,fe.useRef)(r);(0,fe.useEffect)(()=>((async()=>{let x=await pn(o);m.current&&!b.current&&(b.current=new _t(m.current,t,x,y.current,a,n,c,l,u),h(!0))})(),()=>{b.current?.dispose(),b.current=null}),[t]),(0,fe.useEffect)(()=>{let v=!1;return(async()=>{let C=await pn(o);v||b.current?.setUniforms(C)})(),()=>{v=!0}},[o,f]),(0,fe.useEffect)(()=>{b.current?.setSpeed(a)},[a,f]),(0,fe.useEffect)(()=>{b.current?.setMaxPixelCount(l)},[l,f]),(0,fe.useEffect)(()=>{b.current?.setMinPixelRatio(c)},[c,f]),(0,fe.useEffect)(()=>{b.current?.setFrame(n)},[n,f]);let A=mn([m,g]);return(0,gn.jsx)("div",{ref:A,style:i!==void 0||s!==void 0?{width:typeof i=="string"&&isNaN(+i)===!1?+i:i,height:typeof s=="string"&&isNaN(+s)===!1?+s:s,...d}:d,...p})});de.displayName="ShaderMount";var hn=S(K(),1);function Me(e,t){if(Object.keys(e).length!==Object.keys(t).length)return!1;for(let o in e){if(o==="colors"){let r=Array.isArray(e.colors),a=Array.isArray(t.colors);if(!r||!a){if(Object.is(e.colors,t.colors)===!1)return!1;continue}if(e.colors?.length!==t.colors?.length||!e.colors?.every((n,i)=>n===t.colors?.[i]))return!1;continue}if(Object.is(e[o],t[o])===!1)return!1}return!0}var xn=S(_(),1),ne={name:"Default",params:{...N,speed:1,frame:0,colors:["#e0eaff","#241d9a","#f75092","#9f50d3"],distortion:.8,swirl:.1,grainMixer:0,grainOverlay:0}},Ld={name:"Purple",params:{...N,speed:.6,frame:0,colors:["#aaa7d7","#3c2b8e"],distortion:1,swirl:1,grainMixer:0,grainOverlay:0}},Gd={name:"Beach",params:{...N,speed:.1,frame:0,colors:["#bcecf6","#00aaff","#00f7ff","#ffd447"],distortion:.8,swirl:.35,grainMixer:0,grainOverlay:0}},Hd={name:"Ink",params:{...N,speed:1,frame:0,colors:["#ffffff","#000000"],distortion:1,swirl:.2,rotation:90,grainMixer:0,grainOverlay:0}};var Po=(0,hn.memo)(function({speed:t=ne.params.speed,frame:o=ne.params.frame,colors:r=ne.params.colors,distortion:a=ne.params.distortion,swirl:n=ne.params.swirl,grainMixer:i=ne.params.grainMixer,grainOverlay:s=ne.params.grainOverlay,fit:c=ne.params.fit,rotation:l=ne.params.rotation,scale:u=ne.params.scale,originX:d=ne.params.originX,originY:p=ne.params.originY,offsetX:g=ne.params.offsetX,offsetY:f=ne.params.offsetY,worldWidth:h=ne.params.worldWidth,worldHeight:m=ne.params.worldHeight,...b}){let y={u_colors:r.map(q),u_colorsCount:r.length,u_distortion:a,u_swirl:n,u_grainMixer:i,u_grainOverlay:s,u_fit:ue[c],u_rotation:l,u_scale:u,u_offsetX:g,u_offsetY:f,u_originX:d,u_originY:p,u_worldWidth:h,u_worldHeight:m};return(0,xn.jsx)(de,{...b,speed:t,frame:o,fragmentShader:bo,uniforms:y})},Me);var bn=S(K(),1);var yn=S(_(),1),ae={name:"Default",params:{...Et,speed:1,frame:0,scale:.6,colorBack:"#000000",colorFront:"#00b2ff",shape:"sphere",type:"4x4",size:2}},qd={name:"Sine Wave",params:{...Et,speed:1,frame:0,colorBack:"#730d54",colorFront:"#00becc",shape:"wave",type:"4x4",size:11,scale:1.2}},Kd={name:"Bugs",params:{...Et,speed:1,frame:0,colorBack:"#000000",colorFront:"#008000",shape:"dots",type:"random",size:9}},jd={name:"Ripple",params:{...N,speed:1,frame:0,colorBack:"#603520",colorFront:"#c67953",shape:"ripple",type:"2x2",size:3}},Jd={name:"Swirl",params:{...N,speed:1,frame:0,colorBack:"#00000000",colorFront:"#47a8e1",shape:"swirl",type:"8x8",size:2}},Zd={name:"Warp",params:{...N,speed:1,frame:0,colorBack:"#301c2a",colorFront:"#56ae6c",shape:"warp",type:"4x4",size:2.5}};var Do=(0,bn.memo)(function({speed:t=ae.params.speed,frame:o=ae.params.frame,colorBack:r=ae.params.colorBack,colorFront:a=ae.params.colorFront,shape:n=ae.params.shape,type:i=ae.params.type,pxSize:s,size:c=s===void 0?ae.params.size:s,fit:l=ae.params.fit,scale:u=ae.params.scale,rotation:d=ae.params.rotation,originX:p=ae.params.originX,originY:g=ae.params.originY,offsetX:f=ae.params.offsetX,offsetY:h=ae.params.offsetY,worldWidth:m=ae.params.worldWidth,worldHeight:b=ae.params.worldHeight,...y}){let A={u_colorBack:q(r),u_colorFront:q(a),u_shape:vo[n],u_type:Bt[i],u_pxSize:c,u_fit:ue[l],u_scale:u,u_rotation:d,u_offsetX:f,u_offsetY:h,u_originX:p,u_originY:g,u_worldWidth:m,u_worldHeight:b};return(0,yn.jsx)(de,{...y,speed:t,frame:o,fragmentShader:yo,uniforms:A})});var vn=S(K(),1);var Sn=S(_(),1),U={name:"Default",params:{...N,fit:"contain",scale:.9,speed:0,frame:0,colorBack:"#d3d2ab",colorPaper:"#ffffff",colorShadow:"#cccccc",blending:1,distortion:.75,clip:!1,angle:300,seed:4,roughness:.4,roughnessSize:.5,roughnessRows:0,fiber:.4,fiberSize:.5,folds:.5,foldSizeX:1,foldSizeY:1,foldOffsetX:0,foldOffsetY:0,wrinkles:1,wrinkleSize:.65,crumples:0,crumpleCount:6,drops:.4}},rm={name:"Creased",params:{...N,fit:"contain",scale:.9,speed:0,frame:0,colorBack:"#d3d2ab",colorPaper:"#ffffff",colorShadow:"#b3b3b3",blending:1,distortion:-.5,clip:!1,angle:60,seed:49,roughness:.4,roughnessSize:.25,roughnessRows:0,fiber:.4,fiberSize:.5,folds:0,foldSizeX:.6,foldSizeY:.89,foldOffsetX:.59,foldOffsetY:1,wrinkles:0,wrinkleSize:.65,crumples:1,crumpleCount:4,drops:0}},nm={name:"Spread",params:{...N,fit:"contain",scale:.9,speed:0,frame:0,colorBack:"#ffffff00",colorPaper:"#ffffffb5",colorShadow:"#b3b3b3",blending:1,distortion:-.3,clip:!0,angle:236,seed:613,roughness:.15,roughnessSize:.25,roughnessRows:0,fiber:.5,fiberSize:.5,folds:1,foldSizeX:.4,foldSizeY:.89,foldOffsetX:0,foldOffsetY:0,wrinkles:0,wrinkleSize:.65,crumples:0,crumpleCount:9,drops:0}},am={name:"Flat",params:{...N,fit:"contain",scale:.9,speed:0,frame:0,colorBack:"#d4cdab",colorPaper:"#ffffffa8",colorShadow:"#b3b3b3",blending:1,distortion:0,clip:!1,angle:0,seed:455,roughness:1,roughnessSize:.5,roughnessRows:.6,fiber:.7,fiberSize:1,folds:0,foldSizeX:0,foldSizeY:.44,foldOffsetX:0,foldOffsetY:0,wrinkles:0,wrinkleSize:0,crumples:0,crumpleCount:6,drops:.2}};var Io=(0,vn.memo)(function({speed:t=U.params.speed,frame:o=U.params.frame,image:r="",colorBack:a=U.params.colorBack,colorPaper:n=U.params.colorPaper,colorShadow:i=U.params.colorShadow,blending:s=U.params.blending,distortion:c=U.params.distortion,clip:l=U.params.clip,angle:u=U.params.angle,seed:d=U.params.seed,roughness:p=U.params.roughness,roughnessSize:g=U.params.roughnessSize,roughnessRows:f=U.params.roughnessRows,fiber:h=U.params.fiber,fiberScale:m,fiberSize:b=m===void 0?U.params.fiberSize:.2/m,folds:y=U.params.folds,foldSizeX:A=U.params.foldSizeX,foldSizeY:v=U.params.foldSizeY,foldOffsetX:x=U.params.foldOffsetX,foldOffsetY:C=U.params.foldOffsetY,wrinkles:k=U.params.wrinkles,wrinkleSize:T=U.params.wrinkleSize,crumples:R=U.params.crumples,foldsNumber:D,crumpleCount:V=D===void 0?U.params.crumpleCount:D,drops:B=U.params.drops,fit:W=U.params.fit,scale:se=U.params.scale,rotation:ee=U.params.rotation,originX:he=U.params.originX,originY:le=U.params.originY,offsetX:ce=U.params.offsetX,offsetY:Se=U.params.offsetY,worldWidth:Le=U.params.worldWidth,worldHeight:st=U.params.worldHeight,...lt}){let ct=typeof window<"u"&&{u_noiseTexture:To()},ut={u_image:r,u_isImage:!!r,u_colorBack:q(a),u_colorPaper:q(n),u_colorShadow:q(i),u_blending:s,u_distortion:c,u_clip:l,u_angle:u,u_seed:d,u_roughness:p,u_roughnessSize:g,u_roughnessRows:f,u_fiber:h,u_fiberSize:b,u_folds:y,u_foldSizeX:A,u_foldSizeY:v,u_foldOffsetX:x,u_foldOffsetY:C,u_wrinkles:k,u_wrinkleSize:T,u_crumples:R,u_crumpleCount:V,u_drops:B,...ct,u_fit:ue[W],u_scale:se,u_rotation:ee,u_offsetX:ce,u_offsetY:Se,u_originX:he,u_originY:le,u_worldWidth:Le,u_worldHeight:st};return(0,Sn.jsx)(de,{...lt,speed:t,frame:o,fragmentShader:So,mipmaps:["u_image"],uniforms:ut})},Me);var An=S(K(),1);var Cn=S(_(),1),z={name:"Default",params:{...N,fit:"cover",speed:0,frame:0,colorBack:"#00000000",colorShadow:"#000000",colorHighlight:"#ffffff",shadows:.25,size:.5,angle:0,distortionShape:"prism",highlights:.1,shape:"lines",distortion:.5,shift:0,blur:0,edges:.25,stretch:0,margin:0,marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,grainMixer:0,grainOverlay:0}},cm={name:"Waves",params:{...N,fit:"cover",scale:1.2,speed:0,frame:0,colorBack:"#00000000",colorShadow:"#000000",colorHighlight:"#ffffff",shadows:0,size:.9,angle:0,distortionShape:"contour",highlights:0,shape:"wave",distortion:.5,shift:0,blur:.1,edges:.5,stretch:1,margin:0,marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,grainMixer:0,grainOverlay:.05}},um={name:"Abstract",params:{...N,fit:"cover",scale:4,speed:0,frame:0,colorBack:"#00000000",colorShadow:"#000000",colorHighlight:"#ffffff",shadows:0,size:.7,angle:30,distortionShape:"flat",highlights:0,shape:"linesIrregular",distortion:1,shift:0,blur:1,edges:.5,stretch:1,margin:0,marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,grainMixer:.1,grainOverlay:.1}},fm={name:"Folds",params:{...N,fit:"cover",speed:0,frame:0,colorBack:"#00000000",colorShadow:"#000000",colorHighlight:"#ffffff",shadows:.4,size:.4,angle:0,distortionShape:"cascade",highlights:0,shape:"lines",distortion:.75,shift:0,blur:.25,edges:.5,stretch:0,margin:.1,marginLeft:.1,marginRight:.1,marginTop:.1,marginBottom:.1,grainMixer:0,grainOverlay:0}};var No=(0,An.memo)(function({speed:t=z.params.speed,frame:o=z.params.frame,colorBack:r=z.params.colorBack,colorShadow:a=z.params.colorShadow,colorHighlight:n=z.params.colorHighlight,image:i="",shadows:s=z.params.shadows,angle:c=z.params.angle,distortion:l=z.params.distortion,distortionShape:u=z.params.distortionShape,highlights:d=z.params.highlights,shape:p=z.params.shape,shift:g=z.params.shift,blur:f=z.params.blur,edges:h=z.params.edges,margin:m,marginLeft:b=m??z.params.marginLeft,marginRight:y=m??z.params.marginRight,marginTop:A=m??z.params.marginTop,marginBottom:v=m??z.params.marginBottom,grainMixer:x=z.params.grainMixer,grainOverlay:C=z.params.grainOverlay,stretch:k=z.params.stretch,count:T,size:R=T===void 0?z.params.size:Math.pow(1/(T*1.6),1/6)/.7-.5,fit:D=z.params.fit,scale:V=z.params.scale,rotation:B=z.params.rotation,originX:W=z.params.originX,originY:se=z.params.originY,offsetX:ee=z.params.offsetX,offsetY:he=z.params.offsetY,worldWidth:le=z.params.worldWidth,worldHeight:ce=z.params.worldHeight,...Se}){let Le={u_image:i,u_colorBack:q(r),u_colorShadow:q(a),u_colorHighlight:q(n),u_shadows:s,u_size:R,u_angle:c,u_distortion:l,u_shift:g,u_blur:f,u_edges:h,u_stretch:k,u_distortionShape:_o[u],u_highlights:d,u_shape:Co[p],u_marginLeft:b,u_marginRight:y,u_marginTop:A,u_marginBottom:v,u_grainMixer:x,u_grainOverlay:C,u_fit:ue[D],u_scale:V,u_rotation:B,u_offsetX:ee,u_offsetY:he,u_originX:W,u_originY:se,u_worldWidth:le,u_worldHeight:ce};return(0,Cn.jsx)(de,{...Se,speed:t,frame:o,fragmentShader:Ao,mipmaps:["u_image"],uniforms:Le})});var _n=S(K(),1);var En=S(_(),1),J={name:"Default",params:{...N,fit:"cover",speed:0,frame:0,colorFront:"#94ffaf",colorBack:"#000c38",colorHighlight:"#eaff94",type:"8x8",size:2,colorSteps:2,originalColors:!1,inverted:!1}},hm={name:"Retro",params:{...N,fit:"cover",speed:0,frame:0,colorFront:"#eeeeee",colorBack:"#5452ff",colorHighlight:"#eeeeee",type:"2x2",size:3,colorSteps:1,originalColors:!0,inverted:!1}},xm={name:"Noise",params:{...N,fit:"cover",speed:0,frame:0,colorFront:"#a2997c",colorBack:"#000000",colorHighlight:"#ededed",type:"random",size:1,colorSteps:1,originalColors:!1,inverted:!1}},bm={name:"Natural",params:{...N,fit:"cover",speed:0,frame:0,colorFront:"#ffffff",colorBack:"#000000",colorHighlight:"#ffffff",type:"8x8",size:2,colorSteps:5,originalColors:!0,inverted:!1}};var Uo=(0,_n.memo)(function({speed:t=J.params.speed,frame:o=J.params.frame,colorFront:r=J.params.colorFront,colorBack:a=J.params.colorBack,colorHighlight:n=J.params.colorHighlight,image:i="",type:s=J.params.type,colorSteps:c=J.params.colorSteps,originalColors:l=J.params.originalColors,inverted:u=J.params.inverted,pxSize:d,size:p=d===void 0?J.params.size:d,fit:g=J.params.fit,scale:f=J.params.scale,rotation:h=J.params.rotation,originX:m=J.params.originX,originY:b=J.params.originY,offsetX:y=J.params.offsetX,offsetY:A=J.params.offsetY,worldWidth:v=J.params.worldWidth,worldHeight:x=J.params.worldHeight,...C}){let k={u_image:i,u_colorFront:q(r),u_colorBack:q(a),u_colorHighlight:q(n),u_type:Bt[s],u_pxSize:p,u_colorSteps:c,u_originalColors:l,u_inverted:u,u_fit:ue[g],u_rotation:h,u_scale:f,u_offsetX:y,u_offsetY:A,u_originX:m,u_originY:b,u_worldWidth:v,u_worldHeight:x};return(0,En.jsx)(de,{...C,speed:t,frame:o,fragmentShader:Eo,uniforms:k})},Me);var Bn=S(K(),1);var wn=S(_(),1),L={name:"Default",params:{...N,scale:1,fit:"contain",speed:0,frame:0,spread:.6,bias:1,angle:0,perspective:.1,count:35,dispersion:1,dispersionShift:0,dispersionColor:.6,focusCenter:.8,focusEdges:1,swirl:.35,noise:0,noiseFrequency:.25,noiseOffset:0,lensBulge:0,lensCircle:0,grainMixer:0,grainOverlay:0,imageX:0,imageY:0}},Cm={name:"Fisheye",params:{...N,scale:1,fit:"contain",speed:0,frame:0,spread:.7,bias:1,angle:0,perspective:.75,count:15,dispersion:1,dispersionShift:0,dispersionColor:.7,focusCenter:.9,focusEdges:1,swirl:1,noise:0,noiseFrequency:.25,noiseOffset:0,lensBulge:.95,lensCircle:1,grainMixer:.5,grainOverlay:0,imageX:0,imageY:0}},_m={name:"Duotone",params:{...N,fit:"contain",speed:0,frame:0,spread:.1,bias:0,angle:0,perspective:0,count:2,dispersion:1,dispersionShift:0,dispersionColor:.1,focusCenter:0,focusEdges:0,swirl:0,noise:0,noiseFrequency:.25,noiseOffset:0,lensBulge:0,lensCircle:0,grainMixer:.1,grainOverlay:.3,imageX:0,imageY:0}},Em={name:"Smoke",params:{...N,scale:1,fit:"contain",speed:0,frame:0,spread:.65,bias:-1,angle:0,perspective:.4,count:50,dispersion:0,dispersionShift:0,dispersionColor:.31,focusCenter:0,focusEdges:.6,swirl:0,noise:1,noiseFrequency:.35,noiseOffset:.3,lensBulge:0,lensCircle:0,grainMixer:0,grainOverlay:0,imageX:0,imageY:0}};var Oo=(0,Bn.memo)(function({speed:t=L.params.speed,frame:o=L.params.frame,image:r="",spread:a=L.params.spread,bias:n=L.params.bias,angle:i=L.params.angle,perspective:s=L.params.perspective,count:c=L.params.count,dispersion:l=L.params.dispersion,dispersionShift:u=L.params.dispersionShift,dispersionColor:d=L.params.dispersionColor,focusCenter:p=L.params.focusCenter,focusEdges:g=L.params.focusEdges,swirl:f=L.params.swirl,noise:h=L.params.noise,noiseFrequency:m=L.params.noiseFrequency,noiseOffset:b=L.params.noiseOffset,lensBulge:y=L.params.lensBulge,lensCircle:A=L.params.lensCircle,grainMixer:v=L.params.grainMixer,grainOverlay:x=L.params.grainOverlay,imageX:C=L.params.imageX,imageY:k=L.params.imageY,fit:T=L.params.fit,scale:R=L.params.scale,rotation:D=L.params.rotation,originX:V=L.params.originX,originY:B=L.params.originY,offsetX:W=L.params.offsetX,offsetY:se=L.params.offsetY,worldWidth:ee=L.params.worldWidth,worldHeight:he=L.params.worldHeight,...le}){let ce={u_image:r,u_spread:a,u_bias:n,u_angle:i,u_perspective:s,u_count:c,u_dispersion:l,u_dispersionShift:u,u_dispersionColor:d,u_focusCenter:p,u_focusEdges:g,u_swirl:f,u_noise:h,u_noiseFrequency:m,u_noiseOffset:b,u_lensBulge:y,u_lensCircle:A,u_grainMixer:v,u_grainOverlay:x,u_imageX:C,u_imageY:k,u_fit:ue[T],u_rotation:D,u_scale:R,u_offsetX:W,u_offsetY:se,u_originX:V,u_originY:B,u_worldWidth:ee,u_worldHeight:he};return(0,wn.jsx)(de,{...le,speed:t,frame:o,fragmentShader:Bo,mipmaps:["u_image"],uniforms:ce})},Me);var kn=S(K(),1);var Rn=S(_(),1),Y={name:"Default",params:{...N,fit:"cover",speed:0,frame:0,colorBack:"#f2f1e8",colorFront:"#2b2b2b",size:.5,radius:1.25,contrast:.4,originalColors:!1,inverted:!1,grainMixer:.2,grainOverlay:.2,grainSize:.5,grid:"hex",type:"gooey"}},Tm={name:"LED screen",params:{...N,fit:"cover",speed:0,frame:0,colorBack:"#000000",colorFront:"#29ff7b",size:.5,radius:1.5,contrast:.3,originalColors:!1,inverted:!1,grainMixer:0,grainOverlay:0,grainSize:.5,grid:"square",type:"soft"}},Fm={name:"Mosaic",params:{...N,fit:"cover",speed:0,frame:0,colorBack:"#000000",colorFront:"#b2aeae",size:.6,radius:2,contrast:.01,originalColors:!0,inverted:!1,grainMixer:0,grainOverlay:0,grainSize:.5,grid:"hex",type:"classic"}},Mm={name:"Round and square",params:{...N,fit:"cover",speed:0,frame:0,colorBack:"#141414",colorFront:"#ff8000",size:.8,radius:1,contrast:1,originalColors:!1,inverted:!0,grainMixer:.05,grainOverlay:.3,grainSize:.5,grid:"square",type:"holes"}};var Vo=(0,kn.memo)(function({speed:t=Y.params.speed,frame:o=Y.params.frame,colorFront:r=Y.params.colorFront,colorBack:a=Y.params.colorBack,image:n="",size:i=Y.params.size,radius:s=Y.params.radius,contrast:c=Y.params.contrast,originalColors:l=Y.params.originalColors,inverted:u=Y.params.inverted,grainMixer:d=Y.params.grainMixer,grainOverlay:p=Y.params.grainOverlay,grainSize:g=Y.params.grainSize,grid:f=Y.params.grid,type:h=Y.params.type,fit:m=Y.params.fit,scale:b=Y.params.scale,rotation:y=Y.params.rotation,originX:A=Y.params.originX,originY:v=Y.params.originY,offsetX:x=Y.params.offsetX,offsetY:C=Y.params.offsetY,worldWidth:k=Y.params.worldWidth,worldHeight:T=Y.params.worldHeight,...R}){let D={u_image:n,u_colorFront:q(r),u_colorBack:q(a),u_size:i,u_radius:s,u_contrast:c,u_originalColors:l,u_inverted:u,u_grainMixer:d,u_grainOverlay:p,u_grainSize:g,u_grid:Ro[f],u_type:ko[h],u_fit:ue[m],u_rotation:y,u_scale:b,u_offsetX:x,u_offsetY:C,u_originX:A,u_originY:v,u_worldWidth:k,u_worldHeight:T};return(0,Rn.jsx)(de,{...R,speed:t,frame:o,fragmentShader:wo,uniforms:D})},Me);var Xe=S(_(),1),Tn=1280*720,ds=.12,Ye=e=>Math.min(1,Math.max(0,e/255)),ms=e=>Math.min(2,Math.max(0,e)),zo=e=>Math.min(1,Math.max(0,e)),wt=(e,t,o)=>e+(t-e)*o,ps=(e,t,o,r,a)=>{let n=Ye(e)*.22+Ye(t)*.18+Ye(o)*.22+Ye(r)*.28+Ye(a)*.1;return Math.pow(n,.55)},gs=(e,t,o)=>Math.max(o*.84,zo((e-t)*7)),hs=(e,t)=>zo(e*.42+t*.85),xs=(e,t,o)=>o?hs(e,t):zo(e),Lt=(e,t,o,r)=>ms(r?e*ds:wt(e,t,o)),bs=(e,t,o)=>{let r=e[0]??t.secondaryColor;if(o==="cover-only"){let s=e[1]??r,c=e[2]??s,l=e[3]??r,u=e[4]??s,d=e[5]??c;return{ditheringBack:c,ditheringFront:r,mesh:[r,s,c,l,u,d]}}let a=e[1]??t.primaryColor,n=e[2]??r,i=e[3]??a;return{ditheringBack:t.backgroundColor,ditheringFront:r,mesh:[r,a,n,i,t.backgroundColor,t.accentColor]}},ys=({theme:e,coverUrl:t,audioPower:o,audioBands:r,staticMode:a,paused:n,tuning:i})=>{let s=(0,me.useRef)(null),c=(0,me.useRef)(null),l=(0,me.useRef)(null),u=(0,me.useRef)(null),d=(0,me.useRef)(n),[p,g]=(0,me.useState)([]),f=i??St,h=f.displayMode!=="mesh",m=f.displayMode!=="dithering";d.current=n,(0,me.useEffect)(()=>{let y=!0;return t?($r(t,6).then(A=>{y&&g(A)}),()=>{y=!1}):(g([]),()=>{y=!1})},[t]);let b=(0,me.useMemo)(()=>bs(p,e,f.colorSource),[p,e,f.colorSource]);return(0,me.useEffect)(()=>{let y=s.current?.paperShaderMount,A=c.current?.paperShaderMount;if(a){y?.setSpeed(0),A?.setSpeed(0);return}let v=0,x=0,C=0,k=0,T=0,R=0,D=0,V=()=>{let B=d.current,W=B?0:Ye(o.get()),se=B?0:Ye(r.bass.get()),ee=B?0:ps(r.bass.get(),r.lowMid.get(),r.mid.get(),r.vocal.get(),r.treble.get()),he=B?0:Ye(Math.max(r.mid.get(),r.vocal.get()));x=wt(x,W,.12),C=wt(C,se,.16),k=wt(k,he,.13),D=f.enhancedBeatResponse?gs(ee,R,D):0,R=ee;let le=xs(ee,D,f.enhancedBeatResponse);T=wt(T,le,le>T?.42:.14);let ce=s.current?.paperShaderMount,Se=c.current?.paperShaderMount;ce?.setSpeed(Lt(f.ditheringSpeed,f.ditheringAudioSpeed,T,B)),ce?.setUniforms({u_pxSize:Math.max(.5,f.ditheringSize-C*f.ditheringSize*.34)}),Se?.setSpeed(Lt(f.meshSpeed,f.meshAudioSpeed,T,B)),Se?.setUniforms({u_distortion:f.meshDistortion+x*.62,u_swirl:f.meshSwirl+k*.38}),l.current&&(l.current.style.opacity=m?`${Math.min(1,f.ditheringOpacity+C*.25)}`:"1",l.current.style.transform=`scale(${1.015+C*.025})`),u.current&&(u.current.style.filter=`saturate(${1.04+k*.34}) brightness(${.94+x*.16})`,u.current.style.transform=`scale(${1.025+x*.018})`),v=requestAnimationFrame(V)};return v=requestAnimationFrame(V),()=>cancelAnimationFrame(v)},[r,o,m,a,f]),(0,Xe.jsxs)("div",{className:"absolute inset-0 z-0 overflow-hidden",style:{backgroundColor:e.backgroundColor,pointerEvents:"none"},children:[m&&(0,Xe.jsx)("div",{ref:u,className:"absolute inset-0",style:{transform:"scale(1.025)",transformOrigin:"center"},children:(0,Xe.jsx)(Po,{ref:c,width:"100%",height:"100%",colors:b.mesh,distortion:f.meshDistortion,swirl:f.meshSwirl,grainMixer:0,grainOverlay:.01,speed:a?0:Lt(f.meshSpeed,f.meshAudioSpeed,0,n),minPixelRatio:1,maxPixelCount:Tn,style:{width:"100%",height:"100%"}})}),h&&(0,Xe.jsx)("div",{ref:l,className:"absolute inset-0",style:{mixBlendMode:m?"soft-light":"normal",opacity:m?f.ditheringOpacity:1,transform:"scale(1.015)",transformOrigin:"center"},children:(0,Xe.jsx)(Do,{ref:s,width:"100%",height:"100%",colorBack:b.ditheringBack,colorFront:b.ditheringFront,shape:"warp",type:"4x4",size:f.ditheringSize,speed:a?0:Lt(f.ditheringSpeed,f.ditheringAudioSpeed,0,n),minPixelRatio:1,maxPixelCount:Tn,style:{width:"100%",height:"100%"}})}),f.overlayEnabled&&f.overlayOpacity>0&&(0,Xe.jsx)("div",{className:"absolute inset-0",style:{backgroundColor:e.backgroundColor,opacity:f.overlayOpacity}})]})},Fn=me.default.memo(ys);var I=S(_(),1),Oe=({label:e,value:t,min:o,max:r,step:a,format:n=p=>p.toFixed(1),rangeInputClass:i,theme:s,onChange:c,onPointerDown:l,onPointerUp:u,disabled:d=!1})=>(0,I.jsxs)("label",{className:"block space-y-2",children:[(0,I.jsxs)("span",{className:"flex justify-between gap-3 text-sm",style:{color:s.primaryColor},children:[(0,I.jsx)("span",{children:e}),(0,I.jsx)("span",{className:"font-mono opacity-70",children:n(t)})]}),(0,I.jsx)("input",{type:"range",min:o,max:r,step:a,value:t,disabled:d,onChange:p=>c(Number(p.target.value)),onPointerDown:l,onPointerUp:u,className:i})]}),vs=({t:e,isDaylight:t,theme:o,controlCardBg:r,rangeInputClass:a,tuning:n,onTuningChange:i,onSliderPointerDown:s,onSliderCommit:c})=>{let l=E(o.secondaryColor,t?.18:.16),u=E(o.accentColor,t?.1:.16),d=[["dithering",e("options.latentDisplayDithering")],["mesh",e("options.latentDisplayMesh")],["both",e("options.latentDisplayBoth")]],p=[["cover-theme",e("options.latentColorSourceCoverTheme")],["cover-only",e("options.latentColorSourceCoverOnly")]],g={rangeInputClass:a,theme:o,onPointerDown:s,onPointerUp:c};return(0,I.jsxs)("div",{className:"rounded-[24px] border p-4 space-y-5",style:{backgroundColor:r,borderColor:l},children:[(0,I.jsxs)("div",{className:"space-y-1",children:[(0,I.jsx)("div",{className:"text-sm font-medium",style:{color:o.primaryColor},children:e("options.latentBackgroundSettings")}),(0,I.jsx)("div",{className:"text-xs opacity-70",style:{color:o.secondaryColor},children:e("options.latentBackgroundSettingsDesc")})]}),(0,I.jsxs)("div",{className:"space-y-2",children:[(0,I.jsx)("div",{className:"text-sm",style:{color:o.primaryColor},children:e("options.latentDisplayMode")}),(0,I.jsx)("div",{className:"grid grid-cols-3 gap-2",children:d.map(([f,h])=>(0,I.jsx)("button",{type:"button",onClick:()=>i?.({displayMode:f}),className:"rounded-xl border px-2 py-2 text-xs",style:{borderColor:n.displayMode===f?o.accentColor:l,backgroundColor:n.displayMode===f?u:"transparent",color:o.primaryColor},children:h},f))})]}),(0,I.jsxs)("div",{className:"space-y-2",children:[(0,I.jsx)("div",{className:"text-sm",style:{color:o.primaryColor},children:e("options.latentColorSource")}),(0,I.jsx)("div",{className:"grid grid-cols-2 gap-2",children:p.map(([f,h])=>(0,I.jsx)("button",{type:"button",onClick:()=>i?.({colorSource:f}),className:"rounded-xl border px-2 py-2 text-xs",style:{borderColor:n.colorSource===f?o.accentColor:l,backgroundColor:n.colorSource===f?u:"transparent",color:o.primaryColor},children:h},f))})]}),(0,I.jsx)(X,{label:e("options.latentDynamicOnlyInPlayer"),description:e("options.latentDynamicOnlyInPlayerDesc"),checked:n.dynamicOnlyInPlayer,onChange:f=>i?.({dynamicOnlyInPlayer:f}),theme:o}),(0,I.jsx)(X,{label:e("options.latentEnhancedBeatResponse"),description:e("options.latentEnhancedBeatResponseDesc"),checked:n.enhancedBeatResponse,onChange:f=>i?.({enhancedBeatResponse:f}),theme:o}),(0,I.jsxs)("div",{className:"space-y-3 rounded-2xl border p-3",style:{borderColor:l},children:[(0,I.jsx)(X,{label:e("options.nomandBackgroundOverlay"),description:e("options.nomandBackgroundOverlayDesc"),checked:n.overlayEnabled,onChange:f=>i?.({overlayEnabled:f}),theme:o}),(0,I.jsx)("div",{className:n.overlayEnabled?"":"opacity-45",children:(0,I.jsx)(Oe,{...g,label:e("options.nomandBackgroundOverlayOpacity"),value:n.overlayOpacity,disabled:!n.overlayEnabled,min:0,max:1,step:.05,format:f=>`${Math.round(f*100)}%`,onChange:f=>i?.({overlayOpacity:f})})})]}),(0,I.jsxs)("div",{className:"space-y-4 rounded-2xl border p-3",style:{borderColor:l},children:[(0,I.jsx)("div",{className:"text-xs font-medium uppercase tracking-[0.2em]",style:{color:o.secondaryColor},children:e("options.latentDitheringGroup")}),(0,I.jsx)(Oe,{...g,label:e("options.latentBaseSpeed"),value:n.ditheringSpeed,min:0,max:2,step:.1,onChange:f=>i?.({ditheringSpeed:f})}),(0,I.jsx)(Oe,{...g,label:e("options.latentAudioSpeed"),value:n.ditheringAudioSpeed,min:0,max:2,step:.1,onChange:f=>i?.({ditheringAudioSpeed:f})}),(0,I.jsx)(Oe,{...g,label:e("options.latentDitheringSize"),value:n.ditheringSize,min:.5,max:8,step:.25,onChange:f=>i?.({ditheringSize:f})}),(0,I.jsx)(Oe,{...g,label:e("options.latentDitheringOpacity"),value:n.ditheringOpacity,min:0,max:1,step:.05,format:f=>`${Math.round(f*100)}%`,onChange:f=>i?.({ditheringOpacity:f})})]}),(0,I.jsxs)("div",{className:"space-y-4 rounded-2xl border p-3",style:{borderColor:l},children:[(0,I.jsx)("div",{className:"text-xs font-medium uppercase tracking-[0.2em]",style:{color:o.secondaryColor},children:e("options.latentMeshGroup")}),(0,I.jsx)(Oe,{...g,label:e("options.latentBaseSpeed"),value:n.meshSpeed,min:0,max:2,step:.1,onChange:f=>i?.({meshSpeed:f})}),(0,I.jsx)(Oe,{...g,label:e("options.latentAudioSpeed"),value:n.meshAudioSpeed,min:0,max:2,step:.1,onChange:f=>i?.({meshAudioSpeed:f})}),(0,I.jsx)(Oe,{...g,label:e("options.latentMeshDistortion"),value:n.meshDistortion,min:0,max:2,step:.05,onChange:f=>i?.({meshDistortion:f})}),(0,I.jsx)(Oe,{...g,label:e("options.latentMeshSwirl"),value:n.meshSwirl,min:0,max:1,step:.05,onChange:f=>i?.({meshSwirl:f})})]})]})},Mn=vs;var Pe=S(_(),1),Lo=["dithering","mesh","both"],Ss={dithering:"options.latentDisplayDithering",mesh:"options.latentDisplayMesh",both:"options.latentDisplayBoth"},As=_e({mode:"latent",order:35,labelKey:"options.visualizerBackgroundModeLatent",labelFallback:"Latent",render:({config:e,theme:t,coverUrl:o,audioPower:r,audioBands:a,staticMode:n,paused:i})=>(0,Pe.jsx)(Fn,{theme:t,coverUrl:o,audioPower:r,audioBands:a,staticMode:n,paused:i,tuning:e?.latent?.tuning}),renderSettingsPanel:({config:e,actions:t,...o})=>(0,Pe.jsx)(Mn,{...o,tuning:e?.latent?.tuning??St,onTuningChange:t?.latent?.onTuningChange}),renderQuickControls:({config:e,actions:t,t:o,isDaylight:r,theme:a})=>{let n=e?.latent?.tuning??St,i=o(Ss[n.displayMode]),s=()=>{let c=Lo.indexOf(n.displayMode);t?.latent?.onTuningChange?.({displayMode:Lo[(c+1)%Lo.length]})};return(0,Pe.jsxs)(Pe.Fragment,{children:[(0,Pe.jsx)(Ot,{isDaylight:r,label:i,title:`${o("options.latentDisplayMode")}: ${i}`,onClick:s}),(0,Pe.jsx)(Ge,{active:n.overlayEnabled,theme:a,label:o("options.nomandBackgroundOverlay"),onToggle:()=>t?.latent?.onTuningChange?.({overlayEnabled:!n.overlayEnabled}),children:(0,Pe.jsx)(Ut,{size:14})})]})},resetSettings:e=>e?.latent?.onResetTuning?.()});var er={};ft(er,{default:()=>fl});var qe=S(K(),1);var M=S(K(),1);function Ht(){return(Ht=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var o=arguments[t];for(var r in o)Object.prototype.hasOwnProperty.call(o,r)&&(e[r]=o[r])}return e}).apply(this,arguments)}function Nn(e,t){if(e==null)return{};var o,r,a={},n=Object.keys(e);for(r=0;r<n.length;r++)t.indexOf(o=n[r])>=0||(a[o]=e[o]);return a}function kt(e){var t=(0,M.useRef)(e),o=(0,M.useRef)(function(r){t.current&&t.current(r)});return t.current=e,o.current}var Tt=function(e,t,o){return t===void 0&&(t=0),o===void 0&&(o=1),e>o?o:e<t?t:e},Rt=function(e){return"touches"in e},Ho=function(e){return e&&e.ownerDocument.defaultView||self},Pn=function(e,t,o){var r=e.getBoundingClientRect(),a=Rt(t)?(function(n,i){for(var s=0;s<n.length;s++)if(n[s].identifier===i)return n[s];return n[0]})(t.touches,o):t;return{left:Tt((a.pageX-(r.left+Ho(e).pageXOffset))/r.width),top:Tt((a.pageY-(r.top+Ho(e).pageYOffset))/r.height)}},Dn=function(e){!Rt(e)&&e.preventDefault()},Un=M.default.memo(function(e){var t=e.onMove,o=e.onKey,r=e.onEnd,a=Nn(e,["onMove","onKey","onEnd"]),n=(0,M.useRef)(null),i=kt(t),s=kt(o),c=kt(r),l=(0,M.useRef)(null),u=(0,M.useRef)(!1),d=(0,M.useMemo)(function(){var m=function(A){Dn(A),(Rt(A)?A.touches.length>0:A.buttons>0)&&n.current?i(Pn(n.current,A,l.current)):(y(!1),c())},b=function(){y(!1),c()};function y(A){var v=u.current,x=Ho(n.current),C=A?x.addEventListener:x.removeEventListener;C(v?"touchmove":"mousemove",m),C(v?"touchend":"mouseup",b)}return[function(A){var v=A.nativeEvent,x=n.current;if(x&&(Dn(v),!(function(k,T){return T&&!Rt(k)})(v,u.current)&&x)){if(Rt(v)){u.current=!0;var C=v.changedTouches||[];C.length&&(l.current=C[0].identifier)}x.focus(),i(Pn(x,v,l.current)),y(!0)}},function(A){var v=A.which||A.keyCode;v<37||v>40||(A.preventDefault(),s({left:v===39?.05:v===37?-.05:0,top:v===40?.05:v===38?-.05:0}))},function(A){var v=A.which||A.keyCode;v>=37&&v<=40&&c()},y]},[s,i,c]),p=d[0],g=d[1],f=d[2],h=d[3];return(0,M.useEffect)(function(){return h},[h]),M.default.createElement("div",Ht({},a,{onTouchStart:p,onMouseDown:p,className:"react-colorful__interactive",ref:n,onKeyDown:g,onKeyUp:f,tabIndex:0,role:"slider"}))}),Yo=function(e){return e.filter(Boolean).join(" ")},On=function(e){var t=e.color,o=e.left,r=e.top,a=r===void 0?.5:r,n=Yo(["react-colorful__pointer",e.className]);return M.default.createElement("div",{className:n,style:{top:100*a+"%",left:100*o+"%"}},M.default.createElement("div",{className:"react-colorful__pointer-fill",style:{backgroundColor:t}}))},ye=function(e,t,o){return t===void 0&&(t=0),o===void 0&&(o=Math.pow(10,t)),Math.round(o*e)/o},l0={grad:.9,turn:360,rad:360/(2*Math.PI)},Cs=function(e){return ks(Wo(e))},Wo=function(e){return e[0]==="#"&&(e=e.substring(1)),e.length<6?{r:parseInt(e[0]+e[0],16),g:parseInt(e[1]+e[1],16),b:parseInt(e[2]+e[2],16),a:e.length===4?ye(parseInt(e[3]+e[3],16)/255,2):1}:{r:parseInt(e.substring(0,2),16),g:parseInt(e.substring(2,4),16),b:parseInt(e.substring(4,6),16),a:e.length===8?ye(parseInt(e.substring(6,8),16)/255,2):1}};var _s=function(e){return ws(Bs(e))},Es=function(e){var t=e.s,o=e.v,r=e.a,a=(200-t)*o/100;return{h:ye(e.h),s:ye(a>0&&a<200?t*o/100/(a<=100?a:200-a)*100:0),l:ye(a/2),a:ye(r,2)}},Qo=function(e){var t=Es(e);return"hsl("+t.h+", "+t.s+"%, "+t.l+"%)"};var Bs=function(e){var t=e.h,o=e.s,r=e.v,a=e.a;t=t/360*6,o/=100,r/=100;var n=Math.floor(t),i=r*(1-o),s=r*(1-(t-n)*o),c=r*(1-(1-t+n)*o),l=n%6;return{r:ye(255*[r,s,i,i,c,r][l]),g:ye(255*[c,r,r,s,i,i][l]),b:ye(255*[i,i,c,r,r,s][l]),a:ye(a,2)}};var Gt=function(e){var t=e.toString(16);return t.length<2?"0"+t:t},ws=function(e){var t=e.r,o=e.g,r=e.b,a=e.a,n=a<1?Gt(ye(255*a)):"";return"#"+Gt(t)+Gt(o)+Gt(r)+n},ks=function(e){var t=e.r,o=e.g,r=e.b,a=e.a,n=Math.max(t,o,r),i=n-Math.min(t,o,r),s=i?n===t?(o-r)/i:n===o?2+(r-t)/i:4+(t-o)/i:0;return{h:60*(s<0?s+6:s),s:n?i/n*100:0,v:n/255*100,a}};var Rs=M.default.memo(function(e){var t=e.hue,o=e.onChange,r=e.onChangeEnd,a=Yo(["react-colorful__hue",e.className]);return M.default.createElement("div",{className:a},M.default.createElement(Un,{onMove:function(n){o({h:360*n.left})},onKey:function(n){o({h:Tt(t+360*n.left,0,360)})},onEnd:r,"aria-label":"Hue","aria-valuenow":ye(t),"aria-valuemax":"360","aria-valuemin":"0"},M.default.createElement(On,{className:"react-colorful__hue-pointer",left:t/360,color:Qo({h:t,s:100,v:100,a:1})})))}),Ts=M.default.memo(function(e){var t=e.hsva,o=e.onChange,r=e.onChangeEnd,a={backgroundColor:Qo({h:t.h,s:100,v:100,a:1})};return M.default.createElement("div",{className:"react-colorful__saturation",style:a},M.default.createElement(Un,{onMove:function(n){o({s:100*n.left,v:100-100*n.top})},onKey:function(n){o({s:Tt(t.s+100*n.left,0,100),v:Tt(t.v-100*n.top,0,100)})},onEnd:r,"aria-label":"Color","aria-valuetext":"Saturation "+ye(t.s)+"%, Brightness "+ye(t.v)+"%"},M.default.createElement(On,{className:"react-colorful__saturation-pointer",top:1-t.v/100,left:t.s/100,color:Qo(t)})))}),Vn=function(e,t){if(e===t)return!0;for(var o in e)if(e[o]!==t[o])return!1;return!0};var Fs=function(e,t){return e.toLowerCase()===t.toLowerCase()||Vn(Wo(e),Wo(t))};function Ms(e,t,o,r){var a=kt(o),n=kt(r),i=(0,M.useState)(function(){return e.toHsva(t)}),s=i[0],c=i[1],l=(0,M.useRef)({color:t,hsva:s}),u=(0,M.useRef)(!1);(0,M.useEffect)(function(){if(!e.equal(t,l.current.color)){var g=e.toHsva(t);l.current={hsva:g,color:t},c(g),u.current=!1}},[t,e]),(0,M.useEffect)(function(){var g;Vn(s,l.current.hsva)||e.equal(g=e.fromHsva(s),l.current.color)||(l.current={hsva:s,color:g},a(g),u.current=!0)},[s,e,a]);var d=(0,M.useCallback)(function(g){c(function(f){return Object.assign({},f,g)})},[]),p=(0,M.useCallback)(function(){u.current&&(u.current=!1,n(l.current.color))},[n]);return[s,d,p]}var Ps,Ds=typeof window<"u"?M.useLayoutEffect:M.useEffect,Is=function(){return Ps||(typeof __webpack_nonce__<"u"?__webpack_nonce__:void 0)};var In=new WeakMap,Ns=function(e){Ds(function(){var t=e.current;if(typeof document<"u"&&t){var o=t.getRootNode?t.getRootNode():t.ownerDocument,r=o&&("head"in o||"host"in o)?o:t.ownerDocument;if(!In.has(r)){var a="head"in r?r.head:r,n=(a.ownerDocument||document).createElement("style");n.innerHTML=`.react-colorful{position:relative;display:flex;flex-direction:column;width:200px;height:200px;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;cursor:default}.react-colorful__saturation{position:relative;flex-grow:1;border-color:transparent;border-bottom:12px solid #000;border-radius:8px 8px 0 0;background-image:linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsla(0,0%,100%,0))}.react-colorful__alpha-gradient,.react-colorful__pointer-fill{content:"";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;border-radius:inherit}.react-colorful__alpha-gradient,.react-colorful__saturation{box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}.react-colorful__alpha,.react-colorful__hue{position:relative;height:24px}.react-colorful__hue{background:linear-gradient(90deg,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red)}.react-colorful__last-control{border-radius:0 0 8px 8px}.react-colorful__interactive{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;outline:none;touch-action:none}.react-colorful__pointer{position:absolute;z-index:1;box-sizing:border-box;width:28px;height:28px;transform:translate(-50%,-50%);background-color:#fff;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.2)}.react-colorful__interactive:focus .react-colorful__pointer{transform:translate(-50%,-50%) scale(1.1)}.react-colorful__alpha,.react-colorful__alpha-pointer{background-color:#fff;background-image:url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><path d="M8 0h8v8H8zM0 8h8v8H0z"/></svg>')}.react-colorful__saturation-pointer{z-index:3}.react-colorful__hue-pointer{z-index:2}`;var i=Is();i&&n.setAttribute("nonce",i),In.set(r,n),a.appendChild(n)}}},[])},Us=function(e){var t=e.className,o=e.colorModel,r=e.color,a=r===void 0?o.defaultColor:r,n=e.onChange,i=e.onChangeEnd,s=Nn(e,["className","colorModel","color","onChange","onChangeEnd"]),c=(0,M.useRef)(null);Ns(c);var l=Ms(o,a,n,i),u=l[0],d=l[1],p=l[2],g=Yo(["react-colorful",t]);return M.default.createElement("div",Ht({},s,{ref:c,className:g}),M.default.createElement(Ts,{hsva:u,onChange:d,onChangeEnd:p}),M.default.createElement(Rs,{hue:u.h,onChange:d,onChangeEnd:p,className:"react-colorful__last-control"}))},Os={defaultColor:"000",toHsva:Cs,fromHsva:function(e){return _s({h:e.h,s:e.s,v:e.v,a:1})},equal:Fs},zn=function(e){return M.default.createElement(Us,Ht({},e,{colorModel:Os}))};var w=S(_(),1),Ln=({children:e,theme:t})=>(0,w.jsx)("div",{className:"text-xs font-medium uppercase tracking-[0.24em] opacity-45",style:{color:t.secondaryColor},children:e}),Xo=({label:e,value:t,options:o,onChange:r,isDaylight:a,theme:n})=>(0,w.jsxs)("div",{className:"space-y-2.5",children:[(0,w.jsx)(Ln,{theme:n,children:e}),(0,w.jsx)("div",{className:"flex flex-wrap gap-2",children:o.map(i=>{let s=i.value===t;return(0,w.jsx)("button",{type:"button",onClick:()=>{i.disabled||r(i.value)},disabled:i.disabled,className:"rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45",style:{color:i.disabled?E(n.secondaryColor,.72):n.primaryColor,borderColor:s?n.accentColor:E(n.secondaryColor,a?.18:.14),backgroundColor:s?E(n.accentColor,a?.1:.16):E(n.backgroundColor,a?.24:.34),boxShadow:s?`inset 0 0 0 1px ${n.accentColor}`:"none"},children:i.label},String(i.value))})})]}),et=({label:e,valueLabel:t,value:o,min:r,max:a,step:n,onChange:i,rangeInputClass:s,onSliderPointerDown:c,onSliderCommit:l})=>(0,w.jsxs)("div",{className:"space-y-2",children:[(0,w.jsxs)("div",{className:"flex items-center justify-between gap-3 text-sm",style:{color:"var(--text-primary)"},children:[(0,w.jsx)("span",{children:e}),(0,w.jsx)("span",{className:"font-mono opacity-70",style:{color:"var(--text-secondary)"},children:t})]}),(0,w.jsx)("input",{type:"range",min:r,max:a,step:n,value:o,onChange:u=>i(parseFloat(u.target.value)),onPointerDown:c,onPointerUp:l,onPointerCancel:l,onBlur:l,className:s})]}),tt=(e,t,o,r)=>Number.isFinite(e)?Math.min(o,Math.max(t,e)):r,Vs=e=>{let t=e.trim().replace(/^#/,"");return/^[0-9a-fA-F]{6}$/.test(t)?`#${t.toLowerCase()}`:null},Gn=({t:e,isDaylight:t,theme:o,controlCardBg:r,rangeInputClass:a,tuning:n=G,onTuningChange:i,monetBackgroundImage:s,onUploadMonetBackgroundImage:c,onClearMonetBackgroundImage:l,isLoadingMonetBackgroundImage:u=!1,onSliderPointerDown:d,onSliderCommit:p})=>{let g=(0,qe.useRef)(null),[f,h]=(0,qe.useState)(null),m={backgroundSource:n.backgroundSource??G.backgroundSource,backgroundLayout:n.backgroundLayout??G.backgroundLayout,backgroundBlurPx:tt(n.backgroundBlurPx??G.backgroundBlurPx,0,60,G.backgroundBlurPx),backgroundOverlayOpacity:tt(n.backgroundOverlayOpacity??G.backgroundOverlayOpacity,0,1,G.backgroundOverlayOpacity),backgroundGrayscale:tt(n.backgroundGrayscale??G.backgroundGrayscale,0,1,G.backgroundGrayscale),backgroundSaturation:tt(n.backgroundSaturation??G.backgroundSaturation,0,2,G.backgroundSaturation),backgroundWash:tt(n.backgroundWash??G.backgroundWash,0,1,G.backgroundWash),backgroundHalfPaneOffsetX:tt(n.backgroundHalfPaneOffsetX??G.backgroundHalfPaneOffsetX,-40,40,G.backgroundHalfPaneOffsetX),backgroundWashColorMode:n.backgroundWashColorMode??G.backgroundWashColorMode,backgroundWashCustomColor:Vs(n.backgroundWashCustomColor)??G.backgroundWashCustomColor,backgroundDriftEnabled:n.backgroundDriftEnabled??G.backgroundDriftEnabled,backgroundDriftStrength:tt(n.backgroundDriftStrength??G.backgroundDriftStrength,0,1,G.backgroundDriftStrength),backgroundStreaksEnabled:n.backgroundStreaksEnabled??G.backgroundStreaksEnabled},b=(0,qe.useMemo)(()=>[{value:"cover-derived",label:e("options.monetBackgroundSourceCover")},{value:"uploaded-global",label:e("options.monetBackgroundSourceUploaded"),disabled:!s&&!u}],[u,s,e]),y=(0,qe.useMemo)(()=>[{value:"half-pane-gradient",label:e("options.monetLayoutHalfPane")},{value:"full-overlay",label:e("options.monetLayoutFullOverlay")}],[e]),A=(0,qe.useMemo)(()=>[{value:"theme",label:e("options.monetBackgroundWashTheme")},{value:"custom",label:e("options.monetBackgroundWashCustom")}],[e]),v=async x=>{let C=Array.from(x.target.files??[]);if(x.target.value="",h(null),!C.length||!c)return;let k=await c(C);k.ok?(i?.({backgroundSource:"uploaded-global"}),h(C[0].name)):h(k.error||e("options.monetUploadBackground"))};return(0,w.jsxs)("div",{className:"rounded-[24px] border p-4 space-y-4",style:{backgroundColor:r,borderColor:E(o.secondaryColor,.16)},children:[(0,w.jsxs)("div",{className:"space-y-1",children:[(0,w.jsx)("div",{className:"text-sm font-medium",style:{color:o.primaryColor},children:e("options.monetBackgroundSettings")}),(0,w.jsx)("div",{className:"text-xs opacity-70",style:{color:o.secondaryColor},children:e("options.monetBackgroundSettingsDesc")})]}),(0,w.jsxs)("div",{className:"space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5",children:[(0,w.jsx)("div",{className:"text-xs font-semibold uppercase tracking-wider opacity-65",style:{color:o.accentColor},children:e("options.monetGroupBackgroundSource")}),(0,w.jsx)(Xo,{label:e("options.monetBackgroundSource"),value:m.backgroundSource,options:b,onChange:x=>i?.({backgroundSource:x}),isDaylight:t,theme:o}),(0,w.jsxs)("div",{className:"space-y-2.5",children:[(0,w.jsx)(Ln,{theme:o,children:e("options.monetUploadBackground")}),(0,w.jsxs)("div",{className:"flex flex-wrap items-center gap-2",children:[(0,w.jsxs)("button",{type:"button",onClick:()=>g.current?.click(),disabled:u||!c,className:"inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45",style:{color:o.primaryColor,borderColor:E(o.secondaryColor,t?.18:.14),backgroundColor:E(o.backgroundColor,t?.24:.34)},children:[(0,w.jsx)(Gr,{size:15}),(0,w.jsx)("span",{children:e("options.monetUploadBackground")})]}),(0,w.jsxs)("button",{type:"button",onClick:()=>{l?.()},disabled:!s||!l,className:"inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-45",style:{color:o.primaryColor,borderColor:E(o.secondaryColor,t?.18:.14),backgroundColor:E(o.backgroundColor,t?.24:.34)},children:[(0,w.jsx)(dt,{size:15}),(0,w.jsx)("span",{children:e("options.monetClearBackground")})]})]}),(0,w.jsx)("div",{className:"text-xs opacity-60",style:{color:"var(--text-secondary)"},children:f||s?.name||"-"}),(0,w.jsx)("input",{ref:g,type:"file",accept:".png,.jpg,.jpeg,.gif,.webp,.svg,image/*",className:"hidden",onChange:x=>{v(x)}})]})]}),(0,w.jsxs)("div",{className:"space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5",children:[(0,w.jsx)("div",{className:"text-xs font-semibold uppercase tracking-wider opacity-65",style:{color:o.accentColor},children:e("options.monetGroupLayoutPosition")}),(0,w.jsx)(Xo,{label:e("options.monetBackgroundLayout"),value:m.backgroundLayout,options:y,onChange:x=>i?.({backgroundLayout:x}),isDaylight:t,theme:o}),m.backgroundLayout==="half-pane-gradient"&&(0,w.jsx)(et,{label:e("options.monetHalfPaneOffsetX"),valueLabel:`${Math.round(m.backgroundHalfPaneOffsetX)}%`,min:-40,max:40,step:2,value:m.backgroundHalfPaneOffsetX,onChange:x=>i?.({backgroundHalfPaneOffsetX:x}),rangeInputClass:a,onSliderPointerDown:d,onSliderCommit:p}),(0,w.jsx)(X,{label:e("options.monetBackgroundDriftEnabled"),description:e("options.monetBackgroundDriftEnabledDesc"),checked:m.backgroundDriftEnabled,onChange:x=>i?.({backgroundDriftEnabled:x}),theme:o}),m.backgroundDriftEnabled&&(0,w.jsx)(et,{label:e("options.monetBackgroundDriftStrength"),valueLabel:`${Math.round(m.backgroundDriftStrength*100)}%`,min:0,max:1,step:.05,value:m.backgroundDriftStrength,onChange:x=>i?.({backgroundDriftStrength:x}),rangeInputClass:a,onSliderPointerDown:d,onSliderCommit:p})]}),(0,w.jsxs)("div",{className:"space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5",children:[(0,w.jsx)("div",{className:"text-xs font-semibold uppercase tracking-wider opacity-65",style:{color:o.accentColor},children:e("options.monetGroupFiltersPostProcessing")}),(0,w.jsx)(et,{label:e("options.monetBackgroundBlur"),valueLabel:`${Math.round(m.backgroundBlurPx)}px`,min:0,max:60,step:2,value:m.backgroundBlurPx,onChange:x=>i?.({backgroundBlurPx:x}),rangeInputClass:a,onSliderPointerDown:d,onSliderCommit:p}),(0,w.jsx)(et,{label:e("options.monetBackgroundSaturation"),valueLabel:`${Math.round(m.backgroundSaturation*100)}%`,min:0,max:2,step:.05,value:m.backgroundSaturation,onChange:x=>i?.({backgroundSaturation:x}),rangeInputClass:a,onSliderPointerDown:d,onSliderCommit:p}),(0,w.jsx)(et,{label:e("options.monetBackgroundGrayscale"),valueLabel:`${Math.round(m.backgroundGrayscale*100)}%`,min:0,max:1,step:.02,value:m.backgroundGrayscale,onChange:x=>i?.({backgroundGrayscale:x}),rangeInputClass:a,onSliderPointerDown:d,onSliderCommit:p})]}),(0,w.jsxs)("div",{className:"space-y-3.5 rounded-[18px] border border-white/5 p-3.5 bg-black/5 dark:bg-white/5",children:[(0,w.jsx)("div",{className:"text-xs font-semibold uppercase tracking-wider opacity-65",style:{color:o.accentColor},children:e("options.monetGroupColorTintWash")}),(0,w.jsx)(et,{label:e("options.monetBackgroundOverlayOpacity"),valueLabel:`${Math.round(m.backgroundOverlayOpacity*100)}%`,min:0,max:1,step:.02,value:m.backgroundOverlayOpacity,onChange:x=>i?.({backgroundOverlayOpacity:x}),rangeInputClass:a,onSliderPointerDown:d,onSliderCommit:p}),(0,w.jsx)(et,{label:e("options.monetBackgroundWash"),valueLabel:`${Math.round(m.backgroundWash*100)}%`,min:0,max:1,step:.02,value:m.backgroundWash,onChange:x=>i?.({backgroundWash:x}),rangeInputClass:a,onSliderPointerDown:d,onSliderCommit:p}),(0,w.jsx)(X,{label:e("options.monetBackgroundStreaksEnabled"),description:e("options.monetBackgroundStreaksEnabledDesc"),checked:m.backgroundStreaksEnabled,onChange:x=>i?.({backgroundStreaksEnabled:x}),theme:o}),(0,w.jsx)(Xo,{label:e("options.monetBackgroundWashColorMode"),value:m.backgroundWashColorMode,options:A,onChange:x=>i?.({backgroundWashColorMode:x}),isDaylight:t,theme:o}),m.backgroundWashColorMode==="custom"&&(0,w.jsxs)("div",{className:"space-y-3 rounded-[20px] border p-3",style:{borderColor:E(o.secondaryColor,.14),backgroundColor:E(o.backgroundColor,.2)},children:[(0,w.jsxs)("div",{className:"flex items-center justify-between gap-3",children:[(0,w.jsx)("div",{className:"text-sm",style:{color:o.primaryColor},children:e("options.monetBackgroundWashCustomColor")}),(0,w.jsx)("div",{className:"rounded-full px-3 py-1 text-xs font-mono",style:{color:o.backgroundColor,backgroundColor:m.backgroundWashCustomColor},children:m.backgroundWashCustomColor.toUpperCase()})]}),(0,w.jsx)(zn,{color:m.backgroundWashCustomColor,onChange:x=>i?.({backgroundWashCustomColor:x}),style:{width:"100%",height:180}})]})]})]})};var ve=S(K(),1);var zs=1920,Ls=1080,Hn=new Map,Gs={r:10,g:10,b:12},Hs={r:245,g:245,b:245},Ee=(e,t,o)=>Math.min(o,Math.max(t,e)),Be=(e,t,o)=>e+(t-e)*o,Qt=(e,t,o)=>.2126*e+.7152*t+.0722*o,Ws=(e,t)=>{let o=Qt(e.r,e.g,e.b),r=Qt(t.r,t.g,t.b);return o<=r?{shadow:e,highlight:t}:{shadow:t,highlight:e}},Qn=({coverUrl:e,monetBackgroundImage:t,tuning:o})=>o.backgroundSource==="uploaded-global"?t?.url??e??null:e??t?.url??null,Qs=async e=>{let t=new Image;(e.startsWith("http://")||e.startsWith("https://"))&&(t.crossOrigin="anonymous"),t.decoding="async";let o=new Promise((r,a)=>{t.onload=()=>r(),t.onerror=()=>a(new Error(`Failed to load image: ${e}`))});t.src=e;try{await t.decode()}catch{await o}return t},Wn=(e,t,o)=>{let a=e[t];return typeof a=="number"&&Number.isFinite(a)?a:o},Ys=(e,t,o,r)=>{let a=Wn(t,"width",o),n=Wn(t,"height",r);if(!a||!n)return;let i=Math.max(o/a,r/n),s=a*i,c=n*i,l=(o-s)/2,u=(r-c)/2;e.drawImage(t,l,u,s,c)},Wt=(e,t)=>{let o=At(e);return o?{r:Ee(o.r,0,255),g:Ee(o.g,0,255),b:Ee(o.b,0,255)}:t},Xs=(e,t,o,r)=>{let{shadow:a,highlight:n}=Ws(t,r);if(e<=.55){let s=e/.55;return{r:Be(a.r,o.r,s),g:Be(a.g,o.g,s),b:Be(a.b,o.b,s)}}let i=(e-.55)/.45;return{r:Be(o.r,n.r,i),g:Be(o.g,n.g,i),b:Be(o.b,n.b,i)}},qs=(e,t,o,r,a)=>{let n=Ee(a.backgroundGrayscale,0,1),i=Ee(a.backgroundSaturation,0,2),s=Ee(a.backgroundWash,0,1);if(n<=0&&Math.abs(i-1)<.001&&s<=0)return;let c=e.getImageData(0,0,t,o),l=c.data,u=Wt(r.backgroundColor,Gs),d=Wt(r.accentColor,u),p=Wt(r.primaryColor,Hs),g=Wt(a.backgroundWashCustomColor,d),f=a.backgroundWashColorMode==="custom"?g:d;for(let h=0;h<l.length;h+=4){let m=l[h],b=l[h+1],y=l[h+2];if(l[h+3]===0)continue;let v=Qt(m,b,y);if(n>0&&(m=Be(m,v,n),b=Be(b,v,n),y=Be(y,v,n)),Math.abs(i-1)>=.001){let x=Qt(m,b,y);m=x+(m-x)*i,b=x+(b-x)*i,y=x+(y-x)*i}if(s>0){let x=Xs(Ee(v/255,0,1),u,f,p);m=Be(m,x.r,s),b=Be(b,x.g,s),y=Be(y,x.b,s)}l[h]=Math.round(Ee(m,0,255)),l[h+1]=Math.round(Ee(b,0,255)),l[h+2]=Math.round(Ee(y,0,255))}e.putImageData(c,0,0)},Ks=(e,t,o,r,a)=>{let n=Ee(a.backgroundOverlayOpacity,0,1),i=e.createLinearGradient(0,0,t,o);i.addColorStop(0,E(r.accentColor,.08+n*.62)),i.addColorStop(.44,E(r.backgroundColor,.16+n*.58)),i.addColorStop(1,E(r.primaryColor,.06+n*.36)),e.fillStyle=i,e.fillRect(0,0,t,o);let s=e.createRadialGradient(t*.18,o*.34,0,t*.18,o*.34,t*.55);s.addColorStop(0,E(r.accentColor,n*.42)),s.addColorStop(1,E(r.backgroundColor,0)),e.fillStyle=s,e.fillRect(0,0,t,o);let c=e.createLinearGradient(t*.45,0,t,0);if(c.addColorStop(0,E(r.backgroundColor,0)),c.addColorStop(1,E(r.backgroundColor,.18+n*.38)),e.fillStyle=c,e.fillRect(0,0,t,o),a.backgroundStreaksEnabled!==!1){e.fillStyle=E(r.backgroundColor,.1+n*.08);for(let l=0;l<18;l+=1){let u=l*127%t,d=l*211%o-40;e.fillRect(u,d,1,o*.28)}}},qo=({coverUrl:e,monetBackgroundImage:t,theme:o,tuning:r})=>JSON.stringify({sourceUrl:Qn({coverUrl:e,monetBackgroundImage:t,tuning:r}),uploadedId:r.backgroundSource==="uploaded-global"?t?.id??null:null,theme:{backgroundColor:o.backgroundColor,primaryColor:o.primaryColor,accentColor:o.accentColor},tuning:{backgroundSource:r.backgroundSource,backgroundBlurPx:r.backgroundBlurPx,backgroundOverlayOpacity:r.backgroundOverlayOpacity,backgroundGrayscale:r.backgroundGrayscale,backgroundSaturation:r.backgroundSaturation,backgroundWash:r.backgroundWash,backgroundWashColorMode:r.backgroundWashColorMode,backgroundWashCustomColor:r.backgroundWashCustomColor,backgroundStreaksEnabled:r.backgroundStreaksEnabled}}),ht=null,Ko=()=>{if(ht!==null)return ht;if(typeof document>"u")return!1;try{let e=document.createElement("canvas");e.width=2,e.height=2;let t=e.getContext("2d");return!t||typeof t.filter!="string"?(ht=!1,!1):(t.fillStyle="#000000",t.fillRect(0,0,2,2),t.filter="blur(1px)",t.fillStyle="#ffffff",t.fillRect(0,0,1,1),ht=t.getImageData(1,1,1,1).data[0]>0,ht)}catch{return ht=!1,!1}},js=async({coverUrl:e,monetBackgroundImage:t,theme:o,tuning:r})=>{let a=Qn({coverUrl:e,monetBackgroundImage:t,tuning:r});if(!a)return null;let n=await Qs(a),i=document.createElement("canvas");i.width=zs,i.height=Ls;let s=i.getContext("2d");return s?(s.fillStyle=o.backgroundColor,s.fillRect(0,0,i.width,i.height),s.save(),Ko()&&(s.filter=`blur(${Ee(r.backgroundBlurPx,0,60)}px)`),Ys(s,n,i.width,i.height),s.restore(),qs(s,i.width,i.height,o,r),Ks(s,i.width,i.height,o,r),i.toDataURL("image/jpeg",.92)):null},Yn=e=>{let t=qo(e),o=Hn.get(t);if(o)return o;let r=js(e).catch(()=>null);return Hn.set(t,r),r};var Xn=(e,t)=>(e%t+t)%t,qn=(e,t)=>{let o=Math.sin(e*127.1+t*311.7)*43758.5453;return o-Math.floor(o)},Js=e=>e*e*(3-2*e),Kn=(e,t,o)=>{let r=Math.floor(e),a=qn(Xn(r,t),o),n=qn(Xn(r+1,t),o);return a+(n-a)*Js(e-r)},jo=(e,t)=>{let o=Kn(e,76,t),r=Kn(e*2,152,t+17.31);return(o*.68+r*.32)*2-1},Jo=e=>{let t=e.reduce((o,r)=>Math.max(o,Math.abs(r)),0);return t>0?e.map(o=>o/t):e},jn=e=>{let t=Math.min(1,Math.max(0,e)),o=3.4*t,r=1+o/100*2+.01,a=.035*t,n=[],i=[],s=[];for(let p=0;p<=156;p+=1){let g=76*p/156;n.push(jo(g,12.9898)),i.push(jo(g,78.233)),s.push(jo(g,39.425))}let c=Jo(n),l=Jo(i),u=Jo(s);return{keyframes:c.map((p,g)=>({transform:`translate3d(${(p*o).toFixed(4)}%, ${(l[g]*o).toFixed(4)}%, 0) scale(${(r+a*((u[g]+1)/2)).toFixed(5)})`})),durationMs:24e4,maxTravelPercent:o,minScale:r}};var Zn=["lattice","transitionOverlay","collectionMorph","monetBackground","uiMicroMotion","settingsScroll"],$n="(prefers-reduced-motion: reduce)",Jn="reduce_motion_follow_system",Zs="reduce_motion_lattice",$s="reduce_motion_transitionOverlay",el="reduce_motion_collectionMorph",tl="reduce_motion_monetBackground",ol="reduce_motion_uiMicroMotion",rl="reduce_motion_settingsScroll",ea={lattice:Zs,transitionOverlay:$s,collectionMorph:el,monetBackground:tl,uiMicroMotion:ol,settingsScroll:rl},nl=()=>typeof window<"u"&&typeof window.matchMedia=="function"&&window.matchMedia($n).matches,al=()=>Object.fromEntries(Zn.map(e=>[e,fo(ea[e],!1)])),Ft=Xr(e=>({reducedMotionSurfaces:al(),followSystemReducedMotion:fo(Jn,!1),systemPrefersReducedMotion:nl(),handleToggleReducedMotionSurface:(t,o)=>{e(r=>({reducedMotionSurfaces:{...r.reducedMotionSurfaces,[t]:o}})),mo(ea[t],o)},handleToggleFollowSystemReducedMotion:t=>{e({followSystemReducedMotion:t}),mo(Jn,t)},setSystemPrefersReducedMotion:t=>e({systemPrefersReducedMotion:t})})),Zo=(e,t)=>e.reducedMotionSurfaces[t]||e.followSystemReducedMotion&&e.systemPrefersReducedMotion,il=e=>Zn.filter(t=>Zo(e,t)).join(" "),ta=e=>{if(typeof document>"u"||!document.documentElement)return;let t=il(e);t?document.documentElement.setAttribute("data-reduce-motion",t):document.documentElement.removeAttribute("data-reduce-motion")};typeof window<"u"&&typeof window.matchMedia=="function"&&window.matchMedia($n).addEventListener("change",t=>{Ft.getState().setSystemPrefersReducedMotion(t.matches)});ta(Ft.getState());Ft.subscribe(ta);var oa=e=>Ft(t=>Zo(t,e));var ie=S(_(),1),sl=180,$o=(e,t,o)=>Math.min(o,Math.max(t,e)),ll=(e,t,o,r)=>{(0,ve.useEffect)(()=>{let a=e.current;if(!a||!t||o<=0||typeof a.animate!="function"||r)return;let n=jn(o),i=a.animate(n.keyframes,{duration:n.durationMs,iterations:1/0,easing:"linear"});return()=>i.cancel()},[t,e,o,r])},cl=(e,t,o)=>o.backgroundSource==="uploaded-global"?t?.url??e??null:e??t?.url??null,ul=({coverUrl:e,monetBackgroundImage:t,theme:o,isDaylight:r=!1,tuning:a=G,transparentBackground:n=!1,staticMode:i=!1})=>{let[s,c]=(0,ve.useState)(null),l=cl(e,t,a),u=(0,ve.useMemo)(()=>`linear-gradient(135deg, ${E(o.accentColor,.22)}, ${E(o.backgroundColor,.96)} 50%, ${E(o.primaryColor,.18)})`,[o]),d=(0,ve.useMemo)(()=>`linear-gradient(90deg, ${E(o.backgroundColor,.18)} 0%, ${E(o.backgroundColor,.32)} 34%, ${E(o.backgroundColor,.66)} 70%, ${E(o.backgroundColor,.82)} 100%)`,[o]),p=(0,ve.useMemo)(()=>qo({coverUrl:e,monetBackgroundImage:t,theme:o,tuning:a}),[e,t,o,a]);(0,ve.useEffect)(()=>{let R=!1,D;return!l||n?(c(null),()=>{R=!0}):(D=window.setTimeout(()=>{Yn({coverUrl:e,monetBackgroundImage:t,theme:o,tuning:a}).then(V=>{R||c(B=>B===V?B:V)})},sl),()=>{R=!0,D!==void 0&&window.clearTimeout(D)})},[p,l,n]);let g=(0,ve.useRef)(null),f=$o(a.backgroundDriftStrength??0,0,1),h=!!a.backgroundDriftEnabled&&!i&&f>0,m=oa("monetBackground");ll(g,h,f,m);let b=(0,ve.useMemo)(()=>h?{willChange:"transform"}:void 0,[h]),A=(0,ve.useMemo)(()=>Ko(),[])?0:a.backgroundBlurPx,v=(0,ve.useMemo)(()=>A<=0?{}:{filter:`blur(${A}px)`,WebkitFilter:`blur(${A}px)`,transform:"scale(1.1) translateZ(0)"},[A]);if(n)return null;let x=s?`url(${s})`:l?`linear-gradient(135deg, ${E(o.accentColor,.2)}, ${E(o.backgroundColor,.78)}), url(${l})`:u;if(a.backgroundLayout==="full-overlay")return(0,ie.jsxs)("div",{className:"absolute inset-0 z-0 overflow-hidden",children:[(0,ie.jsx)("div",{ref:g,className:"absolute inset-0",style:b,children:(0,ie.jsx)(vt,{initial:!1,children:(0,ie.jsx)(Ce.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.8,ease:"easeInOut"},className:"absolute inset-0",style:{backgroundColor:o.backgroundColor,backgroundImage:x,backgroundSize:"cover",backgroundPosition:"center",...v}},s||l||"fallback")})}),(0,ie.jsx)("div",{className:"absolute inset-0",style:{background:d}})]});let k=(r?.7:.3)+$o(a.backgroundOverlayOpacity,0,1)*.16,T=$o(50+a.backgroundHalfPaneOffsetX,10,90);return(0,ie.jsxs)("div",{className:"absolute inset-0 z-0 overflow-hidden",children:[(0,ie.jsx)("div",{className:"absolute inset-0",style:{backgroundColor:o.backgroundColor,backgroundImage:u}}),(0,ie.jsx)(vt,{initial:!1,children:s||l?(0,ie.jsx)("div",{className:"absolute inset-y-0 left-0 w-[72%] sm:w-[68%] lg:w-[60%] overflow-hidden",style:{WebkitMaskImage:"linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)",maskImage:"linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)"},children:(0,ie.jsx)("div",{ref:g,className:"absolute inset-0",style:b,children:(0,ie.jsx)(Ce.div,{initial:{opacity:0},animate:{opacity:k},exit:{opacity:0},transition:{duration:.8,ease:"easeInOut"},className:"absolute inset-0",style:{backgroundImage:x,backgroundRepeat:"no-repeat",backgroundSize:"cover",backgroundPosition:`${T}% center`,...v}},s||l||"fallback")})}):null}),(0,ie.jsx)("div",{className:"absolute inset-0",style:{background:`linear-gradient(90deg, ${E(o.backgroundColor,.14)} 0%, ${E(o.backgroundColor,.28)} 28%, ${E(o.backgroundColor,.62)} 64%, ${E(o.backgroundColor,.86)} 100%)`}}),(0,ie.jsx)("div",{className:"absolute inset-0",style:{backgroundImage:`radial-gradient(circle at 18% 34%, ${E(o.accentColor,.18)}, transparent 36%)`,backgroundSize:"cover",backgroundPosition:"center"}}),(0,ie.jsx)("div",{className:"absolute inset-0",style:{background:d}})]})},ra=ul;var Yt=S(_(),1),fl=_e({mode:"monet",order:20,labelKey:"options.visualizerBackgroundModeMonet",labelFallback:"Monet",render:({config:e,coverUrl:t,theme:o,isDaylight:r,staticMode:a})=>(0,Yt.jsx)(ra,{coverUrl:t,monetBackgroundImage:e?.customImage,theme:o,isDaylight:r,tuning:e?.monet?.tuning,transparentBackground:e?.transparent,staticMode:a}),renderSettingsPanel:({config:e,actions:t,t:o,isDaylight:r,theme:a,controlCardBg:n,rangeInputClass:i,onSliderPointerDown:s,onSliderCommit:c})=>(0,Yt.jsx)(Gn,{t:o,isDaylight:r,theme:a,controlCardBg:n,rangeInputClass:i,tuning:e?.monet?.tuning??G,onTuningChange:t?.monet?.onTuningChange,monetBackgroundImage:e?.customImage,onUploadMonetBackgroundImage:t?.customImage?.onUpload,onClearMonetBackgroundImage:t?.customImage?.onClear,isLoadingMonetBackgroundImage:t?.customImage?.isLoading,onSliderPointerDown:s,onSliderCommit:c}),renderQuickControls:({config:e,actions:t,t:o,isDaylight:r})=>{let n=(e?.monet?.tuning??G).backgroundLayout==="full-overlay",i=o(n?"options.monetLayoutFullOverlay":"options.monetLayoutHalfPane");return(0,Yt.jsx)(Ot,{isDaylight:r,label:i,title:`${o("options.monetBackgroundLayout")}: ${i}`,onClick:()=>t?.monet?.onTuningChange?.({backgroundLayout:n?"half-pane-gradient":"full-overlay"})})},resetSettings:e=>e?.monet?.onResetTuning?.()});var ar={};ft(ar,{default:()=>wl});var sa=S(K(),1);var dl=1.7777777777777777,or={fiberSize:.2,crumples:.35,crumpleSize:.35,folds:.65,foldCount:5,drops:.2,seed:5.8},rr={perspective:.4,count:20,focusCenter:.55,focusEdges:.8,swirl:.08,lensCircle:.1},tr=e=>Math.min(1,Math.max(0,e)),ml=e=>Math.min(1.8,Math.max(1,e)),Xt=e=>e<=1?1:ml(e+.01),pl=e=>Xt(1/(1-2*Math.min(Math.max(e,0),.45))),nr=(e,t,o)=>o&&!t?!e:e,na=(e,t,o)=>nr(!e,t,o),aa=(e,t)=>{let{folds:o,crumples:r,drops:a}=or,n=2*o+1.5*r+.2*a+.75*tr(e)+.1*tr(t);return pl(.02*n)},ia=(e,t)=>{let o=.5*Math.hypot(dl,1),r=tr(t),n=.7*Math.pow(r,1.3+2.7*r)*(1-rr.focusEdges),i=Math.max(.35,1-n/o);if(e<=0)return Xt(1/i);let s=Math.min(e,1)*1.4,c=d=>{let p=2*o/d;return Math.tan(p*s)/Math.tan(s)/p},l=Math.max(1,2*o*s/1.45);if(l>=1.8||c(1.8)>1.8*i)return 1.8;if(l===1&&c(1)<=i)return Xt(1/i);let u=1.8;for(let d=0;d<32;d+=1){let p=(l+u)/2;c(p)>p*i?l=p:u=p}return Xt(u)};var De=S(_(),1),gl=({coverUrl:e,monetBackgroundImage:t,tuning:o,theme:r,isDaylight:a})=>{let n={...Ze,...o},i=n.imageSource==="uploaded-global"?t?.url??e:e??t?.url;if(!i)return(0,De.jsx)("div",{className:"absolute inset-0 z-0",style:{backgroundColor:r.backgroundColor}});let s=()=>{let c={width:"100%",height:"100%",image:i,fit:"cover",minPixelRatio:1,maxPixelCount:2073600,style:{width:"100%",height:"100%"}};switch(n.effect){case"fluted-glass":return(0,De.jsx)(No,{...c,colorBack:r.backgroundColor,colorShadow:r.secondaryColor,colorHighlight:r.primaryColor,shadows:.25,size:n.flutedGlassSize,distortion:n.flutedGlassDistortion,blur:n.flutedGlassBlur,shape:"lines",distortionShape:"prism",highlights:.1,edges:.25},`${i}:fluted-glass`);case"paper-texture":return(0,De.jsx)(Io,{...c,...or,colorFront:r.accentColor,colorBack:r.backgroundColor,contrast:n.paperTextureContrast,roughness:n.paperTextureRoughness,fiber:n.paperTextureFiber,scale:aa(n.paperTextureRoughness,n.paperTextureFiber)},`${i}:paper-texture`);case"halftone-dots":return(0,De.jsx)(Vo,{...c,colorBack:r.backgroundColor,colorFront:r.accentColor,size:n.halftoneDotsSize,radius:n.halftoneDotsRadius,contrast:n.halftoneDotsContrast,originalColors:n.halftoneDotsOriginalColors,inverted:na(n.halftoneDotsInverted,n.halftoneDotsOriginalColors,a),grid:"hex",type:"gooey",grainMixer:.12,grainOverlay:.06,grainSize:.5},`${i}:halftone-dots`);case"lens-distortion":return(0,De.jsx)(Oo,{...c,...rr,spread:n.lensDistortionSpread,dispersion:n.lensDistortionDispersion,lensBulge:n.lensDistortionBulge,scale:ia(n.lensDistortionBulge,n.lensDistortionSpread)},`${i}:lens-distortion`);default:return(0,De.jsx)(Uo,{...c,colorBack:r.backgroundColor,colorFront:r.accentColor,colorHighlight:r.primaryColor,originalColors:n.originalColors,inverted:nr(n.inverted,n.originalColors,a),type:n.ditheringType,size:n.size,colorSteps:n.colorSteps},`${i}:dithering`)}};return(0,De.jsxs)("div",{className:"absolute inset-0 z-0 overflow-hidden",style:{backgroundColor:r.backgroundColor,pointerEvents:"none"},children:[s(),n.overlayEnabled&&n.overlayOpacity>0&&(0,De.jsx)("div",{className:"absolute inset-0",style:{backgroundColor:r.backgroundColor,opacity:n.overlayOpacity}})]})},la=sa.default.memo(gl);var qt=S(K(),1);var ot=S(_(),1),hl=e=>e.toFixed(2),we=e=>`${Math.round(e*100)}%`,ke=(e,t)=>({borderColor:E(e.secondaryColor,t?.18:.16),selectedBg:E(e.accentColor,t?.1:.16)}),Z=({label:e,value:t,min:o,max:r,step:a,rangeInputClass:n,theme:i,onChange:s,onPointerDown:c,onPointerUp:l,format:u=hl})=>(0,ot.jsxs)("label",{className:"block space-y-2",children:[(0,ot.jsxs)("span",{className:"flex justify-between gap-3 text-sm",style:{color:i.primaryColor},children:[(0,ot.jsx)("span",{children:e}),(0,ot.jsx)("span",{className:"font-mono opacity-70",children:u(t)})]}),(0,ot.jsx)("input",{type:"range",min:o,max:r,step:a,value:t,onChange:d=>s(Number(d.target.value)),onPointerDown:c,onPointerUp:l,onPointerCancel:l,className:n})]});var Re=S(_(),1),xl=["2x2","4x4","8x8"],bl=({t:e,isDaylight:t,theme:o,rangeInputClass:r,tuning:a,onTuningChange:n,onSliderPointerDown:i,onSliderCommit:s})=>{let{borderColor:c,selectedBg:l}=ke(o,t),u={rangeInputClass:r,theme:o,onPointerDown:i,onPointerUp:s};return(0,Re.jsxs)("div",{className:"space-y-4 rounded-2xl border p-3",style:{borderColor:c},children:[(0,Re.jsx)("div",{className:"text-xs font-medium uppercase tracking-[0.2em]",style:{color:o.secondaryColor},children:e("options.nomandBackgroundEffectDithering")}),(0,Re.jsxs)("div",{className:"space-y-2",children:[(0,Re.jsx)("div",{className:"text-sm",style:{color:o.primaryColor},children:e("options.nomandBackgroundDitheringType")}),(0,Re.jsx)("div",{className:"grid grid-cols-3 gap-2",children:xl.map(d=>(0,Re.jsx)("button",{type:"button",onClick:()=>n?.({ditheringType:d}),className:"rounded-xl border px-2 py-2 text-xs",style:{borderColor:a.ditheringType===d?o.accentColor:c,backgroundColor:a.ditheringType===d?l:"transparent",color:o.primaryColor},children:d},d))})]}),(0,Re.jsx)(Z,{...u,label:e("options.nomandBackgroundSize"),value:a.size,min:.5,max:20,step:.5,format:d=>d.toFixed(1),onChange:d=>n?.({size:d})}),(0,Re.jsx)(Z,{...u,label:e("options.nomandBackgroundColorSteps"),value:a.colorSteps,min:1,max:7,step:1,format:d=>String(Math.round(d)),onChange:d=>n?.({colorSteps:d})}),(0,Re.jsx)(X,{label:e("options.nomandBackgroundOriginalColors"),checked:a.originalColors,onChange:d=>n?.({originalColors:d}),theme:o}),(0,Re.jsx)(X,{label:e("options.nomandBackgroundInverted"),checked:a.inverted,onChange:d=>n?.({inverted:d}),theme:o})]})},ca=bl;var rt=S(_(),1),yl=({t:e,isDaylight:t,theme:o,rangeInputClass:r,tuning:a,onTuningChange:n,onSliderPointerDown:i,onSliderCommit:s})=>{let{borderColor:c}=ke(o,t),l={rangeInputClass:r,theme:o,onPointerDown:i,onPointerUp:s};return(0,rt.jsxs)("div",{className:"space-y-4 rounded-2xl border p-3",style:{borderColor:c},children:[(0,rt.jsx)("div",{className:"text-xs font-medium uppercase tracking-[0.2em]",style:{color:o.secondaryColor},children:e("options.nomandBackgroundEffectFlutedGlass")}),(0,rt.jsx)(Z,{...l,label:e("options.nomandBackgroundFlutedGlassSize"),value:a.flutedGlassSize,min:.1,max:1,step:.05,onChange:u=>n?.({flutedGlassSize:u})}),(0,rt.jsx)(Z,{...l,label:e("options.nomandBackgroundFlutedGlassDistortion"),value:a.flutedGlassDistortion,min:0,max:1,step:.05,format:we,onChange:u=>n?.({flutedGlassDistortion:u})}),(0,rt.jsx)(Z,{...l,label:e("options.nomandBackgroundFlutedGlassBlur"),value:a.flutedGlassBlur,min:0,max:1,step:.05,format:we,onChange:u=>n?.({flutedGlassBlur:u})})]})},ua=yl;var Ve=S(_(),1),vl=({t:e,isDaylight:t,theme:o,rangeInputClass:r,tuning:a,onTuningChange:n,onSliderPointerDown:i,onSliderCommit:s})=>{let{borderColor:c}=ke(o,t),l={rangeInputClass:r,theme:o,onPointerDown:i,onPointerUp:s};return(0,Ve.jsxs)("div",{className:"space-y-4 rounded-2xl border p-3",style:{borderColor:c},children:[(0,Ve.jsx)("div",{className:"text-xs font-medium uppercase tracking-[0.2em]",style:{color:o.secondaryColor},children:e("options.nomandBackgroundEffectHalftoneDots")}),(0,Ve.jsx)(Z,{...l,label:e("options.nomandBackgroundHalftoneDotsSize"),value:a.halftoneDotsSize,min:.1,max:1,step:.05,onChange:u=>n?.({halftoneDotsSize:u})}),(0,Ve.jsx)(Z,{...l,label:e("options.nomandBackgroundHalftoneDotsRadius"),value:a.halftoneDotsRadius,min:.1,max:2,step:.05,onChange:u=>n?.({halftoneDotsRadius:u})}),(0,Ve.jsx)(Z,{...l,label:e("options.nomandBackgroundHalftoneDotsContrast"),value:a.halftoneDotsContrast,min:0,max:1,step:.05,format:we,onChange:u=>n?.({halftoneDotsContrast:u})}),(0,Ve.jsx)(X,{label:e("options.nomandBackgroundOriginalColors"),checked:a.halftoneDotsOriginalColors,onChange:u=>n?.({halftoneDotsOriginalColors:u}),theme:o}),(0,Ve.jsx)(X,{label:e("options.nomandBackgroundInverted"),checked:a.halftoneDotsInverted,onChange:u=>n?.({halftoneDotsInverted:u}),theme:o})]})},fa=vl;var nt=S(_(),1),Sl=({t:e,isDaylight:t,theme:o,rangeInputClass:r,tuning:a,onTuningChange:n,onSliderPointerDown:i,onSliderCommit:s})=>{let{borderColor:c}=ke(o,t),l={rangeInputClass:r,theme:o,onPointerDown:i,onPointerUp:s};return(0,nt.jsxs)("div",{className:"space-y-4 rounded-2xl border p-3",style:{borderColor:c},children:[(0,nt.jsx)("div",{className:"text-xs font-medium uppercase tracking-[0.2em]",style:{color:o.secondaryColor},children:e("options.nomandBackgroundEffectLensDistortion")}),(0,nt.jsx)(Z,{...l,label:e("options.nomandBackgroundLensDistortionSpread"),value:a.lensDistortionSpread,min:0,max:1,step:.05,format:we,onChange:u=>n?.({lensDistortionSpread:u})}),(0,nt.jsx)(Z,{...l,label:e("options.nomandBackgroundLensDistortionBulge"),value:a.lensDistortionBulge,min:-1,max:1,step:.05,onChange:u=>n?.({lensDistortionBulge:u})}),(0,nt.jsx)(Z,{...l,label:e("options.nomandBackgroundLensDistortionDispersion"),value:a.lensDistortionDispersion,min:0,max:1,step:.05,format:we,onChange:u=>n?.({lensDistortionDispersion:u})})]})},da=Sl;var at=S(_(),1),Al=({t:e,isDaylight:t,theme:o,rangeInputClass:r,tuning:a,onTuningChange:n,onSliderPointerDown:i,onSliderCommit:s})=>{let{borderColor:c}=ke(o,t),l={rangeInputClass:r,theme:o,onPointerDown:i,onPointerUp:s};return(0,at.jsxs)("div",{className:"space-y-4 rounded-2xl border p-3",style:{borderColor:c},children:[(0,at.jsx)("div",{className:"text-xs font-medium uppercase tracking-[0.2em]",style:{color:o.secondaryColor},children:e("options.nomandBackgroundEffectPaperTexture")}),(0,at.jsx)(Z,{...l,label:e("options.nomandBackgroundPaperTextureContrast"),value:a.paperTextureContrast,min:0,max:1,step:.05,format:we,onChange:u=>n?.({paperTextureContrast:u})}),(0,at.jsx)(Z,{...l,label:e("options.nomandBackgroundPaperTextureRoughness"),value:a.paperTextureRoughness,min:0,max:1,step:.05,format:we,onChange:u=>n?.({paperTextureRoughness:u})}),(0,at.jsx)(Z,{...l,label:e("options.nomandBackgroundPaperTextureFiber"),value:a.paperTextureFiber,min:0,max:1,step:.05,format:we,onChange:u=>n?.({paperTextureFiber:u})})]})},ma=Al;var Te=S(_(),1),Cl=["dithering","fluted-glass","paper-texture","halftone-dots","lens-distortion"],_l={dithering:"options.nomandBackgroundEffectDithering","fluted-glass":"options.nomandBackgroundEffectFlutedGlass","paper-texture":"options.nomandBackgroundEffectPaperTexture","halftone-dots":"options.nomandBackgroundEffectHalftoneDots","lens-distortion":"options.nomandBackgroundEffectLensDistortion"},El=e=>{let{t,isDaylight:o,theme:r,tuning:a}=e,{borderColor:n,selectedBg:i}=ke(r,o);return(0,Te.jsxs)("div",{className:"space-y-4",children:[(0,Te.jsxs)("div",{className:"space-y-2",children:[(0,Te.jsx)("div",{className:"text-sm",style:{color:r.primaryColor},children:t("options.nomandBackgroundEffect")}),(0,Te.jsx)("div",{className:"grid grid-cols-2 gap-2 sm:grid-cols-3",children:Cl.map(s=>(0,Te.jsx)("button",{type:"button",onClick:()=>e.onTuningChange?.({effect:s}),className:"rounded-xl border px-2 py-2 text-xs",style:{borderColor:a.effect===s?r.accentColor:n,backgroundColor:a.effect===s?i:"transparent",color:r.primaryColor},children:t(_l[s])},s))})]}),a.effect==="dithering"&&(0,Te.jsx)(ca,{...e}),a.effect==="fluted-glass"&&(0,Te.jsx)(ua,{...e}),a.effect==="paper-texture"&&(0,Te.jsx)(ma,{...e}),a.effect==="halftone-dots"&&(0,Te.jsx)(fa,{...e}),a.effect==="lens-distortion"&&(0,Te.jsx)(da,{...e})]})},pa=El;var Q=S(_(),1),Bl=({t:e,isDaylight:t,theme:o,controlCardBg:r,rangeInputClass:a,tuning:n,onTuningChange:i,monetBackgroundImage:s,onUploadMonetBackgroundImage:c,onClearMonetBackgroundImage:l,isLoadingMonetBackgroundImage:u=!1,onSliderPointerDown:d,onSliderCommit:p})=>{let g={...Ze,...n},f=(0,qt.useRef)(null),[h,m]=(0,qt.useState)(""),b=E(o.secondaryColor,t?.18:.16),y=E(o.accentColor,t?.1:.16),A=x=>{i?.({imageSource:x})},v=async x=>{if(!x.length||!c)return;let C=await c(x);m(C.ok?e("options.nomandBackgroundUploadSuccess"):C.error??e("options.nomandBackgroundUploadFailed")),C.ok&&A("uploaded-global")};return(0,Q.jsxs)("div",{className:"rounded-[24px] border p-4 space-y-4",style:{backgroundColor:r,borderColor:b},children:[(0,Q.jsxs)("div",{className:"space-y-1",children:[(0,Q.jsx)("div",{className:"text-sm font-medium",style:{color:o.primaryColor},children:e("options.nomandBackgroundSettings")}),(0,Q.jsx)("div",{className:"text-xs opacity-70",style:{color:o.secondaryColor},children:e("options.nomandBackgroundSettingsDesc")})]}),(0,Q.jsxs)("div",{className:"space-y-2",children:[(0,Q.jsx)("div",{className:"text-sm",style:{color:o.primaryColor},children:e("options.nomandBackgroundSource")}),(0,Q.jsx)("div",{className:"grid grid-cols-2 gap-2",children:[["cover-derived",e("options.monetBackgroundSourceCover")],["uploaded-global",e("options.monetBackgroundSourceUploaded")]].map(([x,C])=>(0,Q.jsx)("button",{type:"button",disabled:x==="uploaded-global"&&!s&&!u,onClick:()=>A(x),className:"rounded-2xl border px-3 py-2 text-sm disabled:opacity-40",style:{borderColor:g.imageSource===x?o.accentColor:b,backgroundColor:g.imageSource===x?y:"transparent",color:o.primaryColor},children:C},x))}),(0,Q.jsxs)("div",{className:"flex flex-wrap gap-2",children:[(0,Q.jsx)("input",{ref:f,type:"file",accept:"image/png,image/jpeg,image/webp,image/gif",className:"hidden",onChange:x=>{v(Array.from(x.target.files??[])),x.target.value=""}}),(0,Q.jsxs)("button",{type:"button",disabled:u||!c,onClick:()=>f.current?.click(),className:"inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40",style:{borderColor:b,color:o.primaryColor},children:[(0,Q.jsx)(Yr,{size:14}),e("options.monetUploadBackground")]}),(0,Q.jsxs)("button",{type:"button",disabled:!s||!l,onClick:()=>{l?.()},className:"inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs disabled:opacity-40",style:{borderColor:b,color:o.secondaryColor},children:[(0,Q.jsx)(dt,{size:14}),e("options.monetClearBackground")]})]}),(0,Q.jsx)("div",{className:"truncate text-xs opacity-60",style:{color:o.secondaryColor},children:h||s?.name||"-"})]}),(0,Q.jsx)(pa,{t:e,isDaylight:t,theme:o,rangeInputClass:a,tuning:g,onTuningChange:i,onSliderPointerDown:d,onSliderCommit:p}),(0,Q.jsxs)("div",{className:"space-y-3 rounded-2xl border p-3",style:{borderColor:b},children:[(0,Q.jsx)(X,{label:e("options.nomandBackgroundOverlay"),description:e("options.nomandBackgroundOverlayDesc"),checked:g.overlayEnabled,onChange:x=>i?.({overlayEnabled:x}),theme:o}),(0,Q.jsxs)("label",{className:`block space-y-2 ${g.overlayEnabled?"":"opacity-45"}`,children:[(0,Q.jsxs)("span",{className:"flex justify-between text-sm",style:{color:o.primaryColor},children:[(0,Q.jsx)("span",{children:e("options.nomandBackgroundOverlayOpacity")}),(0,Q.jsxs)("span",{className:"font-mono opacity-70",children:[Math.round(g.overlayOpacity*100),"%"]})]}),(0,Q.jsx)("input",{type:"range",min:"0",max:"1",step:"0.05",value:g.overlayOpacity,disabled:!g.overlayEnabled,onChange:x=>i?.({overlayOpacity:Number(x.target.value)}),onPointerDown:d,onPointerUp:p,className:a})]})]})]})},ga=Bl;var Mt=S(_(),1),wl=_e({mode:"nomand",order:30,labelKey:"options.visualizerBackgroundModeNomand",labelFallback:"Nomand",render:({config:e,coverUrl:t,theme:o,isDaylight:r})=>(0,Mt.jsx)(la,{coverUrl:t,monetBackgroundImage:e?.customImage,tuning:e?.nomand?.tuning,theme:o,isDaylight:r}),renderSettingsPanel:({config:e,actions:t,...o})=>(0,Mt.jsx)(ga,{...o,tuning:e?.nomand?.tuning??Ze,onTuningChange:t?.nomand?.onTuningChange,monetBackgroundImage:e?.customImage,onUploadMonetBackgroundImage:t?.customImage?.onUpload,onClearMonetBackgroundImage:t?.customImage?.onClear,isLoadingMonetBackgroundImage:t?.customImage?.isLoading}),renderQuickControls:({config:e,actions:t,t:o,theme:r})=>{let a=e?.nomand?.tuning??Ze;return(0,Mt.jsx)(Ge,{active:a.overlayEnabled,theme:r,label:o("options.nomandBackgroundOverlay"),onToggle:()=>t?.nomand?.onTuningChange?.({overlayEnabled:!a.overlayEnabled}),children:(0,Mt.jsx)(Ut,{size:14})})},resetSettings:e=>e?.nomand?.onResetTuning?.()});var Fr={};ft(Fr,{default:()=>yf});var Ue=S(K(),1);var lr=Float32Array;function cr(e,t,o){let r=new lr(3);return e&&(r[0]=e),t&&(r[1]=t),o&&(r[2]=o),r}function kl(e,t,o){return o=o||new lr(3),o[0]=e[0]+t[0],o[1]=e[1]+t[1],o[2]=e[2]+t[2],o}function Rl(e,t,o){return o=o||new lr(3),o[0]=e[0]*t[0],o[1]=e[1]*t[1],o[2]=e[2]*t[2],o}var _a=Float32Array;function Tl(e){return e=e||new _a(16),e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e}function Fl(e,t){t=t||new _a(16);let o=e[0],r=e[1],a=e[2],n=e[3],i=e[4],s=e[5],c=e[6],l=e[7],u=e[8],d=e[9],p=e[10],g=e[11],f=e[12],h=e[13],m=e[14],b=e[15],y=p*b,A=m*g,v=c*b,x=m*l,C=c*g,k=p*l,T=a*b,R=m*n,D=a*g,V=p*n,B=a*l,W=c*n,se=u*h,ee=f*d,he=i*h,le=f*s,ce=i*d,Se=u*s,Le=o*h,st=f*r,lt=o*d,ct=u*r,ut=o*s,Nt=i*r,Dr=y*s+x*d+C*h-(A*s+v*d+k*h),Ir=A*r+T*d+V*h-(y*r+R*d+D*h),Nr=v*r+R*s+B*h-(x*r+T*s+W*h),Ur=k*r+D*s+W*d-(C*r+V*s+B*d),te=1/(o*Dr+i*Ir+u*Nr+f*Ur);return t[0]=te*Dr,t[1]=te*Ir,t[2]=te*Nr,t[3]=te*Ur,t[4]=te*(A*i+v*u+k*f-(y*i+x*u+C*f)),t[5]=te*(y*o+R*u+D*f-(A*o+T*u+V*f)),t[6]=te*(x*o+T*i+W*f-(v*o+R*i+B*f)),t[7]=te*(C*o+V*i+B*u-(k*o+D*i+W*u)),t[8]=te*(se*l+le*g+ce*b-(ee*l+he*g+Se*b)),t[9]=te*(ee*n+Le*g+ct*b-(se*n+st*g+lt*b)),t[10]=te*(he*n+st*l+ut*b-(le*n+Le*l+Nt*b)),t[11]=te*(Se*n+lt*l+Nt*g-(ce*n+ct*l+ut*g)),t[12]=te*(he*p+Se*m+ee*c-(ce*m+se*c+le*p)),t[13]=te*(lt*m+se*a+st*p-(Le*p+ct*m+ee*a)),t[14]=te*(Le*c+Nt*m+le*a-(ut*m+he*a+st*c)),t[15]=te*(ut*p+ce*a+ct*c-(lt*c+Nt*p+Se*a)),t}function Ml(e,t,o){o=o||cr();let r=t[0],a=t[1],n=t[2],i=r*e[3]+a*e[7]+n*e[11]+e[15];return o[0]=(r*e[0]+a*e[4]+n*e[8]+e[12])/i,o[1]=(r*e[1]+a*e[5]+n*e[9]+e[13])/i,o[2]=(r*e[2]+a*e[6]+n*e[10]+e[14])/i,o}function Pl(e,t,o){o=o||cr();let r=t[0],a=t[1],n=t[2];return o[0]=r*e[0]+a*e[4]+n*e[8],o[1]=r*e[1]+a*e[5]+n*e[9],o[2]=r*e[2]+a*e[6]+n*e[10],o}var ur=5120,Pt=5121,fr=5122,dr=5123,mr=5124,pr=5125,gr=5126,Dl=32819,Il=32820,Nl=33635,Ul=5131,Ol=33640,Vl=35899,zl=35902,Ll=36269,Gl=34042,Ea={};{let e=Ea;e[ur]=Int8Array,e[Pt]=Uint8Array,e[fr]=Int16Array,e[dr]=Uint16Array,e[mr]=Int32Array,e[pr]=Uint32Array,e[gr]=Float32Array,e[Dl]=Uint16Array,e[Il]=Uint16Array,e[Nl]=Uint16Array,e[Ul]=Uint16Array,e[Ol]=Uint32Array,e[Vl]=Uint32Array,e[zl]=Uint32Array,e[Ll]=Uint32Array,e[Gl]=Uint32Array}function hr(e){if(e instanceof Int8Array)return ur;if(e instanceof Uint8Array||e instanceof Uint8ClampedArray)return Pt;if(e instanceof Int16Array)return fr;if(e instanceof Uint16Array)return dr;if(e instanceof Int32Array)return mr;if(e instanceof Uint32Array)return pr;if(e instanceof Float32Array)return gr;throw new Error("unsupported typed array type")}function Ba(e){if(e===Int8Array)return ur;if(e===Uint8Array||e===Uint8ClampedArray)return Pt;if(e===Int16Array)return fr;if(e===Uint16Array)return dr;if(e===Int32Array)return mr;if(e===Uint32Array)return pr;if(e===Float32Array)return gr;throw new Error("unsupported typed array type")}function Hl(e){let t=Ea[e];if(!t)throw new Error("unknown gl type");return t}var Kt=typeof SharedArrayBuffer<"u"?function(t){return t&&t.buffer&&(t.buffer instanceof ArrayBuffer||t.buffer instanceof SharedArrayBuffer)}:function(t){return t&&t.buffer&&t.buffer instanceof ArrayBuffer};function Wl(...e){console.error(...e)}function Ql(...e){console.warn(...e)}var ha=new Map;function wa(e,t){if(!e||typeof e!="object")return!1;let o=ha.get(t);o||(o=new WeakMap,ha.set(t,o));let r=o.get(e);if(r===void 0){let a=Object.prototype.toString.call(e);r=a.substring(8,a.length-1)===t,o.set(e,r)}return r}function Yl(e,t){return typeof WebGLBuffer<"u"&&wa(t,"WebGLBuffer")}function ka(e,t){return typeof WebGLTexture<"u"&&wa(t,"WebGLTexture")}var Ra=35044,Ke=34962,Ta=34963,Xl=34660,ql=5120,Kl=5121,jl=5122,Jl=5123,Zl=5124,$l=5125,Fa=5126,Ma={attribPrefix:""};function ec(e,t,o,r,a){e.bindBuffer(t,o),e.bufferData(t,r,a||Ra)}function xr(e,t,o,r){if(Yl(e,t))return t;o=o||Ke;let a=e.createBuffer();return ec(e,o,a,t,r),a}function Pa(e){return e==="indices"}function tc(e){return e===Int8Array||e===Uint8Array}function Da(e){return e.length?e:e.data}var oc=/coord|texture/i,rc=/color|colour/i;function nc(e,t){let o;if(oc.test(e)?o=2:rc.test(e)?o=4:o=3,t%o>0)throw new Error(`Can not guess numComponents for attribute '${e}'. Tried ${o} but ${t} values is not evenly divisible by ${o}. You should specify it.`);return o}function Ia(e,t,o){return e.numComponents||e.size||nc(t,o||Da(e).length)}function Jt(e,t){if(Kt(e))return e;if(Kt(e.data))return e.data;Array.isArray(e)&&(e={data:e});let o=e.type?br(e.type):void 0;return o||(Pa(t)?o=Uint16Array:o=Float32Array),new o(e.data)}function ac(e){return typeof e=="number"?e:e?Ba(e):Fa}function br(e){return typeof e=="number"?Hl(e):e||Float32Array}function ic(e,t){return{buffer:t.buffer,numValues:24,type:ac(t.type),arrayType:br(t.type)}}function sc(e,t){let o=t.data||t,r=br(t.type),a=o*r.BYTES_PER_ELEMENT,n=e.createBuffer();return e.bindBuffer(Ke,n),e.bufferData(Ke,a,t.drawType||Ra),{buffer:n,numValues:o,type:Ba(r),arrayType:r}}function lc(e,t,o){let r=Jt(t,o);return{arrayType:r.constructor,buffer:xr(e,r,void 0,t.drawType),type:hr(r),numValues:0}}function cc(e,t){let o={};return Object.keys(t).forEach(function(r){if(!Pa(r)){let a=t[r],n=a.attrib||a.name||a.attribName||Ma.attribPrefix+r;if(a.value){if(!Array.isArray(a.value)&&!Kt(a.value))throw new Error("array.value is not array or typedarray");o[n]={value:a.value}}else{let i;a.buffer&&a.buffer instanceof WebGLBuffer?i=ic:typeof a=="number"||typeof a.data=="number"?i=sc:i=lc;let{buffer:s,type:c,numValues:l,arrayType:u}=i(e,a,r),d=a.normalize!==void 0?a.normalize:tc(u),p=Ia(a,r,l);o[n]={buffer:s,numComponents:p,type:c,normalize:d,stride:a.stride||0,offset:a.offset||0,divisor:a.divisor===void 0?void 0:a.divisor,drawType:a.drawType}}}}),e.bindBuffer(Ke,null),o}function uc(e,t){return t===ql||t===Kl?1:t===jl||t===Jl?2:t===Zl||t===$l||t===Fa?4:0}var xt=["position","positions","a_position"];function fc(e){let t,o;for(o=0;o<xt.length&&(t=xt[o],!(t in e));++o);o===xt.length&&(t=Object.keys(e)[0]);let r=e[t],a=Da(r).length;if(a===void 0)return 1;let n=Ia(r,t),i=a/n;if(a%n>0)throw new Error(`numComponents ${n} not correct for length ${a}`);return i}function dc(e,t){let o,r;for(r=0;r<xt.length&&(o=xt[r],!(o in t||(o=Ma.attribPrefix+o,o in t)));++r);r===xt.length&&(o=Object.keys(t)[0]);let a=t[o];if(!a.buffer)return 1;e.bindBuffer(Ke,a.buffer);let n=e.getBufferParameter(Ke,Xl);e.bindBuffer(Ke,null);let i=uc(e,a.type),s=n/i,c=a.numComponents||a.size,l=s/c;if(l%1!==0)throw new Error(`numComponents ${c} not correct for length ${length}`);return l}function yr(e,t,o){let r=cc(e,t),a=Object.assign({},o||{});a.attribs=Object.assign({},o?o.attribs:{},r);let n=t.indices;if(n){let i=Jt(n,"indices");a.indices=xr(e,i,Ta),a.numElements=i.length,a.elementType=hr(i)}else a.numElements||(a.numElements=dc(e,a.attribs));return a}function mc(e,t,o){let r=o==="indices"?Ta:Ke,a=Jt(t,o);return xr(e,a,r)}function pc(e,t){let o={};return Object.keys(t).forEach(function(r){o[r]=mc(e,t[r],r)}),t.indices?(o.numElements=t.indices.length,o.elementType=hr(Jt(t.indices))):o.numElements=fc(t),o}function gc(e,t){let o=0;return e.push=function(){for(let r=0;r<arguments.length;++r){let a=arguments[r];if(a instanceof Array||Kt(a))for(let n=0;n<a.length;++n)e[o++]=a[n];else e[o++]=a}},e.reset=function(r){o=r||0},e.numComponents=t,Object.defineProperty(e,"numElements",{get:function(){return this.length/this.numComponents|0}}),e}function O(e,t,o){let r=o||Float32Array;return gc(new r(e*t),e)}function vr(e,t,o){let r=e.length,a=new Float32Array(3);for(let n=0;n<r;n+=3)o(t,[e[n],e[n+1],e[n+2]],a),e[n]=a[0],e[n+1]=a[1],e[n+2]=a[2]}function hc(e,t,o){o=o||cr();let r=t[0],a=t[1],n=t[2];return o[0]=r*e[0]+a*e[1]+n*e[2],o[1]=r*e[4]+a*e[5]+n*e[6],o[2]=r*e[8]+a*e[9]+n*e[10],o}function xc(e,t){return vr(e,t,Pl),e}function bc(e,t){return vr(e,Fl(t),hc),e}function yc(e,t){return vr(e,t,Ml),e}function vc(e,t){return Object.keys(e).forEach(function(o){let r=e[o];o.indexOf("pos")>=0?yc(r,t):o.indexOf("tan")>=0||o.indexOf("binorm")>=0?xc(r,t):o.indexOf("norm")>=0&&bc(r,t)}),e}function Na(e,t,o){return e=e||2,t=t||0,o=o||0,e*=.5,{position:{numComponents:2,data:[t+-1*e,o+-1*e,t+1*e,o+-1*e,t+-1*e,o+1*e,t+1*e,o+1*e]},normal:[0,0,1,0,0,1,0,0,1,0,0,1],texcoord:[0,0,1,0,0,1,1,1],indices:[0,1,2,2,1,3]}}function Ua(e,t,o,r,a){e=e||1,t=t||1,o=o||1,r=r||1,a=a||Tl();let n=(o+1)*(r+1),i=O(3,n),s=O(3,n),c=O(2,n);for(let p=0;p<=r;p++)for(let g=0;g<=o;g++){let f=g/o,h=p/r;i.push(e*f-e*.5,0,t*h-t*.5),s.push(0,1,0),c.push(f,h)}let l=o+1,u=O(3,o*r*2,Uint16Array);for(let p=0;p<r;p++)for(let g=0;g<o;g++)u.push((p+0)*l+g,(p+1)*l+g,(p+0)*l+g+1),u.push((p+1)*l+g,(p+1)*l+g+1,(p+0)*l+g+1);return vc({position:i,normal:s,texcoord:c,indices:u},a)}function Oa(e,t,o,r,a,n,i){if(t<=0||o<=0)throw new Error("subdivisionAxis and subdivisionHeight must be > 0");r=r||0,a=a||Math.PI,n=n||0,i=i||Math.PI*2;let s=a-r,c=i-n,l=(t+1)*(o+1),u=O(3,l),d=O(3,l),p=O(2,l);for(let h=0;h<=o;h++)for(let m=0;m<=t;m++){let b=m/t,y=h/o,A=c*b+n,v=s*y+r,x=Math.sin(A),C=Math.cos(A),k=Math.sin(v),T=Math.cos(v),R=C*k,D=T,V=x*k;u.push(e*R,e*D,e*V),d.push(R,D,V),p.push(1-b,y)}let g=t+1,f=O(3,t*o*2,Uint16Array);for(let h=0;h<t;h++)for(let m=0;m<o;m++)f.push((m+0)*g+h,(m+0)*g+h+1,(m+1)*g+h),f.push((m+1)*g+h,(m+0)*g+h+1,(m+1)*g+h+1);return{position:u,normal:d,texcoord:p,indices:f}}var Sc=[[3,7,5,1],[6,2,0,4],[6,7,3,2],[0,1,5,4],[7,6,4,5],[2,3,1,0]];function Va(e){e=e||1;let t=e/2,o=[[-t,-t,-t],[+t,-t,-t],[-t,+t,-t],[+t,+t,-t],[-t,-t,+t],[+t,-t,+t],[-t,+t,+t],[+t,+t,+t]],r=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],a=[[1,0],[0,0],[0,1],[1,1]],n=24,i=O(3,n),s=O(3,n),c=O(2,n),l=O(3,12,Uint16Array);for(let u=0;u<6;++u){let d=Sc[u];for(let g=0;g<4;++g){let f=o[d[g]],h=r[u],m=a[g];i.push(f),s.push(h),c.push(m)}let p=4*u;l.push(p+0,p+1,p+2),l.push(p+0,p+2,p+3)}return{position:i,normal:s,texcoord:c,indices:l}}function Sr(e,t,o,r,a,n,i){if(r<3)throw new Error("radialSubdivisions must be 3 or greater");if(a<1)throw new Error("verticalSubdivisions must be 1 or greater");let s=n===void 0?!0:n,c=i===void 0?!0:i,l=(s?2:0)+(c?2:0),u=(r+1)*(a+1+l),d=O(3,u),p=O(3,u),g=O(2,u),f=O(3,r*(a+l/2)*2,Uint16Array),h=r+1,m=Math.atan2(e-t,o),b=Math.cos(m),y=Math.sin(m),A=s?-2:0,v=a+(c?2:0);for(let x=A;x<=v;++x){let C=x/a,k=o*C,T;x<0?(k=0,C=1,T=e):x>a?(k=o,C=1,T=t):T=e+(t-e)*(x/a),(x===-2||x===a+2)&&(T=0,C=0),k-=o/2;for(let R=0;R<h;++R){let D=Math.sin(R*Math.PI*2/r),V=Math.cos(R*Math.PI*2/r);d.push(D*T,k,V*T),x<0?p.push(0,-1,0):x>a?p.push(0,1,0):T===0?p.push(0,0,0):p.push(D*b,y,V*b),g.push(R/r,1-C)}}for(let x=0;x<a+l;++x)if(!(x===1&&s||x===a+l-2&&c))for(let C=0;C<r;++C)f.push(h*(x+0)+0+C,h*(x+0)+1+C,h*(x+1)+1+C),f.push(h*(x+0)+0+C,h*(x+1)+1+C,h*(x+1)+0+C);return{position:d,normal:p,texcoord:g,indices:f}}function xa(e,t){t=t||[];let o=[];for(let r=0;r<e.length;r+=4){let a=e[r],n=e.slice(r+1,r+4);n.push.apply(n,t);for(let i=0;i<a;++i)o.push.apply(o,n)}return o}function za(){let e=[0,0,0,0,150,0,30,0,0,0,150,0,30,150,0,30,0,0,30,0,0,30,30,0,100,0,0,30,30,0,100,30,0,100,0,0,30,60,0,30,90,0,67,60,0,30,90,0,67,90,0,67,60,0,0,0,30,30,0,30,0,150,30,0,150,30,30,0,30,30,150,30,30,0,30,100,0,30,30,30,30,30,30,30,100,0,30,100,30,30,30,60,30,67,60,30,30,90,30,30,90,30,67,60,30,67,90,30,0,0,0,100,0,0,100,0,30,0,0,0,100,0,30,0,0,30,100,0,0,100,30,0,100,30,30,100,0,0,100,30,30,100,0,30,30,30,0,30,30,30,100,30,30,30,30,0,100,30,30,100,30,0,30,30,0,30,60,30,30,30,30,30,30,0,30,60,0,30,60,30,30,60,0,67,60,30,30,60,30,30,60,0,67,60,0,67,60,30,67,60,0,67,90,30,67,60,30,67,60,0,67,90,0,67,90,30,30,90,0,30,90,30,67,90,30,30,90,0,67,90,30,67,90,0,30,90,0,30,150,30,30,90,30,30,90,0,30,150,0,30,150,30,0,150,0,0,150,30,30,150,30,0,150,0,30,150,30,30,150,0,0,0,0,0,0,30,0,150,30,0,0,0,0,150,30,0,150,0],t=[.22,.19,.22,.79,.34,.19,.22,.79,.34,.79,.34,.19,.34,.19,.34,.31,.62,.19,.34,.31,.62,.31,.62,.19,.34,.43,.34,.55,.49,.43,.34,.55,.49,.55,.49,.43,0,0,1,0,0,1,0,1,1,0,1,1,0,0,1,0,0,1,0,1,1,0,1,1,0,0,1,0,0,1,0,1,1,0,1,1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,0,1,1,1,0,0,1,1,1,0,0,0,1,1,0,1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,0,1,1,0,0,0,1,1,1,0,0,1,1,1,0,0,0,1,1,0,1,0,0,1,0,1,1,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0,1,1,1,0,0,1,1,1,0],o=xa([18,0,0,1,18,0,0,-1,6,0,1,0,6,1,0,0,6,0,-1,0,6,1,0,0,6,0,1,0,6,1,0,0,6,0,-1,0,6,1,0,0,6,0,-1,0,6,-1,0,0]),r=xa([18,200,70,120,18,80,70,200,6,70,200,210,6,200,200,70,6,210,100,70,6,210,160,70,6,70,180,210,6,100,70,210,6,76,210,100,6,140,210,80,6,90,130,110,6,160,160,220],[255]),a=e.length/3,n={position:O(3,a),texcoord:O(2,a),normal:O(3,a),color:O(4,a,Uint8Array),indices:O(3,a/3,Uint16Array)};n.position.push(e),n.texcoord.push(t),n.normal.push(o),n.color.push(r);for(let i=0;i<a;++i)n.indices.push(i);return n}function La(e,t,o,r,a,n,i){if(a<=0)throw new Error("subdivisionDown must be > 0");n=n||0,i=i||1;let s=2,c=i-n,l=(a+1)*2*(2+s),u=O(3,l),d=O(3,l),p=O(2,l);function g(y,A,v){return y+(A-y)*v}function f(y,A,v,x,C,k){for(let T=0;T<=a;T++){let R=A/(s-1),D=T/a,V=(R-.5)*2,B=(n+D*c)*Math.PI,W=Math.sin(B),se=Math.cos(B),ee=g(e,y,W),he=V*r,le=se*e,ce=W*ee;u.push(he,le,ce);let Se=kl(Rl([0,W,se],v),x);d.push(Se),p.push(R*C+k,D)}}for(let y=0;y<s;y++){let A=(y/(s-1)-.5)*2;f(t,y,[1,1,1],[0,0,0],1,0),f(t,y,[0,0,0],[A,0,0],0,0),f(o,y,[1,1,1],[0,0,0],1,0),f(o,y,[0,0,0],[A,0,0],0,1)}let h=O(3,a*2*(2+s),Uint16Array);function m(y,A){for(let v=0;v<a;++v)h.push(y+v+0,y+v+1,A+v+0),h.push(y+v+1,A+v+1,A+v+0)}let b=a+1;return m(b*0,b*4),m(b*5,b*7),m(b*6,b*2),m(b*3,b*1),{position:u,normal:d,texcoord:p,indices:h}}function Ga(e,t,o,r,a,n){return Sr(e,e,t,o,r,a,n)}function Ha(e,t,o,r,a,n){if(o<3)throw new Error("radialSubdivisions must be 3 or greater");if(r<3)throw new Error("verticalSubdivisions must be 3 or greater");a=a||0,n=n||Math.PI*2;let i=n-a,s=o+1,c=r+1,l=s*c,u=O(3,l),d=O(3,l),p=O(2,l),g=O(3,o*r*2,Uint16Array);for(let f=0;f<c;++f){let h=f/r,m=h*Math.PI*2,b=Math.sin(m),y=e+b*t,A=Math.cos(m),v=A*t;for(let x=0;x<s;++x){let C=x/o,k=a+C*i,T=Math.sin(k),R=Math.cos(k),D=T*y,V=R*y,B=T*b,W=R*b;u.push(D,v,V),d.push(B,A,W),p.push(C,1-h)}}for(let f=0;f<r;++f)for(let h=0;h<o;++h){let m=1+h,b=1+f;g.push(s*f+h,s*b+h,s*f+m),g.push(s*b+h,s*b+m,s*f+m)}return{position:u,normal:d,texcoord:p,indices:g}}function Wa(e,t,o,r,a){if(t<3)throw new Error("divisions must be at least 3");o=o||1,a=a||1,r=r||0;let n=(t+1)*(o+1),i=O(3,n),s=O(3,n),c=O(2,n),l=O(3,o*t*2,Uint16Array),u=0,d=e-r,p=t+1;for(let g=0;g<=o;++g){let f=r+d*Math.pow(g/o,a);for(let h=0;h<=t;++h){let m=2*Math.PI*h/t,b=f*Math.cos(m),y=f*Math.sin(m);if(i.push(b,0,y),s.push(0,1,0),c.push(1-h/t,g/o),g>0&&h!==t){let A=u+(h+1),v=u+h,x=u+h-p,C=u+(h+1)-p;l.push(A,v,x),l.push(A,x,C)}}u+=t+1}return{position:i,normal:s,texcoord:c,indices:l}}function Ie(e){return function(t){let o=e.apply(this,Array.prototype.slice.call(arguments,1));return pc(t,o)}}function Ne(e){return function(t){let o=e.apply(null,Array.prototype.slice.call(arguments,1));return yr(t,o)}}var Cp=Ne(za),_p=Ie(za),Ep=Ne(Va),Bp=Ie(Va),wp=Ne(Ua),kp=Ie(Ua),Rp=Ne(Oa),Tp=Ie(Oa),Fp=Ne(Sr),Mp=Ie(Sr),Pp=Ne(Na),Dp=Ie(Na),Ip=Ne(La),Np=Ie(La),Up=Ne(Ga),Op=Ie(Ga),Vp=Ne(Ha),zp=Ie(Ha),Lp=Ne(Wa),Gp=Ie(Wa);function Ar(e){return!!e.texStorage2D}var ir=(function(){let e={},t={};function o(r){let a=r.constructor.name;if(!e[a]){for(let n in r)if(typeof r[n]=="number"){let i=t[r[n]];t[r[n]]=i?`${i} | ${n}`:n}e[a]=!0}}return function(a,n){return o(a),t[n]||(typeof n=="number"?`0x${n.toString(16)}`:n)}})();var Hp={textureColor:new Uint8Array([128,192,255,255]),textureOptions:{},crossOrigin:void 0};var Ac=6406,ba=6407,ya=6408,Cc=6409,_c=6410,Ec=6402,Bc=34041;var wc=33319,kc=33320,Rc=6403,Tc=36244,Fc=36248,Mc=36249;var Pc={};{let e=Pc;e[Ac]={numColorComponents:1},e[Cc]={numColorComponents:1},e[_c]={numColorComponents:2},e[ba]={numColorComponents:3},e[ya]={numColorComponents:4},e[Rc]={numColorComponents:1},e[Tc]={numColorComponents:1},e[wc]={numColorComponents:2},e[kc]={numColorComponents:2},e[ba]={numColorComponents:3},e[Fc]={numColorComponents:3},e[ya]={numColorComponents:4},e[Mc]={numColorComponents:4},e[Ec]={numColorComponents:1},e[Bc]={numColorComponents:2}}var Cr=Wl;function Qa(e){return typeof document<"u"&&document.getElementById?document.getElementById(e):null}var jt=33984;var Zt=34962,Dc=34963;var Ic=35713,Nc=35714,Uc=35632,Oc=35633,Vc=35981,Ya=35718,zc=35721,Lc=35971,Gc=35382,Hc=35396,Wc=35398,Qc=35392,Yc=35395,$t=5126,Xa=35664,qa=35665,Ka=35666,_r=5124,ja=35667,Ja=35668,Za=35669,$a=35670,ei=35671,ti=35672,oi=35673,ri=35674,ni=35675,ai=35676,Xc=35678,qc=35680,Kc=35679,jc=35682,Jc=35685,Zc=35686,$c=35687,eu=35688,tu=35689,ou=35690,ru=36289,nu=36292,au=36293,Er=5125,ii=36294,si=36295,li=36296,iu=36298,su=36299,lu=36300,cu=36303,uu=36306,fu=36307,du=36308,mu=36311,eo=3553,to=34067,Br=32879,oo=35866,F={};function ci(e,t){return F[t].bindPoint}function pu(e,t){return function(o){e.uniform1f(t,o)}}function gu(e,t){return function(o){e.uniform1fv(t,o)}}function hu(e,t){return function(o){e.uniform2fv(t,o)}}function xu(e,t){return function(o){e.uniform3fv(t,o)}}function bu(e,t){return function(o){e.uniform4fv(t,o)}}function ui(e,t){return function(o){e.uniform1i(t,o)}}function fi(e,t){return function(o){e.uniform1iv(t,o)}}function di(e,t){return function(o){e.uniform2iv(t,o)}}function mi(e,t){return function(o){e.uniform3iv(t,o)}}function pi(e,t){return function(o){e.uniform4iv(t,o)}}function yu(e,t){return function(o){e.uniform1ui(t,o)}}function vu(e,t){return function(o){e.uniform1uiv(t,o)}}function Su(e,t){return function(o){e.uniform2uiv(t,o)}}function Au(e,t){return function(o){e.uniform3uiv(t,o)}}function Cu(e,t){return function(o){e.uniform4uiv(t,o)}}function _u(e,t){return function(o){e.uniformMatrix2fv(t,!1,o)}}function Eu(e,t){return function(o){e.uniformMatrix3fv(t,!1,o)}}function Bu(e,t){return function(o){e.uniformMatrix4fv(t,!1,o)}}function wu(e,t){return function(o){e.uniformMatrix2x3fv(t,!1,o)}}function ku(e,t){return function(o){e.uniformMatrix3x2fv(t,!1,o)}}function Ru(e,t){return function(o){e.uniformMatrix2x4fv(t,!1,o)}}function Tu(e,t){return function(o){e.uniformMatrix4x2fv(t,!1,o)}}function Fu(e,t){return function(o){e.uniformMatrix3x4fv(t,!1,o)}}function Mu(e,t){return function(o){e.uniformMatrix4x3fv(t,!1,o)}}function pe(e,t,o,r){let a=ci(e,t);return Ar(e)?function(n){let i,s;!n||ka(e,n)?(i=n,s=null):(i=n.texture,s=n.sampler),e.uniform1i(r,o),e.activeTexture(jt+o),e.bindTexture(a,i),e.bindSampler(o,s)}:function(n){e.uniform1i(r,o),e.activeTexture(jt+o),e.bindTexture(a,n)}}function ge(e,t,o,r,a){let n=ci(e,t),i=new Int32Array(a);for(let s=0;s<a;++s)i[s]=o+s;return Ar(e)?function(s){e.uniform1iv(r,i),s.forEach(function(c,l){e.activeTexture(jt+i[l]);let u,d;!c||ka(e,c)?(u=c,d=null):(u=c.texture,d=c.sampler),e.bindSampler(o,d),e.bindTexture(n,u)})}:function(s){e.uniform1iv(r,i),s.forEach(function(c,l){e.activeTexture(jt+i[l]),e.bindTexture(n,c)})}}F[$t]={Type:Float32Array,size:4,setter:pu,arraySetter:gu};F[Xa]={Type:Float32Array,size:8,setter:hu,cols:2};F[qa]={Type:Float32Array,size:12,setter:xu,cols:3};F[Ka]={Type:Float32Array,size:16,setter:bu,cols:4};F[_r]={Type:Int32Array,size:4,setter:ui,arraySetter:fi};F[ja]={Type:Int32Array,size:8,setter:di,cols:2};F[Ja]={Type:Int32Array,size:12,setter:mi,cols:3};F[Za]={Type:Int32Array,size:16,setter:pi,cols:4};F[Er]={Type:Uint32Array,size:4,setter:yu,arraySetter:vu};F[ii]={Type:Uint32Array,size:8,setter:Su,cols:2};F[si]={Type:Uint32Array,size:12,setter:Au,cols:3};F[li]={Type:Uint32Array,size:16,setter:Cu,cols:4};F[$a]={Type:Uint32Array,size:4,setter:ui,arraySetter:fi};F[ei]={Type:Uint32Array,size:8,setter:di,cols:2};F[ti]={Type:Uint32Array,size:12,setter:mi,cols:3};F[oi]={Type:Uint32Array,size:16,setter:pi,cols:4};F[ri]={Type:Float32Array,size:32,setter:_u,rows:2,cols:2};F[ni]={Type:Float32Array,size:48,setter:Eu,rows:3,cols:3};F[ai]={Type:Float32Array,size:64,setter:Bu,rows:4,cols:4};F[Jc]={Type:Float32Array,size:32,setter:wu,rows:2,cols:3};F[Zc]={Type:Float32Array,size:32,setter:Ru,rows:2,cols:4};F[$c]={Type:Float32Array,size:48,setter:ku,rows:3,cols:2};F[eu]={Type:Float32Array,size:48,setter:Fu,rows:3,cols:4};F[tu]={Type:Float32Array,size:64,setter:Tu,rows:4,cols:2};F[ou]={Type:Float32Array,size:64,setter:Mu,rows:4,cols:3};F[Xc]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:eo};F[qc]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:to};F[Kc]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:Br};F[jc]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:eo};F[ru]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:oo};F[nu]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:oo};F[au]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:to};F[iu]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:eo};F[su]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:Br};F[lu]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:to};F[cu]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:oo};F[uu]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:eo};F[fu]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:Br};F[du]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:to};F[mu]={Type:null,size:0,setter:pe,arraySetter:ge,bindPoint:oo};function ro(e,t){return function(o){if(o.value)switch(e.disableVertexAttribArray(t),o.value.length){case 4:e.vertexAttrib4fv(t,o.value);break;case 3:e.vertexAttrib3fv(t,o.value);break;case 2:e.vertexAttrib2fv(t,o.value);break;case 1:e.vertexAttrib1fv(t,o.value);break;default:throw new Error("the length of a float constant value must be between 1 and 4!")}else e.bindBuffer(Zt,o.buffer),e.enableVertexAttribArray(t),e.vertexAttribPointer(t,o.numComponents||o.size,o.type||$t,o.normalize||!1,o.stride||0,o.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,o.divisor||0)}}function je(e,t){return function(o){if(o.value)if(e.disableVertexAttribArray(t),o.value.length===4)e.vertexAttrib4iv(t,o.value);else throw new Error("The length of an integer constant value must be 4!");else e.bindBuffer(Zt,o.buffer),e.enableVertexAttribArray(t),e.vertexAttribIPointer(t,o.numComponents||o.size,o.type||_r,o.stride||0,o.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,o.divisor||0)}}function no(e,t){return function(o){if(o.value)if(e.disableVertexAttribArray(t),o.value.length===4)e.vertexAttrib4uiv(t,o.value);else throw new Error("The length of an unsigned integer constant value must be 4!");else e.bindBuffer(Zt,o.buffer),e.enableVertexAttribArray(t),e.vertexAttribIPointer(t,o.numComponents||o.size,o.type||Er,o.stride||0,o.offset||0),e.vertexAttribDivisor&&e.vertexAttribDivisor(t,o.divisor||0)}}function wr(e,t,o){let r=o.size,a=o.count;return function(n){e.bindBuffer(Zt,n.buffer);let i=n.size||n.numComponents||r,s=i/a,c=n.type||$t,u=F[c].size*i,d=n.normalize||!1,p=n.offset||0,g=u/a;for(let f=0;f<a;++f)e.enableVertexAttribArray(t+f),e.vertexAttribPointer(t+f,s,c,d,u,p+g*f),e.vertexAttribDivisor&&e.vertexAttribDivisor(t+f,n.divisor||0)}}var j={};j[$t]={size:4,setter:ro};j[Xa]={size:8,setter:ro};j[qa]={size:12,setter:ro};j[Ka]={size:16,setter:ro};j[_r]={size:4,setter:je};j[ja]={size:8,setter:je};j[Ja]={size:12,setter:je};j[Za]={size:16,setter:je};j[Er]={size:4,setter:no};j[ii]={size:8,setter:no};j[si]={size:12,setter:no};j[li]={size:16,setter:no};j[$a]={size:4,setter:je};j[ei]={size:8,setter:je};j[ti]={size:12,setter:je};j[oi]={size:16,setter:je};j[ri]={size:4,setter:wr,count:2};j[ni]={size:9,setter:wr,count:3};j[ai]={size:16,setter:wr,count:4};var Pu=/ERROR:\s*\d+:(\d+)/gi;function Du(e,t="",o=0){let r=[...t.matchAll(Pu)],a=new Map(r.map((n,i)=>{let s=parseInt(n[1]),c=r[i+1],l=c?c.index:t.length,u=t.substring(n.index,l);return[s-1,u]}));return e.split(`
`).map((n,i)=>{let s=a.get(i);return`${i+1+o}: ${n}${s?`

^^^ ${s}`:""}`}).join(`
`)}var va=/^[ \t]*\n/;function gi(e){let t=0;return va.test(e)&&(t=1,e=e.replace(va,"")),{lineOffset:t,shaderSource:e}}function Iu(e,t){return e.errorCallback(t),e.callback&&setTimeout(()=>{e.callback(`${t}
${e.errors.join(`
`)}`)}),null}function Nu(e,t,o,r){if(r=r||Cr,!e.getShaderParameter(o,Ic)){let n=e.getShaderInfoLog(o),{lineOffset:i,shaderSource:s}=gi(e.getShaderSource(o)),c=`${Du(s,n,i)}
Error compiling ${ir(e,t)}: ${n}`;return r(c),c}return""}function Dt(e,t,o){let r,a,n;if(typeof t=="function"&&(o=t,t=void 0),typeof e=="function")o=e,e=void 0;else if(e&&!Array.isArray(e)){let l=e;o=l.errorCallback,e=l.attribLocations,r=l.transformFeedbackVaryings,a=l.transformFeedbackMode,n=l.callback}let i=o||Cr,s=[],c={errorCallback(l,...u){s.push(l),i(l,...u)},transformFeedbackVaryings:r,transformFeedbackMode:a,callback:n,errors:s};{let l={};Array.isArray(e)?e.forEach(function(u,d){l[u]=t?t[d]:d}):l=e||{},c.attribLocations=l}return c}var Uu=["VERTEX_SHADER","FRAGMENT_SHADER"];function Ou(e,t){if(t.indexOf("frag")>=0)return Uc;if(t.indexOf("vert")>=0)return Oc}function Vu(e,t,o){let r=e.getAttachedShaders(t);for(let a of r)o.has(a)||e.deleteShader(a);e.deleteProgram(t)}var zu=(e=0)=>new Promise(t=>setTimeout(t,e));function hi(e,t,o){let r=e.createProgram(),{attribLocations:a,transformFeedbackVaryings:n,transformFeedbackMode:i}=Dt(o);for(let s=0;s<t.length;++s){let c=t[s];if(typeof c=="string"){let l=Qa(c),u=l?l.text:c,d=e[Uu[s]];l&&l.type&&(d=Ou(e,l.type)||d),c=e.createShader(d),e.shaderSource(c,gi(u).shaderSource),e.compileShader(c)}e.attachShader(r,c)}Object.entries(a).forEach(([s,c])=>e.bindAttribLocation(r,c,s));{let s=n;s&&(s.attribs&&(s=s.attribs),Array.isArray(s)||(s=Object.keys(s)),e.transformFeedbackVaryings(r,s,i||Vc))}return e.linkProgram(r),r}function xi(e,t,o,r,a){let n=Dt(o,r,a),i=new Set(t),s=hi(e,t,n);function c(l,u){let d=yi(l,u,n.errorCallback);return d&&Vu(l,u,i),d}if(n.callback){bi(e,s).then(()=>{let l=c(e,s);n.callback(l,l?void 0:s)});return}return c(e,s)?void 0:s}function ao(e){return function(t,o,...r){return new Promise((a,n)=>{let i=Dt(...r);i.callback=(s,c)=>{s?n(s):a(c)},e(t,o,i)})}}var Wp=ao(xi),Qp=ao(Rr);async function bi(e,t){let o=e.getExtension("KHR_parallel_shader_compile"),r=o?(n,i)=>n.getProgramParameter(i,o.COMPLETION_STATUS_KHR):()=>!0,a=0;do await zu(a),a=1e3/60;while(!r(e,t))}async function Lu(e,t){for(let o of Object.values(t))await bi(e,o)}function yi(e,t,o){if(o=o||Cr,!e.getProgramParameter(t,Nc)){let a=e.getProgramInfoLog(t);o(`Error in program linking: ${a}`);let i=e.getAttachedShaders(t).map(s=>Nu(e,e.getShaderParameter(s,e.SHADER_TYPE),s,o));return`${a}
${i.filter(s=>s).join(`
`)}`}}function Gu(e,t,o,r,a){return xi(e,t,o,r,a)}function vi(e){let t=e.name;return t.startsWith("gl_")||t.startsWith("webgl_")}var Hu=/(\.|\[|]|\w+)/g,Wu=e=>e>="0"&&e<="9";function Qu(e,t,o,r){let a=e.split(Hu).filter(s=>s!==""),n=0,i="";for(;;){let s=a[n++];i+=s;let c=Wu(s[0]),l=c?parseInt(s):s;if(c&&(i+=a[n++]),n===a.length){o[l]=t;break}else{let d=a[n++],p=d==="[",g=o[l]||(p?[]:{});o[l]=g,o=g,r[i]=r[i]||(function(f){return function(h){Si(f,h)}})(g),i+=d}}}function Yu(e,t){let o=0;function r(s,c,l){let u=c.name.endsWith("[0]"),d=c.type,p=F[d];if(!p)throw new Error(`unknown type: 0x${d.toString(16)}`);let g;if(p.bindPoint){let f=o;o+=c.size,u?g=p.arraySetter(e,d,f,l,c.size):g=p.setter(e,d,f,l,c.size)}else p.arraySetter&&u?g=p.arraySetter(e,l):g=p.setter(e,l);return g.location=l,g}let a={},n={},i=e.getProgramParameter(t,Ya);for(let s=0;s<i;++s){let c=e.getActiveUniform(t,s);if(vi(c))continue;let l=c.name;l.endsWith("[0]")&&(l=l.substr(0,l.length-3));let u=e.getUniformLocation(t,c.name);if(u){let d=r(t,c,u);a[l]=d,Qu(l,d,n,a)}}return a}function Xu(e,t){let o={},r=e.getProgramParameter(t,Lc);for(let a=0;a<r;++a){let n=e.getTransformFeedbackVarying(t,a);o[n.name]={index:a,type:n.type,size:n.size}}return o}function qu(e,t){let o=e.getProgramParameter(t,Ya),r=[],a=[];for(let s=0;s<o;++s){a.push(s),r.push({});let c=e.getActiveUniform(t,s);r[s].name=c.name}[["UNIFORM_TYPE","type"],["UNIFORM_SIZE","size"],["UNIFORM_BLOCK_INDEX","blockNdx"],["UNIFORM_OFFSET","offset"]].forEach(function(s){let c=s[0],l=s[1];e.getActiveUniforms(t,a,e[c]).forEach(function(u,d){r[d][l]=u})});let n={},i=e.getProgramParameter(t,Gc);for(let s=0;s<i;++s){let c=e.getActiveUniformBlockName(t,s),l={index:e.getUniformBlockIndex(t,c),usedByVertexShader:e.getActiveUniformBlockParameter(t,s,Hc),usedByFragmentShader:e.getActiveUniformBlockParameter(t,s,Wc),size:e.getActiveUniformBlockParameter(t,s,Qc),uniformIndices:e.getActiveUniformBlockParameter(t,s,Yc)};l.used=l.usedByVertexShader||l.usedByFragmentShader,n[c]=l}return{blockSpecs:n,uniformData:r}}function Si(e,t){for(let o in t){let r=e[o];typeof r=="function"?r(t[o]):Si(e[o],t[o])}}function kr(e,...t){let o=e.uniformSetters||e,r=t.length;for(let a=0;a<r;++a){let n=t[a];if(Array.isArray(n)){let i=n.length;for(let s=0;s<i;++s)kr(o,n[s])}else for(let i in n){let s=o[i];s&&s(n[i])}}}function Ku(e,t){let o={},r=e.getProgramParameter(t,zc);for(let a=0;a<r;++a){let n=e.getActiveAttrib(t,a);if(vi(n))continue;let i=e.getAttribLocation(t,n.name),s=j[n.type],c=s.setter(e,i,s);c.location=i,o[n.name]=c}return o}function ju(e,t){for(let o in t){let r=e[o];r&&r(t[o])}}function Ai(e,t,o){o.vertexArrayObject?e.bindVertexArray(o.vertexArrayObject):(ju(t.attribSetters||t,o.attribs),o.indices&&e.bindBuffer(Dc,o.indices))}function sr(e,t){let o=Yu(e,t),r=Ku(e,t),a={program:t,uniformSetters:o,attribSetters:r,uniformLocations:Object.fromEntries(Object.entries(o).map(([n,i])=>[n,i.location])),attribLocations:Object.fromEntries(Object.entries(r).map(([n,i])=>[n,i.location]))};return Ar(e)&&(a.uniformBlockSpec=qu(e,t),a.transformFeedbackInfo=Xu(e,t)),a}var Ju=/\s|{|}|;/;function Rr(e,t,o,r,a){let n=Dt(o,r,a),i=[];if(t=t.map(function(l){if(!Ju.test(l)){let u=Qa(l);if(u)l=u.text;else{let d=`no element with id: ${l}`;n.errorCallback(d),i.push(d)}}return l}),i.length)return Iu(n,"");let s=n.callback;s&&(n.callback=(l,u)=>{s(l,l?void 0:sr(e,u))});let c=Gu(e,t,n);return c?sr(e,c):null}function Sa(e,t,o,r,a){for(let[n,i]of Object.entries(t)){let s={...a},c=o[n];Array.isArray(c)||Object.assign(s,c);let l=yi(e,i,s.errorCallback);if(l){for(let u of Object.values(t)){let d=e.getAttachedShaders(u);e.deleteProgram(u);for(let p of d)r.has(p)||e.deleteShader(p)}return l}}}function Ci(e,t,o={}){let r=new Set,a=Object.fromEntries(Object.entries(t).map(([i,s])=>{let c={...o},l=Array.isArray(s)?s:s.shaders;return Array.isArray(s)||Object.assign(c,s),l.forEach(r.add,r),[i,hi(e,l,c)]}));if(o.callback){Lu(e,a).then(()=>{let i=Sa(e,a,t,r,o);o.callback(i,i?void 0:a)});return}return Sa(e,a,t,r,o)?void 0:a}function Zu(e,t,o){o=Dt(o);function r(i,s){return Object.fromEntries(Object.entries(s).map(([c,l])=>[c,sr(i,l)]))}let a=o.callback;a&&(o.callback=(i,s)=>{a(i,i?void 0:r(e,s))});let n=Ci(e,t,o);if(!(a||!n))return r(e,n)}var Yp=ao(Ci),Xp=ao(Zu);var $u=4,Aa=5123;function _i(e,t,o,r,a,n){o=o===void 0?$u:o;let i=t.indices,s=t.elementType,c=r===void 0?t.numElements:r;a=a===void 0?0:a,s||i?n!==void 0?e.drawElementsInstanced(o,c,s===void 0?Aa:t.elementType,a,n):e.drawElements(o,c,s===void 0?Aa:t.elementType,a):n!==void 0?e.drawArraysInstanced(o,a,c,n):e.drawArrays(o,a,c)}var ef=6402;var tf=33190,of=36012,rf=35056,nf=36013,af=32854,sf=32855,lf=36194,Ei=33189,Bi=6401,wi=36168,ki=34041;var io=36096,Ri=36128,Tr=33306;var ze={};ze[ki]=Tr;ze[Bi]=Ri;ze[wi]=Ri;ze[ef]=io;ze[Ei]=io;ze[tf]=io;ze[of]=io;ze[rf]=Tr;ze[nf]=Tr;var it={};it[af]=!0;it[sf]=!0;it[lf]=!0;it[ki]=!0;it[Ei]=!0;it[Bi]=!0;it[wi]=!0;var cf={addExtensionsToContext:!0};var uf=/^(.*?)_/;function ff(e,t){ir(e,0);let o=e.getExtension(t);if(o){let r={},a=uf.exec(t)[1],n="_"+a;for(let i in o){let s=o[i],c=typeof s=="function",l=c?a:n,u=i;i.endsWith(l)&&(u=i.substring(0,i.length-l.length)),e[u]!==void 0?!c&&e[u]!==s&&Ql(u,e[u],s,i):c?e[u]=(function(d){return function(){return d.apply(o,arguments)}})(s):(e[u]=s,r[u]=s)}r.constructor={name:o.constructor.name},ir(r,0)}return o}var Ca=["ANGLE_instanced_arrays","EXT_blend_minmax","EXT_color_buffer_float","EXT_color_buffer_half_float","EXT_disjoint_timer_query","EXT_disjoint_timer_query_webgl2","EXT_frag_depth","EXT_sRGB","EXT_shader_texture_lod","EXT_texture_compression_bptc","EXT_texture_compression_rgtc","EXT_texture_filter_anisotropic","OES_element_index_uint","OES_standard_derivatives","OES_texture_float","OES_texture_float_linear","OES_texture_half_float","OES_texture_half_float_linear","OES_vertex_array_object","WEBGL_color_buffer_float","WEBGL_compressed_texture_atc","WEBGL_compressed_texture_etc1","WEBGL_compressed_texture_etc","WEBGL_compressed_texture_pvrtc","WEBGL_compressed_texture_s3tc","WEBGL_compressed_texture_s3tc_srgb","WEBGL_depth_texture","WEBGL_draw_buffers"];function df(e){for(let t=0;t<Ca.length;++t)ff(e,Ca[t])}function mf(e,t){let o=["webgl2","webgl","experimental-webgl"],r=null;for(let a=0;a<o.length;++a)if(r=e.getContext(o[a],t),r){cf.addExtensionsToContext&&df(r);break}return r}function Ti(e,t){return mf(e,t)}function Fi(e,t){t=t||1,t=Math.max(0,t);let o=e.clientWidth*t|0,r=e.clientHeight*t|0;return e.width!==o||e.height!==r?(e.width=o,e.height=r,!0):!1}var Di=S(_(),1),Mi=150,gf=`
attribute float a_index;
uniform vec2 u_resolution;
uniform float u_time;
varying float v_color_type;
varying float v_intensity_base;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  float seed = a_index * 123.456;
  
  float speed_rand = hash2(vec2(seed, 1.1));
  float size_rand = hash2(vec2(seed, 2.2));
  float y_rand = hash2(vec2(seed, 3.3));
  float x_rand = hash2(vec2(seed, 4.4));
  float blink_rand = hash2(vec2(seed, 5.5));
  float color_type_rand = hash2(vec2(seed, 6.6));

  float aspect = u_resolution.x / u_resolution.y;
  float speed = 0.008 + speed_rand * 0.024;
  float size = 0.0006 + 0.0032 * pow(size_rand, 3.8);
  
  float y = -0.45 + y_rand * 0.9;
  
  float margin = 0.05;
  float width = aspect + margin * 2.0;
  float x = fract(x_rand + u_time * speed);
  x = x * width - (aspect * 0.5 + margin);
  
  float wave = sin(u_time * 0.3 + y_rand * 6.283) * 0.005;
  
  float ndc_x = x / (aspect * 0.5);
  float ndc_y = (y + wave) / 0.5;
  
  gl_Position = vec4(ndc_x, ndc_y, 0.0, 1.0);
  
  // Point size in pixels. 
  float pointSize = size * u_resolution.y * 3.5;
  gl_PointSize = max(2.0, pointSize);
  
  float blink = 0.3 + 0.7 * sin(u_time * (1.0 + blink_rand * 2.5) + x_rand * 6.283);
  v_intensity_base = blink;
  v_color_type = color_type_rand;
}
`,hf=`
precision mediump float;
uniform vec3 u_particle_color;
uniform vec3 u_particle_accent_color;

varying float v_color_type;
varying float v_intensity_base;

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float dist = length(pc);
  
  float alpha = smoothstep(0.5, 0.1, dist) * v_intensity_base;
  if (alpha < 0.01) discard;
  
  vec3 baseColor = v_color_type > 0.90 ? u_particle_accent_color : u_particle_color;
  
  // Pre-multiplied alpha blending
  gl_FragColor = vec4(baseColor * alpha, alpha);
}
`,xf=({theme:e,isDaylight:t,paused:o=!1})=>{let r=(0,Ue.useRef)(null),a=(0,Ue.useRef)(null),n=(0,Ue.useRef)(0),i=At(e.primaryColor)||(t?{r:0,g:0,b:0}:{r:255,g:255,b:255}),s=[i.r/255,i.g/255,i.b/255],c=At(e.accentColor)||i,l=[c.r/255,c.g/255,c.b/255],u=t?[1,1,1]:[0,0,0],d=(0,Ue.useRef)(o),p=(0,Ue.useRef)(s),g=(0,Ue.useRef)(l),f=(0,Ue.useRef)(u);return d.current=o,p.current=s,g.current=l,f.current=u,(0,Ue.useEffect)(()=>{let h=r.current;if(!h)return;let m=Ti(h,{alpha:!1,depth:!1,antialias:!1});if(!m)return;let b=Rr(m,[gf,hf],k=>{console.error("SoraBackground twgl program error:",k)});if(!b)return;let y=new Float32Array(Mi);for(let k=0;k<Mi;k++)y[k]=k;let v=yr(m,{a_index:{numComponents:1,data:y}}),x=performance.now(),C=k=>{if(!d.current){let D=(k-x)/1e3;n.current+=D}x=k,Fi(h),m.viewport(0,0,m.canvas.width,m.canvas.height);let T=f.current;m.clearColor(T[0],T[1],T[2],1),m.clear(m.COLOR_BUFFER_BIT),m.enable(m.BLEND),m.blendFunc(m.ONE,m.ONE_MINUS_SRC_ALPHA);let R={u_resolution:[m.canvas.width,m.canvas.height],u_time:n.current,u_particle_color:p.current,u_particle_accent_color:g.current};m.useProgram(b.program),Ai(m,b,v),kr(b,R),_i(m,v,m.POINTS),a.current=requestAnimationFrame(C)};return a.current=requestAnimationFrame(C),()=>{a.current&&cancelAnimationFrame(a.current),m.deleteProgram(b.program),v.attribs&&v.attribs.a_index&&v.attribs.a_index.buffer&&m.deleteBuffer(v.attribs.a_index.buffer)}},[]),(0,Di.jsx)("canvas",{ref:r,className:"absolute inset-0 w-full h-full block pointer-events-none",style:{width:"100%",height:"100%",willChange:"transform",transform:"translateZ(0)"}})},Pi=xf;var bt=S(_(),1),bf=({t:e,isDaylight:t,theme:o,controlCardBg:r,tuning:a,onTuningChange:n})=>{let i=E(o.secondaryColor,t?.18:.16);return(0,bt.jsxs)("div",{className:"rounded-[24px] border p-4 space-y-5",style:{backgroundColor:r,borderColor:i},children:[(0,bt.jsx)("div",{className:"space-y-1",children:(0,bt.jsx)("div",{className:"text-sm font-medium",style:{color:o.primaryColor},children:e("options.soraBackgroundSettings")})}),(0,bt.jsx)(X,{label:e("options.soraBlank"),description:e("options.soraBlankDesc"),checked:a.blank,onChange:s=>n?.({blank:s}),theme:o})]})},Ii=bf;var yt=S(_(),1),yf=_e({mode:"sora",order:50,labelKey:"options.visualizerBackgroundModeSora",labelFallback:"Sora",render:({config:e,theme:t,isDaylight:o,paused:r})=>(0,yt.jsx)("div",{className:"absolute inset-0 z-0",style:{backgroundColor:o?"#ffffff":"#000000"},children:!e?.sora?.tuning?.blank&&(0,yt.jsx)(Pi,{theme:t,isDaylight:o,paused:r})}),renderSettingsPanel:({config:e,actions:t,t:o,isDaylight:r,theme:a,controlCardBg:n})=>(0,yt.jsx)(Ii,{t:o,isDaylight:r,theme:a,controlCardBg:n,tuning:e?.sora?.tuning??so,onTuningChange:t?.sora?.onTuningChange}),renderQuickControls:({config:e,actions:t,t:o,theme:r})=>{let a=e?.sora?.tuning??so;return(0,yt.jsx)(Ge,{active:a.blank,theme:r,label:o("options.soraBlank"),onToggle:()=>t?.sora?.onTuningChange?.({blank:!a.blank}),children:(0,yt.jsx)(Qr,{size:14})})},resetSettings:e=>e?.sora?.onResetTuning?.()});var Pr={};ft(Pr,{default:()=>Af});var Je=S(K(),1);var It=S(_(),1),vf=({urlBackgroundList:e=[],urlBackgroundSelectedId:t=null})=>{let o=(0,Je.useMemo)(()=>qr(e.find(i=>i.id===t)),[e,t]),r=(0,Je.useRef)(null),[a,n]=(0,Je.useState)(!1);return(0,Je.useEffect)(()=>{n(!1);let i=r.current;if(!i)return;let s=i.getBoundingClientRect();if(s.width>0&&s.height>0){n(!0);return}let c=new ResizeObserver(l=>{for(let u of l){let{width:d,height:p}=u.contentRect;d>0&&p>0&&(n(!0),c.disconnect())}});return c.observe(i),()=>{c.disconnect()}},[o]),o?.url?(0,It.jsxs)("div",{ref:r,className:"absolute inset-0 z-0 overflow-hidden",children:[a&&(0,It.jsx)("iframe",{src:o.url,title:o.note||o.url,className:"w-full h-full border-0",style:{pointerEvents:"none"},sandbox:"allow-scripts",allowFullScreen:!0},o.url),(0,It.jsx)("div",{className:"absolute inset-0",style:{background:"linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35))",pointerEvents:"none"}})]}):null},Ni=vf;var Fe=S(K(),1);var P=S(_(),1),Sf=()=>`url-bg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,Ui=({t:e,isDaylight:t,theme:o,controlCardBg:r,urlBackgroundList:a=[],urlBackgroundSelectedId:n=null,onAddUrlBackgroundItem:i,onUpdateUrlBackgroundItem:s,onDeleteUrlBackgroundItem:c,onSetUrlBackgroundSelectedId:l})=>{let[u,d]=(0,Fe.useState)(!1),[p,g]=(0,Fe.useState)(null),[f,h]=(0,Fe.useState)(""),[m,b]=(0,Fe.useState)(""),y=(0,Fe.useCallback)(()=>{h(""),b(""),d(!1),g(null)},[]),A=(0,Fe.useCallback)(()=>{let B=po(f);if(!B)return;let W={id:Sf(),url:B,note:m.trim()||B};i?.(W),l?.(W.id),y()},[f,m,i,l,y]),v=(0,Fe.useCallback)(B=>{g(B.id),h(B.url),b(B.note)},[]),x=(0,Fe.useCallback)(()=>{if(!p)return;let B=po(f);B&&(s?.(p,{url:B,note:m.trim()||B}),y())},[p,f,m,s,y]),C=(0,Fe.useCallback)(B=>{c?.(B)},[c]),k=(0,Fe.useCallback)(B=>{l?.(B)},[l]),T=u||p!==null,R=E(o.secondaryColor,t?.18:.16),D=E(o.backgroundColor,t?.24:.34),V=E(o.backgroundColor,t?.42:.52);return(0,P.jsxs)("div",{className:"rounded-[24px] border p-4 space-y-4",style:{backgroundColor:r,borderColor:R},children:[(0,P.jsxs)("div",{className:"space-y-1",children:[(0,P.jsx)("div",{className:"text-sm font-medium",style:{color:o.primaryColor},children:e("options.urlBackgroundSettings")}),(0,P.jsx)("div",{className:"text-xs opacity-70",style:{color:o.secondaryColor},children:e("options.urlBackgroundSettingsDesc")})]}),a.length>0&&(0,P.jsx)("div",{className:"space-y-2",children:a.map(B=>(0,P.jsx)("div",{className:"rounded-2xl border p-3 transition-all",style:{borderColor:B.id===n?o.accentColor:R,backgroundColor:B.id===n?E(o.accentColor,t?.1:.16):D},children:p===B.id?(0,P.jsxs)("div",{className:"space-y-2",children:[(0,P.jsx)("input",{type:"url",value:f,onChange:W=>h(W.target.value),placeholder:"https://example.com",className:"w-full rounded-xl border px-3 py-2 text-sm outline-none",style:{backgroundColor:V,borderColor:R,color:o.primaryColor}}),(0,P.jsx)("input",{type:"text",value:m,onChange:W=>b(W.target.value),placeholder:e("options.urlBackgroundNotePlaceholder"),className:"w-full rounded-xl border px-3 py-2 text-sm outline-none",style:{backgroundColor:V,borderColor:R,color:o.primaryColor}}),(0,P.jsxs)("div",{className:"flex gap-2 justify-end",children:[(0,P.jsx)("button",{type:"button",onClick:y,className:"h-8 w-8 rounded-full border flex items-center justify-center transition-colors hover:bg-white/10",style:{borderColor:R,color:o.secondaryColor},children:(0,P.jsx)(co,{size:14})}),(0,P.jsx)("button",{type:"button",onClick:x,disabled:!f.trim(),className:"h-8 w-8 rounded-full border flex items-center justify-center transition-colors hover:bg-white/10 disabled:opacity-40",style:{borderColor:o.accentColor,color:o.accentColor},children:(0,P.jsx)(lo,{size:14})})]})]}):(0,P.jsxs)("div",{className:"flex items-center gap-3",children:[(0,P.jsxs)("button",{type:"button",onClick:()=>k(B.id),className:"flex-1 text-left min-w-0",children:[(0,P.jsx)("div",{className:"text-sm font-medium truncate",style:{color:o.primaryColor},children:B.note}),(0,P.jsx)("div",{className:"text-xs opacity-60 truncate mt-0.5",style:{color:o.secondaryColor},children:B.url})]}),(0,P.jsxs)("div",{className:"flex items-center gap-1 shrink-0",children:[(0,P.jsx)("button",{type:"button",onClick:()=>v(B),className:"h-7 w-7 rounded-full border flex items-center justify-center transition-colors hover:bg-white/10",style:{borderColor:R,color:o.secondaryColor},children:(0,P.jsx)(Hr,{size:12})}),(0,P.jsx)("button",{type:"button",onClick:()=>C(B.id),className:"h-7 w-7 rounded-full border flex items-center justify-center transition-colors hover:bg-red-500/10",style:{borderColor:R,color:o.secondaryColor},children:(0,P.jsx)(dt,{size:12})})]})]})},B.id))}),u?(0,P.jsxs)("div",{className:"space-y-2 rounded-2xl border p-3",style:{borderColor:R,backgroundColor:D},children:[(0,P.jsx)("input",{type:"url",value:f,onChange:B=>h(B.target.value),placeholder:"https://example.com",autoFocus:!0,className:"w-full rounded-xl border px-3 py-2 text-sm outline-none",style:{backgroundColor:V,borderColor:R,color:o.primaryColor}}),(0,P.jsx)("input",{type:"text",value:m,onChange:B=>b(B.target.value),placeholder:e("options.urlBackgroundNotePlaceholder"),className:"w-full rounded-xl border px-3 py-2 text-sm outline-none",style:{backgroundColor:V,borderColor:R,color:o.primaryColor}}),(0,P.jsxs)("div",{className:"flex gap-2 justify-end",children:[(0,P.jsx)("button",{type:"button",onClick:y,className:"h-8 w-8 rounded-full border flex items-center justify-center transition-colors hover:bg-white/10",style:{borderColor:R,color:o.secondaryColor},children:(0,P.jsx)(co,{size:14})}),(0,P.jsx)("button",{type:"button",onClick:A,disabled:!f.trim(),className:"h-8 w-8 rounded-full border flex items-center justify-center transition-colors hover:bg-white/10 disabled:opacity-40",style:{borderColor:o.accentColor,color:o.accentColor},children:(0,P.jsx)(lo,{size:14})})]})]}):(0,P.jsxs)("button",{type:"button",onClick:()=>{h(""),b(""),d(!0)},className:"flex h-10 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors hover:bg-white/5",style:{borderColor:R,color:o.primaryColor},children:[(0,P.jsx)(Wr,{size:16}),e("options.urlBackgroundAdd")]}),a.length===0&&!u&&(0,P.jsxs)("div",{className:"flex flex-col items-center gap-2 py-3 opacity-50",children:[(0,P.jsx)(Lr,{size:24,style:{color:o.secondaryColor}}),(0,P.jsx)("div",{className:"text-xs",style:{color:o.secondaryColor},children:e("options.urlBackgroundEmpty")})]})]})};var Mr=S(_(),1),Af=_e({mode:"url",order:40,labelKey:"options.visualizerBackgroundModeUrl",labelFallback:"Embed",render:({config:e})=>(0,Mr.jsx)(Ni,{urlBackgroundList:e?.url?.items,urlBackgroundSelectedId:e?.url?.selectedId}),renderSettingsPanel:({config:e,actions:t,...o})=>(0,Mr.jsx)(Ui,{...o,urlBackgroundList:e?.url?.items,urlBackgroundSelectedId:e?.url?.selectedId,onAddUrlBackgroundItem:t?.url?.onAdd,onUpdateUrlBackgroundItem:t?.url?.onUpdate,onDeleteUrlBackgroundItem:t?.url?.onDelete,onSetUrlBackgroundSelectedId:t?.url?.onSelect})});var Cf={"./common/entry.tsx":ho,"./latent/entry.tsx":Go,"./monet/entry.tsx":er,"./nomand/entry.tsx":ar,"./sora/entry.tsx":Fr,"./url/entry.tsx":Pr},_f=e=>{let t=Object.entries(e).map(([r,a])=>{if(!a.default)throw new Error(`[VisualizerBackgroundRegistry] Missing default export in ${r}`);return a.default}),o={};return t.forEach(r=>{if(o[r.mode])throw new Error(`[VisualizerBackgroundRegistry] Duplicate background mode "${r.mode}"`);o[r.mode]=r}),{entries:[...t].sort((r,a)=>r.order-a.order),byMode:o}},{entries:Ef,byMode:Oi}=_f(Cf);Jr("VisualizerBackgroundRegistry",Ef.map(e=>e.mode),Kr);var bg=e=>Oi[e]??Oi[jr];export{$r as a,Ef as b,bg as c};
/*! For license information please see chunk-OMMOTQQT.js.LEGAL.txt */
