/**
 * audio.js
 * 程序化音效层（WebAudio 合成，不依赖任何音频文件）。
 *
 * 为什么这样做：项目里原本没有任何音频（assets/audio 为空、代码里 0 处音频调用），
 * 而演出层（effects.js 23 万字符）非常重——一个动作很多却没有声音的卡牌游戏，
 * 主观品质会掉一大截。合成音效不需要美术/音频素材，可控、体积极小、可按稀有度/属性
 * 变调，适合先补上"有反馈"这一层。
 *
 * 设计要点：
 * - 模块加载时**不创建 AudioContext**（浏览器要求用户手势后才能启动，Node 测试环境也没有）。
 *   首次真正播放时才懒创建，并在 suspended 状态下尝试 resume。
 * - 所有对外函数在无音频环境（Node / 无 WebAudio 的浏览器）下都是安全的空操作。
 * - 音量走一个主 GainNode，静音只改增益，不做条件分支，避免各处漏判。
 * - 开关的唯一来源是存档里的 `settings.soundEnabled`（由 main.js 在启动时回放、
 *   设置页保存时写入），模块内部不再自己持久化，避免出现两个真相。
 */

let context = null;
let masterGain = null;
let enabled = true;
let unlocked = false;

function supported() {
    return typeof globalThis.AudioContext === "function" || typeof globalThis.webkitAudioContext === "function";
}

function ensureContext() {
    if (!supported()) return null;
    if (!context) {
        const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
        try {
            context = new Ctor();
        } catch {
            return null;
        }
        masterGain = context.createGain();
        masterGain.gain.value = enabled ? 0.5 : 0;
        masterGain.connect(context.destination);
    }
    if (context.state === "suspended" && !unlocked) {
        unlocked = true;
        context.resume?.().catch?.(() => {});
    }
    return context;
}

export function isSoundEnabled() {
    return enabled;
}

export function setSoundEnabled(value) {
    enabled = Boolean(value);
    if (masterGain) masterGain.gain.value = enabled ? 0.5 : 0;
    if (enabled) ensureContext();
    return enabled;
}

export function toggleSound() {
    return setSoundEnabled(!enabled);
}

/** 一个带包络的振荡器音（用于音调类音效）。 */
function tone(ctx, { type = "sine", from, to = from, start = 0, duration = 0.15, volume = 0.3, curve = "exp" }) {
    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), now);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + Math.min(0.02, duration / 3));
    if (curve === "exp") gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    else gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
}

/** 一段带滤波的噪声（用于打击、抽卡、开包等"质感"音效）。 */
function noise(ctx, { start = 0, duration = 0.2, volume = 0.25, filterType = "bandpass", frequency = 1200, q = 0.8, sweepTo = null }) {
    const now = ctx.currentTime + start;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
        // 尾部衰减的白噪声
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, now);
    filter.Q.value = q;
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + duration + 0.02);
}

/**
 * 播放一个具名音效。
 * @param {string} name
 * @param {{pitch?: number}} options pitch 为倍率，用于按稀有度/属性变调
 */
