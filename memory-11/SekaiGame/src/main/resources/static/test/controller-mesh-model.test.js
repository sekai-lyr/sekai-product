import test from "node:test";
import assert from "node:assert/strict";

import { composePoseParams } from "../js/controller-mesh-model.js";

/**
 * composePoseParams 是纯函数，所以可以在 Node 里按 60fps 确定性推进。
 * 这一点很关键：jsdom 的 rAF 只有个位数帧率，2~4Hz 的颤抖在里面会严重混叠，
 * 靠浏览器侧集成测试根本验证不了。
 */
const MOTION = { cycle: 6800, float: 5, boxH: 1429 };
const CTX = { reducedMotion: false, ambientByName: new Map(), ambientInterval: () => 12000 };

function makeState(overrides = {}) {
    return {
        time: 0,
        action: null,
        actionStart: 0,
        actionDuration: 0,
        ambient: null,
        ambientStart: 0,
        ambientDuration: 0,
        ambientDelay: 12000,
        hold: null,
        holdStart: 0,
        lowHp: false,
        lowHpRamp: 0,
        dim: 0,
        override: null,
        ...overrides,
    };
}

/** 统计一段采样里的过零次数（用于判断频率） */
function zeroCrossings(values) {
    let crossings = 0;
    for (let i = 1; i < values.length; i++) {
        if ((values[i - 1] < 0 && values[i] >= 0) || (values[i - 1] > 0 && values[i] <= 0)) crossings++;
    }
    return crossings;
}

test("主控不再响应鼠标：传入 gaze 对姿态没有任何影响", () => {
    // 跟随鼠标的视线动态已被移除（它只能靠压扁头部假装转头，会压缩原画）。
    // 这条测试是回归闸门：只要有人把 gaze 通道重新接回 composePoseParams，
    // 下面的逐字段相等断言立刻失败。
    const plain = composePoseParams(makeState(), MOTION, CTX, 0);
    for (const gaze of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: 0, y: 0 }]) {
        const withGaze = composePoseParams(makeState({ gaze }), MOTION, CTX, 0);
        for (const key of new Set([...Object.keys(plain), ...Object.keys(withGaze)])) {
            assert.equal(withGaze[key], plain[key],
                `gaze=${JSON.stringify(gaze)} 不应影响 ${key}（${plain[key]} → ${withGaze[key]}）`);
        }
    }
});

test("主控不再响应鼠标：动作进行中同样不受 gaze 影响", () => {
    const base = { action: "hit", actionStart: 0, actionDuration: 560 };
    const plain = composePoseParams(makeState(base), MOTION, CTX, 250);
    const withGaze = composePoseParams(makeState({ ...base, gaze: { x: 1, y: -1 } }), MOTION, CTX, 250);
    for (const key of new Set([...Object.keys(plain), ...Object.keys(withGaze)])) {
        assert.equal(withGaze[key], plain[key], `动作中 gaze 不应影响 ${key}`);
    }
});

test("低 LP 持续颤抖：产生明确的 2~4Hz 高频抖动", () => {
    const sample = lowHp => {
        const values = [];
        for (let i = 0; i < 60; i++) {
            const state = makeState({ time: i * (1000 / 60), lowHp, lowHpRamp: lowHp ? 1 : 0 });
            values.push(composePoseParams(state, MOTION, CTX, 0).headTilt ?? 0);
        }
        return values;
    };
    const calm = sample(false);
    const trembling = sample(true);
    const delta = trembling.map((value, index) => value - calm[index]);
    const crossings = zeroCrossings(delta);
    const peak = Math.max(...delta.map(Math.abs));

    assert.ok(peak > 0.03, `颤抖幅度应可见，实测峰值 ${peak.toFixed(4)}`);
    assert.ok(peak < 0.12, `颤抖幅度应克制，实测峰值 ${peak.toFixed(4)}`);
    // 3.4Hz 在 1 秒内应有约 6~7 次过零
    assert.ok(crossings >= 5 && crossings <= 9, `过零次数应在 5~9（约 3.4Hz），实测 ${crossings}`);
});

test("低 LP 颤抖是持续状态：与一次性动作相加而不是互相覆盖", () => {
    const state = () => makeState({
        lowHp: true,
        lowHpRamp: 1,
        time: 500,
        action: "hit",
        actionStart: 0,
        actionDuration: 560,
    });
    const withTremble = composePoseParams(state(), MOTION, CTX, 250);
    const withoutTremble = composePoseParams(makeState({
        lowHp: false,
        time: 500,
        action: "hit",
        actionStart: 0,
        actionDuration: 560,
    }), MOTION, CTX, 250);
    // 受击姿态必须还在
    assert.ok(Math.abs(withoutTremble.headTilt) > 0.01 || Math.abs(withoutTremble.squash ?? 0) > 0.1,
        "受击姿态应存在");
    // 颤抖必须叠加上去（差值不为零）
    assert.notEqual(withTremble.headTilt, withoutTremble.headTilt, "颤抖应与受击姿态叠加");
});

test("低 LP 颤抖在 reduced-motion 下关闭", () => {
    const state = () => makeState({ time: 500, lowHp: true, lowHpRamp: 1 });
    const normal = composePoseParams(state(), MOTION, CTX, 0);
    const reduced = composePoseParams(state(), MOTION, { ...CTX, reducedMotion: true }, 0);
    assert.equal(reduced.headTilt ?? 0, 0, "降级模式下不应有颤抖");
    assert.ok(normal.headTilt !== 0, "正常模式下应有颤抖");
});

test("姿态合成结果始终是有限数值（不产生 NaN）", () => {
    const scenarios = [
        {},
        { lowHp: true, lowHpRamp: 1 },
        { action: "attack", actionStart: 0, actionDuration: 620 },
        { ambient: "wave", ambientStart: 0, ambientDuration: 2300 },
        { hold: "win", holdStart: 0 },
        { hold: "lose", holdStart: 0 },
        { lowHp: true, lowHpRamp: 1, action: "hit", actionStart: 0, actionDuration: 560 },
    ];
    for (const scenario of scenarios) {
        for (const time of [0, 250, 700, 1500, 4000]) {
            const params = composePoseParams(makeState({ ...scenario, time }), MOTION, CTX, time);
            for (const [key, value] of Object.entries(params)) {
                assert.ok(Number.isFinite(value), `${key} 在场景 ${JSON.stringify(scenario)} t=${time} 下为 ${value}`);
            }
        }
    }
});
