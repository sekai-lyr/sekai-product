## CharacterData - 角色数据资源
## 用于存储角色（包括玩家和NPC）的属性
class_name CharacterData
extends Resource

# 基础信息
@export var id: String = ""
@export var character_name: String = ""
@export var title: String = ""
@export var description: String = ""

# 战斗属性
@export var level: int = 1
@export var hp: int = 100
@export var max_hp: int = 100
@export var mp: int = 50
@export var max_mp: int = 50
@export var attack: int = 10
@export var defense: int = 8
@export var speed: int = 12

# 技能
@export var skills: Array[String] = []

# 视觉设置
@export var live2d_model_path: String = ""
@export var portrait_path: String = ""

# 是否为玩家角色
@export var is_player: bool = false

# 当前状态
var is_acting: bool = false
var current_atb: float = 0.0
var is_defending: bool = false

## 初始化角色数据
func setup(id_val: String, name_val: String, hp_val: int = 100, attack_val: int = 10, defense_val: int = 8, speed_val: int = 12) -> CharacterData:
	id = id_val
	character_name = name_val
	hp = hp_val
	max_hp = hp_val
	attack = attack_val
	defense = defense_val
	speed = speed_val
	return self

## 受到伤害
func take_damage(amount: int) -> int:
	var actual_damage = max(1, amount - defense / 2)
	if is_defending:
		actual_damage = actual_damage / 2
	hp = max(0, hp - actual_damage)
	return actual_damage

## 恢复HP
func heal(amount: int) -> int:
	var actual_heal = min(amount, max_hp - hp)
	hp += actual_heal
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

## 获取HP百分比
func get_hp_percentage() -> float:
	return float(hp) / float(max_hp) if max_hp > 0 else 0.0

## 获取MP百分比
func get_mp_percentage() -> float:
	return float(mp) / float(max_mp) if max_mp > 0 else 0.0

## 重置ATB
func reset_atb() -> void:
	current_atb = 0.0
	is_acting = false

## 增加ATB
func increase_atb(delta: float, speed_multiplier: float = 1.0) -> void:
	if not is_acting:
		current_atb += delta * speed * speed_multiplier * 0.1

## 检查ATB是否就绪
func is_atb_ready() -> bool:
	return current_atb >= 100.0 and not is_acting
