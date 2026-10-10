// attack-fx-shapes4.js
// 形状库（第五批）：去掉"换色复用"，给每个角色结构不同的形状。
// 签名：(ctx, env, profile) => Promise<void>

function sinePath4(x1, y1, x2, y2, amp, periods, samples) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  const n = samples || 30;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const off = Math.sin(t * Math.PI * 2 * periods) * amp * Math.sin(Math.PI * t);
    d += ` L ${(x1 + dx * t + nx * off).toFixed(1)} ${(y1 + dy * t + ny * off).toFixed(1)}`;
  }
  return d;
}

function strokeDraw4(ctx, d, color, width, glow, dur, holdAt) {
  const svg = ctx.svgRoot();
  const p = ctx.svgEl("path", { d, fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round" });
  if (glow) p.style.filter = glow;
  svg.appendChild(p);
  ctx.fxAppend(svg);
  const len = p.getTotalLength();
  p.setAttribute("stroke-dasharray", len);
  const a = ctx.anim(p, [
    { strokeDashoffset: len, opacity: 0 },
    { strokeDashoffset: 0, opacity: 1, offset: .4 },
    { strokeDashoffset: 0, opacity: 1, offset: holdAt || .82 },
    { strokeDashoffset: 0, opacity: 0 },
  ], { duration: dur, easing: "cubic-bezier(.25,.7,.4,1)" });
  a.onfinish = () => svg.remove();
  return p;
}

// ---------- 白绫绸带 ----------
async function silkRibbon(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 540);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: `brightness(1.35) drop-shadow(0 0 12px ${colors[1]}99)` }], { duration: 420 });
  await ctx.wait(240);
  const sx = ar.cx + 56, sy = ar.cy - 30;
  const ex = tr.cx - 6, ey = tr.cy - 20;
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const wave = 60 - i * 12;
      strokeDraw4(ctx, sinePath4(sx, sy + i * 26, ex, ey + (i - 1) * 40, wave, 1.2 + i * .35, 34), colors[2] + "99", 22 - i * 5, "url(#fxRough)", 700, .85);
      strokeDraw4(ctx, sinePath4(sx, sy + i * 26, ex, ey + (i - 1) * 40, wave, 1.2 + i * .35, 34), "#ffffff", 7 - i * 1.5, null, 720, .85);
    }, ctx.T(i * 110));
  }
  for (let i = 0; i < 12; i++) {
    setTimeout(() => ctx.spark(sx + (ex - sx) * (i / 12) + (Math.random() - .5) * 50, sy + (ey - sy) * (i / 12) + (Math.random() - .5) * 50, "#ffffff", 2 + Math.random() * 4, [
      { transform: "translate(0,0) scale(1)", opacity: .85 },
      { transform: `translate(${(Math.random() - .5) * 30}px, ${-14 - Math.random() * 26}px) scale(.2)`, opacity: 0 },
    ], 620), ctx.T(220 + i * 44));
  }
  await ctx.wait(560);
  for (let i = 0; i < 3; i++) {
    const wrap = ctx.el("div", "ring", `left:${tr.cx}px;top:${tr.cy}px;width:${160 - i * 24}px;height:${120 - i * 18}px;margin:${-(120 - i * 18) / 2}px 0 0 ${-(160 - i * 24) / 2}px;border-radius:50%;border-color:#ffffffee;box-shadow:0 0 16px ${colors[0]}aa;`);
    ctx.fxAppend(wrap);
    ctx.anim(wrap, [
      { transform: "scale(1.5) rotate(-20deg)", opacity: 0 },
      { transform: "scale(1) rotate(6deg)", opacity: .95, offset: .4 },
      { transform: "scale(.7) rotate(0deg)", opacity: 0 },
    ], { duration: 620, delay: i * 90, easing: "cubic-bezier(.4,.2,.5,1)" }).onfinish = () => wrap.remove();
  }
  ctx.flashCard(targetEl, "rgba(250,252,255,.95)", 280);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 24, 110, 620, 10);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 185, 480);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(430);
}

// ---------- 咒刃 ----------
async function cursedBlade(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 150) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, "violet", dashX);
  ctx.reticle(targetEl, 500);
  await ctx.wait(170);
  // 暗影残像
  for (const f of [0.4, 0.75]) {
    const ghost = ctx.el("div", "card after");
    ghost.innerHTML = attackerEl.innerHTML;
    ghost.style.cssText = `left:${ar.x}px;top:${ar.y}px;width:${ar.w}px;height:${ar.h}px;z-index:4;pointer-events:none;filter:brightness(.5) saturate(.6);`;
    ctx.fxAppend(ghost);
    ctx.anim(ghost, [
      { transform: `translateX(${dashX * f}px)`, opacity: .45 },
      { opacity: 0 },
    ], { duration: 340 }).onfinish = () => ghost.remove();
  }
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${dashX}px)` }], { duration: 240, easing: "cubic-bezier(.3,.8,.3,1)" });
  await ctx.wait(250);
  // 撕裂状暗刃（高扰动 + 红边）
  const base = ctx.bladePath(tr.cx - 210, tr.cy - 165, tr.cx + 60, tr.cy + 135, -125, 26, .6, .55);
  const core = ctx.bladePath(tr.cx - 200, tr.cy - 155, tr.cx + 50, tr.cy + 125, -118, 12, .7, .5);
  const svg = ctx.svgRoot();
  svg.innerHTML = `
    <path d="${base}" fill="${colors[2]}" filter="url(#fxRough)"/>
    <path d="${base}" fill="none" stroke="${colors[1]}" stroke-width="3" filter="url(#fxRough)"/>
    <path d="${core}" fill="none" stroke="${colors[0]}" stroke-width="2.4" opacity=".95"/>`;
  ctx.fxAppend(svg);
  ctx.anim(svg, [
    { opacity: 0, transform: "scale(.95)", transformOrigin: "50% 50%" },
    { opacity: 1, transform: "scale(1)", offset: .22 },
    { opacity: 1, transform: "scale(1.03)", offset: .8 },
    { opacity: 0, transform: "scale(1.06)" },
  ], { duration: 620, easing: "cubic-bezier(.25,.7,.4,1)" }).onfinish = () => svg.remove();
  // 咒气
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      ctx.spark(tr.cx - 150 + Math.random() * 260, tr.cy - 150 + Math.random() * 260, [colors[1], colors[2], "#2a0a12"][i % 3], 3 + Math.random() * 6, [
        { transform: "translate(0,0) scale(1)", opacity: .85 },
        { transform: `translate(${(Math.random() - .5) * 50}px, ${-20 - Math.random() * 40}px) scale(.15)`, opacity: 0 },
      ], 700);
    }, ctx.T(200 + i * 34));
  }
  await ctx.wait(360);
  ctx.flashCard(targetEl, colors[0] + "e6", 260);
  ctx.shakeCard(targetEl, 9);
  ctx.burst(tr.cx, tr.cy, [colors[1], colors[2], colors[0]], 26, 120, 620, 20);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 180, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(400);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px)` }, { transform: "translateX(0)" }], { duration: 300, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(280);
}

