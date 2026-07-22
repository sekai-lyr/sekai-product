## SkillData - 技能数据资源
class_name SkillData
extends Resource

# 技能类型枚举
enum SkillType { PHYSICAL, MAGICAL, HEAL, BUFF, DEBUFF }
enum TargetType { SINGLE_ENEMY, ALL_ENEMIES, SELF, ALL_ALLIES, SINGLE_ALLY }

# 基础信息
@export var id: String = ""
@export var skill_name: String = ""
@export var description: String = ""
@export var mp_cost: int = 0

# 效果数值
@export var power: int = 0
@export var duration: int = 0  # 持续回合数

# 类型
@export var skill_type: SkillType = SkillType.PHYSICAL
@export var target_type: TargetType = TargetType.SINGLE_ENEMY

# 学习条件
@export var required_level: int = 1

# 视觉效果
@export var effect_scene: String = ""
@export var sound_effect: String = ""

## 初始化技能数据
func setup(id_val: String, name_val: String, type: SkillType, mp: int, pwr: int) -> SkillData:
	id = id_val
	skill_name = name_val
	skill_type = type
	mp_cost = mp
	power = pwr
	return self

## 检查是否可以使用
func can_use(user: CharacterData) -> bool:
	return user.mp >= mp_cost

## 获取伤害/治疗量
func calculate_effect(user: CharacterData, target: CharacterData) -> int:
	var base_value = power
	
	match skill_type:
		SkillType.PHYSICAL:
			# 物理技能：基于攻击力
			base_value = power + user.attack * 0.5
		SkillType.MAGICAL:
			# 魔法技能：基于等级
			base_value = power + user.level * 2
		SkillType.HEAL:
			# 治疗技能
			base_value = power + user.level * 3
		SkillType.BUFF, SkillType.DEBUFF:
			# 增益/减益
			base_value = power
	
	return int(base_value)

## 应用技能效果
func apply_effect(user: CharacterData, targets: Array[CharacterData]) -> Array[Dictionary]:
	var results = []
	
	for target in targets:
		match skill_type:
			SkillType.PHYSICAL, SkillType.MAGICAL:
				var damage = calculate_effect(user, target)
				var actual_damage = target.take_damage(damage)
				results.append({
					"target": target,
					"type": "damage",
					"value": actual_damage
				})
			SkillType.HEAL:
				var heal_amount = calculate_effect(user, target)
				var actual_heal = target.heal(heal_amount)
				results.append({
					"target": target,
					"type": "heal",
					"value": actual_heal
				})
			SkillType.BUFF:
				results.append({
					"target": target,
					"type": "buff",
					"stat": "attack",
					"value": power,
					"duration": duration
				})
			SkillType.DEBUFF:
				results.append({
					"target": target,
					"type": "debuff",
					"stat": "defense",
					"value": power,
					"duration": duration
				})
	
	# 消耗MP
	user.spend_mp(mp_cost)
	
	return results

## 获取所有目标
func get_targets(user: CharacterData, all_enemies: Array[CharacterData], all_allies: Array[CharacterData]) -> Array[CharacterData]:
	match target_type:
		TargetType.SINGLE_ENEMY:
			return [all_enemies[0]] if all_enemies.size() > 0 else []
		TargetType.ALL_ENEMIES:
			return all_enemies
		TargetType.SELF:
			return [user]
		TargetType.ALL_ALLIES:
			return all_allies
		TargetType.SINGLE_ALLY:
			return [all_allies[0]] if all_allies.size() > 0 else []
		_:
			return []

# 预定义技能
static func create_basic_attack() -> SkillData:
	var skill = SkillData.new()
	skill.id = "basic_attack"
	skill.skill_name = "普通攻击"
	skill.description = "基础物理攻击"
	skill.mp_cost = 0
	skill.power = 10
	skill.skill_type = SkillType.PHYSICAL
	skill.target_type = TargetType.SINGLE_ENEMY
	return skill

static func create_fireball() -> SkillData:
	var skill = SkillData.new()
	skill.id = "fireball"
	skill.skill_name = "火球术"
	skill.description = "发射火球攻击敌人"
	skill.mp_cost = 15
	skill.power = 30
	skill.skill_type = SkillType.MAGICAL
	skill.target_type = TargetType.SINGLE_ENEMY
	return skill

static func create_heal() -> SkillData:
	var skill = SkillData.new()
	skill.id = "heal"
	skill.skill_name = "治愈术"
	skill.description = "恢复自身HP"
	skill.mp_cost = 20
	skill.power = 50
	skill.skill_type = SkillType.HEAL
	skill.target_type = TargetType.SELF
	return skill
