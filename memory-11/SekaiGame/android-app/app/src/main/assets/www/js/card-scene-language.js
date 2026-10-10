// Drawing vocabulary for explicitly authored storyboards. No hashing, random scene
// assignment, rarity switch, card-name matching or fallback scene generation.
export const SCENE_SYMBOLS = {
    attract:["苍之引力","#68b9ff","M0-30A30 30 0 1 0 .1-30M-24 0H-9M9 0H24M0-24V-9M0 9V24M0-12A12 12 0 1 0 .1-12"],
    repulse:["赫之斥力","#ff6b89","M0-18A18 18 0 1 0 .1-18M-22 0H-38M22 0H38M0-22V-38M0 22V38M-27-27-17-17M17 17 27 27"],
    purple:["茈之光核","#c196ff","M0-32A32 32 0 1 0 .1-32M-20-20 20 20M-20 20 20-20M0-16A16 16 0 1 0 .1-16"],
    wing:["羽翼","#bceaff","M0 12Q-12-25-36-28L-22-3-16-10-6 12Z M0 12Q12-25 36-28L22-3 16-10 6 12Z"],
    claw:["爪痕","#e2cfac","M-22-26Q-28 0-10 28M-4-30Q-10 0 6 30M15-25Q8 0 24 24"],
    sword:["剑锋","#d3eeff","M-5 12-3-32 0-40 3-32 5 12 18 12 18 17 4 17 4 32-4 32-4 17-18 17-18 12Z"],
    axe:["战斧","#d6b891","M0-30V35M0-25Q40-35 30 8L0 0M0-25Q-40-35-30 8L0 0"],
    spear:["长枪","#eadcc1","M0 40V-25M0-40-10-18 0-24 10-18Z"],
    shield:["护盾","#bce8de","M0-34 27-22 21 15 0 34-21 15-27-22Z M0-22V21M-16-3H16"],
    rock:["岩层","#dcb887","M-32-2-15-25 14-28 34-4 17 27-18 22Z M-15-25-4 0 34-4M-4 0-18 22"],
    fang:["獠牙","#fff0d8","M-28-20Q-18 12-6 30L-3-20M5-20 9 30Q25 8 30-20"],
    flame:["火焰","#ff9354","M0-37C30-10 4-5 19-17C41 22-28 40-25 2L-8-16Q-12 15 1 10Z"],
    bolt:["雷电","#ffe98a","M9-38-23 8H-4L-12 38 26-12H5Z"],
    water:["流水","#74d8ff","M-38 8Q-16-28 2 0T38-6M-36 23Q-12-10 8 15T36 12"],
    mist:["雾带","#c9e4eb","M-40-16Q-8-30 16-12T42-18M-45 1Q-10-14 15 2T40-1M-35 20Q0 8 35 20"],
    wind:["风旋","#a3edd0","M-40-8H12C45-8 30-35 15-22M-35 3H30M-40 14H12C42 14 25 35 10 25"],
    ice:["冰棱","#c1f4ff","M0-38 22-6 12 30-12 30-22-6Z M0-38V30M-22-6 0 8 22-6"],
    snow:["雪晶","#e0f7ff","M0-35V35M-30-18 30 18M-30 18 30-18M-9-27 0-18 9-27M-9 27 0 18 9 27"],
    moon:["月弧","#d4c3ff","M11-35A35 35 0 1 0 25 29A33 33 0 0 1 11-35Z"],
    sun:["日轮","#ffc86c","M0-22A22 22 0 1 0 .1-22M0-40V-29M0 29V40M-40 0H-29M29 0H40M-28-28-20-20M20 20 28 28M-28 28-20 20M20-20 28-28"],
    star:["星芒","#fff0b8","M0-35 9-9 35 0 9 9 0 35-9 9-35 0-9-9Z"],
    eye:["瞳纹","#dc9eea","M-37 0Q0-35 37 0Q0 35-37 0Z M0-13A13 13 0 1 0 .1-13"],
    clock:["时钟","#ebd8a5","M0-34A34 34 0 1 0 .1-34M0-25V0L17 12M-28 0H-22M22 0H28M0 23V28"],
    fist:["拳影","#cbb7fa","M-25 18V-7L-16-19-9-9-3-27 7-23 11-9 19-15 28-5 21 23-2 30Z M-14 3 14 8"],
    bullet:["弹丸","#ffda88","M-35-9H8Q28-9 38 0Q28 9 8 9H-35Z M-24-9V9"],
    bomb:["引信火核","#ffa171","M0-24A26 26 0 1 0 .1-24M0-24V-32L13-38M13-38 21-34M15-43 15-34"],
    gear:["齿轮","#b6cde2","M-9-32 9-32 12-22 23-16 32-17 38 0 27 7 21 20 22 29 5 36-2 25-16 22-25 25-35 10-24 2-24-12-30-20-16-32-9-22Z M0-11A11 11 0 1 0 .1-11"],
    thread:["丝线","#eaa7ce","M-38-20C45-45-45 45 38 20M-38 20C45 45-45-45 38-20"],
    chain:["锁链","#d6c3ea","M-26-24C-42-14-18 12-8 0L6-14C18-30-9-43-19-29Z M-6 14C-18 30 9 43 19 29L26 24C42 14 18-12 8 0Z"],
    feather:["羽片","#d2e9f5","M-22 32Q-32-12 28-35Q38 12-22 32Z M-22 32 24-29M-10 8 16 3M-3-5 23-10"],
    butterfly:["蝶翼","#d5a4ed","M0 5C-42-40-42 27-7 15C-30 42 0 37 0 14C30 42 42 12 7 13C42-32 15-43 0 5Z"],
    crow:["鸦影","#b4a3d4","M-40-18-12-7 0-25 12-7 40-18 19 10 8 14 0 32-8 14-19 10Z"],
    serpent:["蛇行","#c6d59f","M-35 28C40 40-40-18 18-20L31-30 39-20 28-10 18-20M31-20H34"],
    dragon:["龙纹","#b4e7ed","M-32 29C38 30-24-5 0-22L17-28 10-39 29-27 39-14 21-9 9-13M-15 19-30 8M-2 5 14 12"],
    crown:["冠冕","#ffdc8f","M-33-20-20 0 0-30 20 0 33-20 26 25H-26Z M-25 15H25"],
    rose:["蔷薇","#ef9db9","M0-30 18-18 29 0 15 22-7 28-28 10-22-13Z M0-17 17-3 3 14-15 5-9-12Z M0 28V43M0 36 20 28"],
    thorn:["荆棘","#df8eaa","M-40 16Q0-25 40 12M-25 5-24-14-12-3M0-4 12-23 14-1M23 4 35-12 32 9"],
    petal:["花瓣","#ffb9d1","M0 0C-35-42 22-42 0 0C42-35 42 22 0 0C35 42-22 42 0 0C-42 35-42-22 0 0Z"],
    leaf:["叶片","#b8e5a7","M-28 29Q-37-26 30-34Q42 22-28 29Z M-28 29 24-27M-8 8 16 9"],
    note:["音符","#96e8ea","M-10 16V-24L21-30V10M-10-13 21-19M-10 16C-35 5-35 37-10 26ZM21 10C0-1 0 31 21 21Z"],
    staff:["五线谱","#b7d8ec","M-40-24H40M-40-12H40M-40 0H40M-40 12H40M-40 24H40"],
    guitar:["吉他","#f3b6d4","M-12 3 15-24 20-32 27-30 28-23 19-18-7 10C20 7 25 36 4 39C-22 50-42 21-20 11Z M-10 17A7 7 0 1 0-9.9 17"],
    bass:["低音贝斯","#a9bedf","M-13 5 18-31 26-28 23-21-8 13C18 4 17 36-2 39C-27 41-39 14-22 10Z M-18 20 11-12M-15 23 14-9"],
    keys:["琴键","#e2dbf7","M-36-22H36V24H-36Z M-24-22V24M-12-22V24M0-22V24M12-22V24M24-22V24M-30-22V2H-20V-22M-6-22V2H4V-22M18-22V2H28V-22"],
    drum:["鼓点","#e6b9b1","M-30-5C-30-25 30-25 30-5V24C30 40-30 40-30 24Z M-30-5C-30 13 30 13 30-5M-35-36 8-10M35-36-8-10"],
    mic:["话筒","#efb9d7","M-10-30A15 15 0 0 1 15-5L-10 20-25 5ZM-8 18-24 40M-21-16 4 9"],
    headphones:["耳机","#a7e8ea","M-30 7V-4A30 30 0 0 1 30-4V7M-30 4H-18V31H-30ZM18 4H30V31H18Z"],
    mask:["面具","#d8c4dd","M-32-24Q0-34 32-24V0Q25 32 0 37Q-25 32-32 0Z M-24-5-10-9-4-2M4-2 10-9 24-5M-13 17Q0 7 13 17"],
    brush:["画笔","#ffd3a7","M-30 31-15 11 15-28 23-23-8 18Z M-15 11Q-39 7-36 34Q-17 39-8 18"],
    frame:["画框","#efd2a9","M-36-30H36V30H-36ZM-27-21H27V21H-27Z"],
    ink:["墨迹","#b0c3d9","M-35 5Q-17-35 0-13T35-20M-28 21Q0-12 29 11M-10 30 18 20"],
    ribbon:["缎带","#f5b6da","M0 0-32-24Q-47 20-16 12L0 0 32-24Q47 20 16 12ZM-9 8-20 37-6 29 2 34 8 8"],
    heart:["心光","#ffb7c8","M0 31C-66-12-25-48 0-18C25-48 66-12 0 31Z"],
    letter:["信笺","#f5dfbb","M-35-23H35V23H-35ZM-35-23 0 4 35-23M-35 23-9 0M35 23 9 0"],
    book:["书页","#dad4ec","M0-23Q-18-36-37-25V29Q-17 19 0 30Q17 19 37 29V-25Q18-36 0-23V30"],
    cup:["茶盏","#f4d5bb","M-27-18H22V12Q-2 34-27 12ZM22-12C51-18 51 17 22 14M-35 32H35M-12-28Q-20-38-8-45M6-28Q-2-38 10-45"],
    window:["窗格","#e7e1b7","M-30-37H30V37H-30ZM0-37V37M-30 0H30"],
    stairs:["阶梯","#d3d5dd","M-40 30H-20V10H0V-10H20V-30H40M-40 40H40"],
    door:["门扉","#d4b8e7","M-28 36V-36H28V36M-20 36V-28L20-20V36Z M10 7H13"],
    bridge:["桥梁","#eec2a3","M-40 22Q0-25 40 22M-40 10Q0-37 40 10M-25 3V14M0-8V2M25 3V14M-35 20V33M35 20V33"],
    road:["归途","#c5d1e4","M-38 40-8-35M38 40 8-35M0-20V-9M0 3V17M0 28V40"],
    torii:["鸟居","#ffb394","M-40-28Q0-18 40-28M-33-14H33M-24-24V37M24-24V37M-30 37H-18M18 37H30"],
    lantern:["灯笼","#ffce92","M-16-30H16M-16 30H16M-17-25Q-37 0-17 25H17Q37 0 17-25ZM0-25V25M-10-25Q-23 0-10 25M10-25Q23 0 10 25"],
    shrine:["神殿","#e4bdad","M-40-8 0-35 40-8ZM-30-8V30H30V-8M-40 31H40M-15-8V29M15-8V29"],
    tower:["塔影","#d8b5d6","M-30 32 0 14 30 32M-26 10 0-8 26 10M-22-12 0-30 22-12M-18 32V-12M18 32V-12M0-30V-40"],
    mountain:["山峰","#c2e1e6","M-42 30-10-35 10 0 23-22 43 30ZM-21-12-10-2-3-18M14-1 23 7 30-7"],
    cloud:["流云","#d8ecf7","M-29 21C-58 12-37-21-21-13C-10-45 29-31 27-8C57-10 48 25 29 21Z"],
    bell:["钟声","#ffdc9d","M-28 18Q-17 6-17-14A17 17 0 0 1 17-14Q17 6 28 18ZM-10 22Q0 43 10 22M0-31V-39"],
    lotus:["莲瓣","#d0dfff","M0 28Q-32-6 0-38Q32-6 0 28Q-43 25-38-15Q-6-9 0 28Q43 25 38-15Q6-9 0 28"],
    fish:["鱼影","#b2e7f1","M-30 0Q0-32 24 0Q0 32-30 0L-42-16V16ZM12-2H14"],
    mouse:["鼠迹","#d6c4c5","M-24 20Q-40-15-22-19A12 12 0 1 1-5-28Q23-37 31-6L40 2 29 10Q18 30-24 20M-24 20Q-45 47-42 17M24-6H26"],
    cat:["猫影","#e5d7ef","M-28 12-25-27-9-13Q0-17 9-13L25-27 28 12Q0 37-28 12ZM-17 3H-10M10 3H17M-4 12 0 15 4 12"],
    rabbit:["兔影","#f4dce5","M-15-6Q-38-55-20-43L-5-12M5-12 20-43Q38-55 15-6M-15-6C-45 27 45 27 15-6ZM-10 8H-8M8 8H10"],
    fox:["狐面","#ffe0c0","M-33-28-9-13 0-21 9-13 33-28 22 18 0 35-22 18ZM-22-3-8 4M8 4 22-3M-5 22H5"],
    skeleton:["骨纹","#e5d8ce","M-25 6V-10C-25-42 25-42 25-10V6L14 14V29H-14V14ZM-16-8A5 5 0 1 0-15.9-8M14-8A5 5 0 1 0 14.1-8M-6 29V19M6 29V19"],
    dna:["双螺旋","#a9edc9","M-20-40C35-10-35 10 20 40M20-40C-35-10 35 10-20 40M-14-32H14M-15-8H15M-15 8H15M-14 32H14"],
    bubble:["泡影","#bce9f0","M0-28A28 28 0 1 0 .1-28M-17-15Q-10-24 0-22M22 15A9 9 0 1 0 22.1 15"],
    train:["列车光壁","#ffdf9e","M-26-31H26V23H-26ZM-18-23H18V-3H-18ZM-18 11H-11M11 11H18M-22 23-32 40M22 23 32 40M-26 32H26"],
    spray:["喷雾","#efc6df","M-17-16H17V34H-17ZM-10-16V-28H20M0-28V-38H16V-28M25-34 40-40M26-28H43M25-22 40-16"],
    coin:["硬币","#ffdc89","M0-28A28 28 0 1 0 .1-28M0-21A21 21 0 1 0 .1-21M-8-10H8V10H-8Z"],
    rail:["电磁轨道","#a6dfff","M-38-16H38M-38 16H38M-25-25V25M-5-25V25M15-25V25M35-25V25"],
    saw:["链锯","#ffc18e","M-35-9-20-18 25-18 38-6 32 9-25 9ZM-25 9-20 19-13 9-5 19 3 9 11 19 19 9M-22-18-15-27-8-18 0-27 8-18"],
    tentacle:["触须","#aab9ec","M-30 34Q-37-28-8-28Q22-28 13-4Q3 12-8-4M0 38Q32 30 30 0Q27-26 14-20M-19 35Q-7 17 5 25"],
    cross:["圣印","#ffe2a7","M-7-34H7V-7H28V7H7V34H-7V7H-28V-7H-7Z"],
    seal:["封印","#dda4d9","M-27-27H27V27H-27ZM0-35 35 0 0 35-35 0ZM-16 0H16M0-16V16"],
    compass:["罗针","#a6e7ff","M0-35 8-8 35 0 8 8 0 35-8 8-35 0-8-8ZM0-25A25 25 0 1 0 .1-25"],
    portal:["界门","#c8b3ff","M-28 30V-5A28 28 0 0 1 28-5V30M-19 30V-5A19 19 0 0 1 19-5V30M-37 31H37"],
    grid:["网格","#99e7e4","M-30-30H30V30H-30ZM-10-30V30M10-30V30M-30-10H30M-30 10H30"],
    dice:["骰面","#efe0aa","M-30-30H30V30H-30ZM-18-18H-14M14-18H18M-2 0H2M-18 18H-14M14 18H18"],
    handshake:["相握","#efc8b7","M-38-4-18-20-5-13 5-20 35-2 17 22 8 17 0 24-8 18-16 19-30 6M-5-13-13 2-3 7 9-4 26 10"],
    swan:["天鹅","#e6f5ff","M-34 15Q-8 34 27 10Q8 15 0-9C-10-43 28-42 18-20L29-17 16-15Q10-22 9-25M-31 15Q-25-9-6 5"],
    pumpkin:["南瓜灯","#ffd28e","M0-25C-45-35-48 34 0 32C48 34 45-35 0-25M0-25 6-38M-25-2-8-10-10 3ZM25-2 8-10 10 3ZM-20 13 0 24 20 13"],
    cherry:["樱花","#ffd0df","M0 2Q-25-25-7-29L0-19 7-29Q25-25 0 2Q29-17 31 3L19 7 29 16Q20 33 0 2Q20 33 0 36L-7 23-14 30Q-31 20 0 2Q-35 15-33-5L-19-7-25-19Q-9-30 0 2Z"],
};

