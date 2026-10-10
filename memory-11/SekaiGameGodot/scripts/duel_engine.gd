class_name DuelEngine
extends RefCounted

const SUPPORTED_EFFECT_TYPES := [
	"destroyAllEnemySpellTraps", "groupDraw", "destroySpellTrap", "returnMultiple",
	"discardAndDraw", "returnToHand", "reviveRecentGraveyard", "directDamage",
	"temporaryBanish", "tokenSummon", "damageAllEnemyMonsters", "banishEnemyGraveyard",
	"drawCards", "healPlayer", "protectAllies", "discardCards", "lockAttack",
	"debuffEnemyAttack", "cannotAttack", "groupBuff", "buffAllAlliesAttack",
	"debuffAllEnemyAttack", "reduceDamage", "destroyAttacker", "destroyWeakest",
	"freezeAll", "reflectDamage", "swapAttackDefense", "targetProtect", "doubleAttack",
	"recycleSpellDraw", "counterDestroy", "destroyTarget", "copyLastSpell",
	"recoverMonster", "debuffEnemyDefense", "buffSelfAttack", "buffSelfDefense",
	"sacrificeDestroy", "fullRecovery", "gainAttackByCount", "recycleAndDraw",
]

signal state_changed(state: DuelState)
signal action_resolved(message: String)
signal duel_finished(winner: int, reason: String)

var state := DuelState.new()
var rng := RandomNumberGenerator.new()
var used_effects: Dictionary = {}

func supports_effect(effect: Dictionary) -> bool:
	if effect.get("type", "") == "themedAction":
		return effect.get("action", "") == "token"
	return supports_effect_type(str(effect.get("type", "")))

func supports_effect_type(effect_type: String) -> bool:
	return effect_type in SUPPORTED_EFFECT_TYPES

func start_duel(deck_a: Array[String], deck_b: Array[String], seed: int = 1) -> bool:
	state = DuelState.new()
	used_effects.clear()
	rng.seed = seed
	if deck_a.size() < 20 or deck_b.size() < 20:
		return false
	state.players[0].deck = _make_deck(deck_a)
	state.players[1].deck = _make_deck(deck_b)
	_shuffle(state.players[0].deck)
	_shuffle(state.players[1].deck)
	for player_index in 2:
		for ignored in DuelState.STARTING_HAND:
			draw_card(player_index, false)
	state.add_log("决斗开始")
	_emit_change()
	return true

func draw_card(player_index: int, announce := true) -> Dictionary:
	var player := state.players[player_index]
	if player.deck.is_empty():
		_finish(state.opponent_of(player_index), "卡组耗尽")
		return {}
	var card: Dictionary = player.deck.pop_back()
	player.hand.append(card)
	if announce:
		_resolve("%s抽了1张卡" % player.name)
	return card

func summon(player_index: int, hand_index: int, position := "attack") -> bool:
	if not _is_action_turn(player_index) or state.phase != "main":
		return false
	var player := state.players[player_index]
	if player.normal_summoned or player.monster_zone.size() >= DuelState.MONSTER_ZONE_SIZE:
		return false
	if hand_index < 0 or hand_index >= player.hand.size():
		return false
	var card: Dictionary = player.hand[hand_index]
	if card.type != "monster":
		return false
	player.hand.remove_at(hand_index)
	card.position = position
	card.face_up = true
	card.can_attack = false
	player.monster_zone.append(card)
	player.normal_summoned = true
	_resolve("%s召唤了%s" % [player.name, card.name])
	_trigger_effects(player_index, card, "onSummon")
	_emit_change()
	return true

func set_spell_trap(player_index: int, hand_index: int) -> bool:
	if not _is_action_turn(player_index) or state.phase != "main":
		return false
	var player := state.players[player_index]
	if player.spell_trap_zone.size() >= DuelState.SPELL_TRAP_ZONE_SIZE:
		return false
	if hand_index < 0 or hand_index >= player.hand.size():
		return false
	var card: Dictionary = player.hand[hand_index]
	if card.type not in ["spell", "trap"]:
		return false
	player.hand.remove_at(hand_index)
	card.face_up = false
	card.set_turn = state.turn
	player.spell_trap_zone.append(card)
	_resolve("%s盖放了1张卡" % player.name)
	_emit_change()
	return true

