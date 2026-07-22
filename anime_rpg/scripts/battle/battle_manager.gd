## BattleManager - 战斗流程管理
extends Node

# 战斗状态
enum BattleState {
	START,
	PLAYER_INPUT,
	TARGET_SELECTING,
	EXECUTING,
	VICTORY,
	DEFEAT,
	ESCAPE
}

var current_state: BattleState = BattleState.START
var atb_system: ATBSystem = null

# 战斗参与者
var player: CharacterData = null
var enemies: Array[CharacterData] = []

# 当前等待行动的角色
var character_awaiting_action: CharacterData = null

# 当前选择的技能ID（用于目标选择后执行）
var pending_skill_id: String = ""
var pending_action_type: String = ""

# 回合计数
var turn_count: int = 0

# 战斗结果
var battle_result: EventBus.BattleResult = EventBus.BattleResult.VICTORY

# UI引用（通过get_node获取）
var battle_ui: Control = null

func _ready():
	# 创建ATB系统
	atb_system = ATBSystem.new()
	add_child(atb_system)
	atb_system.action_ready.connect(_on_action_ready)
	
	# 获取BattleUI引用
	await get_tree().process_frame
	battle_ui = get_node_or_null("../UI/BattleUI")

## 开始战斗
func start_battle(enemy_list: Array[EnemyData]) -> void:
	current_state = BattleState.START
	turn_count = 0
	
	# 创建玩家角色数据
	player = GameManager.get_player().duplicate()
	player.is_defending = false
	
	# 创建敌人角色数据
	enemies.clear()
	for enemy_data in enemy_list:
		var enemy = CharacterData.new()
		enemy.setup(enemy_data.id, enemy_data.enemy_name, enemy_data.hp, enemy_data.attack, enemy_data.defense, enemy_data.speed)
		enemies.append(enemy)
	
	# 初始化ATB系统
	var all_characters: Array[CharacterData] = [player]
	all_characters.append_array(enemies)
	atb_system.setup_battle(all_characters)
	
	# 初始化UI
	_update_battle_ui()
	
	# 播放战斗开始动画（可选）
	await get_tree().create_timer(0.5).timeout
	
	# 进入ATB等待状态
	current_state = BattleState.EXECUTING
	EventBus.battle_started.emit(enemies)

## ATB就绪回调
func _on_action_ready(character: CharacterData) -> void:
	if current_state != BattleState.EXECUTING:
		return
	
	# 重置防御状态
	character.is_defending = false
	
	if character == player:
		# 玩家回合
		current_state = BattleState.PLAYER_INPUT
		character_awaiting_action = player
		_show_player_menu()
	else:
		# 敌人回合 - AI自动决策
		current_state = BattleState.EXECUTING
		_execute_enemy_action(character)

## 显示玩家行动菜单
func _show_player_menu():
	if battle_ui:
		battle_ui.show_action_menu()

## 进入目标选择模式
func enter_target_selection(action_type: String, skill_id: String = "") -> void:
	current_state = BattleState.TARGET_SELECTING
	pending_action_type = action_type
	pending_skill_id = skill_id
	if battle_ui:
		battle_ui.show_target_selection()

## 目标选择完成
func on_target_selected(target: CharacterData) -> void:
	if current_state != BattleState.TARGET_SELECTING:
		return
	
	var action_type = pending_action_type
	var skill_id = pending_skill_id
	
	pending_action_type = ""
	pending_skill_id = ""
	
	execute_player_action(action_type, target, skill_id)

## 取消目标选择
func cancel_target_selection() -> void:
	if current_state != BattleState.TARGET_SELECTING:
		return
	
	current_state = BattleState.PLAYER_INPUT
	pending_action_type = ""
	pending_skill_id = ""
	if battle_ui:
		battle_ui.hide_target_selection()
		battle_ui.show_action_menu()

## 执行玩家行动
func execute_player_action(action_type: String, target: CharacterData = null, skill_id: String = "") -> void:
	if current_state != BattleState.PLAYER_INPUT and current_state != BattleState.TARGET_SELECTING:
		return
	
	current_state = BattleState.EXECUTING
	var character = character_awaiting_action
	
	if battle_ui:
		battle_ui.hide_action_menu()
		battle_ui.hide_target_selection()
	
	match action_type:
		"attack":
			_execute_attack(character, target)
		"skill":
			_execute_skill(character, target, skill_id)
		"defend":
			_execute_defend(character)
		"item":
			_execute_item(character, target)
		"escape":
			_execute_escape()
	
	turn_count += 1
	_update_turn_label()
	_check_battle_end()

