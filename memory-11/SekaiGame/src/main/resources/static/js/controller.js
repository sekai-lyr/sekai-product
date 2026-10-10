import { publicCard, publicOpponent, materialValue, legalMaterials, attackReady } from "./ai-policy.js";
import { motionDuration, motionCancellation, onMotionCancel } from "./duel-motion.js";
/**
 * controller.js
 * 自动阶段回合控制器：玩家只需要出牌、攻击和点击“结束回合”。
 */

import { PHASE, GAME_CONFIG, MONSTER_POSITION } from "./constants.js";
import { playSound, pitchForRarity } from "./audio.js?v=1.0.0";
import { createCardInstance } from "./model.js";
import { getCardById } from "./catalog.js";
import { emitControllerAction } from "./controller-2d.js?v=2.1.0-mesh-model";
import {
    playSummonEffect, playSpellEffect, playTrapEffect, playRuleDrivenEffect,
    playAttackEffect, playAttackAnimation, showDamageNumber, playDestroyEffect,
    playHealEffect, playPlayerHealEffect, playDrawEffect, playPhaseFlash,
    animateDrawCard, animatePlayToZone, animatePlayToGraveyard, createCardBackHtml,
    playFlipSummonEffect, playTrapChainEffect,
    playMonsterEffect, playSpellEffectV2, playTrapEffectV2,
    playDestroyEffectV2, playHealEffectV2, showAnnounceBanner,
    playTrapActivationV3, playTrapActivationV5, playCounterTrapV3, playSpellCinematic,
    animateCinematicDestroy, animateCinematicReturnToDeck, animateCinematicReturnToHand,
    animateTrapToGraveyard, playNegatedAttackBarrier, playCoinFlip,
} from "./effects.js?v=1.10.2-card-atlas-4x4";

const raf = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : typeof document !== "undefined" ? fn => setTimeout(fn, 0) : () => {};

// 特效锁定时间（毫秒）—— 必须 >= 横幅停留时间
const EFFECT_LOCK_MS = 2600;
const ANIMATED_DRAW_EFFECTS = new Set(["drawCards", "gameThroneDraw", "discardAndDraw", "healDrawNoSpecial", "recoverAndDrawV2"]);

export class GameController {
    constructor(gameState, engine, ui) {
        this.disposed = false;
        this._pendingTimers = new Set();
        this._disposedPromise = new Promise(resolve => { this._resolveDisposed = resolve; });
        this.state = gameState;
        this.engine = engine;
        this.ui = ui;
        this.mode = "ai";
        this.pvpClient = null;
        this.aiDifficulty = "normal";
        this.aiProfile = { skill: 2, lookahead: 1 };
        this.aiTimer = null;
        this.selectedCardIndex = -1;
        this.pendingEffectCard = null;
        this.pendingMonsterEffect = null;
        this.phaseBeforeSelection = PHASE.MAIN_1;
        this.attackSelectionReturnPhase = null;
        this.aiActionDelay = 600;
        this.aiMaxMainActions = 6;
        this.onGameOver = null;
        this.turnEnding = false;
        this.turnAckTimer = null;
        this._effectQueue = Promise.resolve();
        this._pvpTurnGeneration = 0;
        this._interactionLocks = new Set();
        this._animationLocks = new Set();
        this._selectionContext = null;
        this.effectBusy = false; // 特效播放期间锁定操作
        this._lockTimers = []; // 多个特效锁定计时器
        this._unsubscribeMotion = onMotionCancel(() => this._releaseEffectLocks());
        /** 新手教学的教练对象（由 main.js 注入；为 null 时不影响任何逻辑） */
        this.tutorial = null;
        this.engine?.eventBus?.on?.("onCoinFlip", ({ result }) => playCoinFlip(result));
        this.engine?.eventBus?.on?.("onStatusTick", () => playSound("statusTick"));
        this.engine?.eventBus?.on?.("onDeckReveal", event => this._showDeckOrdering(event));
        this.engine?.eventBus?.on?.("onDeckSearch", event => this._showDeckSearch(event));
        this.engine?.eventBus?.on?.("onTrapActivated", ({ owner, trap, triggerType }) => {
            if (typeof document === "undefined" || !trap) return;
            const ownerIndex = this.state.players.indexOf(owner);
            const slot = [...document.querySelectorAll(`[data-owner="${ownerIndex}"][data-zone="spell-trap"]`)]
                .find(element => element.dataset.instanceId === trap.instanceId)
                || [...document.querySelectorAll(`[data-owner="${ownerIndex}"][data-zone="spell-trap"]`)]
                    .find(element => element.querySelector(".card-back-icon"));
            showAnnounceBanner("trap", "counter", trap.name || "陷阱");
            if (slot) playTrapActivationV5(slot, trap);
            // 陷阱真正发动（引擎 onTrapActivated）后才通知主控：盖放、未发动、被无效都不会触发。
            emitControllerAction("trap", {
                playerIndex: ownerIndex,
                cardId: trap.id,
                cardType: "trap",
                cardName: trap.name || "",
                triggerType: triggerType || "manual",
            });
        });
        if (this.engine) {
            // 玩家的盖放陷阱改用游戏内确认浮层（替代浏览器原生 confirm）：
            // 引擎在无副作用的决策点挂起，UI 确认后继续结算。
            this.engine.trapConfirmHandler = ({ traps }) => this._showTrapConfirm(traps);
        }
    }

    get effectBusy() { return this._effectBusy || this._animationLocks?.size > 0 || this._interactionLocks?.size > 0 || !!this.trapConfirmOpen; }
    set effectBusy(value) { this._effectBusy = value; }

    _showDeckOrdering({ cards, player, reorder } = {}) {
        if (!Array.isArray(cards) || !cards.length || typeof this.ui?.showDeckOrdering !== "function") return;
        const interactive = this.mode === "local" || player === this.state.players[0];
        const turn = this.state.turn;
        const lock = Symbol("deck-ordering");
        this._interactionLocks.add(lock);
        this.ui.showDeckOrdering(cards, ordered => {
            if (!this._interactionLocks.delete(lock)) return;
            if (interactive && !this.state.gameOver && this.state.turn === turn) reorder?.(ordered);
        }, { interactive, deckId: player === this.state.players[0] ? "player-deck-pile" : "opponent-deck-pile" });
    }

    /**
     * 展示抽取（scout/study）：从展示的卡组顶卡里任选 1 张加入手牌。
     * 只对发动者本人可交互；对手与压测环境保持引擎默认结算（第一张符合类型的卡），
     * 选择通过 swap 回调落账，PvP 下随动作快照同步给对手，无需协议改动。
     */
    _showDeckSearch({ cards, eligible, chosen, player, swap } = {}) {
        if (!Array.isArray(cards) || !cards.length || typeof swap !== "function") return;
        if ((this.mode !== "local" && player !== this.state.players[0]) || typeof this.ui?.showDeckSearch !== "function") return;
        const turn = this.state.turn;
        const lock = Symbol("deck-search");
        this._interactionLocks.add(lock);
        this.ui.showDeckSearch(cards, chosen, picked => {
            if (!this._interactionLocks.delete(lock) || this.state.gameOver || this.state.turn !== turn) return;
            if (picked && picked !== chosen && swap(picked)) {
                this.ui.addLog(`改为选择「${picked?.name}」加入手牌`, "play");
            }
            this.refresh();
        }, eligible);
    }

    /**
     * 陷阱响应确认浮层：列出可发动的盖放陷阱，玩家勾选后继续结算。
     * 引擎在无副作用的决策点挂起，浮层期间暂停 AI 行动，确认后恢复。
     */
    _showTrapConfirm(traps) {
        this.trapConfirmOpen = true;
        const turn = this.state.turn;
        let finished = false;
        const finish = selectedIds => {
            if (finished) return;
            finished = true;
            this.trapConfirmOpen = false;
            if (this.state.gameOver || this.state.turn !== turn) return;
            const selected = Array.isArray(selectedIds) ? selectedIds : [];
            // 攻击响应挂起优先：恢复攻击者并同步重放本次攻击（演出与日志走原有路径）
            const pendingBattle = this.engine.takePendingBattleTrapConfirm?.();
            if (pendingBattle) {
                const isAiAttacker = this.mode === "ai" && pendingBattle.attackerOwner === this.state.players[1];
                this.engine.armTrapDecisions(selected);
                try {
                    this.state.selectedAttacker = pendingBattle.attacker;
                    if (isAiAttacker) this._runAiBattleStep();
                    else this.attackTarget(pendingBattle.target, 0);
                } finally {
                    this.engine.clearTrapDecisions();
                }
                return;
            }
            const result = this.engine.resolveReactiveTrapConfirm(selected);
            if (result) this.ui.addLog(result, "play");
            this.checkAndRefresh();
        };
        if (typeof this.ui?.showTrapConfirm !== "function") {
            // 无浮层 UI（测试/node 环境）的兜底：保持旧行为——全部发动，同步结算
            finish((this.engine.pendingBattleTrapConfirm?.traps || traps).map(trap => trap.instanceId));
            return;
        }
        this.ui.showTrapConfirm(traps, selectedIds => finish(selectedIds));
    }

    /** 教学钩子：把玩家动作告诉教练，只有当前步骤等待的动作才会推进。 */
    notifyTutorial(action, payload = {}) {
        if (!this.tutorial || this.tutorial.finished || this.tutorial.skipped) return false;
        return this.tutorial.notify(action, payload);
    }

    // 特效锁定：播放特效期间禁止玩家操作（支持叠加，取最大时长）
    _lockForEffect(duration = EFFECT_LOCK_MS) {
        this.effectBusy = true;
        const timer = this._later(() => {
            this._lockTimers = this._lockTimers.filter(t => t !== timer);
            if (this._lockTimers.length === 0) this.effectBusy = false;
        }, duration);
        this._lockTimers.push(timer);
    }

    _releaseEffectLocks() {
        this._lockTimers.forEach(timer => { clearTimeout(timer); this._pendingTimers.delete(timer); });
        this._lockTimers = [];
        this.effectBusy = false;
    }

    // 每段异步演出只释放自己的锁；旧计时器不能提前解锁尚未完成的演出。
    async _runEffect(play) {
        if (this.disposed) return;
        const lock = Symbol("animation");
        this._animationLocks.add(lock);
        try {
            await Promise.race([play(), this._disposedPromise, motionCancellation()]);
            if (this.disposed) return;
        } catch (error) {
            console.error("Duel animation failed:", error);
            this.ui.addLog("演出已跳过，已结算的牌局结果保留", "play");
        } finally {
            this._animationLocks.delete(lock);
            if (!this.state.gameOver) this.refresh();
        }
    }

    _canInteract() {
        if (this.disposed || this.state.gameOver || this.turnEnding || !this._isHumanAllowed()) return false;
        if (!this.effectBusy) return true;
        this.ui.addLog(this.trapConfirmOpen ? "请先完成陷阱响应" : this._interactionLocks.size
            ? "请先完成选卡操作" : "请等待当前演出结束", "damage");
        return false;
    }

    _clearTargetSelection(restorePhase = true) {
        const context = this._selectionContext;
        const sameTurn = !context || (context.turn === this.state.turn && context.owner === this.state.currentPlayerIndex);
        if (restorePhase && sameTurn && [PHASE.TARGET_SELECT, PHASE.GRAVEYARD_SELECT].includes(this.state.phase)) {
            this.state.phase = this.phaseBeforeSelection || PHASE.MAIN_1;
        }
        this.selectedCardIndex = -1;
        this.pendingEffectCard = null;
        this.pendingMonsterEffect = null;
        this.pendingSetSpell = false;
        this.state.validTargets = [];
        this._selectionContext = null;
    }

    _beginTargetSelection(card, effect, { targets, cardIndex = -1, fromSet = false, monster = false, effectIndex = null } = {}) {
        if (!this._canInteract()) return false;
        const validTargets = targets || this.engine.getValidTargets(this.state.currentPlayer, effect);
        if (!validTargets.length) { this.ui.addLog("没有合法目标", "damage"); return false; }
        this._clearTargetSelection();
        this.phaseBeforeSelection = this.state.phase;
        this._selectionContext = { turn: this.state.turn, owner: this.state.currentPlayerIndex };
        this.pendingEffectCard = card;
        this.pendingSetSpell = fromSet;
        this.pendingMonsterEffect = monster ? { card, effectIndex } : null;
        this.selectedCardIndex = cardIndex;
        this.state.selectedAttacker = null;
        this.state.validTargets = validTargets;
        this.state.phase = this.engine.getEffectTargetType(effect) === "graveyard" ? PHASE.GRAVEYARD_SELECT : PHASE.TARGET_SELECT;
        this.ui.addLog(`请选择${card.name}的目标`, "play");
        this.refresh();
        return true;
    }

    // ---- PvP 卡牌序列化 ----
    /** 提取可 JSON 序列化的卡牌字段（排除循环引用和函数） */
    _serializeCard(card) {
        if (!card) return null;
        return {
            id: card.id,
            instanceId: card.instanceId,
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

    _later(callback, delay = 0) {
        if (this.disposed) return null;
        const timer = setTimeout(() => {
            this._pendingTimers.delete(timer);
            if (!this.disposed) callback();
        }, motionDuration(delay));
        this._pendingTimers.add(timer);
        return timer;
    }

    _frame(callback) { return raf(() => { if (!this.disposed) callback(); }); }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.clearAiTimer(); this.clearTurnAckTimer();
        for (const timer of this._pendingTimers) clearTimeout(timer);
        this._pendingTimers.clear(); this._releaseEffectLocks();
        this._animationLocks.clear(); this._interactionLocks.clear();
        this.trapConfirmOpen = false;
        this._unsubscribeMotion();
        this._resolveDisposed();
    }

    clearAiTimer() {
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this._pendingTimers.delete(this.aiTimer);
            this.aiTimer = null;
        }
    }

    clearTurnAckTimer() {
        if (this.turnAckTimer) {
            clearTimeout(this.turnAckTimer);
            this.turnAckTimer = null;
        }
    }

    start() {
        if (this.disposed) return;
        this.clearAiTimer();
        this.mulliganUsed = false;
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

        // 先给玩家一次起手重抽的机会，再猜拳决定先后手
        this.offerMulligan(() => {
            // 教学模式固定由玩家先攻、且跳过猜拳与重抽浮层：起手是脚本排好的，
            // 重抽会在第 6 步单独讲解。
            if (this.mode === "ai" && !this.tutorial && typeof this.ui.showFirstPlayerChoice === "function") {
                this.ui.showFirstPlayerChoice(begin);
            } else {
                begin(0);
            }
        });
    }

    /**
     * 起手重抽。只在 AI 对局（含训练模式）提供：PvP 下双方各自重抽会打乱
     * 共享种子的随机序列，需要协议级同步，暂不启用。
     */
    offerMulligan(callback) {
        const human = this.state.players[0];
        const canOffer = this.mode === "ai"
            && !this.mulliganDisabled
            && !this.mulliganUsed
            && typeof this.ui.showMulliganChoice === "function";
        if (!canOffer) {
            this.autoMulliganAi();
            callback();
            return;
        }
        this.mulliganUsed = true;
        this.ui.showMulliganChoice(human.hand, redraw => {
            if (this.disposed) return;
            if (redraw) {
                const result = this.engine.mulligan(human);
                this.ui.addLog(`你重抽了起手手牌，换成 ${result.count} 张新卡`, "play");
            } else {
                this.ui.addLog("保留起手手牌", "play");
            }
            this.autoMulliganAi();
            callback();
        });
    }

    /** AI 使用与玩家一致的判定规则：手牌里没有能立刻打出的牌才重抽。 */
    autoMulliganAi() {
        if (this.mode !== "ai") return;
        const ai = this.state.players[1];
        if (!ai || !this.wantsMulligan(ai)) return;
        const result = this.engine.mulligan(ai);
        if (result.success) this.ui.addLog(`${ai.name}重抽了起手手牌`, "play");
    }

    /** 起手能否"立刻出牌"：有 ≤4 星怪兽（免祭品）或魔法卡。 */
    wantsMulligan(player) {
        const hand = player?.hand || [];
        const hasFreeSummon = hand.some(card => card?.type === "monster" && (Number(card.level) || 0) <= 4);
        const hasSpell = hand.some(card => card?.type === "spell");
        return !hasFreeSummon && !hasSpell;
    }