export function playSound(name, options = {}) {
    if (!enabled) return false;
    const ctx = ensureContext();
    if (!ctx) return false;
    const pitch = Number(options.pitch) > 0 ? Number(options.pitch) : 1;
    try {
        switch (name) {
            case "uiClick":
                tone(ctx, { type: "square", from: 720 * pitch, to: 520 * pitch, duration: 0.07, volume: 0.12 });
                break;
            case "draw":
                noise(ctx, { duration: 0.16, volume: 0.14, filterType: "highpass", frequency: 900 * pitch, sweepTo: 2600 * pitch });
                break;
            case "summon":
                tone(ctx, { type: "triangle", from: 180 * pitch, to: 520 * pitch, duration: 0.3, volume: 0.22 });
                noise(ctx, { start: 0.02, duration: 0.22, volume: 0.18, filterType: "bandpass", frequency: 420 * pitch, sweepTo: 1800 * pitch });
                break;
            case "set":
                tone(ctx, { type: "triangle", from: 300 * pitch, to: 160 * pitch, duration: 0.18, volume: 0.16 });
                break;
            case "spell":
                [0, 0.06, 0.12].forEach((offset, index) => {
                    tone(ctx, { type: "sine", from: (520 + index * 220) * pitch, duration: 0.22, start: offset, volume: 0.16 });
                });
                break;
            case "trap":
                tone(ctx, { type: "sawtooth", from: 900 * pitch, to: 140 * pitch, duration: 0.35, volume: 0.2 });
                noise(ctx, { duration: 0.3, volume: 0.2, filterType: "bandpass", frequency: 2400 * pitch, sweepTo: 300, q: 1.2 });
                break;
            case "attack":
                noise(ctx, { duration: 0.12, volume: 0.3, filterType: "lowpass", frequency: 3200 * pitch, sweepTo: 400 });
                tone(ctx, { type: "square", from: 240 * pitch, to: 90 * pitch, duration: 0.16, volume: 0.2 });
                break;
            case "damage":
                tone(ctx, { type: "sine", from: 150 * pitch, to: 60 * pitch, duration: 0.3, volume: 0.32 });
                noise(ctx, { duration: 0.16, volume: 0.22, filterType: "lowpass", frequency: 900, sweepTo: 200 });
                break;
            case "destroy":
                noise(ctx, { duration: 0.42, volume: 0.3, filterType: "lowpass", frequency: 1800, sweepTo: 160 });
                tone(ctx, { type: "sawtooth", from: 220 * pitch, to: 50 * pitch, duration: 0.4, volume: 0.18 });
                break;
            case "reveal":
                [0, 0.07, 0.14, 0.21].forEach((offset, index) => {
                    tone(ctx, { type: "triangle", from: (440 + index * 180) * pitch, duration: 0.3, start: offset, volume: 0.14 });
                });
                break;
            case "victory":
                [523, 659, 784, 1047].forEach((frequency, index) => {
                    tone(ctx, { type: "sine", from: frequency, duration: 0.5, start: index * 0.11, volume: 0.2 });
                });
                break;
            case "defeat":
                [392, 330, 262, 196].forEach((frequency, index) => {
                    tone(ctx, { type: "sine", from: frequency, duration: 0.55, start: index * 0.13, volume: 0.2 });
                });
                break;
            case "error":
                tone(ctx, { type: "square", from: 160, to: 120, duration: 0.18, volume: 0.16 });
                break;
            case "turn":
                tone(ctx, { type: "sine", from: 660 * pitch, to: 880 * pitch, duration: 0.2, volume: 0.14 });
                break;
            case "ignite": noise(ctx, { duration: 0.32, volume: 0.24, filterType: "bandpass", frequency: 900, sweepTo: 2400 }); tone(ctx, { type: "sawtooth", from: 160, to: 60, duration: 0.3, volume: 0.18 }); break;
            case "venom": [0, 0.1, 0.2].forEach((offset, i) => tone(ctx, { type: "sine", from: (1400 - i * 260) * pitch, to: (700 - i * 120) * pitch, duration: 0.12, start: offset, volume: 0.14 })); noise(ctx, { duration: 0.3, volume: 0.12, filterType: "highpass", frequency: 1800 }); break;
            case "bleed": noise(ctx, { duration: 0.14, volume: 0.28, filterType: "highpass", frequency: 2600, sweepTo: 800 }); break;
            case "curse": tone(ctx, { type: "sawtooth", from: 420, to: 90, duration: 0.5, volume: 0.2 }); break;
            case "exile": tone(ctx, { type: "sine", from: 180, to: 1100, duration: 0.45, volume: 0.2 }); noise(ctx, { duration: 0.4, volume: 0.16, filterType: "bandpass", frequency: 500, sweepTo: 2600 }); break;
            case "paralyze": [0, 0.05, 0.1].forEach(offset => tone(ctx, { type: "square", from: 2200, to: 1500, duration: 0.06, start: offset, volume: 0.12 })); break;
            case "detonate": noise(ctx, { duration: 0.5, volume: 0.34, filterType: "lowpass", frequency: 1600, sweepTo: 120 }); tone(ctx, { type: "sine", from: 180, to: 40, duration: 0.45, volume: 0.3 }); break;
            case "domain": tone(ctx, { type: "sine", from: 110, to: 220, duration: 1.0, volume: 0.22 }); tone(ctx, { type: "triangle", from: 330, to: 440, duration: 1.0, start: 0.08, volume: 0.14 }); break;
            case "coin": [0, 0.07, 0.14].forEach((offset, i) => tone(ctx, { type: "triangle", from: (1200 + i * 300) * pitch, to: (900 + i * 200) * pitch, duration: 0.1, start: offset, volume: 0.16 })); break;
            case "statusTick": tone(ctx, { type: "square", from: 500 * pitch, to: 320 * pitch, duration: 0.09, volume: 0.1 }); break;
            default:
                return false;
        }
        return true;
    } catch {
        return false;
    }
}

/** 按稀有度给出变调倍率，让高稀有度的动作听起来更"重"。 */
export function pitchForRarity(rarity) {
    return ({ N: 1, R: 1.06, SR: 1.12, SSR: 1.2, UR: 1.3 })[String(rarity || "N").toUpperCase()] || 1;
}

/** 仅供测试：重置内部状态（不会影响已持久化的开关）。 */
export function _resetAudioForTests() {
    context = null;
    masterGain = null;
    unlocked = false;
}