func activate_spell(player_index: int, hand_index: int) -> bool:
	if not _is_action_turn(player_index) or state.phase != "main":
		return false
	var player := state.players[player_index]
	if hand_index < 0 or hand_index >= player.hand.size():
		return false
	var card: Dictionary = player.hand[hand_index]
	if card.type != "spell":
		return false
	var life_cost := 0
	var discard_cost := 0
	for effect: Dictionary in card.get("effects", []):
		if effect.get("trigger", "") != "manual": continue
		if not supports_effect(effect):
			_resolve("尚未支持此卡效果：%s" % card.name)
			return false
		if not _check_effect_condition(player_index, effect.get("condition", {})): return false
		if effect.get("hardOncePerTurn", false) and used_effects.has(_effect_key(player_index, card, effect)): return false
		var cost: Dictionary = effect.get("cost", {})
		match str(cost.get("type", "")):
			"": pass
			"payLife": life_cost += max(0, int(cost.get("value", 0)))
			"discard": discard_cost += max(0, int(cost.get("value", 0)))
			_: return false
	if player.lp <= life_cost or player.hand.size() - 1 < discard_cost: return false
	player.hand.remove_at(hand_index)
	_resolve("%s发动了%s" % [player.name, card.name])
	_trigger_effects(player_index, card, "manual")
	player.graveyard.append(card)
	_emit_change()
	return true

func enter_battle_phase(player_index: int) -> bool:
	if not _is_action_turn(player_index) or state.phase != "main":
		return false
	if state.turn == 1:
		return false
	if state.players[player_index].skip_battle:
		return false
	state.phase = "battle"
	for monster: Dictionary in state.players[player_index].monster_zone:
		monster.attacks_left = int(monster.get("attacks_per_turn", 1))
		monster.can_attack = not monster.cannot_attack and monster.get("face_up", true) and monster.get("position", "attack") == "attack"
	_emit_change()
	return true

func attack(player_index: int, attacker_index: int, target_index := -1) -> bool:
	if not _is_action_turn(player_index) or state.phase != "battle":
		return false
	var player := state.players[player_index]
	var opponent := state.players[state.opponent_of(player_index)]
	if attacker_index < 0 or attacker_index >= player.monster_zone.size():
		return false
	var attacker: Dictionary = player.monster_zone[attacker_index]
	if not attacker.can_attack or int(attacker.get("attacks_left", 0)) <= 0 or attacker.cannot_attack:
		return false
	if not attacker.get("face_up", true) or attacker.get("position", "attack") != "attack":
		return false
	# 目标未选定时不能先触发陷阱或消耗攻击次数。
	if not opponent.monster_zone.is_empty() and (target_index < 0 or target_index >= opponent.monster_zone.size()):
		return false
	if _trigger_attack_traps(player_index, attacker):
		attacker.attacks_left = max(0, int(attacker.get("attacks_left", 1)) - 1)
		attacker.has_attacked = attacker.attacks_left <= 0
		attacker.can_attack = attacker.attacks_left > 0 and player.monster_zone.has(attacker) and not attacker.cannot_attack
		_emit_change()
		return true
	if opponent.monster_zone.is_empty():
		_damage_player(state.opponent_of(player_index), int(attacker.current_attack))
		_resolve("%s直接攻击，造成%d点伤害" % [attacker.name, attacker.current_attack])
	elif target_index >= 0 and target_index < opponent.monster_zone.size():
		_resolve_battle(player_index, attacker, opponent.monster_zone[target_index])
	else:
		return false
	attacker.attacks_left = max(0, int(attacker.get("attacks_left", 1)) - 1)
	attacker.has_attacked = attacker.attacks_left <= 0
	attacker.can_attack = attacker.attacks_left > 0 and player.monster_zone.has(attacker) and not attacker.cannot_attack
	_emit_change()
	return true

func end_turn(player_index: int) -> bool:
	if not _is_action_turn(player_index) or state.winner >= 0:
		return false
	for monster: Dictionary in state.players[player_index].monster_zone:
		monster.has_attacked = false
		monster.attacks_left = 0
		monster.can_attack = false
		monster.erase("attacks_per_turn")
		monster.cannot_attack = false
		monster.cannot_be_destroyed_by_battle = false
		monster.cannot_be_targeted = false
	state.players[player_index].normal_summoned = false
	state.players[player_index].skip_battle = false
	_restore_temporarily_banished()
	state.active_player = state.opponent_of(player_index)
	state.turn += 1
	used_effects.clear()
	state.phase = "main"
	draw_card(state.active_player)
	_emit_change()
	return true

