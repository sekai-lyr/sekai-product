// attack-fx-shapes2.js
// 形状库（第二批）：为不同原作招式提供"形状完全不同"的生成器。
// 每个导出函数签名：(ctx, env, profile) => Promise<void>
// ctx 由 attack-fx.js 的 makeCtx 提供。

function sinePath(x1, y1, x2, y2, amp, periods, samples) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  const n = samples || 28;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const off = Math.sin(t * Math.PI * 2 * periods) * amp * Math.sin(Math.PI * t);
    d += ` L ${(x1 + dx * t + nx * off).toFixed(1)} ${(y1 + dy * t + ny * off).toFixed(1)}`;
  }
  return d;
}

function strokeDraw(ctx, d, color, width, glow, dur, opts) {
  opts = opts || {};
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
    { strokeDashoffset: 0, opacity: 1, offset: opts.holdAt || .8 },
    { strokeDashoffset: 0, opacity: 0 },
  ], { duration: dur, easing: "cubic-bezier(.25,.7,.4,1)" });
  a.onfinish = () => svg.remove();
  return p;
}

function crystalCore(ctx, x, y, color, size) {
  const svg = ctx.svgEl("svg", { width: size * 3, height: size * 3, viewBox: "-50 -50 100 100", class: "shard", style: `left:${x}px;top:${y}px;margin:${-size * 1.5}px 0 0 ${-size * 1.5}px;` });
  svg.innerHTML = `<g filter="url(#fxGlow)"><circle r="22" fill="${color}"/></g><circle r="13" fill="#fff" opacity=".95"/>`;
  ctx.fxAppend(svg);
  return svg;
}

// ---------- 水之呼吸：流动水带 ----------
async function waterCurrent(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 540);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: `brightness(1.3) drop-shadow(0 0 10px ${colors[1]}88)` }], { duration: 300 });
  await ctx.wait(220);
  const sx = ar.cx + 60, sy = ar.cy - 10;
  const ex = tr.cx - 10, ey = tr.cy - 10;
  strokeDraw(ctx, sinePath(sx, sy, ex, ey, 30, 1.5, 32), colors[2] + "88", 30, "url(#fxRough)", 640, { holdAt: .85 });
  strokeDraw(ctx, sinePath(sx, sy, ex, ey, 16, 1.1, 32), colors[1] + "e6", 16, "url(#fxRough)", 600);
  strokeDraw(ctx, sinePath(sx, sy, ex, ey, 38, 1.8, 32), colors[1] + "99", 8, null, 660);
  strokeDraw(ctx, sinePath(sx, sy, ex, ey, 8, .9, 32), "#ffffff", 4, null, 640);
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    setTimeout(() => {
      const px = sx + (ex - sx) * t + (Math.random() - .5) * 46;
      const py = sy + (ey - sy) * t + (Math.random() - .5) * 46;
      ctx.droplet(px, py, colors[1], 460);
    }, ctx.T(160 + i * 24));
  }
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const t = i / 10;
      ctx.spark(sx + (ex - sx) * t + (Math.random() - .5) * 30, sy + (ey - sy) * t + (Math.random() - .5) * 30, "#ffffff", 2 + Math.random() * 3, [
        { transform: "translate(0,0)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 26}px, ${-10 - Math.random() * 24}px) scale(.2)`, opacity: 0 },
      ], 520);
    }, ctx.T(200 + i * 34));
  }
  await ctx.wait(420);
  ctx.flashCard(targetEl, "rgba(210,240,255,.95)", 260);
  ctx.shakeCard(targetEl, 7);
  for (let i = 0; i < 14; i++) ctx.droplet(tr.cx + (Math.random() - .5) * 70, tr.cy + (Math.random() - .5) * 70, colors[1], 480);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 20, 110, 600, 30);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 170, 450);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "ice");
  await ctx.wait(400);
  ctx.anim(attackerEl, [{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], { duration: 300 });
  await ctx.wait(260);
}

// ---------- 风之呼吸：多段风刃 ----------
async function windSlash(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 160) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 500);
  await ctx.wait(180);
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${dashX}px)` }], { duration: 260, easing: "cubic-bezier(.3,.75,.35,.95)" });
  for (let i = 0; i < 7; i++) {
    const f = i / 7;
    setTimeout(() => ctx.leafStreak(ar.cx + dashX * f, ar.cy + 18 + Math.sin(f * Math.PI) * -14, colors[1], -18 + Math.random() * 36, 420), ctx.T(80 + i * 24));
  }
  await ctx.wait(270);
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * 26;
    setTimeout(() => {
      ctx.bladeSvg(
        tr.cx - 210 + off * .4, tr.cy - 150 + off,
        tr.cx + 60 + off * .4, tr.cy + 120 + off,
        -120, 9 + (3 - Math.abs(i - 1.5)) * 2, colors, { duration: 520 }
      );
    }, ctx.T(i * 70));
  }
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      ctx.leafStreak(tr.cx - 120 + Math.random() * 200, tr.cy - 110 + Math.random() * 200, colors[0], Math.random() * 360, 420);
    }, ctx.T(220 + i * 26));
  }
  await ctx.wait(360);
  ctx.flashCard(targetEl, colors[0] + "dd", 240);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, colors, 22, 100, 560, 16);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 155, 430);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(380);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px)` }, { transform: "translateX(0)" }], { duration: 320, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(320);
}

// ---------- 霞之呼吸：雾幕 ----------
async function mistVeil(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [{ opacity: 1 }, { opacity: .25 }, { opacity: 1 }, { opacity: .4 }, { opacity: 1 }], { duration: 700 });
  await ctx.wait(240);
  for (let i = 0; i < 5; i++) {
    const fog = ctx.el("div", "", "");
    fog.style.cssText = `position:absolute;left:${ar.cx + 40 + i * 40}px;top:${ar.cy - 90 + (i % 3) * 60}px;width:${180 + i * 30}px;height:${90 + i * 16}px;z-index:7;pointer-events:none;border-radius:50%;background:radial-gradient(circle at 45% 45%, rgba(245,252,255,.75), rgba(200,225,255,.35) 55%, transparent 78%);filter:blur(6px);opacity:0;`;
    ctx.fxAppend(fog);
    ctx.anim(fog, [
      { transform: "translate(0,0) scale(.7)", opacity: 0 },
      { transform: `translate(${(tr.cx - ar.cx) * .5}px, ${(tr.cy - ar.cy) * .5 + Math.sin(i) * 30}px) scale(1)`, opacity: .95, offset: .45 },
      { transform: `translate(${tr.cx - ar.cx - 60}px, ${tr.cy - ar.cy + (Math.random() - .5) * 50}px) scale(1.15)`, opacity: 0 },
    ], { duration: 900 + i * 90, easing: "cubic-bezier(.3,.5,.4,1)" }).onfinish = () => fog.remove();
  }
  await ctx.wait(620);
  ctx.bladeSvg(tr.cx - 190, tr.cy - 160, tr.cx + 70, tr.cy + 130, -128, 12, colors, { duration: 520 });
  await ctx.wait(220);
  ctx.flashCard(targetEl, "rgba(250,255,255,.95)", 280);
  ctx.shakeCard(targetEl, 6);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 24, 110, 620, 8);
  ctx.ring(tr.cx, tr.cy, "rgba(240,250,255,.9)", 170, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(400);
}

