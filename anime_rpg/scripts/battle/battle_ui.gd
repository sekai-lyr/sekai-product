## BattleUI - 战斗界面控制
extends Control

# UI引用
@onready var player_hp_label: Label = $PlayerInfo/HPLabel
@onready var player_mp_label: Label = $PlayerInfo/MPLabel
@onready var player_hp_bar: ProgressBar = $PlayerInfo/HPBar
@onready var player_mp_bar: ProgressBar = $PlayerInfo/MPBar
@onready var player_atb_bar: ProgressBar = $PlayerInfo/ATBBar

@onready var enemy_info_container: VBoxContainer = $EnemyInfoContainer

@onready var action_menu: PanelContainer = $ActionMenu
@onready var attack_button: Button = $ActionMenu/VBoxContainer/AttackButton
@onready var skill_button: Button = $ActionMenu/VBoxContainer/SkillButton
@onready var defend_button: Button = $ActionMenu/VBoxContainer/DefendButton
@onready var item_button: Button = $ActionMenu/VBoxContainer/ItemButton
@onready var escape_button: Button = $ActionMenu/VBoxContainer/EscapeButton

@onready var message_label: Label = $MessageLabel
@onready var turn_label: Label = $TurnLabel

# 目标选择UI
@onready var target_selection_panel: PanelContainer = $TargetSelectionPanel
@onready var target_container: VBoxContainer = $TargetSelectionPanel/VBoxContainer

# 技能选择UI
@onready var skill_selection_panel: PanelContainer = $SkillSelectionPanel
@onready var skill_container: VBoxContainer = $SkillSelectionPanel/VBoxContainer
@onready var skill_close_button: Button = $SkillSelectionPanel/VBoxContainer/CloseButton

# 道具选择UI
@onready var item_selection_panel: PanelContainer = $ItemSelectionPanel
@onready var item_container: VBoxContainer = $ItemSelectionPanel/VBoxContainer
@onready var item_close_button: Button = $ItemSelectionPanel/VBoxContainer/CloseButton

# 胜利界面
@onready var victory_panel: PanelContainer = $VictoryPanel
@onready var victory_exp_label: Label = $VictoryPanel/VBoxContainer/ExpLabel
@onready var victory_gold_label: Label = $VictoryPanel/VBoxContainer/GoldLabel
@onready var victory_continue_button: Button = $VictoryPanel/VBoxContainer/ContinueButton

# 战斗管理器引用
var battle_manager: Node = null

func _ready():
	# 连接按钮信号
	attack_button.pressed.connect(_on_attack_pressed)
	skill_button.pressed.connect(_on_skill_pressed)
	defend_button.pressed.connect(_on_defend_pressed)
	item_button.pressed.connect(_on_item_pressed)
	escape_button.pressed.connect(_on_escape_pressed)
	skill_close_button.pressed.connect(_on_skill_close_pressed)
	item_close_button.pressed.connect(_on_item_close_pressed)
	victory_continue_button.pressed.connect(_on_victory_continue_pressed)
	
	# 隐藏所有面板
	action_menu.visible = false
	target_selection_panel.visible = false
	skill_selection_panel.visible = false
	item_selection_panel.visible = false
	victory_panel.visible = false
	
	# 获取BattleManager引用
	battle_manager = get_node_or_null("../BattleManager")
	
	# 连接事件
	EventBus.battle_started.connect(_on_battle_started)
	EventBus.battle_ended.connect(_on_battle_ended)
	EventBus.damage_dealt.connect(_on_damage_dealt)

func _on_battle_started(enemies: Array):
	_update_enemy_info(enemies)
	_update_player_info()
	turn_label.text = "回合: 1"

func _on_battle_ended(_result: EventBus.BattleResult):
	hide_all_menus()

func _on_damage_dealt(attacker: CharacterData, target: CharacterData, damage: int):
	_show_damage_number(target, damage)
	_update_player_info()
	if battle_manager:
		_update_enemy_info(battle_manager.enemies)

