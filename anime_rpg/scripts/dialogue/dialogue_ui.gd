## DialogueUI - 对话界面控制
extends Control

signal dialogue_line(display_name: String, text: String, expression: String)
signal dialogue_complete()

# UI引用
@onready var dialogue_panel: PanelContainer = $DialoguePanel
@onready var name_label: Label = $DialoguePanel/VBoxContainer/NameLabel
@onready var text_label: Label = $DialoguePanel/VBoxContainer/TextLabel
@onready var continue_indicator: Label = $DialoguePanel/ContinueIndicator

# 打字机效果参数
@export var typing_speed: float = 0.03
var is_typing: bool = false
var full_text: String = ""
var current_char_index: int = 0
var typing_timer: Timer = null

func _ready():
	# 创建打字机定时器
	typing_timer = Timer.new()
	typing_timer.wait_time = typing_speed
	typing_timer.timeout.connect(_on_typing_timer_timeout)
	add_child(typing_timer)
	
	# 初始隐藏
	dialogue_panel.visible = false
	continue_indicator.visible = false

## 显示对话行
func show_dialogue_line(display_name: String, text: String, _expression: String):
	dialogue_panel.visible = true
	name_label.text = display_name
	full_text = text
	current_char_index = 0
	text_label.text = ""
	is_typing = true
	continue_indicator.visible = false
	typing_timer.start()

## 打字机效果
func _on_typing_timer_timeout():
	if current_char_index < full_text.length():
		text_label.text += full_text[current_char_index]
		current_char_index += 1
	else:
		typing_timer.stop()
		is_typing = false
		continue_indicator.visible = true

## 跳过打字效果
func skip_typing():
	if is_typing:
		typing_timer.stop()
		text_label.text = full_text
		is_typing = false
		continue_indicator.visible = true

## 隐藏对话框
func hide_dialogue():
	dialogue_panel.visible = false
	continue_indicator.visible = false

## 输入处理
func _input(event):
	if not dialogue_panel.visible:
		return
	
	if event.is_action_pressed("confirm"):
		if is_typing:
			skip_typing()
		else:
			# 下一行对话
			DialogueManager.next_line()
	elif event.is_action_pressed("cancel"):
		# 跳过整个对话
		DialogueManager._end_dialogue()