// ---------- 蛇之呼吸：蜿蜒蛇行 ----------
async function serpentStrike(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 180) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 500);
  await ctx.wait(180);
  ctx.anim(attackerEl, [{ transform: "translateX(0) rotate(0)" }, { transform: `translateX(${dashX}px) rotate(-4deg)` }], { duration: 280, easing: "cubic-bezier(.3,.72,.35,.95)" });
  await ctx.wait(260);
  const sx = ar.cx + dashX + 40, sy = ar.cy;
  const ex = tr.cx + 10, ey = tr.cy + 10;
  const d1 = sinePath(sx, sy, ex, ey, 54, 1.35, 34);
  strokeDraw(ctx, d1, colors[2] + "cc", 20, "url(#fxRough)", 560);
  strokeDraw(ctx, d1, colors[1], 11, null, 540);
  strokeDraw(ctx, sinePath(sx, sy, ex, ey, 40, 1.6, 34), "#ffffff", 3.5, null, 560);
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const t = i / 10;
      const px = sx + (ex - sx) * t + Math.sin(t * Math.PI * 2 * 1.35) * 54;
      const py = sy + (ey - sy) * t;
      ctx.spark(px, py, colors[1], 2 + Math.random() * 3, [
        { transform: "translate(0,0)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 30}px, ${-16 - Math.random() * 18}px) scale(.2)`, opacity: 0 },
      ], 520);
    }, ctx.T(170 + i * 32));
  }
  await ctx.wait(360);
  ctx.flashCard(targetEl, colors[0] + "e6", 260);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, colors, 22, 110, 580, 18);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 160, 440);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(380);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px) rotate(-4deg)` }, { transform: "translateX(0) rotate(0)" }], { duration: 320, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(300);
}

// ---------- 月之呼吸：月牙 ----------
function crescentPath(cx, cy, r, thick, rot) {
  const a1 = (rot - 78) * Math.PI / 180;
  const a2 = (rot + 78) * Math.PI / 180;
  const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
  const ri = r + thick;
  const x1i = cx + Math.cos(a1) * ri, y1i = cy + Math.sin(a1) * ri;
  const x2i = cx + Math.cos(a2) * ri, y2i = cy + Math.sin(a2) * ri;
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${x2i} ${y2i} A ${ri} ${ri} 0 0 0 ${x1i} ${y1i} Z`;
}

async function moonCrescent(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "violet");
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: `brightness(1.4) drop-shadow(0 0 12px ${colors[1]}99)` }], { duration: 420 });
  await ctx.wait(260);
  const tint = ctx.el("div", "domain-tint", `left:${tr.cx - 220}px;top:${tr.cy - 180}px;width:440px;height:360px;z-index:6;pointer-events:none;background:radial-gradient(circle at 50% 50%, rgba(10,26,30,.55) 0%, rgba(4,10,14,.6) 60%, transparent 85%);`);
  ctx.fxAppend(tint);
  ctx.anim(tint, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1500 }).onfinish = () => tint.remove();
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const svg = ctx.svgRoot();
      const rot = -40 + i * 40 + (Math.random() - .5) * 20;
      const d = crescentPath(tr.cx + (i - 1) * 30, tr.cy + (i - 1) * 24, 96 + i * 14, 26, rot);
      svg.innerHTML = `
        <path d="${d}" fill="${colors[2]}55" filter="url(#fxRough)"/>
        <path d="${crescentPath(tr.cx + (i - 1) * 30, tr.cy + (i - 1) * 24, 96 + i * 14, 16, rot)}" fill="${colors[1]}" filter="url(#fxRough)"/>
        <path d="${crescentPath(tr.cx + (i - 1) * 30, tr.cy + (i - 1) * 24, 96 + i * 14, 6, rot)}" fill="#eafff8"/>`;
      ctx.fxAppend(svg);
      const a = ctx.anim(svg, [
        { opacity: 0, transform: "scale(1.2) rotate(8deg)", transformOrigin: "50% 50%" },
        { opacity: 1, transform: "scale(1) rotate(0deg)", offset: .3 },
        { opacity: 1, offset: .75 },
        { opacity: 0, transform: "scale(1.04) rotate(-3deg)" },
      ], { duration: 620, easing: "cubic-bezier(.25,.7,.4,1)" });
      a.onfinish = () => svg.remove();
      ctx.shakeCard(targetEl, 4);
    }, ctx.T(180 + i * 110));
  }
  await ctx.wait(560);
  ctx.flashCard(targetEl, colors[0] + "e6", 280);
  ctx.shakeCard(targetEl, 9);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#eafff8"], 26, 120, 620, 14);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 180, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(420);
  ctx.anim(attackerEl, [{ filter: "brightness(1.4)" }, { filter: "brightness(1)" }], { duration: 300 });
  await ctx.wait(240);
}

// ---------- 岩之呼吸 / 血棘：岩刺 ----------
async function rockSpikes(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  ctx.anim(attackerEl, [{ transform: "translateY(0)" }, { transform: "translateY(-6px)" }, { transform: "translateY(0)" }], { duration: 300 });
  await ctx.wait(260);
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const bx = tr.cx - 120 + i * 60 + (Math.random() - .5) * 20;
      const h = 130 + Math.random() * 90;
      const w = 40 + Math.random() * 26;
      const tilt = (Math.random() - .5) * 30;
      const svg = ctx.svgRoot();
      const d = `M ${bx - w / 2} ${tr.cy + 130} L ${bx + tilt} ${tr.cy + 130 - h} L ${bx + w / 2} ${tr.cy + 130} Z`;
      const dLight = `M ${bx - w / 2} ${tr.cy + 130} L ${bx + tilt} ${tr.cy + 130 - h} L ${bx} ${tr.cy + 130 - h * .45} Z`;
      svg.innerHTML = `
        <path d="${d}" fill="${colors[2]}" filter="url(#fxRough)"/>
        <path d="${dLight}" fill="${colors[1]}"/>
        <path d="${d}" fill="none" stroke="${colors[0]}" stroke-width="1.6" opacity=".85"/>`;
      ctx.fxAppend(svg);
      const a = ctx.anim(svg, [
        { transform: `translateY(${h * .9}px)`, opacity: 0 },
        { transform: "translateY(0)", opacity: 1, offset: .45 },
        { opacity: 1, offset: .8 },
        { opacity: 0 },
      ], { duration: 700, easing: "cubic-bezier(.2,.75,.35,1)" });
      a.onfinish = () => svg.remove();
      ctx.spark(bx, tr.cy + 130, colors[0], 4 + Math.random() * 4, [
        { transform: "translate(0,0) scale(1)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 60}px, ${-30 - Math.random() * 40}px) scale(.2)`, opacity: 0 },
      ], 560);
    }, ctx.T(140 + i * 90));
  }
  await ctx.wait(680);
  ctx.flashCard(targetEl, colors[0] + "dd", 280);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy + 40, colors, 28, 130, 640, 30);
  ctx.ring(tr.cx, tr.cy + 60, colors[1] + "cc", 190, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(430);
}