## 显示玩家行动菜单
func show_action_menu():
	hide_all_menus()
	action_menu.visible = true
	attack_button.grab_focus()

## 隐藏玩家行动菜单
func hide_action_menu():
	action_menu.visible = false

## 隐藏所有菜单
func hide_all_menus():
	action_menu.visible = false
	target_selection_panel.visible = false
	skill_selection_panel.visible = false
	item_selection_panel.visible = false

## 显示目标选择
func show_target_selection():
	hide_all_menus()
	target_selection_panel.visible = true
	_populate_target_list()

## 隐藏目标选择
func hide_target_selection():
	target_selection_panel.visible = false

## 填充目标列表
func _populate_target_list():
	# 清除旧的目标
	for child in target_container.get_children():
		if child is Button:
			child.queue_free()
	
	# 添加存活的敌人作为目标
	if battle_manager:
		for enemy in battle_manager.enemies:
			if enemy.is_alive():
				var btn = Button.new()
				btn.text = "%s (HP: %d/%d)" % [enemy.character_name, enemy.hp, enemy.max_hp]
				btn.custom_minimum_size = Vector2(300, 40)
				btn.pressed.connect(_on_target_selected.bind(enemy))
				target_container.add_child(btn)
	
	# 添加取消按钮
	var cancel_btn = Button.new()
	cancel_btn.text = "取消"
	cancel_btn.custom_minimum_size = Vector2(300, 40)
	cancel_btn.pressed.connect(_on_target_cancel)
	target_container.add_child(cancel_btn)

## 目标选择完成
func _on_target_selected(target: CharacterData):
	if battle_manager:
		battle_manager.on_target_selected(target)

## 取消目标选择
func _on_target_cancel():
	if battle_manager:
		battle_manager.cancel_target_selection()

## 显示技能选择
func show_skill_selection():
	hide_all_menus()
	skill_selection_panel.visible = true
	_populate_skill_list()

## 填充技能列表
func _populate_skill_list():
	# 清除旧的技能
	for child in skill_container.get_children():
		if child is Button:
			child.queue_free()
	
	# 添加玩家已学技能
	if battle_manager and battle_manager.player:
		var player = battle_manager.player
		var skills_data = _load_skills_data()
		
		for skill_id in player.skills:
			if skills_data.has(skill_id):
				var data = skills_data[skill_id]
				var btn = Button.new()
				btn.text = "%s (MP: %d)" % [data["name"], data["mp_cost"]]
				btn.custom_minimum_size = Vector2(300, 40)
				
				# MP不足时禁用
				if player.mp < data["mp_cost"]:
					btn.disabled = true
					btn.text += " [MP不足]"
				
				btn.pressed.connect(_on_skill_selected.bind(skill_id))
				skill_container.add_child(btn)
	
	# 添加关闭按钮（已在场景中）

## 技能选择完成
func _on_skill_selected(skill_id: String):
	skill_selection_panel.visible = false
	if battle_manager:
		# 检查是否需要目标选择
		var skill = battle_manager._find_skill(skill_id)
		if skill and skill.target_type == SkillData.TargetType.SINGLE_ENEMY:
			battle_manager.enter_target_selection("skill", skill_id)
		else:
			battle_manager.execute_player_action("skill", null, skill_id)

## 关闭技能选择
func _on_skill_close_pressed():
	skill_selection_panel.visible = false
	show_action_menu()

## 显示道具选择
func show_item_selection():
	hide_all_menus()
	item_selection_panel.visible = true
	_populate_item_list()

## 填充道具列表
func _populate_item_list():
	# 清除旧的道具
	for child in item_container.get_children():
		if child is Button:
			child.queue_free()
	
	# 添加背包中的消耗品
	if GameManager.player_data:
		var items = GameManager.player_data.inventory
		for item in items:
			var btn = Button.new()
			btn.text = "%s x%d" % [item["name"], item["quantity"]]
			btn.custom_minimum_size = Vector2(300, 40)
			btn.pressed.connect(_on_item_selected.bind(item["id"]))
			item_container.add_child(btn)
		
		if items.size() == 0:
			var label = Label.new()
			label.text = "没有可用的道具"
			label.horizontal_alignment = 1
			item_container.add_child(label)

