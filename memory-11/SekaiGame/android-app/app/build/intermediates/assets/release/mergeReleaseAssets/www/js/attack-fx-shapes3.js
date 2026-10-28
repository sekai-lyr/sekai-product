// attack-fx-shapes3.js
// 形状库（第四批）：螺旋丸 / 时停连打 / 龙吐息 / 黑魔术 / 羽毛风暴 / 重炮。
// 签名：(ctx, env, profile) => Promise<void>

// ---------- 螺旋丸 ----------
async function rasengan(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 150) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 500);
  await ctx.wait(170);
  const L = ctx.proj ? ctx.proj(attackerEl, targetEl, 60) : { sx: ar.cx + 90, sy: ar.cy - 6, ex: tr.cx, ey: tr.cy };
  const orb = ctx.svgEl("svg", { width: 120, height: 120, viewBox: "-60 -60 120 120", class: "shard", style: `left:${L.sx}px;top:${L.sy}px;margin:-60px 0 0 -60px;` });
  orb.innerHTML = `
    <g filter="url(#fxGlow)"><circle r="26" fill="${colors[1]}"/></g>
    <circle r="20" fill="${colors[0]}" opacity=".95"/>
    <g>
      ${Array.from({ length: 3 }).map((_, i) => `<path d="M 0 -24 A 24 24 0 0 1 21 12" fill="none" stroke="#ffffff" stroke-width="3" opacity=".95" transform="rotate(${i * 120})"/>`).join("")}
      <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="0.4s" repeatCount="indefinite"/>
    </g>
    <circle r="8" fill="#ffffff"/>`;
  ctx.fxAppend(orb);
  const oa = ctx.anim(orb, [
    { opacity: 0, transform: "scale(.2)", transformOrigin: "50% 50%" },
    { opacity: 1, transform: "scale(1)", offset: .5 },
    { opacity: 1, transform: "scale(1.08)" },
  ], { duration: 480 });
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const ang = Math.random() * Math.PI * 2;
      ctx.spark(L.sx + Math.cos(ang) * 30, L.sy + Math.sin(ang) * 30, colors[1], 2 + Math.random() * 4, [
        { transform: "translate(0,0)", opacity: .9 },
        { transform: `translate(${-Math.cos(ang) * 40}px, ${-Math.sin(ang) * 40}px) scale(.2)`, opacity: 0 },
      ], 420);
    }, ctx.T(i * 40));
  }
  await ctx.wait(500);
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${dashX}px)` }], { duration: 230, easing: "cubic-bezier(.3,.8,.3,1)" });
  const flyX = L.ex - L.sx, flyY = L.ey - L.sy;
  ctx.anim(orb, [
    { transform: `translate(0,0) scale(1.08)` },
    { transform: `translate(${flyX}px, ${flyY}px) scale(1.25)`, offset: .9 },
    { transform: `translate(${flyX}px, ${flyY}px) scale(1.4)` },
  ], { duration: 260, easing: "cubic-bezier(.3,.8,.3,1)" });
  await ctx.wait(280);
  oa.cancel();
  orb.remove();
  ctx.flashCard(targetEl, "rgba(210,240,255,.98)", 260);
  ctx.shakeCard(targetEl, 10);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 170, 420);
  ctx.ring(tr.cx, tr.cy, "#ffffffcc", 120, 340, 60);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#ffffff"], 30, 130, 620, 16);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "ice");
  await ctx.wait(420);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px)` }, { transform: "translateX(0)" }], { duration: 300, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(300);
}