    async _beginTurn({ openingTurn = false } = {}) {
        if (this.disposed) return;
        this.attackSelectionReturnPhase = null;
        if (this.state.gameOver) return;
        this.effectBusy = false; // 新回合开始时解锁
        playSound("turn");
        this.notifyTutorial("turnStart", { player: this.state.currentPlayer });
        const drawResult = this.engine.startTurn({ skipDraw: openingTurn });
        const player = this.state.currentPlayer;
        this.ui.addLog(`=== 第${this.state.turn}回合 · ${player.name}的回合 ===`, "turn");

        if (openingTurn) {
            this.ui.showDrawAnimation?.(null, this.state.currentPlayerIndex, "FIRST TURN · NO DRAW");
            this.ui.addLog("先攻首回合跳过抽卡阶段，并且不能攻击", "play");
        } else if (drawResult.deckOut) {
            this.ui.addLog(drawResult.message, "damage");
            this.checkAndRefresh();
            return;
        } else if (drawResult.card) {
            playSound("draw");
            const isOpponentDraw = this.state.currentPlayerIndex === 1;
            if (isOpponentDraw) {
                this.ui.addLog(`${player.name}抽了1张卡`, "play");
            } else {
                this.ui.addLog(`${player.name}抽到了${drawResult.card.name}`, "play");
            }

            // 抽卡已经由引擎入账，演出只读取结果。
            const pendingCard = drawResult.card;

            // 玩家和对手都播放抽卡动画，但对手用卡背
            if (!isOpponentDraw) {
                this.ui.showDrawAnimation?.(pendingCard, 0, "DRAW PHASE");
            }
            if (this.mode === "pvp" && this.state.currentPlayerIndex === 0) {
                this._pvpSend({ type: "draw", count: 1 });
            }
            await this._runEffect(async () => {
                if (typeof document === "undefined") return;
                playDrawEffect();
                const htmlFn = isOpponentDraw ? (c => createCardBackHtml(c)) : (c => this.ui.cardHTML(c));
                await animateDrawCard(pendingCard, htmlFn, isOpponentDraw);
                if (this.disposed) return;
            });

        }

        if (this.disposed) return;
        this._frame(() => playPhaseFlash());

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
        if (!this._canInteract()) return;
        this.attackSelectionReturnPhase = null;
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
        if (!this._canInteract()) return false;
        if (this.state.phase === PHASE.BATTLE) {
            this.state.phase = this.attackSelectionReturnPhase === PHASE.MAIN_1
                ? PHASE.MAIN_1 : PHASE.MAIN_2;
            this.attackSelectionReturnPhase = null;
            this.state.selectedAttacker = null;
            this.ui.addLog(this.state.phase === PHASE.MAIN_1 ? "已取消尚未确认的攻击，返回主要阶段1" : "已自动进入主要阶段2", "turn");
        }
        return this.state.phase === PHASE.MAIN_1 || this.state.phase === PHASE.MAIN_2;
    }

