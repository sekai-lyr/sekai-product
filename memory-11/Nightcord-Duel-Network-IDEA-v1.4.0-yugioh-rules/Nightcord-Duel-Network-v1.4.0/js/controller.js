/**
 * controller.js
 * 自动阶段回合控制器：玩家只需要出牌、攻击和点击“结束回合”。
 */

import { PHASE, GAME_CONFIG, MONSTER_POSITION } from "./constants.js";
import { createCardInstance } from "./model.js";
import {
    playSummonEffect, playSpellEffect, playTrapEffect,
    playAttackEffect, playAttackAnimation, showDamageNumber, playDestroyEffect,
    playHealEffect, playPlayerHealEffect, playDrawEffect, playPhaseFlash,
    animateDrawCard, animatePlayToZone, animatePlayToGraveyard, createCardBackHtml,
    playFlipSummonEffect, playTrapChainEffect,
    playMonsterEffect, playSpellEffectV2, playTrapEffectV2,
    playDestroyEffectV2, playHealEffectV2, showAnnounceBanner,
    playTrapActivationV3, playCounterTrapV3,
} from "./effects.js";

const raf = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : typeof document !== "undefined" ? fn => setTimeout(fn, 0) : () => {};

// 特效锁定时间（毫秒）—— 必须 >= 横幅停留时间
const EFFECT_LOCK_MS = 2600;

export class GameController {
    constructor(gameState, engine, ui) {
        this.state = gameState;
        this.engine = engine;
        this.ui = ui;
        this.mode = "ai";
        this.pvpClient = null;
        this.aiDifficulty = "normal";
        this.aiTimer = null;
        this.selectedCardIndex = -1;
        this.pendingEffectCard = null;
        this.phaseBeforeSelection = PHASE.MAIN_1;
        this.aiActionDelay = 600;
        this.aiMaxMainActions = 6;
        this.onGameOver = null;
        this.turnEnding = false;
        this.effectBusy = false; // 特效播放期间锁定操作
        this._lockTimers = []; // 多个特效锁定计时器
    }

    // 特效锁定：播放特效期间禁止玩家操作（支持叠加，取最大时长）
    _lockForEffect(duration = EFFECT_LOCK_MS) {
        this.effectBusy = true;
        const timer = setTimeout(() => {
            this._lockTimers = this._lockTimers.filter(t => t !== timer);
            if (this._lockTimers.length === 0) this.effectBusy = false;
        }, duration);
        this._lockTimers.push(timer);
    }

    // ---- PvP 卡牌序列化 ----
    /** 提取可 JSON 序列化的卡牌字段（排除循环引用和函数） */
    _serializeCard(card) {
        if (!card) return null;
        return {
            id: card.id,
            name: card.name,
            type: card.type,
            rarity: card.rarity,
            level: card.level,
            attack: card.attack,
            defense: card.defense,
            attribute: card.attribute || card.element,
            race: card.race,
            series: card.series,
            member: card.member,
            description: card.description,
            effects: card.effects,
            aiHints: card.aiHints,
            image: card.image,
            art: card.art,
        };
    }

    clearAiTimer() {
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
    }

    start() {
        this.clearAiTimer();
        for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
            this.engine.drawCard(this.state.players[0]);
            this.engine.drawCard(this.state.players[1]);
        }
        this.state.turn = 0;
        this.state.firstTurn = true;
        this.state.selectedAttacker = null;

        const begin = (startingPlayerIndex = 0) => {
            this.state.currentPlayerIndex = startingPlayerIndex === 1 ? 1 : 0;
            this._beginTurn({ openingTurn: true });
        };