// ---------- 恋之呼吸：心形鞭 ----------
function heartD(x, y, s) {
  return `M ${x} ${y + s * .3} C ${x - s} ${y - s * .5}, ${x - s * 1.3} ${y + s * .7}, ${x - s * .45} ${y + s * 1.25} C ${x - s * .15} ${y + s * 1.5}, ${x} ${y + s * 1.7}, ${x} ${y + s * 1.9} C ${x} ${y + s * 1.7}, ${x + s * .15} ${y + s * 1.5}, ${x + s * .45} ${y + s * 1.25} C ${x + s * 1.3} ${y + s * .7}, ${x + s} ${y - s * .5}, ${x} ${y + s * .3} Z`;
}

async function heartWhip(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  await ctx.wait(200);
  const sx = ar.cx + 60, sy = ar.cy + 10;
  const ex = tr.cx - 10, ey = tr.cy + 6;
  const d = sinePath(sx, sy, ex, ey, 60, 1.1, 34);
  strokeDraw(ctx, d, colors[2] + "cc", 18, "url(#fxRough)", 600, { holdAt: .85 });
  strokeDraw(ctx, sinePath(sx, sy, ex, ey, 44, 1.3, 34), colors[0], 8, null, 620, { holdAt: .85 });
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const t = (i + .5) / 5;
      const hx = sx + (ex - sx) * t + Math.sin(t * Math.PI * 2 * 1.1) * 60;
      const hy = sy + (ey - sy) * t;
      const svg = ctx.svgRoot();
      svg.innerHTML = `<path d="${heartD(hx, hy, 16)}" fill="${colors[1]}" filter="url(#fxGlow)"/><path d="${heartD(hx, hy, 10)}" fill="${colors[0]}"/>`;
      ctx.fxAppend(svg);
      const a = ctx.anim(svg, [
        { opacity: 0, transform: "scale(.4)", transformOrigin: `${hx}px ${hy}px` },
        { opacity: 1, transform: "scale(1.1)", offset: .4 },
        { opacity: 1, transform: `translateY(-14px) scale(1)`, offset: .8 },
        { opacity: 0, transform: "translateY(-26px) scale(.9)" },
      ], { duration: 820 });
      a.onfinish = () => svg.remove();
    }, ctx.T(220 + i * 110));
  }
  await ctx.wait(560);
  ctx.flashCard(targetEl, colors[0] + "e6", 260);
  ctx.shakeCard(targetEl, 6);
  for (let i = 0; i < 8; i++) {
    const hx = tr.cx + (Math.random() - .5) * 90;
    const hy = tr.cy + (Math.random() - .5) * 90;
    const svg = ctx.svgRoot();
    svg.innerHTML = `<path d="${heartD(hx, hy, 12 + Math.random() * 6)}" fill="${colors[1]}" filter="url(#fxGlow)"/>`;
    ctx.fxAppend(svg);
    const a = ctx.anim(svg, [
      { opacity: 0, transform: "scale(.4)", transformOrigin: `${hx}px ${hy}px` },
      { opacity: 1, transform: "scale(1)", offset: .3 },
      { opacity: 0, transform: "translateY(-40px) scale(.8)" },
    ], { duration: 900 + Math.random() * 300 });
    a.onfinish = () => svg.remove();
  }
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 20, 110, 600, 10);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 160, 450);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(420);
}

