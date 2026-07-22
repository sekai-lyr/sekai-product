## ATBSystem - 即时回合制战斗系统
## Active Time Battle - 行动条系统
class_name ATBSystem
extends Node

signal action_ready(character: CharacterData)

# 参与战斗的角色
var characters: Array[CharacterData] = []

# ATB条当前值 (0-100)
var atb_values: Dictionary = {}

# 填充速度倍率
var speed_multipliers: Dictionary = {}

# 是否暂停
var is_paused: bool = false

## 初始化战斗
func setup_battle(participants: Array[CharacterData]) -> void:
	characters = participants
	atb_values.clear()
	speed_multipliers.clear()
	
	for char in characters:
		atb_values[char] = 0.0
		speed_multipliers[char] = 1.0
	is_paused = false

## 每帧更新
func _process(delta: float):
	if is_paused:
		return
	
	for char in characters:
		if not char.is_acting and char.is_alive():
			# 增加ATB值
			var fill_speed = char.speed * speed_multipliers[char] * 0.1
			atb_values[char] = min(100.0, atb_values[char] + fill_speed * delta)
			
			# 检查是否就绪
			if atb_values[char] >= 100.0:
				action_ready.emit(char)

## 消耗ATB
func consume_atb(character: CharacterData, amount: float = 100.0) -> void:
	atb_values[character] = max(0.0, atb_values[character] - amount)

## 获取ATB值
func get_atb_value(character: CharacterData) -> float:
	return atb_values.get(character, 0.0)

## 获取ATB百分比
func get_atb_percentage(character: CharacterData) -> float:
	return get_atb_value(character) / 100.0

## 暂停ATB
func pause() -> void:
	is_paused = true

## 恢复ATB
func resume() -> void:
	is_paused = false

## 重置角色ATB
func reset_character_atb(character: CharacterData) -> void:
	atb_values[character] = 0.0

## 设置速度倍率
func set_speed_multiplier(character: CharacterData, multiplier: float) -> void:
	speed_multipliers[character] = multiplier

## 检查是否所有角色ATB都满了（用于调试）
func all_ready() -> bool:
	for char in characters:
		if atb_values[char] < 100.0:
			return false
	return true