    summonMonster(cardIndex, position = MONSTER_POSITION.ATTACK, faceDown = false) {
        if (!this._canInteract()) return;
        if (!this._ensureMainPhaseForHandAction()) {
            this.ui.addLog("当前不能召唤怪兽", "damage");
            return;
        }
        const card = this.state.currentPlayer.hand[cardIndex];
        // 先获取手牌元素位置（引擎处理后卡牌会从手牌移除）
        const handEl = typeof document === "undefined"
            ? null
            : document.querySelector(`[data-instance-id="${card?.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        const result = this.engine.normalSummon(this.state.currentPlayer, cardIndex, position, faceDown);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card, private: faceDown } : null);
        if (result.success && !result.needsTribute) {
            this._pvpSendWithCard("summon", cardIndex, card, { position, faceDown });
        }
        if (result.needsTribute) {
            this.refresh();
            return;
        }
        if (result.success && card) {
            if (this.state.currentPlayerIndex === 0) {
                // 只有引擎 normalSummon 成功（含祭品结算完成）才通知主控。
                emitControllerAction("summon", {
                    playerIndex: 0,
                    cardId: card.id,
                    cardType: "monster",
                    cardName: card.name || "",
                    faceDown,
                    position,
                });
            }
            playSound(faceDown ? "set" : "summon", { pitch: pitchForRarity(card.rarity) });
            this.notifyTutorial(faceDown ? "set" : "summon", { card });
            const attr = card.attribute || card.element || "none";
            const hasOnSummon = !faceDown && card.effects?.some(e => e.trigger === "onSummon");
            const owner = this.state.currentPlayerIndex;
            this.checkAndRefresh();
            if (typeof document !== "undefined") this._runEffect(async () => {
                const slots = document.querySelectorAll(`[data-owner="${owner}"][data-zone="monster"]`);
                const lastSlot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
                if (!lastSlot) return;
                if (handRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    try {
                        await animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75, isCardBack: faceDown });
                        if (this.disposed) return;
                    } finally { tempEl.remove(); }
                }
                await playSummonEffect(lastSlot, attr, card.name, card.level, card.rarity, { faceDown });
                if (this.disposed) return;
                if (hasOnSummon) {
                    const effectType = card.effects.find(e => e.trigger === "onSummon")?.type || "none";
                    playMonsterEffect(lastSlot, attr, effectType, card);
                }
            });
        } else {
            this.checkAndRefresh();
        }
    }

    setCard(cardIndex) {
        if (!this._canInteract()) return;
        if (!this._ensureMainPhaseForHandAction()) {
            this.ui.addLog("当前不能盖放卡牌", "damage");
            return;
        }
        const card = this.state.currentPlayer.hand[cardIndex];
        if (card?.type === "monster") {
            return this.summonMonster(cardIndex, MONSTER_POSITION.DEFENSE, true);
        }
        // 先获取手牌元素位置
        const handEl = typeof document === "undefined"
            ? null
            : document.querySelector(`[data-instance-id="${card?.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        const result = this.engine.setCard(this.state.currentPlayer, cardIndex);
        if (result.success) {
            if (this.state.currentPlayerIndex === 0) {
                // 只有盖放成功（引擎 setCard 返回 success）才通知主控。
                emitControllerAction("play", {
                    playerIndex: 0,
                    cardId: card?.id,
                    cardType: card?.type || "unknown",
                    cardName: card?.name || "",
                });
            }
            playSound("set", { pitch: pitchForRarity(card?.rarity) });
            this.notifyTutorial("set", { card });
        }
        // 陷阱卡盖放时，只显示"盖放了一张陷阱卡"，不暴露具体名称
        const logMsg = (result.success && card?.type === "trap")
            ? "盖放了一张陷阱卡"
            : result.message;
        this.ui.addLog(logMsg, result.success ? "play" : "damage",
            result.success ? { card, private: true } : null);
        if (result.success && !result.needsTribute) this._pvpSendWithCard("set", cardIndex, card);
        if (result.needsTribute) {
            this.refresh();
            return;
        }
        this.checkAndRefresh();
        if (!result.success || typeof document === "undefined") return;
        if (result.success && card) {
            const isTrap = card.type === "trap";
            this._lockForEffect(800);
            this._frame(() => {
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
                    this._later(() => { lastSlot.style.animation = ""; }, 350);
                }
            });
        }
    }

    canActivateSetSpell(card) {
        return this.engine.canActivateSetSpell(this.state.currentPlayer, card);
    }

    canActivateTrapManually(card) {
        return this.engine.canActivateTrapManually(this.state.currentPlayer, card);
    }

    activateSetTrap(card) {
        if (!card || !this._canInteract()) return;
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        const result = this.engine.activateSetTrap(this.state.currentPlayer, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage", result.success ? { card } : null);
        if (result.success) {
            this._pvpSendWithCard("activateSetTrap", -1, card);
            this._lockForEffect(1200);
        }
        this.checkAndRefresh();
    }

    async _playRevivedMonsterArrival(effectType, ownerIndex) {
        if (effectType !== "reviveRecentGraveyard" && effectType !== "reviveRecentGraveyardV2"
            && effectType !== "specialSummonFromGraveyard") return;
        const revived = this.engine._lastRevivedCard;
        if (!revived) return;
        this.checkAndRefresh();
        await new Promise(resolve => this._later(resolve, 80));
        if (this.disposed) return;
        const slot = [...document.querySelectorAll(`[data-owner="${ownerIndex}"][data-zone="monster"]`)]
            .find(item => item.dataset.instanceId === revived.instanceId);
        if (!slot) return;
        playSummonEffect(slot, revived.attribute || "none", revived.name, revived.level, revived.rarity, {
            specialSummon: true,
            fromGraveyard: true,
        });
        await new Promise(resolve => this._later(resolve, 1500));
        if (this.disposed) return;
    }

    activateSetSpell(card) {
        if (!card || !this._canInteract() || !this._ensureMainPhaseForHandAction()) return;
        const availability = this.engine.canActivateSetSpell(this.state.currentPlayer, card);
        if (!availability.canActivate) { this.ui.addLog(availability.reason, "damage"); return; }
        const player = this.state.currentPlayer;
        const effect = card.effect || card.effects?.[0];
        const targetType = this.engine.getEffectTargetType(effect);
        if (!["none", "enemy_player", "self_player", "both_players"].includes(targetType)) {
            this._beginTargetSelection(card, effect, { fromSet: true });
            return;
        }
        const result = this.engine.activateSetSpell(player, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage", result.success ? { card } : null);
        if (result.success) {
            if (this.state.currentPlayerIndex === 0) {
                // 盖放魔法主动发动成功。
                emitControllerAction("spell", {
                    playerIndex: 0,
                    cardId: card.id,
                    cardType: "spell",
                    cardName: card.name || "",
                    fromSet: true,
                });
            }
            this._pvpSendWithCard("activateSpell", -1, card, { fromSet: true });
            this._runEffect(async () => {
                const spellAttr = card.attribute || card.element || "none";
                await playSpellCinematic(spellAttr, card.name, card.rarity);
                if (this.disposed) return;
                await playSpellEffectV2(null, spellAttr, card.name, card.effects?.[0]?.type || "none", card, 0);
                if (this.disposed) return;
                this.checkAndRefresh();
            });
        }
        this.checkAndRefresh();
    }

    flipSummon(card) {
        if (!this._canInteract()) return;
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) {
            this.ui.addLog("只能在主要阶段翻转召唤", "damage");
            return;
        }
        const result = this.engine.flipSummon(this.state.currentPlayer, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card } : null);
        if (result.success) {
            const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
            this._pvpSend({ type: "flipSummon", monsterIndex });
        }
        this.checkAndRefresh();
        if (result.success && result.card) {
            this._lockForEffect(1600);
            this._frame(() => {
                const slots = typeof document === "undefined" ? [] : document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
                if (slot) {
                    slot.classList.add("flip-summoning");
                    this._later(() => slot.classList.remove("flip-summoning"), 600);
                    const flipAttr = card.attribute || card.element || "none";
                    playFlipSummonEffect(slot, false, flipAttr);
                    const hasOnFlip = card.effects?.some(e => e.trigger === "onFlip");
                    if (hasOnFlip) {
                        this._later(() => {
                            const attr = card.attribute || card.element || "none";
                            const effectType = card.effects?.find(e => e.trigger === "onFlip")?.type || "none";
                            playMonsterEffect(slot, attr, effectType, card);
                        }, 700);
                    }
                }
            });
        }
    }

    changePosition(card) {
        if (!this._canInteract()) return;
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

    activateMonsterEffect(card, effectIndex = null) {
        if (!this._canInteract()) return;
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        // 只选中了攻击手、尚未指定目标时，允许反悔并回到主要阶段发动主动技。
        if (this.state.phase === PHASE.BATTLE && this.state.selectedAttacker && this.attackSelectionReturnPhase === PHASE.MAIN_1) {
            this.state.selectedAttacker = null;
            this.attackSelectionReturnPhase = null;
            this.state.phase = PHASE.MAIN_1;
        }
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) {
            this.ui.addLog("只能在主要阶段发动效果", "damage");
            return;
        }
        if (!card || !this.state.currentPlayer.monsterZone.includes(card)) {
            this.ui.addLog("只能发动己方场上怪兽的效果", "damage");
            return;
        }
        if (!card.faceUp || (!card.rulesVersion && card.oncePerTurnUsed)) {
            this.ui.addLog("该效果本回合已使用过", "damage");
            return;
        }
        // 单体主题动作允许玩家手选目标；选择态复用原有确认流（confirmTarget）。
        const manualEffect = Number.isInteger(effectIndex)
            ? card.effects?.[effectIndex]
            : (card.effects || []).find(effect => effect.trigger === "manual");
        const targetType = this.engine.getEffectTargetType(manualEffect);
        if (targetType !== "none") {
            const validTargets = this.engine.getValidTargets(this.state.currentPlayer, manualEffect).filter(target => !target.isPlayer);
            if (!validTargets.length) {
                this.ui.addLog("没有合法目标", "damage");
                return;
            }
            this._beginTargetSelection(card, manualEffect, { targets: validTargets, monster: true, effectIndex });
            return;
        }
        let visualOrigin = null;
        if (typeof document !== "undefined") {
            const sourceElement = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
            const sourceRect = sourceElement?.getBoundingClientRect?.();
            if (sourceRect?.width) visualOrigin = { getBoundingClientRect: () => sourceRect };
        }
        const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
        const result = this.engine.triggerAllEffects(this.state.currentPlayer, card, "manual", { effectIndex });
        if (result) {
            if (!card.rulesVersion) card.oncePerTurnUsed = true;
            this.ui.addLog(`${card.name}发动效果：${result}`, "play", { card });
            this._pvpSend({ type: "activateMonsterEffect", monsterIndex, effectIndex });
            // 播放怪兽效果特效
            const slots = typeof document === "undefined"
                ? []
                : document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
            const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
            if (slot) {
                const attr = card.attribute || card.element || "none";
                const selectedEffect = Number.isInteger(effectIndex)
                    ? card.effects?.[effectIndex]
                    : card.effects?.find(e => e.trigger === "manual");
                const effectType = selectedEffect?.type || "none";
                this._lockForEffect(1000);
                this._frame(() => playMonsterEffect(slot, attr, effectType, card, effectIndex, null, visualOrigin));
            }
        } else {
            this.ui.addLog("没有可发动的效果", "damage");
        }
        this.checkAndRefresh();
    }

    activateSpell(cardIndex) {
        if (!this._canInteract()) return;
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
            this._beginTargetSelection(card, primaryEffect, { cardIndex });
            return;
        }
        const handBefore = new Set(this.state.currentPlayer.hand.map(handCard => handCard.instanceId));
        // 记录对方场上怪兽，用于检测"返回手牌"效果
        const opp = this.state.opponentPlayer;
        const oppFieldBefore = new Map(opp.monsterZone.map(c => [c.instanceId, c]));
        const oppSlotRects = new Map();
        if (typeof document !== "undefined") {
            document.querySelectorAll('[data-owner="1"][data-zone="monster"]').forEach(slot => {
                if (slot.dataset.instanceId) oppSlotRects.set(slot.dataset.instanceId, slot.getBoundingClientRect());
            });
        }
        const oppHandBefore = new Set(opp.hand.map(c => c.instanceId));
        const result = this.engine.activateSpell(this.state.currentPlayer, cardIndex);
        if (result.success) playSound("spell", { pitch: pitchForRarity(card.rarity) });
        if (result.success && this.state.currentPlayerIndex === 0) {
            // 魔法真正发动（引擎 activateSpell 返回 success）后才通知主控。
            emitControllerAction("spell", {
                playerIndex: 0,
                cardId: card.id,
                cardType: "spell",
                cardName: card.name || "",
                fromSet: false,
            });
        }
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card } : null);
        if (result.success) this._pvpSendWithCard("activateSpell", cardIndex, card);
        if (result.success && card) {
            const attr = card.attribute || card.element || "none";
            const effectType = card.effects?.[0]?.type || "none";

            // 先获取手牌元素位置（checkAndRefresh 会重新渲染，之后就找不到了）
            const handEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
            const handRect = handEl ? handEl.getBoundingClientRect() : null;
            const player = this.state.currentPlayer;
            const drawnCards = ANIMATED_DRAW_EFFECTS.has(effectType)
                ? player.hand.filter(handCard => !handBefore.has(handCard.instanceId))
                : [];

            // 先播魔法卡飞向墓地运镜，等完成后再抽卡

            if (result.isFieldSpell) {
                this.checkAndRefresh();
                // 场地魔法：飞向场地卡槽
                this._lockForEffect(3800);
                this._frame(() => {
                    const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="${this.state.currentPlayerIndex}"][data-zone="field"]`);
                    if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                    if (handRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                    }
                    this._later(async () => {
                        await playSpellCinematic(attr, card.name, card.rarity);
                        if (this.disposed) return;
                        await playSpellEffectV2(null, attr, card.name, effectType, card, this.state.currentPlayerIndex);
                        if (this.disposed) return;
                    }, 600);
                });
            } else {
                const destroyedMonsters = [...oppFieldBefore.values()].filter(
                    monster => !opp.monsterZone.some(current => current.instanceId === monster.instanceId)
                        && opp.graveyard.some(current => current.instanceId === monster.instanceId),
                );
                if (handEl) {
                    handEl.style.pointerEvents = "none";
                    handEl.style.opacity = "0";
                }
                // 普通魔法：先飞墓地，完成后再抽卡
                this._runEffect(async () => {
                    // 阶段1：魔法卡飞向墓地
                    if (handRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        try { await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "player-graveyard-pile"); } finally { tempEl.remove(); }
                    }
                    // 阶段2：魔法卡运镜 → 播放魔法特效
                    await playSpellCinematic(attr, card.name, card.rarity);
                    if (this.disposed) return;
                    await playSpellEffectV2(null, attr, card.name, effectType, card, this.state.currentPlayerIndex);
                    if (this.disposed) return;
                    await this._playRevivedMonsterArrival(effectType, this.state.currentPlayerIndex);
                    if (this.disposed) return;
                    await new Promise(resolve => this._later(resolve, 1300));
                    if (this.disposed) return;
                    for (const destroyed of destroyedMonsters) {
                        const savedRect = oppSlotRects.get(destroyed.instanceId);
                        if (!savedRect) continue;
                        await animateCinematicDestroy(
                            { getBoundingClientRect: () => savedRect },
                            destroyed,
                            c => this.ui.cardHTML(c),
                            "opponent-graveyard-pile",
                        );
                    }
                    this.checkAndRefresh();

                    // 阶段2.5：检测是否有怪兽被返回手牌，播放电影级动画
                    const returnedCards = [];
                    for (const [instanceId, cardData] of oppFieldBefore) {
                        if (!opp.monsterZone.some(c => c.instanceId === instanceId)) {
                            // 这只怪兽被移除了，检查是否在对方手牌中
                            const returnedCard = opp.hand.find(c => c.instanceId === instanceId);
                            if (returnedCard) {
                                returnedCards.push(returnedCard);
                            }
                        }
                    }
                    if (returnedCards.length > 0) {
                        this._lockForEffect(2000);
                        for (const returnedCard of returnedCards) {
                            // 找到怪兽被移除前的DOM槽位（用对方场上现有的怪兽位置估算）
                            const savedRect = oppSlotRects.get(returnedCard.instanceId);
                            const fromSlot = savedRect ? { getBoundingClientRect: () => savedRect } : null;
                            await animateCinematicReturnToHand(returnedCard, c => this.ui.cardHTML(c), fromSlot, "opponent-hand");
                            if (this.disposed) return;
                            await new Promise(r => this._later(r, 300));
                            if (this.disposed) return;
                        }
                    }

                    // 阶段3：如果有抽卡效果，逐张播放抽卡运镜
                    if (drawnCards.length > 0) {
                        await new Promise(resolve => this._later(resolve, 800)); // 等魔法特效播完
                        // 逐张展示已经入账的抽卡结果
                        for (const drawn of drawnCards) {
                            if (drawn && drawn.type) {
                                this.ui.showDrawAnimation?.(drawn, 0, "DRAW");
                                await animateDrawCard(drawn, c => this.ui.cardHTML(c));
                                if (this.disposed) return;

                                this.refresh();
                                await new Promise(r => this._later(r, 200)); // 间隔
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
        if (!this._canInteract()) return;
        const context = this._selectionContext;
        if (context && (context.turn !== this.state.turn || context.owner !== this.state.currentPlayerIndex)) {
            this._clearTargetSelection(false);
            this.refresh();
            return;
        }
        if (this.state.phase !== PHASE.TARGET_SELECT && this.state.phase !== PHASE.GRAVEYARD_SELECT) return;
        const source = this.pendingEffectCard;
        if (source && this._selectionContext) {
            const owner = this.state.currentPlayer;
            const zone = this.pendingMonsterEffect ? owner.monsterZone : this.pendingSetSpell ? owner.spellTrapZone : owner.hand;
            if (!zone.includes(source)) {
                this.ui.addLog("发动卡已离开原区域，已取消选择", "damage");
                this._clearTargetSelection(); this.refresh(); return;
            }
            const effect = this.pendingMonsterEffect
                ? (Number.isInteger(this.pendingMonsterEffect.effectIndex) ? source.effects?.[this.pendingMonsterEffect.effectIndex] : source.effects?.find(e => e.trigger === "manual"))
                : source.effect || source.effects?.[0];
            const legal = this.engine.getValidTargets(owner, effect);
            const sameTarget = candidate => candidate === target || (target?.instanceId && candidate.instanceId === target.instanceId)
               ;
            if (!legal.some(sameTarget)) {
                this.state.validTargets = legal;
                this.ui.addLog("目标已失效，请重新选择或取消", "damage");
                this.refresh(); return;
            }
        }
        if (this.pendingMonsterEffect) {
            const { card, effectIndex } = this.pendingMonsterEffect;
            const player = this.state.currentPlayer;
            const returnPhase = this.phaseBeforeSelection || PHASE.MAIN_1;
            const monsterIndex = player.monsterZone.indexOf(card);
            const result = this.engine.triggerAllEffects(player, card, "manual", { effectIndex, selectedTarget: target });
            this._clearTargetSelection();
            this.state.phase = returnPhase;
            if (result) {
                this.ui.addLog(`${card.name}发动效果：${result}`, "play", { card });
                this._pvpSend({ type: "activateMonsterEffect", monsterIndex, effectIndex, targetId: target?.instanceId || null });
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
                if (slot) {
                    const attr = card.attribute || card.element || "none";
                    const selectedEffect = Number.isInteger(effectIndex)
                        ? card.effects?.[effectIndex]
                        : card.effects?.find(effect => effect.trigger === "manual");
                    const effectType = selectedEffect?.type || "none";
                    const targetElement = target?.instanceId
                        ? document.querySelector(`[data-instance-id="${target.instanceId}"]`)
                        : null;
                    const targetRect = targetElement?.getBoundingClientRect?.();
                    const targetSlot = targetRect?.width
                        ? { getBoundingClientRect: () => targetRect, classList: { add() {}, remove() {} } }
                        : targetElement;
                    const sourceRect = slot.getBoundingClientRect?.();
                    const visualOrigin = sourceRect?.width ? { getBoundingClientRect: () => sourceRect } : null;
                    this._lockForEffect(1000);
                    this._frame(() => playMonsterEffect(slot, attr, effectType, card, effectIndex, targetSlot, visualOrigin));
                }
            } else {
                this.ui.addLog("没有可发动的效果", "damage");
            }
            this.checkAndRefresh();
            return;
        }
        const player = this.state.currentPlayer;
        const cardIndex = this.pendingEffectCard && !this.pendingSetSpell ? player.hand.indexOf(this.pendingEffectCard) : this.selectedCardIndex;
        const card = this.pendingSetSpell ? this.pendingEffectCard : player.hand[cardIndex];
        if (!card) {
            this.cancelTargetSelect();
            return;
        }
        const returnPhase = this.phaseBeforeSelection || PHASE.MAIN_1;
        const handBefore = new Set(player.hand.map(handCard => handCard.instanceId));
        // 记录对方场上怪兽，用于检测"返回手牌"效果
        const opp = this.state.opponentPlayer;
        const oppFieldBefore = new Map(opp.monsterZone.map(c => [c.instanceId, c]));
        const oppSlotRects = new Map();
        if (typeof document !== "undefined") {
            document.querySelectorAll('[data-owner="1"][data-zone="monster"]').forEach(slot => {
                if (slot.dataset.instanceId) oppSlotRects.set(slot.dataset.instanceId, slot.getBoundingClientRect());
            });
        }
        const result = this.pendingSetSpell
            ? this.engine.activateSetSpell(player, card, target)
            : this.engine.activateSpell(player, cardIndex, target);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card } : null);
        if (!result.success) {
            this.state.validTargets = this.engine.getValidTargets(player, card.effect || card.effects?.[0]);
            this.refresh();
            return;
        }
        const activatedFromSet = !!this.pendingSetSpell;
        // 目标选择界面确认后魔法真正发动：此处才是成功节点（失败分支已经 return）。
        if (this.state.currentPlayerIndex === 0) {
            emitControllerAction("spell", {
                playerIndex: 0,
                cardId: card.id,
                cardType: "spell",
                cardName: card.name || "",
                fromSet: activatedFromSet,
            });
        }
        this._clearTargetSelection();
        this.state.phase = returnPhase;
        this._pvpSendWithCard("activateSpell", cardIndex, card, {
            targetId: target?.instanceId || null,
            targetIsPlayer: !!target?.isPlayer,
            fromSet: activatedFromSet,
        });
        const handEl = typeof document === "undefined"
            ? null
            : document.querySelector(`[data-instance-id="${card.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        const attr = card.attribute || card.element || "none";
        const effectType = card.effects?.[0]?.type || "none";
        const drawnCards = ANIMATED_DRAW_EFFECTS.has(effectType)
            ? player.hand.filter(handCard => !handBefore.has(handCard.instanceId))
            : [];
        if (result.isFieldSpell) {
            this.checkAndRefresh();
            this._lockForEffect(3800);
            this._frame(() => {
                const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="${this.state.currentPlayerIndex}"][data-zone="field"]`);
                if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                if (handRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                }
                this._later(async () => {
                    await playSpellCinematic(attr, card.name, card.rarity);
                    if (this.disposed) return;
                    await playSpellEffectV2(null, attr, card.name, effectType, card, this.state.currentPlayerIndex);
                    if (this.disposed) return;
                }, 600);
            });
        } else {
            const destroyedMonsters = [...oppFieldBefore.values()].filter(
                monster => !opp.monsterZone.some(current => current.instanceId === monster.instanceId)
                    && opp.graveyard.some(current => current.instanceId === monster.instanceId),
            );
            if (handEl) {
                handEl.style.pointerEvents = "none";
                handEl.style.opacity = "0";
            }
            this._runEffect(async () => {
                if (handRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    try { await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "player-graveyard-pile"); } finally { tempEl.remove(); }
                }
                await playSpellCinematic(attr, card.name, card.rarity);
                if (this.disposed) return;
                await playSpellEffectV2(null, attr, card.name, effectType, card, this.state.currentPlayerIndex);
                if (this.disposed) return;
                await this._playRevivedMonsterArrival(effectType, this.state.currentPlayerIndex);
                if (this.disposed) return;
                await new Promise(resolve => this._later(resolve, 1300));
                if (this.disposed) return;
                for (const destroyed of destroyedMonsters) {
                    const savedRect = oppSlotRects.get(destroyed.instanceId);
                    if (!savedRect) continue;
                    await animateCinematicDestroy(
                        { getBoundingClientRect: () => savedRect },
                        destroyed,
                        c => this.ui.cardHTML(c),
                        "opponent-graveyard-pile",
                    );
                }
                this.checkAndRefresh();

                // 检测是否有怪兽被返回手牌，播放电影级动画
                const returnedCards = [];
                for (const [instanceId, cardData] of oppFieldBefore) {
                    if (!opp.monsterZone.some(c => c.instanceId === instanceId)) {
                        const returnedCard = opp.hand.find(c => c.instanceId === instanceId);
                        if (returnedCard) returnedCards.push(returnedCard);
                    }
                }
                if (returnedCards.length > 0) {
                    this._lockForEffect(2000);
                    for (const returnedCard of returnedCards) {
                        const savedRect = oppSlotRects.get(returnedCard.instanceId);
                        const fromSlot = savedRect ? { getBoundingClientRect: () => savedRect } : null;
                        await animateCinematicReturnToHand(returnedCard, c => this.ui.cardHTML(c), fromSlot, "opponent-hand");
                        if (this.disposed) return;
                        await new Promise(r => this._later(r, 300));
                        if (this.disposed) return;
                    }
                }

                if (drawnCards.length > 0) {
                    await new Promise(resolve => this._later(resolve, 800));
                    if (this.disposed) return;
                    for (const drawn of drawnCards) {
                        if (drawn && drawn.type) {
                            this.ui.showDrawAnimation?.(drawn, 0, "DRAW");
                            await animateDrawCard(drawn, c => this.ui.cardHTML(c));
                            if (this.disposed) return;

                            this.refresh();
                            await new Promise(r => this._later(r, 200));
                            if (this.disposed) return;
                        }
                    }
                }
            });
        }
    }

    cancelTargetSelect() {
        if (!this._canInteract()) return;
        if (this.state.phase === PHASE.BATTLE && this.state.selectedAttacker) {
            this.cancelAttackSelection();
            return;
        }
        if (![PHASE.TARGET_SELECT, PHASE.GRAVEYARD_SELECT].includes(this.state.phase) && !this._selectionContext) return;
        this._clearTargetSelection();
        this.refresh();
    }

    cancelAttackSelection() {
        if (!this._canInteract() || this.state.phase !== PHASE.BATTLE) return;
        if (!this.state.selectedAttacker) return;
        const returnPhase = this.attackSelectionReturnPhase;
        this.state.selectedAttacker = null;
        this.attackSelectionReturnPhase = null;
        this.state.pendingBattleReplay = null;
        if (returnPhase === PHASE.MAIN_1) this.state.phase = PHASE.MAIN_1;
        this.ui.addLog(returnPhase === PHASE.MAIN_1 ? "已取消攻击，可以继续发动主动技或出牌" : "已取消攻击选择，仍处于战斗阶段", "turn");
        this.refresh();
    }

    selectTribute(card) {
        if (!this._canInteract() || this.state.phase !== PHASE.TRIBUTE_SELECT || !this.state.pendingTribute) return;
        const result = this.engine.selectTribute(card);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card } : null);
        this.refresh();
    }

    confirmTribute() {
        if (!this._canInteract() || this.state.phase !== PHASE.TRIBUTE_SELECT || !this.state.pendingTribute) return;
        const pending = this.state.pendingTribute;
        const card = pending?.card;
        const cardIndex = pending?.cardIndex ?? -1;
        const tributeCount = pending?.needed || (Number(card?.level) >= 7 ? 2 : 1);
        const materialRects = typeof document === "undefined" ? [] : (pending?.selected || []).map(material =>
            [...document.querySelectorAll('[data-zone="monster"]')].find(slot => slot.dataset.instanceId === material.instanceId)?.getBoundingClientRect()).filter(Boolean);
        const result = this.engine.confirmTribute();
        if (result.success) playSound(result.card?.faceUp === false ? "set" : "summon", { pitch: pitchForRarity(result.card?.rarity) });
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success && card) {
            this._pvpSendWithCard("summon", cardIndex, card, {
                position: result.card?.position || MONSTER_POSITION.ATTACK,
                faceDown: !result.card?.faceUp,
                tributeSummon: true,
                tributeCount,
                materialIds: (pending?.selected || []).map(material => material.instanceId),
            });
        }
        this.checkAndRefresh();
        if (result.success && card && result.card?.faceUp !== false) {
            this._frame(() => {
                const slots = document.querySelectorAll('[data-owner="0"][data-zone="monster"]');
                const slot = result.card?.instanceId
                    ? [...slots].find(item => item.dataset.instanceId === result.card.instanceId)
                    : [...slots].reverse().find(item => item.querySelector(".card"));
                if (slot) playSummonEffect(slot, card.attribute || "none", card.name, card.level, card.rarity, {
                    tributeSummon: true,
                    tributeCount,
                    materialRects,
                });
            });
        }
    }

    cancelTribute() {
        if (!this._canInteract() || this.state.phase !== PHASE.TRIBUTE_SELECT || !this.state.pendingTribute) return;
        this.engine.cancelTribute();
        this.refresh();
    }

    selectAttacker(card) {
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.effectBusy) {
            this.ui.addLog("请等待特效播完", "damage");
            return;
        }
        if (this.state.firstTurn && GAME_CONFIG.FIRST_TURN_NO_BATTLE) {
            this.ui.addLog("先攻首回合不能攻击", "damage");
            return;
        }
        if (this.state.currentPlayer.skipBattlePhase) {
            this.ui.addLog("本回合不能进入战斗阶段", "damage");
            return;
        }
        // 先校验被点击的怪兽是否真的能攻击，再推进阶段：否则点击一只守备表示/
        // 已攻击/被冻结的怪兽也会不可逆地把回合推进到战斗阶段，并清空已选攻击者。
        if (!this.state.currentPlayer.monsterZone.includes(card) || !card?.faceUp || !card.canAttack || card.cannotAttack
            || card.position === MONSTER_POSITION.DEFENSE
            || card.themedState?.frozenUntil >= this.state.turn
            || card.themedState?.paralyzedUntil >= this.state.turn) {
            this.ui.addLog(`${card?.name || "该怪兽"}当前不能攻击`, "damage");
            return;
        }
        if (this.state.phase === PHASE.MAIN_1) {
            this.attackSelectionReturnPhase = PHASE.MAIN_1;
            this.state.phase = PHASE.BATTLE;
            this.ui.addLog("已自动进入战斗阶段", "turn");
        }
        if (this.state.phase !== PHASE.BATTLE) {
            this.ui.addLog("主要阶段2之后不能重新进入战斗阶段", "damage");
            return;
        }
        if (this.state.selectedAttacker?.instanceId === card.instanceId) {
            this.cancelAttackSelection();
            return;
        }
        this.state.selectedAttacker = card;
        this.ui.addLog(`选择${card.name}攻击`, "play");
        if (this.state.opponentPlayer.monsterZone.length === 0) {
            this.attackPlayer();
            return;
        }
        this.refresh();
    }

    attackTarget(target, _redirectDepth = 0) {
        if (!this._canInteract()) return;
        if (this.state.gameOver || !this.state.selectedAttacker) return;
        // 重定向安全限制：最多重定向3次，防止无限循环
        if (_redirectDepth > 3) {
            this.ui.addLog("攻击重定向次数过多，攻击终止", "damage");
            this.state.selectedAttacker = null;
            return;
        }
        const attacker = this.state.selectedAttacker;
        const attackerOwnerIdx = this.state.currentPlayerIndex;
        const defenderOwnerIdx = 1 - attackerOwnerIdx;
        const attackerIndexBeforeBattle = this.state.currentPlayer.monsterZone.indexOf(attacker);
        const targetIndexBeforeBattle = target === "player"
            ? -1
            : this.state.opponentPlayer.monsterZone.indexOf(target);
        const attackerLpBeforeBattle = this.state.currentPlayer.lp;
        const defenderLpBeforeBattle = this.state.opponentPlayer.lp;

        // 先找到对方场上可能触发的陷阱卡DOM位置（在引擎处理前）
        const isBrowser = typeof document !== "undefined";
        const defenderSpellTrapSlots = isBrowser ? document.querySelectorAll(`[data-owner="${defenderOwnerIdx}"][data-zone="spell-trap"]`) : [];
        let possibleTrapSlot = isBrowser ? [...defenderSpellTrapSlots].reverse().find(s => s.querySelector(".card-back-icon")) : null;

        const result = this.engine.attack(attacker, target);
        if (result.success || result.pendingTrapConfirm || result.replay || result.redirect) this.attackSelectionReturnPhase = null;
        if (result.pendingTrapConfirm) {
            // 陷阱确认浮层已由引擎回调弹出；确认后恢复攻击者并重放本次攻击
            this.state.selectedAttacker = attacker;
            return;
        }
        this._playBattleSounds(result, attacker, target === "player" ? null : target);
        if (result.success) this.notifyTutorial("attack", { attacker, target });
        if (result.success) {
            if (attackerOwnerIdx === 0) {
                // 攻击真正成立（引擎 attack 返回 success 且未被取消/重放）后才通知主控。
                emitControllerAction("attack", {
                    playerIndex: 0,
                    cardId: attacker.id,
                    cardType: "monster",
                    cardName: attacker.name || "",
                    damage: Math.max(0, defenderLpBeforeBattle - this.state.opponentPlayer.lp),
                    targetType: target === "player" ? "player" : "monster",
                });
            }
            // 使用区域索引而非 instanceId（两端 instanceId 不同）
            let targetInfo;
            if (target === "player") {
                targetInfo = { targetType: "player" };
            } else {
                targetInfo = { targetType: "monster", targetIndex: targetIndexBeforeBattle };
            }
            this._pvpSend({
                type: "attack",
                attackerIndex: attackerIndexBeforeBattle,
                ...targetInfo,
                damageToAttacker: Math.max(0, attackerLpBeforeBattle - this.state.currentPlayer.lp),
                damageToDefender: Math.max(0, defenderLpBeforeBattle - this.state.opponentPlayer.lp),
                trapCardData: result.trap ? this._serializeCard(result.trapCard) : null,
                attackCanceled: result.attackCanceled === true,
            });
        }
        if (result.replay) {
            this.ui.addLog(result.message, "play");
            this.state.selectedAttacker = attacker;
            this.refresh();
            return;
        }
        // 攻击重定向（里间雨效果②）
        if (result.redirect) {
            this.ui.addLog(result.message, "play");
            this.state.selectedAttacker = attacker;
            this.attackTarget(result.redirect, _redirectDepth + 1);
            return;
        }
        if (!result.success) {
            this.ui.addLog(result.message, "damage");
            this.cancelAttackSelection();
            this.refresh();
            return;
        }
        if (result.trapCard) possibleTrapSlot = [...defenderSpellTrapSlots].find(slot => slot.dataset.instanceId === result.trapCard.instanceId) || possibleTrapSlot;
        this.ui.addLog(result.message, "damage",
            { card: result.trap ? result.trapCard : null, report: result.report });
        this.state.selectedAttacker = null;

        // 陷阱发动特效 —— 简化版：翻牌→效果→飞墓区
        if (result.trap) {
            const trapName = result.message.match(/【(.+?)】/)?.[1] || "陷阱";
            const trapCardData = result.trapCard || { name: trapName, type: "trap", rarity: "R" };
            if (possibleTrapSlot) {
                // 阶段1：翻牌动画（0-600ms）
                this._runEffect(async () => {
                    await playTrapActivationV5(possibleTrapSlot, trapCardData);
                    if (this.disposed) return;
                    await animateTrapToGraveyard(possibleTrapSlot, trapCardData);
                    if (this.disposed) return;
                    // 阶段2：播放效果特效（攻击无效、怪兽破坏等）
                    const attr = trapCardData.attribute || "none";
                    const effectType = trapCardData.effects?.[0]?.type || "none";
                    playTrapEffectV2(possibleTrapSlot, "counter", trapName, effectType, trapCardData, Number(possibleTrapSlot.dataset.owner || 0), { activationPlayed: true });
                    // 阶段3：效果播完后再飞墓区
                    if (result.attackCanceled) {
                        const attackerSlot = [...document.querySelectorAll(`[data-owner="${attackerOwnerIdx}"][data-zone="monster"]`)]
                            .find(slot => slot.dataset.instanceId === attacker.instanceId);
                        const targetSlot = target === "player"
                            ? document.querySelector(defenderOwnerIdx === 0 ? "#player-area .player-hud" : "#opponent-area .player-hud")
                            : [...document.querySelectorAll(`[data-owner="${defenderOwnerIdx}"][data-zone="monster"]`)]
                                .find(slot => slot.dataset.instanceId === target?.instanceId);
                        await playNegatedAttackBarrier(attackerSlot, targetSlot, attacker);
                        if (this.disposed) return;
                    } else {
                        await new Promise(resolve => this._later(resolve, 1300));
                        if (this.disposed) return;
                    }
                    this.checkAndRefresh();
                });
            } else {
                this._lockForEffect(2600);
                showAnnounceBanner("trap", "counter", trapName);
                this._later(() => this.checkAndRefresh(), 1500);
            }
            return;
        }

        if (typeof document === "undefined") {
            this.checkAndRefresh();
            return;
        }

        // 检查被破坏怪兽的onDestroyed效果并播放特效
        const destroyedTargets = [];
        if (target !== "player" && target?.instanceId) {
            const targetOwner = defenderOwnerIdx;
            const targetDestroyed = !this.state.players[targetOwner].monsterZone.some(c => c.instanceId === target.instanceId);
            if (targetDestroyed && target.effects?.some(e => e.trigger === "onDestroyed")) {
                destroyedTargets.push({ card: target, owner: targetOwner });
            }
        }
        const attackerDestroyed = !this.state.players[attackerOwnerIdx].monsterZone.some(c => c.instanceId === attacker.instanceId);
        if (attackerDestroyed && attacker.effects?.some(e => e.trigger === "onDestroyed")) {
            destroyedTargets.push({ card: attacker, owner: attackerOwnerIdx });
        }

        // --- 电影级破坏动画 ---
        // 在 checkAndRefresh 之前，找到被破坏怪兽的 DOM 槽位
        const attackerOwner = attackerOwnerIdx;
        const attackerElSlots = document.querySelectorAll(`[data-owner="${attackerOwner}"][data-zone="monster"]`);
        const attackerSlotEl = [...attackerElSlots].find(s => s.dataset.instanceId === attacker.instanceId);
        const attackerSlotRect = attackerSlotEl?.getBoundingClientRect() || null;
        const attackerSurvived = this.state.players[attackerOwner].monsterZone.some(c => c.instanceId === attacker.instanceId);

        // 如果目标被破坏，播放电影级粉碎动画
        if (target !== "player" && target?.instanceId) {
            const targetOwner = attackerOwner === 0 ? 1 : 0;
            const targetElSlots = document.querySelectorAll(`[data-owner="${targetOwner}"][data-zone="monster"]`);
            const targetSlotEl = [...targetElSlots].find(s => s.dataset.instanceId === target.instanceId);
            const targetSurvived = this.state.players[targetOwner].monsterZone.some(c => c.instanceId === target.instanceId);

            if (targetSlotEl && !targetSurvived) {
                // 先播放攻击碰撞
                const attackAnimation = playAttackAnimation(attackerSlotEl, targetSlotEl, attacker, attackerSurvived);
                const targetSlotRect = targetSlotEl.getBoundingClientRect();
                // 延迟播放破坏动画
                attackAnimation.then(() => {
                    if (this.disposed) return;
                    const graveId = targetOwner === 0 ? "player-graveyard-pile" : "opponent-graveyard-pile";
                    const destruction = [animateCinematicDestroy(
                        { getBoundingClientRect: () => targetSlotRect },
                        target,
                        c => this.ui.cardHTML(c),
                        graveId,
                    )];
                    if (!attackerSurvived && attackerSlotRect) destruction.push(animateCinematicDestroy(
                        { getBoundingClientRect: () => attackerSlotRect }, attacker, c => this.ui.cardHTML(c),
                        attackerOwner === 0 ? "player-graveyard-pile" : "opponent-graveyard-pile",
                    ));
                    Promise.all(destruction).then(() => {
                        if (this.disposed) return;
                        this.checkAndRefresh();
                        // 播放onDestroyed特效
                        for (const { card, owner } of destroyedTargets) {
                            const ownerIdx = owner;
                            const effectType = card.effects?.find(e => e.trigger === "onDestroyed")?.type || "none";
                            const attr = card.attribute || card.element || "none";
                            const tSlots = document.querySelectorAll(`[data-owner="${ownerIdx}"][data-zone="monster"]`);
                            this._later(() => {
                                if (tSlots.length > 0) playMonsterEffect(tSlots[tSlots.length - 1], attr, effectType);
                            }, 300);
                        }
                    });
                });
                // 战斗数据已经在引擎中结算完成；动画是视觉层，不能阻塞同一战斗阶段
                // 的其它合法攻击。
                this.checkAndRefresh();
                return;
            }
        }

        // 攻击方被战斗破坏（目标存活）时：先完整播放攻击演出，再让攻击者碎裂进墓。
        // 之前这条路径被 attackerSurvived 条件挡住，导致"攻击力低被打死"没有任何攻击特效。
        if (!attackerSurvived && target !== "player" && target?.instanceId && attackerSlotEl) {
            const defenderOwner = attackerOwner === 0 ? 1 : 0;
            const targetSlotLive = [...document.querySelectorAll(`[data-owner="${defenderOwner}"][data-zone="monster"]`)]
                .find(s => s.dataset.instanceId === target.instanceId);
            if (targetSlotLive) {
                this._runEffect(async () => {
                    await playAttackAnimation(attackerSlotEl, targetSlotLive, attacker, false);
                    if (this.disposed) return;
                    await animateCinematicDestroy(
                        attackerSlotEl,
                        attacker,
                        c => this.ui.cardHTML(c),
                        attackerOwner === 0 ? "player-graveyard-pile" : "opponent-graveyard-pile",
                    );
                    this.checkAndRefresh();
                });
                return;
            }
        }

        this.checkAndRefresh();

        this._frame(() => {
            const liveAttackerSlot = [...document.querySelectorAll(`[data-owner="${attackerOwner}"][data-zone="monster"]`)]
                .find(slot => slot.dataset.instanceId === attacker.instanceId) || attackerSlotRect;
            // 播放onDestroyed特效
            for (const { card, owner } of destroyedTargets) {
                const ownerIdx = owner === 0 ? 0 : this.state.currentPlayerIndex;
                const effectType = card.effects?.find(e => e.trigger === "onDestroyed")?.type || "none";
                const attr = card.attribute || card.element || "none";
                const tSlots = document.querySelectorAll(`[data-owner="${ownerIdx}"][data-zone="monster"]`);
                this._later(() => {
                    if (tSlots.length > 0) {
                        playMonsterEffect(tSlots[tSlots.length - 1], attr, effectType);
                    } else {
                        const oppSlots = document.querySelectorAll(`[data-owner="${ownerIdx === 0 ? 1 : 0}"][data-zone="monster"]`);
                        if (oppSlots.length > 0) playMonsterEffect(oppSlots[0], attr, effectType);
                    }
                }, 500);
            }

            if (target === "player") {
                // 直接攻击
                const oppHud = document.querySelector(defenderOwnerIdx === 0 ? "#player-area .player-hud" : "#opponent-area .player-hud");
                const oppLifeBar = oppHud?.querySelector(".hp-bar-wrap") || oppHud;
                playAttackAnimation(liveAttackerSlot, null, attacker, attackerSurvived, oppLifeBar).then(() => {
                    if (!this.disposed && oppHud) showDamageNumber(oppLifeBar, Number(result?.damage) || 0, "damage");
                });
            } else if (target?.instanceId && attackerSurvived) {
                // 攻击方存活但目标未被破坏（守备表示等情况）
                const targetOwner = attackerOwner === 0 ? 1 : 0;
                const targetSlots = document.querySelectorAll(`[data-owner="${targetOwner}"][data-zone="monster"]`);
                const targetSlot = [...targetSlots].find(s => s.dataset.instanceId === target.instanceId);
                playAttackAnimation(liveAttackerSlot, targetSlot, attacker, attackerSurvived);
                // 只在该怪兽真的受到战斗伤害时显示数字（守备表示且无贯穿时引擎不造成伤害）
                if (targetSlot && result?.damageTo === "defender" && result.damage > 0) {
                    const dmg = result.damage;
                    this._later(() => showDamageNumber(targetSlot, dmg, "damage"), 400);
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

    /**
     * 列出"本回合还没用掉的动作"，用于结束回合的二次确认与按钮提示。
     * 只有真的存在可执行操作时才提示，避免变成每次都弹的噪音。
     */
    pendingActions(player = this.state.currentPlayer) {
        const reasons = [];
        if (this.state.gameOver || player !== this.state.players[0]) return reasons;
        if (!player.normalSummonUsed) {
            const canSummon = player.hand.some(card => card?.type === "monster"
                && player.monsterZone.length >= this.engine.getTributeNeeded(card.level)
                && (player.monsterZone.length < GAME_CONFIG.MAX_MONSTER_ZONE || this.engine.getTributeNeeded(card.level) > 0));
            if (canSummon) reasons.push({ id: "summon", label: "还可以召唤 1 只怪兽" });
        }
        if (!this.state.firstTurn && !player.skipBattlePhase) {
            const canAttack = player.monsterZone.some(card => card.canAttack && !card.cannotAttack && card.faceUp
                && card.position === MONSTER_POSITION.ATTACK
                && !(card.themedState?.frozenUntil >= this.state.turn)
                && !(card.themedState?.paralyzedUntil >= this.state.turn));
            if (canAttack) reasons.push({ id: "attack", label: "还有可以攻击的怪兽" });
        }
        const playableSpells = player.hand.filter(card => (card?.type === "spell" || card?.type === "trap")
            && this.engine.canPlayEffect(player, card).canPlay);
        if (playableSpells.length > 0) reasons.push({ id: "hand", label: `手牌还有 ${playableSpells.length} 张可以发动/盖放` });
        return reasons;
    }

    endTurn(confirmed = false) {
        if (!this._canInteract()) return;
        if (![PHASE.MAIN_1, PHASE.BATTLE, PHASE.MAIN_2, PHASE.TARGET_SELECT, PHASE.GRAVEYARD_SELECT, PHASE.TRIBUTE_SELECT].includes(this.state.phase)) return;
        if (this.state.phase === PHASE.TRIBUTE_SELECT) this.cancelTribute();
        else if (this.state.phase === PHASE.TARGET_SELECT || this.state.phase === PHASE.GRAVEYARD_SELECT) this.cancelTargetSelect();

        // 还有可执行操作时先确认一次：误点"结束回合"会让整个主要阶段白费且无法撤回。
        // 教学模式下不弹确认，避免打断引导节奏（教练自己会提示该做什么）。
        if (!confirmed && !this.tutorial && typeof this.ui.showTurnEndConfirm === "function") {
            const reasons = this.pendingActions();
            if (reasons.length > 0) {
                const turn = this.state.turn;
                let confirmedOnce = false;
                this.ui.showTurnEndConfirm(reasons, () => {
                    if (this.disposed || confirmedOnce || this.state.turn !== turn) return;
                    confirmedOnce = true;
                    this.endTurn(true);
                });
                return;
            }
        }
        this.notifyTutorial("endTurn");

        const player = this.state.currentPlayer;
        const excess = Math.max(0, player.hand.length - GAME_CONFIG.END_HAND_LIMIT);
        // local 模式下双方都由玩家操作，任何一方都应当自己选择弃牌。
        const canChooseDiscard = this.mode !== "pvp"
            && this._isHumanAllowed()
            && typeof this.ui.showDiscardSelection === "function";
        if (excess > 0 && canChooseDiscard) {
            this.turnEnding = true;
            this.state.phase = PHASE.END;
            this.refresh();
            const turn = this.state.turn;
            let discardedOnce = false;
            this.ui.showDiscardSelection(player.hand, excess, selectedIds => {
                if (this.disposed || discardedOnce || this.state.gameOver || this.state.turn !== turn) return;
                discardedOnce = true;
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
        if (this.disposed || this.state.gameOver) return;
        this.turnEnding = this.mode === "pvp";
        this.state.phase = PHASE.END;
        this.engine.endTurn();
        if (this.mode === "local") {
            this.ui.showHandoff(this.state.currentPlayer.name, () => this._beginTurn());
            return;
        }
        if (this.mode === "pvp") {
            this.state.currentPlayerIndex = 1;
            this.checkAndRefresh();
            const finalState = this._serializePvpState();
            const requestId = `turn_${this.state.turn}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const sendEndTurn = () => this.pvpClient?.endTurn(finalState, requestId) === true;
            if (!sendEndTurn()) {
                this.turnEnding = false;
                this.ui.addLog("联机连接已断开，本次回合未提交", "damage");
                this.checkAndRefresh();
                return;
            }
            this.clearTurnAckTimer();
            this.turnAckTimer = setTimeout(() => {
                this.ui.addLog("正在重新确认回合状态…", "turn");
                sendEndTurn();
                this.turnAckTimer = setTimeout(() => {
                    this.turnAckTimer = null;
                    this.turnEnding = false;
                    this.ui.addLog("回合同步失败，请检查网络连接", "damage");
                    this.checkAndRefresh();
                }, 6000);
            }, 6000);
            return;
        }
        this.turnEnding = false;
        this._beginTurn();
    }

    // ---- PvP 远程操作同步 ----

    /** 发送动作到对手（附带卡牌数据用于隐藏信息揭示） */
    _pvpSend(action) {
        if (this.mode !== "pvp" || !this.pvpClient) return;
        this.pvpClient.sendAction({ ...action, state: this._serializePvpState() });
    }

    /** PvP 远端动作里的 targetId 还原：双方场上怪兽 + 双方墓地（按 instanceId 命中）。 */
    _resolvePvpTarget(targetId) {
        if (!targetId) return null;
        for (const player of this.state.players) {
            const onField = player.monsterZone.find(card => card.instanceId === targetId);
            if (onField) return onField;
            const inGrave = player.graveyard.find(card => card.instanceId === targetId);
            if (inGrave) return inGrave;
        }
        return null;
    }

    _serializePvpState() {
        const serializeTempEffect = effect => {
            if (!effect) return null;
            const { source, ...data } = effect;
            return {
                ...data,
                source: typeof source === "object"
                    ? source?.instanceId || source?.id || null
                    : source ?? null,
            };
        };
        const serializeCard = card => card ? {
            id: card.id,
            instanceId: card.instanceId,
            themedState: card.themedState || {},
            isToken: !!card.isToken,
            ...(card.isToken ? { name: card.name, type: card.type, attribute: card.attribute, level: card.level, attack: card.attack, defense: card.defense, effects: [] } : {}),
            currentAttack: card.currentAttack,
            currentDefense: card.currentDefense,
            position: card.position,
            faceUp: card.faceUp,
            faceDown: card.faceDown,
            canAttack: card.canAttack,
            cannotAttack: card.cannotAttack,
            hasAttackedThisTurn: card.hasAttackedThisTurn,
            attacksMadeThisTurn: card.attacksMadeThisTurn || 0,
            doubleAttackThisTurn: !!card.doubleAttackThisTurn,
            positionChangedThisTurn: card.positionChangedThisTurn,
            oncePerTurnUsed: card.oncePerTurnUsed,
            setTurn: card.setTurn,
            canActivate: card.canActivate,
            attackLocked: card.attackLocked,
            attackDisabledUntilEndPhase: card.attackDisabledUntilEndPhase,
            cannotBeTargeted: card.cannotBeTargeted,
            cannotBeAttacked: card.cannotBeAttacked,
            cannotBeDestroyedByBattle: card.cannotBeDestroyedByBattle,
            cannotBeDestroyedByEffect: card.cannotBeDestroyedByEffect,
            preventsBattleDamage: card.preventsBattleDamage,
            permanentBuffs: card.permanentBuffs || [],
            tempEffects: (card.tempEffects || []).map(serializeTempEffect).filter(Boolean),
        } : null;
        const serializePlayer = player => {
            const {
                deck, hand, monsterZone, spellTrapZone, fieldZone,
                graveyard, banished, extraDeck, oncePerTurnEffectsUsed, _tempBanished,
                ...playerState
            } = player;
            return {
                ...playerState,
                deck: deck.map(serializeCard),
                hand: hand.map(serializeCard),
                monsterZone: monsterZone.map(serializeCard),
                spellTrapZone: spellTrapZone.map(serializeCard),
                fieldZone: serializeCard(fieldZone),
                graveyard: graveyard.map(serializeCard),
                banished: banished.map(serializeCard),
                extraDeck: extraDeck.map(serializeCard),
                oncePerTurnEffectsUsed: [...(oncePerTurnEffectsUsed || [])],
                tempBanished: (_tempBanished || []).map(entry => ({
                    returnTurn: entry.returnTurn,
                    ownerIndex: entry.ownerIndex,
                    card: serializeCard(entry.card),
                })),
            };
        };
        return {
            currentPlayerIndex: this.state.currentPlayerIndex,
            turn: this.state.turn,
            phase: this.state.phase,
            winner: this.state.winner,
            isDraw: this.state.isDraw,
            gameOver: this.state.gameOver,
            winReason: this.state.winReason,
            firstTurn: this.state.firstTurn,
            players: this.state.players.map(serializePlayer),
        };
    }

    _applyPvpSnapshot(snapshot) {
        if (!snapshot || !Array.isArray(snapshot.players) || snapshot.players.length !== 2) return;
        this.attackSelectionReturnPhase = null;
        this.state.selectedAttacker = null;
        this.state.pendingBattleReplay = null;
        const assignPlayer = (target, source) => {
            const hydrateCard = data => {
                if (!data) return null;
                const base = getCardById(data.id);
                return { ...createCardInstance(base || { id: data.id, name: data.id, type: "monster" }), ...data };
            };
            for (const [key, value] of Object.entries(source)) {
                if (key === "oncePerTurnEffectsUsed") {
                    target.oncePerTurnEffectsUsed = new Set(value || []);
                } else if (key === "tempBanished") {
                    target._tempBanished = (value || []).map(entry => ({
                        returnTurn: entry.returnTurn,
                        ownerIndex: entry.ownerIndex,
                        card: hydrateCard(entry.card),
                    }));
                } else if (["deck", "hand", "monsterZone", "spellTrapZone", "graveyard", "banished", "extraDeck"].includes(key)) {
                    target[key] = (value || []).map(hydrateCard);
                } else if (key === "fieldZone") {
                    target.fieldZone = hydrateCard(value);
                } else {
                    target[key] = value;
                }
            }
        };
        assignPlayer(this.state.players[0], snapshot.players[1]);
        assignPlayer(this.state.players[1], snapshot.players[0]);
        this.state.currentPlayerIndex = snapshot.currentPlayerIndex === 0 ? 1 : 0;
        this.state.turn = snapshot.turn;
        this.state.phase = snapshot.phase;
        this.state.winner = snapshot.winner;
        this.state.isDraw = snapshot.isDraw;
        this.state.gameOver = snapshot.gameOver;
        this.state.winReason = snapshot.winReason;
        this.state.firstTurn = snapshot.firstTurn;
    }

    /** 从手牌出牌时，附带完整卡牌数据（对手不知道你手牌内容） */
    _pvpSendWithCard(type, cardIndex, card, extra = {}) {
        if (this.mode !== "pvp") return;
        this._pvpSend({ type, cardIndex, cardData: this._serializeCard(card), ...extra });
    }

    /** 接收并执行对手的动作 */
    applyRemoteAction(action) {
        if (this.disposed) return;
        if (this.mode !== "pvp" || !action) return Promise.resolve();
        const queuedAction = {
            ...action,
            _remoteVisual: this._captureRemoteVisual(action),
        };
        this._applyPvpSnapshot(action.state);
        this.checkAndRefresh();
        const generation = this._pvpTurnGeneration;
        this._effectQueue = this._effectQueue
            .then(() => this._applyRemoteActionQueued(queuedAction, generation))
            .catch(error => {
                console.error("PvP effect queue failed:", error);
                this.effectBusy = false;
            });
        return this._effectQueue;
    }

    async _applyRemoteActionQueued(action, generation = this._pvpTurnGeneration) {
        if (this.mode !== "pvp" || !action) return;
        if (generation !== this._pvpTurnGeneration) return;
        this.effectBusy = true;

        // 对手 = players[1]（从本地视角看）
        const opponent = this.state.players[1];
        const remoteVisual = action._remoteVisual || {};
        const remoteFieldSpell = action.type === "activateSpell"
            && action.cardData
            && (action.state?.players?.[0]?.fieldZone?.instanceId === action.cardData.instanceId
                || action.state?.players?.[0]?.fieldZone?.id === action.cardData.id);
        if (action.type === "activateSpell" && action.cardData && !remoteFieldSpell) {
            await this._playRemoteSpellSequence(action, remoteVisual);
            if (this.disposed) return;
            if (generation !== this._pvpTurnGeneration) {
                this.effectBusy = false;
                return;
            }
            this._logRemoteAction(action);
            this.checkAndRefresh();
            this.effectBusy = false;
            return;
        }
        if (action.type === "attack" && action.trapCardData) {
            await this._playRemoteTrapSequence(action, remoteVisual);
            if (this.disposed) return;
        }
        if (generation !== this._pvpTurnGeneration) {
            this.effectBusy = false;
            return;
        }
        await this._playRemoteActionEffect(action, remoteVisual);
        if (this.disposed) return;
        this._logRemoteAction(action);
        this.checkAndRefresh();
        await new Promise(resolve => this._frame(resolve));
        if (this.disposed) return;
        await this._playRemotePostRefreshEffect(action, remoteVisual);
        if (this.disposed) return;
        const settleDelay = action.type === "attack" ? 900
            : action.type === "summon" || action.type === "flipSummon" ? 500
                : action.type === "activateMonsterEffect" ? 600
                    : 50;
        await new Promise(resolve => this._later(resolve, settleDelay));
        if (this.disposed) return;
        this.effectBusy = false;
        return;

        switch (action.type) {
            case "turnStart": {
                this.state.currentPlayerIndex = 1;
                this.engine.startTurn({ skipDraw: true });
                this.state.phase = PHASE.STANDBY;
                this.engine.emit("onPhaseStart", { player: opponent, phase: PHASE.STANDBY });
                this.state.phase = PHASE.MAIN_1;
                this.state.selectedAttacker = null;
                this.turnEnding = false;
                break;
            }
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
                    card.faceDown = !!action.faceDown;
                    card.canAttack = !action.faceDown
                        && card.position === MONSTER_POSITION.ATTACK
                        && !this.state.firstTurn;
                    card.hasAttackedThisTurn = false;
                    card.positionChangedThisTurn = false;
                    card.setTurn = this.state.turn;
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
                    this.engine.activateSpell(opponent, 0, this._resolvePvpTarget(action.targetId) || action.targetSpec);
                }
                this.ui.addLog(`${opponent.name}发动了魔法卡`, "play");
                break;
            }
            case "activateMonsterEffect": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) {
                    this.engine.triggerAllEffects(opponent, monster, "manual", { effectIndex: action.effectIndex, selectedTarget: this._resolvePvpTarget(action.targetId) });
                }
                this.ui.addLog(`${opponent.name}发动了怪兽效果`, "play");
                break;
            }
            case "activateSetTrap": {
                const trap = opponent.spellTrapZone.find(item => item.instanceId === action.cardData?.instanceId);
                if (trap) this.engine.activateSetTrap(opponent, trap);
                this.ui.addLog(`${opponent.name}翻开了盖放的陷阱`, "play");
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
            case "syncState":
                break;
            default:
                console.warn("Unknown PvP action:", action.type);
                break;
        }
        this._playRemoteActionEffect(action, remoteVisual);
        this._applyPvpSnapshot(action.state);
        this.checkAndRefresh();
        this._frame(() => this._playRemotePostRefreshEffect(action, remoteVisual));
    }

    _logRemoteAction(action) {
        const opponentName = this.state.players[1]?.name || "对手";
        const messages = {
            turnStart: `${opponentName}的回合开始`,
            draw: `${opponentName}抽了${action.count || 1}张卡`,
            summon: action.faceDown
                ? `${opponentName}里侧守备盖放了怪兽`
                : `${opponentName}${action.tributeSummon ? "祭品召唤" : "召唤"}了${action.cardData?.name || "怪兽"}`,
            set: `${opponentName}盖放了一张卡`,
            flipSummon: `${opponentName}进行了翻转召唤`,
            changePosition: `${opponentName}改变了怪兽表示形式`,
            activateSpell: `${opponentName}发动了${action.cardData?.name || "魔法卡"}`,
            activateMonsterEffect: `${opponentName}发动了怪兽效果`,
            attack: `${opponentName}发动攻击`,
            discard: `${opponentName}在结束阶段丢弃手牌`,
        };
        const message = messages[action.type];
        if (!message) return;
        let card = null;
        if (action.type === "summon" && !action.faceDown) card = action.cardData;
        if (action.type === "flipSummon") {
            card = this.state.players[1]?.monsterZone?.[action.monsterIndex] || action.cardData;
        }
        if (action.type === "activateSpell") card = action.cardData;
        if (action.type === "activateMonsterEffect") {
            card = this.state.players[1]?.monsterZone?.[action.monsterIndex] || action.cardData;
        }
        if (action.type === "attack" && action.trapCardData) card = action.trapCardData;
        this.ui.addLog(message, action.type === "attack" ? "damage" : "play", card ? { card } : null);
    }

    _captureRemoteVisual(action) {
        if (typeof document === "undefined") return {};
        if (action.type === "summon" && action.tributeSummon) {
            return { materialRects: (action.materialIds || []).map(id =>
                [...document.querySelectorAll('[data-owner="1"][data-zone="monster"]')].find(slot => slot.dataset.instanceId === id)?.getBoundingClientRect()).filter(Boolean) };
        }
        if (action.type === "activateSpell" || action.type === "activateMonsterEffect") {
            const sourceCard = this.state.players[1].monsterZone[action.monsterIndex];
            const sourceSlot = sourceCard ? [...document.querySelectorAll('[data-owner="1"][data-zone="monster"]')]
                .find(slot => slot.dataset.instanceId === sourceCard.instanceId) : null;
            const effectTarget = action.targetId ? [...document.querySelectorAll('[data-instance-id]')]
                .find(slot => slot.dataset.instanceId === action.targetId) : null;
            return {
                sourceCard, sourceSlot, sourceRect: sourceSlot?.getBoundingClientRect() || null,
                effectTargetRect: effectTarget?.getBoundingClientRect() || null,
                localMonsters: this.state.players[0].monsterZone.map(card => {
                    const slot = [...document.querySelectorAll('[data-owner="0"][data-zone="monster"]')]
                        .find(item => item.dataset.instanceId === card.instanceId) || null;
                    return { card, slot, rect: slot?.getBoundingClientRect() || null };
                }),
            };
        }
        if (action.type !== "attack") return {};
        const attacker = this.state.players[1].monsterZone[action.attackerIndex];
        const target = action.targetType === "monster"
            ? this.state.players[0].monsterZone[action.targetIndex]
            : null;
        const findSlot = (owner, card) => {
            if (!card?.instanceId) return null;
            return [...document.querySelectorAll(`[data-owner="${owner}"][data-zone="monster"]`)]
                .find(slot => slot.dataset.instanceId === card.instanceId) || null;
        };
        const attackerSlot = findSlot(1, attacker);
        const targetSlot = findSlot(0, target);
        return {
            attacker,
            target,
            attackerSlot,
            targetSlot,
            attackerRect: attackerSlot?.getBoundingClientRect() || null,
            targetRect: targetSlot?.getBoundingClientRect() || null,
            trapSlot: action.trapCardData?.instanceId
                ? [...document.querySelectorAll('[data-owner="0"][data-zone="spell-trap"]')]
                    .find(slot => slot.dataset.instanceId === action.trapCardData.instanceId)
                    || [...document.querySelectorAll('[data-owner="0"][data-zone="spell-trap"]')]
                        .reverse().find(slot => slot.querySelector(".card-back-icon"))
                    || null
                : null,
        };
    }

    async _playRemoteTrapSequence(action, visual) {
        const trapCard = action.trapCardData;
        if (!trapCard) return;
        if (!visual.trapSlot) {
            showAnnounceBanner("trap", "counter", trapCard.name || "陷阱");
            await new Promise(resolve => this._later(resolve, 1200));
            if (this.disposed) return;
            return;
        }
        await playTrapActivationV5(visual.trapSlot, trapCard);
        if (this.disposed) return;
        await animateTrapToGraveyard(visual.trapSlot, trapCard);
        if (this.disposed) return;
        playTrapEffectV2(
            visual.trapSlot,
            "counter",
            trapCard.name || "陷阱",
            trapCard.effects?.[0]?.type || "none",
            trapCard,
            0,
            { activationPlayed: true },
        );
        await new Promise(resolve => this._later(resolve, 1300));
        if (this.disposed) return;
    }

    async _playRemoteActionEffect(action, visual) {
        if (typeof document === "undefined") return;
        if (action.type === "attack" && action.attackCanceled) {
            await playNegatedAttackBarrier(visual.attackerSlot, visual.targetSlot, visual.attacker);
            if (this.disposed) return;
            return;
        }
        if (action.type === "activateMonsterEffect" && visual.localMonsters) {
            const nextLocal = action.state?.players?.[1];
            for (const item of visual.localMonsters) {
                if (!item.slot || nextLocal?.monsterZone?.some(card => card.instanceId === item.card.instanceId)) continue;
                if (nextLocal?.hand?.some(card => card.instanceId === item.card.instanceId)) {
                    animateCinematicReturnToHand(item.card, card => this.ui.cardHTML(card), item.slot, "hand");
                } else if (nextLocal?.deck?.some(card => card.instanceId === item.card.instanceId)) {
                    animateCinematicReturnToDeck(item.card, card => this.ui.cardHTML(card), item.slot, "player-deck-pile");
                } else if (nextLocal?.graveyard?.some(card => card.instanceId === item.card.instanceId)) {
                    animateCinematicDestroy(
                        item.slot,
                        item.card,
                        card => this.ui.cardHTML(card),
                        "player-graveyard-pile",
                    );
                }
            }
            return;
        }
        if (action.type !== "attack" || (!visual.attackerSlot && !visual.attackerRect)) return;
        const targetSurvived = !visual.target || action.state?.players?.[1]?.monsterZone
            ?.some(card => card.instanceId === visual.target.instanceId);
        const attackerSurvived = action.state?.players?.[0]?.monsterZone
            ?.some(card => card.instanceId === visual.attacker?.instanceId);
        const liveAttackerSlot = [...document.querySelectorAll('[data-owner="1"][data-zone="monster"]')]
            .find(slot => slot.dataset.instanceId === visual.attacker?.instanceId)
            || visual.attackerRect
            || visual.attackerSlot;
        const liveTargetSlot = visual.target
            ? [...document.querySelectorAll('[data-owner="0"][data-zone="monster"]')]
                .find(slot => slot.dataset.instanceId === visual.target.instanceId)
                || visual.targetRect
                || visual.targetSlot
            : null;
        const playerHud = action.targetType === "player"
            ? document.querySelector("#player-area .player-hud")
            : null;
        const playerLifeBar = playerHud?.querySelector(".hp-bar-wrap") || playerHud;
        await playAttackAnimation(
            liveAttackerSlot,
            liveTargetSlot,
            visual.attacker,
            attackerSurvived !== false,
            playerLifeBar,
        );
        if (this.disposed) return;
        if (action.damageToDefender > 0) {
            const localHud = document.querySelector("#player-area .player-hud");
            const localLifeBar = localHud?.querySelector(".hp-bar-wrap") || localHud;
            if (localHud) showDamageNumber(localLifeBar, action.damageToDefender, "damage");
        }
        if (action.damageToAttacker > 0) {
            const remoteHud = document.querySelector("#opponent-area .player-hud");
            if (remoteHud) showDamageNumber(remoteHud, action.damageToAttacker, "damage");
        }
        const destruction = [];
        if ((visual.targetRect || visual.targetSlot) && targetSurvived === false) {
            destruction.push(animateCinematicDestroy(
                visual.targetRect || visual.targetSlot,
                visual.target,
                card => this.ui.cardHTML(card),
                "player-graveyard-pile",
            ));
        }
        if (attackerSurvived === false) destruction.push(animateCinematicDestroy(visual.attackerRect || visual.attackerSlot, visual.attacker, card => this.ui.cardHTML(card), "opponent-graveyard-pile"));
        await Promise.all(destruction);
    }

    async _playRemoteSpellSequence(action, visual) {
        if (typeof document === "undefined") return;
        const card = action.cardData;
        const effectType = card.effects?.[0]?.type || "none";
        const opponentHand = document.getElementById("opponent-hand");
        const handRect = opponentHand?.getBoundingClientRect();
        if (handRect) {
            const anchor = document.createElement("div");
            anchor.style.cssText = `position:fixed;left:${handRect.left + handRect.width / 2 - 71}px;top:${handRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
            document.body.appendChild(anchor);
            await animatePlayToGraveyard(card, anchor, item => this.ui.cardHTML(item), "opponent-graveyard-pile");
            anchor.remove();
            if (this.disposed) return;
        }
        await playSpellCinematic(
            card.attribute || card.element || "none",
            card.name || "",
            card.rarity,
        );
        if (this.disposed) return;
        await playSpellEffectV2(
            null,
            card.attribute || card.element || "none",
            card.name || "",
            effectType,
            card,
            1,
        );
        if (this.disposed) return;
        await new Promise(resolve => this._later(resolve, 1300));
        if (this.disposed) return;

        const nextLocal = action.state?.players?.[1];
        for (const item of visual.localMonsters || []) {
            if (nextLocal?.monsterZone?.some(current => current.instanceId === item.card.instanceId)) continue;
            if (nextLocal?.graveyard?.some(current => current.instanceId === item.card.instanceId) && item.rect) {
                await animateCinematicDestroy(
                    { getBoundingClientRect: () => item.rect },
                    item.card,
                    current => this.ui.cardHTML(current),
                    "player-graveyard-pile",
                );
                if (this.disposed) return;
            } else if (nextLocal?.hand?.some(current => current.instanceId === item.card.instanceId)) {
                await animateCinematicReturnToHand(item.card, current => this.ui.cardHTML(current), item.slot, "hand");
                if (this.disposed) return;
            } else if (nextLocal?.deck?.some(current => current.instanceId === item.card.instanceId)) {
                await animateCinematicReturnToDeck(item.card, current => this.ui.cardHTML(current), item.slot, "player-deck-pile");
                if (this.disposed) return;
            }
        }
    }

    async _playRemotePostRefreshEffect(action, visual = {}) {
        if (typeof document === "undefined") return;
        const remoteSlots = [...document.querySelectorAll('[data-owner="1"][data-zone="monster"]')];
        const remoteCardSlot = action.cardData?.instanceId
            ? remoteSlots.find(slot => slot.dataset.instanceId === action.cardData.instanceId)
            : null;
        const opponentHand = document.getElementById("opponent-hand");
        const handRect = opponentHand?.getBoundingClientRect();
        const createHandAnchor = () => {
            if (!handRect) return null;
            const anchor = document.createElement("div");
            anchor.style.cssText = `position:fixed;left:${handRect.left + handRect.width / 2 - 71}px;top:${handRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
            document.body.appendChild(anchor);
            return anchor;
        };
        if (action.type === "summon") {
            const slot = remoteCardSlot || [...remoteSlots].reverse().find(item => item.querySelector(".card"));
            if (slot) {
                const anchor = createHandAnchor();
                if (anchor) {
                    await animatePlayToZone(
                        action.cardData,
                        anchor,
                        slot,
                        card => this.ui.cardHTML(card),
                        { endScale: 0.75, isCardBack: !!action.faceDown },
                    );
                    anchor.remove();
                    if (this.disposed) return;
                }
                playSummonEffect(
                    slot,
                    action.cardData?.attribute || action.cardData?.element || "none",
                    action.cardData?.name || "",
                    action.cardData?.level || 0,
                    action.cardData?.rarity,
                    {
                        tributeSummon: !!action.tributeSummon,
                        tributeCount: action.tributeCount,
                        materialRects: visual.materialRects || [],
                    },
                );
            }
        } else if (action.type === "set" && action.cardData?.type === "monster") {
            const slot = remoteCardSlot || [...remoteSlots].reverse().find(item => item.querySelector(".card"));
            const anchor = createHandAnchor();
            if (slot && anchor) {
                await animatePlayToZone(
                    action.cardData,
                    anchor,
                    slot,
                    card => this.ui.cardHTML(card),
                    { endScale: 0.75, isCardBack: true },
                );
                anchor.remove();
                if (this.disposed) return;
            }
        } else if (action.type === "flipSummon") {
            const slot = remoteSlots[action.monsterIndex];
            if (slot) playFlipSummonEffect(slot, false, this.state.players[1].monsterZone[action.monsterIndex]?.attribute || "none");
        } else if (action.type === "changePosition") {
            remoteSlots[action.monsterIndex]?.classList.add("position-changing");
        } else if (action.type === "activateSpell" && action.cardData) {
            const effectType = action.cardData.effects?.[0]?.type || "none";
            const fieldSlot = document.querySelector('.field-zone-slot[data-owner="1"][data-zone="field"]');
            const isFieldSpell = this.state.players[1].fieldZone?.instanceId === action.cardData.instanceId
                || this.state.players[1].fieldZone?.id === action.cardData.id;
            const anchor = createHandAnchor();
            if (anchor) {
                if (isFieldSpell && fieldSlot) {
                    fieldSlot.classList.add("field-spell-activate");
                    await animatePlayToZone(
                        action.cardData,
                        anchor,
                        fieldSlot,
                        card => this.ui.cardHTML(card),
                        { endScale: 0.85 },
                    );
                } else {
                    await animatePlayToGraveyard(
                        action.cardData,
                        anchor,
                        card => this.ui.cardHTML(card),
                        "opponent-graveyard-pile",
                    );
                }
                anchor.remove();
                if (this.disposed) return;
            }
            await playSpellCinematic(
                action.cardData.attribute || action.cardData.element || "none",
                action.cardData.name || "",
                action.cardData.rarity,
            );
            if (this.disposed) return;
            await playSpellEffectV2(
                null,
                action.cardData.attribute || action.cardData.element || "none",
                action.cardData.name || "",
                effectType,
                action.cardData,
                1,
            );
        } else if (action.type === "activateMonsterEffect") {
            const card = visual.sourceCard || this.state.players[1].monsterZone[action.monsterIndex];
            const slot = remoteSlots.find(item => item.dataset.instanceId === card?.instanceId) || visual.sourceSlot;
            if (slot && card) {
                playMonsterEffect(
                    slot,
                    card.attribute || card.element || "none",
                    card.effects?.find(effect => effect.trigger === "manual")?.type || "none",
                    card,
                    action.effectIndex,
                    visual.effectTargetRect ? { getBoundingClientRect: () => visual.effectTargetRect } : null,
                    visual.sourceRect ? { getBoundingClientRect: () => visual.sourceRect } : null,
                );
            }
        }
    }

    onPvpTurnStart() {
        if (this.mode !== "pvp") return;
        this._pvpTurnGeneration++;
        this.clearTurnAckTimer();
        this.turnEnding = false;
        this.effectBusy = false;
        this._lockTimers.forEach(timer => { clearTimeout(timer); this._pendingTimers.delete(timer); });
        this._lockTimers = [];
        this.state.currentPlayerIndex = 0;
        this.state.players[0].resetTurnState();
        this._pvpSend({ type: "turnStart" });
        this.ui.addLog("你的回合！", "turn");
        this._beginTurn();
    }

    aiTurn() {
        if (this.disposed) return;
        this.clearAiTimer();
        if (this.state.gameOver || this.mode !== "ai" || this.state.currentPlayerIndex !== 1) return;
        this.ui.addLog("AI正在思考……", "turn");
        this._runAiMainStep(0);
    }

    _scheduleAi(callback, delay = this.aiActionDelay) {
        this.clearAiTimer();
        this.aiTimer = this._later(() => {
            this.aiTimer = null;
            try {
                // 陷阱确认浮层打开期间暂停 AI 行动（旧 window.confirm 会同步冻结
                // 整个主线程，游戏内浮层是异步的，必须显式挂起防止状态漂移）。
                if (this.trapConfirmOpen) {
                    this._scheduleAi(callback, 500);
                    return;
                }
                callback();
            } catch (error) {
                console.error("AI action failed:", error);
                this._releaseEffectLocks();
                this.state.selectedAttacker = null;
                this.ui.addLog("AI行动异常，已自动结束本回合", "damage");
                if (!this.state.gameOver && this.state.currentPlayerIndex === 1) {
                    this._scheduleAi(() => this._finishAiTurn(), 300);
                }
            }
        }, Math.max(0, delay));
    }

    _runAiMainStep(actionCount) {
        if (this.disposed) return;
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        if (actionCount === 0 && this.state.phase !== PHASE.MAIN_2) this.state.phase = PHASE.MAIN_1;
        // 如果上一个动画还在播放，等它播完再继续
        if (this.effectBusy) {
            this._scheduleAi(() => this._runAiMainStep(actionCount), 300);
            return;
        }
        const action = this.chooseAiMainAction(actionCount);
        if (!action) {
            if (this.state.phase === PHASE.MAIN_2) {
                this._scheduleAi(() => this._finishAiTurn(), this.aiActionDelay);
            } else if (this.state.firstTurn || this.state.currentPlayer.skipBattlePhase) {
                this.state.phase = PHASE.MAIN_2;
                this._scheduleAi(() => this._runAiMainStep(0), this.aiActionDelay);
            } else {
                this.state.phase = PHASE.BATTLE;
                this.state.selectedAttacker = null;
                this.refresh();
                this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            }
            return;
        }
        const result = this._executeAiPlayAction(action);
        if (result?.message) {
            // 陷阱卡盖放时，只显示"盖放了一张陷阱卡"，不暴露具体名称
            const logMsg = (result.success && action.kind === "trap")
                ? "AI 盖放了一张卡"
                : `AI ${result.message}`;
            const publicCard = result.success && action.kind !== "trap" && !result.faceDown
                ? result.card
                : null;
            this.ui.addLog(logMsg, result.success ? "play" : "damage",
                publicCard ? { card: publicCard } : null);
        }
        if (result?.card && action.kind !== "trap" && !result.faceDown) this.ui.showAiAction?.(result.card, result.actionLabel || "AI ACTION");
        this.checkAndRefresh();
        if (this.state.gameOver) return;
        // 等动画播完再执行下一个动作
        this._scheduleAi(() => this._runAiMainStep(result?.success ? actionCount + 1 : this.aiMaxMainActions), this.effectBusy ? 500 : this.aiActionDelay);
    }

    _runAiBattleStep() {
        if (this.disposed) return;
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        if (this.effectBusy) { this._scheduleAi(() => this._runAiBattleStep(), 100); return; }
        this.state.phase = PHASE.BATTLE;
        const ai = this.state.currentPlayer;
        const human = this.state.opponentPlayer;
        if (this._aiBattleTurn !== this.state.turn) { this._aiBattleTurn = this.state.turn; this._aiBattleSteps = 0; }
        const decision = this._aiBattleSteps++ < 40 ? this.chooseAiBattleAction() : null;
        const tutorialForcesAttack = Boolean(this.tutorial && this.tutorial.forceAiAttack
            && !this.tutorial.finished && !this.tutorial.skipped);
        const attacker = decision?.attacker || (tutorialForcesAttack && this._aiBattleSteps <= 40
            ? ai.monsterZone.find(card => attackReady(card, this.state)) : null);
        if (!attacker) {
            this.state.phase = PHASE.MAIN_2;
            this.refresh();
            this._scheduleAi(() => this._runAiMainStep(0), this.aiActionDelay);
            return;
        }
        this.state.selectedAttacker = attacker;
        this.ui.showAiAction?.(attacker, "AI ATTACK");
        let target = tutorialForcesAttack
            ? (human.monsterZone.length ? human.monsterZone[0] : "player")
            : decision.target;
        // 场地魔法禁止直接攻击时不能反复重试同一只怪兽（引擎会直接拒绝）
        if (target === "player" && ai.noDirectAttackThisTurn) target = null;

        // 如果AI判断不该攻击（会亏怪），跳过这只怪兽
        if (target === null) {
            this._skipAiAttack(attacker);
            this.state.selectedAttacker = null;
            this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            return;
        }

        // 先找到玩家场上可能触发的陷阱卡DOM位置
        const isBrowser = typeof document !== "undefined";
        const playerSpellTrapSlots = isBrowser ? document.querySelectorAll(`[data-owner="0"][data-zone="spell-trap"]`) : [];
        let possibleTrapSlot = isBrowser ? [...playerSpellTrapSlots].reverse().find(s => s.querySelector(".card-back-icon")) : null;

        let attackTarget = target;
        let result = null;
        let redirectDepth = 0;
        let attackVisual = {};
        // 处理攻击重定向 / 战斗卷回循环（最多3次）
        while (redirectDepth <= 3) {
            attackVisual = this._captureRemoteVisual({ type: "attack", attackerIndex: ai.monsterZone.indexOf(attacker),
                targetType: attackTarget === "player" ? "player" : "monster", targetIndex: human.monsterZone.indexOf(attackTarget) });
            result = this.engine.attack(attacker, attackTarget);
            if (result.pendingTrapConfirm) {
                // 玩家后场陷阱等待确认浮层：本次攻击尚未消耗、尚未结算，
                // 确认后由确认回调恢复 selectedAttacker 并重入战斗步进。
                this.state.selectedAttacker = null;
                return;
            }
            this._playBattleSounds(result, attacker, attackTarget === "player" ? null : attackTarget);
            this.ui.addLog(result.message, "damage", { card: result.trap ? result.trapCard : null, report: result.report });
            if (result.redirect) {
                redirectDepth++;
                attackTarget = result.redirect;
                continue;
            }
            if (result.replay) {
                // 战斗卷回：这次攻击尚未结算，必须重新选择目标，否则 AI 会白白
                // 丢掉这次攻击并留下悬空的 state.pendingBattleReplay。
                const replayTarget = human.monsterZone.length
                    ? this._chooseAiAttackTarget(attacker, human.monsterZone)
                    : (ai.noDirectAttackThisTurn ? null : "player");
                if (!replayTarget) break;
                attackTarget = replayTarget;
                redirectDepth++;
                continue;
            }
            break;
        }
        if (redirectDepth > 3) {
            this.ui.addLog("攻击重定向次数过多，攻击终止", "damage");
            this._skipAiAttack(attacker);
            this.state.selectedAttacker = null;
            this.checkAndRefresh();
            this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            return;
        }

        // 引擎拒绝这次攻击（目标失效、不能直接攻击、怪兽被冻结等）时必须消耗掉
        // 这只怪兽的攻击机会，否则过滤器每轮都会重新选中它 → AI 回合永不结束。
        if (!result || !result.success) {
            this._skipAiAttack(attacker);
            this.state.selectedAttacker = null;
            this.checkAndRefresh();
            if (this.state.gameOver) return;
            this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            return;
        }

        if (result.trapCard) possibleTrapSlot = [...playerSpellTrapSlots].find(slot => slot.dataset.instanceId === result.trapCard.instanceId) || possibleTrapSlot;

        // 陷阱发动特效 —— 简化版：翻牌→效果→飞墓区
        if (result.trap) {
            const trapName = result.message.match(/【(.+?)】/)?.[1] || "陷阱";
            const trapCardData = result.trapCard || { name: trapName, type: "trap", rarity: "R" };
            if (possibleTrapSlot) {
                // 阶段1：翻牌动画（0-600ms）
                this._runEffect(async () => {
                    await playTrapActivationV5(possibleTrapSlot, trapCardData);
                    if (this.disposed) return;
                    await animateTrapToGraveyard(possibleTrapSlot, trapCardData);
                    if (this.disposed) return;
                    // 阶段2：播放效果特效
                    const attr = trapCardData.attribute || "none";
                    const effectType = trapCardData.effects?.[0]?.type || "none";
                    playTrapEffectV2(possibleTrapSlot, "counter", trapName, effectType, trapCardData, Number(possibleTrapSlot.dataset.owner || 0), { activationPlayed: true });
                    // 阶段3：效果播完后再飞墓区
                    if (result.attackCanceled) {
                        const attackerSlot = [...document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`)]
                            .find(slot => slot.dataset.instanceId === attacker.instanceId);
                        const targetSlot = attackTarget === "player"
                            ? document.querySelector("#player-area .player-hud")
                            : [...document.querySelectorAll(`[data-owner="0"][data-zone="monster"]`)]
                                .find(slot => slot.dataset.instanceId === attackTarget?.instanceId);
                        await playNegatedAttackBarrier(attackerSlot, targetSlot, attacker);
                        if (this.disposed) return;
                    } else {
                        await new Promise(resolve => this._later(resolve, 1300));
                        if (this.disposed) return;
                    }
                    this.checkAndRefresh();
                });
            } else {
                this._lockForEffect(2600);
                showAnnounceBanner("trap", "counter", trapName);
                this._later(() => this.checkAndRefresh(), 1500);
            }
        } else {
            // 检查onDestroyed和onFlip特效
            const aiDestroyedTargets = [];
            if (attackTarget !== "player" && attackTarget?.instanceId) {
                const targetDestroyed = !this.state.players[0].monsterZone.some(c => c.instanceId === attackTarget.instanceId);
                if (targetDestroyed && attackTarget.effects?.some(e => e.trigger === "onDestroyed")) {
                    aiDestroyedTargets.push({ card: attackTarget, owner: 0 });
                }
            }
            const aiAttackerDestroyed = !this.state.players[1].monsterZone.some(c => c.instanceId === attacker.instanceId);
            if (aiAttackerDestroyed && attacker.effects?.some(e => e.trigger === "onDestroyed")) {
                aiDestroyedTargets.push({ card: attacker, owner: 1 });
            }

            this._frame(() => this._runEffect(async () => {
                const attackerSurvived = this.state.players[1].monsterZone.includes(attacker);
                const playerHud = document.querySelector("#player-area .player-hud");
                const targetAnchor = attackTarget === "player" ? null : attackVisual.targetRect;
                await playAttackAnimation(attackVisual.attackerRect, targetAnchor, attacker, attackerSurvived, playerHud);
                if (this.disposed) return;
                if (attackTarget === "player" && playerHud) showDamageNumber(playerHud, Number(result?.damage) || 0, "damage");
                const destruction = [];
                if (!attackerSurvived && attackVisual.attackerRect) destruction.push(animateCinematicDestroy(attackVisual.attackerRect, attacker, c => this.ui.cardHTML(c), "opponent-graveyard-pile"));
                if (attackTarget !== "player" && !this.state.players[0].monsterZone.includes(attackTarget) && targetAnchor) destruction.push(animateCinematicDestroy(targetAnchor, attackTarget, c => this.ui.cardHTML(c), "player-graveyard-pile"));
                await Promise.all(destruction);
                if (this.disposed) return;
                for (const { card, owner } of aiDestroyedTargets) {
                    const origin = owner === 1 ? attackVisual.attackerRect : attackVisual.targetRect;
                    if (origin) playRuleDrivenEffect({ ...card, effects: card.effects.filter(e => e.trigger === "onDestroyed") }, origin, owner);
                }
            }));
        }

        this.state.selectedAttacker = null;
        this.checkAndRefresh();
        if (this.state.gameOver) return;
        // 等攻击动画播完再执行下一个攻击
        this._scheduleAi(() => this._runAiBattleStep(), this.effectBusy ? 500 : this.aiActionDelay);
    }

    /**
     * 消耗一只怪兽本回合的攻击机会（AI 放弃攻击或引擎拒绝该次攻击时使用）。
     * 必须同时维护 attacksMadeThisTurn，否则 canAttack 会被重新置回 true，
     * 让 _runAiBattleStep 在同一只怪兽上无限循环。
     */
    _skipAiAttack(card) {
        if (!card) return;
        const limit = (card.doubleAttackThisTurn || card.attackTwiceThisTurn) ? 2 : 1;
        card.attacksMadeThisTurn = Math.max(Number(card.attacksMadeThisTurn) || 0, limit);
        card.hasAttackedThisTurn = true;
        card.canAttack = false;
    }

    _finishAiTurn() {
        if (this.disposed) return;
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        const ai = this.state.currentPlayer;
        if (ai.hand.length > GAME_CONFIG.END_HAND_LIMIT) {
            const discarded = this.engine.discardToEndLimit(ai);
            this.ui.addLog(`AI在结束阶段丢弃了${discarded.length}张牌`, "play");
        }
        this.ui.addLog("AI结束回合", "turn");
        this._finalizeEndTurn();
    }

    // Shared, side-independent decision entry. Choosing never mutates rule state.
    chooseAiMainAction(actionCount = 0) {
        if (this.disposed || this.state.gameOver || ![PHASE.MAIN_1, PHASE.MAIN_2].includes(this.state.phase)
            || actionCount >= this.aiMaxMainActions) return null;
        const skill = this._chooseAiMonsterEffect();
        if (skill && skill.value >= 700) return skill;
        if (this.state.phase === PHASE.MAIN_1 && this.chooseAiBattleAction()?.score >= 100000) return null;
        const play = this._chooseAiPlayAction();
        if (play && play.kind !== "trap") return play;
        if (skill) return skill;
        const ai = this.state.currentPlayer;
        const set = ai.spellTrapZone.filter(card => card.type === "spell" && card.faceDown
            && this.engine.canActivateSetSpell(ai, card).canActivate)
            .sort((a, b) => this._aiCardValue(b) - this._aiCardValue(a))[0];
        if (set) return { kind: "setSpell", instanceId: set.instanceId };
        return play;
    }

    chooseAiBattleAction() {
        if (this.state.firstTurn || this.state.currentPlayer.skipBattlePhase || this.state.gameOver) return null;
        const ai = this.state.currentPlayer, enemy = this.state.opponentPlayer;
        const candidates = [];
        for (const attacker of ai.monsterZone.filter(card => attackReady(card, this.state))) {
            const target = enemy.monsterZone.length ? this._chooseAiAttackTarget(attacker, enemy.monsterZone)
                : ai.noDirectAttackThisTurn ? null : "player";
            if (!target) continue;
            const visible = target === "player" ? null : publicCard(target);
            const prediction = !visible || visible.faceUp ? this.engine.predictBattle(attacker, target) : null;
            const damage = prediction?.damageTo === "defender" ? prediction.damage : 0;
            const followUp = Number(this.aiProfile?.skill || 2) >= 2 && enemy.monsterZone.length === 1 && prediction?.targetDestroyed
                && !ai.noDirectAttackThisTurn ? ai.monsterZone.filter(card => card !== attacker && attackReady(card, this.state))
                    .reduce((sum, card) => sum + card.currentAttack, 0) : 0;
            const bait = enemy.spellTrapZone.some(card => card.faceDown) ? -attacker.currentAttack * .1 : 0;
            candidates.push({ attacker, target, score: damage >= enemy.lp ? 100000 : damage + followUp + bait
                + (damage + followUp >= enemy.lp ? 50000 : 0) + (visible?.faceUp ? 300 : 0) - attacker.currentAttack * .001 });
        }
        return candidates.sort((a, b) => b.score - a.score)[0] || null;
    }

    _chooseAiPlayAction() {
        const ai = this.state.currentPlayer;
        const human = publicOpponent(this.state.opponentPlayer);
        const skill = Number(this.aiProfile?.skill || 2);
        const readyMonster = ai.monsterZone.find(card => card.setTurn !== this.state.turn
            && !card.hasAttackedThisTurn && !card.positionChangedThisTurn
            && !(card.themedState?.frozenUntil >= this.state.turn)
            && !(card.themedState?.paralyzedUntil >= this.state.turn)
            && (card.position === MONSTER_POSITION.DEFENSE && this.state.phase === PHASE.MAIN_1 && !this.state.firstTurn
                && (human.monsterZone.length === 0 || human.monsterZone.some(target => target.faceUp
                    && card.currentAttack > (target.position === "defense" ? target.currentDefense : target.currentAttack)))
                || card.faceUp && card.position === MONSTER_POSITION.ATTACK && this.state.phase === PHASE.MAIN_2
                    && human.monsterZone.some(target => target.faceUp && target.currentAttack > card.currentAttack)
                    && card.currentDefense > card.currentAttack));
        if (readyMonster) return { kind: readyMonster.faceUp ? "position" : "flip", instanceId: readyMonster.instanceId };
        const cardValue = card => this._aiCardValue(card, ai, human);
        const answersSetBackrow = card => (card.effects || [])
            .some(effect => (effect.type === "themedAction" ? effect.action : effect.type) === "disarm");
        const playableSpells = ai.hand
            .filter(card => card?.type === "spell" && this.engine.canPlayEffect(ai, card).canPlay
                && !(ai.lp >= 6000 && card.effects?.every(effect => effect.type === "healPlayer")))
            .sort((a, b) => cardValue(b) - cardValue(a));
        if (skill >= 3) {
            const isGroupRemoval = effect => ["destroyTarget", "destroyWeakest", "damageAllEnemyMonsters", "temporaryBanish", "freezeAll"].includes(effect.type)
                && human.monsterZone.length >= 2;
            const isBackrowRemoval = effect => ["destroySpellTrap", "destroyAllEnemySpellTraps"].includes(effect.type)
                && human.spellTrapZone.length >= 2;
            // 盖放的卡是"未知"的，威胁大于明牌：哪怕只有一张也值得先拆掉再进攻。
            const urgentSpell = playableSpells.find(candidate => candidate.effects?.some(effect => isGroupRemoval(effect) || isBackrowRemoval(effect)))
                || playableSpells.find(candidate => answersSetBackrow(candidate) && human.spellTrapZone.some(card => card.faceDown));
            if (urgentSpell) return { kind: "spell", instanceId: urgentSpell.instanceId };
        }
        if (!ai.normalSummonUsed || ai.additionalNormalSummon > 0) {
            const candidates = ai.hand
                .map(card => ({ card, needed: card?.type === "monster" ? this.engine.getTributeNeeded(card.level) : 99 }))
                .filter(item => item.card?.type === "monster"
                    && legalMaterials(ai).length >= item.needed
                    && (ai.monsterZone.length < GAME_CONFIG.MAX_MONSTER_ZONE || item.needed > 0))
                .map(item => {
                    const materials = legalMaterials(ai).slice(0, item.needed);
                    const lost = materials.reduce((sum, card) => sum + materialValue(card), 0);
                    const ownActions = ai.monsterZone.flatMap(card => card.effects || []).map(effect => effect.action);
                    const completesCombo = item.card.effects?.some(effect =>
                        effect.action === "combust" && ownActions.includes("ignite") || effect.action === "ignite" && ownActions.includes("combust"));
                    const newAttribute = ownActions.some(action => ["chorus", "ensemble"].includes(action))
                        && !ai.monsterZone.some(card => card.faceUp && card.attribute === item.card.attribute);
                    return { ...item, score: cardValue(item.card) - lost + (completesCombo ? 1200 : 0) + (newAttribute ? 450 : 0) };
                })
                .filter(item => item.needed === 0 || item.score > 250)
                .sort((a, b) => b.score - a.score);
            if (candidates.length) return { kind: "monster", instanceId: candidates[0].card.instanceId };
        }
        if (playableSpells.length) return { kind: "spell", instanceId: playableSpells[0].instanceId };
        if (ai.spellTrapZone.length < GAME_CONFIG.MAX_SPELL_TRAP_ZONE) {
            const trap = ai.hand.filter(card => card?.type === "trap").sort((a, b) => cardValue(b) - cardValue(a))[0];
            if (trap) return { kind: "trap", instanceId: trap.instanceId };
            // 这回合用不出去的魔法也可以先盖下去（下回合由 _activateAiSetSpell 打开）。
            const setSpell = ai.hand
                .filter(card => card?.type === "spell" && !this.engine.canPlayEffect(ai, card).canPlay)
                .sort((a, b) => cardValue(b) - cardValue(a))[0];
            if (setSpell && cardValue(setSpell) >= 500) return { kind: "trap", instanceId: setSpell.instanceId };
        }
        return null;
    }

    /** AI 对主题动作的相对估值（用于出牌、盖放、发动效果排序）。 */
    _aiThemedValue(action, ai, human, source = null) {
        human = publicOpponent(human);
        const enemyMonsters = human.monsterZone.length;
        if (source && (action === "ensemble" || action === "tempoStrike" && !(source.themedState?.charges > 0) || source.effects?.some(effect => effect.action === action && effect.params?.rest)) && this.state.phase === PHASE.MAIN_1 && !this.state.firstTurn && source.canAttack) {
            const damage = enemyMonsters ? Math.max(0, ...human.monsterZone.filter(c => c.faceUp && c.position === MONSTER_POSITION.ATTACK && !c.preventsBattleDamage).map(c => source.currentAttack - c.currentAttack)) : source.currentAttack;
            if (damage >= human.lp) return 0;
        }
        const ownMonsters = ai.monsterZone.length;
        if ((["twin", "pierce"].includes(action) || action === "tempoStrike" && source?.themedState?.charges > 0)
            && (this.state.firstTurn || ai.skipBattlePhase || this.state.phase === PHASE.MAIN_2)) return 0;
        if (action === "combust" && source) {
            const damage = source.effects.find(effect => effect.action === action)?.params?.damage || 600;
            if (human.monsterZone.some(card => card.faceUp && !card.cannotBeTargeted && (card.themedState?.statuses?.burn || 0) * damage >= human.lp)) return 100000;
        }
        if (action === "ignite" && ai.monsterZone.some(card => card.faceUp && card.effects?.some(effect => effect.action === "combust"))) return 780;
        if ((action === "ensemble" || action === "tempoStrike" && !(source?.themedState?.charges > 0) || source?.effects?.some(effect => effect.action === action && effect.params?.rest))
            && source && this.state.phase === PHASE.MAIN_1 && !this.state.firstTurn && !ai.skipBattlePhase
            && attackReady(source, this.state) && (!enemyMonsters || this._chooseAiAttackTarget(source, human.monsterZone))) return 0;
        const table = {
            ensemble: ai.hand.length < 3 ? 480 : 260,
            tempoStrike: source?.themedState?.charges > 0 ? 600 : 260,
            railgun: enemyMonsters ? 650 : 0,
            combust: human.monsterZone.some(c => c.themedState?.statuses?.burn > 0) ? 700 : 0,
            disarm: human.spellTrapZone.length ? 700 : 60,
            burst: 620, exile: 560, domain: 620, timeStop: 640,
            detonate: enemyMonsters ? 520 : 40, curse: enemyMonsters ? 480 : 40,
            bomb: enemyMonsters ? 460 : 40, freeze: enemyMonsters ? 420 : 40,
            sleep: enemyMonsters ? 420 : 40, paralyze: enemyMonsters ? 400 : 40,
            poison: enemyMonsters ? 400 : 40, venom: enemyMonsters ? 400 : 40,
            seal: enemyMonsters ? 380 : 40, ignite: enemyMonsters ? 360 : 40,
            bleed: enemyMonsters ? 360 : 40,
            intercept: 520, mirror: 480, reversal: 420, reprisal: 360, rescue: 380, retreat: 380,
            revive: ai.graveyard.length ? 520 : 120, recall: ai.banished?.length ? 420 : 120,
            recover: ai.graveyard.length ? 420 : 120, deploy: ai.hand.length ? 460 : 120,
            inherit: 400, ambush: 380, recycle: ai.graveyard.length >= 2 ? 320 : 100,
            exchange: ownMonsters && ai.hand.length ? 420 : 120,
            token: ownMonsters < 5 ? 420 : 60,
            twin: ownMonsters ? 480 : 60, charge: ownMonsters ? 300 : 60,
            shelter: ownMonsters ? 420 : 60, ward: ownMonsters ? 320 : 60,
            sanctuary: 380, purify: 340, infinity: ownMonsters ? 420 : 60, pierce: ownMonsters ? 380 : 60,
            chorus: ownMonsters >= 2 ? 360 : 140, scout: 380, study: 380, prepare: 300,
            scry: 280, recon: 260, mindgame: 300, dice: 280, gamble: 300, emotion: 300,
            devour: 400, returnSelf: 340,
        };
        return table[action] ?? 120;
    }

    /** AI 出牌估值：主题动作按动作表计分，旧式效果沿用原有规则。 */
    _aiCardValue(card, ai = this.state.currentPlayer, human = this.state.opponentPlayer) {
        human = publicOpponent(human);
        const effects = card.effects || [];
        const priority = Number(card.aiHints?.priority || 0) * 120;
        const tactical = effects.reduce((sum, effect) => {
            if (["destroyTarget", "destroyWeakest", "damageAllEnemyMonsters", "temporaryBanish", "freezeAll"].includes(effect.type)) {
                return sum + (human.monsterZone.length ? 650 : -500);
            }
            // 主题行动没有 effect.type，只有 action；拆后场的行动要按"后场对策"算分。
            const key = effect.type === "themedAction" ? effect.action : effect.type;
            if (["destroySpellTrap", "destroyAllEnemySpellTraps", "disarm"].includes(key)) {
                return sum + (human.spellTrapZone.length ? 700 : -550);
            }
            if (["drawCards", "groupDraw", "recoverMonster", "reviveRecentGraveyard", "tokenSummon"].includes(effect.type)) return sum + 430;
            if (["buffSelfAttack", "buffAllAlliesAttack", "groupBuff"].includes(effect.type)) return sum + (ai.monsterZone.length ? 360 : -150);
            if (["healPlayer", "healDrawNoSpecial"].includes(effect.type)) return sum + (ai.lp < 5000 ? 360 : 60);
            if (effect.type === "themedAction") return sum + this._aiThemedValue(effect.action, ai, human);
            return sum + 120;
        }, 0);
        return priority + tactical + (card.attack || 0) + (card.effects?.length || 0) * 160;
    }

    _executeAiPlayAction(action, { visuals = typeof document !== "undefined" } = {}) {
        const ai = this.state.currentPlayer;
        if (action.kind === "monsterEffect") {
            const card = ai.monsterZone.find(c => c.instanceId === action.instanceId);
            if (!card || !this.engine.getMonsterEffectAvailability(ai, card, action.effectIndex).canActivate) return { success: false, message: "技能条件已改变" };
            const effect = card.effects[action.effectIndex];
            const target = this._chooseAiEffectTarget(ai, { effects: [effect] });
            const message = this.engine.triggerAllEffects(ai, card, "manual", { effectIndex: action.effectIndex, selectedTarget: target });
            if (message && !card.rulesVersion) card.oncePerTurnUsed = true;
            return { success: !!message, card, message, actionLabel: "AI SKILL" };
        }
        if (action.kind === "setSpell") {
            const card = ai.spellTrapZone.find(c => c.instanceId === action.instanceId);
            if (!card) return { success: false, message: "盖牌已离场" };
            return { ...this.engine.activateSetSpell(ai, card, this._chooseAiEffectTarget(ai, card)), card, actionLabel: "AI SPELL" };
        }
        if (action.kind === "position" || action.kind === "flip") {
            const card = ai.monsterZone.find(c => c.instanceId === action.instanceId);
            return action.kind === "flip" ? this.engine.flipSummon(ai, card) : this.engine.changePosition(ai, card);
        }
        const index = ai.hand.findIndex(card => card.instanceId === action.instanceId);
        if (index < 0) return { success: false, message: "要使用的卡牌已不在手牌" };
        const card = ai.hand[index];
        if (action.kind === "monster") {
            const result = this.engine.normalSummon(ai, index, MONSTER_POSITION.ATTACK, false);
            if (result.needsTribute) {
                const pending = this.state.pendingTribute;
                legalMaterials(ai)
                    .slice(0, pending?.needed || 0)
                    .forEach(tribute => this.engine.selectTribute(tribute));
                const materialRects = typeof document === "undefined" ? [] : (pending?.selected || []).map(material =>
                    [...document.querySelectorAll('[data-owner="1"][data-zone="monster"]')].find(slot => slot.dataset.instanceId === material.instanceId)?.getBoundingClientRect()).filter(Boolean);
                const confirmed = this.engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
                if (!confirmed.success) this.engine.cancelTribute();
                if (!confirmed.success || !visuals) return { ...confirmed, card: confirmed.card || card, actionLabel: "AI SUMMON" };
                this._lockForEffect(3000);
                this.checkAndRefresh();
                this._frame(() => {
                    const oppHandEl = visuals ? document.getElementById("opponent-hand") : null;
                    const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
                    const slots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                    const lastSlot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
                    if (lastSlot && oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75 }).then(() => tempEl.remove());
                    }
                    this._later(() => {
                        if (lastSlot) playSummonEffect(lastSlot, card.attribute || "none", card.name, card.level, card.rarity, {
                            tributeSummon: true,
                            tributeCount: pending?.needed || (Number(card.level) >= 7 ? 2 : 1),
                            materialRects,
                        });
                    }, 600);
                });
                return { ...confirmed, card: confirmed.card || card, actionLabel: "AI SUMMON" };
            }
            if (!result.success || !visuals) return { ...result, card: result.card || card, actionLabel: "AI SUMMON" };
            this._lockForEffect(3000);
            this.checkAndRefresh();
            this._frame(() => {
                const oppHandEl = visuals ? document.getElementById("opponent-hand") : null;
                const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
                const slots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                const lastSlot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
                if (lastSlot && oppHandRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75 }).then(() => tempEl.remove());
                }
                this._later(() => {
                    if (lastSlot) playSummonEffect(lastSlot, card.attribute || "none", card.name, card.level, card.rarity);
                }, 600);
            });
            return { ...result, card: result.card || card, actionLabel: "AI SUMMON" };
        }
        if (action.kind === "spell") {
            const target = this._chooseAiEffectTarget(ai, card);
            const oppHandEl = visuals ? document.getElementById("opponent-hand") : null;
            const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
            const handIdsBeforeSpell = new Set(ai.hand.map(item => item.instanceId));
            const result = this.engine.activateSpell(ai, index, target);
            if (!result.success || !visuals) return { ...result, card, actionLabel: "AI SPELL" };
            const effectType = card.effects?.[0]?.type || "none";
            this.checkAndRefresh();

            if (result.isFieldSpell) {
                this._lockForEffect(3800);
                this._frame(() => {
                    const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="1"][data-zone="field"]`);
                    if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                    if (oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                    }
                    this._later(async () => {
                        await playSpellCinematic(card.attribute || "none", card.name, card.rarity);
                        if (this.disposed) return;
                        await playSpellEffectV2(null, card.attribute || "none", card.name, effectType, card, this.state.currentPlayerIndex);
                        if (this.disposed) return;
                    }, 600);
                });
            } else {
                // 普通魔法：先飞墓地，完成后再抽卡
                this._runEffect(async () => {
                    if (oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        try { await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "opponent-graveyard-pile"); } finally { tempEl.remove(); }
                    }
                    await playSpellCinematic(card.attribute || "none", card.name, card.rarity);
                    if (this.disposed) return;
                    await playSpellEffectV2(null, card.attribute || "none", card.name, effectType, card, this.state.currentPlayerIndex);
                    if (this.disposed) return;
                    if (effectType === "drawCards" || effectType === "gameThroneDraw" || effectType === "discardAndDraw") {
                        await new Promise(resolve => this._later(resolve, 800));
                        if (this.disposed) return;
                        const drawnCards = ai.hand.filter(item => !handIdsBeforeSpell.has(item.instanceId)).slice(0, 3);
                        for (const drawn of drawnCards) {
                            if (drawn && drawn.type) {
                                await animateDrawCard(drawn, c => createCardBackHtml(c), true);
                                if (this.disposed) return;
                                await new Promise(r => this._later(r, 200));
                                if (this.disposed) return;
                            }
                        }
                    }
                });
            }
            return { ...result, card, actionLabel: "AI SPELL" };
        }
        if (action.kind === "trap") {
            // 获取对手手牌区域位置用于出牌动画
            const oppHandEl = visuals ? document.getElementById("opponent-hand") : null;
            const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
            const result = this.engine.setCard(ai, index);
            if (!result.success || !visuals) return { ...result, card, actionLabel: "AI SET" };
            this.checkAndRefresh();
            // 陷阱卡运镜：从对手手牌飞到陷阱区（显示卡背）
            if (oppHandRect && result.success) {
                this._lockForEffect(800);
                this._frame(() => {
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
        if (effect?.action === "combust") return [...targets].sort((a, b) => (b.themedState?.statuses?.burn || 0) - (a.themedState?.statuses?.burn || 0))[0];
        const type = this.engine.getEffectTargetType(effect);
        const targetValue = target => {
            const visible = publicCard(target);
            return (visible.currentAttack || visible.attack || 0) + (visible.currentDefense || visible.defense || 0) * .25 + (visible.effects?.length || 0) * 350;
        };
        if (type === "graveyard") return [...targets].sort((a, b) => targetValue(b) - targetValue(a))[0];
        if (type === "self_monster") return [...targets].sort((a, b) => effect?.action === "shelter"
            ? materialValue(b) - materialValue(a) : targetValue(a) - targetValue(b))[0];
        if (type === "enemy_monster_or_player") {
            const monsters = targets.filter(target => !target.isPlayer);
            if (monsters.length) return [...monsters].sort((a, b) => targetValue(b) - targetValue(a))[0];
            return targets.find(target => target.isPlayer) || targets[0];
        }
        return [...targets].sort((a, b) => targetValue(b) - targetValue(a))[0];
    }

    _chooseAiMonsterEffect() {
        const ai = this.state.currentPlayer, human = publicOpponent(this.state.opponentPlayer);
        const candidates = [];
        for (const monster of ai.monsterZone) {
            for (const [effectIndex, effect] of (monster.effects || []).entries()) {
                if (!this.engine.getMonsterEffectAvailability(ai, monster, effectIndex).canActivate) continue;
                const value = effect.type === "themedAction" ? this._aiThemedValue(effect.action, ai, human, monster) : 380;
                if (value > 0) candidates.push({ kind: "monsterEffect", instanceId: monster.instanceId, effectIndex, value });
            }
        }
        return candidates.sort((a, b) => b.value - a.value)[0] || null;
    }

    _activateAiMonsterEffect() {
        const action = this._chooseAiMonsterEffect();
        if (!action) return null;
        const result = this._executeAiPlayAction(action);
        return result.success ? result : null;
    }

    /** AI 主动翻开自己盖放的魔法（例如上一回合盖下的主题魔法）。 */
    _activateAiSetSpell() {
        const ai = this.state.currentPlayer;
        const human = this.state.opponentPlayer;
        const candidates = ai.spellTrapZone
            .filter(card => card?.type === "spell" && card.faceDown && this.engine.canActivateSetSpell(ai, card).canActivate)
            .map(card => ({ card, value: this._aiCardValue(card, ai, human) }))
            .sort((a, b) => b.value - a.value);
        for (const { card, value } of candidates) {
            if (value < 260) continue;
            const target = this._chooseAiEffectTarget(ai, card);
            const result = this.engine.activateSetSpell(ai, card, target);
            if (result.success) return { card, message: result.message };
        }
        return null;
    }

    _chooseAiAttackTarget(attacker, targets) {
        const atk = attacker.currentAttack || 0;
        // 引擎会拒绝的目标不能选：不能被攻击的怪兽，以及"优先攻击保护"生效中的怪兽
        // （只有它之外的其它表侧怪兽都不存在时才允许攻击它）。
        const attackable = targets.map(publicCard).filter(t => !t.cannotBeAttacked);
        const legal = attackable.filter(t =>
            !t.priorityTarget || attackable.filter(other => other !== t && other.faceUp).length === 0);
        if (legal.length === 0) return null;

        const killable = [];
        for (const t of legal) {
            if (!t.faceUp) {
                if (atk >= (Number(this.aiProfile?.skill || 2) >= 3 ? 1900 : 1600)) killable.push({ card: t, power: 1500, lethal: false });
                continue;
            }
            const prediction = this.engine.predictBattle(attacker, t);
            const damage = prediction.damageTo === "defender" ? prediction.damage : 0;
            const lethal = damage >= this.state.opponentPlayer.lp;
            if (lethal || !prediction.attackerDestroyed && (damage > 0 || prediction.targetDestroyed)
                || prediction.targetDestroyed && materialValue(attacker) < materialValue(t)) {
                killable.push({ card: t, power: t.position === "defense" ? t.currentDefense : t.currentAttack, lethal });
            }
        }
        // 优先选能击杀的，按守备力从低到高（优先清弱怪）
        if (killable.length > 0) {
            const skilled = Number(this.aiProfile?.skill || 2) >= 3;
            killable.sort((a, b) => Number(b.lethal) - Number(a.lethal) || (skilled
                ? ((b.card.effects?.length || 0) * 500 + b.power) - ((a.card.effects?.length || 0) * 500 + a.power)
                : a.power - b.power));
            return targets.find(target => target.instanceId === killable[0].card.instanceId) || null;
        }
        // 没有能击杀的 → 如果对方场面空了就直接攻击玩家
        // 否则跳过攻击（不送怪）
        return null;
    }

    // 同步AI供自动测试使用。
    _aiPlayCards() {
        let actions = 0;
        while (actions < this.aiMaxMainActions) {
            const action = this.chooseAiMainAction(actions);
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
        this.state.phase = PHASE.BATTLE;
        for (let step = 0; step < 40 && !this.state.gameOver; step++) {
            const action = this.chooseAiBattleAction();
            if (!action) break;
            const { attacker, target } = action;
            let result = this.engine.attack(attacker, target);
            if (result.redirect) result = this.engine.attack(attacker, result.redirect);
            if (!result.success && !result.replay) this._skipAiAttack(attacker);
            this._playBattleSounds(result, attacker, target === "player" ? null : target);
            this.ui.addLog(result.message, "damage", { report: result.report });
            if (this.engine.checkGameOver()) return;
        }
        this.refresh();
    }

    /**
     * 战斗音效（撞击 / 破坏 / 伤害）由 playSound 负责。
     * @param {object} result 引擎 attack 返回结果
     * @param {object} attacker 发动攻击的怪兽卡
     * @param {object|null} defenderCard 被攻击的怪兽卡（直接攻击玩家时为 null）
     */
    _playBattleSounds(result, attacker, defenderCard) {
        if (!result) return;
        if (!result.success) { playSound("error"); return; }
        playSound(result.trap || result.attackCanceled ? "trap" : "attack");
        if (result.trap) this.notifyTutorial("trap", { trapCard: result.trapCard });
        if (result.destroyed) playSound("destroy");
        else if (Number(result.damage) > 0) playSound("damage");
    }

    gameOver() {
        this.clearAiTimer();
        playSound(this.state.isDraw ? "defeat" : (this.state.winner === 0 ? "victory" : "defeat"));
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
        if (this.disposed) return;
        if (this.engine.checkGameOver()) {
            this.gameOver();
            return;
        }
        this.engine.checkStateIntegrity();
        this.refresh();
    }

    refresh() {
        if (this.disposed) return;
        const handlers = {
            onPlayCard: index => this.activateSpell(index),
            onSetCard: index => this.setCard(index),
            onActivateSetSpell: card => this.activateSetSpell(card),
            canActivateSetSpell: card => this.canActivateSetSpell(card),
            getMonsterEffectAvailability: (card, index) => this.engine.getMonsterEffectAvailability(this.state.currentPlayer, card, index),
            onActivateSetTrap: card => this.activateSetTrap(card),
            canActivateTrapManually: card => this.canActivateTrapManually(card),
            onSummon: (index, position, faceDown) => this.summonMonster(index, position, faceDown),
            onFlipSummon: card => this.flipSummon(card),
            onChangePosition: card => this.changePosition(card),
            onActivateMonsterEffect: (card, effectIndex) => this.activateMonsterEffect(card, effectIndex),
            onCancelAttackSelection: () => this.cancelAttackSelection(),
            canCancelAttackToMain: () => this.state.phase === PHASE.BATTLE
                && this.attackSelectionReturnPhase === PHASE.MAIN_1 && !this.effectBusy,
            onNextPhase: () => this.nextPhase(),
            onEndTurn: () => this.endTurn(),
            onSelectAttacker: card => this.selectAttacker(card),
            onPreviewBattle: (attacker, target) => this.engine.predictBattle(attacker, target),
            onPendingActions: () => this.pendingActions(),
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
