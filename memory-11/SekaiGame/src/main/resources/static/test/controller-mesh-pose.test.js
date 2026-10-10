import test from "node:test";
import assert from "node:assert/strict";

import { applyPoseParameters, createPoseState, createSkeleton, resetPoseState, solveSkeleton } from "../js/controller-mesh.js";
import { expandRig, getControllerRig } from "../js/controller-rigs.js";
import { ACTION_MOTIONS, HOLD_STATES, composePoseParams } from "../js/controller-mesh-model.js";

/**
 * 这一组测试是「原画不许被压扁」这条硬约束的守门人。
 *
 * 背景：主控早期版本为了假装 3D 转头，对头部骨骼做了横向 scaleX 压缩
 * （headTurn=0.85 时头宽只剩 0.81）再叠一点剪切。玩家看到的效果就是
 * 一张平涂插画被物理挤压，比例失真。跟随鼠标的视线动态把这个缺陷
 * 放大成了常驻效果，因此相关动态被整体移除，压缩模型也换成了刚性变换。
 *
 * 数学上的判据很干净：只做平移、旋转、等比缩放的仿射矩阵，其 2x2 线性部分
 * 是**共形**的——两列向量正交且等长。一旦出现非等比缩放或剪切
 * （也就是任何「压缩/拉伸/斜切」），这个条件立刻被打破。
 */

/** 全部角色共用的合成包围盒（尺寸不重要，只要比例与真实 rig 一致即可） */
const BOX = { originX: 0, originY: 0, boxW: 900, boxH: 1429 };

function buildSkeleton(id) {
    const rig = expandRig(getControllerRig(id));
    return createSkeleton(rig, BOX);
}

/**
 * 计算 2x2 线性部分的「失真度」。
 * 返回 0 表示纯共形（无压缩、无剪切）；正值表示发生了形变。
 */
function distortion(m) {
    const [a, b, c, d] = m;             // 列向量：(a,b) 和 (c,d)
    const colA = Math.hypot(a, b);
    const colB = Math.hypot(c, d);
    const dot = a * c + b * d;
    // 正交偏差 + 等长偏差，都按列长归一化后再比较
    const norm = Math.max(colA * colB, 1e-12);
    return Math.hypot(dot / norm, (colA - colB) / Math.max(colA, colB, 1e-12));
}

function maxDistortion(skeleton, pose) {
    let worst = 0;
    let worstBone = null;
    for (let i = 0; i < skeleton.bones.length; i++) {
        const value = distortion(pose.matrices[i]);
        if (value > worst) { worst = value; worstBone = skeleton.bones[i].name; }
    }
    return { worst, worstBone };
}

/** 应用一组姿态参数并求解，返回最大失真度 */
function poseDistortion(skeleton, params) {
    const pose = createPoseState(skeleton);
    resetPoseState(pose);
    applyPoseParameters(skeleton, pose, params);
    solveSkeleton(skeleton, pose);
    return maxDistortion(skeleton, pose);
}

/**
 * 允许的失真上限。
 *
 * 换成等比呼吸之后整个骨架是严格刚性的，理论上就是浮点误差级别；
 * 这里留 1e-6 的余量而不是写死 0，避免矩阵连乘的舍入噪声造成偶发失败。
 * 被移除的头部转向压缩是 19~22%（失真度 0.19+），比这个阈值大五个数量级，
 * 所以这条断言足够紧，能真正拦住「把原画压扁」的回归。
 */
const DISTORTION_LIMIT = 1e-6;

const RIG_IDS = ["blue-01", "lucia"];
const CTX = { reducedMotion: false, ambientByName: new Map(), ambientInterval: () => 12000 };
const MOTION = { cycle: 6800, float: 5, boxH: BOX.boxH };

test("失真判据本身有效：非等比缩放与剪切必须被抓住", () => {
    const skeleton = buildSkeleton("blue-01");
    const headIndex = skeleton.byName.get("head");
    assert.ok(headIndex >= 0, "blue-01 必须有 head 骨骼");

    // 旧实现的参数：横向压到 0.81 再叠剪切——必须被判定为形变
    const broken = poseDistortion(skeleton, { headTurn: 0.85 });
    // 对应旧代码 setScale("head", 1 - |turn|*0.22, ...) + setShear("head", -turn*0.10)
    const legacy = createPoseState(skeleton);
    resetPoseState(legacy);
    legacy.scaleX[headIndex] = 1 - 0.85 * 0.22;
    legacy.scaleY[headIndex] = 1 + 0.85 * 0.03;
    legacy.shearX[headIndex] = -0.85 * 0.10;
    solveSkeleton(skeleton, legacy);
    const legacyDistortion = maxDistortion(skeleton, legacy);

    assert.ok(legacyDistortion.worst > 0.1,
        `旧的压缩实现必须被判定为明显形变，实测失真度 ${legacyDistortion.worst.toFixed(4)}`);
    assert.ok(broken.worst < 1e-6,
        `headTurn=0.85 现在只做刚性变换，失真度应≈0，实测 ${broken.worst.toExponential(2)}`
        + `（骨骼 ${broken.worstBone}）`);
});

