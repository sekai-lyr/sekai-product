## NPC - NPC交互脚本
extends Area2D

# NPC配置
@export var npc_id: String = ""
@export var npc_name: String = "NPC"
@export var dialogue_id: String = ""
@export var face_direction: Vector2 = Vector2.DOWN

# 交互状态
var is_interactable: bool = true
var has_interacted: bool = false

# 视觉组件
@onready var sprite: Sprite2D = $Sprite2D
@onready var interaction_prompt: Label = $InteractionPrompt

func _ready():
	# 设置交互提示
	if interaction_prompt:
		interaction_prompt.visible = false
		interaction_prompt.text = "按空格对话"
	
	# 连接信号
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

## 交互方法（由player_controller调用）
func interact():
	if not is_interactable:
		return
	
	# 显示对话
	if dialogue_id != "":
		GameManager.start_dialogue(dialogue_id)
		has_interacted = true
		EventBus.npc_interaction_started.emit(npc_id)

## 当玩家进入交互区域
func _on_body_entered(body: Node2D):
	if body.has_method("get_player_data"):
		if interaction_prompt:
			interaction_prompt.visible = true

## 当玩家离开交互区域
func _on_body_exited(body: Node2D):
	if body.has_method("get_player_data"):
		if interaction_prompt:
			interaction_prompt.visible = false

## 设置NPC名称显示
func set_npc_name(name: String):
	npc_name = name
	# 可以在这里更新显示名称的Label

## 禁用交互
func disable_interact():
	is_interactable = false

## 启用交互
func enable_interact():
	is_interactable = true
