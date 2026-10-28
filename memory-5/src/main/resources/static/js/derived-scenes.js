// Original stages: absolute audio time is the only animation clock.
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;
const random = n => { const v = Math.sin(n * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };

export function createDerivedScenes({ ctx, image, glyphs, textLayout, drawText }) {
    const texture = document.createElement('canvas');
    const ink = texture.getContext('2d');
    let textureKey = '';
    function gradient(x, y, radius, color) {
        const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
        light.addColorStop(0, color); light.addColorStop(1, 'transparent');
        ctx.fillStyle = light; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    function rule(x1, y1, x2, y2, color, thickness = 1) {
        ctx.strokeStyle = color; ctx.lineWidth = thickness;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function print(context, layout, x, y, color) {
        context.font = `600 ${layout.size}px system-ui, sans-serif`;
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = color;
        for (const g of layout.glyphs) context.fillText(g.char, x + g.x, y + g.y);
    }
    function makeTexture(key, w, h, paint) {
        if (textureKey === key) return;
        textureKey = key; texture.width = Math.ceil(w); texture.height = Math.ceil(h);
        ink.setTransform(1, 0, 0, 1, 0, 0); ink.clearRect(0, 0, texture.width, texture.height); paint(ink);
    }
    function label(text, x, y, color, size = 11) {
        ctx.font = `500 ${size}px system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = color; ctx.fillText(text, x, y);
    }
    function metrics(feature, layout, x, y, phase) {
        const halfWidth = Math.max(0, ...layout.glyphs.map(g => Math.abs(g.x) + layout.size * .7));
        return { feature, phase, glyphs: layout.glyphs.length,
            bounds: { left: x - halfWidth, right: x + halfWidth, top: y - layout.height / 2, bottom: y + layout.height / 2 } };
    }
    function coverPanel(x, y, w, h, alpha) {
        if (!image.complete || !image.naturalWidth) return;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.globalAlpha = alpha;
        const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
        ctx.drawImage(image, x + (w - image.naturalWidth * scale) / 2, y + (h - image.naturalHeight * scale) / 2,
            image.naturalWidth * scale, image.naturalHeight * scale); ctx.restore();
    }
    // Map a paper strip to a projected quadrilateral as two affine triangles.
    function paperStrip(sx, sw, h, p) {
        const triangle = (source, dest) => {
            const [a, b, c] = source, [u, v, z] = dest;
            const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
            const ax = ((v[0] - u[0]) * (c[1] - a[1]) - (z[0] - u[0]) * (b[1] - a[1])) / det;
            const bx = ((z[0] - u[0]) * (b[0] - a[0]) - (v[0] - u[0]) * (c[0] - a[0])) / det;
            const ay = ((v[1] - u[1]) * (c[1] - a[1]) - (z[1] - u[1]) * (b[1] - a[1])) / det;
            const by = ((z[1] - u[1]) * (b[0] - a[0]) - (v[1] - u[1]) * (c[0] - a[0])) / det;
            ctx.save(); ctx.beginPath(); ctx.moveTo(...u); ctx.lineTo(...v); ctx.lineTo(...z); ctx.closePath(); ctx.clip();
            ctx.transform(ax, ay, bx, by, u[0] - ax * a[0] - bx * a[1], u[1] - ay * a[0] - by * a[1]);
            ctx.drawImage(texture, 0, 0); ctx.restore();
        };
        triangle([[sx, 0], [sx + sw, 0], [sx + sw, h]], [p[0], p[1], p[2]]);
        triangle([[sx, 0], [sx + sw, h], [sx, h]], [p[0], p[2], p[3]]);
    }
    return function render(s) {
        const { mode, width: w, height: h, top, bottom, lines, index, text, duration, t, config, accent, secondary, reducedMotion } = s;
        const area = Math.max(1, bottom - top), cy = top + area / 2, mobile = w < 600;
        const motion = reducedMotion ? 0 : config.motion, clock = t * motion;
        const age = Math.max(0, t - (lines[index]?.time || 0));
        const transition = Math.min(1.15, duration * .28);
        const enter = motion === 0 ? 1 : ease(age / transition);
        const font = Math.min(mobile ? 30 : 58, w * .04 + 12) * config.size;
        ctx.fillStyle = '#090e1b'; ctx.fillRect(0, 0, w, h);

        if (mode === 'fold') {
            gradient(w * .48, cy, w * .72, accent + '30');
            for (let i = 0; i < config.density; i++) {
                const x = w * random(i + 51), y = top + area * random(i + 71);
                ctx.save(); ctx.translate(x, y); ctx.rotate(clock * .05 + i);
                ctx.strokeStyle = '#e7cda81a'; ctx.strokeRect(-10, -15, 20, 30); ctx.restore();
            }
            const pw = w * .8, ph = area * .72;
            const layout = textLayout(text, pw * .85, ph * .58, font);
            makeTexture(['paper', text, pw, ph, layout.size, accent, index].join(':'), pw, ph, c => {
                c.fillStyle = '#ede5d4'; c.fillRect(0, 0, pw, ph);
                c.strokeStyle = '#705b4033'; c.strokeRect(12, 12, pw - 24, ph - 24);
                c.font = '11px system-ui'; c.fillStyle = '#8d6d48'; c.textAlign = 'left';
                c.fillText(`SEKAI / VERSE ${String(Math.max(0, index) + 1).padStart(2, '0')}`, 25, 31);
                print(c, layout, pw / 2, ph / 2, '#302a30');
                c.fillStyle = '#8d6d48'; c.fillRect(pw / 2 - 18, ph - 24, 36, 2);
            });
            const zoom = 1 + Math.sin(clock * .25) * .012;
            ctx.save(); ctx.translate(w / 2, cy); ctx.scale(zoom, zoom);
            for (let leaf = 3; leaf > 0; leaf--) {
                ctx.save(); ctx.rotate(-.012 * leaf); ctx.shadowColor = '#0009'; ctx.shadowBlur = 18;
                ctx.fillStyle = ['#b6a690', '#897a6b', '#5d5149'][leaf - 1];
                ctx.fillRect(-pw / 2 + leaf * 4, -ph / 2 + leaf * 6, pw, ph); ctx.restore();
            }
            const fold = (1 - enter) * 1.15 + Math.sin(clock * .6) * .035;
            const focal = w * 1.1;
            const project = (x, y, z) => {
                const tilt = .1 * motion, yy = y * Math.cos(tilt) - z * Math.sin(tilt), zz = z * Math.cos(tilt) + y * Math.sin(tilt);
                const scale = focal / (focal + zz); return [x * scale, yy * scale];
            };
            for (let panel = 0; panel < 4; panel++) {
                const x0 = (panel - 2) * pw / 4, x1 = x0 + pw / 4;
                const z0 = panel % 2 ? Math.sin(fold) * pw / 4 : 0;
                const z1 = panel % 2 ? 0 : Math.sin(fold) * pw / 4;
                const a = project(x0 * Math.cos(fold), -ph / 2, z0), b = project(x1 * Math.cos(fold), -ph / 2, z1);
                const c = project(x1 * Math.cos(fold), ph / 2, z1), d = project(x0 * Math.cos(fold), ph / 2, z0);
                paperStrip(panel * pw / 4, pw / 4, texture.height, [a, b, c, d]);
                ctx.fillStyle = `rgba(32,24,22,${Math.abs(Math.sin(fold)) * (panel % 2 ? .24 : .06)})`;
                ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath(); ctx.fill();
                rule(...b, ...c, '#62452b22');
            }
            ctx.restore();
            return metrics('perspective-paper', layout, w / 2, cy, enter);
        }

        if (mode === 'sea') {
            const horizon = top + area * .55, textY = top + area * .27;
            const sky = ctx.createLinearGradient(0, 0, 0, horizon);
            sky.addColorStop(0, '#080e28'); sky.addColorStop(.65, '#283859'); sky.addColorStop(1, '#89758e');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
            gradient(w * .74, top + area * .15, w * .4, secondary + '32');
            const moonR = Math.min(w * .03, area * .065), moonX = w * .88, moonY = top - moonR * .3;
            ctx.fillStyle = '#eee6ed'; ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < config.density * 2; i++) {
                ctx.fillStyle = '#fff8'; ctx.fillRect(w * random(i + 22), random(i + 71) * Math.max(1, top - 12), 1, 1);
            }
            const water = ctx.createLinearGradient(0, horizon, 0, h);
            water.addColorStop(0, '#38485b'); water.addColorStop(.3, '#152d42'); water.addColorStop(1, '#060e1c');
            ctx.fillStyle = water; ctx.fillRect(0, horizon, w, h - horizon);
            const layout = textLayout(text, w * .78, area * .32, font);
            const tw = w * .86, th = Math.ceil(layout.height + 12);
            makeTexture(['water', text, tw, th, layout.size].join(':'), tw, th, c => print(c, layout, tw / 2, th / 2, '#eee8ff'));
            ctx.save(); ctx.shadowColor = '#b3c5ff'; ctx.shadowBlur = 15;
            drawText(layout, w / 2, textY, '#f5f2ff'); ctx.restore();
            const reflectedY = horizon + Math.max(12, (horizon - textY - th / 2) * .28);
            const rh = Math.min(th, area * .38);
            for (let y = 0; y < rh; y += 3) {
                const f = y / rh, shift = Math.sin(y * .12 + clock * 2.4) * (2 + f * 10) * motion;
                ctx.globalAlpha = .4 * (1 - f) ** 1.3;
                ctx.drawImage(texture, 0, Math.max(0, th - (y + 3) / rh * th), texture.width, Math.min(3 / rh * th, th),
                    (w - tw) / 2 + shift, reflectedY + y, tw, 3);
            }
            ctx.globalAlpha = 1;
            for (let i = 0; i < 70; i++) {
                const d = (i + 1) / 70, y = horizon + d * d * (h - horizon);
                const x = moonX + Math.sin(i * 2.3 + clock) * w * .03 * d;
                const span = w * (.004 + d * .08) * (.3 + random(i + 123));
                rule(x - span, y, x + span, y, secondary + (i % 3 ? '32' : '65'), 1 + d);
                rule(0, y, w, y + Math.sin(i + clock * 1.4) * 2 * motion, '#adcce312');
            }
            const pulse = motion === 0 ? .5 : (age % 2.6) / 2.6;
            for (let i = 0; i < 4; i++) {
                const p = (pulse + i / 4) % 1;
                ctx.strokeStyle = accent + '66'; ctx.globalAlpha = (1 - p) * .6;
                ctx.beginPath(); ctx.ellipse(w / 2, horizon + area * .13 + p * area * .13,
                    w * (.025 + p * .42), 2 + p * area * .055, 0, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = 1; rule(0, horizon, w, horizon, '#f0e5ff55');
            return metrics('refracted-water', layout, w / 2, textY, enter);
        }

        if (mode === 'dialogue') {
            const side = Math.max(0, index) % 2, sign = side ? 1 : -1;
            const focus = w * (side ? .72 : .28), cut = w * .5 + Math.sin(clock * .3) * w * .012;
            for (let actor = 0; actor < 2; actor++) {
                const x = actor * w / 2;
                ctx.save(); ctx.beginPath();
                if(actor===0){ctx.moveTo(0,0);ctx.lineTo(cut-25,0);ctx.lineTo(cut+25,h);ctx.lineTo(0,h);}
                else {ctx.moveTo(cut-25,0);ctx.lineTo(w,0);ctx.lineTo(w,h);ctx.lineTo(cut+25,h);}
                ctx.closePath();ctx.clip();
                ctx.fillStyle = actor ? '#173445' : '#432536'; ctx.fillRect(x, 0, w / 2, h);
                ctx.fillRect(actor ? cut-25 : 0,0,actor?w-cut+25:cut+25,h);
                const zoom=1+(actor===side?.035*enter:0);
                ctx.save();ctx.translate(x+w/4,h/2);ctx.scale(zoom,zoom);ctx.translate(-x-w/4,-h/2);
                coverPanel(x-w*.025, 0, w * .55, h, actor === side ? .38 : .1);ctx.restore();
                gradient(x + w / 4, cy, w * .48, (actor ? secondary : accent) + (actor === side ? '38' : '0c'));
                const r = Math.min(w * .09, area * .21);
                ctx.save(); ctx.globalAlpha = actor === side ? .22 : .07;
                ctx.fillStyle = actor ? '#a1ddef' : '#f0b7cb';
                ctx.beginPath(); ctx.arc(x + w / 4, top + area * .24, r * .5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(x + w / 4, top + area * .65, r * 1.15, r * 1.75, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                for(let i=0;i<config.density;i++){
                    const px=x+random(i+17)*w/2,py=top+random(i+35)*area;
                    rule(px,py,px+1,py+10+(i%4)*8,(actor?'#92d9ed':'#ecc0cc')+'16');
                }
                ctx.restore();
            }
            rule(cut - 20, top, cut + 20, bottom, '#f6d6dd33');
            const mask = ctx.createLinearGradient(0, top, 0, bottom);
            mask.addColorStop(0, '#080b1800'); mask.addColorStop(.55, '#080b18bb'); mask.addColorStop(1, '#080b18ee');
            ctx.fillStyle = mask; ctx.fillRect(0, top, w, area);
            const layout = textLayout(text, w * .76, area * .4, font);
            const x = w / 2 + sign * w * .025 * enter, y = top + area * .63;
            if (index > 0) {
                const previous = textLayout(lines[index - 1].text, w * .65, area * .14, mobile ? 13 : 20);
                drawText(previous, w / 2 - sign * w * .08, top + area * .16, '#d7d1df', .42);
            }
            const speaker = side ? secondary : accent;
            label(side ? '02 / REPLY' : '01 / VOICE', w * .12, y - layout.height / 2 - 25, speaker, mobile ? 10 : 12);
            rule(w * .12, y - layout.height / 2 - 10, w * .12 + w * .12 * enter, y - layout.height / 2 - 10, speaker, 2);
            ctx.save(); ctx.shadowColor = '#000'; ctx.shadowBlur = 16;
            drawText(layout, x + sign * (1 - enter) * 18, y, '#fff6f1'); ctx.restore();
            const focusWidth = w * .16;
            rule(focus - focusWidth / 2, bottom - 4, focus + focusWidth / 2, bottom - 4, speaker, 3);
            label(`${String(Math.max(0, index) + 1).padStart(2, '0')} / DIALOGUE`, w * .12, bottom - 10, '#bdafc1', 10);
            return metrics('cinematic-dialogue', layout, x, y, enter);
        }

        // Character storm: a wide field, curved convergence, a readable hold, and depth dispersal.
        gradient(w * .5, cy, w * .68, '#32234f88');
        const layout = textLayout(text, w * .74, area * .55, font);
        const field = glyphs(text || 'Sekai');
        for(let stream=0;stream<3;stream++){
            ctx.beginPath();
            for(let i=0;i<=90;i++){
                const a=i/90*Math.PI*2+clock*.23+stream*2.1;
                const x=w/2+Math.cos(a)*w*(.34+stream*.035);
                const y=cy+Math.sin(a)*area*.38+Math.cos(a*2+stream)*area*.05;
                if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
            }
            ctx.strokeStyle=(stream%2?accent:secondary)+'22';ctx.lineWidth=1;ctx.stroke();
            for(let p=0;p<12;p++){
                const a=p/12*Math.PI*2+clock*(.35+stream*.1)+stream*2.1;
                const x=w/2+Math.cos(a)*w*(.34+stream*.035),y=cy+Math.sin(a)*area*.38+Math.cos(a*2+stream)*area*.05;
                ctx.fillStyle=accent+'aa';ctx.beginPath();ctx.arc(x,y,1+random(p+stream*12)*1.2,0,Math.PI*2);ctx.fill();
            }
        }
        for (let i = 0; i < config.density * 3; i++) {
            const phase = clock * .16 + i * 2.399, depth = .25 + random(i + 41) * .75;
            const x = w / 2 + Math.cos(phase) * w * (.22 + depth * .32);
            const y = cy + Math.sin(phase * .7) * area * (.16 + depth * .3);
            ctx.font = `${9 + depth * 15}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = secondary;
            ctx.globalAlpha = .08 + depth * .13; ctx.fillText(field[i % field.length], x, y);
        }
        ctx.globalAlpha = 1;
        const startFor = (g, i, seed) => {
            const angle = i * 2.399 + seed * .73;
            return [w / 2 + Math.cos(angle) * w * (.3 + random(i + seed * 11) * .12),
                cy + Math.sin(angle) * area * (.25 + random(i + seed * 5) * .14)];
        };
        if (index > 0 && age < Math.min(.85, duration * .3) && motion > 0) {
            const gone = clamp(age / Math.min(.85, duration * .3));
            const old = textLayout(lines[index - 1].text, w * .74, area * .55, font);
            ctx.font = `600 ${old.size}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            old.glyphs.forEach((g, i) => {
                const [sx, sy] = startFor(g, i, index - 1);
                ctx.globalAlpha = (1 - gone) * .48; ctx.fillStyle = secondary;
                ctx.save();ctx.translate(w / 2 + g.x + (sx - w / 2 - g.x) * gone,
                    cy + g.y + (sy - cy - g.y) * gone);ctx.scale(1-gone*.72,1-gone*.72);
                ctx.fillText(g.char,0,0);ctx.restore();
            });
        }
        ctx.font = `600 ${layout.size}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        layout.glyphs.forEach((g, i) => {
            const stagger = layout.glyphs.length > 1 ? i / (layout.glyphs.length - 1) * .18 : 0;
            const p = motion === 0 ? 1 : ease((age / transition - stagger) / (1 - stagger));
            const [sx, sy] = startFor(g, i, Math.max(0, index));
            const tx = w / 2 + g.x, ty = cy + g.y, curl = Math.sin(p * Math.PI) * motion;
            const x = Math.max(layout.size*.8,Math.min(w-layout.size*.8,sx + (tx - sx) * p + Math.sin(i * 1.7) * w * .08 * curl));
            const y = Math.max(top+layout.size*.8,Math.min(bottom-layout.size*.8,sy + (ty - sy) * p + Math.cos(i * 1.3) * area * .1 * curl));
            ctx.globalAlpha = .4 + .6 * p;
            if (p < .98) rule(x, y, x + (tx - x) * .15, y + (ty - y) * .15, accent + '55');
            ctx.fillStyle = '#fff3eb';ctx.save();ctx.translate(x,y);ctx.scale(.55+.45*p,.55+.45*p);
            ctx.fillText(g.char,0,0);ctx.restore();
        });
        ctx.globalAlpha = 1;
        const halo = motion === 0 ? .5 : .5 + Math.sin(clock * 1.8) * .5;
        rule(w * .38, cy + layout.height / 2 + 20, w * .62, cy + layout.height / 2 + 20, accent + (halo > .5 ? '55' : '33'));
        return metrics('curved-character-storm', layout, w / 2, cy, enter);
    };
}
