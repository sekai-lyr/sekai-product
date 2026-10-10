/**
 * bugfix-regression.test.js
 * 针对本轮 bug 评审中修复的缺陷的回归测试。
 * 每个 it 对应一个已确认的缺陷，防止再次回归。
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// 注意：这里不要注入 global.document —— controller 的回合流程会据此判断
// "是否在浏览器里"，注入后会走真实的动画路径并访问 window/requestAnimationFrame。

const { GameState, Player, createCardInstance, shuffleArray } = await import("../js/model.js");
const { GameEngine } = await import("../js/engine.js");
const { PHASE, MONSTER_POSITION, GAME_CONFIG } = await import("../js/constants.js");
const { rarityRank } = await import("../js/card-view.js");
const { calculateMatchReward } = await import("../js/rewards.js");
const { openPack, openTenPacks, getEffectiveRates, applyDuplicateProtection, PACK_GUARANTEE, NIGHTCORD_PACK } = await import("../js/packs.js");
const { RandomSource, SeededRandom } = await import("../js/rng.js");
const { AI_FALLBACK_DECK } = await import("../js/decks.js");
const { validateDeck, buildSuggestedDeck } = await import("../js/deck.js");
const { enableDemoMode } = await import("../js/collection.js");
const { createNewProfile } = await import("../js/profile.js");
const { deckBattleValue } = await import("../js/app.js");
const { GameController } = await import("../js/controller.js");
const { cardImageSrc, applyCardImageSources } = await import("../js/card-images.js");
const { cardArtHtml } = await import("../js/card-view.js");
const audio = await import("../js/audio.js");
const { TUTORIAL_CARDS, TUTORIAL_STEPS, TutorialCoach, buildTutorialDecks, orderTutorialDeck } = await import("../js/tutorial.js");
const { ALL_CARDS, getCardById } = await import("../js/catalog.js");

function mk(o = {}) {
    return {
        id: "t_" + Math.random().toString(36).slice(2, 8), name: "测试怪兽", type: "monster",
        attribute: "fire", race: "warrior", level: 3, attack: 1500, defense: 1000,
        rarity: "N", effects: [], description: "测试", image: "", ...o,
    };
}

function mkSpell(o = {}) {
    return {
        id: "s_" + Math.random().toString(36).slice(2, 8), name: "测试魔法", type: "spell",
        attribute: "fire", level: 0, attack: 0, defense: 0, rarity: "N",
        effects: [], description: "测试", image: "", ...o,
    };
}

/** 确定性随机源（mulberry32），让涉及洗牌的断言可复现。 */
function seededRandom(seed = 1) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function aiUi() {    return {
        logs: [], renders: 0,
        render() { this.renders++; },
        addLog(message) { this.logs.push(message); },
        showAiAction() {},
        showDrawAnimation() {},
        showGameOver() {},
        showHandoff(_name, callback) { callback(); },
    };
}

function createGame({ turn = 6, phase = PHASE.MAIN_1 } = {}) {
    const state = new GameState();
    state.players = [new Player("P1", Array.from({ length: 10 }, () => mk())), new Player("P2", Array.from({ length: 10 }, () => mk()))];
    state.currentPlayerIndex = 0;
    state.turn = turn;
    state.firstTurn = false;
    state.phase = phase;
    return { state, engine: new GameEngine(state) };
}

// ---------------------------------------------------------------------------
describe("盖放魔法（需要指定目标）可以正常发动", () => {
    it("从目标选择阶段确认后必须成功发动，而不是报“只能在主要阶段发动”", () => {
        const { state, engine } = createGame({ turn: 6 });
        const removal = createCardInstance(mkSpell({
            name: "除魔",
            effects: [{ trigger: "manual", type: "destroySpellTrap", value: 0 }],
        }));
        const trap = createCardInstance({ id: "trap_x", name: "测试陷阱", type: "trap", rarity: "N", effects: [] });
        trap.faceDown = true; trap.canActivate = true; trap.setTurn = 4;
        state.players[1].spellTrapZone.push(trap);
        state.players[0].hand.push(removal);

        assert.equal(engine.setCard(state.players[0], 0).success, true);
        removal.setTurn = state.turn - 2;
        assert.equal(engine.canActivateSetSpell(state.players[0], removal).canActivate, true);

        // 控制器进入目标选择阶段时的真实状态
        state.phase = PHASE.TARGET_SELECT;
        state.validTargets = engine.getValidTargets(state.players[0], removal.effects[0]);
        assert.equal(state.validTargets.length, 1);

        const result = engine.activateSetSpell(state.players[0], removal, trap);
        assert.equal(result.success, true, result.message);
        assert.equal(state.players[1].spellTrapZone.includes(trap), false);
        assert.equal(state.players[1].graveyard.includes(trap), true);
    });
});

// ---------------------------------------------------------------------------
describe("重新上场的怪兽可以攻击", () => {
    it("被祭品送墓后回到卡组再召唤的怪兽，attacksMadeThisTurn 必须清零", () => {
        const { state, engine } = createGame({ turn: 10 });
        const me = state.players[0];
        const veteran = createCardInstance(mk({ id: "veteran_x", name: "老兵怪兽", level: 4, attack: 1800, defense: 1200 }));
        me.monsterZone.push(veteran);
        veteran.canAttack = true;

        const bigOne = createCardInstance(mk({ id: "big_x", name: "上级怪兽", level: 6, attack: 2400, defense: 2000 }));
        me.hand.push(bigOne);
        engine.normalSummon(me, 0, MONSTER_POSITION.ATTACK, false);
        engine.selectTribute(veteran);
        engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
        assert.equal(me.graveyard.includes(veteran), true);
        assert.equal(veteran.attacksMadeThisTurn, 1, "祭品送墓时写入的记账");

        // 效果把这张卡放回卡组，之后再次抽到并召唤
        me.graveyard = me.graveyard.filter(card => card !== veteran);
        me.deck.push(veteran);
        state.turn = 12;
        me.normalSummonUsed = false;
        me.monsterZone.length = 0;
        me.hand.push(veteran);
        const summon = engine.normalSummon(me, me.hand.indexOf(veteran), MONSTER_POSITION.ATTACK, false);
        assert.equal(summon.success, true);
        assert.equal(veteran.attacksMadeThisTurn, 0);

        state.phase = PHASE.BATTLE;
        state.players[1].monsterZone.length = 0;
        const attack = engine.attack(veteran, "player");
        assert.equal(attack.success, true, attack.message);
        assert.equal(state.players[1].lp, GAME_CONFIG.START_LP - 1800);
    });

    it("回合结束时攻击记账会一起清零（不留 canAttack 与计数不一致）", () => {
        const { state, engine } = createGame({ turn: 20 });
        const monster = createCardInstance(mk({ id: "double_x", name: "连击怪兽" }));
        state.players[0].monsterZone.push(monster);
        monster.canAttack = true;
        monster.doubleAttackThisTurn = true;
        monster.attacksMadeThisTurn = 2;
        monster.hasAttackedThisTurn = true;
        state.players[1].monsterZone.length = 0;
        engine.attack(monster, "player");
        engine.endTurn();
        assert.equal(monster.attacksMadeThisTurn, 0);
        assert.equal(monster.hasAttackedThisTurn, false);
    });
});

// ---------------------------------------------------------------------------
describe("结束阶段清理待选择状态", () => {
    it("祭品选择中途结束回合不会把 pendingTribute 带到下一回合", () => {
        const { state, engine } = createGame({ turn: 8 });
        const me = state.players[0];
        me.monsterZone.push(createCardInstance(mk({ id: "tribute_x", name: "祭品怪兽" })));
        const bigOne = createCardInstance(mk({ id: "sixstar_x", name: "六星怪兽", level: 6 }));
        me.hand.push(bigOne);
        const result = engine.normalSummon(me, 0, MONSTER_POSITION.ATTACK, false);
        assert.equal(result.needsTribute, true);
        assert.equal(state.phase, PHASE.TRIBUTE_SELECT);
        assert.ok(state.pendingTribute);

        engine.endTurn();
        assert.equal(state.pendingTribute, null);
        assert.equal(state.phase, PHASE.END);
    });
});

