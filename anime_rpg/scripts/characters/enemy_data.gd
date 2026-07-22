## EnemyData - 敌人数据资源
class_name EnemyData
extends Resource

# 基础信息
@export var id: String = ""
@export var enemy_name: String = ""
@export var description: String = ""

# 战斗属性
@export var level: int = 1
@export var hp: int = 50
@export var max_hp: int = 50
@export var mp: int = 20
@export var max_mp: int = 20
@export var attack: int = 8
@export var defense: int = 5
@export var speed: int = 10

# 奖励
@export var exp_reward: int = 20
@export var gold_reward: int = 15
@export var drop_items: Array[Dictionary] = []  # [{id, name, rate}]

# 技能
@export var skills: Array[String] = []

# AI行为权重
@export var aggro_rate: float = 0.7  # 攻击倾向
@export var defend_rate: float = 0.2  # 防御倾向
@export var skill_rate: float = 0.1   # 使用技能倾向

# 视觉设置
@export var sprite_path: String = ""
@export var battle_position: Vector2 = Vector2(0, 0)

# 当前状态
var current_hp: int = 0
var is_defending: bool = false

## 初始化敌人数据
func setup_enemy(id_val: String, name_val: String, level_val: int = 1) -> EnemyData:
	id = id_val
	enemy_name = name_val
	level = level_val
	
	# 根据等级调整属性
	var level_multiplier = 1.0 + (level - 1) * 0.15
	hp = int(50 * level_multiplier)
	max_hp = hp
	mp = int(20 * level_multiplier)
	max_mp = mp
	attack = int(8 * level_multiplier)
	defense = int(5 * level_multiplier)
	speed = int(10 * level_multiplier)
	
	exp_reward = int(20 * level_multiplier)
	gold_reward = int(15 * level_multiplier)
	
	current_hp = hp
	return self

## 受到伤害
func take_damage(amount: int) -> int:
	var actual_damage = max(1, amount - defense / 2)
	if is_defending:
		actual_damage = actual_damage / 2
	current_hp = max(0, current_hp - actual_damage)
	return actual_damage

## 恢复HP
func heal(amount: int) -> int:
	var actual_heal = min(amount, max_hp - current_hp)
	current_hp += actual_heal
	return actual_heal

## 检查是否存活
func is_alive() -> bool:
	return current_hp > 0

## 获取HP百分比
func get_hp_percentage() -> float:
	return float(current_hp) / float(max_hp) if max_hp > 0 else 0.0

## AI决策：选择行动
func decide_action(targets: Array[CharacterData]) -> Dictionary:
	var roll = randf()
	
	if roll < aggro_rate:
		# 攻击
		var target = targets[randi() % targets.size()]
		return {"type": "attack", "target": target}
	elif roll < aggro_rate + defend_rate:
		# 防御
		return {"type": "defend"}
	elif roll < aggro_rate + defend_rate + skill_rate and skills.size() > 0:
		# 使用技能
		var skill_id = skills[randi() % skills.size()]
		var target = targets[randi() % targets.size()]
		return {"type": "skill", "skill_id": skill_id, "target": target}
	else:
		# 默认攻击
		var target = targets[randi() % targets.size()]
		return {"type": "attack", "target": target}
