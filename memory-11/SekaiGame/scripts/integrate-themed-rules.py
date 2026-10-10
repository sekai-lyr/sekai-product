from pathlib import Path
root = Path(__file__).resolve().parents[1] / 'src/main/resources/static'
p = root / 'js/engine.js'
s = p.read_text(encoding='utf-8')
s = s.replace('import { createCardInstance } from "./model.js";', 'import { createCardInstance } from "./model.js";\nimport { themedEffectHandlers, canResolveThemedEffect, resolveThemedTurnEnd } from "./themed-effects.js";')
s = s.replace('const effectHandlers = {', 'const effectHandlers = {\n    ...themedEffectHandlers,')
s = s.replace('const isDestruction = cause === "battle" || cause === "effect";', '''const isDestruction = cause === "battle" || cause === "effect";
    if (isDestruction && monster.themedState?.shelterUntil >= engine?.state.turn) {
        delete monster.themedState.shelterUntil;
        monster.position = MONSTER_POSITION.DEFENSE;
        monster.canAttack = false;
        return false;
    }''')
s = s.replace('owner.graveyard.push(monster);', 'if (!monster.isToken) owner.graveyard.push(monster);\n        monster.themedState = {};')
s = s.replace('function resetCardState(card) {', 'function resetCardState(card) {\n    card.themedState = {};')
s = s.replace('if (eventType === "onTurnStart") {', 'if (eventType === "onTurnStart" || eventType === "onTurnEnd") {')
s = s.replace('const sources = [...player.monsterZone,', 'const sources = [...player.monsterZone.filter(card => card.faceUp),')
s = s.replace('endTurn() {\n        this.state.selectedAttacker', '''endTurn() {
        if (this.state.gameOver) return;
        this.state.phase = PHASE.END;
        const player = this.state.currentPlayer;
        this.emit("onTurnEnd", { player });
        this.triggerEvent("onTurnEnd", { player });
        resolveThemedTurnEnd(this);
        for (const owner of this.state.players) {
            for (const card of owner.monsterZone) {
                card.tempEffects = (card.tempEffects || []).filter(effect => effect.duration !== DURATION.UNTIL_END_TURN);
                owner._recalcCardStats(card);
                card.doubleAttackThisTurn = false;
            }
        }
        this.discardToEndLimit(player);
        if (this.checkGameOver()) return;
        this.state.pendingBattleReplay = null;
        this.state.selectedAttacker''')
s = s.replace('drawCard(player) { return player.drawCard(); }', '''drawCard(player) { return player.drawCard(); }

    resetFieldCard(card) { resetCardState(card); }
    destroyFieldMonster(owner, card) { return destroyMonster(owner, card, this); }
    _themedContext(player, card, effect, eventContext = {}) {
        return { ...eventContext, player, card, effect, engine: this, gameState: this.state,
            opponent: this.state.players.find(owner => owner !== player) };
    }
    canActivateThemedEffect(player, card, effect, eventContext = {}) {
        const index = card.effects.indexOf(effect);
        if (player.themedUses?.[`${card.id}:${index}`] === this.state.turn) return false;
        if (card.themedState?.sealedUntil >= this.state.turn) return false;
        return canResolveThemedEffect(this._themedContext(player, card, effect, eventContext));
    }''')