func activate_monster_effect(player_index: int, monster_index: int, effect_index: int) -> bool:
	if not _is_action_turn(player_index) or state.phase != "main": return false
	var zone: Array = state.players[player_index].monster_zone
	if monster_index < 0 or monster_index >= zone.size(): return false
	var card: Dictionary = zone[monster_index]
	if not card.get("face_up", true): return false
	var effects: Array = card.get("effects", [])
	if effect_index < 0 or effect_index >= effects.size(): return false
	var effect: Dictionary = effects[effect_index]
	if effect.get("trigger", "") != "manual": return false
	if not supports_effect(effect):
		_resolve("尚未支持此卡效果：%s" % card.name)
		return false
	var used_key := "manual_used_%d_%d" % [state.turn, effect_index]
	if effect.get("oncePerTurn", false) and card.get(used_key, false): return false
	if effect.get("hardOncePerTurn", false) and used_effects.has(_effect_key(player_index, card, effect)): return false
	if not _check_effect_condition(player_index, effect.get("condition", {})): return false
	if not _pay_effect_cost(player_index, effect.get("cost", {})): return false
	_apply_effect(player_index, card, effect)
	card[used_key] = true
	used_effects[_effect_key(player_index, card, effect)] = true
	_emit_change()
	return true

func _effect_key(player_index: int, card: Dictionary, effect: Dictionary) -> String:
	return "%d:%d:%s:%d" % [state.turn, player_index, card.get("id", card.get("name", "")), card.get("effects", []).find(effect)]

func _trigger_effects(player_index: int, card: Dictionary, trigger: String) -> void:
	for effect: Dictionary in card.get("effects", []):
		if str(effect.get("trigger", "")) == trigger:
			if not supports_effect(effect):
				state.add_log("尚未支持此卡效果：%s" % card.name)
				continue
			var used_key := _effect_key(player_index, card, effect)
			if effect.get("hardOncePerTurn", false) and used_effects.has(used_key): continue
			if not _check_effect_condition(player_index, effect.get("condition", {})): continue
			if not _pay_effect_cost(player_index, effect.get("cost", {})): continue
			used_effects[used_key] = true
			_apply_effect(player_index, card, effect)

