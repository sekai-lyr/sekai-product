// attack-fx.js
// 攻击过程运行时：按 attack-fx-profiles 的档案，在攻击者与目标之间播放演出。
// 约定：调用方提供 arena（舞台）、fx（特效层）、attackerEl/targetEl（两张卡 DOM）。
import { getAttackProfile } from "./attack-fx-profiles.js";
import { EXTRA_FAMILIES } from "./attack-fx-shapes2.js";
import { EXTRA_FAMILIES_3 } from "./attack-fx-shapes3.js";
import { EXTRA_FAMILIES_4 } from "./attack-fx-shapes4.js";

const NS = "http://www.w3.org/2000/svg";
let seedCounter = 1;

// 自包含样式与滤镜：模块注入，不改游戏自身 CSS 文件
const FX_CSS = `
.attack-fx-layer { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:280; }
.attack-fx-layer .svgline { position:absolute; inset:0; overflow:visible; pointer-events:none; z-index:8; }
.attack-fx-layer .p { border-radius:50%; pointer-events:none; z-index:7; }
.attack-fx-layer .flashcard { border-radius:10px; background:#fff; pointer-events:none; z-index:9; }
.attack-fx-layer .ring { border-radius:50%; border:2px solid; pointer-events:none; z-index:7; }
.attack-fx-layer .sring { border-radius:50%; border:2px solid; pointer-events:none; z-index:7; }
.attack-fx-layer .shard { pointer-events:none; z-index:7; }
.attack-fx-layer .orb { pointer-events:none; z-index:7; }
.attack-fx-layer .beam { pointer-events:none; z-index:7; transform-origin:0 50%; }
.attack-fx-layer .trail { border-radius:999px; pointer-events:none; z-index:6; filter:blur(2px); }
.attack-fx-layer .after { pointer-events:none; z-index:4; }
.attack-fx-layer .reticle { pointer-events:none; z-index:8; }
.attack-fx-layer .reticle i { position:absolute; width:16px; height:16px; border:3px solid #ff5d6b; box-shadow:0 0 12px rgba(255,90,110,.85); }
.attack-fx-layer .reticle i:nth-child(1) { left:-5px; top:-5px; border-right:none; border-bottom:none; }
.attack-fx-layer .reticle i:nth-child(2) { right:-5px; top:-5px; border-left:none; border-bottom:none; }
.attack-fx-layer .reticle i:nth-child(3) { left:-5px; bottom:-5px; border-right:none; border-top:none; }
.attack-fx-layer .reticle i:nth-child(4) { right:-5px; bottom:-5px; border-left:none; border-top:none; }
.attack-fx-layer .label {
  z-index:12; white-space:nowrap; pointer-events:none; font-size:14px; font-weight:800; letter-spacing:.12em; color:#fff;
  background:linear-gradient(180deg, rgba(60,40,20,.95), rgba(30,18,8,.95));
  border:1px solid rgba(255,200,110,.75); border-radius:8px; padding:3px 11px;
  box-shadow:0 0 18px rgba(255,180,80,.4);
}
.attack-fx-layer .label.violet { background:linear-gradient(180deg, rgba(44,26,70,.95), rgba(22,12,38,.95)); border-color:rgba(200,140,255,.8); }
.attack-fx-layer .label.cyan { background:linear-gradient(180deg, rgba(20,44,60,.95), rgba(8,20,30,.95)); border-color:rgba(140,220,255,.8); }
.attack-fx-layer .dmg {
  z-index:14; font-size:36px; font-weight:900; pointer-events:none; color:#ff5d5d;
  text-shadow:0 0 14px rgba(255,60,60,.8), 0 3px 0 rgba(0,0,0,.8), 0 0 40px rgba(255,90,60,.5);
}
.attack-fx-layer .dmg.fire { color:#ff9a4c; text-shadow:0 0 14px rgba(255,140,60,.9), 0 3px 0 rgba(0,0,0,.8); }
.attack-fx-layer .dmg.elec { color:#ffe45e; text-shadow:0 0 14px rgba(255,230,80,.9), 0 3px 0 rgba(0,0,0,.8); }
.attack-fx-layer .dmg.ice { color:#aee6ff; text-shadow:0 0 14px rgba(150,220,255,.9), 0 3px 0 rgba(0,0,0,.8); }
.attack-fx-layer .dmg.violet { color:#d9b3ff; text-shadow:0 0 14px rgba(180,90,255,.9), 0 3px 0 rgba(0,0,0,.8); }
.attack-fx-layer .butterfly { width:16px; height:12px; pointer-events:none; z-index:7; }
.attack-fx-layer .butterfly i {
  position:absolute; top:0; width:8px; height:12px; border-radius:60% 40% 55% 45%;
  background:linear-gradient(160deg, #e6d2ff, #b06cff 70%);
  box-shadow:0 0 8px rgba(176,108,255,.8);
}
.attack-fx-layer .butterfly i:nth-child(1) { left:0; animation:afxWingL .3s ease-in-out infinite alternate; }
.attack-fx-layer .butterfly i:nth-child(2) { right:0; transform:scaleX(-1); animation:afxWingR .3s ease-in-out infinite alternate; }
@keyframes afxWingL { from { transform:rotate(-30deg); } to { transform:rotate(-2deg); } }
@keyframes afxWingR { from { transform:rotate(30deg) scaleX(-1); } to { transform:rotate(2deg) scaleX(-1); } }
.attack-fx-layer .mist {
  pointer-events:none;
  background:radial-gradient(circle at 45% 40%, rgba(200,140,255,.5), rgba(120,60,180,.3) 55%, transparent 78%);
  filter:blur(6px); border-radius:50%;
}
.attack-fx-layer .domain-tint { pointer-events:none; }
.attack-fx-layer .note { pointer-events:none; }
`;

const FX_DEFS = `
<svg width="0" height="0" aria-hidden="true"><defs>
  <filter id="fxRough" x="-60%" y="-60%" width="220%" height="220%">
    <feTurbulence type="fractalNoise" baseFrequency="0.021 0.06" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="fxRoughSoft" x="-60%" y="-60%" width="220%" height="220%">
    <feTurbulence type="fractalNoise" baseFrequency="0.016 0.045" numOctaves="3" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="1.2"/>
  </filter>
  <filter id="fxGlow" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="3.2"/>
  </filter>
</defs></svg>`;