## 道具选择完成
func _on_item_selected(item_id: String):
	item_selection_panel.visible = false
	if battle_manager:
		# 使用道具（简化：直接对玩家使用）
		var target = battle_manager.player
		battle_manager.execute_player_action("item", target)

## 关闭道具选择
func _on_item_close_pressed():
	item_selection_panel.visible = false
	show_action_menu()

## 显示胜利界面
func show_victory_screen(exp: int, gold: int):
	hide_all_menus()
	victory_panel.visible = true
	victory_exp_label.text = "获得经验值: %d" % exp
	victory_gold_label.text = "获得金币: %d" % gold

## 胜利界面继续
func _on_victory_continue_pressed():
	victory_panel.visible = false

## 更新玩家信息
func _update_player_info():
	if battle_manager and battle_manager.player:
		var p = battle_manager.player
		player_hp_label.text = "HP: %d / %d" % [p.hp, p.max_hp]
		player_mp_label.text = "MP: %d / %d" % [p.mp, p.max_mp]
		player_hp_bar.value = p.get_hp_percentage() * 100
		player_mp_bar.value = p.get_mp_percentage() * 100

## 更新ATB条
func update_atb_bars():
	if battle_manager and battle_manager.atb_system:
		var player_atb = battle_manager.atb_system.get_atb_value(battle_manager.player)
		player_atb_bar.value = player_atb

## 更新敌人信息
func _update_enemy_info(enemies: Array):
	for child in enemy_info_container.get_children():
		child.queue_free()
	
	for i in range(enemies.size()):
		var enemy = enemies[i]
		if not enemy.is_alive():
			continue
		
		var enemy_panel = PanelContainer.new()
		var hbox = HBoxContainer.new()
		
		var name_label = Label.new()
		name_label.text = enemy.character_name
		name_label.custom_minimum_size.x = 100
		
		var hp_bar = ProgressBar.new()
		hp_bar.custom_minimum_size.x = 150
		hp_bar.max_value = enemy.max_hp
		hp_bar.value = enemy.hp
		
		var hp_label = Label.new()
		hp_label.text = "%d/%d" % [enemy.hp, enemy.max_hp]
		
		hbox.add_child(name_label)
		hbox.add_child(hp_bar)
		hbox.add_child(hp_label)
		enemy_panel.add_child(hbox)
		enemy_info_container.add_child(enemy_panel)

## 显示伤害数字
func _show_damage_number(target: CharacterData, damage: int):
	var damage_label = Label.new()
	damage_label.text = str(damage)
	damage_label.position = Vector2(randf_range(100, 300), randf_range(200, 400))
	damage_label.add_theme_font_size_override("font_size", 24)
	damage_label.add_theme_color_override("font_color", Color.RED)
	add_child(damage_label)
	
	var tween = create_tween()
	tween.tween_property(damage_label, "position:y", damage_label.position.y - 50, 0.5)
	tween.parallel().tween_property(damage_label, "modulate:a", 0.0, 0.5)
	tween.tween_callback(damage_label.queue_free)

## 显示消息
func show_message(text: String, duration: float = 2.0):
	message_label.text = text
	message_label.visible = true
	await get_tree().create_timer(duration).timeout
	message_label.visible = false

## 按钮回调
func _on_attack_pressed():
	hide_action_menu()
	if battle_manager:
		# 进入目标选择
		battle_manager.enter_target_selection("attack")

func _on_skill_pressed():
	show_skill_selection()

func _on_defend_pressed():
	hide_action_menu()
	if battle_manager:
		battle_manager.execute_player_action("defend")

func _on_item_pressed():
	show_item_selection()

func _on_escape_pressed():
	hide_action_menu()
	if battle_manager:
		battle_manager.execute_player_action("escape")

## 加载技能数据
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