// ---------- 兽之呼吸：爪痕 ----------
async function clawGash(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 150) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 480);
  await ctx.wait(160);
  ctx.anim(attackerEl, [{ transform: "translateX(0) scale(1)" }, { transform: `translateX(${dashX}px) scale(1.06)` }], { duration: 240, easing: "cubic-bezier(.25,.8,.3,1)" });
  await ctx.wait(220);
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const off = (i - 1) * 26;
      ctx.bladeSvg(
        tr.cx - 150 + off * .5, tr.cy - 130 + off,
        tr.cx + 90 + off * .5, tr.cy + 110 + off,
        -115, 13, colors, { duration: 480 }
      );
    }, ctx.T(i * 80));
  }
  await ctx.wait(300);
  ctx.flashCard(targetEl, colors[0] + "dd", 240);
  ctx.shakeCard(targetEl, 8);
  ctx.burst(tr.cx, tr.cy, colors, 22, 100, 560, 18);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 155, 430);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(380);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px) scale(1.06)` }, { transform: "translateX(0) scale(1)" }], { duration: 320, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(300);
}

// ---------- 雷切 / 千鸟：聚雷突刺 ----------
async function chidoriPrick(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 150) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 500);
  await ctx.wait(180);
  const core = crystalCore(ctx, ar.cx + 84, ar.cy - 6, colors[1], 26);
  const coreAnim = ctx.anim(core, [
    { transform: "scale(.3)", opacity: 0 },
    { transform: "scale(1)", opacity: 1, offset: .5 },
    { transform: "scale(1.1)", opacity: 1 },
  ], { duration: 420 });
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const ang = Math.random() * Math.PI * 2;
      const r1 = 20 + Math.random() * 30;
      ctx.boltSvg(ar.cx + 84, ar.cy - 6, ar.cx + 84 + Math.cos(ang) * r1, ar.cy - 6 + Math.sin(ang) * r1, colors, (i * 31 + 7) % 9973);
    }, ctx.T(i * 46));
  }
  await ctx.wait(440);
  core.remove();
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${dashX}px)` }], { duration: 200, easing: "cubic-bezier(.3,.8,.3,1)" });
  await ctx.wait(210);
  ctx.boltSvg(ar.cx + dashX + 90, ar.cy, tr.cx + 40, tr.cy, colors, Date.now() % 100000);
  ctx.boltSvg(ar.cx + dashX + 70, ar.cy - 40, tr.cx + 30, tr.cy - 50, colors, Date.now() % 100000 + 7);
  ctx.flashCard(targetEl, "rgba(230,250,255,.98)", 240);
  ctx.shakeCard(targetEl, 9);
  ctx.ring(ar.cx + dashX + 120, ar.cy, colors[1] + "cc", 150, 380);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 24, 105, 540, 14);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "elec");
  await ctx.wait(400);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px)` }, { transform: "translateX(0)" }], { duration: 300, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(320);
}

// ---------- 砂：砂流葬 ----------
async function sandTide(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 520);
  await ctx.wait(180);
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    setTimeout(() => {
      const px = ar.cx + 60 + (tr.cx - ar.cx - 80) * t + (Math.random() - .5) * 60;
      const py = ar.cy + 30 + (tr.cy - ar.cy) * t + Math.sin(t * Math.PI) * -40 + (Math.random() - .5) * 40;
      ctx.spark(px, py, [colors[0], colors[1], colors[2]][i % 3], 3 + Math.random() * 6, [
        { transform: "translate(0,0) rotate(0deg)", opacity: .95 },
        { transform: `translate(${(Math.random() - .5) * 40}px, ${20 + Math.random() * 40}px) rotate(${Math.random() * 200 - 100}deg) scale(.4)`, opacity: 0 },
      ], 560 + Math.random() * 260);
    }, ctx.T(120 + i * 34));
  }
  await ctx.wait(760);
  const pillar = ctx.el("div", "", `position:absolute;left:${tr.cx - 90}px;top:${tr.cy - 30}px;width:180px;height:${tr.cy + 170}px;z-index:7;pointer-events:none;background:linear-gradient(to top, ${colors[1]}e6, ${colors[0]}cc 45%, transparent 92%);filter:url(#fxRough);border-radius:40% 40% 0 0;opacity:0;`);
  ctx.fxAppend(pillar);
  ctx.anim(pillar, [
    { transform: "scaleY(.2)", opacity: 0 },
    { transform: "scaleY(1)", opacity: .95, offset: .5 },
    { transform: "scaleY(1)", opacity: 0 },
  ], { duration: 760, easing: "cubic-bezier(.3,.7,.4,1)" }).onfinish = () => pillar.remove();
  for (let i = 0; i < 16; i++) {
    setTimeout(() => {
      ctx.spark(tr.cx + (Math.random() - .5) * 130, tr.cy + (Math.random() - .5) * 120, colors[Math.floor(Math.random() * 3)], 3 + Math.random() * 6, [
        { transform: "translate(0,0) scale(1)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 50}px, ${-20 - Math.random() * 60}px) scale(.3)`, opacity: 0 },
      ], 700);
    }, ctx.T(620 + i * 40));
  }
  await ctx.wait(340);
  ctx.flashCard(targetEl, colors[0] + "dd", 280);
  ctx.shakeCard(targetEl, 9);
  ctx.burst(tr.cx, tr.cy, colors, 28, 130, 640, 34);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 185, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(430);
}

// ---------- 颜料泼溅 ----------
async function paintSplash(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const paint = ["#ff6d9f", "#8fd8ff", "#ffd76b", "#b06cff", "#7fe08f"];
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 480);
  await ctx.wait(160);
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const b = ctx.el("div", "", `left:${ar.cx + 50}px;top:${ar.cy - 20 + (Math.random() - .5) * 40}px;width:${18 + Math.random() * 22}px;height:${16 + Math.random() * 20}px;z-index:7;pointer-events:none;border-radius:${40 + Math.random() * 40}% ${40 + Math.random() * 40}% ${40 + Math.random() * 40}% ${40 + Math.random() * 40}%;background:${paint[i % paint.length]};box-shadow:0 0 12px ${paint[i % paint.length]}88;`);
      ctx.fxAppend(b);
      const dx = tr.cx - ar.cx - 70 + (Math.random() - .5) * 80;
      const dy = tr.cy - ar.cy + (Math.random() - .5) * 60;
      ctx.anim(b, [
        { transform: "translate(0,0) rotate(0deg) scale(.7)", opacity: 0 },
        { transform: `translate(${dx * .5}px, ${dy * .5 - 50}px) rotate(180deg) scale(1)`, opacity: 1, offset: .5 },
        { transform: `translate(${dx}px, ${dy}px) rotate(400deg) scale(${1.4 + Math.random() * .8})`, opacity: 0 },
      ], { duration: 720 + Math.random() * 220, easing: "cubic-bezier(.3,.55,.4,1)" }).onfinish = () => b.remove();
    }, ctx.T(i * 80));
  }
  await ctx.wait(620);
  ctx.flashCard(targetEl, "rgba(255,230,250,.92)", 280);
  ctx.shakeCard(targetEl, 7);
  for (let i = 0; i < 7; i++) {
    const size = 26 + Math.random() * 34;
    const bx = tr.cx + (Math.random() - .5) * 90;
    const by = tr.cy + (Math.random() - .5) * 90;
    const blob = ctx.el("div", "", `left:${bx}px;top:${by}px;width:${size}px;height:${size * .8}px;margin:${-size / 2}px 0 0 ${-size / 2}px;z-index:8;pointer-events:none;border-radius:${40 + Math.random() * 40}% ${40 + Math.random() * 40}% ${40 + Math.random() * 40}% ${40 + Math.random() * 40}%;background:${paint[i % paint.length]};opacity:0;`);
    ctx.fxAppend(blob);
    ctx.anim(blob, [
      { transform: "scale(.2)", opacity: 0 },
      { transform: "scale(1)", opacity: .95, offset: .25 },
      { transform: "scale(1)", opacity: .9, offset: .7 },
      { opacity: 0 },
    ], { duration: 900 }).onfinish = () => blob.remove();
  }
  ctx.burst(tr.cx, tr.cy, paint, 24, 110, 620, 16);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(500);
}

