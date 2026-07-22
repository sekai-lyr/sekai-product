## EncounterSystem - 随机遇敌系统
extends Node

signal encounter_triggered(enemy_group: String)

# 遇敌配置
@export var encounter_rate: float = 0.1  # 每步遇敌概率
@export var min_steps: int = 5  # 最少步数才可能遇敌
@export var encounter_zone: String = ""  # 当前区域的遇敌类型

# 步数计数
var step_count: int = 0
var steps_since_last_encounter: int = 0

# 敌人组数据
var enemy_groups: Dictionary = {}

func _ready():
	_load_enemy_groups()

## 加载敌人组数据
func _load_enemy_groups():
	var file = FileAccess.open("res://data/enemies.json", FileAccess.READ)
	if file == null:
		return
	
	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	file.close()
	
	if error != OK:
		return
	
	var data = json.data
	enemy_groups = data.get("enemy_groups", {})

## 设置遇敌区域
func set_encounter_zone(zone: String, rate: float = 0.1):
	encounter_zone = zone
	encounter_rate = rate
	step_count = 0
	steps_since_last_encounter = 0

## 记录一步（由player_controller调用）
func on_step():
	step_count += 1
	steps_since_last_encounter += 1
	
	# 至少走够最小步数
	if steps_since_last_encounter < min_steps:
		return
	
	# 检查是否遇敌
	if randf() < encounter_rate:
		_trigger_encounter()

## 触发遇敌
func _trigger_encounter():
	steps_since_last_encounter = 0
	
	# 选择敌人组
	var group_key = _select_enemy_group()
	if group_key == "":
		return
	
	encounter_triggered.emit(group_key)
	EventBus.random_encounter_triggered.emit(group_key)

## 选择敌人组
func _select_enemy_group() -> String:
	# 根据区域选择可能的敌人组
	var possible_groups: Array[String] = []
	
	match encounter_zone:
		"field":
			possible_groups = ["field_easy", "field_normal", "field_hard"]
		"dungeon":
			possible_groups = ["dungeon_easy"]
		_:
			return ""
	
	if possible_groups.size() == 0:
		return ""
	
	# 随机选择一个组
	return possible_groups[randi() % possible_groups.size()]

## 获取敌人组数据
func get_enemy_group_data(group_key: String) -> Array[EnemyData]:
	if not enemy_groups.has(group_key):
		return []
	
	var group = enemy_groups[group_key]
	var enemies: Array[EnemyData] = []
	
	# 加载敌人定义
	var enemy_definitions = _load_enemy_definitions()
	
	for enemy_id in group:
		if enemy_definitions.has(enemy_id):
			var data = enemy_definitions[enemy_id]
			var enemy = EnemyData.new()
			enemy.setup_enemy(data["id"], data["name"], data["level"])
			enemy.hp = data["hp"]
			enemy.max_hp = data["hp"]
			enemy.attack = data["attack"]
			enemy.defense = data["defense"]
			enemy.speed = data["speed"]
			enemies.append(enemy)
	
	return enemies

## 加载敌人定义
func _load_enemy_definitions() -> Dictionary:
	var file = FileAccess.open("res://data/enemies.json", FileAccess.READ)
	if file == null:
		return {}
	
	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	file.close()
	
	if error != OK:
		return {}
	
	var data = json.data
	var enemies_dict = {}
	for enemy in data.get("enemies", []):
		enemies_dict[enemy["id"]] = enemy
	
	return enemies_dict

## 重置计数器
func reset():
	step_count = 0
	steps_since_last_encounter = 0
