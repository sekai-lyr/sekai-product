## SaveSystem - 存档系统
## 负责游戏数据的保存和加载
extends Node

const SAVE_DIR = "user://saves/"
const SAVE_FILE = "save_data.json"
const AUTO_SAVE_FILE = "auto_save.json"

## 初始化存档目录
func _ready():
	# 确保存档目录存在
	DirAccess.make_dir_recursive_absolute(SAVE_DIR)

## 保存游戏数据
func save_game(player_data: PlayerData, slot: int = 0) -> bool:
	var save_data = _serialize_player_data(player_data)
	var file_path = SAVE_DIR + SAVE_FILE if slot == 0 else SAVE_DIR + "save_%d.json" % slot
	
	var file = FileAccess.open(file_path, FileAccess.WRITE)
	if file == null:
		push_error("无法保存游戏: " + file_path)
		return false
	
	file.store_string(JSON.stringify(save_data, "\t"))
	file.close()
	print("游戏已保存到: " + file_path)
	return true

## 自动保存
func auto_save(player_data: PlayerData) -> bool:
	var save_data = _serialize_player_data(player_data)
	var file_path = SAVE_DIR + AUTO_SAVE_FILE
	
	var file = FileAccess.open(file_path, FileAccess.WRITE)
	if file == null:
		push_error("自动保存失败: " + file_path)
		return false
	
	file.store_string(JSON.stringify(save_data, "\t"))
	file.close()
	print("自动保存完成")
	return true

## 加载游戏数据
func load_game(slot: int = 0) -> PlayerData:
	var file_path = SAVE_DIR + SAVE_FILE if slot == 0 else SAVE_DIR + "save_%d.json" % slot
	
	if not FileAccess.file_exists(file_path):
		push_warning("存档不存在: " + file_path)
		return PlayerData.new()
	
	var file = FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		push_error("无法读取存档: " + file_path)
		return PlayerData.new()
	
	var json_string = file.get_as_text()
	file.close()
	
	var json = JSON.new()
	var error = json.parse(json_string)
	if error != OK:
		push_error("存档数据格式错误")
		return PlayerData.new()
	
	var save_data = json.data
	return _deserialize_player_data(save_data)

## 检查是否有存档
func has_save_data(slot: int = 0) -> bool:
	var file_path = SAVE_DIR + SAVE_FILE if slot == 0 else SAVE_DIR + "save_%d.json" % slot
	return FileAccess.file_exists(file_path)

## 删除存档
func delete_save(slot: int = 0) -> bool:
	var file_path = SAVE_DIR + SAVE_FILE if slot == 0 else SAVE_DIR + "save_%d.json" % slot
	if FileAccess.file_exists(file_path):
		DirAccess.remove_absolute(file_path)
		return true
	return false

## 序列化玩家数据
func _serialize_player_data(player_data: PlayerData) -> Dictionary:
	return {
		"version": "1.0",
		"player_name": player_data.player_name,
		"level": player_data.level,
		"hp": player_data.hp,
		"max_hp": player_data.max_hp,
		"mp": player_data.mp,
		"max_mp": player_data.max_mp,
		"attack": player_data.attack,
		"defense": player_data.defense,
		"speed": player_data.speed,
		"experience": player_data.experience,
		"gold": player_data.gold,
		"current_area": player_data.current_area,
		"current_chapter": player_data.current_chapter,
		"inventory": player_data.inventory,
		"skills": player_data.skills,
		"affection_values": player_data.affection_values,
		"unlocked_areas": player_data.unlocked_areas,
		"play_time": player_data.play_time,
		"save_timestamp": Time.get_unix_time_from_system()
	}

## 反序列化玩家数据
func _deserialize_player_data(data: Dictionary) -> PlayerData:
	var player_data = PlayerData.new()
	
	player_data.player_name = data.get("player_name", "勇者")
	player_data.level = data.get("level", 1)
	player_data.hp = data.get("hp", 100)
	player_data.max_hp = data.get("max_hp", 100)
	player_data.mp = data.get("mp", 50)
	player_data.max_mp = data.get("max_mp", 50)
	player_data.attack = data.get("attack", 10)
	player_data.defense = data.get("defense", 8)
	player_data.speed = data.get("speed", 12)
	player_data.experience = data.get("experience", 0)
	player_data.gold = data.get("gold", 0)
	player_data.current_area = data.get("current_area", "village")
	player_data.current_chapter = data.get("current_chapter", 0)
	player_data.inventory = data.get("inventory", [])
	player_data.skills = data.get("skills", [])
	player_data.affection_values = data.get("affection_values", {})
	player_data.unlocked_areas = data.get("unlocked_areas", ["village"])
	player_data.play_time = data.get("play_time", 0.0)
	
	return player_data