// ---------- 跳弹 ----------
async function ricochetRounds(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 480);
  await ctx.wait(160);
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      const midX = ar.cx + (tr.cx - ar.cx) * .5 + (i % 2 ? 120 : -120);
      const midY = ar.cy + (i % 2 ? -110 : 110);
      const d = `M ${ar.cx + 70} ${ar.cy} L ${midX} ${midY} L ${tr.cx - 6} ${tr.cy + (Math.random() - .5) * 40}`;
      strokeDraw(ctx, d, colors[1] + "e6", 3, "url(#fxGlow)", 300, { holdAt: .7 });
      ctx.spark(midX, midY, colors[0], 4 + Math.random() * 3, [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${(Math.random() - .5) * 30}px, ${(Math.random() - .5) * 30}px) scale(.2)`, opacity: 0 },
      ], 260);
    }, ctx.T(i * 140));
  }
  await ctx.wait(520);
  ctx.flashCard(targetEl, colors[0] + "e6", 240);
  ctx.shakeCard(targetEl, 6);
  ctx.burst(tr.cx, tr.cy, colors, 18, 90, 520, 20);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(380);
}

// ---------- 奶油喷涌 ----------
async function foamSpray(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 460);
  await ctx.wait(170);
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const size = 20 + Math.random() * 26;
      const p = ctx.el("div", "", `left:${ar.cx + 60}px;top:${ar.cy - 10 + (Math.random() - .5) * 30}px;width:${size}px;height:${size}px;z-index:7;pointer-events:none;border-radius:50%;background:radial-gradient(circle at 40% 35%, #ffffff, ${colors[1]} 55%, ${colors[2]}44 78%, transparent 88%);filter:blur(1px);opacity:0;`);
      ctx.fxAppend(p);
      const dx = tr.cx - ar.cx - 60 + (Math.random() - .5) * 50;
      const dy = tr.cy - ar.cy + (Math.random() - .5) * 50;
      ctx.anim(p, [
        { transform: "translate(0,0) scale(.5)", opacity: 0 },
        { transform: `translate(${dx * .5}px, ${dy * .5 - 26}px) scale(1.1)`, opacity: .95, offset: .5 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.6)`, opacity: 0 },
      ], { duration: 680 + Math.random() * 200, easing: "cubic-bezier(.3,.55,.4,1)" }).onfinish = () => p.remove();
    }, ctx.T(i * 80));
  }
  await ctx.wait(600);
  ctx.flashCard(targetEl, colors[0] + "ee", 260);
  ctx.shakeCard(targetEl, 5);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 22, 100, 620, 32);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 150, 430);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(400);
}

// ---------- 冰莲 ----------
async function iceLotus(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "cyan");
  ctx.reticle(targetEl, 520);
  await ctx.wait(200);
  const svg = ctx.svgRoot();
  let petals = "";
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * 360;
    petals += `<path d="M 0 0 C -20 -34, -14 -66, 0 -84 C 14 -66, 20 -34, 0 0 Z" fill="${colors[1]}" opacity=".9" transform="rotate(${ang})"/>`;
  }
  svg.innerHTML = `
    <g transform="translate(${tr.cx} ${tr.cy})" filter="url(#fxRough)">
      ${petals}
      <circle r="22" fill="${colors[0]}"/>
      <circle r="10" fill="#ffffff"/>
    </g>`;
  ctx.fxAppend(svg);
  const a = ctx.anim(svg, [
    { opacity: 0, transform: "scale(.3) rotate(-30deg)", transformOrigin: `${tr.cx}px ${tr.cy}px` },
    { opacity: 1, transform: "scale(1) rotate(0deg)", offset: .45 },
    { opacity: 1, transform: "scale(1.06) rotate(8deg)", offset: .75 },
    { opacity: 0, transform: "scale(1.3) rotate(16deg)" },
  ], { duration: 900, easing: "cubic-bezier(.25,.7,.4,1)" });
  a.onfinish = () => svg.remove();
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      ctx.spark(tr.cx + (Math.random() - .5) * 120, tr.cy + (Math.random() - .5) * 120, colors[i % 3], 2 + Math.random() * 4, [
        { transform: "translate(0,0)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 40}px, ${(Math.random() - .5) * 40}px) scale(.2)`, opacity: 0 },
      ], 600);
    }, ctx.T(300 + i * 40));
  }
  await ctx.wait(520);
  const frostov = targetEl.querySelector(".frostov");
  if (frostov) ctx.anim(frostov, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 900 });
  ctx.flashCard(targetEl, "rgba(220,245,255,.95)", 280);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 28, 120, 640, 22);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 185, 490);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "ice");
  await ctx.wait(430);
}

// ---------- 日轮（日之呼吸 大日轮） ----------
async function sunDisk(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 540);
  ctx.anim(attackerEl, [
    { filter: "brightness(1)" },
    { filter: `brightness(1.6) drop-shadow(0 0 16px ${colors[1]}cc)`, offset: .5 },
    { filter: "brightness(1.4)" },
  ], { duration: 800 });
  await ctx.wait(420);
  const svg = ctx.svgRoot();
  let tongues = "";
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * 360;
    const len = 108 + Math.random() * 40;
    tongues += `<path d="M 0 -96 C -12 -${len - 24}, -10 -${len}, 0 -${len - 6} C 10 -${len}, 12 -${len - 24}, 0 -96 Z" fill="${colors[1]}" opacity=".92" transform="rotate(${ang})"/>`;
  }
  svg.innerHTML = `
    <g transform="translate(${tr.cx} ${tr.cy})" filter="url(#fxRough)">
      ${tongues}
      <circle r="96" fill="${colors[2]}66" filter="url(#fxRoughSoft)"/>
      <circle r="88" fill="${colors[1]}"/>
      <circle r="58" fill="${colors[0]}"/>
      <circle r="30" fill="#fff8dc"/>
      <circle r="14" fill="#fffdf0"/>
    </g>`;
  ctx.fxAppend(svg);
  const a = ctx.anim(svg, [
    { opacity: 0, transform: "scale(.4) rotate(-24deg)", transformOrigin: `${tr.cx}px ${tr.cy}px` },
    { opacity: 1, transform: "scale(1) rotate(0deg)", offset: .4 },
    { opacity: 1, transform: "scale(1.08) rotate(26deg)", offset: .78 },
    { opacity: 0, transform: "scale(1.3) rotate(46deg)" },
  ], { duration: 1250, easing: "cubic-bezier(.3,.6,.4,1)" });
  a.onfinish = () => svg.remove();
  ctx.emberCloud(tr.cx, tr.cy, 20, 150, 900, colors);
  await ctx.wait(620);
  ctx.flashCard(targetEl, "rgba(255,230,180,.98)", 300);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 30, 140, 680, 22);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 210, 520);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "fire");
  await ctx.wait(460);
  ctx.anim(attackerEl, [{ filter: "brightness(1.4)" }, { filter: "brightness(1)" }], { duration: 300 });
  await ctx.wait(240);
}