let fxReady = false;
function ensureFx() {
  if (fxReady || typeof document === "undefined") return;
  fxReady = true;
  if (!document.getElementById("attack-fx-style")) {
    const st = document.createElement("style");
    st.id = "attack-fx-style";
    st.textContent = FX_CSS;
    document.head.appendChild(st);
  }
  if (!document.getElementById("attack-fx-defs")) {
    const wrap = document.createElement("div");
    wrap.id = "attack-fx-defs";
    wrap.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
    wrap.innerHTML = FX_DEFS;
    document.body.appendChild(wrap);
  }
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeCtx(env, profile) {
  const { arena, fx } = env;
  const S = env.speed || 1;
  const tier = (profile && profile.tier) || 3;
  const power = 0.72 + (tier - 3) * 0.28; // N≈0.72 / SR=1 / SSR≈1.28 / UR≈1.56
  const T = (ms) => ms * S;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * S));
  const anim = (el, frames, opts) => {
    const o = Object.assign({ fill: "forwards", easing: "ease-out" }, opts || {});
    o.duration = T(o.duration || 300);
    if (o.delay) o.delay = T(o.delay);
    return el.animate(frames, o);
  };
  const el = (tag, cls, css) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (css) {
      // 防御：凡是用 left/top 定位但没声明 position 的节点，自动补 absolute
      const needAbs = css.includes("left:") && !css.includes("position:");
      d.style.cssText = (needAbs ? "position:absolute;" : "") + css;
    }
    return d;
  };
  const svgEl = (tag, attrs) => {
    const d = document.createElementNS(NS, tag);
    for (const k in attrs) d.setAttribute(k, attrs[k]);
    return d;
  };
  const svgRoot = () => svgEl("svg", { class: "svgline", width: arena.clientWidth, height: arena.clientHeight });
  const cardRect = (cardEl) => {
    const a = arena.getBoundingClientRect();
    const r = cardEl.getBoundingClientRect();
    return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height, cx: r.left - a.left + r.width / 2, cy: r.top - a.top + r.height / 2 };
  };

  // 通用弹道：起点为攻击卡朝向目标的边缘（发射口），终点为目标卡中心。
  // 调用时实时测量，因此会跟随卡牌当前的位移（竖直突进/冲刺）。
  // 返回 { sx, sy, ex, ey, dx, dy, ux, uy, len, ang, px, py }
  //   ux/uy = 单位方向（攻击卡→目标），ang = 弧度，px/py = 垂直方向单位向量。
  const proj = (attackerEl, targetEl, margin = 10) => {
    const ar = cardRect(attackerEl);
    const tr = cardRect(targetEl);
    const vx = tr.cx - ar.cx, vy = tr.cy - ar.cy;
    const len0 = Math.hypot(vx, vy) || 1;
    const ux = vx / len0, uy = vy / len0;
    const hw = Math.max(12, ar.w / 2), hh = Math.max(12, ar.h / 2);
    const tEdge = Math.min(hw / Math.max(1e-6, Math.abs(ux)), hh / Math.max(1e-6, Math.abs(uy)));
    const sx = ar.cx + ux * (tEdge + margin);
    const sy = ar.cy + uy * (tEdge + margin);
    return {
      sx, sy, ex: tr.cx, ey: tr.cy,
      dx: tr.cx - sx, dy: tr.cy - sy,
      ux, uy, len: Math.hypot(tr.cx - sx, tr.cy - sy),
      ang: Math.atan2(vy, vx),
      px: -uy, py: ux, ar, tr,
    };
  };

  function spark(x, y, color, size, frames, dur) {
    const d = el("div", "p", `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${color};box-shadow:0 0 ${size * 2}px ${color};`);
    fx.appendChild(d);
    const a = anim(d, frames, { duration: dur, easing: "cubic-bezier(.15,.7,.4,1)" });
    a.onfinish = () => d.remove();
  }
  function flameParticle(x, y, size, drift, dur, color) {
    const d = el("div", "p", `left:${x}px;top:${y}px;width:${size}px;height:${size * 1.7}px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:radial-gradient(circle at 50% 68%, #fff8dc 0%, ${color || "#ffb14d"} 46%, rgba(255,90,30,.15) 78%, transparent 88%);filter:blur(.4px);`);
    fx.appendChild(d);
    const a = anim(d, [
      { transform: "translate(0,0) scale(1)", opacity: .95 },
      { transform: `translate(${drift[0]}px, ${drift[1]}px) scale(.25)`, opacity: 0 },
    ], { duration: dur, easing: "cubic-bezier(.2,.6,.4,1)" });
    a.onfinish = () => d.remove();
  }
  function droplet(x, y, color, dur) {
    const d = el("div", "p", `left:${x}px;top:${y}px;width:5px;height:9px;border-radius:60% 60% 50% 50%;background:radial-gradient(circle at 40% 30%, #fff, ${color} 70%);box-shadow:0 0 8px ${color};`);
    fx.appendChild(d);
    const ang = Math.random() * Math.PI * 2;
    const dist = 26 + Math.random() * 50;
    const a = anim(d, [
      { transform: "translate(0,0) scale(1)", opacity: .95 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist * .7 + 30}px) scale(.4)`, opacity: 0 },
    ], { duration: dur, easing: "cubic-bezier(.2,.6,.4,1)" });
    a.onfinish = () => d.remove();
  }
  function leafStreak(x, y, color, ang, dur) {
    const d = el("div", "p", `left:${x}px;top:${y}px;width:${18 + Math.random() * 22}px;height:2px;border-radius:2px;background:linear-gradient(90deg, transparent, ${color});transform:rotate(${ang}deg);`);
    fx.appendChild(d);
    const a = anim(d, [
      { transform: `rotate(${ang}deg) translateX(0)`, opacity: .95 },
      { transform: `rotate(${ang}deg) translateX(60px)`, opacity: 0 },
    ], { duration: dur, easing: "linear" });
    a.onfinish = () => d.remove();
  }
  function burst(x, y, colors, count, spread, dur, gravity) {
    const n = Math.max(6, Math.round(count * power));
    const sp = spread * (0.85 + power * 0.2);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = sp * (.35 + Math.random() * .85);
      spark(x, y, colors[Math.floor(Math.random() * colors.length)], 2 + Math.random() * 5, [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + (gravity || 0)}px) scale(.25)`, opacity: 0 },
      ], dur * (.7 + Math.random() * .6));
    }
  }
  function emberCloud(x, y, count, spread, dur, colors) {
    const n = Math.max(5, Math.round(count * power));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = spread * (.3 + Math.random() * .9) * (0.8 + power * 0.2);
      flameParticle(x, y, 3 + Math.random() * 6, [Math.cos(ang) * dist, Math.sin(ang) * dist - spread * .4], dur * (.7 + Math.random() * .6), colors && colors[i % colors.length]);
    }
  }
  function ring(x, y, color, size, dur) {
    const sz = size * Math.max(.7, power);
    const d = el("div", "ring", `left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz / 2}px;border-color:${color};box-shadow:0 0 18px ${color};`);
    fx.appendChild(d);
    const a = anim(d, [{ transform: "scale(.15)", opacity: .95 }, { transform: "scale(1.25)", opacity: 0 }], { duration: dur });
    a.onfinish = () => d.remove();
  }
  function reticle(cardEl, ms) {
    const r = cardRect(cardEl);
    const d = el("div", "reticle", `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;`);
    d.innerHTML = "<i></i><i></i><i></i><i></i>";
    fx.appendChild(d);
    const a = anim(d, [{ opacity: 0, transform: "scale(1.15)" }, { opacity: 1, transform: "scale(1)", offset: .22 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: ms || 520 });
    a.onfinish = () => d.remove();
  }
  function labelAbove(cardEl, text, cls, dx) {
    const r = cardRect(cardEl);
    const d = el("div", "label" + (cls ? " " + cls : ""), `left:${r.cx + (dx || 0)}px;top:${r.y - 30}px;transform:translateX(-50%);`);
    d.textContent = text;
    fx.appendChild(d);
    const a = anim(d, [
      { opacity: 0, transform: "translateX(-50%) translateY(8px) scale(.85)" },
      { opacity: 1, transform: "translateX(-50%) translateY(0) scale(1)", offset: .3 },
      { opacity: 1, transform: "translateX(-50%) translateY(0) scale(1)", offset: .72 },
      { opacity: 0, transform: "translateX(-50%) translateY(-8px) scale(1)" },
    ], { duration: 1400 });
    a.onfinish = () => d.remove();
  }
  function damageAbove(cardEl, text, cls) {
    const r = cardRect(cardEl);
    const d = el("div", "dmg" + (cls ? " " + cls : ""), `left:${r.cx}px;top:${r.y + 30}px;`);
    d.textContent = text;
    fx.appendChild(d);
    const dx = (Math.random() - .5) * 20;
    const a = anim(d, [
      { transform: `translate(-50%,-50%) translate(${dx}px, 6px) scale(.55)`, opacity: 0 },
      { transform: `translate(-50%,-50%) translate(${dx}px, -12px) scale(1.2)`, opacity: 1, offset: .22 },
      { transform: `translate(-50%,-50%) translate(${dx}px, -38px) scale(1)`, opacity: 1, offset: .7 },
      { transform: `translate(-50%,-50%) translate(${dx}px, -60px) scale(.96)`, opacity: 0 },
    ], { duration: 1150, easing: "cubic-bezier(.2,.7,.3,1)" });
    a.onfinish = () => d.remove();
  }
  function flashCard(cardEl, color, dur) {
    const r = cardRect(cardEl);
    const d = el("div", "flashcard", `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;background:${color || "#fff"};`);
    fx.appendChild(d);
    const a = anim(d, [{ opacity: 0 }, { opacity: .95, offset: .16 }, { opacity: 0 }], { duration: dur || 300 });
    a.onfinish = () => d.remove();
  }
  function shakeCard(cardEl, power) {
    cardEl.classList.add("hit");
    anim(cardEl, [
      { transform: "translate(0,0)" },
      { transform: `translate(${power || 6}px, ${-(power || 6) * .6}px)` },
      { transform: `translate(${-(power || 6) * .7}px, ${(power || 6) * .45}px)` },
      { transform: "translate(0,0)" },
    ], { duration: 260 });
    setTimeout(() => cardEl.classList.remove("hit"), T(360));
  }
  function bladePath(x1, y1, x2, y2, bulge, maxW, taper, waves) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx0 = -dy / len, ny0 = dx / len;
    const cx = mx + nx0 * bulge, cy = my + ny0 * bulge;
    const N = 30;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
      const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
      let tx = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
      let ty = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const w = maxW * Math.pow(Math.max(0, Math.sin(Math.PI * t)), taper || 0.62) * (1 + (waves == null ? .22 : waves) * Math.sin(t * Math.PI * 7 + 0.6));
      pts.push({ px, py, nx: -ty, ny: tx, w });
    }
    let d = `M ${(pts[0].px + pts[0].nx * pts[0].w).toFixed(1)} ${(pts[0].py + pts[0].ny * pts[0].w).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      d += ` L ${(p.px + p.nx * p.w).toFixed(1)} ${(p.py + p.ny * p.w).toFixed(1)}`;
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      d += ` L ${(p.px - p.nx * p.w * 0.16).toFixed(1)} ${(p.py - p.ny * p.w * 0.16).toFixed(1)}`;
    }
    return d + " Z";
  }
  function bladeSvg(x1, y1, x2, y2, bulge, w, colors, opts) {
    opts = opts || {};
    const svg = svgRoot();
    const outer = bladePath(x1, y1, x2, y2, bulge, w, 0.62, 0.26);
    const mid = bladePath(x1, y1, x2, y2, bulge, w * 0.62, 0.7, 0.2);
    const core = bladePath(x1, y1, x2, y2, bulge, w * 0.3, 0.78, 0.14);
    const hot = bladePath(x1, y1, x2, y2, bulge, w * 0.13, 0.85, 0.1);
    const [c1, c2, c3] = colors;
    svg.innerHTML = `
      <g filter="url(#fxRoughSoft)" opacity=".8"><path d="${outer}" fill="${c3}"/></g>
      <g filter="url(#fxRough)"><path d="${outer}" fill="${c2}"/></g>
      <g filter="url(#fxRough)" opacity=".96"><path d="${mid}" fill="${c1}"/></g>
      <path d="${core}" fill="${c1}" opacity=".95"/>
      <path d="${hot}" fill="#fffdf0"/>`;
    fx.appendChild(svg);
    const a = anim(svg, [
      { opacity: 0, transform: "scale(.94)", transformOrigin: "50% 50%" },
      { opacity: 1, transform: "scale(1)", offset: .2 },
      { opacity: 1, transform: "scale(1.02)", offset: .8 },
      { opacity: 0, transform: "scale(1.05)" },
    ], { duration: opts.duration || 680, easing: "cubic-bezier(.2,.7,.3,1)" });
    a.onfinish = () => svg.remove();
    return svg;
  }
  function boltSvg(x1, y1, x2, y2, colors, seed) {
    const rnd = mulberry32(seed);
    const svg = svgRoot();
    const N = 10;
    const pts = [[x1, y1]];
    for (let i = 1; i < N; i++) {
      const t = i / N;
      pts.push([x1 + (x2 - x1) * t + (rnd() - .5) * 52, y1 + (y2 - y1) * t + (rnd() - .5) * 52]);
    }
    pts.push([x2, y2]);
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    let branches = "";
    for (let i = 2; i < pts.length - 2; i += 2) {
      const bx = pts[i][0], by = pts[i][1];
      const base = Math.atan2(y2 - y1, x2 - x1);
      const ang = base + (rnd() - .5) * 2.2;
      const bl = 22 + rnd() * 46;
      branches += `M ${bx.toFixed(1)} ${by.toFixed(1)} L ${(bx + Math.cos(ang) * bl).toFixed(1)} ${(by + Math.sin(ang) * bl).toFixed(1)} `;
    }
    const [c1, c2] = colors;
    svg.innerHTML = `
      <path d="${d}" fill="none" stroke="${c2}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" filter="url(#fxGlow)"/>
      <path d="${d}" fill="none" stroke="${c2}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${branches}" fill="none" stroke="${c2}" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
      <path d="${branches}" fill="none" stroke="#fffbe0" stroke-width="1" stroke-linecap="round" opacity=".95"/>
      <path d="${d}" fill="none" stroke="${c1}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    fx.appendChild(svg);
    const a = anim(svg, [
      { opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: .25, offset: .3 },
      { opacity: 1, offset: .45 }, { opacity: .4, offset: .62 }, { opacity: 1, offset: .78 }, { opacity: 0 },
    ], { duration: 380, easing: "linear" });
    a.onfinish = () => svg.remove();
    return svg;
  }
  function flameOrbSvg(size, colors, seed) {
    const rnd = mulberry32(seed);
    const svg = svgEl("svg", { width: size * 2.4, height: size * 2.4, viewBox: "-40 -40 80 80" });
    let petals = "";
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 360 + rnd() * 30;
      const len = 22 + rnd() * 14;
      const wid = 6 + rnd() * 6;
      const tipX = Math.cos(ang * Math.PI / 180) * len;
      const tipY = Math.sin(ang * Math.PI / 180) * len;
      const perpX = Math.cos((ang + 90) * Math.PI / 180) * wid;
      const perpY = Math.sin((ang + 90) * Math.PI / 180) * wid;
      petals += `<path d="M 0 0 C ${perpX} ${perpY}, ${tipX + perpX * .4} ${tipY + perpY * .4}, ${tipX} ${tipY} C ${tipX - perpX * .4} ${tipY - perpY * .4}, ${-perpX} ${-perpY}, 0 0 Z" fill="${colors[1]}" opacity=".92"/>`;
    }
    svg.innerHTML = `
      <g filter="url(#fxRough)">
        ${petals}
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="0.7s" repeatCount="indefinite"/>
      </g>
      <circle r="15" fill="${colors[0]}"/>
      <circle r="8" fill="#fffdf0"/>`;
    return svg;
  }
  function crystalSvg(w, h, colors) {
    const [c1, c2, c3] = colors;
    const svg = svgEl("svg", { width: w, height: h, viewBox: "-10 -18 20 36" });
    svg.innerHTML = `
      <g filter="url(#fxGlow)" opacity=".8"><path d="M 0 -16 L 7 -5 L 4 12 L -4 12 L -7 -5 Z" fill="${c1}"/></g>
      <path d="M 0 -16 L 7 -5 L 4 12 L -4 12 L -7 -5 Z" fill="${c2}"/>
      <path d="M 0 -16 L 0 12 L -4 12 L -7 -5 Z" fill="${c3}" opacity=".95"/>
      <path d="M 0 -16 L 7 -5 L 0 -2 Z" fill="#ffffff" opacity=".9"/>
      <path d="M 0 -16 L 0 12" stroke="#ffffff" stroke-width="1" opacity=".9"/>
      <path d="M 0 -16 L 7 -5 L 4 12 L -4 12 L -7 -5 Z" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.1"/>`;
    return svg;
  }
  function voidSphereSvg(size, colors) {
    const [c1, c2, c3] = colors;
    const svg = svgEl("svg", { width: size, height: size, viewBox: "-40 -40 80 80" });
    svg.innerHTML = `
      <g filter="url(#fxGlow)" opacity=".9"><circle r="26" fill="${c2}"/></g>
      <circle r="24" fill="${c1}"/>
      <circle r="15" fill="${c2}" opacity=".55"/>
      <g>
        <path d="M -24 0 A 24 24 0 0 1 24 0" fill="none" stroke="#ff4d6d" stroke-width="4.2" opacity=".95"/>
        <path d="M 24 0 A 24 24 0 0 1 -24 0" fill="none" stroke="#4db8ff" stroke-width="4.2" opacity=".95"/>
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="0.9s" repeatCount="indefinite"/>
      </g>
      <g><circle cx="0" cy="-30" r="3.2" fill="#ff6d8f"/>
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="0.75s" repeatCount="indefinite"/></g>
      <g><circle cx="0" cy="32" r="2.6" fill="#6fd6ff"/>
        <animateTransform attributeName="transform" type="rotate" from="360 0 0" to="0 0 0" dur="1.05s" repeatCount="indefinite"/></g>
      <circle r="9" fill="#fff" opacity=".95"/>`;
    return svg;
  }

  return {
    S, T, wait, anim, el, svgEl, svgRoot, cardRect, proj,
    spark, flameParticle, droplet, leafStreak, burst, emberCloud, ring,
    reticle, labelAbove, damageAbove, flashCard, shakeCard,
    bladePath, bladeSvg, boltSvg, flameOrbSvg, crystalSvg, voidSphereSvg,
  };
}

