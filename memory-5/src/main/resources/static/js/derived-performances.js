import { createStarSky } from './star-trails.js?v=20261015-motion2';
import { createDerivedScenes } from './derived-scenes.js?v=20261027-area';
// Five original Sekai performances. Every position is derived from audio time.
export async function mount({ host, settingsHost, rows, audio, cover, title, artist, mode, reducedMotion }) {
    const lines = rows.map(row => ({ time: Number(row.dataset.time), text: row.querySelector('b')?.textContent.trim() || '' }));
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const glyphs = text => Array.from(segmenter.segment(text), part => part.segment);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block'; canvas.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('p');
    caption.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
    caption.setAttribute('role', 'status');
    host.replaceChildren(canvas, caption);
    const ctx = canvas.getContext('2d');
    const image = new Image(); image.src = cover || '';
    const key = `sekai.derived.${mode}.v1`;
    const defaults = { size: 1, motion: .7, density: 28, color: 'peach', sky: 'auto', trail: .8 };
    let config = { ...defaults };
    try { config = { ...config, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch {}
    let width = 0, height = 0, time = 0, active = -2, destroyed = false;
    const clamp = n => Math.min(1, Math.max(0, n));
    const ease = n => 1 - (1 - clamp(n)) ** 3;
    const palettes = { peach: ['#ffd2ac', '#ecb1cc'], ice: ['#aee9f8', '#bdbaff'], mint: ['#bdebd4', '#f6dfa9'] };
    const names = { stars: '星轨演出', fold: '折页演出', sea: '镜海演出', dialogue: '对白演出', gather: '聚散演出' };
    const panel = document.createElement('div'); panel.style.cssText = 'padding:22px;display:grid;gap:20px';
    const heading = document.createElement('p'); heading.textContent = names[mode]; panel.append(heading);
    const starSky = mode === 'stars' ? createStarSky() : null;
    const scenes = mode !== 'stars' ? createDerivedScenes({ ctx, image, glyphs, textLayout, drawText }) : null;
    const densityNames = { stars: '星点密度', fold: '纸屑层次', sea: '天空星点', dialogue: '画面氛围', gather: '字符风暴密度' };
    const controls = [['size', '歌词字号', .7, 1.3, .05], ['motion', mode === 'stars' ? '天空旋转速度' : '动态强度', 0, 1, .05], ['density', densityNames[mode], 8, 48, 1]];
    if (mode === 'stars') controls.push(['trail', '曝光拖尾长度', .15, 1.5, .05]);
    const save = () => { try { localStorage.setItem(key, JSON.stringify(config)); } catch {} apply(time); };
    for (const [name, label, min, max, step] of controls) {
        const row = document.createElement('label'); row.style.cssText = 'display:grid;gap:8px';
        const text = document.createElement('span'); text.textContent = label;
        const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = config[name];
        input.addEventListener('input', () => { config[name] = Number(input.value); save(); });
        row.append(text, input); panel.append(row);
    }
    const label = document.createElement('label'); label.textContent = mode === 'stars' ? '字幕色温 ' : '配色 ';
    const select = document.createElement('select'); select.style.cssText = 'padding:8px;background:#25212e;color:white;border-radius:8px';
    for (const [value, text] of [['peach','暖桃'], ['ice','冰蓝'], ['mint','薄荷']]) select.add(new Option(text, value));
    select.value = config.color; select.onchange = () => { config.color = select.value; save(); }; label.append(select); panel.append(label);
    let skySelect;
    if (mode === 'stars') {
        const skyLabel=document.createElement('label');skyLabel.textContent='天空时段 ';
        skySelect=document.createElement('select');skySelect.style.cssText=select.style.cssText;
        for(const [value,text] of [['auto','暮色转入深夜'],['night','恒定深夜'],['dusk','恒定暮色']])skySelect.add(new Option(text,value));
        skySelect.value=config.sky;skySelect.onchange=()=>{config.sky=skySelect.value;save();};skyLabel.append(skySelect);panel.append(skyLabel);
    }
    const reset = document.createElement('button'); reset.textContent = '恢复默认'; reset.style.cssText = 'padding:12px;color:white;background:#ffffff12;border:1px solid #ffffff30;border-radius:10px';
    reset.onclick = () => { config = { ...defaults }; panel.querySelectorAll('input').forEach((input, i) => input.value = config[controls[i][0]]); select.value = config.color; if(skySelect)skySelect.value=config.sky; save(); };
    panel.append(reset); settingsHost.replaceChildren(panel);

    function textLayout(text, maxWidth, maxHeight, requested) {
        const parts = glyphs(text);
        let size = requested, laidOut;
        do {
            ctx.font = `600 ${size}px system-ui, sans-serif`;
            const rows = [[]]; let lineWidth = 0;
            for (const char of parts) {
                const w = ctx.measureText(char).width + size * .045;
                if (lineWidth + w > maxWidth && rows.at(-1).length) { rows.push([]); lineWidth = 0; }
                rows.at(-1).push({ char, width: w }); lineWidth += w;
            }
            const lineHeight = size * 1.65;
            laidOut = { size, lineHeight, height: rows.length * lineHeight, glyphs: [] };
            rows.forEach((row, r) => {
                let x = -row.reduce((sum, item) => sum + item.width, 0) / 2;
                row.forEach(item => { laidOut.glyphs.push({ char: item.char, x: x + item.width / 2, y: (r - (rows.length - 1) / 2) * lineHeight }); x += item.width; });
            });
            if (laidOut.height <= maxHeight || size <= 6) break;
            size *= .9;
        } while (true);
        return laidOut;
    }
    function drawText(layout, x, y, color, alpha = 1) {
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; ctx.fillStyle = color;
        ctx.font = `600 ${layout.size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        layout.glyphs.forEach(g => ctx.fillText(g.char, g.x, g.y)); ctx.restore();
    }
    function apply(t) {
        if (destroyed || !ctx) return;
        time = t;
        width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 1;
        const index = lines.findLastIndex(line => line.time <= t);
        if (active !== index) { active = index; caption.textContent = lines[index]?.text || '等待歌词'; }
        const [accent, secondary] = palettes[config.color] || palettes.peach;
        const reserved=!!document.documentElement.style.getPropertyValue('--performance-height')&&window.matchMedia('(max-width:900px), (max-height:600px) and (max-width:1100px)').matches;
        const mobile = width < 600, top = reserved?Math.max(24,height*.08):(mobile ? 135 : 120), bottom = reserved?height*.92:Math.max(top + 80, height - (mobile ? 220 : 150));
        const areaHeight = bottom - top;
        const clock = reducedMotion ? 0 : t;
        const text = lines[index]?.text || '等待音乐与歌词';
        const duration = Math.max(.067, (lines[index + 1]?.time ?? (Number.isFinite(audio?.duration) ? audio.duration : t + 6)) - (lines[index]?.time || 0));
        const entry = reducedMotion || config.motion === 0 ? 1 : ease((t - (lines[index]?.time || 0)) / Math.min(.32, duration * .2));
        if (scenes) {
            host.__derivedScene = scenes({ mode, width, height, top, bottom, lines, index, text, duration, t, config, accent, secondary, reducedMotion });
        }
        if (mode === 'stars') {
            starSky(ctx,width,height,clock,config,reducedMotion);
            const lyricY=top+areaHeight*.64;
            const size=Math.min(mobile?28:48,width*.033+12)*config.size;
            const starLayout=textLayout(text,width*.78,areaHeight*.48,size);
            // A soft local scrim and subtle shadow keep the sky visible between letters.
            const shade=ctx.createRadialGradient(width/2,lyricY,0,width/2,lyricY,width*.44);
            shade.addColorStop(0,'rgba(2,7,17,.36)');shade.addColorStop(1,'rgba(2,7,17,0)');
            ctx.fillStyle=shade;ctx.fillRect(0,top,width,areaHeight);
            ctx.save();ctx.shadowColor='rgba(0,0,0,.85)';ctx.shadowBlur=14;
            const subtitleColor={peach:'#fff3e6',ice:'#e8f3ff',mint:'#eafff4'}[config.color]||'#f1f3f9';
            drawText(starLayout,width/2,lyricY+(1-entry)*8,subtitleColor,.8+.2*entry);ctx.restore();
            if(index>0){
                const previous=textLayout(lines[index-1].text,width*.72,areaHeight*.12,mobile?12:16);
                drawText(previous,width/2,Math.max(top+previous.height/2,lyricY-starLayout.height/2-34),secondary,.32);
            }
        }
        ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = accent; ctx.globalAlpha = .7;
        ctx.fillText(names[mode], 24, top - 18); ctx.globalAlpha = 1;
        host.dataset.activeLine = String(index); host.dataset.activeText = lines[index]?.text || '';
    }
    image.onload = () => apply(time);
    await document.fonts.ready;
    apply(audio?.currentTime || 0);
    return { apply, destroy() { destroyed = true; image.onload = null; delete host.__derivedScene; host.replaceChildren(); settingsHost.replaceChildren(); },
        program: { mode, lines: lines.length, engine: 'Sekai audio-time canvas', lossless: lines.every(line => glyphs(line.text).join('') === line.text) } };
}