// ---------------------------------------------------------------------------
describe("战斗响应陷阱的攻守加成作用于守方怪兽", () => {
    it("援军的 +500 必须加在守方怪兽上，而不是陷阱卡自己", () => {
        const { state, engine } = createGame({ turn: 12, phase: PHASE.MAIN_1 });
        const attacker = createCardInstance(mk({ id: "atk_x", name: "攻击者", attack: 2000, defense: 1000 }));
        const defender = createCardInstance(mk({ id: "def_x", name: "守方", attack: 1000, defense: 1000 }));
        state.players[0].monsterZone.push(attacker);
        state.players[1].monsterZone.push(defender);
        attacker.canAttack = true;
        attacker.setTurn = 1;

        const trap = createCardInstance({
            id: "reinforcement_x", name: "援军", type: "trap", rarity: "N",
            effects: [{ trigger: "onAttacked", type: "buffSelfAttack", value: 500 }],
        });
        trap.faceDown = true; trap.canActivate = true; trap.setTurn = state.turn - 1;
        state.players[1].spellTrapZone.push(trap);

        state.phase = PHASE.BATTLE;
        const result = engine.attack(attacker, defender);
        assert.equal(result.success, true);
        assert.equal(trap.currentAttack, 0, "陷阱卡自身不应被强化");
        // 2000 攻击 1000+500 = 1500 守备 → 破坏并造成 500 战斗伤害（无贯穿则不造成）
        assert.equal(state.players[1].monsterZone.includes(defender), false, "守方应被破坏");
    });

    it("直接攻击（无守方怪兽）时不会崩溃", () => {
        const { state, engine } = createGame({ turn: 12, phase: PHASE.BATTLE });
        const attacker = createCardInstance(mk({ id: "atk_y", name: "攻击者", attack: 2000 }));
        state.players[0].monsterZone.push(attacker);
        attacker.canAttack = true; attacker.setTurn = 1;
        const trap = createCardInstance({
            id: "reinforcement_y", name: "援军", type: "trap", rarity: "N",
            effects: [{ trigger: "onAttacked", type: "buffSelfAttack", value: 500 }],
        });
        trap.faceDown = true; trap.canActivate = true; trap.setTurn = state.turn - 1;
        state.players[1].spellTrapZone.push(trap);
        state.players[1].monsterZone.length = 0;

        const lpBefore = state.players[1].lp;
        const result = engine.attack(attacker, "player");
        assert.equal(result.success, true, result.message);
        assert.equal(state.players[1].lp, lpBefore - 2000);
    });
});

// ---------------------------------------------------------------------------
describe("反射伤害使用卡面数值", () => {
    it("声明 500 点的反伤陷阱不应按攻击怪兽的完整攻击力结算", () => {
        const { state, engine } = createGame({ turn: 12 });
        const attacker = createCardInstance(mk({ id: "atk_z", name: "强攻怪兽", attack: 2600 }));
        const defender = createCardInstance(mk({ id: "def_z", name: "守方", attack: 800, defense: 1200 }));
        state.players[0].monsterZone.push(attacker);
        state.players[1].monsterZone.push(defender);
        attacker.canAttack = true; attacker.setTurn = 1;

        const trap = createCardInstance({
            id: "mirror_x", name: "魔法筒枪", type: "trap", rarity: "N",
            effects: [{ trigger: "onAttacked", type: "reflectDamage", value: 500 }],
        });
        trap.faceDown = true; trap.canActivate = true; trap.setTurn = state.turn - 1;
        state.players[1].spellTrapZone.push(trap);

        state.phase = PHASE.BATTLE;
        const lpBefore = state.players[0].lp;
        engine.attack(attacker, defender);
        assert.equal(lpBefore - state.players[0].lp, 500);
    });
});

// ---------------------------------------------------------------------------
describe("衍生物处理", () => {
    it("tokenSummon 产生的衍生物带 isToken，被破坏时不进入墓地", () => {
        const { state, engine } = createGame({ turn: 12 });
        const card = createCardInstance({
            id: "token_maker", name: "衍生物制造者", type: "spell",
            effects: [{ trigger: "manual", type: "tokenSummon", value: 700 }],
        });
        state.players[0].hand.push(card);
        const result = engine.activateSpell(state.players[0], 0);
        assert.equal(result.success, true, result.message);
        const token = state.players[0].monsterZone.find(item => item.isToken);
        assert.ok(token, "应生成衍生物");
        engine.destroyFieldMonster(state.players[0], token);
        assert.equal(state.players[0].graveyard.includes(token), false, "衍生物不进入墓地");
    });
});

// ---------------------------------------------------------------------------
describe("数值修正登记（不会被回合边界还原）", () => {
    it("“攻击力下降500”在回合结束后依然有效", () => {
        const { state, engine } = createGame({ turn: 30 });
        const target = createCardInstance(mk({ id: "target_x", name: "受害者", attack: 2400, defense: 2000 }));
        state.players[1].monsterZone.push(target);
        const spell = createCardInstance({
            id: "weaken_x", name: "心变", type: "spell",
            effects: [{ trigger: "manual", type: "debuffEnemyAttack", value: 500, target: { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 } }],
        });
        state.players[0].hand.push(spell);
        const result = engine.activateSpell(state.players[0], 0, target);
        assert.equal(result.success, true, result.message);
        assert.equal(target.currentAttack, 1900);

        engine.endTurn();
        assert.equal(target.currentAttack, 1900, "回合结束后不应被 _recalcCardStats 还原为 2400");
    });

    it("没有指定目标时 debuffEnemyAttack 选择攻击力最高的怪兽", () => {
        const { state, engine } = createGame({ turn: 30 });
        const weak = createCardInstance(mk({ id: "weak_x", name: "弱怪", attack: 400, defense: 400 }));
        const strong = createCardInstance(mk({ id: "strong_x", name: "强怪", attack: 2900, defense: 2500 }));
        state.players[1].monsterZone.push(weak, strong);
        const spell = createCardInstance({
            id: "weaken_y", name: "压制", type: "spell",
            effects: [{ trigger: "manual", type: "debuffEnemyAttack", value: 500 }],
        });
        // 无目标上下文的结算路径（事件触发型效果走的就是这条路）
        engine._executeEffect(state.players[0], spell, spell.effects[0], null, {});
        assert.equal(strong.currentAttack, 2400);
        assert.equal(weak.currentAttack, 400);
    });

    it("buffThenDebuff 的永久 -700 会在回合结束后真正生效", () => {
        const { state, engine } = createGame({ turn: 30 });
        const monster = createCardInstance(mk({ id: "buff_x", name: "受益怪兽", attack: 2000, defense: 1500 }));
        state.players[0].monsterZone.push(monster);
        const spell = createCardInstance({
            id: "buffthen_x", name: "加速术", type: "spell",
            effects: [{ trigger: "manual", type: "buffThenDebuff", value: 400, penalty: 700, target: { owner: "self", zone: "monster", selector: "highestAttack", count: 1 } }],
        });
        state.players[0].hand.push(spell);
        engine.activateSpell(state.players[0], 0, monster);
        engine.endTurn();
        assert.equal(monster.currentAttack, 1300, "2000 + 400 - 700 应在回合结束后保持");
    });
});

// ---------------------------------------------------------------------------
describe("复活的怪兽返回玩家选择的目标", () => {
    it("reviveToHand 使用指定的墓地目标", () => {
        const { state, engine } = createGame({ turn: 30 });
        const older = createCardInstance(mk({ id: "old_x", name: "较早怪兽" }));
        const latest = createCardInstance(mk({ id: "latest_x", name: "最近怪兽" }));
        state.players[0].graveyard.push(older, latest);
        const spell = createCardInstance({
            id: "revive_x", name: "死者苏生", type: "spell",
            effects: [{ trigger: "manual", type: "reviveToHand", value: 0, target: { owner: "self", zone: "graveyard", count: 1 } }],
        });
        state.players[0].hand.push(spell);
        const result = engine.activateSpell(state.players[0], 0, older);
        assert.equal(result.success, true, result.message);
        assert.equal(state.players[0].hand.includes(older), true, "应复活被选定的较早怪兽");
        assert.equal(state.players[0].graveyard.includes(older), false);
    });
});

// ---------------------------------------------------------------------------
describe("攻守互换 / 阶段推进的边界", () => {
    it("advancePhase 对目标选择阶段不做任何事", () => {
        const { state, engine } = createGame({ turn: 10, phase: PHASE.TARGET_SELECT });
        engine.advancePhase();
        assert.equal(state.phase, PHASE.TARGET_SELECT);
    });

    it("手牌上“本回合不能发动”的标记会在新回合清除", () => {
        const { state } = createGame({ turn: 10 });
        const spell = createCardInstance(mkSpell({ id: "locked_x", name: "被封锁的魔法" }));
        state.players[0].hand.push(spell);
        spell.cannotActivateThisTurn = true;
        state.players[0].resetTurnState();
        assert.equal(spell.cannotActivateThisTurn, false);
    });
});