// ---------- 超电磁炮 ----------
async function railgun(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  await ctx.wait(490);
  const L0 = ctx.proj ? ctx.proj(attackerEl, targetEl, 86) : { sx: ar.cx + 86, sy: ar.cy - 6 };
  const coin = crystalCore(ctx, L0.sx, L0.sy, colors[1], 22);
  const coinAnim = ctx.anim(coin, [
    { transform: "scale(.3)", opacity: 0 },
    { transform: "scale(1)", opacity: 1, offset: .5 },
    { transform: "scale(.7)", opacity: 1 },
  ], { duration: 520 });
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const ang = Math.random() * Math.PI * 2;
      const r1 = 16 + Math.random() * 30;
      ctx.boltSvg(L0.sx, L0.sy, L0.sx + Math.cos(ang) * r1, L0.sy + Math.sin(ang) * r1, ["#ffffff", "#5ad8ff"], (i * 37 + 11) % 9973);
    }, ctx.T(i * 44));
  }
  await ctx.wait(520);
  coin.remove();
  const L = ctx.proj ? ctx.proj(attackerEl, targetEl, 96) : { sx: ar.cx + 96, sy: ar.cy - 6, ex: tr.cx, ey: tr.cy, ux: 1, uy: 0 };
  const len = Math.hypot(L.dx, L.dy);
  const beamWrap = ctx.el("div", "orb", `left:${L.sx}px;top:${L.sy}px;width:0;height:0;transform:rotate(${L.ang}rad);`);
  ctx.fxAppend(beamWrap);
  const beam = ctx.el("div", "railgun-beam", `left:0;top:-5px;width:${len}px;height:10px;transform-origin:0 50%;background:linear-gradient(90deg, rgba(255,255,255,.2), ${colors[0]} 25%, #fff 55%, ${colors[1]} 82%, transparent);border-radius:999px;box-shadow:0 0 24px ${colors[1]}cc, 0 0 60px ${colors[1]}66;`);
  beamWrap.appendChild(beam);
  ctx.anim(beam, [
    { transform: "scaleX(0)", opacity: 0 },
    { transform: "scaleX(1)", opacity: 1, offset: .5 },
    { transform: "scaleX(1)", opacity: 0 },
  ], { duration: 300, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => beamWrap.remove();
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const r = ctx.el("div", "ring", `left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;border-color:${colors[1]}cc;box-shadow:0 0 12px ${colors[1]}aa;`);
      beamWrap.appendChild(r);
      ctx.anim(r, [
        { transform: `translateX(${len * .2}px) scale(.4)`, opacity: .9 },
        { transform: `translateX(${len * .9}px) scale(1.5)`, opacity: 0 },
      ], { duration: 260, easing: "linear" }).onfinish = () => r.remove();
    }, ctx.T(i * 70));
  }
  ctx.boltSvg(L.sx + (L.ux || 1) * 40, L.sy + (L.uy || 0) * 40, L.ex, L.ey, ["#ffffff", colors[1]], 4211);
  await ctx.wait(180);
  ctx.flashCard(targetEl, "rgba(255,255,240,.98)", 260);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 28, 130, 620, 20);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 185, 470);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "elec");
  await ctx.wait(420);
}

// ---------- 圣光柱 ----------
async function holyPillar(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: `brightness(1.5) drop-shadow(0 0 14px ${colors[0]}aa)` }, { filter: "brightness(1.2)" }], { duration: 800 });
  await ctx.wait(360);
  const pillar = ctx.el("div", "holy-pillar", `left:${tr.cx - 95}px;top:0px;width:190px;height:${tr.cy + 60}px;background:linear-gradient(to bottom, rgba(255,255,255,.15), ${colors[0]}77 40%, ${colors[1]}aa 75%, #fff);transform-origin:50% 100%;opacity:0;`);
  ctx.fxAppend(pillar);
  ctx.anim(pillar, [
    { transform: "scaleY(0) scaleX(1.6)", opacity: 0 },
    { transform: "scaleY(1) scaleX(1)", opacity: .95, offset: .45 },
    { transform: "scaleY(1) scaleX(1)", opacity: .9, offset: .8 },
    { transform: "scaleY(1) scaleX(1.2)", opacity: 0 },
  ], { duration: 1100, easing: "cubic-bezier(.3,.6,.35,1)" }).onfinish = () => pillar.remove();
  ctx.ring(tr.cx, tr.cy, colors[0] + "e6", 210, 620);
  ctx.ring(tr.cx, tr.cy + 30, colors[1] + "cc", 150, 540, 120);
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      const fx0 = tr.cx - 90 + Math.random() * 180;
      const fy0 = tr.cy - 160 + Math.random() * 60;
      ctx.spark(fx0, fy0, [colors[0], colors[1], "#ffffff"][i % 3], 3 + Math.random() * 5, [
        { transform: "translate(0,0) rotate(0deg)", opacity: .95 },
        { transform: `translate(${(Math.random() - .5) * 40}px, ${90 + Math.random() * 90}px) rotate(${Math.random() * 260 - 130}deg) scale(.7)`, opacity: 0 },
      ], 900 + Math.random() * 300);
    }, ctx.T(320 + i * 60));
  }
  await ctx.wait(560);
  ctx.flashCard(targetEl, "rgba(255,250,220,.98)", 300);
  ctx.shakeCard(targetEl, 8);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 30, 130, 680, 14);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(450);
  ctx.anim(attackerEl, [{ filter: "brightness(1.2)" }, { filter: "brightness(1)" }], { duration: 300 });
  await ctx.wait(220);
}

