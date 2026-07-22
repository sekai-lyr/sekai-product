## PlayerData - 玩家数据资源
## 存储玩家的所有属性和状态
class_name PlayerData
extends Resource

# 基础信息
@export var player_name: String = "勇者"
@export var level: int = 1
@export var experience: int = 0
@export var gold: int = 100

# 战斗属性
@export var hp: int = 100
@export var max_hp: int = 100
@export var mp: int = 50
@export var max_mp: int = 50
@export var attack: int = 10
@export var defense: int = 8
@export var speed: int = 12

# 位置信息
@export var current_area: String = "village"
@export var current_chapter: int = 0

# 物品和技能
@export var inventory: Array[Dictionary] = []  # [{id, name, quantity}]
@export var skills: Array[String] = []  # 技能ID列表

# 好感度系统
@export var affection_values: Dictionary = {}  # {character_id: value}

# 解锁的区域
@export var unlocked_areas: Array[String] = ["village"]

# 游戏时间
@export var play_time: float = 0.0

# 升级所需经验基础值
const BASE_EXP_PER_LEVEL: int = 100
const EXP_GROWTH_RATE: float = 1.5

## 初始化初始状态
func setup_initial_stats() -> void:
	level = 1
	hp = 100
	max_hp = 100
	mp = 50
	max_mp = 50
	attack = 10
	defense = 8
	speed = 12
	experience = 0
	gold = 100
	current_area = "village"
	current_chapter = 0
	inventory = [
		{"id": "potion", "name": "生命药水", "quantity": 3},
		{"id": "ether", "name": "魔力药水", "quantity": 2}
	]
	skills = ["basic_attack"]
	affection_values = {"haru": 0}
	unlocked_areas = ["village"]
	play_time = 0.0

## 获取升级所需经验
func get_exp_for_next_level() -> int:
	return int(BASE_EXP_PER_LEVEL * pow(EXP_GROWTH_RATE, level - 1))

## 增加经验值
func add_experience(amount: int) -> bool:
	experience += amount
	var leveled_up = false
	
	while experience >= get_exp_for_next_level():
		experience -= get_exp_for_next_level()
		level_up()
		leveled_up = true
	
	return leveled_up

## 升级处理
func level_up() -> void:
	level += 1
	# 属性成长
	var hp_gain = randi_range(8, 15)
	var mp_gain = randi_range(3, 8)
	var attack_gain = randi_range(1, 3)
	var defense_gain = randi_range(1, 2)
	var speed_gain = randi_range(0, 2)
	
	max_hp += hp_gain
	max_mp += mp_gain
	attack += attack_gain
	defense += defense_gain
	speed += speed_gain
	
	# 恢复HP和MP
	hp = max_hp
	mp = max_mp
	
	EventBus.player_leveled_up.emit(level)
	print("升级到等级 %d! HP+%d MP+%d ATK+%d DEF+%d SPD+%d" % [level, hp_gain, mp_gain, attack_gain, defense_gain, speed_gain])

## 受到伤害
func take_damage(amount: int) -> int:
	var actual_damage = max(1, amount - defense / 2)
	hp = max(0, hp - actual_damage)
	EventBus.player_damaged.emit(actual_damage)
	return actual_damage

## 恢复HP
func heal(amount: int) -> int:
	var actual_heal = min(amount, max_hp - hp)
	hp += actual_heal
	EventBus.player_healed.emit(actual_heal)
	return actual_heal

## 恢复MP
func restore_mp(amount: int) -> int:
	var actual_restore = min(amount, max_mp - mp)
	mp += actual_restore
	return actual_restore

## 消耗MP
func spend_mp(amount: int) -> bool:
	if mp >= amount:
		mp -= amount
		return true
	return false

## 检查是否存活
func is_alive() -> bool:
	return hp > 0

## 获取好感度
func get_affection(character_id: String) -> int:
	return affection_values.get(character_id, 0)

## 增加好感度
func add_affection(character_id: String, amount: int) -> void:
	if character_id not in affection_values:
		affection_values[character_id] = 0
	affection_values[character_id] += amount
	EventBus.affection_changed.emit(character_id, affection_values[character_id])

## 添加物品到背包
func add_item(item_id: String, item_name: String, quantity: int = 1) -> void:
	for item in inventory:
		if item["id"] == item_id:
			item["quantity"] += quantity
			EventBus.inventory_changed.emit()
			return
	# 物品不存在，添加新物品
	inventory.append({"id": item_id, "name": item_name, "quantity": quantity})
	EventBus.inventory_changed.emit()

## 移除物品
func remove_item(item_id: String, quantity: int = 1) -> bool:
	for i in range(inventory.size()):
		if inventory[i]["id"] == item_id:
			inventory[i]["quantity"] -= quantity
			if inventory[i]["quantity"] <= 0:
				inventory.remove_at(i)
			EventBus.inventory_changed.emit()
			return true
	return false

## 检查是否有某物品
func has_item(item_id: String, quantity: int = 1) -> bool:
	for item in inventory:
		if item["id"] == item_id:
			return item["quantity"] >= quantity
	return false

## 添加技能
func add_skill(skill_id: String) -> void:
	if skill_id not in skills:
		skills.append(skill_id)

## 解锁区域
func unlock_area(area_name: String) -> void:
	if area_name not in unlocked_areas:
		unlocked_areas.append(area_name)