// ---------------------------------------------------------------------------
describe("AI 战斗步骤不会死循环", () => {
    async function runAiBattle({ setup }) {
        const state = new GameState();
        state.players = [new Player("人类", Array.from({ length: 10 }, () => mk())), new Player("AI", Array.from({ length: 10 }, () => mk()))];
        state.players[1].hand = [];
        state.players[1].deck = Array.from({ length: 5 }, () => createCardInstance(mk()));
        state.currentPlayerIndex = 1;
        state.turn = 8;
        state.firstTurn = false;
        state.phase = PHASE.BATTLE;
        const engine = new GameEngine(state);
        const ui = aiUi();
        const controller = new GameController(state, engine, ui);
        controller.mode = "ai";
        controller.aiActionDelay = 1;
        setup(state, engine);
        controller._runAiBattleStep();
        const deadline = Date.now() + 3000;
        while (state.currentPlayerIndex === 1 && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        controller.clearAiTimer();
        return state;
    }

    it("引擎拒绝直接攻击（场地效果）时 AI 回合必须正常结束，而不是无限重试", async () => {
        const state = await runAiBattle({
            setup: (s) => {
                const attacker = createCardInstance(mk({ id: "ai_atk_1", name: "AI怪兽", attack: 2000 }));
                attacker.canAttack = true;
                attacker.setTurn = 1;
                s.players[1].monsterZone.push(attacker);
                s.players[1].noDirectAttackThisTurn = true; // 引擎会拒绝直接攻击
                s.players[0].monsterZone.length = 0;
            },
        });
        assert.equal(state.currentPlayerIndex, 0, "AI 回合应在有限步内结束并交回玩家");
    });

    it("目标“不能被攻击”时 AI 不会卡在该怪兽上", async () => {
        const state = await runAiBattle({
            setup: (s) => {
                const attacker = createCardInstance(mk({ id: "ai_atk_2", name: "AI怪兽", attack: 1500 }));
                attacker.canAttack = true;
                attacker.setTurn = 1;
                s.players[1].monsterZone.push(attacker);
                const protectedMonster = createCardInstance(mk({ id: "prot_x", name: "受保护怪兽", attack: 500, defense: 500 }));
                protectedMonster.cannotBeAttacked = true;
                s.players[0].monsterZone.push(protectedMonster);
            },
        });
        assert.equal(state.currentPlayerIndex, 0, "AI 回合应在有限步内结束并交回玩家");
    });

    it("_skipAiAttack 会消耗该怪兽本回合的攻击机会", () => {
        const state = new GameState();
        state.players = [new Player("人类", []), new Player("AI", [])];
        const engine = new GameEngine(state);
        const controller = new GameController(state, engine, aiUi());
        const monster = createCardInstance(mk({ id: "skip_x", name: "被跳过的怪兽" }));
        monster.canAttack = true;
        controller._skipAiAttack(monster);
        assert.equal(monster.canAttack, false);
        assert.equal(monster.hasAttackedThisTurn, true);
        assert.ok(monster.attacksMadeThisTurn >= 1);
    });
});

// ---------------------------------------------------------------------------
describe("抽卡重复保护", () => {
    const pool = ALL_CARDS.filter(card => card.series !== "starter_ygo" && card.series !== "starter_n");

    it("整包全是重复卡时替换出一张未拥有的卡", () => {
        const owned = new Set(pool.slice(0, 200).map(card => card.id));
        const collection = { cards: {} };
        for (const id of owned) collection.cards[id] = 3;
        const duplicatePack = pool.slice(0, 8).map(card => ({ ...card }));
        const result = applyDuplicateProtection(duplicatePack, pool, collection);
        assert.ok(result.replaced, "应替换一张新卡");
        assert.equal(owned.has(result.replaced.id), false, "替换出来的必须是未拥有的卡");
        assert.equal(result.cards.length, duplicatePack.length);
        assert.ok(result.cards.some(card => !owned.has(card.id)));
    });

    it("包里已经有新卡时不改动", () => {
        const collection = { cards: {} };
        const pack = pool.slice(0, 8).map(card => ({ ...card }));
        const result = applyDuplicateProtection(pack, pool, collection);
        assert.equal(result.replaced, null);
        assert.deepEqual(result.cards.map(c => c.id), pack.map(c => c.id));
    });

    it("已集齐全部卡时保持原样且不报错", () => {
        const collection = { cards: {} };
        for (const card of pool) collection.cards[card.id] = 3;
        const pack = pool.slice(0, 8).map(card => ({ ...card }));
        const result = applyDuplicateProtection(pack, pool, collection);
        assert.equal(result.replaced, null);
        assert.equal(result.cards.length, 8);
    });

    it("连续开包时每一包都至少有一张新卡（直到集齐）", () => {
        const collection = { cards: {} };
        let guard = 0;
        while (Object.keys(collection.cards).length < pool.length - 8 && guard < 400) {
            guard++;
            const opened = openPack(NIGHTCORD_PACK, pool, new RandomSource(), 0);
            const protectedPack = applyDuplicateProtection(opened.cards, pool, collection);
            const fresh = protectedPack.cards.filter(card => !collection.cards[card.id]);
            assert.ok(fresh.length >= 1, `第 ${guard} 包应至少 1 张新卡`);
            for (const card of protectedPack.cards) collection.cards[card.id] = (collection.cards[card.id] || 0) + 1;
        }
        assert.ok(guard > 0);
    });
});

// ---------------------------------------------------------------------------
describe("起手重抽", () => {
    it("mulligan 把手牌洗回卡组并重新抽满 5 张", () => {
        const { state, engine } = createGame({ turn: 1 });
        const player = state.players[0];
        for (let i = 0; i < 5; i++) engine.drawCard(player);
        const before = player.hand.map(card => card.instanceId);
        const deckBefore = player.deck.length;
        const result = engine.mulligan(player);
        assert.equal(result.success, true);
        assert.equal(result.count, 5);
        assert.equal(player.hand.length, 5);
        assert.equal(player.deck.length, deckBefore);
        assert.equal(player.hand.filter(card => before.includes(card.instanceId)).length < 5, true,
            "重抽后应换成不同的牌");
    });

    it("只有'无牌可出'的起手才建议重抽", () => {
        const state = new GameState();
        state.players = [new Player("人类", []), new Player("AI", [])];
        const engine = new GameEngine(state);
        const controller = new GameController(state, engine, aiUi());
        const onlyTribute = { hand: [createCardInstance(mk({ level: 7 })), createCardInstance(mk({ level: 8 })), createCardInstance({ ...mk({ type: "trap" }), type: "trap", effects: [] })] };
        const playable = { hand: [createCardInstance(mk({ level: 4 }))] };
        assert.equal(controller.wantsMulligan(onlyTribute), true);
        assert.equal(controller.wantsMulligan(playable), false);
    });

    it("start() 会先询问起手重抽，重抽后手牌确实换了一批", () => {
        // 用确定性随机源：洗牌结果可复现，避免"可能又抽到同一批牌"导致的偶发失败
        const rng = seededRandom(20260101);
        const state = new GameState();
        state.players = [
            new Player("人类", Array.from({ length: 20 }, () => mk()), rng),
            new Player("AI", Array.from({ length: 20 }, () => mk()), rng),
        ];
        const engine = new GameEngine(state, rng);
        const ui = aiUi();
        let offered = null;
        ui.showMulliganChoice = (hand, callback) => { offered = hand.map(card => card.instanceId); callback(true); };
        ui.showFirstPlayerChoice = callback => callback(0);
        const controller = new GameController(state, engine, ui);
        controller.mode = "ai";
        // 重抽前记录"手牌 + 卡组"的全集，用来验证没有丢牌或复制牌
        const before = [...state.players[0].hand, ...state.players[0].deck].map(card => card.instanceId).sort();
        controller.start();
        assert.ok(offered && offered.length === 5, "应先展示 5 张起手手牌");
        assert.equal(state.players[0].hand.length, 5, "重抽后手牌仍应为 5 张");
        assert.equal(state.players[0].deck.length, 15, "卡组数量不应改变");
        const after = [...state.players[0].hand, ...state.players[0].deck].map(card => card.instanceId).sort();
        assert.deepEqual(after, before, "重抽不能丢牌或复制牌");
        assert.equal(state.players[0].hand.some(card => offered.includes(card.instanceId)), false,
            "重抽后不应还留着原来的手牌");
        assert.equal(state.currentPlayerIndex, 0, "猜拳结果应生效");
    });

    it("选择保留时手牌不变", () => {
        const state = new GameState();
        state.players = [
            new Player("人类", Array.from({ length: 20 }, () => mk())),
            new Player("AI", Array.from({ length: 20 }, () => mk())),
        ];
        const engine = new GameEngine(state);
        const ui = aiUi();
        let offered = null;
        ui.showMulliganChoice = (hand, callback) => { offered = hand.map(card => card.instanceId); callback(false); };
        ui.showFirstPlayerChoice = callback => callback(0);
        const controller = new GameController(state, engine, ui);
        controller.mode = "ai";
        controller.start();
        assert.deepEqual(state.players[0].hand.map(card => card.instanceId), offered);
    });
});

// ---------------------------------------------------------------------------
describe("卡图派生路径（WebP 管线）", () => {
    it("按约定映射到 thumb / card 两档，且对已是 webp 的路径幂等", () => {
        const original = "./assets/cards/ygo-starter/17814387.jpg";
        assert.equal(cardImageSrc(original, "thumb"), "./assets/cards/webp/thumb/ygo-starter/17814387.webp");
        assert.equal(cardImageSrc(original, "card"), "./assets/cards/webp/card/ygo-starter/17814387.webp");
        const already = "./assets/cards/webp/thumb/ygo-starter/17814387.webp";
        assert.equal(cardImageSrc(already, "thumb"), already);
        assert.equal(cardImageSrc("", "thumb"), "");
        assert.equal(cardImageSrc("./other/place/art.png", "thumb"), "./other/place/art.png");
    });

    it("applyCardImageSources 同时给出缩略图、大图与原始回退图", () => {
        const card = applyCardImageSources({ id: "x", name: "测试", image: "./assets/cards/imported/001.jpg" });
        assert.equal(card.image, "./assets/cards/webp/thumb/imported/001.webp");
        assert.equal(card.thumbnail, card.image);
        assert.equal(card.fullImage, "./assets/cards/webp/card/imported/001.webp");
        assert.equal(card.originalImage, "./assets/cards/imported/001.jpg");
    });

    it("卡池里的 368 张卡全部指向 WebP，且原始路径都保留为回退", () => {
        let withFull = 0;
        for (const card of ALL_CARDS) {
            assert.ok(card.image.startsWith("./assets/cards/webp/thumb/"), `${card.id} 未走缩略图`);
            assert.ok(card.fullImage.startsWith("./assets/cards/webp/card/"), `${card.id} 未走大图`);
            assert.ok(card.originalImage.startsWith("./assets/cards/"), `${card.id} 缺回退原图`);
            withFull++;
        }
        assert.ok(withFull > 300);
    });

    it("渲染出的 img 带 data-fallback-src，供加载失败时回退原图", () => {
        const card = applyCardImageSources({ id: "y1", name: "测试卡", image: "./assets/cards/imported/002.jpg", rarity: "N" });
        const thumbHtml = cardArtHtml(card, "x");
        assert.match(thumbHtml, /src="\.\/assets\/cards\/webp\/thumb\/imported\/002\.webp"/);
        assert.match(thumbHtml, /data-fallback-src="\.\/assets\/cards\/imported\/002\.jpg"/);
        const fullHtml = cardArtHtml(card, "x", true);
        assert.match(fullHtml, /src="\.\/assets\/cards\/webp\/card\/imported\/002\.webp"/);
    });
});

// ---------------------------------------------------------------------------
describe("战斗预览与实际结算一致", () => {
    function battleSetup({ atk = 2000, def = 1000, targetAtk = 1500, targetDef = 1000, targetPosition = MONSTER_POSITION.ATTACK, targetFlags = {}, attackerFlags = {}, direct = false, piercing = false } = {}) {
        const rng = seededRandom(4242);
        const state = new GameState();
        state.players = [new Player("我方", Array.from({ length: 12 }, () => mk()), rng), new Player("对方", Array.from({ length: 12 }, () => mk()), rng)];
        state.turn = 10;
        state.firstTurn = false;
        state.phase = PHASE.BATTLE;
        state.currentPlayerIndex = 0;
        const engine = new GameEngine(state, rng);
        const attacker = createCardInstance(mk({ id: "atk_c", name: "进攻方", attack: atk, defense: def }));
        attacker.canAttack = true;
        attacker.setTurn = 1;
        if (piercing) attacker.themedState = { piercingUntil: state.turn };
        Object.assign(attacker, attackerFlags);
        state.players[0].monsterZone.push(attacker);
        let target = "player";
        if (!direct) {
            target = createCardInstance(mk({ id: "def_c", name: "防守方", attack: targetAtk, defense: targetDef }));
            target.position = targetPosition;
            Object.assign(target, targetFlags);
            state.players[1].monsterZone.push(target);
        }
        return { state, engine, attacker, target };
    }

    const scenarios = [
        { name: "攻击表示：我强", atk: 2000, targetAtk: 1500 },
        { name: "攻击表示：我弱", atk: 1500, targetAtk: 2000 },
        { name: "攻击表示：同攻", atk: 1800, targetAtk: 1800 },
        { name: "攻击表示：双 0 攻", atk: 0, targetAtk: 0 },
        { name: "守备表示：破防", atk: 2000, targetDef: 1200, targetPosition: MONSTER_POSITION.DEFENSE },
        { name: "守备表示：撞墙", atk: 1200, targetDef: 2000, targetPosition: MONSTER_POSITION.DEFENSE },
        { name: "守备表示：同值", atk: 1500, targetDef: 1500, targetPosition: MONSTER_POSITION.DEFENSE },
        { name: "贯穿破防", atk: 2000, targetDef: 1200, targetPosition: MONSTER_POSITION.DEFENSE, piercing: true },
        { name: "目标免疫战斗伤害", atk: 2000, targetDef: 1200, targetPosition: MONSTER_POSITION.DEFENSE, piercing: true, targetFlags: { preventsBattleDamage: true } },
        { name: "目标不被战斗破坏", atk: 2000, targetAtk: 1000, targetFlags: { cannotBeDestroyedByBattle: true } },
        { name: "我方不受战斗伤害", atk: 1200, targetDef: 2000, targetPosition: MONSTER_POSITION.DEFENSE, attackerFlags: { preventsBattleDamage: true } },
        { name: "无下限减伤：攻击表示被破防", atk: 2000, targetAtk: 1500, targetFlags: { themedState: { infinityUntil: 10, infinityReduce: 300 } } },
        { name: "无下限减伤：攻击方战败", atk: 1500, targetAtk: 2000, attackerFlags: { themedState: { infinityUntil: 10, infinityReduce: 300 } } },
        { name: "无下限减伤：贯穿破防", atk: 2000, targetDef: 1200, targetPosition: MONSTER_POSITION.DEFENSE, piercing: true, targetFlags: { themedState: { infinityUntil: 10, infinityReduce: 300 } } },
        { name: "无下限减伤：攻击方撞墙", atk: 1200, targetDef: 2000, targetPosition: MONSTER_POSITION.DEFENSE, attackerFlags: { themedState: { infinityUntil: 10, infinityReduce: 300 } } },
        { name: "无下限减伤：不低于0", atk: 2000, targetAtk: 1500, targetFlags: { themedState: { infinityUntil: 10, infinityReduce: 1000 } } },
        { name: "罗针领域：受击方伤害减半并反弹", atk: 2000, targetAtk: 1500, targetFlags: { themedState: { domain: { id: "rojin", until: 10 } } } },
        { name: "直接攻击", direct: true, atk: 2300 },
    ];

    for (const scenario of scenarios) {
        it(`预览与结算一致：${scenario.name}`, () => {
            const preview = battleSetup(scenario);
            const predicted = preview.engine.predictBattle(preview.attacker, preview.target);

            // 用同一套初始条件真实结算一次，比较结论
            const actual = battleSetup(scenario);
            const defenderLpBefore = actual.state.players[1].lp;
            const attackerLpBefore = actual.state.players[0].lp;
            const result = actual.engine.attack(actual.attacker, actual.target);
            assert.equal(result.success, true, result.message);

            assert.equal(predicted.damage, Number(result.damage) || 0, `伤害预测不符：${result.message}`);
            assert.equal(predicted.damageTo, result.damageTo ?? null, `受伤方预测不符：${result.message}`);

            const attackerGone = !actual.state.players[0].monsterZone.includes(actual.attacker);
            assert.equal(predicted.attackerDestroyed, attackerGone, `我方破坏预测不符：${result.message}`);
            if (actual.target !== "player") {
                const targetGone = !actual.state.players[1].monsterZone.includes(actual.target);
                assert.equal(predicted.targetDestroyed, targetGone, `目标破坏预测不符：${result.message}`);
            } else {
                assert.equal(predicted.targetDestroyed, false);
            }
            // 顺带确认 LP 变化方向与预测一致
            if (predicted.damageTo === "defender") assert.equal(defenderLpBefore - actual.state.players[1].lp, predicted.damage);
            if (predicted.damageTo === "attacker") assert.equal(attackerLpBefore - actual.state.players[0].lp, predicted.damage);
        });
    }
});

// ---------------------------------------------------------------------------
describe("陷阱连锁响应", () => {
    function trapSetup(trapSpecs) {
        const rng = seededRandom(99);
        const state = new GameState();
        state.players = [new Player("我方", Array.from({ length: 12 }, () => mk()), rng), new Player("对方", Array.from({ length: 12 }, () => mk()), rng)];
        state.turn = 10;
        state.firstTurn = false;
        state.phase = PHASE.BATTLE;
        state.currentPlayerIndex = 0;
        const engine = new GameEngine(state, rng);
        const attacker = createCardInstance(mk({ id: "chain_atk", name: "进攻方", attack: 2000 }));
        attacker.canAttack = true;
        attacker.setTurn = 1;
        state.players[0].monsterZone.push(attacker);
        const traps = trapSpecs.map((spec, index) => {
            const trap = createCardInstance({
                id: `chain_trap_${index}`, name: spec.name, type: "trap", rarity: "N",
                effects: [{ trigger: "onAttacked", type: spec.type, value: spec.value || 0 }],
            });
            trap.faceDown = true;
            trap.canActivate = true;
            trap.setTurn = state.turn - 1;
            state.players[1].spellTrapZone.push(trap);
            return trap;
        });
        return { state, engine, attacker, traps };
    }

    it("两张减伤陷阱会依次连锁，减伤累加", () => {
        const { state, engine, attacker, traps } = trapSetup([
            { name: "减伤甲", type: "reduceDamage", value: 500 },
            { name: "减伤乙", type: "reduceDamage", value: 300 },
        ]);
        const lpBefore = state.players[1].lp;
        const result = engine.attack(attacker, "player");
        assert.equal(result.success, true, result.message);
        assert.equal(lpBefore - state.players[1].lp, 2000 - 800, "两次减伤应累加");
        assert.ok(state.players[1].graveyard.includes(traps[0]), "第一张陷阱应进墓地");
        assert.ok(state.players[1].graveyard.includes(traps[1]), "第二张陷阱应进墓地");
        assert.equal(state.players[1].spellTrapZone.length, 0);
    });

    it("第一张陷阱取消攻击后不再连锁后面的陷阱", () => {
        const { state, engine, attacker, traps } = trapSetup([
            { name: "取消攻击", type: "destroyAttacker", value: 0 },
            { name: "减伤乙", type: "reduceDamage", value: 300 },
        ]);
        const lpBefore = state.players[1].lp;
        const result = engine.attack(attacker, "player");
        assert.equal(result.success, true, result.message);
        assert.equal(state.players[1].lp, lpBefore, "攻击被取消，不应造成伤害");
        assert.equal(state.players[0].monsterZone.includes(attacker), false, "destroyAttacker 应破坏攻击怪兽");
        assert.ok(state.players[1].graveyard.includes(traps[0]), "第一张陷阱已结算");
        assert.equal(state.players[1].spellTrapZone.includes(traps[1]), true, "攻击已取消，第二张陷阱不应被消耗");
        assert.equal(traps[1].faceDown, true);
    });

    it("只有一张陷阱时行为与改造前一致", () => {
        const { state, engine, attacker, traps } = trapSetup([{ name: "唯一陷阱", type: "reduceDamage", value: 600 }]);
        const lpBefore = state.players[1].lp;
        engine.attack(attacker, "player");
        assert.equal(lpBefore - state.players[1].lp, 1400);
        assert.ok(state.players[1].graveyard.includes(traps[0]));
    });

    it("未经过回合交换的盖放陷阱不会响应", () => {
        const { state, engine, attacker, traps } = trapSetup([{ name: "刚盖的陷阱", type: "reduceDamage", value: 600 }]);
        traps[0].setTurn = state.turn;
        traps[0].canActivate = false;
        const lpBefore = state.players[1].lp;
        engine.attack(attacker, "player");
        assert.equal(lpBefore - state.players[1].lp, 2000);
        assert.equal(state.players[1].spellTrapZone.includes(traps[0]), true, "不符合时机的陷阱不应被消耗");
    });
});

// ---------------------------------------------------------------------------
describe("局内反馈：未完成动作提示与结束回合确认", () => {
    it("pendingActions 能识别未使用的召唤与可攻击怪兽", () => {
        const { state, engine } = createGame({ turn: 10, phase: PHASE.MAIN_1 });
        const controller = new GameController(state, engine, aiUi());
        state.players[0].hand = [createCardInstance(mk({ id: "sum_x", name: "低星怪兽", level: 3 }))];
        state.players[0].monsterZone = [];
        let reasons = controller.pendingActions();
        assert.ok(reasons.some(item => item.id === "summon"), "手牌有可召唤怪兽时应提示");

        state.players[0].normalSummonUsed = true;
        const attacker = createCardInstance(mk({ id: "atk_x", name: "可攻击", attack: 1800 }));
        attacker.canAttack = true;
        attacker.faceUp = true;
        state.players[0].monsterZone = [attacker];
        reasons = controller.pendingActions();
        assert.ok(reasons.some(item => item.id === "attack"), "有可攻击怪兽时应提示");
    });

    it("还有操作时先弹确认，确认后才真正结束回合", () => {
        const { state, engine } = createGame({ turn: 10, phase: PHASE.MAIN_1 });
        const asks = [];
        const ui = aiUi();
        ui.showTurnEndConfirm = (reasons, callback) => { asks.push(reasons); };
        const controller = new GameController(state, engine, ui);
        controller.mode = "ai";
        state.players[0].hand = [createCardInstance(mk({ id: "sum_y", name: "低星怪兽", level: 3 }))];
        state.players[0].monsterZone = [];
        const turnBefore = state.turn;

        controller.endTurn();
        assert.equal(asks.length, 1, "应该弹出一次确认");
        assert.equal(state.turn, turnBefore, "未确认时不应结束回合");

        controller.endTurn(true);
        assert.equal(state.currentPlayerIndex, 1, "确认后应交给对手");
    });

    it("没有可执行操作时直接结束回合，不打扰玩家", () => {
        const { state, engine } = createGame({ turn: 10, phase: PHASE.MAIN_1 });
        const asks = [];
        const ui = aiUi();
        ui.showTurnEndConfirm = (reasons, callback) => asks.push(reasons);
        const controller = new GameController(state, engine, ui);
        controller.mode = "ai";
        state.players[0].hand = [];
        state.players[0].monsterZone = [];
        state.players[0].normalSummonUsed = true;
        state.players[0].skipBattlePhase = true;
        controller.endTurn();
        assert.equal(asks.length, 0, "没有待办动作时不应弹确认");
        assert.equal(state.currentPlayerIndex, 1);
    });
});

// ---------------------------------------------------------------------------
describe("音效层", () => {
    it("在无 WebAudio 的环境里是安全空操作", () => {
        assert.equal(typeof audio.playSound("attack"), "boolean");
        assert.equal(audio.playSound("nonexistent-sound"), false);
        assert.equal(audio.isSoundEnabled(), true);
    });

    it("开关可以切换", () => {
        assert.equal(audio.setSoundEnabled(false), false);
        assert.equal(audio.playSound("attack"), false, "关闭后不应播放");
        assert.equal(audio.setSoundEnabled(true), true);
    });

    it("稀有度变调单调递增", () => {
        const ranks = ["N", "R", "SR", "SSR", "UR"].map(audio.pitchForRarity);
        for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i] > ranks[i - 1]);
    });
});

