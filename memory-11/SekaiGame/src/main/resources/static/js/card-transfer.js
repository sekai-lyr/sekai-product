import { createMotionScope, getDuelMotion } from './duel-motion.js';

// Capture both endpoints before rendering can replace the actual card slots.
export function playCardTransfer(card, html, source, destination, kind = 'play') {
    if (typeof document === 'undefined' || !source || !destination) return Promise.resolve();
    const from = source.getBoundingClientRect?.() || source;
    const to = destination.getBoundingClientRect?.() || destination;
    if (![from.left, from.top, from.width, from.height, to.left, to.top, to.width, to.height].every(Number.isFinite)
        || from.width <= 0 || to.width <= 0) return Promise.resolve();
    const motion = getDuelMotion();
    const layer = document.createElement('div');
    layer.dataset.duelMotion = kind;
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:350;contain:strict';
    const compact = window.matchMedia?.('(max-width: 720px)').matches;
    const width = compact ? Math.min(96, Math.max(64, from.width * 1.45)) : Math.min(180, Math.max(118, from.width * 1.65));
    const height = width * 1.42;
    const start = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    const end = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
    layer.dataset.motionRoute = `${start.x},${start.y}->${end.x},${end.y}`;
    const ghost = document.createElement('div');
    ghost.className = 'duel-transfer-card';
    ghost.style.cssText = `position:absolute;left:${start.x-width/2}px;top:${start.y-height/2}px;width:${width}px;height:${height}px;transform-origin:center;`;
    ghost.innerHTML = html;
    layer.appendChild(ghost); document.body.appendChild(layer);
    const scope = createMotionScope(layer);
    try {
        const dx = end.x - start.x, dy = end.y - start.y;
        const endScale = Math.min(1, to.width / width);
        const center = { x: innerWidth / 2, y: innerHeight * (compact ? .43 : .46) };
        const cx = center.x - start.x, cy = center.y - start.y;
        if (!motion.reduced && (kind === 'draw' || kind === 'play')) {
            const draw = kind === 'draw';
            const duration = compact ? 1650 : 2100;
            const direction = start.x < center.x ? -1 : 1;
            const startScale = Math.min(1, from.width / width);
            const closeScale = Math.min(compact ? 1.5 : 1.7, innerHeight * .48 / height);
            const pose = (x, y, scale, tilt = 0, turn = 0, pitch = 0) =>
                `perspective(1000px) translate3d(${x}px,${y}px,0) rotateX(${pitch}deg) rotateY(${turn}deg) rotateZ(${tilt}deg) scale(${scale})`;
            ghost.style.filter = 'drop-shadow(0 18px 24px rgba(0,0,0,.55))';
            scope.animations.push(ghost.animate([
                { transform: pose(0, 0, startScale, direction * 6, direction * 16), opacity: 0, offset: 0 },
                { transform: pose(direction * 16, -34, startScale * 1.06, direction * 13, direction * 24, -12), opacity: 1, offset: .09 },
                { transform: pose(cx - direction * 24, cy - 12, closeScale * 1.06, -direction * 8, -direction * 14, 5), opacity: 1, offset: .25 },
                { transform: pose(cx, cy, closeScale, -direction * 2, -direction * 4), opacity: 1, offset: .34 },
                { transform: pose(cx, cy - 7, closeScale * 1.025, direction * 2, direction * 4), opacity: 1, offset: .68 },
                { transform: pose(cx + direction * 20, cy + 28, closeScale * .75, direction * 10, direction * 22, -14), opacity: 1, offset: .76 },
                { transform: pose(dx, dy - (draw ? 8 : 18), endScale * 1.08, 0, 0, draw ? 0 : 16), opacity: 1, offset: .92 },
                { transform: pose(dx, dy, endScale), opacity: 1, offset: .97 },
                { transform: pose(dx, dy, endScale), opacity: 0, offset: 1 },
            ].map(frame => ({ ...frame, easing: 'cubic-bezier(.22,.7,.28,1)' })),
            { duration, fill: 'both', easing: 'linear' }));

            // All accents belong to this scope, so resize/exit cancels the whole transfer.
            const accent = card?.type === 'trap' ? '#ed83bd' : card?.type === 'spell' ? '#68dfc6' : '#f3d392';
            if (motion.quality !== 'low') {
                const shade = document.createElement('div');
                shade.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,transparent 15%,rgba(4,7,16,.48) 100%)';
                layer.insertBefore(shade, ghost);
                scope.animations.push(shade.animate([
                    { opacity: 0 }, { opacity: 1, offset: .24 },
                    { opacity: 1, offset: .68 }, { opacity: 0, offset: .94 }, { opacity: 0 },
                ], { duration, fill: 'both' }));
                for (let i = 0; i < 2; i++) {
                    const trail = document.createElement('div');
                    trail.style.cssText = `position:absolute;left:${start.x - width / 2}px;top:${start.y - height / 2}px;width:${width}px;height:${height}px;border:1px solid ${accent};border-radius:8px;box-shadow:0 0 18px ${accent}66;`;
                    layer.insertBefore(trail, ghost);
                    scope.animations.push(trail.animate([
                        { transform: pose(0, 0, startScale), opacity: 0 },
                        { transform: pose(direction * 16, -34, startScale, direction * 13), opacity: .5, offset: .12 },
                        { transform: pose(cx, cy, closeScale * (1.07 + i * .06), -direction * 8), opacity: 0, offset: .36 },
                        { transform: pose(dx, dy, endScale), opacity: 0 },
                    ], { duration, delay: i * 35, fill: 'both', easing: 'cubic-bezier(.22,.7,.28,1)' }));
                }
            }
            const landing = document.createElement('div');
            landing.style.cssText = `position:absolute;left:${end.x - to.width / 2}px;top:${end.y - Math.min(to.height, height) / 2}px;width:${to.width}px;height:${Math.min(to.height, height)}px;border:2px solid ${accent};border-radius:8px;box-sizing:border-box;box-shadow:0 0 16px ${accent}66;`;
            layer.insertBefore(landing, ghost);
            scope.animations.push(landing.animate([
                { transform: 'scale(.85)', opacity: 0 },
                { transform: 'scale(1)', opacity: .8, offset: .2 },
                { transform: `scale(${draw ? 1.15 : 1.45})`, opacity: 0 },
            ], { duration: 300, delay: duration * .92, fill: 'both', easing: 'ease-out' }));
            return scope.play();
        }
        const frames = motion.reduced
            ? [{ transform: `translate(${dx}px,${dy}px) scale(${endScale})`, opacity: .8 }, { transform: `translate(${dx}px,${dy}px) scale(${endScale})`, opacity: 0 }]
            : [{ transform: 'translate(0,0) scale(.95)', opacity: 0 },
                { transform: `translate(${cx}px,${cy}px) scale(1)`, opacity: 1, offset: compact ? .28 : .22 },
                { transform: `translate(${cx}px,${cy}px) scale(1.04)`, opacity: 1, offset: compact ? .46 : .58 },
                { transform: `translate(${dx}px,${dy}px) scale(${endScale})`, opacity: 1, offset: .9 },
                { transform: `translate(${dx}px,${dy}px) scale(${endScale})`, opacity: 0 }];
        const duration = motion.reduced ? 180 : kind === 'draw' ? (compact ? 700 : 1050) : (compact ? 760 : 1250);
        scope.animations.push(ghost.animate(frames, { duration, fill: 'both', easing: 'cubic-bezier(.2,.65,.3,1)' }));
        return scope.play();
    } catch (error) { scope.finish('error'); return Promise.reject(error); }
}