function paletteClass(profile) {
  const p = profile.palette;
  if (p === "fire" || p === "crimson" || p === "orange" || p === "sunfire") return "fire";
  if (p === "thunder") return "elec";
  if (p === "ice") return "ice";
  if (p === "violet" || p === "dark" || p === "abyss") return "violet";
  return "";
}

async function slashFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const { scale } = profile;
  const p = profile.params;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 150) - ar.cx;
  const colors = profile.colors;
  const isFire = profile.palette === "fire" || profile.palette === "crimson" || profile.palette === "orange" || profile.palette === "sunfire";
  ctx.labelAbove(attackerEl, profile.label, null, p.dash ? dashX : 0);
  ctx.reticle(targetEl, 560);
  await ctx.wait(180);
  if (p.dash) {
    ctx.anim(attackerEl, [
      { transform: "translateX(0) rotate(0deg)" },
      { transform: `translateX(${dashX}px) rotate(-3deg)` },
    ], { duration: 280, easing: "cubic-bezier(.3,.75,.35,.95)" });
    for (let i = 0; i < 10; i++) {
      const f = i / 10;
      setTimeout(() => {
        if (isFire) ctx.flameParticle(ar.cx + dashX * f, ar.cy + 24 + Math.sin(f * Math.PI) * -16, 5 + Math.random() * 5, [(Math.random() - .5) * 30, -22 - Math.random() * 24], 460);
        else ctx.spark(ar.cx + dashX * f, ar.cy + 18 + Math.sin(f * Math.PI) * -14, colors[0], 3 + Math.random() * 4, [
          { transform: "translate(0,0)", opacity: .9 },
          { transform: `translate(${-18 - Math.random() * 16}px, ${(Math.random() - .5) * 20}px) scale(.2)`, opacity: 0 },
        ], 420);
      }, ctx.T(100 + i * 22));
    }
    await ctx.wait(250);
  } else {
    ctx.anim(attackerEl, [
      { filter: "brightness(1)" },
      { filter: `brightness(1.4) drop-shadow(0 0 10px ${colors[1]}aa)` },
    ], { duration: 260 });
    await ctx.wait(140);
  }
  const w = p.width * scale;
  const arcs = Math.max(1, Math.round(p.arcs * (scale > 1.1 ? 1.2 : 1)));
  const sx = tr.cx - 250, sy = tr.cy - 182, ex = tr.cx + 58, ey = tr.cy + 148;
  for (let i = 0; i < arcs; i++) {
    const k = i / Math.max(1, arcs);
    setTimeout(() => {
      ctx.bladeSvg(
        sx + i * 22, sy + i * 16 + k * 24,
        ex - i * 16, ey - i * 10 + k * 18,
        p.curve + i * 26, w * (1 - i * 0.24),
        colors
      );
    }, ctx.T(i * 80));
  }
  const particles = Math.round(18 * scale);
  for (let i = 0; i < particles; i++) {
    const t = i / particles;
    setTimeout(() => {
      const lx = sx + (ex - sx) * t + (Math.random() - .5) * 40;
      const ly = sy + (ey - sy) * t + (Math.random() - .5) * 40;
      if (isFire) ctx.flameParticle(lx, ly, 4 + Math.random() * 6, [(Math.random() - .5) * 50, -20 - Math.random() * 44], 540);
      else ctx.spark(lx, ly, colors[Math.floor(Math.random() * 3)], 2 + Math.random() * 4, [
        { transform: "translate(0,0) scale(1)", opacity: .95 },
        { transform: `translate(${(Math.random() - .5) * 44}px, ${(Math.random() - .5) * 44}px) scale(.2)`, opacity: 0 },
      ], 520);
    }, ctx.T(150 + i * 14));
  }
  await ctx.wait(300);
  ctx.flashCard(targetEl, profile.palette === "ice" ? "rgba(210,240,255,.95)" : "rgba(255,235,200,.92)", 260);
  ctx.shakeCard(targetEl, 7);
  if (isFire) ctx.emberCloud(tr.cx, tr.cy, Math.round(18 * scale), 100, 620, colors);
  else ctx.burst(tr.cx, tr.cy, colors, Math.round(20 * scale), 100, 560, 24);
  if (profile.palette === "water" || profile.palette === "teal") {
    for (let i = 0; i < 10; i++) ctx.droplet(tr.cx + (Math.random() - .5) * 60, tr.cy + (Math.random() - .5) * 60, colors[1], 460);
  }
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 150, 430);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), paletteClass(profile));
  await ctx.wait(430);
  if (p.dash) {
    ctx.anim(attackerEl, [
      { transform: `translateX(${dashX}px) rotate(-3deg)` },
      { transform: "translateX(0) rotate(0deg)" },
    ], { duration: 340, easing: "cubic-bezier(.3,.6,.3,1)" });
  } else {
    ctx.anim(attackerEl, [{ filter: "brightness(1.4)" }, { filter: "brightness(1)" }], { duration: 300 });
  }
  await ctx.wait(340);
}