// ---------- 誓约黄金光（Excalibur） ----------
async function goldBeam(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [
    { filter: "brightness(1)" },
    { filter: `brightness(1.7) drop-shadow(0 0 18px ${colors[0]}cc)`, offset: .5 },
    { filter: "brightness(1.4)" },
  ], { duration: 900 });
  await ctx.wait(490);
  const L = ctx.proj ? ctx.proj(attackerEl, targetEl, 30) : { sx: ar.cx + 90, sy: ar.cy - 6, ex: tr.cx, ey: tr.cy, dx: tr.cx - ar.cx - 90, dy: tr.cy - ar.cy, px: 0, py: 1, ux: 1, uy: 0 };
  const len = Math.hypot(L.dx, L.dy);
  const beamWrap = ctx.el("div", "orb", `left:${L.sx}px;top:${L.sy}px;width:0;height:0;transform:rotate(${L.ang}rad);`);
  ctx.fxAppend(beamWrap);
  const beam = ctx.el("div", "gold-beam", `left:0;top:-23px;width:${len}px;height:46px;transform-origin:0 50%;background:linear-gradient(90deg, rgba(255,255,255,.25), ${colors[1]} 30%, #fff 60%, ${colors[1]} 85%, transparent);border-radius:999px;box-shadow:0 0 30px ${colors[0]}e6, 0 0 80px ${colors[1]}88, inset 0 0 18px ${colors[0]};`);
  beamWrap.appendChild(beam);
  ctx.anim(beam, [
    { transform: "scaleX(0) scaleY(.5)", opacity: 0 },
    { transform: "scaleX(1) scaleY(1)", opacity: 1, offset: .45 },
    { transform: "scaleX(1) scaleY(1.1)", opacity: 1, offset: .8 },
    { transform: "scaleX(1) scaleY(1.2)", opacity: 0 },
  ], { duration: 760, easing: "cubic-bezier(.25,.7,.35,1)" }).onfinish = () => beamWrap.remove();
  const mx = L.sx + L.dx * .5, my = L.sy + L.dy * .5;
  const svg = ctx.svgRoot();
  svg.innerHTML = `
    <path d="M ${L.sx + L.px * 40} ${L.sy + L.py * 40} Q ${mx + L.px * 120} ${my + L.py * 120} ${L.ex + L.px * 60} ${L.ey + L.py * 60}" fill="none" stroke="${colors[0]}cc" stroke-width="7" filter="url(#fxRough)"/>
    <path d="M ${L.sx - L.px * 40} ${L.sy - L.py * 40} Q ${mx - L.px * 120} ${my - L.py * 120} ${L.ex - L.px * 60} ${L.ey - L.py * 60}" fill="none" stroke="${colors[0]}cc" stroke-width="7" filter="url(#fxRough)"/>
    <path d="M ${L.sx + L.px * 30} ${L.sy + L.py * 30} Q ${mx + L.px * 88} ${my + L.py * 88} ${L.ex + L.px * 44} ${L.ey + L.py * 44}" fill="none" stroke="#fff8dc" stroke-width="2.5"/>
    <path d="M ${L.sx - L.px * 30} ${L.sy - L.py * 30} Q ${mx - L.px * 88} ${my - L.py * 88} ${L.ex - L.px * 44} ${L.ey - L.py * 44}" fill="none" stroke="#fff8dc" stroke-width="2.5"/>`;
  ctx.fxAppend(svg);
  ctx.anim(svg, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 820 }).onfinish = () => svg.remove();
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      const f = i / 14;
      ctx.spark(L.sx + L.dx * f, L.sy + L.dy * f + (Math.random() - .5) * 44, [colors[0], colors[1], "#fff"][i % 3], 2.5 + Math.random() * 4, [
        { transform: "translate(0,0)", opacity: .95 },
        { transform: `translate(${(Math.random() - .5) * 36}px, ${(Math.random() - .5) * 36}px) scale(.2)`, opacity: 0 },
      ], 520);
    }, ctx.T(180 + i * 34));
  }
  await ctx.wait(520);
  ctx.flashCard(targetEl, "rgba(255,245,210,.98)", 320);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 32, 140, 700, 20);
  ctx.ring(tr.cx, tr.cy, colors[0] + "e6", 210, 520);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 160, 460, 90);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(470);
  ctx.anim(attackerEl, [{ filter: "brightness(1.4)" }, { filter: "brightness(1)" }], { duration: 300 });
  await ctx.wait(220);
}

// ---------- 写轮眼幻术 ----------
async function genjutsuEye(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "violet");
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: "brightness(1.3) saturate(1.4)" }, { filter: "brightness(1)" }], { duration: 900 });
  await ctx.wait(280);
  const tint = ctx.el("div", "domain-tint", `left:${tr.cx - 230}px;top:${tr.cy - 190}px;width:460px;height:380px;z-index:6;pointer-events:none;background:radial-gradient(circle at 50% 50%, rgba(120,10,20,.55) 0%, rgba(20,4,8,.75) 60%, transparent 88%);`);
  ctx.fxAppend(tint);
  ctx.anim(tint, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1800 }).onfinish = () => tint.remove();
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const cx0 = tr.cx - 180 + Math.random() * 200;
      const cy0 = tr.cy - 170 + Math.random() * 90;
      const svg = ctx.svgRoot();
      svg.innerHTML = `<path d="M ${cx0 - 26} ${cy0} Q ${cx0 - 10} ${cy0 - 22} ${cx0} ${cy0 - 4} Q ${cx0 + 10} ${cy0 - 22} ${cx0 + 26} ${cy0}" fill="none" stroke="#16060c" stroke-width="4.5" stroke-linecap="round"/>`;
      ctx.fxAppend(svg);
      const a = ctx.anim(svg, [
        { transform: "translate(0,0) scaleY(1)", opacity: 0 },
        { transform: "translate(30px, -14px) scaleY(.6)", opacity: .95, offset: .35 },
        { transform: "translate(90px, 10px) scaleY(1.1)", opacity: .95, offset: .7 },
        { transform: "translate(150px, -8px) scaleY(.7)", opacity: 0 },
      ], { duration: 1200 + Math.random() * 400 });
      a.onfinish = () => svg.remove();
    }, ctx.T(220 + i * 160));
  }
  await ctx.wait(600);
  const svg = ctx.svgRoot();
  const eyeR = 74;
  let tomoe = "";
  for (let i = 0; i < 3; i++) {
    const ang = i * 120;
    tomoe += `<path d="M 0 -34 C 8 -40, 16 -34, 12 -24 C 9 -17, 2 -16, -2 -18 C 4 -20, 6 -26, 0 -30 Z" fill="#16060c" transform="rotate(${ang})"/>`;
  }
  svg.innerHTML = `
    <g transform="translate(${tr.cx} ${tr.cy})" filter="url(#fxGlow)">
      <circle r="${eyeR}" fill="${colors[2]}"/>
      <circle r="${eyeR - 4}" fill="${colors[1]}"/>
      <circle r="${eyeR - 4}" fill="none" stroke="#16060c" stroke-width="4"/>
      <circle r="22" fill="#16060c"/>
      ${tomoe}
    </g>`;
  ctx.fxAppend(svg);
  const eyeAnim = ctx.anim(svg, [
    { opacity: 0, transform: "scale(.4)", transformOrigin: `${tr.cx}px ${tr.cy}px` },
    { opacity: .95, transform: "scale(1)", offset: .35 },
    { opacity: .95, transform: "scale(1.06)", offset: .75 },
    { opacity: 0, transform: "scale(1.2)" },
  ], { duration: 1100, easing: "cubic-bezier(.25,.7,.4,1)" });
  eyeAnim.onfinish = () => svg.remove();
  await ctx.wait(520);
  ctx.bladeSvg(tr.cx - 190, tr.cy - 160, tr.cx + 80, tr.cy + 130, -120, 12, [colors[0], colors[1], colors[2]], { duration: 520 });
  await ctx.wait(220);
  ctx.flashCard(targetEl, colors[0] + "e6", 280);
  ctx.shakeCard(targetEl, 9);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffd9e0"], 26, 120, 640, 16);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 190, 480);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(430);
}