export const MOTIONS = ["form","rise","fall","orbit","scatter","converge","cross","sweep","cast","beam","refract","wave","halt","stamp","split","rain","weave","guard"];
const MOTION_NAMES = {form:"显现",rise:"升起",fall:"落下",orbit:"环绕",scatter:"散开",converge:"汇聚",cross:"交错",sweep:"横扫",cast:"传向目标",beam:"贯穿",refract:"折返",wave:"扩散",halt:"凝止",stamp:"压印",split:"分开",rain:"垂落",weave:"交织",guard:"护持"};

export function parseStoryboard(text) {
    return text.split(" ").filter(Boolean).map(token => {
        const [symbol,motion,layout="center"] = token.split(":");
        if(!SCENE_SYMBOLS[symbol] || !MOTIONS.includes(motion) || !["center","left","right","high","low","wide","tight"].includes(layout)) throw new Error(`Invalid storyboard cue: ${token}`);
        return {symbol,motion,layout};
    });
}
export function storyboardScene(title, text, phase) {
    const cues=parseStoryboard(text);
    const beats=cues.map(c=>`${SCENE_SYMBOLS[c.symbol][0]}${MOTION_NAMES[c.motion]}`);
    // 节拍总长必须落在 1900ms 验收上限内：卡图电影 + 程式舞台 1750ms，标题 120ms 起、1870ms 收。
    const span=1750;
    return {title,beats,cues,draw:f=>{
        f.artCinematic?.(cues,f.to,0,span);
        f.storyboardStage?.(cues,f.to,0,span);
        drawStoryboard(cues,phase,f);
        f.title?.(title,beats.slice(0,2).join(" · "),SCENE_SYMBOLS[cues[0].symbol][1],120,span);
    }};
}