// ---------- 利刃（干净锋利的斩击） ----------
async function cleanBlade(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 160) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 500);
  await ctx.wait(170);
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${dashX}px)` }], { duration: 250, easing: "cubic-bezier(.3,.78,.35,.95)" });
  for (let i = 0; i < 6; i++) {
    setTimeout(() => ctx.leafStreak(ar.cx + dashX * (i / 6), ar.cy, colors[0], 0, 420), ctx.T(80 + i * 26));
  }
  await ctx.wait(260);
  for (let i = 0; i < 2; i++) {
    setTimeout(() => {
      const off = (i - .5) * 34;
      const d = ctx.bladePath(tr.cx - 205, tr.cy - 155 + off, tr.cx + 75, tr.cy + 125 + off, -128, 10, .8, .04);
      const svg = ctx.svgRoot();
      svg.innerHTML = `
        <path d="${d}" fill="${colors[1]}e6"/>
        <path d="${d}" fill="none" stroke="#ffffff" stroke-width="1.6" opacity=".95"/>
        <path d="${ctx.bladePath(tr.cx - 190, tr.cy - 145 + off, tr.cx + 65, tr.cy + 115 + off, -120, 3, .85, .02)}" fill="#ffffff" opacity=".95"/>`;
      ctx.fxAppend(svg);
      ctx.anim(svg, [
        { opacity: 0, transform: "scale(.94)", transformOrigin: "50% 50%" },
        { opacity: 1, transform: "scale(1)", offset: .25 },
        { opacity: 1, offset: .78 },
        { opacity: 0, transform: "scale(1.03)" },
      ], { duration: 520, easing: "cubic-bezier(.25,.7,.4,1)" }).onfinish = () => svg.remove();
    }, ctx.T(i * 90));
  }
  await ctx.wait(300);
  ctx.flashCard(targetEl, "rgba(255,255,255,.95)", 240);
  ctx.shakeCard(targetEl, 8);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 22, 105, 560, 8);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 165, 450);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(400);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px)` }, { transform: "translateX(0)" }], { duration: 300, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(280);
}