// ---------- 时停连打 ----------
async function timeStop(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  const dashX = (tr.cx - 150) - ar.cx;
  ctx.labelAbove(attackerEl, profile.label, null, dashX);
  ctx.reticle(targetEl, 460);
  await ctx.wait(160);
  const gray = ctx.el("div", "", `position:absolute;inset:0;z-index:9;pointer-events:none;background:rgba(20,20,30,.55);backdrop-filter:grayscale(.9);opacity:0;`);
  ctx.fxAppend(gray);
  ctx.anim(gray, [{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1800 }).onfinish = () => gray.remove();
  const clock = ctx.svgRoot();
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const ang = i * 30;
    ticks += `<path d="M 0 -84 L 0 -72" stroke="${colors[0]}" stroke-width="3" transform="rotate(${ang})"/>`;
  }
  clock.innerHTML = `
    <g transform="translate(${tr.cx} ${tr.cy})" filter="url(#fxGlow)">
      <circle r="86" fill="none" stroke="${colors[1]}" stroke-width="3.5"/>
      <circle r="72" fill="none" stroke="${colors[1]}88" stroke-width="1.5"/>
      ${ticks}
      <g><path d="M 0 0 L 0 -60 M 0 0 L 40 20" stroke="${colors[0]}" stroke-width="4" stroke-linecap="round"/>
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="2s" repeatCount="indefinite"/></g>
    </g>`;
  ctx.fxAppend(clock);
  const ca = ctx.anim(clock, [
    { opacity: 0, transform: "scale(1.3)", transformOrigin: `${tr.cx}px ${tr.cy}px` },
    { opacity: .95, transform: "scale(1)", offset: .2 },
    { opacity: .95, offset: .85 },
    { opacity: 0, transform: "scale(.9)" },
  ], { duration: 1700 });
  ca.onfinish = () => clock.remove();
  ctx.anim(attackerEl, [{ transform: "translateX(0)" }, { transform: `translateX(${dashX}px)` }], { duration: 200, easing: "cubic-bezier(.3,.85,.3,1)" });
  await ctx.wait(360);
  for (let i = 0; i < 7; i++) {
    setTimeout(() => {
      const ox = (Math.random() - .5) * 70;
      const oy = (Math.random() - .5) * 70;
      ctx.spark(tr.cx + ox, tr.cy + oy, i % 2 ? colors[0] : "#ffffff", 5 + Math.random() * 6, [
        { transform: "scale(.4)", opacity: 0 },
        { transform: "scale(1.6)", opacity: 1, offset: .3 },
        { transform: "scale(.2)", opacity: 0 },
      ], 180);
      ctx.shakeCard(targetEl, 4);
      if (i === 6) {
        ctx.flashCard(targetEl, colors[0] + "e6", 240);
        ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 26, 120, 600, 18);
        ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 180, 460);
      }
    }, ctx.T(120 + i * 130));
  }
  await ctx.wait(1040);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(360);
  ctx.anim(attackerEl, [{ transform: `translateX(${dashX}px)` }, { transform: "translateX(0)" }], { duration: 280, easing: "cubic-bezier(.3,.6,.3,1)" });
  await ctx.wait(280);
}

// ---------- 龙吐息 ----------
async function dragonBreath(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [
    { filter: "brightness(1)" },
    { filter: `brightness(1.5) drop-shadow(0 0 16px ${colors[1]}cc)`, offset: .5 },
    { filter: "brightness(1.4)" },
  ], { duration: 900 });
  await ctx.wait(490);
  const L0 = ctx.proj ? ctx.proj(attackerEl, targetEl, 96) : { sx: ar.cx + 96, sy: ar.cy - 6 };
  const orb = ctx.svgEl("svg", { width: 130, height: 130, viewBox: "-65 -65 130 130", class: "shard", style: `left:${L0.sx}px;top:${L0.sy}px;margin:-65px 0 0 -65px;` });
  orb.innerHTML = `
    <g filter="url(#fxGlow)"><circle r="34" fill="${colors[1]}"/></g>
    <circle r="26" fill="${colors[0]}"/>
    <circle r="13" fill="#ffffff"/>
    <g>${Array.from({ length: 6 }).map((_, i) => `<path d="M 0 -34 L ${6 - (i % 2) * 12} -48" stroke="${colors[0]}" stroke-width="3" transform="rotate(${i * 60})"/>`).join("")}</g>`;
  ctx.fxAppend(orb);
  const oa = ctx.anim(orb, [
    { opacity: 0, transform: "scale(.3)" },
    { opacity: 1, transform: "scale(1)", offset: .55 },
    { opacity: 1, transform: "scale(1.15)" },
  ], { duration: 620 });
  for (let i = 0; i < 12; i++) {
    setTimeout(() => ctx.boltSvg(L0.sx, L0.sy, L0.sx + (Math.random() - .5) * 90, L0.sy + (Math.random() - .5) * 90, [colors[0], colors[1]], (i * 53 + 17) % 9973), ctx.T(i * 42));
  }
  await ctx.wait(640);
  oa.cancel();
  const L = ctx.proj ? ctx.proj(attackerEl, targetEl, 110) : { sx: ar.cx + 110, sy: ar.cy - 6, ex: tr.cx, ey: tr.cy, dx: tr.cx - ar.cx - 110, dy: tr.cy - ar.cy };
  const len = Math.hypot(L.dx, L.dy);
  const breathWrap = ctx.el("div", "orb", `left:${L.sx}px;top:${L.sy}px;width:0;height:0;transform:rotate(${L.ang}rad);`);
  ctx.fxAppend(breathWrap);
  const breath = ctx.el("div", "railgun-beam", `left:0;top:-13px;width:${len}px;height:26px;transform-origin:0 50%;background:linear-gradient(90deg, ${colors[1]}, #fff 45%, ${colors[0]} 75%, transparent);border-radius:999px;box-shadow:0 0 26px ${colors[1]}cc, 0 0 70px ${colors[1]}66;`);
  breathWrap.appendChild(breath);
  ctx.anim(breath, [
    { transform: "scaleX(0) scaleY(.4)", opacity: 0 },
    { transform: "scaleX(1) scaleY(1)", opacity: 1, offset: .4 },
    { transform: "scaleX(1) scaleY(1.1)", opacity: 1, offset: .8 },
    { transform: "scaleX(1) scaleY(1.3)", opacity: 0 },
  ], { duration: 520, easing: "cubic-bezier(.25,.7,.35,1)" }).onfinish = () => breathWrap.remove();
  orb.remove();
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      const f = i / 14;
      ctx.spark(L.sx + L.dx * f, L.sy + L.dy * f + (Math.random() - .5) * 30, [colors[0], colors[1], "#fff"][i % 3], 3 + Math.random() * 5, [
        { transform: "translate(0,0)", opacity: .95 },
        { transform: `translate(${(Math.random() - .5) * 42}px, ${(Math.random() - .5) * 42}px) scale(.2)`, opacity: 0 },
      ], 520);
    }, ctx.T(200 + i * 30));
  }
  await ctx.wait(360);
  ctx.flashCard(targetEl, "rgba(235,250,255,.98)", 300);
  ctx.shakeCard(targetEl, 10);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 32, 140, 700, 18);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 200, 500);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "ice");
  await ctx.wait(460);
  ctx.anim(attackerEl, [{ filter: "brightness(1.4)" }, { filter: "brightness(1)" }], { duration: 300 });
  await ctx.wait(220);
}

