## GameManager - 全局游戏管理器
## 管理游戏状态、场景切换、全局数据
extends Node

# 当前游戏状态
var current_state: EventBus.GameState = EventBus.GameState.MAIN_MENU

# 玩家数据
var player_data: PlayerData = null

# 当前章节进度
var current_chapter: int = 0
var current_dialogue_progress: Dictionary = {}

# 已解锁的区域
var unlocked_areas: Array[String] = ["village"]

# 游戏开始时自动调用
func _ready():
	# 初始化玩家数据
	player_data = PlayerData.new()
	# 连接事件
	EventBus.scene_transition_started.connect(_on_scene_transition_started)
	EventBus.scene_transition_finished.connect(_on_scene_transition_finished)

## 切换游戏状态
func change_state(new_state: EventBus.GameState) -> void:
	var old_state = current_state
	current_state = new_state
	EventBus.game_state_changed.emit(old_state, new_state)

## 切换场景
func change_scene(scene_path: String, scene_name: String = "") -> void:
	EventBus.scene_transition_started.emit(scene_name)
	# 使用场景切换器实现淡入淡出
	get_tree().change_scene_to_file(scene_path)
	EventBus.scene_transition_finished.emit()

## 开始新游戏
func start_new_game() -> void:
	player_data = PlayerData.new()
	player_data.setup_initial_stats()
	change_state(EventBus.GameState.EXPLORING)
	change_scene("res://scenes/exploration/village.tscn", "village")

## 继续游戏
func continue_game() -> void:
	if SaveSystem.has_save_data():
		player_data = SaveSystem.load_game()
		change_state(EventBus.GameState.EXPLORING)
		change_scene("res://scenes/exploration/" + player_data.current_area + ".tscn", player_data.current_area)
	else:
		# 没有存档，开始新游戏
		start_new_game()

## 进入战斗
func start_battle(enemy_data: Array) -> void:
	change_state(EventBus.GameState.BATTLE)
	# 存储敌人数据并切换到战斗场景
	current_battle_enemies = enemy_data
	change_scene("res://scenes/battle/battle_scene.tscn", "battle")

## 结束战斗
func end_battle(result: EventBus.BattleResult) -> void:
	match result:
		EventBus.BattleResult.VICTORY:
			# 战斗胜利，返回探索
			change_state(EventBus.GameState.EXPLORING)
			change_scene("res://scenes/exploration/" + player_data.current_area + ".tscn", player_data.current_area)
		EventBus.BattleResult.DEFEAT:
			# 战斗失败，游戏结束
			change_state(EventBus.GameState.GAME_OVER)
			change_scene("res://scenes/ui/game_over.tscn", "game_over")
		EventBus.BattleResult.ESCAPE:
			# 逃跑成功，返回探索
			change_state(EventBus.GameState.EXPLORING)
			change_scene("res://scenes/exploration/" + player_data.current_area + ".tscn", player_data.current_area)

## 进入对话
func start_dialogue(dialogue_id: String) -> void:
	change_state(EventBus.GameState.DIALOGUE)
	# 直接调用DialogueManager
	DialogueManager.start_dialogue(dialogue_id)
	EventBus.dialogue_started.emit(dialogue_id)

## 结束对话
func end_dialogue() -> void:
	change_state(EventBus.GameState.EXPLORING)
	EventBus.dialogue_ended.emit()

## 解锁新区域
func unlock_area(area_name: String) -> void:
	if area_name not in unlocked_areas:
		unlocked_areas.append(area_name)

## 检查区域是否已解锁
func is_area_unlocked(area_name: String) -> bool:
	return area_name in unlocked_areas

# 战斗敌人数据临时存储
var current_battle_enemies: Array = []

## 场景切换回调
func _on_scene_transition_started(_scene_name: String) -> void:
	# 可以在这里添加转场动画
	pass

func _on_scene_transition_finished() -> void:
	# 转场完成
	pass

## 获取玩家数据
func get_player() -> PlayerData:
	return player_data

## 保存游戏
func save_game() -> void:
	SaveSystem.save_game(player_data)

## 加载游戏
func load_game() -> void:
	player_data = SaveSystem.load_game()