// ---------- 傀儡丝 ----------
async function puppetThread(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "violet");
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: `brightness(1.3) drop-shadow(0 0 10px ${colors[1]}88)` }], { duration: 600 });
  await ctx.wait(380);
  // 丝线绷直
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const sy = tr.cy - 100 + i * 40;
      strokeDraw4(ctx, `M ${ar.cx + 70} ${ar.cy} Q ${(ar.cx + tr.cx) / 2} ${sy} ${tr.cx - 6} ${sy}`, colors[1] + "cc", 1.8, "url(#fxGlow)", 260, .6);
    }, ctx.T(i * 60));
  }
  // 关节标记
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      const cx0 = tr.cx - 60 + (i % 2) * 60;
      const cy0 = tr.cy - 60 + Math.floor(i / 2) * 80;
      const cross = ctx.el("div", "", `left:${cx0}px;top:${cy0}px;width:14px;height:14px;margin:-7px 0 0 -7px;z-index:9;pointer-events:none;`);
      cross.innerHTML = `<div style="position:absolute;left:50%;top:0;width:2px;height:100%;background:${colors[0]};transform:translateX(-50%)"></div><div style="position:absolute;top:50%;left:0;height:2px;width:100%;background:${colors[0]};transform:translateY(-50%)"></div>`;
      ctx.fxAppend(cross);
      ctx.anim(cross, [{ opacity: 0, transform: "scale(1.6)" }, { opacity: 1, transform: "scale(1)", offset: .3 }, { opacity: 0 }], { duration: 460 }).onfinish = () => cross.remove();
    }, ctx.T(260 + i * 70));
  }
  await ctx.wait(420);
  // 收线猛拽
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${(tr.cx - 200) - ar.cx}px)` }], { duration: 220, easing: "cubic-bezier(.3,.8,.3,1)" });
  ctx.shakeCard(targetEl, 6);
  await ctx.wait(240);
  ctx.flashCard(targetEl, colors[0] + "dd", 240);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 24, 115, 580, 12);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 170, 450);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(400);
  ctx.anim(attackerEl, [{ transform: `translateX(${(tr.cx - 200) - ar.cx}px)` }, { transform: "translateX(0)" }], { duration: 300, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(280);
}

// ---------- 投岩 ----------
async function boulder(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  await ctx.wait(180);
  const r0 = 3;
  let pts = "";
  const N = 10;
  const rad = 34;
  const verts = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const rr = rad * (0.72 + (mulberry(i * 37) * 0.5));
    verts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
  }
  pts = verts.map(v => v[0].toFixed(1) + " " + v[1].toFixed(1)).join(" L ");
  const rockSvg = ctx.svgEl("svg", { width: 90, height: 90, viewBox: "-45 -45 90 90", class: "shard", style: `left:${ar.cx + 80}px;top:${ar.cy - 10}px;margin:-45px 0 0 -45px;` });
  rockSvg.innerHTML = `
    <path d="M ${pts} Z" fill="${colors[1]}" filter="url(#fxRough)"/>
    <path d="M ${pts} Z" fill="none" stroke="${colors[0]}" stroke-width="1.6" opacity=".8"/>
    <path d="M ${verts[0][0]} ${verts[0][1]} L 0 0 L ${verts[4][0]} ${verts[4][1]}" stroke="${colors[2]}" stroke-width="1.2" opacity=".6"/>`;
  ctx.fxAppend(rockSvg);
  function mulberry(i) {
    let t = (i + 12345) >>> 0;
    t = Math.imul(t ^ t >>> 15, 1 | t);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const dx = tr.cx - ar.cx - 90, dy = tr.cy - ar.cy;
  ctx.anim(rockSvg, [
    { transform: "scale(.5) rotate(0deg)", opacity: 0 },
    { transform: `translate(${dx * .5}px, ${dy * .5 - 130}px) rotate(130deg) scale(1.1)`, opacity: 1, offset: .55 },
    { transform: `translate(${dx}px, ${dy}px) rotate(240deg) scale(1)`, opacity: 1 },
  ], { duration: 640, easing: "cubic-bezier(.35,.5,.4,1)" });
  await ctx.wait(650);
  rockSvg.remove();
  ctx.flashCard(targetEl, colors[0] + "dd", 260);
  ctx.shakeCard(targetEl, 11);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], colors[2], "#fff"], 30, 140, 680, 34);
  for (let i = 0; i < 8; i++) {
    const frag = ctx.el("div", "shard", `left:${tr.cx}px;top:${tr.cy}px;width:${8 + Math.random() * 12}px;height:${8 + Math.random() * 12}px;margin:-6px 0 0 -6px;background:${colors[1]};clip-path:polygon(${Math.random() * 30}% 0%, 100% ${Math.random() * 30}%, ${70 + Math.random() * 30}% 100%, 0% ${70 + Math.random() * 30}%);`);
    ctx.fxAppend(frag);
    const ang = (i / 8) * Math.PI * 2;
    ctx.anim(frag, [
      { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
      { transform: `translate(${Math.cos(ang) * 90}px, ${Math.sin(ang) * 80 - 20}px) rotate(${Math.random() * 300 - 150}deg) scale(.8)`, opacity: 0 },
    ], { duration: 620, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => frag.remove();
  }
  ctx.ring(tr.cx, tr.cy + 20, colors[1] + "cc", 190, 480);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(430);
}

// ---------- 琴键波 ----------
async function pianoKeys(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  await ctx.wait(170);
  for (let i = 0; i < 9; i++) {
    setTimeout(() => {
      const white = i % 7 !== 2 && i % 7 !== 6;
      const kw = 20, kh = white ? 58 : 38;
      const key = ctx.el("div", "", `left:${ar.cx + 50 + i * 46}px;top:${ar.cy - 40}px;width:${kw}px;height:${kh}px;z-index:7;pointer-events:none;border-radius:3px;background:${white ? "linear-gradient(180deg,#ffffff,#dce6f5)" : "linear-gradient(180deg,#3a4763,#141c2e)"};border:1px solid ${white ? "#b8c6dd" : "#0c1120"};box-shadow:0 4px 10px rgba(0,0,0,.5);opacity:0;`);
      ctx.fxAppend(key);
      ctx.anim(key, [
        { transform: "translateY(-24px) scaleY(.6)", opacity: 0 },
        { transform: "translateY(0) scaleY(1)", opacity: 1, offset: .35 },
        { transform: "translateY(0) scaleY(1)", opacity: .95, offset: .7 },
        { transform: "translateY(10px) scaleY(.9)", opacity: 0 },
      ], { duration: 620, easing: "cubic-bezier(.3,.6,.4,1)" }).onfinish = () => key.remove();
    }, ctx.T(i * 70));
  }
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const f = i / 10;
      ctx.spark(ar.cx + 80 + (tr.cx - ar.cx - 120) * f, ar.cy - 40 + (tr.cy - 20 - (ar.cy - 40)) * f + Math.sin(i) * 20, i % 2 ? colors[0] : "#ffffff", 3 + Math.random() * 4, [
        { transform: "translate(0,0) scale(1)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 30}px, ${-24 - Math.random() * 20}px) scale(.2)`, opacity: 0 },
      ], 620);
    }, ctx.T(180 + i * 60));
  }
  await ctx.wait(640);
  ctx.flashCard(targetEl, colors[0] + "dd", 260);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 24, 110, 600, 10);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 170, 460);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(420);
}

// ---------- 低音脉波 ----------
async function bassPulse(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 480);
  ctx.anim(attackerEl, [{ transform: "translateY(0)" }, { transform: "translateY(-4px)" }, { transform: "translateY(0)" }], { duration: 320 });
  await ctx.wait(220);
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const ring = ctx.el("div", "ring", `left:${ar.cx + 66}px;top:${ar.cy}px;width:70px;height:70px;margin:-35px 0 0 -35px;border-width:5px;border-color:${colors[1]};box-shadow:0 0 22px ${colors[1]}cc, inset 0 0 16px ${colors[1]}88;z-index:7;pointer-events:none;`);
      ctx.fxAppend(ring);
      const rdx = tr.cx - (ar.cx + 66), rdy = tr.cy - ar.cy;
      ctx.anim(ring, [
        { transform: "scale(.4)", opacity: 0 },
        { transform: `translate(${rdx * .55}px, ${rdy * .55}px) scale(1.8)`, opacity: .95, offset: .5 },
        { transform: `translate(${rdx}px, ${rdy}px) scale(2.8)`, opacity: 0 },
      ], { duration: 800, easing: "cubic-bezier(.3,.6,.4,1)" }).onfinish = () => ring.remove();
    }, ctx.T(i * 170));
  }
  const sx = ar.cx + 60, sy = ar.cy + 40;
  const ex = tr.cx - 10, ey = tr.cy + 30;
  strokeDraw4(ctx, sinePath4(sx, sy, ex, ey, 26, 3.2, 46), colors[0] + "cc", 5, null, 780, .85);
  strokeDraw4(ctx, sinePath4(sx, sy + 8, ex, ey + 8, 18, 4, 46), "#ffffffcc", 2, null, 800, .85);
  await ctx.wait(600);
  ctx.flashCard(targetEl, colors[0] + "dd", 240);
  ctx.shakeCard(targetEl, 9);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 22, 110, 580, 24);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 175, 460);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(420);
}

