import test from "node:test";
import assert from "node:assert/strict";

import {
    CONTROLLER_ACTION_PRIORITY,
    commitControllerAction,
    controllerActionDuration,
    createControllerRuntimeState,
    decideControllerAction,
    emitControllerAction,
    getDefaultController,
    getRegisteredController,
    listControllers,
    registerController,
    releaseControllerAction,
    resetControllerRuntimeState,
    DEFAULT_CONTROLLER_ANIMATIONS,
    DEFAULT_CONTROLLER_REACTIONS,
    DEFAULT_CONTROLLER_THEME,
} from "../js/controller-2d.js";

test("注册表至少包含两个可直接使用的主控，且字段完整", () => {
    const controllers = listControllers();
    assert.ok(controllers.length >= 2, "内置应有 >= 2 个主控");
    for (const controller of controllers) {
        assert.ok(controller.id, "缺少 id");
        assert.ok(controller.name, `${controller.id} 缺少 name`);
        assert.ok(controller.title, `${controller.id} 缺少 title`);
        assert.ok(typeof controller.description === "string", `${controller.id} 缺少 description`);
        assert.ok(["mesh", "live2d"].includes(controller.backend), `${controller.id} 后端类型非法`);
        if (controller.backend === "live2d") {
            // Live2D 后端的 image 是模型贴图，不是角色原画；它必须给出模型资源位置
            assert.match(controller.image, /\.png$/, `${controller.id} 的 image 应指向贴图`);
            assert.ok(controller.modelDir.endsWith("/"), `${controller.id} 的 modelDir 应以 / 结尾`);
            assert.match(controller.modelJson, /\.model3\.json$/, `${controller.id} 的 modelJson 非法`);
        } else {
            assert.match(controller.image, /^assets\/characters\/.+\.png$/, `${controller.id} 的 image 应指向角色原画`);
            assert.equal(controller.experimental, false, `${controller.id} 出场角色不应标记为实验性`);
        }
        for (const key of Object.keys(DEFAULT_CONTROLLER_THEME)) assert.ok(controller.theme[key], `${controller.id}.theme.${key} 缺失`);
        for (const key of ["idle", "aura", "draw", "summon", "spell", "trap", "attack", "hit", "win", "lose"]) {
            assert.ok(controller.animations[key], `${controller.id}.animations.${key} 缺失`);
        }
        for (const key of ["draw", "summon", "spell", "trap", "attack", "hit", "win", "lose"]) {
            assert.ok(controller.reactions[key]?.status, `${controller.id}.reactions.${key}.status 缺失`);
            assert.ok(controller.reactions[key]?.className, `${controller.id}.reactions.${key}.className 缺失`);
        }
    }
    assert.equal(getDefaultController()?.id, controllers[0].id);
    // 默认主控必须是出场角色，不能是实验性的 Live2D 技术验证模型
    assert.equal(getDefaultController()?.backend, "mesh");
    assert.equal(getDefaultController()?.experimental, false);
});

test("Live2D 技术验证模型默认不出场", () => {
    const reference = listControllers().find(item => item.backend === "live2d");
    assert.ok(reference, "应存在一个 live2d 后端条目");
    assert.equal(reference.experimental, true, "Live2D 参考模型必须标记为实验性");
    assert.equal(getRegisteredController("hiyori-ref")?.backend, "live2d");
});

test("后续只需一条配置即可注册第二个主控", () => {
    const before = listControllers().length;
    const created = registerController({
        id: "test-ctl",
        name: "CONTROLLER TEST",
        title: "TEST LINK",
        description: "单测用主控",
        image: "assets/characters/test.png",
    });
    assert.equal(listControllers().length, before + 1);
    assert.equal(getRegisteredController("test-ctl"), created);
    // 未覆盖的字段必须回落到默认值，而不是 undefined
    assert.equal(created.theme.primary, DEFAULT_CONTROLLER_THEME.primary);
    assert.equal(created.animations.attack.duration, DEFAULT_CONTROLLER_ANIMATIONS.attack.duration);
    assert.equal(created.reactions.summon.status, DEFAULT_CONTROLLER_REACTIONS.summon.status);
    // 同 id 再注册是替换而不是追加
    registerController({ id: "test-ctl", name: "CONTROLLER TEST 2", image: "assets/characters/test.png" });
    assert.equal(listControllers().length, before + 1);
    assert.equal(getRegisteredController("test-ctl").name, "CONTROLLER TEST 2");
});