function drawStoryboard(cues,phase,f) {
    const offsets={center:[0,0],left:[-65,0],right:[65,0],high:[0,-65],low:[0,65],wide:[0,0],tight:[0,0]};
    // N/R 破坏场面保持单一主动作与约 500-750ms 的总时长；SR 以上沿用标准节拍。
    const compact=phase==="destroy"&&cues.length<=3;
    const stagger=compact?110:145, beat=compact?500:560;
    const impactAt=Math.max(620,...cues.map((cue,i)=>["cast","beam","refract"].includes(cue.motion)?i*145+560:0));
    cues.forEach((cue,index)=>{
        const [label,color,d]=SCENE_SYMBOLS[cue.symbol];
        const [ox,oy]=offsets[cue.layout];
        const targetPhase=phase==="attack" && ["cross","stamp","scatter","wave","fall","guard"].includes(cue.motion);
        const p=f.offset(targetPhase?f.to:f.from,ox,oy);
        const delay=targetPhase?Math.max(index*stagger,impactAt-180):index*stagger, duration=beat;
        const radius=cue.layout==="wide"?110:cue.layout==="tight"?38:72;
        const glyph=(point,start,end,wait=delay,span=duration)=>f.path(d,point,color,{opacity:0,...start},{opacity:1,...end},wait,span);
        switch(cue.motion){
            case "form": glyph(p,{scale:.1,rotate:-25},{scale:1.6,rotate:0});f.ring(p,color,radius,delay,beat);break;
            case "rise": glyph(p,{y:90,scale:.5},{y:-25,scale:1.6});f.line(f.offset(p,0,85),f.offset(p,0,-50),color,3,delay+80,440);break;
            case "fall": glyph(p,{y:-140,scale:.7},{y:15,scale:1.8});f.burst(p,color,5,55,delay+270,300);break;
            case "orbit": for(let i=0;i<3;i++){const a=i*Math.PI*2/3;glyph(f.offset(p,Math.cos(a)*radius,Math.sin(a)*radius),{rotate:-55,scale:.2},{rotate:70,scale:1.05},delay+i*45);}break;
            case "scatter": for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;glyph(p,{scale:.7},{x:Math.cos(a)*radius,y:Math.sin(a)*radius,rotate:i*55,scale:.45},delay+i*25);}break;
            case "converge": for(let i=0;i<3;i++){const a=i*Math.PI*2/3;glyph(p,{x:Math.cos(a)*radius,y:Math.sin(a)*radius,scale:.6},{scale:1.1},delay+i*50);}break;
            case "cross": glyph(p,{x:-90,y:-70,rotate:-45,scale:.7},{x:45,y:40,rotate:30,scale:1.6});glyph(p,{x:90,y:-70,rotate:45,scale:.7},{x:-45,y:40,rotate:-30,scale:1.6},delay+90);break;
            case "sweep": glyph(p,{x:-130,rotate:-65,scale:.5},{x:100,rotate:55,scale:1.8});f.line(f.offset(p,-95,20),f.offset(p,95,-20),color,5,delay+160,350);break;
            case "cast": glyph(p,{scale:.2},{scale:1.3},delay,340);f.projectile(p,f.to,color,15,delay+160,420,ox||45);break;
            case "beam": glyph(p,{scale:.1},{scale:1.3},delay,300);f.line(p,f.to,color,20,delay+160,410);f.line(p,f.to,"#f4fcff",5,delay+190,380);break;
            case "refract": {const mid=f.offset({x:(f.from.x+f.to.x)/2,y:(f.from.y+f.to.y)/2},ox||70,oy||-50);glyph(mid,{rotate:-30,scale:.1},{rotate:20,scale:1.4});f.line(f.from,mid,color,5,delay,300);f.line(mid,f.to,color,8,delay+230,330);break;}
            case "wave": glyph(p,{scale:.4},{scale:2.2});f.ring(p,color,radius,delay+40,480);f.ring(p,color,radius*.7,delay+140,420);break;
            case "halt": glyph(p,{rotate:-100,scale:1.7},{rotate:0,scale:1.7});f.sigil(p,color,radius,12,delay+100,460);break;
            case "stamp": glyph(p,{scale:3,rotate:25},{scale:1.35,rotate:0});f.burst(p,color,7,80,delay+230,280);break;
            case "split": glyph(p,{scale:.5},{x:-radius,rotate:-30,scale:1.4});glyph(p,{scale:.5},{x:radius,rotate:30,scale:1.4},delay+70);break;
            case "rain": for(let i=0;i<4;i++)glyph(f.offset(p,(i-1.5)*36,0),{y:-110,rotate:15,scale:.4},{y:90,rotate:-15,scale:.75},delay+i*55);break;
            case "weave": glyph(p,{x:-radius,rotate:-40,scale:.6},{x:radius/2,rotate:35,scale:1.3});glyph(p,{x:radius,rotate:40,scale:.6},{x:-radius/2,rotate:-35,scale:1.3},delay+70);f.projectile(f.offset(p,-radius,0),f.offset(p,radius,0),color,5,delay,520,80);break;
            case "guard": glyph(p,{y:40,scale:.2},{y:0,scale:2});f.sigil(p,color,radius,6,delay+80,450);break;
        }
    });
}