// ---------- DJ 均衡器 ----------
async function djEqualizer(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 480);
  await ctx.wait(170);
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      const h = 20 + Math.random() * 70;
      const bar = ctx.el("div", "", `left:${ar.cx + 56 + i * 24}px;top:${ar.cy + 40}px;width:10px;height:${h}px;margin-top:${-h}px;z-index:7;pointer-events:none;border-radius:3px 3px 0 0;background:linear-gradient(180deg, ${colors[0]}, ${colors[1]});box-shadow:0 0 10px ${colors[1]}88;opacity:0;`);
      ctx.fxAppend(bar);
      ctx.anim(bar, [
        { transform: "scaleY(.2)", opacity: 0 },
        { transform: "scaleY(1)", opacity: .95, offset: .35 },
        { transform: "scaleY(.5)", opacity: .9, offset: .7 },
        { transform: "scaleY(.15)", opacity: 0 },
      ], { duration: 520, easing: "cubic-bezier(.3,.7,.4,1)", transformOrigin: "50% 100%" }).onfinish = () => bar.remove();
    }, ctx.T(i * 42));
  }
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const note = ctx.el("div", "", `left:${ar.cx + 80 + (tr.cx - ar.cx - 140) * (i / 6)}px;top:${ar.cy - 30 + (tr.cy - ar.cy) * (i / 6) - Math.random() * 40}px;width:${6 + Math.random() * 5}px;height:${6 + Math.random() * 5}px;border-radius:50%;background:${colors[0]};box-shadow:0 0 10px ${colors[1]};z-index:7;pointer-events:none;opacity:0;`);
      ctx.fxAppend(note);
      ctx.anim(note, [
        { transform: "translate(0,0) scale(.4)", opacity: 0 },
        { transform: "translate(0,0) scale(1)", opacity: .95, offset: .3 },
        { transform: `translate(0, ${-30 - Math.random() * 30}px) scale(.6)`, opacity: 0 },
      ], { duration: 700 }).onfinish = () => note.remove();
    }, ctx.T(200 + i * 90));
  }
  await ctx.wait(620);
  ctx.flashCard(targetEl, colors[0] + "dd", 250);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 24, 115, 600, 8);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 175, 460);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(420);
}

// ---------- 偶像星光 ----------
async function idolBurst(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 480);
  ctx.anim(attackerEl, [
    { filter: "brightness(1)" },
    { filter: `brightness(1.6) saturate(1.3)`, offset: .5 },
    { filter: "brightness(1.4)" },
  ], { duration: 700 });
  await ctx.wait(300);
  // 聚光灯
  const beam = ctx.el("div", "", `left:${ar.cx - 90}px;top:-40px;width:270px;height:${ar.cy + 60}px;z-index:6;pointer-events:none;background:linear-gradient(to bottom, ${colors[0]}55, transparent 85%);clip-path:polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%);opacity:0;`);
  ctx.fxAppend(beam);
  ctx.anim(beam, [{ opacity: 0 }, { opacity: .9, offset: .3 }, { opacity: .8, offset: .8 }, { opacity: 0 }], { duration: 1300 }).onfinish = () => beam.remove();
  // 星星飞舞
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      const star = ctx.el("div", "", `left:${ar.cx + 60}px;top:${ar.cy - 40 + (Math.random() - .5) * 60}px;width:14px;height:14px;z-index:8;pointer-events:none;background:${["#fff", colors[0], colors[1]][i % 3]};clip-path:polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);opacity:0;filter:drop-shadow(0 0 6px ${colors[0]});`);
      ctx.fxAppend(star);
      const txx = tr.cx - ar.cx - 80 + (Math.random() - .5) * 60;
      const tyy = tr.cy - ar.cy + (Math.random() - .5) * 60;
      ctx.anim(star, [
        { transform: "translate(0,0) rotate(0deg) scale(.4)", opacity: 0 },
        { transform: `translate(${txx * .5}px, ${tyy * .5 - 50}px) rotate(180deg) scale(1.1)`, opacity: 1, offset: .5 },
        { transform: `translate(${txx}px, ${tyy}px) rotate(400deg) scale(.6)`, opacity: 0 },
      ], { duration: 700 + Math.random() * 260, easing: "cubic-bezier(.3,.55,.4,1)" }).onfinish = () => star.remove();
    }, ctx.T(i * 70));
  }
  await ctx.wait(640);
  ctx.flashCard(targetEl, "rgba(255,250,235,.95)", 280);
  ctx.shakeCard(targetEl, 7);
  for (let i = 0; i < 10; i++) {
    const star = ctx.el("div", "", `left:${tr.cx}px;top:${tr.cy}px;width:16px;height:16px;margin:-8px 0 0 -8px;z-index:9;pointer-events:none;background:${["#fff", colors[0], colors[1]][i % 3]};clip-path:polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);`);
    ctx.fxAppend(star);
    const ang = (i / 10) * Math.PI * 2;
    ctx.anim(star, [
      { transform: "translate(0,0) rotate(0deg) scale(.5)", opacity: 0 },
      { transform: `translate(${Math.cos(ang) * 80}px, ${Math.sin(ang) * 80}px) rotate(220deg) scale(1)`, opacity: 1, offset: .4 },
      { transform: `translate(${Math.cos(ang) * 110}px, ${Math.sin(ang) * 110 + 20}px) rotate(400deg) scale(.6)`, opacity: 0 },
    ], { duration: 700, easing: "cubic-bezier(.25,.7,.4,1)" }).onfinish = () => star.remove();
  }
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 180, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(440);
  ctx.anim(attackerEl, [{ filter: "brightness(1.4)" }, { filter: "brightness(1)" }], { duration: 280 });
  await ctx.wait(200);
}