async function thunderFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 160) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 460);
  await ctx.wait(180);
  for (const f of [0.35, 0.65]) {
    const ghost = ctx.el("div", "card after");
    ghost.innerHTML = attackerEl.innerHTML;
    ghost.style.cssText = `left:${ar.x}px;top:${ar.y}px;width:${ar.w}px;height:${ar.h}px;z-index:4;pointer-events:none;`;
    ctx.fxGhost(ghost);
    ctx.anim(ghost, [
      { transform: `translateX(${dashX * f}px)`, opacity: .38 },
      { opacity: 0 },
    ], { duration: 300 }).onfinish = () => ghost.remove();
  }
  ctx.anim(attackerEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 90 });
  await ctx.wait(100);
  attackerEl.style.transform = `translateX(${dashX}px)`;
  ctx.anim(attackerEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 80 });
  ctx.boltSvg(tr.cx - 190, tr.cy - 20, tr.cx + 120, tr.cy + 34, colors, seedCounter++);
  await ctx.wait(80);
  ctx.flashCard(targetEl, "rgba(255,245,170,.98)", 260);
  ctx.shakeCard(targetEl, 8);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 24, 95, 480, 20);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 140, 380);
  ctx.boltSvg(tr.cx - 90, tr.cy - 80, tr.cx + 60, tr.cy - 110, colors, seedCounter++);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "elec");
  await ctx.wait(300);
  ctx.anim(attackerEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 80 });
  await ctx.wait(90);
  attackerEl.style.transform = "translateX(0)";
  ctx.anim(attackerEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 });
  await ctx.wait(320);
}