// ---------- 黑魔术 ----------
async function darkMagic(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label, "violet");
  ctx.reticle(targetEl, 520);
  ctx.anim(attackerEl, [{ filter: "brightness(1)" }, { filter: `brightness(1.4) saturate(1.3)` }, { filter: "brightness(1.3)" }], { duration: 900 });
  await ctx.wait(490);
  const L = ctx.proj ? ctx.proj(attackerEl, targetEl, 90) : { sx: ar.cx + 90, sy: ar.cy - 6, dx: tr.cx - ar.cx - 90, dy: tr.cy - ar.cy };
  const circle = ctx.svgRoot();
  let runes = "";
  for (let i = 0; i < 16; i++) {
    const ang = i * 22.5;
    runes += `<path d="M 0 -58 L 0 -48" stroke="${colors[0]}" stroke-width="2.4" transform="rotate(${ang})"/>`;
  }
  circle.innerHTML = `
    <g transform="translate(${L.sx} ${L.sy})" filter="url(#fxGlow)">
      <circle r="56" fill="none" stroke="${colors[1]}" stroke-width="3"/>
      <circle r="42" fill="none" stroke="${colors[1]}99" stroke-width="1.6"/>
      <path d="M 0 -42 L 36 21 L -36 21 Z" fill="none" stroke="${colors[0]}" stroke-width="2.4"/>
      ${runes}
      <animateTransform attributeName="transform" type="rotate" from="0 ${L.sx} ${L.sy}" to="360 ${L.sx} ${L.sy}" dur="2.4s" repeatCount="indefinite"/>
    </g>`;
  ctx.fxAppend(circle);
  ctx.anim(circle, [{ opacity: 0, transform: "scale(.5)", transformOrigin: `${L.sx}px ${L.sy}px` }, { opacity: .95, transform: "scale(1)", offset: .35 }, { opacity: .95, offset: .8 }, { opacity: 0 }], { duration: 1400 }).onfinish = () => circle.remove();
  await ctx.wait(520);
  const orb = ctx.svgEl("svg", { width: 90, height: 90, viewBox: "-45 -45 90 90", class: "orb", style: `left:${L.sx}px;top:${L.sy}px;margin:-45px 0 0 -45px;` });
  orb.innerHTML = `<g filter="url(#fxGlow)"><circle r="24" fill="${colors[1]}"/></g><circle r="16" fill="${colors[0]}"/><circle r="7" fill="#fff"/>`;
  ctx.fxAppend(orb);
  ctx.anim(orb, [
    { transform: "translate(0,0) scale(.4)", opacity: 0 },
    { transform: "translate(0,0) scale(1)", opacity: 1, offset: .3 },
    { transform: `translate(${L.dx * .92}px, ${L.dy * .92}px) scale(1.1)`, opacity: 1 },
  ], { duration: 520, easing: "cubic-bezier(.3,.6,.4,1)" });
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const f = i / 8;
      ctx.spark(L.sx + L.dx * .92 * f, L.sy + L.dy * .92 * f, [colors[0], colors[1], "#e2c4ff"][i % 3], 2 + Math.random() * 4, [
        { transform: "translate(0,0)", opacity: .9 },
        { transform: `translate(${(Math.random() - .5) * 26}px, ${(Math.random() - .5) * 26}px) scale(.2)`, opacity: 0 },
      ], 460);
    }, ctx.T(540 + i * 34));
  }
  await ctx.wait(600);
  orb.remove();
  const implode = ctx.el("div", "ring", `left:${tr.cx}px;top:${tr.cy}px;width:220px;height:220px;margin:-110px 0 0 -110px;border-color:${colors[1]};box-shadow:0 0 26px ${colors[1]}cc, inset 0 0 26px ${colors[1]}88;`);
  ctx.fxAppend(implode);
  ctx.anim(implode, [{ transform: "scale(1)", opacity: .95 }, { transform: "scale(.1)", opacity: .3 }], { duration: 380, easing: "cubic-bezier(.5,.1,.6,1)" }).onfinish = () => implode.remove();
  ctx.flashCard(targetEl, colors[0] + "e6", 280);
  ctx.shakeCard(targetEl, 9);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 28, 120, 640, 14);
  ctx.ring(tr.cx, tr.cy, colors[1] + "e6", 190, 480, 120);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "violet");
  await ctx.wait(440);
  ctx.anim(attackerEl, [{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], { duration: 280 });
  await ctx.wait(220);
}