// ---------- 炎矢（拉弓射火焰箭） ----------
async function flameArrow(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [
    { filter: "brightness(1)" },
    { filter: `brightness(1.45) drop-shadow(0 0 16px ${colors[1]}bb)`, offset: .5 },
    { filter: "brightness(1.3)" },
  ], { duration: 900 });
  await ctx.wait(320);
  const bx = ar.cx + 86, by = ar.cy - 6;
  const bow = ctx.svgRoot();
  bow.innerHTML = `
    <path d="M ${bx} ${by - 78} Q ${bx + 46} ${by} ${bx} ${by + 78}" fill="none" stroke="${colors[1]}" stroke-width="6.5" stroke-linecap="round" filter="url(#fxGlow)"/>
    <path d="M ${bx} ${by - 78} Q ${bx + 46} ${by} ${bx} ${by + 78}" fill="none" stroke="#fff2d0" stroke-width="2.2"/>
    <path d="M ${bx} ${by - 78} L ${bx} ${by + 78}" stroke="rgba(255,240,210,.85)" stroke-width="1.6"/>`;
  ctx.fxAppend(bow);
  ctx.anim(bow, [
    { opacity: 0, transform: "scale(.82)", transformOrigin: `${bx}px ${by}px` },
    { opacity: 1, transform: "scale(1)", offset: .3 },
    { opacity: 1, offset: .78 },
    { opacity: 0 },
  ], { duration: 1500 }).onfinish = () => bow.remove();
  const arrow = ctx.svgEl("svg", { width: 150, height: 44, viewBox: "-10 -22 150 44", class: "shard", style: `left:${bx}px;top:${by}px;margin:-22px 0 0 0;z-index:8;` });
  arrow.innerHTML = `
    <g filter="url(#fxGlow)">
      <rect x="18" y="-2.4" width="74" height="4.8" rx="2" fill="#ffcf7a"/>
      <path d="M 92 -9 L 120 0 L 92 9 Z" fill="#fff3c4"/>
      <path d="M 92 -9 L 120 0 L 92 9 Z" fill="none" stroke="${colors[1]}" stroke-width="1.6"/>
      <path d="M 26 -2 L 8 -13 L 18 -1 Z" fill="${colors[1]}"/>
      <path d="M 26 2 L 8 13 L 18 1 Z" fill="${colors[1]}"/>
    </g>
    <path d="M 14 0 L 96 0" stroke="#fff8dc" stroke-width="1" opacity=".9"/>`;
  ctx.fxAppend(arrow);
  ctx.anim(arrow, [
    { transform: "translate(6px, 0) scale(1)", opacity: 0 },
    { transform: "translate(-36px, 0) scale(1)", opacity: 1, offset: .7 },
    { transform: "translate(-32px, 0) scale(1)", opacity: 1 },
  ], { duration: 520, easing: "cubic-bezier(.4,.2,.5,1)" });
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const a = Math.random() * Math.PI * 2;
      ctx.flameParticle(bx + 98 + Math.cos(a) * 36, by + Math.sin(a) * 36, 4 + Math.random() * 5, [Math.cos(a) * -28, Math.sin(a) * -28], 420, colors[1]);
    }, ctx.T(i * 45));
  }
  await ctx.wait(560);
  const dx = tr.cx - bx - 70, dy = tr.cy - by;
  const ang = Math.atan2(dy, tr.cx - bx) * 180 / Math.PI;
  ctx.anim(arrow, [
    { transform: "translate(-32px, 0) scale(1)" },
    { transform: `translate(${dx}px, ${dy}px) rotate(${ang}deg) scale(1.05)`, opacity: 1 },
  ], { duration: 250, easing: "cubic-bezier(.3,.7,.3,1)" });
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      const f = i / 12;
      ctx.flameParticle(bx + dx * f, by + dy * f + Math.sin(f * Math.PI) * -16, 5 + Math.random() * 6, [(Math.random() - .5) * 28, -18 - Math.random() * 28], 480, colors[1]);
    }, ctx.T(i * 18));
  }
  await ctx.wait(270);
  arrow.remove();
  ctx.flashCard(targetEl, "rgba(255,225,170,.98)", 300);
  ctx.shakeCard(targetEl, 10);
  ctx.emberCloud(tr.cx, tr.cy, 26, 130, 700, colors);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 26, 120, 620, 22);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 190, 480);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "fire");
  await ctx.wait(450);
  ctx.anim(attackerEl, [{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], { duration: 300 });
  await ctx.wait(220);
}