// ---------------------------------------------------------------------------
describe("新手教学", () => {
    it("教学步骤结构合法：等待的动作名必须是实际存在的钩子", () => {
        const knownActions = new Set(["summon", "set", "attack", "endTurn", "turnStart", "trap"]);
        assert.ok(TUTORIAL_STEPS.length >= 6, "至少要有 6 步");
        for (const step of TUTORIAL_STEPS) {
            assert.ok(step.id && step.title && step.text, `步骤 ${step.id} 缺少必要字段`);
            if (step.waitFor) assert.ok(knownActions.has(step.waitFor), `未知的等待动作: ${step.waitFor}`);
        }
        assert.equal(TUTORIAL_STEPS.filter(step => step.finish).length, 1, "应有且仅有一个结束步骤");
    });

    it("教学关键卡可用：强白板怪兽、弱目标怪、陷阱都能从卡池找到", () => {
        assert.ok(TUTORIAL_CARDS.learner, "缺少教学用低星怪兽");
        assert.ok(TUTORIAL_CARDS.dummy, "缺少教学用弱怪");
        assert.ok(TUTORIAL_CARDS.trap, "缺少教学用陷阱");
        assert.equal(TUTORIAL_CARDS.learner.type, "monster");
        assert.ok((TUTORIAL_CARDS.learner.level || 0) <= 4, "教学模式怪必须是 4 星以下（免祭品）");
        assert.ok((TUTORIAL_CARDS.learner.effects?.length || 0) <= 1, "教学怪最多带一个简单招牌效果");
        assert.equal(TUTORIAL_CARDS.learner.series, "starter_ygo", "教学怪应来自入门卡，效果简单");
        assert.ok((TUTORIAL_CARDS.dummy.attack || 0) < (TUTORIAL_CARDS.learner.attack || 0),
            "被攻击的假想怪必须明显弱于教学怪，保证第 2 步一定打得赢");
        assert.equal(TUTORIAL_CARDS.trap.type, "trap");
    });

    it("教学卡组是 40 张合法卡组（同名 ≤3 张）", () => {
        const decks = buildTutorialDecks();
        for (const [name, deck] of Object.entries({ player: decks.player, opponent: decks.opponent })) {
            assert.equal(deck.length, 40, `${name} 卡组应为 40 张`);
            const counts = {};
            for (const id of deck) counts[id] = (counts[id] || 0) + 1;
            for (const [id, count] of Object.entries(counts)) {
                assert.ok(count <= 3, `${name} 卡组里 ${id} 有 ${count} 张，超过同名上限`);
            }
            assert.ok(deck.every(id => getCardById(id)), `${name} 卡组引用了不存在的卡`);
        }
    });

    it("固定起手里一定有第 1、3 步需要的牌", () => {
        const decks = buildTutorialDecks();
        const ordered = orderTutorialDeck(decks.player, [TUTORIAL_CARDS.learner, TUTORIAL_CARDS.trap]);
        const hand = ordered.slice(0, 5).map(id => getCardById(id));
        assert.ok(hand.some(card => card.type === "monster" && (card.level || 0) <= 4), "起手必须有可召唤的低星怪兽");
        assert.ok(hand.some(card => card.type === "trap"), "起手必须有可盖放的陷阱");
        assert.equal(ordered.length, decks.player.length, "排序不应增删卡牌");
    });

    it("教练按动作推进，且只有当前步骤等待的动作生效", () => {
        const shown = [];
        const ui = { showCoach: payload => shown.push(payload), hideCoach: () => shown.push({ hidden: true }) };
        const coach = new TutorialCoach({ ui });
        coach.start();
        assert.equal(shown.length, 1);
        assert.equal(coach.currentExpectation, null, "第 1 步是纯信息，没有等待动作");

        // 信息步需要玩家点「下一步」
        coach.advance();
        assert.equal(coach.currentExpectation, "summon");

        // 非当前步骤的动作不应推进
        assert.equal(coach.notify("attack"), false);
        assert.equal(coach.currentExpectation, "summon");

        assert.equal(coach.notify("summon"), true);
        assert.equal(coach.currentExpectation, "set");
        coach.notify("set");
        assert.equal(coach.currentExpectation, "endTurn");
        coach.notify("endTurn");
        assert.equal(coach.currentExpectation, "trap");
        coach.notify("trap");
        assert.equal(coach.currentExpectation, "attack");
        coach.notify("attack");
        assert.equal(coach.step.id, "mulligan");
    });

    it("第 4 步（陷阱演示）要求 AI 主动进攻", () => {
        const ui = { showCoach: () => {}, hideCoach: () => {} };
        const coach = new TutorialCoach({ ui });
        coach.start();
        for (const action of ["summon", "set", "endTurn"]) {
            if (!coach.currentExpectation) coach.advance();
            coach.notify(action);
        }
        assert.equal(coach.currentExpectation, "trap");
        assert.equal(coach.forceAiAttack, true, "陷阱演示步骤需要强制 AI 进攻");
        coach.notify("trap");
        assert.equal(coach.forceAiAttack, false, "离开该步骤后应恢复正常 AI");
    });

    it("跳过教学会通知外部且不抛错", () => {
        const ui = { showCoach: () => {}, hideCoach: () => {} };
        let finished = null;
        const coach = new TutorialCoach({ ui, onFinish: payload => { finished = payload; } });
        coach.start();
        coach.skip();
        assert.deepEqual(finished, { completed: false, skipped: true });
        assert.equal(coach.notify("summon"), false, "跳过之后不再响应动作");
    });

    it("没有 DOM 环境时教练不抛错（ui 为空）", () => {
        const coach = new TutorialCoach({});
        assert.doesNotThrow(() => coach.start());
        assert.doesNotThrow(() => coach.advance());
        assert.doesNotThrow(() => coach.skip());
    });

    it("端到端：按教练提示打完整套教学，教练能一路推进到最后", async () => {
        // 用与 main.js 相同的路径搭一局教学，然后用真实引擎打完这几步
        const decks = buildTutorialDecks();
        const learner = getCardById(TUTORIAL_CARDS.learner.id);
        const trapCard = getCardById(TUTORIAL_CARDS.trap.id);
        const dummy = getCardById(TUTORIAL_CARDS.dummy.id);
        const state = new GameState();
        state.players = [
            new Player("你", orderTutorialDeck(decks.player, [learner, trapCard]).map(getCardById).filter(Boolean), null, true),
            new Player("教学对手", orderTutorialDeck(decks.opponent, [dummy]).map(getCardById).filter(Boolean), null, true),
        ];
        const engine = new GameEngine(state);
        const ui = aiUi();
        ui.showCoach = () => {};
        ui.hideCoach = () => {};
        const controller = new GameController(state, engine, ui);
        controller.mode = "ai";
        controller.mulliganDisabled = true;   // 教学模式跳过重抽浮层
        controller.aiActionDelay = 1;
        const coach = new TutorialCoach({ ui });
        controller.tutorial = coach;
        // 对手预置一只弱怪，供第 2 步攻击、以及第 5 步演示陷阱
        state.players[1].monsterZone.push(createCardInstance(dummy));
        state.players[1].deck = state.players[1].deck.filter(card => card.id !== dummy.id);

        coach.start();
        controller.start();                    // 抽初始手牌并进入首回合
        assert.equal(coach.step.id, "welcome");
        assert.equal(state.players[0].hand.length, 5);
        assert.equal(coach.notify("summon"), false, "第 1 步是信息步，动作不推进");
        coach.advance();

        // 第 1 步：通常召唤
        assert.equal(coach.currentExpectation, "summon");
        const learnerIndex = state.players[0].hand.findIndex(card => card.id === learner.id);
        assert.ok(learnerIndex >= 0, "起手必须有教学怪兽");
        controller.summonMonster(learnerIndex, MONSTER_POSITION.ATTACK, false);
        controller._releaseEffectLocks();      // 真机上是等动画播完，测试里直接解锁
        assert.equal(state.players[0].monsterZone.length, 1);
        assert.equal(coach.currentExpectation, "set");

        // 第 2 步：盖放陷阱（先攻首回合不能攻击，所以先教盖牌）
        assert.equal(coach.currentExpectation, "set");
        const trapIndex = state.players[0].hand.findIndex(card => card.type === "trap");
        assert.ok(trapIndex >= 0, "起手必须有陷阱");
        controller.setCard(trapIndex);
        controller._releaseEffectLocks();
        assert.equal(state.players[0].spellTrapZone.length, 1);
        assert.equal(coach.currentExpectation, "endTurn");

        // 第 3 步：结束回合（教学模式下不弹确认框）
        controller.endTurn();
        assert.equal(state.currentPlayerIndex, 1, "回合应交给对手");
        assert.equal(coach.currentExpectation, "trap");
        // 等待抽卡演出完成的微任务，再进入手动驱动的 AI 战斗步骤。
        await Promise.resolve();
        await Promise.resolve();
        controller.clearAiTimer();

        // 第 4 步：对手强制进攻 → 陷阱响应
        assert.equal(coach.forceAiAttack, true);
        const trap = state.players[0].spellTrapZone[0];
        trap.setTurn = 1;
        trap.canActivate = true;
        state.players[1].monsterZone.push(createCardInstance(dummy));
        const aiAttacker = state.players[1].monsterZone[0];
        aiAttacker.canAttack = true;
        aiAttacker.setTurn = 1;
        state.phase = PHASE.BATTLE;
        controller._runAiBattleStep();
        controller.clearAiTimer();
        controller._releaseEffectLocks();     // 陷阱演出会锁操作，真机上是等动画播完
        assert.equal(state.players[0].spellTrapZone.length, 0, "陷阱应已发动并送墓");
        assert.equal(state.players[0].graveyard.some(card => card.id === trapCard.id), true);
        assert.equal(coach.currentExpectation, "attack", "陷阱发动后应进入攻击教学");

        // 第 5 步：玩家的第 2 回合——这时才可以攻击
        state.currentPlayerIndex = 0;
        state.firstTurn = false;
        state.turn = 3;
        engine.startTurn({ skipDraw: true });
        state.phase = PHASE.MAIN_1;
        const attacker = state.players[0].monsterZone[0];
        attacker.canAttack = true;
        attacker.hasAttackedThisTurn = false;
        const target = state.players[1].monsterZone[0];
        assert.ok(target, "对手场上应有可攻击的目标");
        controller.selectAttacker(attacker);
        assert.equal(state.phase, PHASE.BATTLE, "点击可攻击怪兽应自动进入战斗阶段");
        controller.attackTarget(target);
        controller._releaseEffectLocks();
        assert.equal(state.players[1].monsterZone.length, 0, "教学兽应能击破弱怪");
        assert.notEqual(coach.currentExpectation, "attack", "攻击后教练应推进");

        // 收尾：走到最后一步并完成
        while (!coach.step.finish) coach.advance();
        let finished = null;
        coach.onFinish = payload => { finished = payload; };
        coach.advance();
        assert.deepEqual(finished, { completed: true, skipped: false });
        controller.tutorial = null;
    });
});