async function rushFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 110) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 460);
  await ctx.wait(160);
  ctx.anim(attackerEl, [
    { transform: "translateX(0) scale(1)" },
    { transform: `translateX(${dashX}px) scale(1.06)` },
  ], { duration: 230, easing: "cubic-bezier(.25,.8,.3,1)" });
  for (let i = 0; i < 8; i++) {
    setTimeout(() => ctx.spark(ar.cx + dashX * (i / 8), ar.cy + 30, colors[1], 3 + Math.random() * 4, [
      { transform: "translate(0,0)", opacity: .8 },
      { transform: `translate(${-20 - Math.random() * 20}px, ${(Math.random() - .5) * 18}px) scale(.2)`, opacity: 0 },
    ], 360), ctx.T(80 + i * 20));
  }
  await ctx.wait(240);
  ctx.flashCard(targetEl, colors[0] + "ee", 240);
  ctx.shakeCard(targetEl, 10);
  const rings = Math.max(2, Math.round(profile.params.rings || 2));
  for (let i = 0; i < rings; i++) ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 170 + i * 40, 460 + i * 90);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 22, 110, 560, 30);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(420);
  ctx.anim(attackerEl, [
    { transform: `translateX(${dashX}px) scale(1.06)` },
    { transform: "translateX(0) scale(1)" },
  ], { duration: 330, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(340);
}

async function butterflyFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  await ctx.wait(150);
  const n = Math.max(4, Math.round((profile.params.count || 7) * profile.scale));
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const L = ctx.proj(attackerEl, targetEl, 6);
      const wing = ctx.el("div", "butterfly", "");
      wing.innerHTML = `<i></i><i></i>`;
      wing.style.cssText = `left:${L.sx}px;top:${L.sy}px;z-index:7;pointer-events:none;`;
      const m = 1 + Math.random() * .6;
      const sway = Math.sin(i) * 60;
      ctx.anim(wing, [
        { transform: "translate(0,0) scale(.6) rotate(0deg)", opacity: 0 },
        { opacity: 1, offset: .12 },
        { transform: `translate(${L.dx * .55 * m + L.px * sway * .6}px, ${L.dy * .55 * m + L.py * sway * .6}px) rotate(14deg) scale(1)`, offset: .55 },
        { transform: `translate(${L.dx}px, ${L.dy}px) rotate(-10deg) scale(.9)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 260, easing: "cubic-bezier(.3,.5,.4,1)" });
      ctx.fxAppend(wing);
      setTimeout(() => wing.remove(), ctx.T(1300));
    }, ctx.T(i * 90));
  }
  await ctx.wait(760);
  const tint = ctx.el("div", "mist", `left:${tr.cx - 160}px;top:${tr.cy - 140}px;width:320px;height:280px;z-index:6;pointer-events:none;`);
  ctx.fxAppend(tint);
  ctx.anim(tint, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 1100 }).onfinish = () => tint.remove();
  for (let i = 0; i < 12; i++) {
    setTimeout(() => ctx.spark(tr.cx + (Math.random() - .5) * 120, tr.cy + (Math.random() - .5) * 120, colors[Math.floor(Math.random() * 3)], 3 + Math.random() * 5, [
      { transform: "translate(0,0) scale(1)", opacity: .85 },
      { transform: `translate(${(Math.random() - .5) * 50}px, ${-30 - Math.random() * 40}px) scale(.2)`, opacity: 0 },
    ], 700), ctx.T(760 + i * 40));
  }
  await ctx.wait(320);
  ctx.flashCard(targetEl, "rgba(220,180,255,.9)", 260);
  ctx.shakeCard(targetEl, 5);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 150, 430);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(360);
}

async function musicFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  await ctx.wait(160);
  const rings = Math.max(2, Math.round(profile.params.rings || 3));
  for (let i = 0; i < rings; i++) {
    setTimeout(() => {
      const L = ctx.proj(attackerEl, targetEl, 12);
      const r = ctx.el("div", "sring", `left:${L.sx}px;top:${L.sy}px;width:60px;height:60px;margin:-30px 0 0 -30px;border-color:${colors[1]};box-shadow:0 0 16px ${colors[1]};z-index:7;pointer-events:none;`);
      ctx.fxAppend(r);
      ctx.anim(r, [
        { transform: "scale(.5)", opacity: 0 },
        { transform: `translate(${L.dx * .55}px, ${L.dy * .55}px) scale(1.6)`, opacity: .9, offset: .5 },
        { transform: `translate(${L.dx}px, ${L.dy}px) scale(2.4)`, opacity: 0 },
      ], { duration: 800, easing: "cubic-bezier(.3,.6,.4,1)" }).onfinish = () => r.remove();
    }, ctx.T(i * 130));
  }
  const notes = Math.max(4, Math.round(profile.params.notes || 8));
  for (let i = 0; i < notes; i++) {
    setTimeout(() => {
      const L = ctx.proj(attackerEl, targetEl, 10);
      const note = ctx.el("div", "note", `left:${L.sx}px;top:${L.sy}px;width:10px;height:10px;border-radius:50%;background:${colors[0]};box-shadow:0 0 10px ${colors[1]};z-index:7;pointer-events:none;`);
      note.textContent = "";
      ctx.fxAppend(note);
      const sway = (Math.random() - .5) * 80;
      const dx = L.dx + (Math.random() - .5) * 40;
      const dy = L.dy + (Math.random() - .5) * 40;
      ctx.anim(note, [
        { transform: "translate(0,0) scale(.5)", opacity: 0 },
        { transform: `translate(${dx * .5 + L.px * sway}px, ${dy * .5 + L.py * sway}px) scale(1.1)`, opacity: .95, offset: .5 },
        { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0 },
      ], { duration: 820, easing: "cubic-bezier(.3,.6,.4,1)" }).onfinish = () => note.remove();
    }, ctx.T(120 + i * 70));
  }
  await ctx.wait(720);
  ctx.flashCard(targetEl, colors[0] + "dd", 260);
  ctx.shakeCard(targetEl, 6);
  ctx.burst(tr.cx, tr.cy, colors, 22, 100, 560, 10);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 160, 460);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(380);
}

async function voidFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "violet");
  ctx.reticle(targetEl, 420);
  await ctx.wait(150);
  const L0 = ctx.proj(attackerEl, targetEl, 14);
  const blue = ctx.el("div", "orb", `left:${L0.sx + L0.px * 40}px;top:${L0.sy + L0.py * 40}px;width:22px;height:22px;margin:-11px 0 0 -11px;background:radial-gradient(circle, #fff 0%, #6fd6ff 42%, rgba(60,160,255,.4) 72%, transparent 82%);box-shadow:0 0 22px #6fd6ff;`);
  const red = ctx.el("div", "orb", `left:${L0.sx - L0.px * 40}px;top:${L0.sy - L0.py * 40}px;width:22px;height:22px;margin:-11px 0 0 -11px;background:radial-gradient(circle, #fff 0%, #ff6d8f 42%, rgba(255,60,110,.4) 72%, transparent 82%);box-shadow:0 0 22px #ff6d8f;`);
  ctx.fxAppend(blue); ctx.fxAppend(red);
  ctx.anim(blue, [
    { transform: `translate(${-L0.px * 18}px, ${-L0.py * 18}px) scale(.7)`, opacity: 0 },
    { transform: "translate(0,0) scale(1)", opacity: 1, offset: .5 },
    { transform: "translate(0,-2px) scale(.9)", opacity: 1 },
  ], { duration: 520 });
  ctx.anim(red, [
    { transform: `translate(${L0.px * 18}px, ${L0.py * 18}px) scale(.7)`, opacity: 0 },
    { transform: "translate(0,0) scale(1)", opacity: 1, offset: .5 },
    { transform: "translate(0,-2px) scale(.9)", opacity: 1 },
  ], { duration: 520 });
  await ctx.wait(520);
  blue.remove(); red.remove();
  const L = ctx.proj(attackerEl, targetEl, 16);
  const wrap = ctx.el("div", "orb", `left:${L.sx}px;top:${L.sy}px;width:0;height:0;`);
  const sphere = ctx.voidSphereSvg(profile.params.orbSize || 76, colors);
  sphere.style.cssText = `position:absolute;left:${-(profile.params.orbSize || 76) / 2}px;top:${-(profile.params.orbSize || 76) / 2}px;`;
  wrap.appendChild(sphere);
  ctx.fxAppend(wrap);
  ctx.anim(wrap, [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1.1)", opacity: 1, offset: .6 }, { transform: "scale(1)", opacity: 1 }], { duration: 440 });
  for (let i = 0; i < 8; i++) {
    setTimeout(() => ctx.spark(L.sx + (Math.random() - .5) * 34, L.sy + (Math.random() - .5) * 34, colors[Math.floor(Math.random() * 3)], 2 + Math.random() * 4, [
      { transform: "translate(0,0) scale(1)", opacity: .9 },
      { transform: `translate(${(Math.random() - .5) * 60}px, ${(Math.random() - .5) * 60}px) scale(.2)`, opacity: 0 },
    ], 520), ctx.T(i * 45));
  }
  await ctx.wait(450);
  const beamWrap = ctx.el("div", "orb", `left:${L.sx}px;top:${L.sy}px;width:0;height:0;transform:rotate(${L.ang}rad);`);
  ctx.fxAppend(beamWrap);
  const len = Math.hypot(L.dx, L.dy);
  const beam = ctx.el("div", "beam", `left:0;top:0;width:${len}px;height:20px;margin-top:-10px;transform-origin:0 50%;background:linear-gradient(90deg, ${colors[1]}ee, ${colors[0]}f2 35%, #fff 68%, ${colors[0]}e6 88%, transparent);filter:blur(1px);border-radius:999px;box-shadow:0 0 26px ${colors[2]}e6, 0 0 60px ${colors[2]}88;`);
  beamWrap.appendChild(beam);
  ctx.anim(beam, [
    { transform: "scaleX(0)", opacity: 0 },
    { transform: "scaleX(1)", opacity: 1, offset: .6 },
    { transform: "scaleX(1)", opacity: 1 },
  ], { duration: 220, easing: "cubic-bezier(.2,.7,.3,1)" });
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const rip = ctx.el("div", "ring", `left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-color:${colors[0]}cc;box-shadow:0 0 14px ${colors[0]}cc;`);
      beamWrap.appendChild(rip);
      ctx.anim(rip, [
        { transform: "translateX(0) scale(.4)", opacity: .95 },
        { transform: `translateX(${len * .9}px) scale(1.3)`, opacity: 0 },
      ], { duration: 300, easing: "linear" }).onfinish = () => rip.remove();
    }, ctx.T(i * 90));
  }
  for (let i = 0; i < 10; i++) {
    const f = i / 10;
    setTimeout(() => ctx.spark(L.sx + L.dx * f, L.sy + L.dy * f + (Math.random() - .5) * 14, colors[i % 3], 2 + Math.random() * 4, [
      { transform: "translate(0,0)", opacity: .95 },
      { transform: `translate(${(Math.random() - .5) * 30}px, ${(Math.random() - .5) * 30}px) scale(.2)`, opacity: 0 },
    ], 420), ctx.T(i * 30));
  }
  await ctx.wait(180);
  ctx.flashCard(targetEl, "rgba(225,200,255,.98)", 300);
  ctx.shakeCard(targetEl, 9);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[2], "#fff"], 30, 120, 620, 26);
  ctx.ring(tr.cx, tr.cy, colors[2] + "f2", 190, 490);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 150, 430);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(240);
  ctx.anim(beam, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 }).onfinish = () => beamWrap.remove();
  ctx.anim(wrap, [{ opacity: 1 }, { opacity: 0, transform: "scale(.4)" }], { duration: 300 }).onfinish = () => wrap.remove();
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(0)" }], { duration: 300 });
  await ctx.wait(380);
}

