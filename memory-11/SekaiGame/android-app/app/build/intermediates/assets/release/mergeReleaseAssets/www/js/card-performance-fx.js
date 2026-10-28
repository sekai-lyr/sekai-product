import { getDuelMotion, createMotionScope } from "./duel-motion.js";
import { getCardPerformance } from "./card-performance.js?v=13-trap-atlas";
import { getAuthoredScene, drawAuthoredScene } from "./authored-card-scenes.js?v=23-trap-atlas";

const NS = "http://www.w3.org/2000/svg";
const SHAPES = {
    fist:"M-14 10V-5L-9-10-4-6 0-14 5-12 7-5 13-8 17-3 13 12 0 16Z M-8 0L8 3",
    note:"M-7 9V-14L12-18V5 M-7-8L12-12 M-7 9C-20 3-21 21-7 16Z M12 5C0-1-1 17 12 12Z",
    wave:"M-20 8Q-9-17 1 0T22-3 M-20 17Q-5-1 7 8T22 5",
    clock:"M0-20A20 20 0 1 0 .1-20 M0-14V0L10 7 M-17 0H-13 M13 0H17",
    claw:"M-17-17Q-20 0-10 17 M-2-20Q-9 0 2 19 M13-17Q7 0 18 15",
    butterfly:"M0 4C-35-35-28 20-5 9C-22 35 0 24 0 9C22 35 28 5 6 8C37-20 10-27 0 4Z",
    bolt:"M7-23-14 4H-2L-8 23 16-7H3Z",
    eye:"M-23 0Q0-25 23 0Q0 25-23 0Z M0-8A8 8 0 1 0 .1-8",
    orbit:"M-24 0A24 9 0 1 0 24 0A24 9 0 1 0-24 0 M0-24A9 24 0 1 0 0 24A9 24 0 1 0 0-24",
    bullet:"M-22-5H6Q20-5 24 0Q20 5 6 5H-22Z M-16-5V5",
    spark:"M0-24 4-7 19-16 8-3 24 2 8 6 16 22 2 10-8 24-6 6-24 4-8-3-18-20-3-9Z",
    petal:"M0 0C-25-30 15-30 0 0C30-25 30 15 0 0C25 30-15 30 0 0C-30 25-30-15 0 0Z",
    crystal:"M0-25 14-4 8 20-8 20-14-4Z M0-25V20 M-14-4 0 3 14-4",
    thread:"M-25-12C30-28-30 28 25 12 M-25 12C30 28-30-28 25-12",
    flame:"M0-25C20-5 2 0 15-6C30 22-22 30-18 5L-6-10Q-9 8 0 7Z",
    star:"M0-24 6-6 24 0 6 6 0 24-6 6-24 0-6-6Z",
    blade:"M-25 18Q-6-10 24-22Q6 8-25 18Z",
    leaf:"M-19 20Q-25-18 22-23Q28 18-19 20Z M-19 20 17-17",
    stone:"M-22 0-9-20 12-17 24 4 8 21-13 16Z M-9-20-3 0 24 4 M-3 0-13 16",
    moon:"M9-23A25 25 0 1 0 17 20A23 23 0 0 1 9-23Z",
    shield:"M0-23 20-14 16 9 0 24-16 9-20-14Z M0-15V14 M-10-2H10",
};
export const PERFORMANCE_SHAPES = Object.keys(SHAPES);
const active = new Set();
const center = node => {
    const r = node?.getBoundingClientRect?.() || node;
    return r && Number.isFinite(r.left) && r.width > 0 && r.height > 0 ? { x:r.left+r.width/2, y:r.top+r.height/2 } : null;
};

