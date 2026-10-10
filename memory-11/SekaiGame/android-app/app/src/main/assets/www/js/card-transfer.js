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