async function fireballFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const { scale } = profile;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 420);
  await ctx.wait(490);
  const L = ctx.proj(attackerEl, targetEl, 16);
  const size = Math.round((profile.params.size || 26) * scale);
  ctx.ring(L.sx, L.sy, colors[1] + "f2", 76, 420);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    ctx.flameParticle(L.sx + Math.cos(ang) * 44, L.sy + Math.sin(ang) * 44, 4 + Math.random() * 4,
      [Math.cos(ang) * -44, Math.sin(ang) * -44], 380, colors[1]);
  }
  await ctx.wait(360);
  const wrap = ctx.el("div", "orb", `left:${L.sx}px;top:${L.sy}px;width:0;height:0;`);
  const inner = ctx.el("div", "orb", "position:absolute;left:0;top:0;width:0;height:0;");
  inner.style.transform = `rotate(${L.ang}rad)`;
  const orbSvg = ctx.flameOrbSvg(size, colors, seedCounter++);
  orbSvg.style.cssText = `position:absolute;left:${-size * 1.2}px;top:${-size * 1.2}px;`;
  inner.appendChild(orbSvg);
  const tail = ctx.el("div", "trail", `left:-96px;top:-10px;width:96px;height:20px;background:linear-gradient(270deg, ${colors[1]}f2, ${colors[2]}66 60%, transparent 88%);`);
  inner.appendChild(tail);
  wrap.appendChild(inner);
  ctx.fxAppend(wrap);
  const arc = profile.params.arcY || -34;
  ctx.anim(wrap, [
    { transform: "translate(0,0)" },
    { transform: `translate(${L.dx * .5 + L.px * arc}px, ${L.dy * .5 + L.py * arc}px)`, offset: .5 },
    { transform: `translate(${L.dx}px, ${L.dy}px)` },
  ], { duration: 500, easing: "cubic-bezier(.3,.6,.4,1)" });
  for (let i = 0; i < 10; i++) {
    const f = i / 10;
    setTimeout(() => ctx.flameParticle(L.sx + L.dx * f + L.px * Math.sin(f * Math.PI) * arc * .8, L.sy + L.dy * f + L.py * Math.sin(f * Math.PI) * arc * .8, 4 + Math.random() * 5,
      [-26 - Math.random() * 20, (Math.random() - .5) * 16], 420, colors[1]), ctx.T(i * 50));
  }
  await ctx.wait(510);
  wrap.remove();
  ctx.flashCard(targetEl, colors[0] + "f2", 280);
  ctx.shakeCard(targetEl, 7);
  ctx.emberCloud(tr.cx, tr.cy, Math.round(20 * scale), 110, 640, colors);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 170, 440);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), paletteClass(profile));
  await ctx.wait(340);
}

async function iceFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "cyan");
  ctx.reticle(targetEl, 420);
  await ctx.wait(490);
  const L = ctx.proj(attackerEl, targetEl, 14);
  const n = Math.max(3, Math.round((profile.params.shards || 5) * profile.scale));
  const shards = [];
  for (let i = 0; i < n; i++) {
    const s = ctx.el("div", "shard", `left:${L.sx}px;top:${L.sy}px;margin:-20px 0 0 -10px;`);
    s.appendChild(ctx.crystalSvg(20, 40, colors));
    ctx.fxAppend(s);
    shards.push(s);
    const ang = (i / n) * Math.PI * 2;
    ctx.anim(s, [
      { transform: `translate(${Math.cos(ang) * 42}px, ${Math.sin(ang) * 42}px) rotate(0deg) scale(.7)`, opacity: 0 },
      { transform: `translate(${Math.cos(ang + 1.2) * 36}px, ${Math.sin(ang + 1.2) * 36}px) rotate(140deg) scale(1.05)`, opacity: 1, offset: .5 },
      { transform: `translate(${Math.cos(ang + 2.4) * 30}px, ${Math.sin(ang + 2.4) * 30}px) rotate(280deg) scale(.95)`, opacity: 1 },
    ], { duration: 480 });
  }
  ctx.ring(L.sx, L.sy, colors[1] + "e6", 86, 460);
  await ctx.wait(420);
  ctx.flashCard(attackerEl, "rgba(190,230,255,.5)", 200);
  shards.forEach((s, i) => {
    const along = (i - (n - 1) / 2) * 13;
    const spread = (i - (n - 1) / 2) * 15;
    const exx = L.dx + L.ux * along + L.px * spread;
    const eyy = L.dy + L.uy * along + L.py * spread;
    ctx.anim(s, [
      { transform: `translate(${Math.cos(2.4 + i) * 30}px, ${Math.sin(2.4 + i) * 30}px) rotate(280deg)` },
      { transform: `translate(${exx}px, ${eyy}px) rotate(640deg) scale(1.12)` },
    ], { duration: 430, easing: "cubic-bezier(.3,.65,.4,1)" });
    for (let k = 0; k < 4; k++) {
      const f = k / 4;
      setTimeout(() => ctx.spark(L.sx + L.dx * f + L.px * spread * f, L.sy + L.dy * f + L.py * spread * f, colors[0], 2.5 + Math.random() * 3.5, [
        { transform: "translate(0,0)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 26}px, ${(Math.random() - .5) * 26}px) scale(.2)`, opacity: 0 },
      ], 380), ctx.T(i * 34 + k * 48));
    }
  });
  await ctx.wait(440);
  shards.forEach(s => s.remove());
  ctx.flashCard(targetEl, "rgba(210,240,255,.95)", 280);
  const fov = targetEl.querySelector(".frostov");
  if (fov) ctx.anim(fov, [{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 0 }], { duration: 900 });
  ctx.shakeCard(targetEl, 6);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 26, 100, 560, 24);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 170, 470);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2;
    const d = ctx.el("div", "shard", `left:${tr.cx}px;top:${tr.cy}px;margin:-16px 0 0 -8px;`);
    d.appendChild(ctx.crystalSvg(16, 32, colors));
    ctx.fxAppend(d);
    ctx.anim(d, [
      { transform: "translate(0,0) rotate(0deg) scale(.45)", opacity: .95 },
      { transform: `translate(${Math.cos(ang) * 76}px, ${Math.sin(ang) * 76}px) rotate(${Math.random() * 260 - 130}deg) scale(1.05)`, opacity: 0 },
    ], { duration: 620, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => d.remove();
  }
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "ice");
  await ctx.wait(380);
}