test("注册表拒绝无效配置", () => {
    assert.throws(() => registerController(null), TypeError);
    assert.throws(() => registerController({ name: "没有 id" }), TypeError);
});

test("优先级：高优先级可以打断低优先级，反之不行", () => {
    const state = createControllerRuntimeState();
    assert.equal(decideControllerAction(state, "draw", 1000).play, true);
    commitControllerAction(state, "draw", 1000, 820);
    // draw(2) 播放中，更低的 link(1) 不能打断
    assert.equal(decideControllerAction(state, "link", 1100).play, false);
    assert.equal(decideControllerAction(state, "link", 1100).reason, "lower-priority");
    // 同级的 summon(3) 可以打断 draw(2)
    assert.equal(decideControllerAction(state, "summon", 1100).play, true);
    // 高优先级的 hit(4) 可以打断 summon(3)
    commitControllerAction(state, "summon", 1200, 1080);
    assert.equal(decideControllerAction(state, "hit", 1300).play, true);
    // 动作结束后同级重新可播
    commitControllerAction(state, "attack", 2000, 620);
    assert.equal(decideControllerAction(state, "draw", 2100).play, false);
    assert.equal(decideControllerAction(state, "draw", 2700).play, true);
});

test("优先级表满足 win/lose > hit > 动作 > draw > idle", () => {
    const p = CONTROLLER_ACTION_PRIORITY;
    for (const action of ["play", "summon", "spell", "trap", "attack"]) {
        assert.ok(p.win > p.hit, "win 必须高于 hit");
        assert.ok(p.hit > p[action], `hit 必须高于 ${action}`);
        assert.ok(p[action] > p.draw, `${action} 必须高于 draw`);
        assert.ok(p.draw > p.idle, "draw 必须高于 idle");
    }
    assert.equal(p.win, p.lose);
    // 低 LP 是持续状态，脉冲优先级必须低于一切一次性动作
    assert.ok(p.critical < p.draw);
});

test("同一事件在短时间内去重，超过窗口后可以再次播放", () => {
    const state = createControllerRuntimeState();
    assert.equal(decideControllerAction(state, "attack", 5000).play, true);
    commitControllerAction(state, "attack", 5000, 620);
    releaseControllerAction(state, "attack");
    assert.equal(decideControllerAction(state, "attack", 5150).play, false);
    assert.equal(decideControllerAction(state, "attack", 5150).reason, "duplicate");
    assert.equal(decideControllerAction(state, "attack", 5300).play, true);
});

test("win/lose 锁定最终姿态，直到新决斗开始", () => {
    const state = createControllerRuntimeState();
    assert.equal(decideControllerAction(state, "win", 1000).play, true);
    commitControllerAction(state, "win", 1000, controllerActionDuration("win"));
    assert.equal(controllerActionDuration("win"), 0, "win 必须保持最终姿态");
    assert.equal(state.locked, true);
    assert.equal(decideControllerAction(state, "hit", 9000).play, false);
    assert.equal(decideControllerAction(state, "draw", 9000).play, false);
    assert.equal(decideControllerAction(state, "lose", 9000).play, false, "同一场决斗不能重复结算");
    resetControllerRuntimeState(state);
    assert.equal(state.locked, false);
    assert.equal(decideControllerAction(state, "draw", 9001).play, true);
});

test("复位会清空去重记录与低 LP 状态", () => {
    const state = createControllerRuntimeState();
    commitControllerAction(state, "hit", 100, 560);
    state.lowHp = true;
    resetControllerRuntimeState(state);
    assert.equal(state.lowHp, false);
    assert.equal(state.active, null);
    assert.deepEqual(Object.keys(state.lastFiredAt), []);
});

test("emitControllerAction 在无 window 的 Node 环境下安全返回", () => {
    assert.equal(typeof window, "undefined");
    assert.doesNotThrow(() => emitControllerAction("draw", { playerIndex: 0 }));
});