// ---------- 千刃（刃之暴风） ----------
async function bladeStorm(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 170) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 500);
  await ctx.wait(170);
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${dashX}px)` }], { duration: 260, easing: "cubic-bezier(.3,.78,.35,.95)" });
  await ctx.wait(270);
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const ang = (i / 8) * Math.PI * 2 + Math.random() * .5;
      const r0 = 150 + Math.random() * 60;
      const x1 = tr.cx + Math.cos(ang) * r0;
      const y1 = tr.cy + Math.sin(ang) * r0;
      const x2 = tr.cx - Math.cos(ang) * 40;
      const y2 = tr.cy - Math.sin(ang) * 40;
      const d = ctx.bladePath(x1, y1, x2, y2, -40 - Math.random() * 40, 8 + Math.random() * 5, .82, .03);
      const svg = ctx.svgRoot();
      svg.innerHTML = `
        <path d="${d}" fill="${colors[1]}e6"/>
        <path d="${d}" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".95"/>`;
      ctx.fxAppend(svg);
      ctx.anim(svg, [
        { opacity: 0, transform: "scale(.9)", transformOrigin: `${tr.cx}px ${tr.cy}px` },
        { opacity: 1, transform: "scale(1)", offset: .25 },
        { opacity: 1, offset: .7 },
        { opacity: 0, transform: "scale(1.04) rotate(6deg)" },
      ], { duration: 560, easing: "cubic-bezier(.25,.7,.4,1)" }).onfinish = () => svg.remove();
      ctx.spark((x1 + x2) / 2, (y1 + y2) / 2, colors[0], 3 + Math.random() * 3, [
        { transform: "translate(0,0)", opacity: .95 },
        { transform: `translate(${(Math.random() - .5) * 40}px, ${(Math.random() - .5) * 40}px) scale(.2)`, opacity: 0 },
      ], 420);
      ctx.shakeCard(targetEl, 3);
    }, ctx.T(140 + i * 70));
  }
  await ctx.wait(760);
  ctx.flashCard(targetEl, "rgba(255,255,255,.95)", 280);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 30, 130, 660, 14);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 200, 500);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(430);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px)` }, { transform: "translateX(0)" }], { duration: 300, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(280);
}

// ---------- 双刀爆裂（交叉斩 + 爆） ----------
async function twinBlade(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 160) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 480);
  await ctx.wait(170);
  ctx.anim(attackerEl, [{ transform: "translateX(0) rotate(0deg)" }, { transform: `translateX(${dashX}px) rotate(-3deg)` }], { duration: 250, easing: "cubic-bezier(.3,.78,.35,.95)" });
  await ctx.wait(260);
  const d1 = ctx.bladePath(tr.cx - 190, tr.cy - 150, tr.cx + 70, tr.cy + 130, -120, 13, .78, .06);
  const d2 = ctx.bladePath(tr.cx - 190, tr.cy + 130, tr.cx + 70, tr.cy - 150, -120, 13, .78, .06);
  for (const d of [d1, d2]) {
    const svg = ctx.svgRoot();
    svg.innerHTML = `<path d="${d}" fill="${colors[1]}f0"/><path d="${d}" fill="none" stroke="#ffffff" stroke-width="1.6" opacity=".95"/>`;
    ctx.fxAppend(svg);
    ctx.anim(svg, [
      { opacity: 0, transform: "scale(.93)", transformOrigin: "50% 50%" },
      { opacity: 1, transform: "scale(1)", offset: .22 },
      { opacity: 1, offset: .7 },
      { opacity: 0, transform: "scale(1.05)" },
    ], { duration: 520, easing: "cubic-bezier(.25,.7,.4,1)" }).onfinish = () => svg.remove();
    await ctx.wait(90);
  }
  await ctx.wait(160);
  const core = ctx.el("div", "orb", `left:${tr.cx}px;top:${tr.cy}px;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle, #fff 0%, ${colors[0]} 32%, ${colors[1]} 62%, transparent 84%);`);
  ctx.fxAppend(core);
  ctx.anim(core, [
    { transform: "scale(.2)", opacity: 0 },
    { transform: "scale(1.1)", opacity: 1, offset: .3 },
    { transform: "scale(4.4)", opacity: .95, offset: .7 },
    { transform: "scale(5.6)", opacity: 0 },
  ], { duration: 640, easing: "cubic-bezier(.2,.6,.3,1)" }).onfinish = () => core.remove();
  ctx.flashCard(targetEl, colors[0] + "f2", 300);
  ctx.shakeCard(targetEl, 11);
  for (let i = 0; i < 3; i++) ctx.ring(tr.cx, tr.cy, i === 0 ? colors[0] + "e6" : colors[1] + "cc", 180 + i * 60, 480 + i * 120);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 30, 140, 680, 24);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(480);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px) rotate(-3deg)` }, { transform: "translateX(0) rotate(0deg)" }], { duration: 300, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(280);
}

// ---------- 蜈蚣之舞（节肢链） ----------
async function centipede(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "violet");
  ctx.reticle(targetEl, 520);
  await ctx.wait(180);
  const sx = ar.cx + 56, sy = ar.cy + 8;
  const ex = tr.cx - 8, ey = tr.cy + 4;
  const pathPt = (t) => ({
    x: sx + (ex - sx) * t + Math.sin(t * Math.PI * 3) * 40,
    y: sy + (ey - sy) * t + Math.cos(t * Math.PI * 3) * 28,
  });
  const N = 11;
  for (let i = 0; i < N; i++) {
    const size = 30 - Math.abs(i - 5) * 2;
    setTimeout(() => {
      const d = ctx.el("div", "", `left:${sx}px;top:${sy}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;background:radial-gradient(circle at 40% 35%, ${colors[0]}, ${colors[1]} 55%, ${colors[2]} 88%);box-shadow:0 0 12px ${colors[1]}99;z-index:8;pointer-events:none;opacity:0;`);
      ctx.fxAppend(d);
      const p1 = pathPt(.5);
      const p2 = pathPt(1);
      ctx.anim(d, [
        { left: sx + "px", top: sy + "px", opacity: 0 },
        { left: p1.x + "px", top: p1.y + "px", opacity: 1, offset: .45 },
        { left: p2.x + "px", top: p2.y + "px", opacity: 1, offset: .8 },
        { left: p2.x + "px", top: p2.y + "px", opacity: 0 },
      ], { duration: 900 + i * 40, easing: "cubic-bezier(.3,.6,.4,1)" }).onfinish = () => d.remove();
    }, ctx.T(i * 64));
  }
  // 毒牙与毒雾
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      ctx.spark(tr.cx - 50 + Math.random() * 100, tr.cy - 30 + Math.random() * 90, [colors[1], colors[2], "#c9ffb8"][i % 3], 3 + Math.random() * 5, [
        { transform: "translate(0,0) scale(1)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 46}px, ${-16 - Math.random() * 34}px) scale(.2)`, opacity: 0 },
      ], 700);
    }, ctx.T(780 + i * 46));
  }
  await ctx.wait(N * 64 + 320);
  ctx.flashCard(targetEl, colors[0] + "dd", 260);
  ctx.shakeCard(targetEl, 9);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], colors[2]], 26, 120, 620, 16);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 180, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(430);
}