async function bulletFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 420);
  await ctx.wait(490);
  const rounds = Math.max(3, Math.round((profile.params.rounds || 5) * profile.scale));
  const L = ctx.proj(attackerEl, targetEl, 12);
  const startX = L.sx, startY = L.sy;
  const endX = L.ex, endY = L.ey;
  for (let i = 0; i < rounds; i++) {
    setTimeout(() => {
      ctx.spark(startX, startY + (Math.random() - .5) * 20, colors[0], 6 + Math.random() * 6, [
        { transform: "scale(1.4)", opacity: 1 },
        { transform: "scale(.2)", opacity: 0 },
      ], 160);
      const dist = Math.hypot(endX - startX, endY - startY);
      const ang = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
      const tracer = ctx.el("div", "trail", `left:${startX}px;top:${startY}px;width:64px;height:3px;margin-top:-1.5px;background:linear-gradient(90deg, transparent, ${colors[0]} 40%, ${colors[1]} 85%, transparent);transform-origin:0 50%;transform:rotate(${ang}deg);`);
      ctx.fxAppend(tracer);
      ctx.anim(tracer, [
        { transform: `rotate(${ang}deg) translateX(0)`, opacity: 0 },
        { transform: `rotate(${ang}deg) translateX(${(dist - 64) * .5}px)`, opacity: .95, offset: .5 },
        { transform: `rotate(${ang}deg) translateX(${dist - 64}px)`, opacity: 0 },
      ], { duration: 190, easing: "linear" }).onfinish = () => tracer.remove();
      const jx = tr.cx + (Math.random() - .5) * 50, jy = tr.cy + (Math.random() - .5) * 60;
      setTimeout(() => {
        ctx.spark(jx, jy, colors[1], 3 + Math.random() * 4, [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: `translate(${(Math.random() - .5) * 30}px, ${(Math.random() - .5) * 30}px) scale(.2)`, opacity: 0 },
        ], 300);
      }, ctx.T(150));
      const shell = ctx.el("div", "p", `left:${startX}px;top:${startY}px;width:3px;height:7px;border-radius:1px;background:${colors[0]};`);
      ctx.fxAppend(shell);
      ctx.anim(shell, [
        { transform: "translate(0,0) rotate(0deg)", opacity: .9 },
        { transform: `translate(${-14 - Math.random() * 10}px, ${-26 - Math.random() * 16}px) rotate(${Math.random() * 200 - 100}deg)`, opacity: 0 },
      ], { duration: 380, easing: "cubic-bezier(.3,.5,.5,1)" }).onfinish = () => shell.remove();
    }, ctx.T(i * 110));
  }
  await ctx.wait(rounds * 110 + 220);
  ctx.flashCard(targetEl, colors[0] + "e6", 240);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, colors, 20, 100, 520, 22);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 150, 420);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(340);
}

async function whipFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, null, (tr.cx - 190) - ar.cx);
  ctx.reticle(targetEl, 480);
  await ctx.wait(150);
  const segs = Math.max(3, Math.round((profile.params.segments || 4) * profile.scale));
  ctx.anim(attackerEl, [
    { transform: "translateX(0) rotate(0deg)" },
    { transform: `translateX(${(tr.cx - 200) - ar.cx}px) rotate(-2deg)` },
  ], { duration: 240, easing: "cubic-bezier(.3,.7,.35,.95)" });
  await ctx.wait(200);
  for (let i = 0; i < segs; i++) {
    setTimeout(() => {
      const t = (i + 1) / segs;
      const bx = ar.cx + ((tr.cx - 200) - ar.cx) + (tr.cx - (ar.cx + ((tr.cx - 200) - ar.cx))) * t;
      const by = ar.cy + Math.sin(t * Math.PI) * -70 + (tr.cy - ar.cy) * t;
      const seg = ctx.svgRoot();
      const d = ctx.bladePath(bx - 46, by - 34, bx + 46, by + 30, -40 - i * 8, 12, .7, .3);
      seg.innerHTML = `<path d="${d}" fill="${colors[1]}" filter="url(#fxRough)"/><path d="${ctx.bladePath(bx - 40, by - 28, bx + 40, by + 24, -36 - i * 8, 4, .8, .2)}" fill="${colors[0]}"/>`;
      ctx.fxAppend(seg);
      ctx.anim(seg, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 420 }).onfinish = () => seg.remove();
    }, ctx.T(i * 90));
  }
  await ctx.wait(segs * 90 + 160);
  ctx.flashCard(targetEl, colors[0] + "e6", 260);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, colors, 22, 100, 540, 20);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 160, 440);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(380);
  ctx.anim(attackerEl, [
    { transform: `translateX(${(tr.cx - 200) - ar.cx}px) rotate(-2deg)` },
    { transform: "translateX(0) rotate(0deg)" },
  ], { duration: 320, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(320);
}

async function spiritFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 460);
  await ctx.wait(490);
  const L = ctx.proj(attackerEl, targetEl, 14);
  const size = Math.round((profile.params.size || 24) * profile.scale);
  const startX = L.sx, startY = L.sy;
  const endX = L.ex, endY = L.ey;
  const wisp = ctx.el("div", "orb", `left:${startX}px;top:${startY}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;background:radial-gradient(circle at 42% 38%, #fff 0%, ${colors[0]} 40%, ${colors[1]} 68%, transparent 82%);box-shadow:0 0 26px ${colors[0]}, 0 0 60px ${colors[1]}66;`);
  ctx.fxAppend(wisp);
  ctx.anim(wisp, [
    { transform: "translate(0,0) scale(.6)", opacity: 0 },
    { transform: `translate(${(endX - startX) * .5 + L.px * -40}px, ${(endY - startY) * .5 + L.py * -40}px) scale(1.1)`, opacity: 1, offset: .5 },
    { transform: `translate(${endX - startX}px, ${endY - startY}px) scale(1)`, opacity: 1 },
  ], { duration: 760, easing: "cubic-bezier(.35,.5,.4,1)" });
  const wisps = Math.max(6, Math.round(profile.params.wisps || 10));
  for (let i = 0; i < wisps; i++) {
    setTimeout(() => {
      const sw = Math.sin(i) * 26;
      ctx.spark(startX + (endX - startX) * (i / wisps) + L.px * sw, startY + (endY - startY) * (i / wisps) + L.py * sw, colors[i % 3], 3 + Math.random() * 5, [
        { transform: "translate(0,0) scale(1)", opacity: .8 },
        { transform: `translate(${(Math.random() - .5) * 30}px, ${-20 - Math.random() * 30}px) scale(.15)`, opacity: 0 },
      ], 700);
    }, ctx.T(120 + i * 70));
  }
  await ctx.wait(780);
  wisp.remove();
  ctx.flashCard(targetEl, colors[0] + "e6", 280);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, colors, 26, 110, 620, 18);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 170, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(380);
}

async function domainFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "violet");
  ctx.reticle(targetEl, 460);
  await ctx.wait(160);
  const tint = ctx.el("div", "domain-tint", `left:${tr.cx - 230}px;top:${tr.cy - 190}px;width:460px;height:380px;z-index:6;pointer-events:none;background:radial-gradient(circle at 50% 50%, ${colors[2]}55 0%, rgba(8,4,16,.72) 62%, transparent 88%);`);
  ctx.fxAppend(tint);
  ctx.anim(tint, [{ opacity: 0, transform: "scale(1.15)" }, { opacity: 1, transform: "scale(1)", offset: .3 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1500 });
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: "brightness(1.5) contrast(1.1)" }, { filter: "brightness(1.3)" }], { duration: 900 });
  const lines = Math.max(3, Math.round((profile.params.lines || 5) * profile.scale));
  for (let i = 0; i < lines; i++) {
    setTimeout(() => {
      const rnd = mulberry32(seedCounter++ + i * 17);
      const x1 = tr.cx - 200 + rnd() * 90;
      const y1 = tr.cy - 170 + rnd() * 110;
      const x2 = tr.cx + 60 + rnd() * 120;
      const y2 = tr.cy + 20 + rnd() * 140;
      const seg = ctx.svgRoot();
      const d = ctx.bladePath(x1, y1, x2, y2, (rnd() - .5) * 90, 9 + rnd() * 7, .72, .12);
      seg.innerHTML = `<path d="${d}" fill="${colors[1]}" filter="url(#fxRough)" opacity=".95"/><path d="${ctx.bladePath(x1, y1, x2, y2, (rnd() - .5) * 90, 3, .8, .1)}" fill="#fff" opacity=".9"/>`;
      ctx.fxAppend(seg);
      ctx.anim(seg, [{ opacity: 0, transform: "scale(.96)", transformOrigin: "50% 50%" }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: 520 }).onfinish = () => seg.remove();
      ctx.shakeCard(targetEl, 5);
    }, ctx.T(140 + i * 110));
  }
  await ctx.wait(lines * 110 + 260);
  ctx.flashCard(targetEl, colors[0] + "e6", 300);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 30, 130, 640, 24);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 200, 500);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(430);
  ctx.anim(attackerEl, [{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], { duration: 300 });
  await ctx.wait(260);
}