// ---------------------------------------------------------------------------
describe("稀有度与奖励数值", () => {
    it("UR 高于 SSR", () => {
        assert.ok(rarityRank("UR") > rarityRank("SSR"));
        assert.equal(rarityRank("SSR") > rarityRank("SR"), true);
    });

    it("关卡/普通AI胜利都会结算每日首胜奖励", () => {
        const stats = { firstWinToday: null };
        const aiResult = calculateMatchReward("win", { mode: "ai", statistics: stats });
        assert.ok(aiResult.bonuses.some(bonus => bonus.id === "first_win_of_day"), "普通AI胜利应含每日首胜");

        const stageResult = calculateMatchReward("win", { mode: "ai", stage: { id: "s1", name: "第一关", reward: 200 }, statistics: stats });
        assert.equal(stageResult.duelCoins, 200 + 300);
        assert.ok(stageResult.bonuses.some(bonus => bonus.id === "first_win_of_day"), "关卡胜利也应含每日首胜");

        const trainingResult = calculateMatchReward("win", { mode: "training", statistics: stats });
        assert.equal(trainingResult.duelCoins, 0);
        assert.equal(trainingResult.bonuses.length, 0);
    });
});

// ---------------------------------------------------------------------------
describe("卡包保底", () => {
    // getPackPool 会排除 starter_n / starter_ygo 系列，测试卡池必须同样过滤
    const pool = ALL_CARDS.filter(card => card.series !== "starter_ygo" && card.series !== "starter_n");

    it("第50抽必定为UR", () => {
        assert.ok(getEffectiveRates(50).UR < 1, "第50包不应把每个卡位都变成UR");
        for (let i = 0; i < 10; i++) {
            const opened = openPack(NIGHTCORD_PACK, pool, new RandomSource(), 49);
            assert.equal(opened.success, true, opened.reason);
            const urCount = opened.cards.filter(card => card.rarity === "UR").length;
            assert.equal(opened.cards.length, 1);
            assert.equal(urCount, 1, `第50抽必须是UR，实际${urCount}`);
        }
    });

    it("十连没有 SR 以上时按承诺补一张", () => {
        const onlyLow = pool.filter(card => ["N", "R", "SR"].includes(card.rarity));
        const opened = openTenPacks(NIGHTCORD_PACK, onlyLow, new RandomSource(), 0);
        assert.equal(opened.success, true);
        const hasHigh = opened.cards.some(card => ["SR", "SSR", "UR"].includes(card.rarity));
        assert.equal(PACK_GUARANTEE.tenPack.minRarity, "SR");
        assert.equal(hasHigh, true);
    });

    it("十连返回的 packsSinceUR 与逐包维护一致", () => {
        const opened = openTenPacks(NIGHTCORD_PACK, pool, new RandomSource(), 0);
        assert.equal(typeof opened.packsSinceUR, "number");
        assert.ok(opened.packsSinceUR >= 0 && opened.packsSinceUR <= 10);
    });
});

