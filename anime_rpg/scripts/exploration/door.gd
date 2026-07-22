## Door - 传送点/门脚本
extends Area2D

# 传送配置
@export var target_scene: String = ""  # 目标场景路径
@export var target_area: String = ""  # 目标区域名称
@export var door_name: String = "门"

# 视觉组件
@onready var interaction_prompt: Label = $InteractionPrompt

func _ready():
	# 设置交互提示
	if interaction_prompt:
		interaction_prompt.visible = false
		interaction_prompt.text = "按空格进入"
	
	# 连接信号
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

## 交互方法（由player_controller调用）
func interact():
	if target_scene == "":
		return
	
	# 切换场景
	GameManager.player_data.current_area = target_area
	GameManager.change_scene(target_scene, target_area)

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
