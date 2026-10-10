extends SceneTree

var failures := 0

class RejectingAttackEngine extends DuelEngine:
	var attack_attempts := 0
	func attack(_player_index: int, _attacker_index: int, _target_index := -1) -> bool:
		attack_attempts += 1
		return false

func _init() -> void:
	call_deferred("_run")

func _run() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	_check(catalog.cards.size() == 368, "应迁移全部368张卡")
	_test_effect_handler_coverage(catalog)
	_test_turn_and_summon()
	_test_diego_character_effects()
	_test_diego_summons_token()
	_test_four_monsters_can_attack()
	_test_skill_cost_and_condition()
	_test_invalid_attack_keeps_state()
	_test_battle_rules()
	_test_double_attack_survives_phase_change()
	_test_unsupported_skill_keeps_resources()
	_test_trap_activation_checks()
	_test_ai_stops_rejected_attack()
	_test_negation_consumes_one_attack()
	print("Godot duel tests: %d failure(s)" % failures)
	quit(1 if failures else 0)

func _test_turn_and_summon() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	var ids: Array[String] = []
	for card: Dictionary in catalog.cards:
		if card.type == "monster": ids.append(card.id)
		if ids.size() == 40: break
	var engine := DuelEngine.new()
	_check(engine.start_duel(ids, ids, 7), "应能启动决斗")
	_check(engine.state.players[0].hand.size() == 5, "初始手牌应为5张")
	_check(engine.summon(0, 0), "主阶段应能通常召唤")
	_check(not engine.summon(0, 0), "每回合只能通常召唤一次")
	_check(engine.end_turn(0), "应能结束回合")
	_check(engine.state.active_player == 1, "结束回合后应切换玩家")

func _test_diego_character_effects() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	var diego: Dictionary = catalog.get_card("picture_ex_017")
	_check(not diego.is_empty(), "应包含迪亚哥卡牌")
	var effects: Array = diego.get("effects", [])
	_check(effects.size() == 1 and effects[0].get("action") == "token" and effects[0].get("skillName") == "恐龙化", "迪亚哥应使用当前卡面恐龙化效果")

func _test_effect_handler_coverage(catalog: Node) -> void:
	var engine := DuelEngine.new()
	var missing: Array[String] = []
	for card: Dictionary in catalog.cards:
		for effect: Dictionary in card.get("effects", []):
			var effect_type := str(effect.get("type", ""))
			var handler := effect_type + ":" + str(effect.get("action", "")) if effect_type == "themedAction" else effect_type
			if not engine.supports_effect(effect) and handler not in missing:
				missing.append(handler)
	_check(missing.is_empty(), "全部卡牌效果均有Godot处理器：%s" % ",".join(missing))

func _test_diego_summons_token() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	var ids: Array[String] = []
	for card: Dictionary in catalog.cards:
		if card.type == "monster": ids.append(card.id)
		if ids.size() == 40: break
	var engine := DuelEngine.new()
	engine.start_duel(ids, ids, 9)
	engine.state.players[0].hand = [catalog.create_instance("picture_ex_017")]
	engine.state.players[1].spell_trap_zone = [
		{"name":"测试陷阱A", "type":"trap", "effects":[]},
		{"name":"测试魔法B", "type":"spell", "effects":[]},
	]
	_check(engine.summon(0, 0), "应能召唤迪亚哥")
	_check(engine.state.players[1].spell_trap_zone.size() == 2, "恐龙化不应执行已移除的后场清除效果")
	_check(engine.state.players[0].monster_zone.size() == 2, "恐龙化应特殊召唤衍生物")
	var token: Dictionary = engine.state.players[0].monster_zone[1]
	_check(token.current_attack == 1000 and token.current_defense == 650 and token.position == "defense" and token.cannot_tribute, "衍生物攻守、表示及祭品限制应符合卡面")
	engine._trigger_effects(0, catalog.create_instance("picture_ex_017"), "onSummon")
	_check(engine.state.players[0].monster_zone.size() == 2, "同名恐龙化每回合只能发动一次")
	engine._destroy_monster(0, token)
	_check(not engine.state.players[0].graveyard.has(token), "衍生物离场消失而不进入墓地")

func _test_four_monsters_can_attack() -> void:
	var catalog: Node = root.get_node("CardCatalog")
	var engine := DuelEngine.new()
	engine.state.active_player = 0
	engine.state.turn = 2
	for card: Dictionary in catalog.cards:
		if card.type == "monster": engine.state.players[0].monster_zone.append(catalog.create_instance(card.id))
		if engine.state.players[0].monster_zone.size() == 4: break
	_check(engine.enter_battle_phase(0), "应能进入战斗阶段")
	_check(engine.state.players[0].monster_zone.all(func(card: Dictionary): return card.can_attack), "场上4只已有怪兽均应获得攻击权")