        if (this.mode === "ai" && typeof this.ui.showFirstPlayerChoice === "function") {
            this.ui.showFirstPlayerChoice(begin);
        } else {
            begin(0);
        }
    }

    async _beginTurn({ openingTurn = false } = {}) {
        if (this.state.gameOver) return;
        this.effectBusy = false; // 新回合开始时解锁
        const drawResult = this.engine.startTurn({ skipDraw: openingTurn });
        const player = this.state.currentPlayer;
        this.ui.addLog(`=== 第${this.state.turn}回合 · ${player.name}的回合 ===`, "turn");

        if (openingTurn) {
            this.ui.addLog("先攻首回合跳过抽卡阶段，并且不能攻击", "play");
        } else if (drawResult.deckOut) {
            this.ui.addLog(drawResult.message, "damage");
            this.checkAndRefresh();
            return;
        } else if (drawResult.card) {
            const isOpponentDraw = this.state.currentPlayerIndex === 1;
            if (isOpponentDraw) {
                this.ui.addLog(`${player.name}抽了1张卡`, "play");
            } else {
                this.ui.addLog(`${player.name}抽到了${drawResult.card.name}`, "play");
            }

            // 临时从手牌移除，避免动画期间手牌托盘提前显示该卡
            const pendingCard = drawResult.card;
            const handIdx = player.hand.indexOf(pendingCard);
            if (handIdx !== -1) player.hand.splice(handIdx, 1);

            // 玩家和对手都播放抽卡动画，但对手用卡背
            if (!isOpponentDraw) {
                this.ui.showDrawAnimation?.(pendingCard, 0, "DRAW PHASE");
            }
            this._lockForEffect(3800);
            await new Promise(resolve => {
                raf(() => {
                    playDrawEffect();
                    const htmlFn = isOpponentDraw
                        ? (c => createCardBackHtml(c))
                        : (c => this.ui.cardHTML(c));
                    animateDrawCard(pendingCard, htmlFn, isOpponentDraw).then(resolve);
                });
            });

            // 动画结束后将卡放回手牌
            if (!player.hand.includes(pendingCard)) {
                player.hand.push(pendingCard);
            }
        }

        raf(() => playPhaseFlash());

        // 抽卡阶段和准备阶段自动结算，玩家直接进入主要阶段1。
        this.state.phase = PHASE.STANDBY;
        this.engine.emit("onPhaseStart", { player, phase: PHASE.STANDBY });
        this.state.phase = PHASE.MAIN_1;
        this.state.selectedAttacker = null;
        this.turnEnding = false;
        if (this.engine.checkGameOver()) {
            this.gameOver();
            return;
        }
        this.refresh();

        if (this.mode === "ai" && this.state.currentPlayerIndex === 1) {
            this._scheduleAi(() => this.aiTurn(), this.aiActionDelay);
        }
    }

    // 兼容旧测试和快捷键：阶段由操作自动推进，不再需要玩家点击。
    nextPhase() {
        if (this.state.gameOver) return;
        if (this.state.phase === PHASE.MAIN_1) {
            if (this.state.firstTurn || this.state.currentPlayer.skipBattlePhase) this.state.phase = PHASE.MAIN_2;
            else this.state.phase = PHASE.BATTLE;
        } else if (this.state.phase === PHASE.BATTLE) {
            this.state.phase = PHASE.MAIN_2;
            this.state.selectedAttacker = null;
        } else if (this.state.phase === PHASE.MAIN_2) {
            this.endTurn();
            return;
        }
        this.refresh();
    }

    _isHumanAllowed() {
        if (this.mode === "local") return true;
        return this.state.currentPlayerIndex === 0;
    }

    _ensureMainPhaseForHandAction() {
        if (!this._isHumanAllowed() || this.state.gameOver) return false;
        if (this.state.phase === PHASE.BATTLE) {
            this.state.phase = PHASE.MAIN_2;
            this.state.selectedAttacker = null;
            this.ui.addLog("已自动进入主要阶段2", "turn");
        }
        return this.state.phase === PHASE.MAIN_1 || this.state.phase === PHASE.MAIN_2;
    }

    summonMonster(cardIndex, position = MONSTER_POSITION.ATTACK, faceDown = false) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._ensureMainPhaseForHandAction()) {
            this.ui.addLog("当前不能召唤怪兽", "damage");
            return;
        }
        const card = this.state.currentPlayer.hand[cardIndex];
        // 先获取手牌元素位置（引擎处理后卡牌会从手牌移除）
        const handEl = document.querySelector(`[data-instance-id="${card?.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        const result = this.engine.normalSummon(this.state.currentPlayer, cardIndex, position, faceDown);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success) this._pvpSendWithCard("summon", cardIndex, card, { position, faceDown });
        if (result.needsTribute) {
            this.refresh();
            return;
        }
        if (result.success && card) {
            const attr = card.attribute || card.element || "none";
            const hasOnSummon = card.effects?.some(e => e.trigger === "onSummon");
            const lockTime = hasOnSummon ? 3200 : 2600;
            this._lockForEffect(lockTime);
            this.checkAndRefresh();
            raf(() => {
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                if (lastSlot) {
                    // 出牌到怪兽区运镜动画
                    if (handRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75 }).then(() => tempEl.remove());
                    }
                    setTimeout(() => {
                        playSummonEffect(lastSlot, attr, card.name, card.level);
                        if (hasOnSummon) {
                            setTimeout(() => {
                                const effectType = card.effects.find(e => e.trigger === "onSummon")?.type || "none";
                                playMonsterEffect(lastSlot, attr, effectType);
                            }, 800);
                        }
                    }, 600);
                }
            });
        } else {
            this.checkAndRefresh();
        }
    }

    setCard(cardIndex) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._ensureMainPhaseForHandAction()) {
            this.ui.addLog("当前不能盖放卡牌", "damage");
            return;
        }
        const card = this.state.currentPlayer.hand[cardIndex];
        // 先获取手牌元素位置
        const handEl = document.querySelector(`[data-instance-id="${card?.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        const result = this.engine.setCard(this.state.currentPlayer, cardIndex);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success) this._pvpSendWithCard("set", cardIndex, card);
        if (result.needsTribute) {
            this.refresh();
            return;
        }
        this.checkAndRefresh();
        if (result.success && card) {
            const isTrap = card.type === "trap";
            this._lockForEffect(800);
            raf(() => {
                // 找到刚放置的卡牌槽位
                const zone = isTrap ? "spell-trap" : "monster";
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="${zone}"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card-back-icon") || s.querySelector(".card"));
                if (lastSlot && handRect) {
                    // 出牌到区域运镜动画（盖牌显示卡背）
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { isCardBack: true, endScale: isTrap ? 0.7 : 0.75 }).then(() => tempEl.remove());
                } else if (lastSlot) {
                    lastSlot.style.animation = "summonRise .3s cubic-bezier(.23,1,.32,1) forwards";
                    setTimeout(() => { lastSlot.style.animation = ""; }, 350);
                }
            });
        }
    }

    flipSummon(card) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) {
            this.ui.addLog("只能在主要阶段翻转召唤", "damage");
            return;
        }
        const result = this.engine.flipSummon(this.state.currentPlayer, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success) {
            const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
            this._pvpSend({ type: "flipSummon", monsterIndex });
        }
        this.checkAndRefresh();
        if (result.success && result.card) {
            this._lockForEffect(1000);
            raf(() => {
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
                if (slot) {
                    slot.classList.add("flip-summoning");
                    setTimeout(() => slot.classList.remove("flip-summoning"), 600);
                    playFlipSummonEffect(slot, false);
                }
            });
        }
    }

    changePosition(card) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        // 先找到卡槽DOM，添加旋转动画
        const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
        const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
        const isToDefense = card.position === MONSTER_POSITION.ATTACK;
        if (slot) {
            slot.classList.add(isToDefense ? "position-changing" : "position-changing-to-attack");
        }
        const result = this.engine.changePosition(this.state.currentPlayer, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success) {
            const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
            this._pvpSend({ type: "changePosition", monsterIndex });
        }
        this._lockForEffect(500);
        this.checkAndRefresh();
    }

    activateMonsterEffect(card) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) {
            this.ui.addLog("只能在主要阶段发动效果", "damage");
            return;
        }
        if (!card.faceUp || card.oncePerTurnUsed) {
            this.ui.addLog("该效果本回合已使用过", "damage");
            return;
        }
        const result = this.engine.triggerAllEffects(this.state.currentPlayer, card, "manual");
        if (result) {
            this.ui.addLog(`${card.name}发动效果：${result}`, "play");
            const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
            this._pvpSend({ type: "activateMonsterEffect", monsterIndex });
            // 播放怪兽效果特效
            const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
            const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
            if (slot) {
                const attr = card.attribute || card.element || "none";
                const effectType = card.effects?.find(e => e.trigger === "manual")?.type || "none";
                this._lockForEffect(1000);
                raf(() => playMonsterEffect(slot, attr, effectType));
            }
        } else {
            this.ui.addLog("没有可发动的效果", "damage");
        }
        this.checkAndRefresh();
    }

    activateSpell(cardIndex) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._ensureMainPhaseForHandAction()) {
            this.ui.addLog("当前不能发动魔法", "damage");
            return;
        }
        const card = this.state.currentPlayer.hand[cardIndex];
        if (!card) return;
        const check = this.engine.canPlayEffect(this.state.currentPlayer, card);
        if (!check.canPlay) {
            this.ui.addLog(check.reason, "damage");
            return;
        }
        const primaryEffect = card.effect || card.effects?.[0];
        const targetType = this.engine.getEffectTargetType(primaryEffect);
        if (!["none", "enemy_player", "self_player", "both_players"].includes(targetType)) {
            this.selectedCardIndex = cardIndex;
            this.pendingEffectCard = card;
            this.phaseBeforeSelection = this.state.phase;
            this.state.phase = targetType === "graveyard" ? PHASE.GRAVEYARD_SELECT : PHASE.TARGET_SELECT;
            this.state.validTargets = this.engine.getValidTargets(this.state.currentPlayer, primaryEffect);
            this.ui.addLog(`请选择${card.name}的目标`, "play");
            this.refresh();
            return;
        }
        const handBeforeSpell = this.state.currentPlayer.hand.length;
        const result = this.engine.activateSpell(this.state.currentPlayer, cardIndex);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success) this._pvpSendWithCard("activateSpell", cardIndex, card);
        if (result.success && card) {
            const attr = card.attribute || card.element || "none";
            const effectType = card.effects?.[0]?.type || "none";
            this.checkAndRefresh();

            // 先播魔法卡飞向墓地运镜，等完成后再抽卡
            const handEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
            const handRect = handEl ? handEl.getBoundingClientRect() : null;

            if (result.isFieldSpell) {
                // 场地魔法：飞向场地卡槽
                this._lockForEffect(3800);
                raf(() => {
                    const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="${this.state.currentPlayerIndex}"][data-zone="field"]`);
                    if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                    if (handRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                    }
                    setTimeout(() => playSpellEffectV2(null, attr, card.name, effectType), 600);
                });
            } else {
                // 普通魔法：先飞墓地，完成后再抽卡
                this._lockForEffect(6000);
                raf(async () => {
                    // 阶段1：魔法卡飞向墓地
                    if (handRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "player-graveyard-pile");
                        tempEl.remove();
                    }
                    // 阶段2：播放魔法特效
                    playSpellEffectV2(null, attr, card.name, effectType);
                    // 阶段3：如果有抽卡效果，逐张播放抽卡运镜
                    if (effectType === "drawCards" || effectType === "gameThroneDraw" || effectType === "discardAndDraw" || effectType === "healDrawNoSpecial" || effectType === "recoverAndDrawV2") {
                        await new Promise(resolve => setTimeout(resolve, 800)); // 等魔法特效播完
                        const player = this.state.currentPlayer;
                        // 获取实际抽到的卡牌数量（基于卡牌效果的value）
                        const drawCount = Math.min(player.hand.length - handBeforeSpell + 1, 3);
                        const drawnCards = player.hand.splice(-drawCount);
                        for (const drawn of drawnCards) {
                            if (drawn && drawn.type) {
                                this.ui.showDrawAnimation?.(drawn, 0, "DRAW");
                                await animateDrawCard(drawn, c => this.ui.cardHTML(c));
                                player.hand.push(drawn);
                                this.refresh();
                                await new Promise(r => setTimeout(r, 200));
                            }
                        }
                    }
                });
            }
        } else {
            this.checkAndRefresh();
        }
    }

    confirmTarget(target) {
        if (this.state.phase !== PHASE.TARGET_SELECT && this.state.phase !== PHASE.GRAVEYARD_SELECT) return;
        const player = this.state.currentPlayer;
        const card = player.hand[this.selectedCardIndex];
        if (!card) {
            this.cancelTargetSelect();
            return;
        }
        const returnPhase = this.phaseBeforeSelection || PHASE.MAIN_1;
        const handBeforeSpell = player.hand.length;
        const result = this.engine.activateSpell(player, this.selectedCardIndex, target);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success) this._pvpSendWithCard("activateSpell", this.selectedCardIndex, card, { targetSpec: target });
        if (!result.success) {
            this.state.validTargets = this.engine.getValidTargets(player, card.effect || card.effects?.[0]);
            this.refresh();
            return;
        }
        this.pendingEffectCard = null;
        this.selectedCardIndex = -1;
        this.state.validTargets = [];
        this.state.phase = returnPhase;
        const handEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        this.checkAndRefresh();
        const attr = card.attribute || card.element || "none";
        const effectType = card.effects?.[0]?.type || "none";

        if (result.isFieldSpell) {
            this._lockForEffect(3800);
            raf(() => {
                const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="${this.state.currentPlayerIndex}"][data-zone="field"]`);
                if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                if (handRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                }
                setTimeout(() => playSpellEffectV2(null, attr, card.name, effectType), 600);
            });
        } else {
            this._lockForEffect(6000);
            raf(async () => {
                if (handRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "player-graveyard-pile");
                    tempEl.remove();
                }
                playSpellEffectV2(null, attr, card.name, effectType);
                if (effectType === "drawCards" || effectType === "gameThroneDraw" || effectType === "discardAndDraw" || effectType === "healDrawNoSpecial" || effectType === "recoverAndDrawV2") {
                    await new Promise(resolve => setTimeout(resolve, 800));
                    const drawCount = Math.min(player.hand.length - handBeforeSpell + 1, 3);
                    const drawnCards = player.hand.splice(-drawCount);
                    for (const drawn of drawnCards) {
                        if (drawn && drawn.type) {
                            this.ui.showDrawAnimation?.(drawn, 0, "DRAW");
                            await animateDrawCard(drawn, c => this.ui.cardHTML(c));
                            player.hand.push(drawn);
                            this.refresh();
                            await new Promise(r => setTimeout(r, 200));
                        }
                    }
                }
            });
        }
    }

    cancelTargetSelect() {
        this.state.phase = this.phaseBeforeSelection || PHASE.MAIN_1;
        this.selectedCardIndex = -1;
        this.pendingEffectCard = null;
        this.state.validTargets = [];
        this.refresh();
    }

    selectTribute(card) {
        const result = this.engine.selectTribute(card);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success) {
            const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
            this._pvpSend({ type: "selectTribute", monsterIndex });
        }
        this.refresh();
    }

    confirmTribute() {
        const result = this.engine.confirmTribute();
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        this._pvpSend({ type: "confirmTribute" });
        this.checkAndRefresh();
    }

    cancelTribute() {
        this.engine.cancelTribute();
        this._pvpSend({ type: "cancelTribute" });
        this.refresh();
    }

    selectAttacker(card) {
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.state.firstTurn && GAME_CONFIG.FIRST_TURN_NO_BATTLE) {
            this.ui.addLog("先攻首回合不能攻击", "damage");
            return;
        }
        if (this.state.currentPlayer.skipBattlePhase) {
            this.ui.addLog("本回合不能进入战斗阶段", "damage");
            return;
        }
        if (this.state.phase === PHASE.MAIN_1) {
            this.state.phase = PHASE.BATTLE;
            this.ui.addLog("已自动进入战斗阶段", "turn");
        }
        if (this.state.phase !== PHASE.BATTLE) {
            this.ui.addLog("主要阶段2之后不能重新进入战斗阶段", "damage");
            return;
        }
        if (!card.canAttack || card.hasAttackedThisTurn || card.position === MONSTER_POSITION.DEFENSE) return;
        this.state.selectedAttacker = card;
        this.ui.addLog(`选择${card.name}攻击`, "play");
        this.refresh();
    }

    attackTarget(target, _redirectDepth = 0) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (this.state.gameOver || !this.state.selectedAttacker) return;
        // 重定向安全限制：最多重定向3次，防止无限循环
        if (_redirectDepth > 3) {
            this.ui.addLog("攻击重定向次数过多，攻击终止", "damage");
            this.state.selectedAttacker = null;
            return;
        }
        const attacker = this.state.selectedAttacker;

        // 先找到对方场上可能触发的陷阱卡DOM位置（在引擎处理前）
        const isBrowser = typeof document !== "undefined";
        const defenderSpellTrapSlots = isBrowser ? document.querySelectorAll(`[data-owner="1"][data-zone="spell-trap"]`) : [];
        const possibleTrapSlot = isBrowser ? [...defenderSpellTrapSlots].reverse().find(s => s.querySelector(".card-back-icon")) : null;

        const result = this.engine.attack(attacker, target);
        if (result.success) {
            // 使用区域索引而非 instanceId（两端 instanceId 不同）
            const attackerIndex = this.state.currentPlayer.monsterZone.indexOf(attacker);
            let targetInfo;
            if (target === "player") {
                targetInfo = { targetType: "player" };
            } else {
                const targetIndex = this.state.opponentPlayer.monsterZone.indexOf(target);
                targetInfo = { targetType: "monster", targetIndex };
            }
            this._pvpSend({ type: "attack", attackerIndex, ...targetInfo });
        }
        // 攻击重定向（里间雨效果②）
        if (result.redirect) {
            this.ui.addLog(result.message, "play");
            this.state.selectedAttacker = attacker;
            this.attackTarget(result.redirect, _redirectDepth + 1);
            return;
        }
        this.ui.addLog(result.message, result.success ? "damage" : "damage");
        this.state.selectedAttacker = null;

        // 陷阱发动特效 —— 反击型陷阱运镜
        if (result.trap) {
            this._lockForEffect(1200);
            const trapName = result.message.match(/【(.+?)】/)?.[1] || "陷阱";
            const trapCardData = { name: trapName, type: "trap", rarity: "R" };
            if (possibleTrapSlot) {
                // 反击型陷阱：镜头切向后场→翻开→屏障→怪兽骤停→陷阱销毁
                const attackerOwner = this.state.players[0].monsterZone.some(c => c.instanceId === attacker.instanceId) ? 0 : 1;
                const targetOwner = attackerOwner === 0 ? 1 : 0;
                const targetSlots = document.querySelectorAll(`[data-owner="${targetOwner}"][data-zone="monster"]`);
                const targetSlot = target !== "player" ? [...targetSlots].find(s => s.dataset.instanceId === target?.instanceId) : null;
                playCounterTrapV3(possibleTrapSlot, trapCardData, attackerSlot, attacker);
            } else {
                showAnnounceBanner("trap", "counter", trapName);
            }
            setTimeout(() => this.checkAndRefresh(), 1500);
            return;
        }

        this._lockForEffect(1200);

        this.checkAndRefresh();

        raf(() => {
            const attackerOwner = this.state.players[0].monsterZone.some(c => c.instanceId === attacker.instanceId) ? 0 : 1;
            const attackerSlots = document.querySelectorAll(`[data-owner="${attackerOwner}"][data-zone="monster"]`);
            const attackerSlot = [...attackerSlots].find(s => s.dataset.instanceId === attacker.instanceId);

            // 检查攻击方是否存活
            const attackerSurvived = this.state.players[attackerOwner].monsterZone.some(c => c.instanceId === attacker.instanceId);

            if (target === "player") {
                // 直接攻击：怪兽滑向对方玩家区域，然后滑回
                const oppHud = document.querySelector("#opponent-area .player-hud");
                playAttackAnimation(attackerSlot, null, attacker, true, oppHud);
                if (oppHud) {
                    setTimeout(() => showDamageNumber(oppHud, attacker.currentAttack || 0, "damage"), 400);
                }
            } else if (target?.instanceId) {
                // 怪兽对怪兽：怪兽冲过去碰撞
                const targetOwner = attackerOwner === 0 ? 1 : 0;
                const targetSlots = document.querySelectorAll(`[data-owner="${targetOwner}"][data-zone="monster"]`);
                const targetSlot = [...targetSlots].find(s => s.dataset.instanceId === target.instanceId);
                playAttackAnimation(attackerSlot, targetSlot, attacker, attackerSurvived);
                if (targetSlot) {
                    const targetDef = target.position === "DEFENSE" ? (target.currentDefense || 0) : (target.currentAttack || 0);
                    const dmg = Math.max(0, (attacker.currentAttack || 0) - targetDef);
                    if (dmg > 0) setTimeout(() => showDamageNumber(targetSlot, dmg, "damage"), 400);
                }
            }
        });
    }

    attackPlayer() {
        if (this.state.gameOver || !this.state.selectedAttacker) return;
        if (this.state.opponentPlayer.monsterZone.length > 0) {
            this.ui.addLog("对方场上有怪兽时不能直接攻击", "damage");
            return;
        }
        this.attackTarget("player");
    }

    endTurn() {
        if (this.state.gameOver || this.turnEnding || !this._isHumanAllowed()) return;
        if (this.state.phase === PHASE.TRIBUTE_SELECT) this.cancelTribute();
        else if (this.state.phase === PHASE.TARGET_SELECT || this.state.phase === PHASE.GRAVEYARD_SELECT) this.cancelTargetSelect();

        const player = this.state.currentPlayer;
        const excess = Math.max(0, player.hand.length - GAME_CONFIG.END_HAND_LIMIT);
        if (excess > 0 && this.state.currentPlayerIndex === 0 && typeof this.ui.showDiscardSelection === "function") {
            this.turnEnding = true;
            this.state.phase = PHASE.END;
            this.refresh();
            this.ui.showDiscardSelection(player.hand, excess, selectedIds => {
                const discarded = this.engine.discardToEndLimit(player, selectedIds);
                this.ui.addLog(`${player.name}在结束阶段丢弃了${discarded.map(card => card.name).join("、")}`, "play");
                this._finalizeEndTurn();
            });
            return;
        }
        if (excess > 0) {
            const discarded = this.engine.discardToEndLimit(player);
            this.ui.addLog(`${player.name}在结束阶段丢弃了${discarded.length}张牌`, "play");
        }
        this._finalizeEndTurn();
    }

    _finalizeEndTurn() {
        if (this.state.gameOver) return;
        this.turnEnding = false;
        this.state.phase = PHASE.END;
        this.engine.emit("onTurnEnd", { player: this.state.currentPlayer });
        this.engine.endTurn();
        this._pvpSend({ type: "endTurn" });
        if (this.mode === "local") {
            this.ui.showHandoff(this.state.currentPlayer.name, () => this._beginTurn());
            return;
        }
        this._beginTurn();
    }

    // ---- PvP 远程操作同步 ----

    /** 发送动作到对手（附带卡牌数据用于隐藏信息揭示） */
    _pvpSend(action) {
        if (this.mode !== "pvp" || !this.pvpClient) return;
        this.pvpClient.sendAction(action);
    }

    /** 从手牌出牌时，附带完整卡牌数据（对手不知道你手牌内容） */
    _pvpSendWithCard(type, cardIndex, card, extra = {}) {
        if (this.mode !== "pvp") return;
        this._pvpSend({ type, cardIndex, cardData: this._serializeCard(card), ...extra });
    }

    /** 接收并执行对手的动作 */
    applyRemoteAction(action) {
        if (this.mode !== "pvp" || !action) return;

        // 对手 = players[1]（从本地视角看）
        const opponent = this.state.players[1];

        switch (action.type) {
            case "draw": {
                // 对手抽卡：不揭示卡牌内容，只更新计数
                this.engine.drawCard(opponent);
                this.ui.addLog(`${opponent.name}抽了${action.count || 1}张卡`, "play");
                break;
            }
            case "summon": {
                // 对手从手牌召唤：需要卡牌数据来创建本地实例
                const cardData = action.cardData;
                if (cardData) {
                    // 从对手手牌中移除对应位置的卡（可能是占位符）
                    // 并在怪兽区创建正确的卡牌实例
                    const card = createCardInstance(cardData);
                    // 从对手手牌移除一张（位置对应）
                    if (action.cardIndex >= 0 && action.cardIndex < opponent.hand.length) {
                        opponent.hand.splice(action.cardIndex, 1);
                    }
                    // 设置卡牌状态
                    card.position = action.position || "attack";
                    card.faceUp = !action.faceDown;
                    card.canAttack = false; // 召唤失调
                    card.faceUp = true;
                    if (opponent.monsterZone.length < 5) {
                        opponent.monsterZone.push(card);
                    }
                }
                this.ui.addLog(`${opponent.name}召唤了怪兽`, "play");
                break;
            }
            case "set": {
                const cardData = action.cardData;
                if (cardData) {
                    const card = createCardInstance(cardData);
                    if (action.cardIndex >= 0 && action.cardIndex < opponent.hand.length) {
                        opponent.hand.splice(action.cardIndex, 1);
                    }
                    card.faceDown = true;
                    card.faceUp = false;
                    card.setTurn = this.state.turn;
                    if (cardData.type === "trap" || cardData.type === "spell") {
                        if (opponent.spellTrapZone.length < 5) {
                            opponent.spellTrapZone.push(card);
                        }
                    } else {
                        if (opponent.monsterZone.length < 5) {
                            opponent.monsterZone.push(card);
                        }
                    }
                }
                this.ui.addLog(`${opponent.name}盖放了一张卡`, "play");
                break;
            }
            case "flipSummon": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) {
                    this.engine.flipSummon(opponent, monster);
                }
                this.ui.addLog(`${opponent.name}翻转召唤了怪兽`, "play");
                break;
            }
            case "changePosition": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) {
                    this.engine.changePosition(opponent, monster);
                }
                this.ui.addLog(`${opponent.name}改变了怪兽表示形式`, "play");
                break;
            }
            case "activateSpell": {
                const cardData = action.cardData;
                if (cardData) {
                    const card = createCardInstance(cardData);
                    if (action.cardIndex >= 0 && action.cardIndex < opponent.hand.length) {
                        opponent.hand.splice(action.cardIndex, 1);
                    }
                    // 添加到魔法陷阱区或直接处理效果
                    this.engine.activateSpell(opponent, 0, action.targetSpec);
                }
                this.ui.addLog(`${opponent.name}发动了魔法卡`, "play");
                break;
            }
            case "activateMonsterEffect": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) {
                    this.engine.triggerAllEffects(opponent, monster, "manual");
                }
                this.ui.addLog(`${opponent.name}发动了怪兽效果`, "play");
                break;
            }
            case "attack": {
                const attacker = opponent.monsterZone[action.attackerIndex];
                if (!attacker) break;
                if (action.targetType === "player") {
                    this.engine.attack(attacker, "player");
                } else {
                    const target = this.state.players[0].monsterZone[action.targetIndex];
                    if (target) this.engine.attack(attacker, target);
                }
                this.ui.addLog(`${attacker.name}发动了攻击`, "damage");
                break;
            }
            case "selectTribute": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) this.engine.selectTribute(monster);
                break;
            }
            case "confirmTribute": {
                this.engine.confirmTribute(action.position || "attack", action.faceDown || false);
                break;
            }
            case "cancelTribute": {
                this.engine.cancelTribute();
                break;
            }
            case "discard": {
                // 对手丢弃手牌
                if (action.cardIndices && action.cardIndices.length > 0) {
                    const discarded = this.engine.discardToEndLimit(opponent, action.cardIndices);
                    this.ui.addLog(`${opponent.name}丢弃了${discarded.length}张牌`, "play");
                }
                break;
            }
            case "endTurn": {
                this._beginTurn();
                return;
            }
            default:
                console.warn("Unknown PvP action:", action.type);
                break;
        }
        this.checkAndRefresh();
    }

    onPvpTurnStart() {
        if (this.mode !== "pvp") return;
        this.ui.addLog("你的回合！", "turn");
        this._beginTurn();
    }

    aiTurn() {
        this.clearAiTimer();
        if (this.state.gameOver || this.mode !== "ai" || this.state.currentPlayerIndex !== 1) return;
        this.ui.addLog("AI正在思考……", "turn");
        this._runAiMainStep(0);
    }

    _scheduleAi(callback, delay = this.aiActionDelay) {
        this.clearAiTimer();
        this.aiTimer = setTimeout(() => {
            this.aiTimer = null;
            callback();
        }, Math.max(0, delay));
    }

    _runAiMainStep(actionCount) {
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        this.state.phase = actionCount === 0 ? PHASE.MAIN_1 : this.state.phase;
        // 如果上一个动画还在播放，等它播完再继续
        if (this.effectBusy) {
            this._scheduleAi(() => this._runAiMainStep(actionCount), 300);
            return;
        }
        const action = actionCount < this.aiMaxMainActions ? this._chooseAiPlayAction() : null;
        if (!action) {
            if (this.state.firstTurn || this.state.currentPlayer.skipBattlePhase) {
                this.state.phase = PHASE.MAIN_2;
                this.refresh();
                this._scheduleAi(() => this._finishAiTurn(), this.aiActionDelay);
            } else {
                this.state.phase = PHASE.BATTLE;
                this.state.selectedAttacker = null;
                this.refresh();
                this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            }
            return;
        }
        const result = this._executeAiPlayAction(action);
        if (result?.message) this.ui.addLog(`AI ${result.message}`, result.success ? "play" : "damage");
        if (result?.card) this.ui.showAiAction?.(result.card, result.actionLabel || "AI ACTION");
        this.checkAndRefresh();
        if (this.state.gameOver) return;
        // 等动画播完再执行下一个动作
        this._scheduleAi(() => this._runAiMainStep(actionCount + 1), this.effectBusy ? 500 : this.aiActionDelay);
    }

    _runAiBattleStep() {
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        this.state.phase = PHASE.BATTLE;
        const ai = this.state.currentPlayer;
        const human = this.state.opponentPlayer;
        const attacker = ai.monsterZone
            .filter(card => card.canAttack && !card.hasAttackedThisTurn && !card.cannotAttack && card.position === MONSTER_POSITION.ATTACK)
            .sort((a, b) => (b.currentAttack || 0) - (a.currentAttack || 0))[0];
        if (!attacker) {
            this.state.phase = PHASE.MAIN_2;
            this.refresh();
            this._scheduleAi(() => this._finishAiTurn(), this.aiActionDelay);
            return;
        }
        this.state.selectedAttacker = attacker;
        this.ui.showAiAction?.(attacker, "AI ATTACK");
        const target = human.monsterZone.length ? this._chooseAiAttackTarget(attacker, human.monsterZone) : "player";

        // 先找到玩家场上可能触发的陷阱卡DOM位置
        const isBrowser = typeof document !== "undefined";
        const playerSpellTrapSlots = isBrowser ? document.querySelectorAll(`[data-owner="0"][data-zone="spell-trap"]`) : [];
        const possibleTrapSlot = isBrowser ? [...playerSpellTrapSlots].reverse().find(s => s.querySelector(".card-back-icon")) : null;

        let attackTarget = target;
        let result = null;
        let redirectDepth = 0;
        // 处理攻击重定向循环（最多3次）
        while (redirectDepth <= 3) {
            result = this.engine.attack(attacker, attackTarget);
            this.ui.addLog(result.message, "damage");
            if (result.redirect) {
                redirectDepth++;
                attackTarget = result.redirect;
                continue;
            }
            break;
        }
        if (redirectDepth > 3) {
            this.ui.addLog("攻击重定向次数过多，攻击终止", "damage");
            this.state.selectedAttacker = null;
            this.checkAndRefresh();
            this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            return;
        }

        // Compute attacker slot before trap check
        const aiSlots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
        const attackerSlot = [...aiSlots].find(s => s.dataset.instanceId === attacker.instanceId);

        // 陷阱发动特效
        if (result.trap) {
            this._lockForEffect(1200);
            const trapName = result.message.match(/【(.+?)】/)?.[1] || "陷阱";
            const trapCardData = { name: trapName, type: "trap", rarity: "R" };
            if (possibleTrapSlot) {
                // 玩家反击陷阱：镜头切向后场→翻开→屏障→怪兽骤停→陷阱销毁
                const playerSlots = document.querySelectorAll(`[data-owner="0"][data-zone="monster"]`);
                const playerTargetSlot = attackTarget !== "player" ? [...playerSlots].find(s => s.dataset.instanceId === attackTarget?.instanceId) : null;
                playCounterTrapV3(possibleTrapSlot, trapCardData, attackerSlot, attacker);
            } else {
                showAnnounceBanner("trap", "counter", trapName);
            }
            setTimeout(() => this.checkAndRefresh(), 1500);
        } else {
            this.checkAndRefresh();
            raf(() => {

                // 检查攻击方是否存活
                const attackerSurvived = this.state.players[1].monsterZone.some(c => c.instanceId === attacker.instanceId);

                if (attackTarget === "player") {
                    const playerHud = document.querySelector("#player-area .player-hud");
                    playAttackAnimation(attackerSlot, null, attacker, true, playerHud);
                    if (playerHud) {
                        setTimeout(() => showDamageNumber(playerHud, attacker.currentAttack || 0, "damage"), 400);
                    }
                } else if (attackTarget?.instanceId) {
                    const targetSlots = document.querySelectorAll(`[data-owner="0"][data-zone="monster"]`);
                    const targetSlot = [...targetSlots].find(s => s.dataset.instanceId === attackTarget.instanceId);
                    playAttackAnimation(attackerSlot, targetSlot, attacker, attackerSurvived);
                    if (targetSlot) {
                        const targetDef = attackTarget.position === "DEFENSE" ? (attackTarget.currentDefense || 0) : (attackTarget.currentAttack || 0);
                        const dmg = Math.max(0, (attacker.currentAttack || 0) - targetDef);
                        if (dmg > 0) setTimeout(() => showDamageNumber(targetSlot, dmg, "damage"), 400);
                    }
                }
            });
        }

        this.state.selectedAttacker = null;
        this.checkAndRefresh();
        if (this.state.gameOver) return;
        // 等攻击动画播完再执行下一个攻击
        this._scheduleAi(() => this._runAiBattleStep(), this.effectBusy ? 500 : this.aiActionDelay);
    }

    _finishAiTurn() {
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        const ai = this.state.currentPlayer;
        if (ai.hand.length > GAME_CONFIG.END_HAND_LIMIT) {
            const discarded = this.engine.discardToEndLimit(ai);
            this.ui.addLog(`AI在结束阶段丢弃了${discarded.length}张牌`, "play");
        }
        this.ui.addLog("AI结束回合", "turn");
        this._finalizeEndTurn();
    }

    _chooseAiPlayAction() {
        const ai = this.state.currentPlayer;
        if (ai !== this.state.players[1]) return null;
        if (!ai.normalSummonUsed && ai.monsterZone.length < GAME_CONFIG.MAX_MONSTER_ZONE) {
            const candidates = ai.hand
                .map(card => ({ card, needed: card?.type === "monster" ? this.engine.getTributeNeeded(card.level) : 99 }))
                .filter(item => item.card?.type === "monster" && ai.monsterZone.length >= item.needed)
                .sort((a, b) => {
                    const aScore = (a.card.attack || 0) + (a.card.effects?.length || 0) * 250 - a.needed * 500;
                    const bScore = (b.card.attack || 0) + (b.card.effects?.length || 0) * 250 - b.needed * 500;
                    return bScore - aScore;
                });
            if (candidates.length) return { kind: "monster", instanceId: candidates[0].card.instanceId };
        }
        const spells = ai.hand
            .filter(card => card?.type === "spell" && this.engine.canPlayEffect(ai, card).canPlay)
            .sort((a, b) => (b.aiHints?.priority || 0) - (a.aiHints?.priority || 0));
        if (spells.length) return { kind: "spell", instanceId: spells[0].instanceId };
        if (ai.spellTrapZone.length < GAME_CONFIG.MAX_SPELL_TRAP_ZONE) {
            const trap = ai.hand.find(card => card?.type === "trap");
            if (trap) return { kind: "trap", instanceId: trap.instanceId };
        }
        return null;
    }

    _executeAiPlayAction(action) {
        const ai = this.state.currentPlayer;
        const index = ai.hand.findIndex(card => card.instanceId === action.instanceId);
        if (index < 0) return { success: false, message: "要使用的卡牌已不在手牌" };
        const card = ai.hand[index];
        if (action.kind === "monster") {
            const result = this.engine.normalSummon(ai, index, MONSTER_POSITION.ATTACK, false);
            if (result.needsTribute) {
                const pending = this.state.pendingTribute;
                [...ai.monsterZone]
                    .sort((a, b) => (a.currentAttack || 0) - (b.currentAttack || 0))
                    .slice(0, pending?.needed || 0)
                    .forEach(tribute => this.engine.selectTribute(tribute));
                const confirmed = this.engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
                this.checkAndRefresh();
                raf(() => {
                    const oppHandEl = document.getElementById("opponent-hand");
                    const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
                    const slots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                    const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                    if (lastSlot && oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75 }).then(() => tempEl.remove());
                    }
                    setTimeout(() => {
                        if (lastSlot) playSummonEffect(lastSlot, card.attribute || "none", card.name, card.level);
                    }, 600);
                });
                return { ...confirmed, card: confirmed.card || card, actionLabel: "AI SUMMON" };
            }
            this.checkAndRefresh();
            raf(() => {
                const oppHandEl = document.getElementById("opponent-hand");
                const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
                const slots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                if (lastSlot && oppHandRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75 }).then(() => tempEl.remove());
                }
                setTimeout(() => {
                    if (lastSlot) playSummonEffect(lastSlot, card.attribute || "none", card.name, card.level);
                }, 600);
            });
            return { ...result, card: result.card || card, actionLabel: "AI SUMMON" };
        }
        if (action.kind === "spell") {
            const target = this._chooseAiEffectTarget(ai, card);
            const oppHandEl = document.getElementById("opponent-hand");
            const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
            const handBeforeSpell = ai.hand.length;
            const result = this.engine.activateSpell(ai, index, target);
            const effectType = card.effects?.[0]?.type || "none";
            this.checkAndRefresh();

            if (result.isFieldSpell) {
                this._lockForEffect(3800);
                raf(() => {
                    const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="1"][data-zone="field"]`);
                    if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                    if (oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                    }
                    setTimeout(() => playSpellEffectV2(null, card.attribute || "none", card.name, effectType), 600);
                });
            } else {
                // 普通魔法：先飞墓地，完成后再抽卡
                this._lockForEffect(6000);
                raf(async () => {
                    if (oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "opponent-graveyard-pile");
                        tempEl.remove();
                    }
                    playSpellEffectV2(null, card.attribute || "none", card.name, effectType);
                    if (effectType === "drawCards" || effectType === "gameThroneDraw" || effectType === "discardAndDraw") {
                        await new Promise(resolve => setTimeout(resolve, 800));
                        const drawCount = Math.min(ai.hand.length - handBeforeSpell, 3);
                        const drawnCards = ai.hand.splice(-drawCount);
                        for (const drawn of drawnCards) {
                            if (drawn && drawn.type) {
                                await animateDrawCard(drawn, c => createCardBackHtml(c), true);
                                ai.hand.push(drawn);
                                await new Promise(r => setTimeout(r, 200));
                            }
                        }
                    }
                });
            }
            return { ...result, card, actionLabel: "AI SPELL" };
        }
        if (action.kind === "trap") {
            // 获取对手手牌区域位置用于出牌动画
            const oppHandEl = document.getElementById("opponent-hand");
            const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
            const result = this.engine.setCard(ai, index);
            this.checkAndRefresh();
            // 陷阱卡运镜：从对手手牌飞到陷阱区（显示卡背）
            if (oppHandRect && result.success) {
                this._lockForEffect(800);
                raf(() => {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    const stSlots = document.querySelectorAll(`[data-owner="1"][data-zone="spell-trap"]`);
                    const targetSlot = [...stSlots].reverse().find(s => s.querySelector(".card-back-icon")) || [...stSlots].pop();
                    animatePlayToZone(card, tempEl, targetSlot, c => this.ui.cardHTML(c), { isCardBack: true, endScale: 0.7 }).then(() => tempEl.remove());
                });
            }
            return { ...result, card, actionLabel: "AI SET" };
        }
        return { success: false, message: "未知AI行动" };
    }

    _chooseAiEffectTarget(ai, card) {
        const effect = card.effect || card.effects?.[0];
        const targets = this.engine.getValidTargets(ai, effect);
        if (!targets.length) return null;
        const type = this.engine.getEffectTargetType(effect);
        if (type === "graveyard") return [...targets].sort((a, b) => (b.attack || 0) - (a.attack || 0))[0];
        if (type === "enemy_monster_or_player") {
            const monsters = targets.filter(target => !target.isPlayer);
            if (monsters.length) return [...monsters].sort((a, b) => (a.currentDefense || a.defense || 0) - (b.currentDefense || b.defense || 0))[0];
            return targets.find(target => target.isPlayer) || targets[0];
        }
        return [...targets].sort((a, b) => (a.currentDefense || a.defense || 0) - (b.currentDefense || b.defense || 0))[0];
    }

    _chooseAiAttackTarget(attacker, targets) {
        return [...targets].sort((a, b) => {
            const aPower = a.position === MONSTER_POSITION.DEFENSE ? a.currentDefense : a.currentAttack;
            const bPower = b.position === MONSTER_POSITION.DEFENSE ? b.currentDefense : b.currentAttack;
            const aKill = (attacker.currentAttack || 0) >= (aPower || 0) ? 1 : 0;
            const bKill = (attacker.currentAttack || 0) >= (bPower || 0) ? 1 : 0;
            if (aKill !== bKill) return bKill - aKill;
            return (aPower || 0) - (bPower || 0);
        })[0];
    }

    // 同步AI供自动测试使用。
    _aiPlayCards() {
        let actions = 0;
        while (actions < this.aiMaxMainActions) {
            const action = this._chooseAiPlayAction();
            if (!action) break;
            const result = this._executeAiPlayAction(action);
            if (!result?.success) break;
            this.ui.addLog(`AI ${result.message}`, "play");
            actions++;
        }
        this.refresh();
    }

    _aiAttack() {
        if (this.state.firstTurn) return;
        const ai = this.state.currentPlayer;
        const human = this.state.opponentPlayer;
        this.state.phase = PHASE.BATTLE;
        for (const attacker of ai.monsterZone.filter(card => card.canAttack && !card.hasAttackedThisTurn && card.position === MONSTER_POSITION.ATTACK)) {
            if (this.state.gameOver) return;
            const target = human.monsterZone.length ? this._chooseAiAttackTarget(attacker, human.monsterZone) : "player";
            const result = this.engine.attack(attacker, target);
            this.ui.addLog(result.message, "damage");
            if (this.engine.checkGameOver()) return;
        }
        this.refresh();
    }

    gameOver() {
        this.clearAiTimer();
        const names = [this.state.players[0].name, this.state.players[1].name];
        if (this.state.isDraw) {
            this.ui.addLog("=== 平局 ===", "gameover");
            this.ui.showGameOver(null, names, true);
        } else {
            const winner = this.state.winner;
            const loser = this.state.players[winner === 0 ? 1 : 0];
            const reason = this.state.winReason
                ? this.state.winReason
                : (loser.deckOut ? `${loser.name}无牌可抽` : `${loser.name}的LP归零`);
            this.ui.addLog(`=== ${names[winner]}获胜：${reason} ===`, "gameover");
            this.ui.showGameOver(winner, names, false, reason);
        }
        this.onGameOver?.({ winner: this.state.winner, isDraw: this.state.isDraw });
    }

    backToMenu() {
        this.clearAiTimer();
        this.ui.hideGameOver();
        this.ui.showMenu();
    }

    checkAndRefresh() {
        if (this.engine.checkGameOver()) {
            this.gameOver();
            return;
        }
        this.engine.checkStateIntegrity();
        this.refresh();
    }

    refresh() {
        const handlers = {
            onPlayCard: index => this.activateSpell(index),
            onSetCard: index => this.setCard(index),
            onSummon: (index, position, faceDown) => this.summonMonster(index, position, faceDown),
            onFlipSummon: card => this.flipSummon(card),
            onChangePosition: card => this.changePosition(card),
            onActivateMonsterEffect: card => this.activateMonsterEffect(card),
            onNextPhase: () => this.nextPhase(),
            onEndTurn: () => this.endTurn(),
            onSelectAttacker: card => this.selectAttacker(card),
            onAttack: target => this.attackTarget(target),
            onAttackPlayer: () => this.attackPlayer(),
            onConfirmTarget: target => this.confirmTarget(target),
            onCancelTarget: () => this.cancelTargetSelect(),
            onSelectTribute: card => this.selectTribute(card),
            onConfirmTribute: () => this.confirmTribute(),
            onCancelTribute: () => this.cancelTribute(),
        };
        this.ui.render(this.state, handlers);
    }
}
