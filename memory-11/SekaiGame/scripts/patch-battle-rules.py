from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'src/main/resources/static'
p = root / 'js/engine.js'
s = p.read_text(encoding='utf-8')
s = s.replace('if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) return { success: false, message: "怪兽区已满" };', 'if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE && this.getTributeNeeded(card.level) === 0) return { success: false, message: "怪兽区已满" };')
s = s.replace('const summonedThisTurn = player.normalSummonTurn === this.state.turn;', 'const summonedThisTurn = player.normalSummonUsed;')
s = s.replace('needed, selected: [] };', 'needed, selected: [], previousPhase: this.state.phase, setFaceDown: faceDown };')
s = s.replace('needed, selected: [], setFaceDown: true };', 'needed, selected: [], previousPhase: this.state.phase, setFaceDown: true };')
s = s.replace('for (const tribute of pt.selected) { sendMonsterToGraveyard', 'if (pt.selected.some(card => !pt.player.monsterZone.includes(card) || card.cannotUseAsMaterial) || !pt.player.hand.includes(pt.card)) return { success: false, message: "祭品或召唤卡已经不在原区域" };\n        for (const tribute of pt.selected) { sendMonsterToGraveyard')
s = s.replace('this.state.phase = PHASE.MAIN_1;\n        return this._executeSummon(pt.player, pt.cardIndex,', 'this.state.phase = pt.previousPhase || PHASE.MAIN_1;\n        return this._executeSummon(pt.player, pt.player.hand.indexOf(pt.card),')
s = s.replace('cancelTribute() {\n        this.state.pendingTribute = null;\n        this.state.phase = PHASE.MAIN_1;', 'cancelTribute() {\n        this.state.phase = this.state.pendingTribute?.previousPhase || PHASE.MAIN_1;\n        this.state.pendingTribute = null;')
s = s.replace('if (card.setTurn >= this.state.turn) return { canActivate: false, reason: "盖放魔法要到下个自己的回合才能发动" };', 'if (card.setTurn >= this.state.turn && card.subtype === "quick_play") return { canActivate: false, reason: "速攻魔法盖放当回合不能发动" };')
s = s.replace('// 翻转召唤：里侧→表侧守备，不占通常召唤次数', '// 翻转召唤变为表侧攻击表示，不占通常召唤次数。\n        card.position = MONSTER_POSITION.ATTACK;\n        card.canAttack = !this.state.firstTurn && !player.skipBattlePhase && !card.cannotAttack;')
s = s.replace('if (card.positionChangedThisTurn) return', 'if (card.setTurn === this.state.turn && !card.hasAttackedThisTurn) return { success: false, message: "本回合召唤或盖放的怪兽不能手动改变表示形式" };\n        if (card.positionChangedThisTurn) return')
s = s.replace('// 游戏王规则：本回合改变表示形式后不能再攻击。\n        card.canAttack = false;', '// 未攻击的怪兽由守备转为攻击后可以攻击。\n        card.canAttack = card.position === MONSTER_POSITION.ATTACK && !card.cannotAttack && !this.state.firstTurn && !player.skipBattlePhase;')
s = s.replace('if (attacker.position === MONSTER_POSITION.DEFENSE)', 'if (!attacker.faceUp || attacker.position === MONSTER_POSITION.DEFENSE)')
s = s.replace('if (attacker.cannotAttack) return { success: false, message: "该怪兽不能攻击" };', 'if (attacker.cannotAttack || attackerOwner.skipBattlePhase) return { success: false, message: "该怪兽不能攻击" };')
s = s.replace('card.type !== "trap" || !card.faceDown || !card.canActivate', 'card.type !== "trap" || !card.faceDown || !card.canActivate || card.setTurn >= this.state.turn')
s = s.replace('} else if (atkPower === defPower) {\n                const attackerDestroyed', '} else if (atkPower === defPower && atkPower === 0) {\n                msg += "，双方攻击力均为0，均不破坏";\n            } else if (atkPower === defPower) {\n                const attackerDestroyed')
s = s.replace('const trapResult = this._resolveBattleTrap(attacker, target, attackerOwner, defenderOwner);', 'const trapResult = this._resolveBattleTrap(attacker, target, attackerOwner, defenderOwner);\n        if (!attackerOwner.monsterZone.includes(attacker) || !attacker.faceUp || attacker.position !== MONSTER_POSITION.ATTACK || attacker.cannotAttack) trapResult.canceled = true;\n        if (target !== "player" && !defenderOwner.monsterZone.includes(target) || target === "player" && defenderOwner.monsterZone.length > 0) {\n            return { success: true, message: `${trapResult.message}；攻击目标变化，请重新选择目标`, replay: true };\n        }')
s = s.replace('let battleDamage = 0;\n\n        if (target.position', 'let battleDamage = 0;\n        let pendingFlip = null;\n\n        if (target.position')
s = s.replace('const flipResult = this.triggerEvent("onFlip", flipEvent);\n                if (flipResult) msg += `，${flipResult}`;', 'pendingFlip = flipEvent;')
s = s.replace('if (attackerOwner.monsterZone.includes(attacker)) {\n            markAttackUsed(attacker);\n        }\n        this.emit("onBattleDamage"', 'if (pendingFlip) {\n            const result = this.triggerEvent("onFlip", pendingFlip);\n            if (result) msg += `，${result}`;\n        }\n        if (attackerOwner.monsterZone.includes(attacker)) {\n            markAttackUsed(attacker);\n        }\n        this.emit("onBattleDamage"')
p.write_text(s, encoding='utf-8')

p = root / 'js/constants.js'
s = p.read_text(encoding='utf-8').replace('MAX_LP: 8000,', 'MAX_LP: Number.POSITIVE_INFINITY,')
p.write_text(s, encoding='utf-8')