// ---------------------------------------------------------------------------
describe("RNG 与洗牌", () => {
    it("SeededRandom(0) 是确定性种子", () => {
        const a = new SeededRandom(0);
        const b = new SeededRandom(0);
        assert.equal(a.next(), b.next());
    });

    it("shuffleArray 接受随机源对象（PvP 传入 SeededRandom 实例）", () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8];
        const output = shuffleArray(input, new SeededRandom("seed-1"));
        assert.equal(output.length, input.length);
        assert.deepEqual([...output].sort((x, y) => x - y), input);
        assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8], "不应修改输入数组");
    });
});

// ---------------------------------------------------------------------------
describe("预设卡组与建议卡组", () => {
    function ownedProfile(cards) {
        const profile = createNewProfile();
        for (const card of cards) profile.cards[card.id] = 3;
        return profile;
    }

    it("AI 预设卡组满足 40~60 张且同名不超过 3 张", () => {
        const profile = createNewProfile();
        const referenced = AI_FALLBACK_DECK.main.map(getCardById).filter(Boolean);
        for (const card of referenced) profile.cards[card.id] = 3;
        const validation = validateDeck({ id: "ai_fallback", name: "AI", main: [...AI_FALLBACK_DECK.main] }, ALL_CARDS, profile);
        assert.equal(validation.valid, true, validation.errors.join("; "));
    });

    it("buildSuggestedDeck 在卡牌足够时返回 40 张合法卡组", () => {
        const owned = ALL_CARDS.filter(card => card.series !== "starter_ygo").slice(0, 20);
        const profile = ownedProfile(owned);
        const suggested = buildSuggestedDeck({ collection: profile, cardDatabase: ALL_CARDS, size: 40 });
        assert.equal(suggested.length, 40, `应为40张，实际${suggested.length}`);
        const validation = validateDeck({ id: "suggested", name: "建议卡组", main: suggested }, ALL_CARDS, profile);
        assert.equal(validation.valid, true, validation.errors.join("; "));
    });
});