func _test_skill_cost_and_condition() -> void:
	var engine := DuelEngine.new()
	engine.state.active_player = 0
	var monster := {
		"name":"代价测试怪兽", "type":"monster", "current_attack":1000, "current_defense":1000,
		"can_attack":false, "has_attacked":false, "cannot_attack":false,
		"effects":[{"trigger":"manual", "type":"doubleAttack", "value":1, "oncePerTurn":true, "cost":{"type":"payLife", "value":1000}}],
	}
	engine.state.players[0].monster_zone = [monster]
	_check(engine.activate_monster_effect(0, 0, 0), "满足代价时应能发动主动技能")
	_check(engine.state.players[0].lp == 7000, "主动技能应真实支付1000LP")
	_check(not engine.activate_monster_effect(0, 0, 0), "每回合一次技能不能重复发动")
	_check(engine.state.players[0].lp == 7000, "重复发动失败时不应再次扣费")

func _test_invalid_attack_keeps_state() -> void:
	var engine := DuelEngine.new()
	engine.state.active_player = 0
	engine.state.turn = 2
	engine.state.phase = "main"
	var attacker := {"name":"攻击者", "type":"monster", "position":"defense", "face_up":true, "current_attack":1500, "current_defense":1000, "cannot_attack":false, "can_attack":false, "has_attacked":false, "effects":[]}
	engine.state.players[0].monster_zone = [attacker]
	engine.state.players[1].monster_zone = [{"name":"目标", "type":"monster", "current_attack":500, "current_defense":500}]
	_check(engine.enter_battle_phase(0), "应进入战斗阶段")
	_check(not engine.attack(0, 0, 0), "守备表示不能攻击")
	attacker.position = "attack"
	attacker.can_attack = true
	_check(not engine.attack(0, 0, -1), "对方有怪兽时未选目标不能攻击")
	_check(attacker.attacks_left == 1 and not attacker.has_attacked, "未选目标不消耗攻击次数")
	attacker.face_up = false
	_check(not engine.attack(0, 0, 0), "里侧怪兽不能攻击")

func _monster(attack_value: int, defense_value: int, position := "attack") -> Dictionary:
	return {"name":"测试怪兽", "type":"monster", "attack":attack_value, "defense":defense_value, "current_attack":attack_value, "current_defense":defense_value, "position":position, "face_up":true, "can_attack":false, "cannot_attack":false, "has_attacked":false, "effects":[]}

func _test_battle_rules() -> void:
	var first := DuelEngine.new()
	_check(not first.enter_battle_phase(0) and first.state.phase == "main", "先攻首回合不能进入战斗阶段")
	for example: Array in [[1500, 500, "defense", 8000, 8000, 1, 0], [500, 1500, "defense", 7000, 8000, 1, 1], [1000, 1000, "defense", 8000, 8000, 1, 1], [0, 0, "attack", 8000, 8000, 1, 1], [1000, 1000, "attack", 8000, 8000, 0, 0], [1500, 500, "attack", 8000, 7000, 1, 0]]:
		var engine := DuelEngine.new()
		engine.state.turn = 2
		engine.state.players[0].monster_zone = [_monster(example[0], 0)]
		var defender := _monster(example[1], example[1], example[2])
		defender.face_up = example[2] == "attack"
		engine.state.players[1].monster_zone = [defender]
		engine.enter_battle_phase(0)
		_check(engine.attack(0, 0, 0), "合法战斗应结算")
		_check(engine.state.players[0].lp == example[3] and engine.state.players[1].lp == example[4] and engine.state.players[0].monster_zone.size() == example[5] and engine.state.players[1].monster_zone.size() == example[6], "攻守结算与伤害：%s" % str(example))
		_check(defender.face_up, "受攻击的里侧怪兽应翻开")

func _test_double_attack_survives_phase_change() -> void:
	var engine := DuelEngine.new()
	engine.state.turn = 2
	var monster := _monster(1000, 1000)
	monster.effects = [{"trigger":"manual", "type":"doubleAttack", "oncePerTurn":true}]
	engine.state.players[0].monster_zone = [monster]
	_check(engine.activate_monster_effect(0, 0, 0), "主阶段发动双次攻击")
	_check(engine.enter_battle_phase(0) and monster.attacks_left == 2, "进入战斗阶段保留技能赋予的两次攻击")
	_check(not engine.activate_monster_effect(0, 0, 0), "战斗阶段不能发动主阶段主动技能")
	_check(engine.attack(0, 0) and engine.attack(0, 0) and not engine.attack(0, 0), "双次攻击只能实际攻击两次")
	_check(engine.state.players[1].lp == 6000, "两次直接攻击累计2000伤害")
	engine.state.players[1].deck = [_monster(100, 100)]
	engine.end_turn(0)
	_check(not monster.has("attacks_per_turn"), "双次攻击增益在回合结束后清理")