s = s.replace('if (card.positionChangedThisTurn) return', 'if (card.themedState?.frozenUntil >= this.state.turn) return { success: false, message: "冻结期间不能改变表示形式" };\n        if (card.positionChangedThisTurn) return')
s = s.replace('if (card.setTurn === this.state.turn) return { success: false, message: "本回合盖放的怪兽不能翻转召唤" };', 'if (card.setTurn === this.state.turn || card.themedState?.frozenUntil >= this.state.turn) return { success: false, message: "本回合盖放或冻结的怪兽不能翻转召唤" };')
s = s.replace('if (attacker.cannotAttack || attackerOwner.skipBattlePhase)', 'if (attacker.cannotAttack || attackerOwner.skipBattlePhase || attacker.themedState?.frozenUntil >= this.state.turn)')
s = s.replace('const hasPiercing = attacker.piercingDamage ||', 'const hasPiercing = attacker.themedState?.piercingUntil >= this.state.turn || attacker.piercingDamage ||')
start = s.index('    triggerAllEffects(player, card, triggerType, eventContext = {}) {')
end = s.index('    _executeEffect(', start)
s = s[:start] + '''    triggerAllEffects(player, card, triggerType, eventContext = {}) {
        if (this.state.gameOver || !card) return null;
        if (triggerType === "manual" && card.type === "monster" &&
            (player !== this.state.currentPlayer || !player.monsterZone.includes(card) || !card.faceUp ||
             ![PHASE.MAIN_1, PHASE.MAIN_2].includes(this.state.phase))) return null;
        if (card.effectNegated || card.themedState?.sealedUntil >= this.state.turn) return null;
        const effects = card.effects || [];
        if (!effects.length && card.effect) return this._triggerLegacyEffect(player, card, triggerType, eventContext);
        const messages = [];
        for (const [index, eff] of effects.entries()) {
            if (getEffectTrigger(eff) !== triggerType) continue;
            if (eventContext.effectIndex != null && eventContext.effectIndex !== index) continue;
            if (!this._checkEffectCondition(player, eff.condition)) continue;
            const themed = eff.type === "themedAction";
            const key = `${card.id}:${index}`;
            if (themed && !this.canActivateThemedEffect(player, card, eff, eventContext)) continue;
            if (!themed && (eff.oncePerTurn || eff.limit?.oncePerTurn) && card.oncePerTurnUsed) continue;
            if (eff.limit?.phase && !eff.limit.phase.includes(this.state.phase)) continue;
            if (eff.limit?.onlyDuringOwnTurn && player !== this.state.currentPlayer) continue;
            if (triggerType === "manual" && card.type === "monster" && eff.cost && !this._checkCost(player, eff.cost).ok) continue;
            if (themed) (player.themedUses ||= {})[key] = this.state.turn;
            else if (eff.oncePerTurn || eff.limit?.oncePerTurn) card.oncePerTurnUsed = true;
            const selectedTarget = eventContext.selectedTarget ?? (triggerType === "onAttacked" ? eventContext.attacker : null);
            const result = this._executeEffect(player, card, eff, selectedTarget, eventContext);
            if (result) messages.push(result);
        }
        return messages.join("，") || null;
    }

''' + s[end:]
start = s.index('    triggerEffect(player, card, selectedTarget = null) {')
end = s.index('    // ---------- 兼容旧的 getEffectTargetType', start)
s = s[:start] + '''    triggerEffect(player, card, selectedTarget = null) {
        return this.triggerAllEffects(player, card, "manual", { selectedTarget });
    }

''' + s[end:]
s = s.replace('const primaryEffect = card.effect || card.effects?.[0];', '''if (card.rulesVersion && !this.canPlayEffect(player, card).canPlay) return { success: false, message: "条件、资源不足或同名效果本回合已使用" };
        const primaryEffect = card.effect || card.effects?.[0];''', 1)
s = s.replace('const effect = card.effect || card.effects?.[0];\n        const targetType = this.getEffectTargetType(effect);', 'if (card.rulesVersion && !this.canPlayEffect(player, card).canPlay) return { canActivate: false, reason: "条件、资源不足或同名效果本回合已使用" };\n        const effect = card.effect || card.effects?.[0];\n        const targetType = this.getEffectTargetType(effect);', 1)
s = s.replace('const index = player.spellTrapZone.indexOf(card);\n        if (index < 0)', '''if (card.rulesVersion) {
            const cost = card.effects[0]?.cost;
            if (cost && !this._checkCost(player, cost).ok) return { success: false, message: "LP不足" };
        }
        const index = player.spellTrapZone.indexOf(card);
        if (index < 0)''')
