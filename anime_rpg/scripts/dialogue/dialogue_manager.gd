## DialogueManager - 对话系统管理
extends Node

signal dialogue_line(display_name: String, text: String, expression: String)
signal dialogue_options(options: Array[String])
signal dialogue_complete()

# 对话UI场景
var dialogue_ui_scene = preload("res://scenes/dialogue/dialogue_scene.tscn")
var current_dialogue_ui: Control = null

# 当前对话数据
var current_dialogue: Dictionary = {}
var current_line_index: int = 0
var is_dialogue_active: bool = false

# 对话数据缓存
var dialogue_cache: Dictionary = {}

func _ready():
	_load_all_dialogues()

## 加载所有对话数据
func _load_all_dialogues():
	var dialogue_files = ["prologue", "chapter1", "chapter2"]
	for file_name in dialogue_files:
		var path = "res://data/dialogues/%s.json" % file_name
		if FileAccess.file_exists(path):
			var file = FileAccess.open(path, FileAccess.READ)
			if file:
				var json = JSON.new()
				var error = json.parse(file.get_as_text())
				if error == OK:
					dialogue_cache[file_name] = json.data
				file.close()

## 开始对话
func start_dialogue(dialogue_id: String) -> void:
	# 查找对话数据
	var found = false
	for chapter_key in dialogue_cache:
		var chapter = dialogue_cache[chapter_key]
		if chapter.has("dialogues"):
			for dialogue in chapter["dialogues"]:
				if dialogue.get("id") == dialogue_id:
					current_dialogue = dialogue
					current_line_index = 0
					is_dialogue_active = true
					found = true
					break
		if found:
			break
	
	if not found:
		print("对话未找到: " + dialogue_id)
		return
	
	# 创建对话UI
	_create_dialogue_ui()
	
	# 显示第一行
	_show_current_line()

## 创建对话UI
func _create_dialogue_ui():
	# 移除旧的UI
	if current_dialogue_ui:
		current_dialogue_ui.queue_free()
	
	# 创建新的UI
	current_dialogue_ui = dialogue_ui_scene.instantiate()
	
	# 连接信号
	current_dialogue_ui.dialogue_line.connect(_on_dialogue_line)
	current_dialogue_ui.dialogue_complete.connect(_on_dialogue_complete)
	
	# 添加到场景树
	var canvas_layer = CanvasLayer.new()
	canvas_layer.layer = 100
	get_tree().current_scene.add_child(canvas_layer)
	canvas_layer.add_child(current_dialogue_ui)

## 对话行显示回调
func _on_dialogue_line(display_name: String, text: String, expression: String):
	# 这个回调在对话UI内部处理
	pass

## 对话完成回调
func _on_dialogue_complete():
	_end_dialogue()

## 显示当前对话行
func _show_current_line():
	if not current_dialogue.has("dialogues"):
		return
	
	var dialogues = current_dialogue["dialogues"]
	if current_line_index >= dialogues.size():
		_end_dialogue()
		return
	
	var line = dialogues[current_line_index]
	var display_name = line.get("speaker", "")
	var text = line.get("text", "")
	var expression = line.get("expression", "idle")
	
	# 发送信号
	dialogue_line.emit(display_name, text, expression)
	
	# 更新对话UI
	if current_dialogue_ui:
		current_dialogue_ui.show_dialogue_line(display_name, text, expression)

## 下一行对话
func next_line() -> void:
	if not is_dialogue_active:
		return
	
	current_line_index += 1
	_show_current_line()

## 选择选项
func select_option(option_index: int) -> void:
	EventBus.dialogue_option_selected.emit(option_index)
	next_line()

## 结束对话
func _end_dialogue() -> void:
	is_dialogue_active = false
	current_dialogue = {}
	current_line_index = 0
	
	# 移除对话UI
	if current_dialogue_ui:
		current_dialogue_ui.queue_free()
		current_dialogue_ui = null
	
	dialogue_complete.emit()
	GameManager.end_dialogue()

## 检查对话是否进行中
func is_active() -> bool:
	return is_dialogue_active

## 获取当前对话ID
func get_current_dialogue_id() -> String:
	return current_dialogue.get("id", "")