async function novaFamily(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 480);
  ctx.anim(attackerEl, [
    { filter: "brightness(1)" },
    { filter: `brightness(1.45) drop-shadow(0 0 12px ${colors[1]}aa)`, offset: .5 },
    { filter: "brightness(1)" },
  ], { duration: 760 });
  await ctx.wait(520);
  const core = ctx.el("div", "orb", `left:${tr.cx}px;top:${tr.cy}px;width:${44 * (profile.params.coreScale || 1)}px;height:${44 * (profile.params.coreScale || 1)}px;margin:${-22 * (profile.params.coreScale || 1)}px 0 0 ${-22 * (profile.params.coreScale || 1)}px;border-radius:50%;background:radial-gradient(circle, #fff 0%, ${colors[0]} 26%, ${colors[1]} 58%, ${colors[2]}55 78%, transparent 88%);`);
  ctx.fxAppend(core);
  const coreAnim = ctx.anim(core, [
    { transform: "scale(.2)", opacity: 0 },
    { transform: "scale(1.1)", opacity: 1, offset: .28 },
    { transform: "scale(5.2)", opacity: .95, offset: .62 },
    { transform: "scale(7)", opacity: 0 },
  ], { duration: 760, easing: "cubic-bezier(.2,.6,.3,1)" });
  coreAnim.onfinish = () => core.remove();
  ctx.flashCard(targetEl, colors[0] + "f2", 320);
  ctx.shakeCard(targetEl, 11);
  for (let i = 0; i < 3; i++) ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 170 + i * 70, 520 + i * 130);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 34, 150, 720, 26);
  ctx.emberCloud(tr.cx, tr.cy, 12, 130, 760, [colors[0], colors[1], colors[2]]);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), paletteClass(profile));
  await ctx.wait(660);
}

async function legacyAttack(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 170) - ar.cx;
  ctx.reticle(targetEl, 500);
  await ctx.wait(160);
  ctx.anim(attackerEl, [
    { transform: "translateX(0) scale(1)" },
    { transform: `translateX(${dashX}px) scale(.95)` },
  ], { duration: 300, easing: "cubic-bezier(.3,.7,.35,1)" });
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      const d = ctx.el("div", "trail", `left:${ar.cx + dashX * (i / 4)}px;top:${ar.cy}px;width:26px;height:5px;margin:-2px 0 0 -13px;background:linear-gradient(90deg, transparent, ${colors[1]}, transparent);`);
      ctx.fxAppend(d);
      ctx.anim(d, [{ transform: "scaleX(.6)", opacity: .6 }, { transform: "scaleX(1.2)", opacity: 0 }], { duration: 320 }).onfinish = () => d.remove();
    }, ctx.T(i * 60));
  }
  await ctx.wait(310);
  ctx.flashCard(targetEl, colors[0] + "dd", 220);
  ctx.shakeCard(targetEl, 5);
  ctx.burst(tr.cx, tr.cy, colors, 14, 80, 460, 18);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), paletteClass(profile));
  await ctx.wait(380);
  ctx.anim(attackerEl, [
    { transform: `translateX(${dashX}px) scale(.95)` },
    { transform: "translateX(0) scale(1)" },
  ], { duration: 320, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(300);
}

const FAMILIES = {
  slash: slashFamily,
  thunder: thunderFamily,
  rush: rushFamily,
  butterfly: butterflyFamily,
  music: musicFamily,
  void: voidFamily,
  fireball: fireballFamily,
  ice: iceFamily,
  bullet: bulletFamily,
  whip: whipFamily,
  spirit: spiritFamily,
  domain: domainFamily,
  nova: novaFamily,
  legacy: legacyAttack,
  ...EXTRA_FAMILIES,
  ...EXTRA_FAMILIES_3,
  ...EXTRA_FAMILIES_4,
};

export async function playCardAttack(env) {
  ensureFx();
  if (!env.fx) {
    const screen = env.arena || (typeof document !== "undefined" ? document.getElementById("battle-screen") : null) || document.body;
    let layer = document.getElementById("attack-fx-layer");
    if (!layer || layer.parentElement !== screen) {
      layer = document.createElement("div");
      layer.id = "attack-fx-layer";
      layer.className = "attack-fx-layer";
      screen.appendChild(layer);
    }
    env = Object.assign({}, env, { fx: layer });
  }
  const profile = getAttackProfile(env.card);
  const ctx = makeCtx(env, profile);
  ctx.fxAppend = (node) => env.fx.appendChild(node);
  ctx.fxGhost = (node) => env.fx.appendChild(node);
  // 竖直突进：目标在上方（对手怪兽/直接攻击）时，攻击卡朝目标方向冲上去再回落。
  // 近战族全额冲到目标身边；远程族只做小幅前倾（保留站位感）。
  // 使用独立的 translate 属性，与各招式族的 transform 动画互不干扰。
  let flightVy = 0;
  try {
    const ar0 = ctx.cardRect(env.attackerEl);
    const tr0 = ctx.cardRect(env.targetEl);
    const isMelee = !profile.params || profile.params.dash !== false;
    const factor = isMelee ? 0.92 : 0.38;
    const cap = isMelee ? -520 : -170;
    const vy = Math.min(0, (tr0.cy - ar0.cy) * factor);
    if (vy < -30 && env.attackerEl) {
      flightVy = Math.max(cap, vy);
      ctx.anim(env.attackerEl, [
        { translate: "0px 0px" },
        { translate: `0px ${flightVy}px` },
      ], { duration: 300, delay: 170, easing: "cubic-bezier(.3,.75,.35,.95)" });
    }
  } catch (error) { /* 测量失败则不做竖直突进 */ }
  const runner = FAMILIES[profile.family] || slashFamily;
  await runner(ctx, env, profile);
  if (flightVy < 0 && env.attackerEl) {
    ctx.anim(env.attackerEl, [
      { translate: `0px ${flightVy}px` },
      { translate: "0px 0px" },
    ], { duration: 320, easing: "cubic-bezier(.3,.6,.3,1)" });
    await ctx.wait(340);
    env.attackerEl.style.translate = "";
  }
  // 稀有度终结层：SSR 追加一圈冲击波，UR 追加二次爆发 + 星屑
  if (!profile.legacy && (profile.tier || 3) >= 4) {
    const tr = ctx.cardRect(env.targetEl);
    const strong = (profile.tier || 3) >= 5;
    await ctx.wait(110);
    ctx.flashCard(env.targetEl, profile.colors[0] + (strong ? "f2" : "cc"), strong ? 340 : 240);
    ctx.ring(tr.cx, tr.cy, profile.colors[1] + "e6", strong ? 240 : 185, strong ? 580 : 460);
    if (strong) {
      ctx.ring(tr.cx, tr.cy, "#ffffffcc", 300, 640, 90);
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        ctx.spark(tr.cx, tr.cy, [profile.colors[0], profile.colors[1], "#ffffff"][i % 3], 4 + Math.random() * 4, [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: `translate(${Math.cos(ang) * 150}px, ${Math.sin(ang) * 120 - 12}px) scale(.2)`, opacity: 0 },
        ], 740);
      }
      ctx.emberCloud(tr.cx, tr.cy, 10, 120, 760, profile.colors);
      ctx.shakeCard(env.targetEl, 8);
    }
    await ctx.wait(strong ? 430 : 280);
  }
  return profile;
}

export { getAttackProfile };
