## Chest - 宝箱交互脚本
extends Area2D

# 宝箱配置
@export var chest_id: String = ""
@export var contents: Array[Dictionary] = []  # [{id, name, quantity}]

# 状态
var is_opened: bool = false
var is_interactable: bool = true

# 视觉组件
@onready var sprite: Sprite2D = $Sprite2D
@onready var interaction_prompt: Label = $InteractionPrompt

# 物品数据库
var item_database: Dictionary = {}

func _ready():
	# 加载物品数据库
	_load_item_database()
	
	# 加载宝箱内容
	_load_chest_contents()
	
	# 设置交互提示
	if interaction_prompt:
		interaction_prompt.visible = false
		interaction_prompt.text = "按空格开启"
	
	# 连接信号
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

## 加载物品数据库
func _load_item_database():
	var file = FileAccess.open("res://data/items.json", FileAccess.READ)
	if file == null:
		return
	
	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	file.close()
	
	if error != OK:
		return
	
	var data = json.data
	for item in data.get("items", []):
		item_database[item["id"]] = item

## 加载宝箱内容
func _load_chest_contents():
	# 如果没有配置内容，从数据库加载
	if contents.size() == 0 and chest_id != "":
		var file = FileAccess.open("res://data/items.json", FileAccess.READ)
		if file == null:
			return
		
		var json = JSON.new()
		var error = json.parse(file.get_as_text())
		file.close()
		
		if error != OK:
			return
		
		var data = json.data
		var chest_contents = data.get("chest_contents", {})
		if chest_contents.has(chest_id):
			contents = chest_contents[chest_id]

## 交互方法（由player_controller调用）
func interact():
	if not is_interactable or is_opened:
		return
	
	# 开启宝箱
	_open_chest()

## 开启宝箱
func _open_chest():
	is_opened = true
	is_interactable = false
	
	# 隐藏交互提示
	if interaction_prompt:
		interaction_prompt.visible = false
	
	# 给予物品
	var item_names = []
	for item in contents:
		var item_id = item["id"]
		var quantity = item.get("quantity", 1)
		
		# 查找物品名称
		var item_name = item_id
		if item_database.has(item_id):
			item_name = item_database[item_id]["name"]
		
		# 添加到背包
		GameManager.player_data.add_item(item_id, item_name, quantity)
		item_names.append("%s x%d" % [item_name, quantity])
	
	# 显示获得物品提示
	var message = "获得: " + ", ".join(item_names)
	_show_item_get_message(message)
	
	# 发送事件
	EventBus.chest_opened.emit(chest_id)
	
	# 更新视觉状态（可以播放开启动画）
	_update_visual_state()

## 显示获得物品消息
func _show_item_get_message(message: String):
	# 创建临时Label显示消息
	var label = Label.new()
	label.text = message
	label.position = global_position + Vector2(-100, -50)
	label.add_theme_font_size_override("font_size", 16)
	label.add_theme_color_override("font_color", Color.YELLOW)
	
	# 添加到场景树
	get_tree().current_scene.add_child(label)
	
	# 动画效果
	var tween = create_tween()
	tween.tween_property(label, "position:y", label.position.y - 30, 1.0)
	tween.parallel().tween_property(label, "modulate:a", 0.0, 1.0)
	tween.tween_callback(label.queue_free)

## 更新视觉状态
func _update_visual_state():
	if sprite:
		# 可以切换到已开启的纹理
		# sprite.texture = opened_texture
		pass

## 当玩家进入交互区域
func _on_body_entered(body: Node2D):
	if body.has_method("get_player_data") and not is_opened:
		if interaction_prompt:
			interaction_prompt.visible = true

## 当玩家离开交互区域
func _on_body_exited(body: Node2D):
	if body.has_method("get_player_data"):
		if interaction_prompt:
			interaction_prompt.visible = false

## 检查是否已开启
func is_chest_opened() -> bool:
	return is_opened