## 执行普通攻击
func _execute_attack(attacker: CharacterData, target: CharacterData):
	if target == null or not target.is_alive():
		target = _get_random_alive_enemy()
		if target == null:
			return
	
	var damage = attacker.attack + randi_range(-2, 3)
	var actual_damage = target.take_damage(damage)
	
	EventBus.damage_dealt.emit(attacker, target, actual_damage)
	_check_character_defeated(target)
	print("%s 攻击 %s，造成 %d 伤害" % [attacker.character_name, target.character_name, actual_damage])
	
	# 消耗ATB
	atb_system.consume_atb(attacker)
	_update_battle_ui()

## 执行技能
func _execute_skill(attacker: CharacterData, target: CharacterData, skill_id: String):
	var skill = _find_skill(skill_id)
	if skill == null:
		return
	
	if not skill.can_use(attacker):
		print("MP不足！")
		if battle_ui:
			battle_ui.show_message("MP不足！")
		return
	
	# 获取目标
	var targets = skill.get_targets(attacker, enemies, [player])
	
	# 如果是单体目标且没有指定目标，使用传入的目标
	if skill.target_type == SkillData.TargetType.SINGLE_ENEMY and target != null:
		targets = [target]
	
	var results = skill.apply_effect(attacker, targets)
	
	for result in results:
		match result["type"]:
			"damage":
				EventBus.damage_dealt.emit(attacker, result["target"], result["value"])
				_check_character_defeated(result["target"])
				print("%s 使用 %s 对 %s 造成 %d 伤害" % [attacker.character_name, skill.skill_name, result["target"].character_name, result["value"]])
			"heal":
				EventBus.player_healed.emit(result["value"])
				print("%s 使用 %s 恢复 %d HP" % [attacker.character_name, skill.skill_name, result["value"]])
			"buff":
				print("%s 获得 %s 增益" % [result["target"].character_name, result.get("stat", "")])
			"debuff":
				print("%s 受到 %s 减益" % [result["target"].character_name, result.get("stat", "")])
	
	# 消耗ATB
	atb_system.consume_atb(attacker)
	_update_battle_ui()

## 执行防御
func _execute_defend(character: CharacterData):
	character.is_defending = true
	# 防御时快速恢复ATB
	atb_system.consume_atb(character, 50.0)
	print("%s 进入防御状态" % character.character_name)
	_update_battle_ui()

## 执行使用道具
func _execute_item(character: CharacterData, target: CharacterData):
	# 简化处理：使用生命药水
	if GameManager.player_data.has_item("potion"):
		GameManager.player_data.remove_item("potion")
		var heal_amount = 50
		character.heal(heal_amount)
		EventBus.player_healed.emit(heal_amount)
		print("%s 使用生命药水，恢复 %d HP" % [character.character_name, heal_amount])
	else:
		print("没有可用的道具！")
		if battle_ui:
			battle_ui.show_message("没有可用的道具！")
	
	atb_system.consume_atb(character)
	_update_battle_ui()

## 执行逃跑
func _execute_escape():
	var escape_chance = 0.5 + (player.speed - _get_average_enemy_speed()) * 0.05
	if randf() < escape_chance:
		current_state = BattleState.ESCAPE
		battle_result = EventBus.BattleResult.ESCAPE
		if battle_ui:
			battle_ui.show_message("逃跑成功！")
		print("逃跑成功！")
	else:
		if battle_ui:
			battle_ui.show_message("逃跑失败！")
		print("逃跑失败！")
		atb_system.consume_atb(player)
	_update_battle_ui()

## 执行敌人行动
func _execute_enemy_action(enemy: CharacterData):
	# 等待一小段时间模拟思考
	await get_tree().create_timer(0.3).timeout
	
	# AI决策
	var action = enemy.decide_action([player])
	
	match action["type"]:
		"attack":
			var target = action["target"]
			var damage = enemy.attack + randi_range(-2, 3)
			var actual_damage = target.take_damage(damage)
			EventBus.damage_dealt.emit(enemy, target, actual_damage)
			_check_character_defeated(target)
			print("%s 攻击 %s，造成 %d 伤害" % [enemy.character_name, target.character_name, actual_damage])
		"defend":
			enemy.is_defending = true
			print("%s 进入防御状态" % enemy.character_name)
		"skill":
			var target = action.get("target", player)
			if target == null or not target.is_alive():
				target = player
			var damage = enemy.attack + randi_range(0, 5)
			var actual_damage = target.take_damage(damage)
			EventBus.damage_dealt.emit(enemy, target, actual_damage)
			_check_character_defeated(target)
			print("%s 使用技能攻击 %s，造成 %d 伤害" % [enemy.character_name, target.character_name, actual_damage])
	
	# 消耗ATB
	atb_system.consume_atb(enemy)
	_update_battle_ui()
	
	# 检查战斗结束
	_check_battle_end()