// Viewport coordinates throughout: fixed layer lives under body, never under the scaled arena.
export function playCardPerformance(card, phase, source, target = source, materials = []) {
    const profile = getCardPerformance(card);
    if (!profile || typeof document === "undefined") return Promise.resolve();
    const from = center(source), to = center(target);
    if (!from || !to) return Promise.resolve();
    const motion = getDuelMotion();
    while (active.size >= motion.maxLayers) active.values().next().value();
    const layer = document.createElement("div");
    layer.dataset.cardPerformance = profile.id;
    layer.dataset.performancePhase = phase;
    layer.dataset.performanceTarget = target?.dataset?.instanceId || "";
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:285;overflow:hidden;contain:strict";
    document.body.appendChild(layer);
    const reduced = motion.reduced;
    const { lanes, sweep, reverse, stagger, bend } = profile.choreography;
    const viewportScale = Math.min(1, window.innerWidth / 900);
    const count = reduced ? 1 : Math.max(2, Math.round(Math.min(12, lanes + ({ N:0,R:1,SR:2,SSR:3,UR:4 }[profile.rarity] || 0)) * motion.particleRatio));
    const scope = createMotionScope(layer, () => active.delete(cleanup));
    const animations = scope.animations;
    const cleanup = () => scope.finish("budget");
    const done = scope.done;
    active.add(cleanup);
    try {
        const authored = getAuthoredScene(profile.id, phase);
        if (authored) {
            drawAuthoredScene(authored, layer, animations, from, to, reduced, {profile,phase,quality:motion.quality});
            scope.play();
            return done;
        }
        // A local pulse keeps the action readable without flashing the whole arena.
        const pulse = document.createElement("div");
        const trap = phase === "trap";
        const size = trap ? 92 : phase === "destroy" ? 72 : 110;
        pulse.style.cssText = `position:absolute;left:${to.x-size/2}px;top:${to.y-size/2}px;width:${size}px;height:${size}px;box-sizing:border-box;border:2px solid ${profile.colors[0]};border-radius:${trap ? "8px" : "50%"};box-shadow:0 0 18px ${profile.colors[0]};`;
        layer.appendChild(pulse);
        const rotation = trap ? 45 : 0;
        animations.push(pulse.animate(reduced
            ? [{ opacity:.5 }, { opacity:0 }]
            : [{ transform:`rotate(${rotation}deg) scale(.25)`,opacity:0 },
                { transform:`rotate(${rotation}deg) scale(.85)`,opacity:.8,offset:.3 },
                { transform:`rotate(${rotation}deg) scale(1.5)`,opacity:0 }],
        { duration:reduced ? 180 : 520, delay:reduced ? 0 : phase === "attack" ? 640 : 0,fill:"both",easing:"ease-out" }));
        for (let i = 0; i < count; i++) {
            const motif = i % 3 === 2 ? profile.accent : profile.motif;
            const glyph = document.createElementNS(NS, "svg");
            glyph.setAttribute("viewBox", "-30 -30 60 60");
            const path = document.createElementNS(NS, "path");
            path.setAttribute("d", SHAPES[motif]);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", profile.colors[i % profile.colors.length]);
            path.setAttribute("stroke-width", "3");
            path.setAttribute("stroke-linecap", "round");
            glyph.appendChild(path);
            glyph.style.cssText = "position:absolute;left:0;top:0;width:44px;height:44px;overflow:visible;filter:drop-shadow(0 0 5px currentColor)";
            glyph.style.color = profile.colors[1];
            layer.appendChild(glyph);
            const angle = (i / count * 360 + sweep) * Math.PI / 180;
            const radius = (45 + sweep) * viewportScale;
            let start = from;
            let end = to;
            let middle;
            if (phase === "attack") {
                const dx = to.x-from.x, dy = to.y-from.y, length = Math.hypot(dx,dy) || 1;
                const curve = (i % 2 ? -1 : 1) * bend * viewportScale * (reverse ? -1 : 1);
                middle = { x:(from.x+to.x)/2-dy/length*curve, y:(from.y+to.y)/2+dx/length*curve };
            } else if (phase === "tribute" || phase === "fusion") {
                start = center(materials[i % Math.max(1, materials.length)]) || { x:to.x+Math.cos(angle)*radius, y:to.y+Math.sin(angle)*radius };
                middle = { x:(start.x+to.x)/2+Math.sin(angle)*bend*viewportScale, y:(start.y+to.y)/2-Math.cos(angle)*bend*viewportScale };
            } else if (phase === "destroy") {
                end = { x:from.x+Math.cos(angle)*radius*1.5, y:from.y+Math.sin(angle)*radius*1.5+35*viewportScale };
                middle = { x:(from.x+end.x)/2, y:(from.y+end.y)/2-20*viewportScale };
            } else if (phase === "spell" || phase === "trap") {
                start = { x:from.x+Math.cos(angle)*radius, y:from.y+Math.sin(angle)*radius };
                const turn = phase === "trap" ? -.7 : 1.6;
                middle = { x:from.x+Math.cos(angle+turn)*radius, y:from.y+Math.sin(angle+turn)*radius };
                end = phase === "trap" ? from : { x:middle.x, y:middle.y-radius };
            } else {
                start = { x:from.x+Math.cos(angle)*radius, y:from.y+Math.sin(angle)*radius };
                middle = { x:from.x+Math.cos(angle+.8)*radius*.6, y:from.y+Math.sin(angle+.8)*radius*.6 };
            }
            const heading = phase === "attack" && ["bullet","blade","claw"].includes(motif)
                ? Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI : 0;
            const transform = (point, scale) => `translate(${point.x-22}px,${point.y-22}px) rotate(${heading}deg) scale(${scale})`;
            const frames = reduced
                ? [{ transform:transform(to,.8),opacity:.6 },{ transform:transform(to,.8),opacity:0 }]
                : [{ transform:transform(start,.5),opacity:0 },{ transform:transform(middle,1.65),opacity:1,offset:.5 },{ transform:transform(end,.7),opacity:0 }];
            animations.push(glyph.animate(frames, { duration:reduced ? 180 : phase === "attack" ? 760 : 920, delay:reduced ? 0 : (reverse ? count-i-1 : i)*stagger, easing:"cubic-bezier(.4,0,.6,1)", fill:"both" }));
        }
        scope.play();
    } catch (error) {
        cleanup();
        console.warn("[card-performance]", error);
    }
    return done;
}