func _apply_effect(player_index: int, card: Dictionary, effect: Dictionary, context: Dictionary = {}) -> void:
	var player := state.players[player_index]
	var opponent := state.players[state.opponent_of(player_index)]
	var value := int(effect.get("value", 0))
	var target: Dictionary = context.get("target", {})
	match str(effect.get("type", "")):
		"themedAction":
			if effect.get("action", "") == "token" and player.monster_zone.size() < DuelState.MONSTER_ZONE_SIZE:
				var params: Dictionary = effect.get("params", {})
				var attack_value := int(params.get("attack", 0))
				var defense_value := int(params.get("defense", 1000))
				player.monster_zone.append({"id":"token", "name":"%s·衍生物" % card.name, "type":"monster", "level":1, "is_token":true, "cannot_tribute":true, "attack":attack_value, "defense":defense_value, "current_attack":attack_value, "current_defense":defense_value, "position":"defense", "face_up":true, "can_attack":false, "has_attacked":false, "cannot_attack":false, "effects":[]})
		"buffSelfAttack": card.current_attack += value
		"buffSelfDefense": card.current_defense += value
		"healPlayer": player.lp = min(99999, player.lp + value)
		"directDamage": _damage_player(state.opponent_of(player_index), value)
		"drawCards", "groupDraw":
			for ignored in max(1, value): draw_card(player_index, false)
		"buffAllAlliesAttack", "groupBuff":
			for monster: Dictionary in player.monster_zone: monster.current_attack += value
		"debuffAllEnemyAttack":
			for monster: Dictionary in opponent.monster_zone: monster.current_attack = max(0, monster.current_attack - value)
		"debuffEnemyAttack":
			var monster := _select_monster(opponent.monster_zone, "highest")
			if not monster.is_empty(): monster.current_attack = max(0, monster.current_attack - value)
		"debuffEnemyDefense":
			var monster := _select_monster(opponent.monster_zone, "highest")
			if not monster.is_empty():
				monster.current_defense = max(0, monster.current_defense - value)
				if monster.current_defense <= 0: _destroy_monster(state.opponent_of(player_index), monster)
		"gainAttackByCount": card.current_attack += player.monster_zone.size() * value
		"destroyAllEnemySpellTraps":
			while not opponent.spell_trap_zone.is_empty(): opponent.graveyard.append(opponent.spell_trap_zone.pop_back())
		"destroySpellTrap":
			for ignored in min(max(1, value), opponent.spell_trap_zone.size()): opponent.graveyard.append(opponent.spell_trap_zone.pop_front())
		"destroyWeakest":
			if not opponent.monster_zone.is_empty():
				var weakest := _select_monster(opponent.monster_zone, "lowest")
				_destroy_monster(state.opponent_of(player_index), weakest)
		"destroyTarget":
			var victim := target if not target.is_empty() else _select_monster(opponent.monster_zone, "highest")
			if not victim.is_empty() and not victim.get("cannot_be_destroyed_by_effect", false): _destroy_monster(state.opponent_of(player_index), victim)
		"damageAllEnemyMonsters":
			for monster: Dictionary in opponent.monster_zone.duplicate():
				monster.current_defense = max(0, monster.current_defense - value)
				if monster.current_defense <= 0: _destroy_monster(state.opponent_of(player_index), monster)
		"tokenSummon":
			if player.monster_zone.size() < DuelState.MONSTER_ZONE_SIZE:
				player.monster_zone.append({"id":"token", "name":"衍生物", "type":"monster", "current_attack":value, "current_defense":value, "can_attack":false, "has_attacked":false, "cannot_attack":false, "effects":[]})
		"lockAttack":
			if not opponent.monster_zone.is_empty():
				var locked := _select_monster(opponent.monster_zone, "highest")
				locked.cannot_attack = true
		"freezeAll":
			for monster: Dictionary in opponent.monster_zone:
				monster.current_attack = max(0, monster.current_attack - value)
				monster.cannot_attack = true
		"returnToHand":
			var returned := target if not target.is_empty() else _select_monster(opponent.monster_zone, "lowest")
			_return_monster_to_hand(state.opponent_of(player_index), returned)
		"returnMultiple":
			for ignored in min(max(1, value), opponent.monster_zone.size()):
				_return_monster_to_hand(state.opponent_of(player_index), _select_monster(opponent.monster_zone, "lowest"))
		"temporaryBanish":
			var banished := _select_monster(opponent.monster_zone, "highest")
			if not banished.is_empty():
				opponent.monster_zone.erase(banished)
				banished["return_turn"] = state.turn + 1
				opponent.banished.append(banished)
		"banishEnemyGraveyard":
			for ignored in min(max(1, value), opponent.graveyard.size()): opponent.banished.append(opponent.graveyard.pop_back())
		"reviveRecentGraveyard", "recoverMonster":
			for index in range(player.graveyard.size() - 1, -1, -1):
				var revived: Dictionary = player.graveyard[index]
				if revived.get("type", "") == "monster" and player.monster_zone.size() < DuelState.MONSTER_ZONE_SIZE:
					player.graveyard.remove_at(index)
					revived.can_attack = false
					revived.has_attacked = true
					player.monster_zone.append(revived)
					break
		"discardCards":
			for ignored in min(max(1, value), opponent.hand.size()): opponent.graveyard.append(opponent.hand.pop_at(rng.randi_range(0, opponent.hand.size() - 1)))
		"discardAndDraw":
			if not player.hand.is_empty(): player.graveyard.append(player.hand.pop_at(rng.randi_range(0, player.hand.size() - 1)))
			for ignored in 2: draw_card(player_index, false)
		"recycleAndDraw", "recycleSpellDraw":
			for index in range(player.graveyard.size() - 1, -1, -1):
				if player.graveyard[index].get("type", "") == "spell":
					player.hand.append(player.graveyard.pop_at(index))
					break
			draw_card(player_index, false)
		"swapAttackDefense":
			var swapped := _select_monster(opponent.monster_zone, "highest")
			if not swapped.is_empty():
				var old_attack: int = swapped.current_attack
				swapped.current_attack = swapped.current_defense
				swapped.current_defense = old_attack
		"targetProtect":
			var protected := _select_monster(player.monster_zone, "highest")
			if not protected.is_empty(): protected.cannot_be_targeted = true
		"protectAllies":
			for monster: Dictionary in player.monster_zone: monster.cannot_be_destroyed_by_battle = true
		"doubleAttack":
			card.attacks_per_turn = 2
			card.attacks_left = max(2, int(card.get("attacks_left", 0)))
			card.can_attack = state.phase == "battle" and card.get("position", "attack") == "attack" and card.get("face_up", true) and not card.get("cannot_attack", false)
		"sacrificeDestroy":
			player.lp = max(1, player.lp - int(player.lp * float(value) / 100.0))
			for ignored in min(2, opponent.monster_zone.size()): _destroy_monster(state.opponent_of(player_index), _select_monster(opponent.monster_zone, "highest"))
		"fullRecovery":
			player.lp = min(99999, player.lp + 1200)
			for monster: Dictionary in player.monster_zone: monster.current_defense = int(monster.get("defense", monster.current_defense))
		"copyLastSpell": draw_card(player_index, false)
		_:
			state.add_log("待迁移效果处理器：%s" % effect.get("type", "unknown"))
	state.add_log(str(effect.get("description", effect.get("type", "效果结算"))))