## 检查角色是否被击败
func _check_character_defeated(character: CharacterData):
	if not character.is_alive():
		EventBus.character_defeated.emit(character)
		# 如果是敌人，从列表中标记
		for enemy in enemies:
			if enemy == character:
				print("%s 被击败！" % character.character_name)
				break

## 检查战斗是否结束
func _check_battle_end():
	# 检查玩家是否死亡
	if not player.is_alive():
		current_state = BattleState.DEFEAT
		battle_result = EventBus.BattleResult.DEFEAT
		if battle_ui:
			battle_ui.show_message("战斗失败...")
		_end_battle()
		return
	
	# 检查敌人是否全部死亡
	var all_enemies_dead = true
	for enemy in enemies:
		if enemy.is_alive():
			all_enemies_dead = false
			break
	
	if all_enemies_dead:
		current_state = BattleState.VICTORY
		battle_result = EventBus.BattleResult.VICTORY
		# 发放奖励
		var rewards = _calculate_rewards()
		GameManager.player_data.add_experience(rewards["exp"])
		GameManager.player_data.gold += rewards["gold"]
		
		if battle_ui:
			battle_ui.show_victory_screen(rewards["exp"], rewards["gold"])
		
		print("战斗胜利！获得 %d 经验值， %d 金币" % [rewards["exp"], rewards["gold"]])
		_end_battle()

## 计算战斗奖励
func _calculate_rewards() -> Dictionary:
	var total_exp = 0
	var total_gold = 0
	
	for enemy in enemies:
		total_exp += 20 + enemy.level * 5
		total_gold += 15 + enemy.level * 3
	
	return {"exp": total_exp, "gold": total_gold}

## 结束战斗
func _end_battle():
	EventBus.battle_ended.emit(battle_result)
	await get_tree().create_timer(1.5).timeout
	GameManager.end_battle(battle_result)

## 更新战斗UI
func _update_battle_ui():
	if battle_ui:
		battle_ui._update_player_info()
		battle_ui._update_enemy_info(enemies)
		battle_ui.update_atb_bars()

## 更新回合显示
func _update_turn_label():
	if battle_ui:
		battle_ui.turn_label.text = "回合: %d" % turn_count

## 辅助函数
func _get_random_alive_enemy() -> CharacterData:
	var alive_enemies = enemies.filter(func(e): return e.is_alive())
	if alive_enemies.size() == 0:
		return null
	return alive_enemies[randi() % alive_enemies.size()]

func _get_average_enemy_speed() -> float:
	var total = 0.0
	var count = 0
	for enemy in enemies:
		if enemy.is_alive():
			total += enemy.speed
			count += 1
	return total / count if count > 0 else 0.0

func _find_skill(skill_id: String) -> SkillData:
	# 从技能JSON数据中查找
	var skills_data = _load_skills_data()
	if skills_data.has(skill_id):
		var data = skills_data[skill_id]
		var skill = SkillData.new()
		skill.id = data["id"]
		skill.skill_name = data["name"]
		skill.description = data["description"]
		skill.mp_cost = data["mp_cost"]
		skill.power = data["power"]
		
		# 映射技能类型
		match data["type"]:
			"physical":
				skill.skill_type = SkillData.SkillType.PHYSICAL
			"magical":
				skill.skill_type = SkillData.SkillType.MAGICAL
			"heal":
				skill.skill_type = SkillData.SkillType.HEAL
			"buff":
				skill.skill_type = SkillData.SkillType.BUFF
			"debuff":
				skill.skill_type = SkillData.SkillType.DEBUFF
		
		# 映射目标类型
		match data["target"]:
			"single_enemy":
				skill.target_type = SkillData.TargetType.SINGLE_ENEMY
			"all_enemies":
				skill.target_type = SkillData.TargetType.ALL_ENEMIES
			"self":
				skill.target_type = SkillData.TargetType.SELF
			"all_allies":
				skill.target_type = SkillData.TargetType.ALL_ALLIES
		
		skill.duration = data.get("duration", 0)
		return skill
	
	# 回退到预定义技能
	match skill_id:
		"basic_attack":
			return SkillData.create_basic_attack()
		"fireball":
			return SkillData.create_fireball()
		"heal":
			return SkillData.create_heal()
		_:
			return null

func _load_skills_data() -> Dictionary:
	var file = FileAccess.open("res://data/skills.json", FileAccess.READ)
	if file == null:
		return {}
	
	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	file.close()
	
	if error != OK:
		return {}
	
	var data = json.data
	var skills_dict = {}
	for skill in data.get("skills", []):
		skills_dict[skill["id"]] = skill
	
	return skills_dict
