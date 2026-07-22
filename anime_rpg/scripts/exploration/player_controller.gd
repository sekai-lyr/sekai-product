## PlayerController - 玩家移动控制
extends CharacterBody2D

@export var move_speed: float = 200.0

# 动画相关
@onready var animated_sprite: AnimatedSprite2D = $AnimatedSprite2D
@onready var interaction_area: Area2D = $InteractionArea

# 遇敌系统引用
var encounter_system: Node = null

# 移动相关
var last_direction: Vector2 = Vector2.DOWN
var step_count: int = 0
var min_step_distance: float = 32.0  # 最小步距
var last_position: Vector2 = Vector2.ZERO

# 交互提示UI
var interaction_prompt_label: Label = null

func _ready():
	# 初始化玩家位置
	if GameManager.player_data:
		var saved_pos = GameManager.player_data.get("position", null)
		if saved_pos:
			global_position = saved_pos
	
	last_position = global_position
	
	# 创建遇敌系统
	encounter_system = preload("res://scripts/exploration/encounter_system.gd").new()
	add_child(encounter_system)
	encounter_system.encounter_triggered.connect(_on_encounter_triggered)
	
	# 设置遇敌区域
	_setup_encounter_zone()
	
	# 创建交互提示UI
	_create_interaction_prompt()

func _setup_encounter_zone():
	# 根据当前区域设置遇敌参数
	var area = GameManager.player_data.current_area if GameManager.player_data else "village"
	match area:
		"field":
			encounter_system.set_encounter_zone("field", 0.08)
		"dungeon":
			encounter_system.set_encounter_zone("dungeon", 0.05)
		_:
			# 村庄等安全区域不遇敌
			encounter_system.set_encounter_zone("", 0.0)

func _create_interaction_prompt():
	# 创建交互提示Label
	interaction_prompt_label = Label.new()
	interaction_prompt_label.text = "按空格交互"
	interaction_prompt_label.visible = false
	interaction_prompt_label.horizontal_alignment = 1
	interaction_prompt_label.add_theme_font_size_override("font_size", 14)
	
	# 添加到CanvasLayer
	var canvas_layer = CanvasLayer.new()
	canvas_layer.layer = 10
	add_child(canvas_layer)
	canvas_layer.add_child(interaction_prompt_label)

func _physics_process(delta: float):
	# 获取移动输入
	var input_vector = Vector2.ZERO
	input_vector.x = Input.get_axis("move_left", "move_right")
	input_vector.y = Input.get_axis("move_up", "move_down")
	
	# 归一化对角线移动
	if input_vector.length() > 0:
		input_vector = input_vector.normalized()
		last_direction = input_vector
	
	# 设置速度
	velocity = input_vector * move_speed
	
	# 移动
	move_and_slide()
	
	# 更新动画
	_update_animation(input_vector)
	
	# 检查步数
	_check_step_count()
	
	# 检查交互
	_check_interaction()
	
	# 更新交互提示位置
	_update_interaction_prompt()

func _update_animation(direction: Vector2):
	if direction == Vector2.ZERO:
		animated_sprite.play("idle")
	else:
		if abs(direction.x) > abs(direction.y):
			if direction.x > 0:
				animated_sprite.play("walk_right")
			else:
				animated_sprite.play("walk_left")
		else:
			if direction.y > 0:
				animated_sprite.play("walk_down")
			else:
				animated_sprite.play("walk_up")

func _check_step_count():
	# 计算移动距离
	var distance = global_position.distance_to(last_position)
	if distance >= min_step_distance:
		step_count += 1
		last_position = global_position
		
		# 通知遇敌系统
		if encounter_system:
			encounter_system.on_step()

func _check_interaction():
	var nearest_interactable = _get_nearest_interactable()
	
	if nearest_interactable:
		if interaction_prompt_label:
			interaction_prompt_label.visible = true
			interaction_prompt_label.global_position = nearest_interactable.global_position + Vector2(-50, -40)
	else:
		if interaction_prompt_label:
			interaction_prompt_label.visible = false

func _get_nearest_interactable() -> Node2D:
	var bodies = interaction_area.get_overlapping_bodies()
	var nearest = null
	var nearest_distance = 50.0  # 最大交互距离
	
	for body in bodies:
		if body.has_method("interact"):
			var distance = global_position.distance_to(body.global_position)
			if distance < nearest_distance:
				nearest = body
				nearest_distance = distance
	
	return nearest

func _update_interaction_prompt():
	# 已在_check_interaction中处理
	pass

func _input(event):
	if event.is_action_pressed("confirm"):
		var nearest = _get_nearest_interactable()
		if nearest:
			nearest.interact()

func _on_encounter_triggered(enemy_group: String):
	# 获取敌人数据
	var enemies = encounter_system.get_enemy_group_data(enemy_group)
	if enemies.size() > 0:
		# 保存当前位置
		GameManager.player_data.set("position", global_position)
		# 进入战斗
		GameManager.start_battle(enemies)

func get_player_data() -> PlayerData:
	return GameManager.player_data
