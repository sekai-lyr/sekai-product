// Presentation settings and lifetime only: this module never changes duel state.
let settings = { animationSpeed: 1, effectQuality: 'auto', reduceAnimations: false };
const scopes = new Set();
const cancelListeners = new Set();
export function onMotionCancel(callback) { cancelListeners.add(callback); return () => cancelListeners.delete(callback); }
let generation = 0;
let resolveCancellation;
let cancellation = new Promise(resolve => { resolveCancellation = resolve; });
const legacyNodes = new Set(), legacyTimers = new Set(), legacyFrames = new Set();
let legacyFrame = null;
export const motionCancellation = () => cancellation;
function syncLegacyAnimations() {
    legacyFrame = null;
    for (const node of legacyNodes) {
        if (!node.isConnected) { legacyNodes.delete(node); continue; }
        if (legacyNodes.has(node.parentElement)) continue;
        for (const animation of node.getAnimations?.({ subtree: true }) || []) animation.playbackRate = getDuelMotion().speed;
    }
}
function queueLegacySync() {
    if (typeof requestAnimationFrame === 'function' && legacyFrame == null) legacyFrame = requestAnimationFrame(syncLegacyAnimations);
}
export function scheduleVisualFrame(callback) {
    const epoch = generation;
    const frame = requestAnimationFrame(time => {
        legacyFrames.delete(frame);
        if (epoch === generation) callback(time);
    });
    legacyFrames.add(frame);
    return frame;
}
export function createEffectElement(tag) {
    const node = document.createElement(tag);
    legacyNodes.add(node); queueLegacySync();
    return node;
}
// Only used by the presentation module; game/network timers stay outside this registry.
export function scheduleVisual(callback, ms, ...args) {
    const epoch = generation;
    const timer = setTimeout(() => {
        legacyTimers.delete(timer);
        if (epoch !== generation) return;
        callback(...args); queueLegacySync();
    }, motionDuration(ms));
    legacyTimers.add(timer);
    return timer;
}
export function configureDuelMotion(value = {}) {
    settings = {
        animationSpeed: [0.7, 1, 1.5, 2].includes(Number(value.animationSpeed)) ? Number(value.animationSpeed) : 1,
        effectQuality: ['auto', 'high', 'low'].includes(value.effectQuality) ? value.effectQuality : 'auto',
        reduceAnimations: !!value.reduceAnimations,
    };
    if (typeof document !== 'undefined') {
        document.body.classList.toggle('reduce-motion', settings.reduceAnimations);
        document.body.dataset.effectQuality = getDuelMotion().quality;
    }
}
export function getDuelMotion() {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 720;
    const reduced = settings.reduceAnimations || (typeof document !== 'undefined' && document.body.classList.contains('reduce-motion'))
        || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    const quality = settings.effectQuality === 'auto' ? (mobile ? 'low' : 'high') : settings.effectQuality;
    return { speed: settings.animationSpeed, quality, reduced: !!reduced, maxLayers: quality === 'low' ? 2 : 3, particleRatio: quality === 'low' ? .4 : 1 };
}
export const motionDuration = ms => ms / getDuelMotion().speed;
export const motionGeneration = () => generation;
export function motionDiagnostics() { return { active: scopes.size, legacyNodes: legacyNodes.size, legacyTimers: legacyTimers.size, legacyFrames: legacyFrames.size, generation }; }
export function cancelDuelMotion(reason = 'cancel') {
    generation++;
    resolveCancellation({ reason });
    cancellation = new Promise(resolve => { resolveCancellation = resolve; });
    for (const timer of legacyTimers) clearTimeout(timer);
    legacyTimers.clear();
    for (const frame of legacyFrames) cancelAnimationFrame(frame);
    legacyFrames.clear();
    if (legacyFrame != null) { cancelAnimationFrame(legacyFrame); legacyFrame = null; }
    for (const node of legacyNodes) { for (const a of node.getAnimations?.() || []) { a.finished?.catch(() => {}); a.cancel(); } node.remove(); }
    legacyNodes.clear();
    if (typeof document !== 'undefined') {
        for (const node of document.querySelectorAll('#battle-screen, #battlefield')) {
            for (const prop of ['--bca-camera-x', '--bca-camera-y', '--bca-camera-scale', '--bca-camera-duration']) node.style.removeProperty(prop);
            node.classList.remove('rule-camera-impact', 'level-summon-camera', 'level-summon-camera-heavy');
        }
        for (const node of document.querySelectorAll('.rule-target-pulse')) node.classList.remove('rule-target-pulse');
    }
    for (const scope of [...scopes]) scope.finish(reason);
    for (const callback of cancelListeners) callback(reason);
}
export function createMotionScope(layer, cleanup = () => {}) {
    const animations = [];
    let resolve, timer, finished = false;
    const done = new Promise(r => { resolve = r; });
    const scope = {
        animations, done,
        finish(reason = 'complete') {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            for (const animation of animations) { animation.finished?.catch(() => {}); animation.cancel(); }
            layer?.remove(); scopes.delete(scope);
            try { cleanup(reason); } finally { resolve({ reason }); }
        },
        play() {
            const speed = getDuelMotion().speed;
            for (const animation of animations) animation.playbackRate = speed;
            const end = Math.max(0, ...animations.map(a => Number(a.effect?.getComputedTiming().endTime) || 0));
            Promise.allSettled(animations.map(a => a.finished)).then(() => scope.finish());
            timer = setTimeout(() => scope.finish('timeout'), end / speed + 350);
            if (typeof document !== 'undefined' && document.hidden) scope.finish('hidden');
            return done;
        },
    };
    scopes.add(scope);
    return scope;
}
if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => cancelDuelMotion('resize'));
    window.addEventListener('pagehide', () => cancelDuelMotion('pagehide'));
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDuelMotion('hidden'); });
}