test("头部转向只用旋转 + 平移：原画比例在任何转向幅度下都严格保持", () => {
    for (const id of RIG_IDS) {
        const skeleton = buildSkeleton(id);
        const headIndex = skeleton.byName.get("head");
        assert.ok(headIndex >= 0, `${id} 必须有 head 骨骼`);
        for (const turn of [-1.2, -0.85, -0.4, 0, 0.4, 0.85, 1.2]) {
            const pose = createPoseState(skeleton);
            resetPoseState(pose);
            applyPoseParameters(skeleton, pose, { headTurn: turn });
            solveSkeleton(skeleton, pose);
            // 头部骨骼的缩放必须严格是 1，剪切必须严格是 0
            assert.equal(pose.scaleX[headIndex], 1, `${id} headTurn=${turn} 不应改变 head 的 scaleX`);
            assert.equal(pose.scaleY[headIndex], 1, `${id} headTurn=${turn} 不应改变 head 的 scaleY`);
            assert.equal(pose.shearX[headIndex], 0, `${id} headTurn=${turn} 不应给 head 加剪切`);
            const { worst, worstBone } = maxDistortion(skeleton, pose);
            assert.ok(worst < 1e-6,
                `${id} headTurn=${turn} 全骨骼应保持共形，实测最大失真 ${worst.toExponential(2)}（${worstBone}）`);
        }
    }
});

test("转向仍要看得见：headTurn 产生可读的旋转与位移，不是失效通道", () => {
    const skeleton = buildSkeleton("blue-01");
    const headIndex = skeleton.byName.get("head");
    const measure = turn => {
        const pose = createPoseState(skeleton);
        resetPoseState(pose);
        applyPoseParameters(skeleton, pose, { headTurn: turn });
        solveSkeleton(skeleton, pose);
        const m = pose.matrices[headIndex];
        return { angle: Math.atan2(m[1], m[0]), x: m[4], y: m[5] };
    };
    const right = measure(0.85);
    const left = measure(-0.85);
    const center = measure(0);
    assert.ok(right.angle > 0.08, `向右转头应有可读的旋转，实测 ${right.angle.toFixed(3)} rad`);
    assert.ok(left.angle < -0.08, `向左转头应有可读的旋转，实测 ${left.angle.toFixed(3)} rad`);
    assert.ok(Math.abs(right.angle + left.angle) < 1e-6, "左右转头应严格对称");
    assert.ok(right.x - center.x > 10, `向右转头应带水平位移，实测 ${(right.x - center.x).toFixed(1)}px`);
    assert.ok(Math.abs(center.angle) < 1e-6, "静止时不应有旋转");
});

test("全部游戏动作与结算姿态都不产生任何压缩或剪切", () => {
    for (const id of RIG_IDS) {
        const skeleton = buildSkeleton(id);
        const rig = getControllerRig(id);
        const cases = [];
        // 一次性动作：按 60fps 采样整条时间线
        for (const [name, motion] of Object.entries(ACTION_MOTIONS)) {
            const duration = motion.duration ?? 700;
            for (let t = 0; t <= 1.0001; t += 1 / 12) {
                cases.push({
                    label: `action=${name} t=${t.toFixed(2)}`,
                    state: { action: name, actionStart: 0, actionDuration: duration, time: 0 },
                    now: t * duration,
                });
            }
        }
        // 结算保持
        for (const name of Object.keys(HOLD_STATES)) {
            cases.push({ label: `hold=${name}`, state: { hold: name, holdStart: 0, time: 0 }, now: 0 });
            cases.push({ label: `hold=${name} t=2s`, state: { hold: name, holdStart: 0, time: 0 }, now: 2000 });
        }
        // 角色专属动作
        for (const ambient of rig.ambient || []) {
            const duration = ambient.duration ?? 1800;
            for (let t = 0; t <= 1.0001; t += 1 / 8) {
                cases.push({
                    label: `ambient=${ambient.name} t=${t.toFixed(2)}`,
                    state: {
                        ambient: ambient.name, ambientStart: 0, ambientDuration: duration, time: 0,
                        ambientByName: new Map([[ambient.name, ambient]]),
                    },
                    now: t * duration,
                });
            }
        }
        // 低 LP 持续颤抖 + idle
        for (let i = 0; i < 24; i++) {
            cases.push({
                label: `lowHp t=${(i * 40)}ms`,
                state: { lowHp: true, lowHpRamp: 1, time: i * 40 },
                now: 0,
            });
        }

        for (const item of cases) {
            const state = {
                time: 0, action: null, actionStart: 0, actionDuration: 0,
                ambient: null, ambientStart: 0, ambientDuration: 0, ambientDelay: 12000,
                hold: null, holdStart: 0, lowHp: false, lowHpRamp: 0, dim: 0, override: null,
                ...item.state,
            };
            const context = { ...CTX, ambientByName: state.ambientByName || new Map() };
            const params = composePoseParams(state, MOTION, context, item.now);
            const { worst, worstBone } = poseDistortion(skeleton, params);
            assert.ok(worst <= DISTORTION_LIMIT,
                `${id} ${item.label} 出现形变：失真度 ${worst.toExponential(2)}（${worstBone}）`);
        }
    }
});

test("静止姿态严格还原原画：所有骨骼矩阵退化为纯平移", () => {
    for (const id of RIG_IDS) {
        const skeleton = buildSkeleton(id);
        const pose = createPoseState(skeleton);
        resetPoseState(pose);
        applyPoseParameters(skeleton, pose, {});
        solveSkeleton(skeleton, pose);
        for (let i = 0; i < skeleton.bones.length; i++) {
            const m = pose.matrices[i];
            assert.ok(Math.abs(m[0] - 1) < 1e-6 && Math.abs(m[1]) < 1e-6
                && Math.abs(m[2]) < 1e-6 && Math.abs(m[3] - 1) < 1e-6,
                `${id} 骨骼 ${skeleton.bones[i].name} 在静止姿态下不是单位线性部分`);
            // 世界枢轴必须等于静止枢轴
            assert.ok(Math.abs(pose.worldPivot[i * 2] - skeleton.bones[i].x) < 1e-4
                && Math.abs(pose.worldPivot[i * 2 + 1] - skeleton.bones[i].y) < 1e-4,
                `${id} 骨骼 ${skeleton.bones[i].name} 静止姿态下枢轴发生了漂移`);
        }
    }
});