func _test_unsupported_skill_keeps_resources() -> void:
	var engine := DuelEngine.new()
	var monster := _monster(1000, 1000)
	monster.effects = [{"trigger":"manual", "type":"themedAction", "action":"not_implemented", "oncePerTurn":true, "cost":{"type":"payLife", "value":1000}}]
	engine.state.players[0].monster_zone = [monster]
	_check(not engine.activate_monster_effect(0, 0, 0), "未实现的主动技明确拒绝发动")
	_check(engine.state.players[0].lp == 8000 and not monster.has("manual_used_1_0"), "拒绝发动不扣LP或消耗次数")
	var spell := {"name":"未实现魔法", "type":"spell", "effects":monster.effects}
	engine.state.players[0].hand = [spell]
	_check(not engine.activate_spell(0, 0) and engine.state.players[0].hand.size() == 1 and engine.state.players[0].graveyard.is_empty(), "未实现魔法不消耗手牌")
	spell.effects = [{"trigger":"manual", "type":"healPlayer", "value":1000, "cost":{"type":"discard", "value":1}}]
	_check(not engine.activate_spell(0, 0) and engine.state.players[0].hand.size() == 1, "发动的魔法本身不能作为弃牌费用")
	spell.effects = [{"trigger":"manual", "type":"healPlayer", "value":1000, "cost":{"type":"payLife", "value":8000}}]
	_check(not engine.activate_spell(0, 0) and engine.state.players[0].lp == 8000, "费用不足不能消耗魔法")
	spell.effects = [{"trigger":"manual", "type":"healPlayer", "value":1000, "cost":{"type":"unimplemented", "value":1}}]
	_check(not engine.activate_spell(0, 0), "不认识的费用不能免费发动")

func _test_trap_activation_checks() -> void:
	for scenario: String in ["same_turn", "unsupported", "unpaid", "valid"]:
		var engine := DuelEngine.new()
		engine.state.turn = 2
		engine.state.players[0].monster_zone = [_monster(1000, 1000)]
		var trap := {"name":"测试陷阱", "type":"trap", "set_turn":2 if scenario == "same_turn" else 1, "effects":[{"trigger":"onAttacked", "type":"destroyAttacker" if scenario != "unsupported" else "missing", "cost":{"type":"payLife", "value":8000 if scenario == "unpaid" else 500}}]}
		engine.state.players[1].spell_trap_zone = [trap]
		engine.enter_battle_phase(0)
		engine.attack(0, 0)
		if scenario == "valid":
			_check(engine.state.players[1].lp == 7500 and engine.state.players[0].monster_zone.is_empty() and engine.state.players[1].graveyard.has(trap), "合法陷阱支付费用并破坏攻击者")
		else:
			_check(engine.state.players[1].lp == 7000 and engine.state.players[1].spell_trap_zone.has(trap), "非法陷阱不能凭空取消攻击：%s" % scenario)

func _test_ai_stops_rejected_attack() -> void:
	var engine := RejectingAttackEngine.new()
	engine.state.turn = 2
	engine.state.active_player = 1
	engine.state.players[1].monster_zone = [_monster(1000, 1000)]
	engine.state.players[0].deck = [_monster(100, 100)]
	BasicAI.new().take_turn(engine, 1)
	_check(engine.attack_attempts == 1 and engine.state.active_player == 0, "AI攻击被拒绝后停止重试并正常结束回合")

func _test_negation_consumes_one_attack() -> void:
	var engine := DuelEngine.new()
	engine.state.turn = 2
	var monster := _monster(1000, 1000)
	monster.attacks_per_turn = 2
	engine.state.players[0].monster_zone = [monster]
	engine.state.players[1].spell_trap_zone = [{"name":"攻击无效", "type":"trap", "set_turn":1, "effects":[{"type":"cannotAttack", "trigger":"onAttacked"}]}]
	engine.enter_battle_phase(0)
	_check(engine.attack(0, 0) and monster.attacks_left == 1 and engine.state.players[1].lp == 8000, "攻击无效只消耗本次攻击")
	_check(engine.attack(0, 0) and engine.state.players[1].lp == 7000, "双次攻击怪兽保留另一次攻击机会")

func _check(condition: bool, message: String) -> void:
	if condition:
		print("PASS: %s" % message)
	else:
		failures += 1
		push_error("FAIL: %s" % message)