// ---------- 羽毛风暴 ----------
async function featherStorm(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  await ctx.wait(170);
  for (let i = 0; i < 7; i++) {
    setTimeout(() => {
      const svg = ctx.svgRoot();
      const fx0 = ar.cx + 60, fy0 = ar.cy - 30 + (Math.random() - .5) * 60;
      const txx = tr.cx - 10, tyy = tr.cy - 10 + (Math.random() - .5) * 60;
      const cx0 = (fx0 + txx) / 2 + (Math.random() - .5) * 90;
      const cy0 = (fy0 + tyy) / 2 - 50 - Math.random() * 40;
      const rot = Math.round(Math.random() * 360);
      svg.innerHTML = `<g transform="translate(${fx0} ${fy0}) rotate(${rot})" filter="url(#fxRough)">
        <path d="M 0 -16 C 10 -8, 10 8, 0 16 C -10 8, -10 -8, 0 -16 Z" fill="${colors[1]}"/>
        <path d="M 0 -14 L 0 14" stroke="#ffffff" stroke-width="1.6" opacity=".9"/>
      </g>`;
      ctx.fxAppend(svg);
      const a = ctx.anim(svg, [
        { transform: "translate(0,0) rotate(0deg)", opacity: 0 },
        { opacity: 1, offset: .15 },
        { transform: `translate(${(txx - fx0) * .5}px, ${(cy0 - fy0)}px) rotate(140deg)`, offset: .5 },
        { transform: `translate(${txx - fx0}px, ${tyy - fy0}px) rotate(320deg) scale(.7)`, opacity: 0 },
      ], { duration: 760 + Math.random() * 220, easing: "cubic-bezier(.3,.55,.4,1)" });
      a.onfinish = () => svg.remove();
    }, ctx.T(i * 80));
  }
  await ctx.wait(640);
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      ctx.bladeSvg(
        tr.cx - 170 + i * 12, tr.cy - 140 + i * 40,
        tr.cx + 70 - i * 10, tr.cy + 110 - i * 30,
        -118, 10, colors, { duration: 480 }
      );
    }, ctx.T(i * 70));
  }
  for (let i = 0; i < 10; i++) {
    setTimeout(() => ctx.leafStreak(tr.cx - 100 + Math.random() * 180, tr.cy - 100 + Math.random() * 180, colors[0], Math.random() * 360, 420), ctx.T(340 + i * 30));
  }
  await ctx.wait(360);
  ctx.flashCard(targetEl, colors[0] + "dd", 250);
  ctx.shakeCard(targetEl, 7);
  ctx.burst(tr.cx, tr.cy, colors, 22, 110, 580, 8);
  ctx.ring(tr.cx, tr.cy, colors[1] + "cc", 160, 450);
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(400);
}

