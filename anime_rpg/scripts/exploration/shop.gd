## Shop - 商店系统
extends Area2D

# 商店配置
@export var shop_id: String = ""
@export var shop_name: String = "商店"

# 商店UI场景
var shop_ui_scene = preload("res://scenes/ui/shop.tscn")
var current_shop_ui: Control = null

# 视觉组件
@onready var interaction_prompt: Label = $InteractionPrompt

func _ready():
	# 设置交互提示
	if interaction_prompt:
		interaction_prompt.visible = false
		interaction_prompt.text = "按空格购物"
	
	# 连接信号
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

## 交互方法（由player_controller调用）
func interact():
	_open_shop()

## 打开商店
func _open_shop():
	# 创建商店UI
	current_shop_ui = shop_ui_scene.instantiate()
	current_shop_ui.shop_name = shop_name
	current_shop_ui.closed.connect(_on_shop_closed)
	
	# 添加到场景树
	var canvas_layer = CanvasLayer.new()
	canvas_layer.layer = 100
	get_tree().current_scene.add_child(canvas_layer)
	canvas_layer.add_child(current_shop_ui)
	
	current_shop_ui.open()

## 商店关闭回调
func _on_shop_closed():
	if current_shop_ui:
		current_shop_ui.queue_free()
		current_shop_ui = null

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