func _check_effect_condition(player_index: int, condition: Dictionary) -> bool:
	if condition.is_empty(): return true
	var player := state.players[player_index]
	var opponent := state.players[state.opponent_of(player_index)]
	if int(condition.get("opponentMinMonsterCount", 0)) > opponent.monster_zone.size(): return false
	if int(condition.get("opponentMinSpellTrapCount", 0)) > opponent.spell_trap_zone.size(): return false
	if int(condition.get("allyMinCount", 0)) > player.monster_zone.size(): return false
	if int(condition.get("selfMinGraveyardMonsters", 0)) > player.graveyard.filter(func(card: Dictionary): return card.get("type", "") == "monster").size(): return false
	return true

func _pay_effect_cost(player_index: int, cost: Dictionary) -> bool:
	if cost.is_empty(): return true
	var player: Dictionary = state.players[player_index]
	var value: int = max(0, int(cost.get("value", 0)))
	match str(cost.get("type", "")):
		"payLife":
			if player.lp <= value: return false
			player.lp -= value
			return true
		"discard":
			if player.hand.size() < value: return false
			for ignored in value: player.graveyard.append(player.hand.pop_at(rng.randi_range(0, player.hand.size() - 1)))
			return true
	return false

func _trigger_attack_traps(attacker_owner: int, attacker: Dictionary) -> bool:
	var defender_owner := state.opponent_of(attacker_owner)
	var defender := state.players[defender_owner]
	for trap: Dictionary in defender.spell_trap_zone.duplicate():
		if trap.get("type", "") != "trap": continue
		if int(trap.get("set_turn", -1)) >= state.turn: continue
		var effects: Array = trap.get("effects", [])
		for effect: Dictionary in effects:
			if effect.get("trigger", "") != "onAttacked": continue
			if effect.get("type", "") not in ["destroyAttacker", "counterDestroy", "returnToHand", "reflectDamage", "reduceDamage", "cannotAttack"]: continue
			if effect.get("hardOncePerTurn", false) and used_effects.has(_effect_key(defender_owner, trap, effect)): continue
			if not _check_effect_condition(defender_owner, effect.get("condition", {})): continue
			if not _pay_effect_cost(defender_owner, effect.get("cost", {})): continue
			used_effects[_effect_key(defender_owner, trap, effect)] = true
			defender.spell_trap_zone.erase(trap)
			trap.face_up = true
			var effect_type := str(effect.get("type", ""))
			match effect_type:
				"destroyAttacker", "counterDestroy":
					if not attacker.get("cannot_be_destroyed_by_effect", false): _destroy_monster(attacker_owner, attacker)
				"returnToHand": _return_monster_to_hand(attacker_owner, attacker)
				"reflectDamage": _damage_player(attacker_owner, int(attacker.get("current_attack", 0)))
				"reduceDamage": pass
				"cannotAttack": pass
			defender.graveyard.append(trap)
			state.add_log(str(effect.get("description", trap.name)))
			return true
	return false