// ---------- 重炮 ----------
async function cannonShot(ctx, env, profile) {
  const { attackerEl, targetEl, card } = env;
  const colors = profile.colors;
  const ar = ctx.cardRect(attackerEl);
  const tr = ctx.cardRect(targetEl);
  ctx.labelAbove(attackerEl, profile.label);
  ctx.reticle(targetEl, 500);
  await ctx.wait(170);
  const muzzle = crystalCore(ctx, ar.cx + 88, ar.cy - 6, colors[1], 24);
  const ma = ctx.anim(muzzle, [{ transform: "scale(.3)", opacity: 0 }, { transform: "scale(1)", opacity: 1, offset: .6 }, { transform: "scale(1.4)", opacity: 0 }], { duration: 460 });
  await ctx.wait(440);
  muzzle.remove();
  const startX = ar.cx + 96, startY = ar.cy - 6;
  const endX = tr.cx - 8, endY = tr.cy - 6;
  const shell = ctx.el("div", "orb", `left:${startX}px;top:${startY}px;width:34px;height:22px;margin:-11px 0 0 -17px;border-radius:40% 50% 50% 40%;background:linear-gradient(90deg, ${colors[2]}, ${colors[1]} 70%, ${colors[0]});box-shadow:0 0 18px ${colors[1]}aa;`);
  ctx.fxAppend(shell);
  ctx.anim(shell, [
    { transform: "translate(0,0)", opacity: 0 },
    { opacity: 1, offset: .1 },
    { transform: `translate(${(endX - startX) * .5}px, ${(endY - startY) * .5 - 48}px)`, offset: .5 },
    { transform: `translate(${endX - startX}px, ${endY - startY}px)`, opacity: 1 },
  ], { duration: 560, easing: "cubic-bezier(.35,.5,.4,1)" });
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      const f = i / 12;
      const px = startX + (endX - startX) * f;
      const py = startY + (endY - startY) * f - Math.sin(f * Math.PI) * 48;
      const puff = ctx.el("div", "", `left:${px}px;top:${py}px;width:${14 + Math.random() * 14}px;height:${12 + Math.random() * 10}px;margin:-8px 0 0 -8px;z-index:6;pointer-events:none;border-radius:50%;background:radial-gradient(circle, rgba(200,200,210,.55), rgba(140,140,160,.25) 60%, transparent 80%);filter:blur(3px);`);
      ctx.fxAppend(puff);
      ctx.anim(puff, [
        { transform: "scale(.5)", opacity: 0 },
        { transform: "scale(1.2)", opacity: .85, offset: .4 },
        { transform: "scale(1.8)", opacity: 0 },
      ], { duration: 620 }).onfinish = () => puff.remove();
    }, ctx.T(120 + i * 40));
  }
  await ctx.wait(580);
  shell.remove();
  ctx.flashCard(targetEl, "rgba(255,230,190,.98)", 300);
  ctx.shakeCard(targetEl, 12);
  for (let i = 0; i < 3; i++) ctx.ring(tr.cx, tr.cy, i === 0 ? colors[0] + "e6" : colors[1] + "cc", 180 + i * 60, 480 + i * 110);
  ctx.burst(tr.cx, tr.cy, [colors[0], colors[1], "#fff"], 32, 150, 700, 30);
  for (let i = 0; i < 6; i++) {
    const puff = ctx.el("div", "", `left:${tr.cx + (Math.random() - .5) * 90}px;top:${tr.cy + (Math.random() - .5) * 70}px;width:${24 + Math.random() * 20}px;height:${20 + Math.random() * 16}px;margin:-12px 0 0 -12px;z-index:6;pointer-events:none;border-radius:50%;background:radial-gradient(circle, rgba(210,205,215,.5), transparent 75%);filter:blur(4px);`);
    ctx.fxAppend(puff);
    const a = ctx.anim(puff, [
      { transform: "scale(.4)", opacity: 0 },
      { transform: "scale(1.4)", opacity: .9, offset: .35 },
      { transform: `translate(${(Math.random() - .5) * 40}px, ${-30 - Math.random() * 30}px) scale(2)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 300 });
    a.onfinish = () => puff.remove();
  }
  ctx.damageAbove(targetEl, "-" + (card.atk || 0), "");
  await ctx.wait(470);
}

export const EXTRA_FAMILIES_3 = {
  "rasengan": rasengan,
  "time-stop": timeStop,
  "dragon-breath": dragonBreath,
  "dark-magic": darkMagic,
  "feather-storm": featherStorm,
  "cannon": cannonShot,
};