// ---------------------------------------------------------------------------
describe("试玩模式与卡组战力排序", () => {
    it("enableDemoMode 是幂等的（重复启动不会变成 3N 张）", () => {
        const profile = createNewProfile();
        enableDemoMode(profile, ALL_CARDS);
        const after1 = { ...profile.cards };
        enableDemoMode(profile, ALL_CARDS);
        assert.deepEqual(profile.cards, after1);
        assert.ok(Object.values(profile.cards).every(count => count <= 3));
    });

    it("deckBattleValue 对 priority=0 的卡继续使用稀有度/攻守估算", () => {
        const plain = { id: "plain", name: "普通卡", type: "monster", rarity: "UR", attack: 2000, defense: 2000, aiHints: { priority: 0 }, effects: [] };
        const designed = { id: "designed", name: "设计卡", type: "monster", rarity: "N", attack: 100, defense: 100, aiHints: { priority: 500 }, effects: [] };
        assert.ok(deckBattleValue(plain) > 0, "priority=0 的卡应回退到估算值");
        assert.equal(deckBattleValue(designed), 500);
    });

    it("目录中的每张卡都有对应的效果处理器（数据与实现不脱节）", async () => {
        const { hasEffectHandler } = await import("../js/engine.js");
        const missing = new Set();
        for (const card of ALL_CARDS) {
            for (const effect of (card.effects || [])) {
                if (effect?.type && !hasEffectHandler(effect.type)) missing.add(effect.type);
            }
        }
        assert.deepEqual([...missing], []);
    });

    it("every card id referenced by the AI deck exists in the catalogue", () => {
        for (const id of AI_FALLBACK_DECK.main) {
            assert.ok(getCardById(id), `AI 卡组引用了不存在的卡 ${id}`);
        }
    });
});

// ---------------------------------------------------------------------------
describe("陷阱卡池平衡约束（第五轮）", () => {
    const trapsOf = pool => pool.filter(card => card.type === "trap" && card.enabled !== false);

    it("无效化陷阱占比不超过一半，且六种无效化行动都仍有代表", async () => {
        const { ATTACK_NEGATING_ACTIONS } = await import("../js/themed-effects.js");
        const { isNegationTrap } = await import("../js/engine.js");
        const traps = trapsOf(ALL_CARDS);
        const negating = traps.filter(isNegationTrap);
        assert.ok(negating.length / traps.length <= 0.5,
            `无效化陷阱占比 ${(negating.length / traps.length * 100).toFixed(1)}% 超过一半，陷阱会退化成同一种玩法`);
        for (const action of ATTACK_NEGATING_ACTIONS) {
            const owner = traps.find(card => (card.effects || []).some(effect => effect.action === action));
            assert.ok(owner, `没有任何陷阱带有 ${action} 效果，这种反击身份消失了`);
        }
    });

    it("非无效化陷阱不取消攻击，但效果照常结算", async () => {
        const { isNegationTrap, GameEngine } = await import("../js/engine.js");
        const trap = createCardInstance({
            id: "poison_attack_trap", name: "毒印伏击", type: "trap", rarity: "R", attribute: "dark",
            effects: [{ type: "themedAction", action: "poison", trigger: "onAttacked", skillName: "毒印伏击", params: { damage: 600 } }],
            description: "对方攻击宣言时，给攻击怪兽放置毒印。",
        });
        assert.equal(isNegationTrap(trap), false, "毒印伏击应是「不取消攻击」的身份");

        const rng = seededRandom(7);
        const state = new GameState();
        state.players = [new Player("我方", Array.from({ length: 10 }, () => mk()), rng), new Player("对方", Array.from({ length: 10 }, () => mk()), rng)];
        state.turn = 10; state.firstTurn = false; state.phase = PHASE.BATTLE; state.currentPlayerIndex = 0;
        const engine = new GameEngine(state, rng);
        const attacker = createCardInstance(mk({ id: "atk_5", attack: 2000 }));
        attacker.canAttack = true; attacker.setTurn = 1;
        state.players[0].monsterZone.push(attacker);
        for (let i = 0; i < 3; i++) state.players[1].graveyard.push(createCardInstance(mk({ id: `gy_${i}`, level: 6 })));
        trap.faceDown = true; trap.canActivate = true; trap.setTurn = state.turn - 1;
        state.players[1].spellTrapZone.push(trap);
        const defendersHand = state.players[1].hand.length;
        const cost = trap.effects.find(effect => effect.cost)?.cost?.value || 0;

        const result = engine.attack(attacker, "player");
        assert.equal(result.success, true, result.message);
        assert.ok(!result.attackCanceled, "非无效化陷阱不应该取消这次攻击");
        assert.equal(state.players[1].lp, 8000 - 2000 - cost, "攻击伤害应当照常打到玩家身上");
        assert.ok(state.players[1].graveyard.includes(trap), "陷阱应当已结算进墓地");
        assert.equal(attacker.themedState?.poisonTurn, state.turn, "毒印应挂在攻击怪兽身上");
        assert.equal(state.players[1].hand.length, defendersHand, "单一毒印效果不应额外抽卡");
    });

    it("高稀有度陷阱不再统一征收LP，玩家可以放弃发动", async () => {
        const { GameEngine } = await import("../js/engine.js");
        const template = getCardById("source_trap_037");
        const probe = createCardInstance(template);
        assert.notEqual(probe.effects[0].cost?.type, "payLife", "稀有度不能自动换算成LP费用");
        assert.doesNotMatch(template.description, /支付(?:600|1000)LP/, "卡面不能残留统一LP税");

        const build = (lp) => {
            const rng = seededRandom(11);
            const state = new GameState();
            state.players = [new Player("我方", Array.from({ length: 10 }, () => mk()), rng), new Player("对方", Array.from({ length: 10 }, () => mk()), rng)];
            state.turn = 10; state.firstTurn = false; state.phase = PHASE.BATTLE; state.currentPlayerIndex = 0;
            const engine = new GameEngine(state, rng);
            const attacker = createCardInstance(mk({ id: `atk_${lp}`, attack: 200 }));
            attacker.canAttack = true; attacker.setTurn = 1;
            state.players[0].monsterZone.push(attacker);
            state.players[0].graveyard.push(createCardInstance(mk({ id: `foe_gy_${lp}`, level: 6 })));
            state.players[1].lp = lp;
            const set = createCardInstance(template);
            set.faceDown = true; set.canActivate = true; set.setTurn = state.turn - 1;
            state.players[1].spellTrapZone.push(set);
            return { state, engine, attacker, set };
        };

        const duel = build(8000);
        duel.engine.trapActivationDecider = () => false;
        const result = duel.engine.attack(duel.attacker, "player");
        assert.equal(result.success, true, result.message);
        assert.ok(duel.state.players[1].spellTrapZone.includes(duel.set), "选择不发动时陷阱必须留场");
        assert.equal(duel.state.players[1].lp, 7800, "拒绝发动时只承受攻击伤害");
    });

    it("未知主题行动既不会被结算，也不会被当成无效化攻击", async () => {
        const { themedEffectHandlers } = await import("../js/themed-effects.js");
        const battle = { canceled: false, reduction: 0 };
        const result = themedEffectHandlers.themedAction({
            effect: { type: "themedAction", action: "not_implemented_yet", skillName: "未实装" },
            player: { monsterZone: [], graveyard: [], hand: [], deck: [], banished: [], spellTrapZone: [] },
            opponent: { monsterZone: [], graveyard: [] },
            card: { type: "trap", effects: [] },
            gameState: { turn: 3 },
            battle,
        });
        assert.equal(result, null, "未实装行动应返回 null，而不是静默生效");
        assert.equal(battle.canceled, false, "未知行动绝不能默认变成「这次攻击无效」");
    });
});