// ---------- 水车（漩涡水轮） ----------
async function waterWheel(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: `brightness(1.3) drop-shadow(0 0 10px ${colors[1]}88)` }], { duration: 380 });
  await ctx.wait(260);
  // 水流先冲过去
  strokeDraw4(ctx, sinePath4(ar.cx + 56, ar.cy, tr.cx - 70, tr.cy - 20, 34, 1.2, 30), colors[1] + "e6", 20, "url(#fxRough)", 520, .8);
  strokeDraw4(ctx, sinePath4(ar.cx + 56, ar.cy, tr.cx - 70, tr.cy - 20, 20, 1.5, 30), "#ffffff", 5, null, 540, .8);
  await ctx.wait(420);
  const svg = ctx.svgRoot();
  svg.innerHTML = `
    <g transform="translate(${tr.cx} ${tr.cy})">
      <g filter="url(#fxRough)">
        <path d="M -72 0 A 72 72 0 0 1 72 0" fill="none" stroke="${colors[2]}" stroke-width="16" stroke-linecap="round" opacity=".8"/>
        <path d="M 72 0 A 72 72 0 0 1 -72 0" fill="none" stroke="${colors[1]}" stroke-width="10" stroke-linecap="round" opacity=".95"/>
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="0.7s" repeatCount="indefinite"/>
      </g>
      <g filter="url(#fxRough)">
        <path d="M -46 0 A 46 46 0 0 1 46 0" fill="none" stroke="${colors[1]}" stroke-width="11" stroke-linecap="round" opacity=".95"/>
        <path d="M 46 0 A 46 46 0 0 1 -46 0" fill="none" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round" opacity=".9"/>
        <animateTransform attributeName="transform" type="rotate" from="360 0 0" to="0 0 0" dur="0.5s" repeatCount="indefinite"/>
      </g>
      <circle r="15" fill="${colors[1]}" filter="url(#fxGlow)"/>
      <circle r="7" fill="#ffffff"/>
    </g>`;
  ctx.fxAppend(svg);
  ctx.anim(svg, [
    { opacity: 0, transform: "scale(.4)", transformOrigin: `${tr.cx}px ${tr.cy}px` },
    { opacity: 1, transform: "scale(1)", offset: .3 },
    { opacity: 1, transform: "scale(1.05)", offset: .8 },
    { opacity: 0, transform: "scale(1.15)" },
  ], { duration: 1100, easing: "cubic-bezier(.25,.7,.4,1)" }).onfinish = () => svg.remove();
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      const ang = (i / 14) * Math.PI * 2;
      ctx.droplet(tr.cx + Math.cos(ang) * 90, tr.cy + Math.sin(ang) * 90, colors[1], 520);
    }, ctx.T(320 + i * 40));
  }
  await ctx.wait(520);
  ctx.flashCard(targetEl, "rgba(215,245,255,.95)", 270);
  ctx.shakeCard(targetEl, 8);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 26, 120, 620, 30);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 195, 500);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "ice");
  await ctx.wait(430);
  ctx.anim(attackerEl, [{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], { duration: 280 });
  await ctx.wait(220);
}

// ---------- 花瓣风暴 ----------
function petalPath(x, y, s, rot) {
  return `M ${x} ${y} C ${x + s} ${y - s * .8}, ${x + s * 1.4} ${y + s * .3}, ${x} ${y + s} C ${x - s * 1.4} ${y + s * .3}, ${x - s} ${y - s * .8}, ${x} ${y} Z`;
}

async function petalStorm(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: "brightness(1.4) saturate(1.2)" }, { filter: "brightness(1.2)" }], { duration: 700 });
  await ctx.wait(260);
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      const sx = ar.cx + 50 + Math.random() * 30;
      const sy0 = ar.cy - 40 + Math.random() * 80;
      const ex = tr.cx - 20 + (Math.random() - .5) * 90;
      const ey = tr.cy - 20 + (Math.random() - .5) * 90;
      const s = 12 + Math.random() * 12;
      const svg = ctx.svgRoot();
      svg.innerHTML = `
        <path d="${petalPath(sx, sy0, s, 0)}" fill="${colors[1]}" opacity=".95"/>
        <path d="${petalPath(sx, sy0, s * .55, 0)}" fill="${colors[0]}" opacity=".9"/>`;
      ctx.fxAppend(svg);
      const midX = (sx + ex) / 2 + (Math.random() - .5) * 120;
      const midY = (sy0 + ey) / 2 - 70 - Math.random() * 50;
      const a = ctx.anim(svg, [
        { transform: "translate(0,0) rotate(0deg) scale(.6)", opacity: 0, transformOrigin: `${sx}px ${sy0}px` },
        { transform: `translate(${midX - sx}px, ${midY - sy0}px) rotate(${140 + Math.random() * 120}deg) scale(1)`, opacity: 1, offset: .5, transformOrigin: `${sx}px ${sy0}px` },
        { transform: `translate(${ex - sx}px, ${ey - sy0}px) rotate(${320 + Math.random() * 160}deg) scale(.86)`, opacity: 0, transformOrigin: `${sx}px ${sy0}px` },
      ], { duration: 760 + Math.random() * 240, easing: "cubic-bezier(.3,.55,.4,1)" });
      a.onfinish = () => svg.remove();
    }, ctx.T(i * 64));
  }
  await ctx.wait(620);
  ctx.flashCard(targetEl, colors[0] + "dd", 270);
  ctx.shakeCard(targetEl, 7);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const s = 9 + Math.random() * 9;
    const px = tr.cx + Math.cos(ang) * 60;
    const py = tr.cy + Math.sin(ang) * 60;
    const svg = ctx.svgRoot();
    svg.innerHTML = `<path d="${petalPath(px, py, s, 0)}" fill="${[colors[0], colors[1], "#ffffff"][i % 3]}"/>`;
    ctx.fxAppend(svg);
    const d = ctx.anim(svg, [
      { transform: "translate(0,0) rotate(0deg) scale(.4)", opacity: 0, transformOrigin: `${px}px ${py}px` },
      { transform: `translate(${Math.cos(ang) * 70}px, ${Math.sin(ang) * 70 - 26}px) rotate(200deg) scale(1)`, opacity: 1, offset: .4, transformOrigin: `${px}px ${py}px` },
      { transform: `translate(${Math.cos(ang) * 100}px, ${Math.sin(ang) * 100 + 30}px) rotate(420deg) scale(.7)`, opacity: 0, transformOrigin: `${px}px ${py}px` },
    ], { duration: 820, easing: "cubic-bezier(.25,.7,.4,1)" });
    d.onfinish = () => svg.remove();
  }
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 24, 110, 600, 18);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 175, 460);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(430);
  ctx.anim(attackerEl, [{ filter: "brightness(1.2)" }, { filter: "brightness(1)" }], { duration: 280 });
  await ctx.wait(200);
}