func _resolve_battle(attacker_owner: int, attacker: Dictionary, defender: Dictionary) -> void:
	var defender_owner := state.opponent_of(attacker_owner)
	defender.face_up = true
	var attack_value := int(attacker.current_attack)
	var defend_value := int(defender.current_attack if defender.get("position", "attack") == "attack" else defender.current_defense)
	if attack_value > defend_value:
		if not defender.get("cannot_be_destroyed_by_battle", false): _destroy_monster(defender_owner, defender)
		if defender.get("position", "attack") == "attack" or attacker.get("piercing", false):
			_damage_player(defender_owner, attack_value - defend_value)
	elif attack_value < defend_value:
		if defender.get("position", "attack") == "attack" and not attacker.get("cannot_be_destroyed_by_battle", false): _destroy_monster(attacker_owner, attacker)
		_damage_player(attacker_owner, defend_value - attack_value)
	elif attack_value > 0 and defender.get("position", "attack") == "attack":
		if not defender.get("cannot_be_destroyed_by_battle", false): _destroy_monster(defender_owner, defender)
		if not attacker.get("cannot_be_destroyed_by_battle", false): _destroy_monster(attacker_owner, attacker)
	_resolve("%s攻击%s" % [attacker.name, defender.name])

func _destroy_monster(owner_index: int, monster: Dictionary) -> void:
	var owner := state.players[owner_index]
	var index: int = owner.monster_zone.find(monster)
	if index < 0: return
	owner.monster_zone.remove_at(index)
	if monster.get("is_token", false): return
	owner.graveyard.append(monster)
	_trigger_effects(owner_index, monster, "onDestroyed")

func _return_monster_to_hand(owner_index: int, monster: Dictionary) -> void:
	if monster.is_empty(): return
	var owner := state.players[owner_index]
	var index: int = owner.monster_zone.find(monster)
	if index < 0: return
	owner.monster_zone.remove_at(index)
	if monster.get("is_token", false): return
	monster.current_attack = int(monster.get("attack", 0))
	monster.current_defense = int(monster.get("defense", 0))
	monster.can_attack = false
	monster.has_attacked = false
	owner.hand.append(monster)

func _select_monster(zone: Array, order: String) -> Dictionary:
	if zone.is_empty(): return {}
	var selected: Dictionary = zone[0]
	for candidate: Dictionary in zone:
		if order == "highest" and int(candidate.get("current_attack", 0)) > int(selected.get("current_attack", 0)):
			selected = candidate
		elif order == "lowest" and int(candidate.get("current_attack", 0)) < int(selected.get("current_attack", 0)):
			selected = candidate
	return selected

func _restore_temporarily_banished() -> void:
	for player: Dictionary in state.players:
		for card: Dictionary in player.banished.duplicate():
			if card.has("return_turn") and int(card.return_turn) <= state.turn + 1 and player.monster_zone.size() < DuelState.MONSTER_ZONE_SIZE:
				player.banished.erase(card)
				card.erase("return_turn")
				card.can_attack = false
				player.monster_zone.append(card)

func _damage_player(player_index: int, amount: int) -> void:
	state.players[player_index].lp = max(0, state.players[player_index].lp - max(0, amount))
	if state.players[player_index].lp <= 0:
		_finish(state.opponent_of(player_index), "LP归零")

func _make_deck(card_ids: Array[String]) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var catalog: Node = Engine.get_main_loop().root.get_node("CardCatalog")
	for card_id in card_ids:
		var card: Dictionary = catalog.create_instance(card_id)
		if not card.is_empty(): result.append(card)
	return result

func _shuffle(deck: Array) -> void:
	for index in range(deck.size() - 1, 0, -1):
		var swap_index := rng.randi_range(0, index)
		var temporary: Variant = deck[index]
		deck[index] = deck[swap_index]
		deck[swap_index] = temporary

func _is_action_turn(player_index: int) -> bool:
	return state.winner < 0 and state.active_player == player_index

func _resolve(message: String) -> void:
	state.add_log(message)
	action_resolved.emit(message)

func _finish(winner: int, reason: String) -> void:
	if state.winner >= 0: return
	state.winner = winner
	duel_finished.emit(winner, reason)

func _emit_change() -> void:
	state_changed.emit(state)