// ---------------------------------------------------------------------------
describe("后场对策（第六轮）", () => {
    const BACKROW_ANSWERS = new Set(["destroySpellTrap", "destroyAllEnemySpellTraps", "bounceBackrow", "disarm"]);

    function spellDuel() {
        const rng = seededRandom(21);
        const state = new GameState();
        state.players = [new Player("我方", Array.from({ length: 10 }, () => mk()), rng), new Player("对方", Array.from({ length: 10 }, () => mk()), rng)];
        state.turn = 10; state.firstTurn = false; state.phase = PHASE.MAIN_1; state.currentPlayerIndex = 0;
        return { state, engine: new GameEngine(state, rng) };
    }

    it("卡池里必须有足够多的卡能拆掉对手盖放的卡（否则陷阱无法被回答）", () => {
        const answers = ALL_CARDS.filter(card => card.enabled !== false
            && (card.effects || []).some(effect => BACKROW_ANSWERS.has(effect.action || effect.type)));
        assert.ok(answers.length >= 6, `能拆后场的卡只有 ${answers.length} 张，盖下去的陷阱又变成无法回答的`);
        assert.ok(answers.every(card => (card.effects.find(e => BACKROW_ANSWERS.has(e.action || e.type))?.cost?.value || 0) === 0),
            "拆后场的卡不应自带 LP 费用，否则 1 换 1 拆盖牌是亏的");
    });

    it("拆解可以在我方回合先拆掉盖放的陷阱，让这次攻击安全落地", async () => {
        const { state, engine } = spellDuel();
        const [me, foe] = state.players;
        const spell = createCardInstance(getCardById("picture_ex_006"));
        me.hand.push(spell);
        const trap = createCardInstance(getCardById("source_trap_023"));
        trap.faceDown = true; trap.canActivate = true; trap.setTurn = state.turn - 1;
        foe.spellTrapZone.push(trap);

        const cast = engine.activateSpell(me, me.hand.indexOf(spell));
        assert.equal(cast.success, true, cast.message);
        assert.equal(foe.spellTrapZone.length, 0, "盖放的陷阱应被拆掉");
        assert.ok(foe.graveyard.includes(trap), "被拆的陷阱进对方墓地");
        assert.equal(trap.faceDown, false, "进墓地后不应还是盖放状态");

        const attacker = createCardInstance(mk({ id: "atk_disarm", attack: 1800 }));
        attacker.canAttack = true; attacker.setTurn = 1;
        me.monsterZone.push(attacker);
        state.phase = PHASE.BATTLE;
        const swing = engine.attack(attacker, "player");
        assert.equal(swing.success, true, swing.message);
        assert.ok(!swing.attackCanceled, "陷阱已经被拆掉，这次攻击不该再被无效");
        assert.equal(foe.lp, 8000 - 1800);
    });

    it("拆解只在对方有「盖放」的卡时满足发动条件", async () => {
        const { state, engine } = spellDuel();
        const [me, foe] = state.players;
        const spell = createCardInstance(getCardById("picture_ex_006"));
        me.hand.push(spell);
        assert.equal(engine.canActivateThemedEffect(me, spell, spell.effects[0]), false,
            "对方后场没有盖牌时不应允许发动拆解");

        const trap = createCardInstance(getCardById("source_trap_025"));
        trap.faceDown = true; trap.canActivate = true; trap.setTurn = state.turn - 1;
        foe.spellTrapZone.push(trap);
        assert.equal(engine.canActivateThemedEffect(me, spell, spell.effects[0]), true, "有盖牌后应可以发动");

        trap.faceDown = false;
        assert.equal(engine.canActivateThemedEffect(me, spell, spell.effects[0]), false,
            "已经翻开的卡不在拆除范围内，避免把对手正在生效的卡也算进来");
    });
});


describe("决斗结算与交互锁回归", () => {
    for (const defending of [false, true]) it(`返回手牌不应清除本次战斗的免伤：${defending ? "守方贯穿" : "攻击方败北"}`, () => {
        const { state, engine } = createGame({ phase: PHASE.BATTLE });
        const immune = createCardInstance(mk({ attack: 500, defense: 500, effects: [{ type: "reviveToHand", trigger: "onDestroyed" }] }));
        const strong = createCardInstance(mk({ attack: 2000 }));
        immune.preventsBattleDamage = true;
        strong.piercingDamage = true;
        const attacker = defending ? strong : immune;
        const target = defending ? immune : strong;
        attacker.canAttack = true; attacker.summonedThisTurn = false;
        target.faceUp = true;
        target.position = defending ? MONSTER_POSITION.DEFENSE : MONSTER_POSITION.ATTACK;
        state.players[0].monsterZone.push(attacker);
        state.players[1].monsterZone.push(target);
        const owner = state.players[defending ? 1 : 0];
        const lp = owner.lp;
        const result = engine.attack(attacker, target);
        assert.equal(result.success, true);
        assert.ok(owner.hand.includes(immune));
        assert.equal(owner.lp, lp);
    });

    it("抽选窗口不能被动画解锁或结束回合绕过", () => {
        const { state, engine } = createGame();
        let choose;
        const ui = { ...aiUi(), showDeckSearch(_cards, _chosen, callback) { choose = callback; } };
        const controller = new GameController(state, engine, ui);
        const card = mk();
        controller._showDeckSearch({ cards: [card], chosen: card, player: state.players[0], swap: () => true });
        controller._releaseEffectLocks();
        assert.equal(controller.effectBusy, true);
        const turn = state.turn;
        controller.endTurn(true);
        assert.equal(state.turn, turn);
        choose(card);
        assert.equal(controller.effectBusy, false);
    });

    it("抽选结束不能提前释放仍在播放的动画锁", () => {
        const { state, engine } = createGame();
        let choose;
        const ui = { ...aiUi(), showDeckOrdering(_cards, callback) { choose = callback; } };
        const controller = new GameController(state, engine, ui);
        controller.effectBusy = true;
        controller._showDeckOrdering({ cards: [mk()], player: state.players[0] });
        choose([]);
        assert.equal(controller.effectBusy, true);
        controller._releaseEffectLocks();
    });

    it("非法攻击恢复主要阶段且不消耗攻击次数", () => {
        const { state, engine } = createGame({ phase: PHASE.BATTLE });
        const attacker = createCardInstance(mk());
        attacker.canAttack = true;
        state.players[0].monsterZone.push(attacker);
        state.players[1].monsterZone.push(createCardInstance(mk()));
        const controller = new GameController(state, engine, aiUi());
        controller.attackSelectionReturnPhase = PHASE.MAIN_1;
        state.selectedAttacker = attacker;
        controller.attackTarget("player");
        assert.equal(state.phase, PHASE.MAIN_1);
        assert.equal(attacker.hasAttackedThisTurn, false);
    });
});