s = s.replace('canPlayEffect(player, card) {', '''canPlayEffect(player, card) {
        if (card.rulesVersion) {
            const cost = card.effects[0]?.cost;
            const available = (!cost || player.lp > cost.value) && card.effects.some(effect =>
                effect.trigger === "manual" && this.canActivateThemedEffect(player, card, effect));
            return { canPlay: available, reason: available ? "" : "条件、资源不足或同名效果本回合已使用" };
        }''')
s = s.replace('return effects.some(effect => getEffectTrigger(effect) === "onAttacked");', 'return effects.some(effect => getEffectTrigger(effect) === "onAttacked" && (effect.type !== "themedAction" || this.canActivateThemedEffect(defenderOwner, card, effect, { ...attackEvent, battle: {} })));')
p.write_text(s, encoding='utf-8')

p = root / 'js/model.js'
s = p.read_text(encoding='utf-8').replace('c.cannotUseAsMaterial = false;', 'c.cannotUseAsMaterial = !!c.isToken;')
s = s.replace('c.cannotBeTargeted = false;', 'c.cannotBeTargeted = c.themedState?.wardUntil != null;')
p.write_text(s, encoding='utf-8')

p = root / 'js/controller.js'
s = p.read_text(encoding='utf-8').replace('        this.engine.emit("onTurnEnd", { player: this.state.currentPlayer });\n', '')
s = s.replace('activateMonsterEffect(card) {', 'activateMonsterEffect(card, effectIndex = null) {')
s = s.replace('if (!card.faceUp || card.oncePerTurnUsed)', 'if (!card.faceUp || (!card.rulesVersion && card.oncePerTurnUsed))')
s = s.replace('this.engine.triggerAllEffects(this.state.currentPlayer, card, "manual");', 'this.engine.triggerAllEffects(this.state.currentPlayer, card, "manual", { effectIndex });')
s = s.replace('card.oncePerTurnUsed = true;', 'if (!card.rulesVersion) card.oncePerTurnUsed = true;')
s = s.replace('{ type: "activateMonsterEffect", monsterIndex }', '{ type: "activateMonsterEffect", monsterIndex, effectIndex }')
s = s.replace('this.engine.triggerAllEffects(opponent, monster, "manual");', 'this.engine.triggerAllEffects(opponent, monster, "manual", { effectIndex: action.effectIndex });')
s = s.replace('onActivateMonsterEffect: (card) => this.activateMonsterEffect(card)', 'onActivateMonsterEffect: (card, effectIndex) => this.activateMonsterEffect(card, effectIndex)')
s = s.replace('            currentAttack: card.currentAttack,', '            themedState: card.themedState || {},\n            isToken: !!card.isToken,\n            ...(card.isToken ? { name: card.name, type: card.type, attribute: card.attribute, level: card.level, attack: card.attack, defense: card.defense, effects: [] } : {}),\n            currentAttack: card.currentAttack,')
s = s.replace('        // 攻击重定向（里间雨效果②）', '''        if (result.replay) {
            this.ui.addLog(result.message, "play");
            this.state.selectedAttacker = attacker;
            this.refresh();
            return;
        }
        // 攻击重定向（里间雨效果②）''')
p.write_text(s, encoding='utf-8')

p = root / 'js/ui.js'
s = p.read_text(encoding='utf-8')
s = s.replace('if (card.faceUp && card.effects?.some(e => e.trigger === "manual") && !card.oncePerTurnUsed) {', '''if (card.faceUp && card.rulesVersion) {
                card.effects.forEach((effect, effectIndex) => {
                    if (effect.trigger === "manual") addAction(effect.skillName, "primary-action", () => handlers.onActivateMonsterEffect(card, effectIndex));
                });
            } else if (card.faceUp && card.effects?.some(e => e.trigger === "manual") && !card.oncePerTurnUsed) {''')
p.write_text(s, encoding='utf-8')

p = root / 'js/card-view.js'
s = p.read_text(encoding='utf-8').replace('    onSummon: "召唤成功时",', '    onSummon: "召唤成功时",\n    onTurnEnd: "自己的结束阶段",')
p.write_text(s, encoding='utf-8')
