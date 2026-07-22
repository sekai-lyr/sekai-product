/**
 * controller.js
 * 自动阶段回合控制器：玩家只需要出牌、攻击和点击“结束回合”。
 */

import { PHASE, GAME_CONFIG, MONSTER_POSITION } from "./constants.js";
import {
    playSummonEffect, playSpellEffect, playTrapEffect,
    playAttackEffect, showDamageNumber, playDestroyEffect,
    playHealEffect, playPlayerHealEffect, playDrawEffect, playPhaseFlash,
    animateDrawCard, animatePlayCard, animatePlayToGraveyard,
    playFlipSummonEffect, playTrapChainEffect,
    playMonsterEffect, playSpellEffectV2, playTrapEffectV2,
    playDestroyEffectV2, playHealEffectV2, showAnnounceBanner,
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
        this.aiDifficulty = "normal";
        this.aiTimer = null;
        this.selectedCardIndex = -1;
        this.pendingEffectCard = null;
        this.phaseBeforeSelection = PHASE.MAIN_1;
        this.aiActionDelay = 1200;
        this.aiMaxMainActions = 6;
        this.onGameOver = null;
        this.turnEnding = false;
        this.effectBusy = false; // 特效播放期间锁定操作
    }

    // 特效锁定：播放特效期间禁止玩家操作
    _lockForEffect(duration = EFFECT_LOCK_MS) {
        this.effectBusy = true;
        setTimeout(() => { this.effectBusy = false; }, duration);
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
            this.ui.addLog(`${player.name}抽到了${drawResult.card.name}`, "play");
            // 等待抽卡运镜动画播完再进入主要阶段（仅玩家）
            if (this.state.currentPlayerIndex === 0) {
                this.ui.showDrawAnimation?.(drawResult.card, 0, "DRAW PHASE");
                this._lockForEffect(3800);
                await new Promise(resolve => {
                    raf(() => {
                        playDrawEffect();
                        animateDrawCard(drawResult.card, c => this.ui.cardHTML(c)).then(resolve);
                    });
                });
            }
            // 对手抽卡不做运镜动画，仅刷新UI
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
            if (this.state.firstTurn) this.state.phase = PHASE.MAIN_2;
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
        const result = this.engine.normalSummon(this.state.currentPlayer, cardIndex, position, faceDown);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.needsTribute) {
            this.refresh();
            return;
        }
        if (result.success && card) {
            const attr = card.attribute || card.element || "none";
            const hasOnSummon = card.effects?.some(e => e.trigger === "onSummon");
            const lockTime = hasOnSummon ? 2800 : 2200;
            this._lockForEffect(lockTime);
            // 先刷新UI让怪兽出现在场上，然后播放特效
            this.checkAndRefresh();
            raf(() => {
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                if (lastSlot) {
                    playSummonEffect(lastSlot, attr, card.name, card.level);
                    if (hasOnSummon) {
                        setTimeout(() => {
                            const effectType = card.effects.find(e => e.trigger === "onSummon")?.type || "none";
                            playMonsterEffect(lastSlot, attr, effectType);
                        }, 800);
                    }
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
        const result = this.engine.setCard(this.state.currentPlayer, cardIndex);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.needsTribute) {
            this.refresh();
            return;
        }
        this.checkAndRefresh();
        if (result.success && card) {
            raf(() => {
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card-back-icon") || s.querySelector(".card"));
                if (lastSlot) {
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
        this.checkAndRefresh();
        if (result.success && result.card) {
            this._lockForEffect(1000);
            raf(() => {
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
                if (slot) playFlipSummonEffect(slot, false);
            });
        }
    }

    changePosition(card) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        const result = this.engine.changePosition(this.state.currentPlayer, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
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
        const result = this.engine.activateSpell(this.state.currentPlayer, cardIndex);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success && card) {
            const attr = card.attribute || card.element || "none";
            const effectType = card.effects?.[0]?.type || "none";
            this._lockForEffect(3800);
            // 出牌飞向墓地动画：先获取手牌元素位置，再刷新UI，最后播放动画
            const handEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
            const handRect = handEl ? handEl.getBoundingClientRect() : null;
            this.checkAndRefresh();
            raf(() => {
                if (handRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c)).then(() => tempEl.remove());
                }
                playSpellEffectV2(null, attr, card.name, effectType);
            });
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
        const result = this.engine.activateSpell(player, this.selectedCardIndex, target);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (!result.success) {
            this.state.validTargets = this.engine.getValidTargets(player, card.effect || card.effects?.[0]);
            this.refresh();
            return;
        }
        this.pendingEffectCard = null;
        this.selectedCardIndex = -1;
        this.state.validTargets = [];
        this.state.phase = returnPhase;
        // 出牌飞向墓地动画：先获取手牌元素位置，再刷新UI，最后播放动画
        const handEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        this.checkAndRefresh();
        const attr = card.attribute || card.element || "none";
        const effectType = card.effects?.[0]?.type || "none";
        this._lockForEffect(3800);
        raf(() => {
            if (handRect) {
                const tempEl = document.createElement("div");
                tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                document.body.appendChild(tempEl);
                animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c)).then(() => tempEl.remove());
            }
            playSpellEffectV2(null, attr, card.name, effectType);
        });
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
        this.refresh();
    }

    confirmTribute() {
        const result = this.engine.confirmTribute();
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        this.checkAndRefresh();
    }

    cancelTribute() {
        this.engine.cancelTribute();
        this.refresh();
    }

    selectAttacker(card) {
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.state.firstTurn && GAME_CONFIG.FIRST_TURN_NO_BATTLE) {
            this.ui.addLog("先攻首回合不能攻击", "damage");
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

    attackTarget(target) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (this.state.gameOver || !this.state.selectedAttacker) return;
        const attacker = this.state.selectedAttacker;

        // 先找到对方场上可能触发的陷阱卡DOM位置（在引擎处理前）
        const isBrowser = typeof document !== "undefined";
        const defenderSpellTrapSlots = isBrowser ? document.querySelectorAll(`[data-owner="1"][data-zone="spell-trap"]`) : [];
        const possibleTrapSlot = isBrowser ? [...defenderSpellTrapSlots].reverse().find(s => s.querySelector(".card-back-icon")) : null;

        const result = this.engine.attack(attacker, target);
        this.ui.addLog(result.message, result.success ? "damage" : "damage");
        this.state.selectedAttacker = null;

        // 陷阱发动特效 —— 在 checkAndRefresh 之前播放
        if (result.trap) {
            this._lockForEffect(1800);
            const trapName = result.message.match(/【(.+?)】/)?.[1] || "陷阱";
            if (possibleTrapSlot) {
                playTrapChainEffect(possibleTrapSlot, trapName);
            } else {
                // 备用：直接播放全屏通告
                showAnnounceBanner("trap", "counter", trapName);
            }
            // 延迟刷新，让动画播放
            setTimeout(() => this.checkAndRefresh(), 1200);
            return;
        }

        this._lockForEffect(600);

        this.checkAndRefresh();

        raf(() => {
            const attackerOwner = this.state.players[0].monsterZone.some(c => c.instanceId === attacker.instanceId) ? 0 : 1;
            const attackerSlots = document.querySelectorAll(`[data-owner="${attackerOwner}"][data-zone="monster"]`);
            const attackerSlot = [...attackerSlots].find(s => s.dataset.instanceId === attacker.instanceId);

            if (target === "player") {
                playAttackEffect(attackerSlot, null);
                const oppHud = document.querySelector("#opponent-area .player-hud");
                if (oppHud) showDamageNumber(oppHud, attacker.currentAttack || 0, "damage");
            } else if (target?.instanceId) {
                const targetOwner = attackerOwner === 0 ? 1 : 0;
                const targetSlots = document.querySelectorAll(`[data-owner="${targetOwner}"][data-zone="monster"]`);
                const targetSlot = [...targetSlots].find(s => s.dataset.instanceId === target.instanceId);
                playAttackEffect(attackerSlot, targetSlot);
                if (targetSlot) {
                    const dmg = Math.max(0, (attacker.currentAttack || 0) - (target.currentDefense || 0));
                    if (dmg > 0) showDamageNumber(targetSlot, dmg, "damage");
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
        if (this.mode === "local") {
            this.ui.showHandoff(this.state.currentPlayer.name, () => this._beginTurn());
            return;
        }
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
        this._scheduleAi(() => this._runAiMainStep(actionCount + 1));
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

        const result = this.engine.attack(attacker, target);
        this.ui.addLog(result.message, "damage");

        // 陷阱发动特效
        if (result.trap) {
            const trapName = result.message.match(/【(.+?)】/)?.[1] || "陷阱";
            if (possibleTrapSlot) {
                playTrapChainEffect(possibleTrapSlot, trapName);
            } else {
                showAnnounceBanner("trap", "counter", trapName);
            }
            setTimeout(() => this.checkAndRefresh(), 1200);
        } else {
            this.checkAndRefresh();
            raf(() => {
                const aiSlots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                const attackerSlot = [...aiSlots].find(s => s.dataset.instanceId === attacker.instanceId);
                if (target === "player") {
                    playAttackEffect(attackerSlot, null);
                    const playerHud = document.querySelector("#player-area .player-hud");
                    if (playerHud) showDamageNumber(playerHud, attacker.currentAttack || 0, "damage");
                } else if (target?.instanceId) {
                    const targetSlots = document.querySelectorAll(`[data-owner="0"][data-zone="monster"]`);
                    const targetSlot = [...targetSlots].find(s => s.dataset.instanceId === target.instanceId);
                    playAttackEffect(attackerSlot, targetSlot);
                }
            });
        }

        this.state.selectedAttacker = null;
        this.checkAndRefresh();
        if (this.state.gameOver) return;
        this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
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
                raf(() => {
                    const slots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                    const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                    if (lastSlot) playSummonEffect(lastSlot, card.attribute || "none", card.name, card.level);
                });
                return { ...confirmed, card: confirmed.card || card, actionLabel: "AI SUMMON" };
            }
            raf(() => {
                const slots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                if (lastSlot) playSummonEffect(lastSlot, card.attribute || "none", card.name, card.level);
            });
            return { ...result, card: result.card || card, actionLabel: "AI SUMMON" };
        }
        if (action.kind === "spell") {
            const target = this._chooseAiEffectTarget(ai, card);
            // 获取对手手牌区域位置用于出牌动画
            const oppHandEl = document.getElementById("opponent-hand");
            const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
            const result = this.engine.activateSpell(ai, index, target);
            const effectType = card.effects?.[0]?.type || "none";
            this.checkAndRefresh();
            this._lockForEffect(3800);
            raf(() => {
                // 对手出牌飞向墓地动画（与玩家一样的运镜）
                if (oppHandRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "opponent-graveyard-pile").then(() => tempEl.remove());
                }
                playSpellEffectV2(null, card.attribute || "none", card.name, effectType);
            });
            return { ...result, card, actionLabel: "AI SPELL" };
        }
        if (action.kind === "trap") {
            const result = this.engine.setCard(ai, index);
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