// ---------- 链锯 ----------
async function chainsaw(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 150) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 500);
  await ctx.wait(180);
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${dashX}px)` }], { duration: 240, easing: "cubic-bezier(.3,.78,.35,.95)" });
  for (let i = 0; i < 8; i++) {
    const f = i / 8;
    setTimeout(() => ctx.flameParticle(ar.cx + dashX * f, ar.cy + 20 + Math.sin(f * Math.PI) * -12, 4 + Math.random() * 5, [(Math.random() - .5) * 26, -20 - Math.random() * 20], 420, colors[1]), ctx.T(70 + i * 22));
  }
  await ctx.wait(250);
  let teeth = "";
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * 360;
    teeth += `<path d="M 0 -52 L 6 -70 L -6 -70 Z" fill="${colors[0]}" transform="rotate(${ang})"/>`;
  }
  const svg = ctx.svgRoot();
  svg.innerHTML = `
    <g transform="translate(${tr.cx - 40} ${tr.cy - 10})">
      <g filter="url(#fxRough)">${teeth}</g>
      <g filter="url(#fxRough)" opacity=".9">
        ${Array.from({ length: 6 }).map((_, i) => `<path d="M 0 -30 C -14 -46, -10 -66, 0 -78 C 10 -66, 14 -46, 0 -30 Z" fill="${colors[1]}" opacity=".85" transform="rotate(${i * 60})"/>`).join("")}
      </g>
      <circle r="26" fill="${colors[2]}"/>
      <circle r="12" fill="#fff4d8"/>
      <animateTransform attributeName="transform" type="rotate" from="0 ${tr.cx - 40} ${tr.cy - 10}" to="360 ${tr.cx - 40} ${tr.cy - 10}" dur="0.35s" repeatCount="indefinite"/>
    </g>`;
  ctx.fxAppend(svg);
  ctx.anim(svg, [
    { opacity: 0, transform: "scale(.5)", transformOrigin: `${tr.cx}px ${tr.cy}px` },
    { opacity: 1, transform: "scale(1.05)", offset: .4 },
    { opacity: 1, transform: "scale(1)", offset: .8 },
    { opacity: 0, transform: "scale(.9)" },
  ], { duration: 900, easing: "cubic-bezier(.25,.7,.4,1)" }).onfinish = () => svg.remove();
  for (let i = 0; i < 18; i++) {
    setTimeout(() => {
      ctx.spark(tr.cx - 30 + (Math.random() - .5) * 80, tr.cy - 10 + (Math.random() - .5) * 80, ["#ffd36b", "#ff8a3c", "#fff1c9"][i % 3], 2 + Math.random() * 4, [
        { transform: "translate(0,0)", opacity: 1 },
        { transform: `translate(${60 + Math.random() * 80}px, ${(Math.random() - .5) * 80}px) scale(.2)`, opacity: 0 },
      ], 480);
    }, ctx.T(300 + i * 40));
  }
  await ctx.wait(620);
  ctx.flashCard(targetEl, "rgba(255,220,160,.95)", 280);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, colors, 28, 130, 660, 20);
  ctx.emberCloud(tr.cx, tr.cy, 14, 120, 720, colors);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 190, 480);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "fire");
  await ctx.wait(440);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px)` }, { transform: "translateX(0)" }], { duration: 300, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(280);
}

// ---------- 解·空间斩（细斩线） ----------
async function cleaveGrid(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "violet");
  ctx.reticle(targetEl, 480);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: `brightness(1.4) contrast(1.1)` }, { filter: "brightness(1.2)" }], { duration: 900 });
  await ctx.wait(260);
  const tint = ctx.el("div", "domain-tint", `left:${tr.cx - 210}px;top:${tr.cy - 180}px;width:420px;height:360px;z-index:6;pointer-events:none;background:radial-gradient(circle at 50% 50%, rgba(80,8,16,.5) 0%, rgba(12,2,6,.72) 60%, transparent 86%);`);
  ctx.fxAppend(tint);
  ctx.anim(tint, [{ opacity: 0 }, { opacity: 1, offset: .28 }, { opacity: 1, offset: .82 }, { opacity: 0 }], { duration: 1500 }).onfinish = () => tint.remove();
  const rnd = (seed) => {
    let a = seed;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  const r = rnd(9127);
  const N = 7;
  for (let i = 0; i < N; i++) {
    setTimeout(() => {
      const x1 = tr.cx - 170 + r() * 140;
      const y1 = tr.cy - 160 + r() * 90;
      const x2 = tr.cx + 30 + r() * 140;
      const y2 = tr.cy + 20 + r() * 140;
      strokeDraw(ctx, `M ${x1} ${y1} L ${x2} ${y2}`, colors[2] + "e6", 5, "url(#fxRough)", 300, { holdAt: .6 });
      strokeDraw(ctx, `M ${x1} ${y1} L ${x2} ${y2}`, "#ff5d6b", 2, null, 320, { holdAt: .6 });
      ctx.shakeCard(targetEl, 4);
      ctx.spark((x1 + x2) / 2, (y1 + y2) / 2, "#ff8a95", 3 + Math.random() * 3, [
        { transform: "translate(0,0)", opacity: .95 },
        { transform: `translate(${(Math.random() - .5) * 40}px, ${(Math.random() - .5) * 40}px) scale(.2)`, opacity: 0 },
      ], 360);
    }, ctx.T(120 + i * 90));
  }
  await ctx.wait(N * 90 + 240);
  ctx.flashCard(targetEl, colors[0] + "e6", 280);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 28, 130, 640, 22);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 190, 480);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(430);
  ctx.anim(attackerEl, [{ filter: "brightness(1.2)" }, { filter: "brightness(1)" }], { duration: 280 });
  await ctx.wait(220);
}

export const EXTRA_FAMILIES = {
  "water-current": waterCurrent,
  "wind-slash": windSlash,
  "mist-veil": mistVeil,
  "serpent": serpentStrike,
  "moon-crescent": moonCrescent,
  "rock-spikes": rockSpikes,
  "heart-whip": heartWhip,
  "claw-gash": clawGash,
  "chidori": chidoriPrick,
  "sand-tide": sandTide,
  "paint-splash": paintSplash,
  "ricochet": ricochetRounds,
  "foam-spray": foamSpray,
  "ice-lotus": iceLotus,
  "sun-disk": sunDisk,
  "railgun": railgun,
  "holy-pillar": holyPillar,
  "gold-beam": goldBeam,
  "genjutsu-eye": genjutsuEye,
  "chainsaw": chainsaw,
  "cleave": cleaveGrid,
};