// ---------- 六花雪晶 ----------
async function snowflake(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [{ opacity: 1 }, { opacity: .3 }, { opacity: 1 }, { opacity: .5 }, { opacity: 1 }], { duration: 700 });
  await ctx.wait(240);
  // 音阶先飞过去
  for (let i = 0; i < 7; i++) {
    setTimeout(() => {
      const note = ctx.el("div", "", `left:${ar.cx + 70 + (tr.cx - ar.cx - 140) * (i / 7)}px;top:${ar.cy - 40 + (tr.cy - ar.cy) * (i / 7) - Math.sin(i) * 30}px;width:${7 + Math.random() * 5}px;height:${7 + Math.random() * 5}px;border-radius:50%;background:${colors[0]};box-shadow:0 0 10px ${colors[1]};opacity:0;`);
      ctx.fxAppend(note);
      ctx.anim(note, [
        { transform: "translate(0,0) scale(.4)", opacity: 0 },
        { transform: "translate(0,0) scale(1)", opacity: .95, offset: .3 },
        { transform: "translate(0,-26px) scale(.5)", opacity: 0 },
      ], { duration: 620 }).onfinish = () => note.remove();
    }, ctx.T(150 + i * 70));
  }
  await ctx.wait(560);
  const R = 64;
  let branches = "";
  for (let i = 0; i < 6; i++) {
    const ang = i * 60;
    branches += `
      <g transform="rotate(${ang})">
        <path d="M 0 0 L 0 -${R}" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
        <path d="M 0 -${R * .45} L ${R * .22} -${R * .68}" stroke="${colors[0]}" stroke-width="3" stroke-linecap="round"/>
        <path d="M 0 -${R * .45} L -${R * .22} -${R * .68}" stroke="${colors[0]}" stroke-width="3" stroke-linecap="round"/>
        <path d="M 0 -${R * .75} L ${R * .16} -${R * .9}" stroke="${colors[1]}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M 0 -${R * .75} L -${R * .16} -${R * .9}" stroke="${colors[1]}" stroke-width="2.4" stroke-linecap="round"/>
      </g>`;
  }
  const svg = ctx.svgRoot();
  svg.innerHTML = `
    <g transform="translate(${tr.cx} ${tr.cy})" filter="url(#fxGlow)">
      <g>
        ${branches}
        <circle r="12" fill="${colors[0]}"/>
        <circle r="5" fill="#ffffff"/>
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="3.2s" repeatCount="indefinite"/>
      </g>
    </g>`;
  ctx.fxAppend(svg);
  ctx.anim(svg, [
    { opacity: 0, transform: "scale(.3)", transformOrigin: `${tr.cx}px ${tr.cy}px` },
    { opacity: 1, transform: "scale(1)", offset: .4 },
    { opacity: 1, transform: "scale(1.06)", offset: .78 },
    { opacity: 0, transform: "scale(1.3)" },
  ], { duration: 1050, easing: "cubic-bezier(.25,.7,.4,1)" }).onfinish = () => svg.remove();
  for (let i = 0; i < 3; i++) {
    setTimeout(() => ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 90 + i * 40, 520), ctx.T(320 + i * 120));
  }
  await ctx.wait(560);
  ctx.flashCard(targetEl, "rgba(255,255,255,.95)", 280);
  ctx.shakeCard(targetEl, 8);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 28, 125, 650, 20);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 195, 500);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2;
    const d = ctx.el("div", "shard", `left:${tr.cx}px;top:${tr.cy}px;width:12px;height:24px;margin:-12px 0 0 -6px;background:linear-gradient(180deg, #ffffff, ${colors[1]});clip-path:polygon(50% 0%, 100% 62%, 62% 100%, 0% 62%);`);
    ctx.fxAppend(d);
    ctx.anim(d, [
      { transform: "translate(0,0) rotate(0deg) scale(.5)", opacity: .95 },
      { transform: `translate(${Math.cos(ang) * 80}px, ${Math.sin(ang) * 80}px) rotate(${Math.random() * 260 - 130}deg) scale(1)`, opacity: 0 },
    ], { duration: 620, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => d.remove();
  }
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "ice");
  await ctx.wait(430);
}

export const EXTRA_FAMILIES_4 = {
  "silk-ribbon": silkRibbon,
  "cursed-blade": cursedBlade,
  "clean-blade": cleanBlade,
  "puppet-thread": puppetThread,
  "boulder": boulder,
  "piano-keys": pianoKeys,
  "bass-pulse": bassPulse,
  "dj-equalizer": djEqualizer,
  "idol-burst": idolBurst,
  "flame-arrow": flameArrow,
  "blade-storm": bladeStorm,
  "twin-blade": twinBlade,
  "centipede": centipede,
  "water-wheel": waterWheel,
  "petal-storm": petalStorm,
  "snowflake": snowflake,
};
