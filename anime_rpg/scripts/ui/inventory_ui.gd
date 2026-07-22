## InventoryUI - 背包界面
extends Control

signal item_used(item_id: String)
signal closed()

# UI引用
@onready var title_label: Label = $Panel/VBoxContainer/TitleLabel
@onready var item_container: VBoxContainer = $Panel/VBoxContainer/ScrollContainer/ItemContainer
@onready var close_button: Button = $Panel/VBoxContainer/CloseButton
@onready var description_label: Label = $Panel/DescriptionLabel

# 当前选择的物品
var selected_item: Dictionary = {}

func _ready():
	close_button.pressed.connect(_on_close_pressed)
	visible = false

## 打开背包
func open():
	visible = true
	_populate_items()
	title_label.text = "背包"

## 关闭背包
func close():
	visible = false
	selected_item = {}
	closed.emit()

## 填充物品列表
func _populate_items():
	# 清除旧的物品
	for child in item_container.get_children():
		child.queue_free()
	
	# 添加背包中的物品
	if GameManager.player_data:
		var items = GameManager.player_data.inventory
		for item in items:
			var btn = Button.new()
			btn.text = "%s x%d" % [item["name"], item["quantity"]]
			btn.custom_minimum_size = Vector2(400, 40)
			btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
			btn.pressed.connect(_on_item_selected.bind(item))
			item_container.add_child(btn)
		
		if items.size() == 0:
			var label = Label.new()
			label.text = "背包是空的"
			label.horizontal_alignment = 1
			item_container.add_child(label)

## 物品选择
func _on_item_selected(item: Dictionary):
	selected_item = item
	# 显示物品描述
	var item_data = ItemDatabase.get_item(item["id"])
	description_label.text = item_data.get("description", "")
	description_label.visible = true

## 使用物品
func _use_item():
	if selected_item.is_empty():
		return
	
	var item_id = selected_item["id"]
	var result = ItemDatabase.use_item(item_id, GameManager.player_data)
	
	if result["success"]:
		# 移除物品
		GameManager.player_data.remove_item(item_id)
		# 刷新列表
		_populate_items()
		# 发送信号
		item_used.emit(item_id)
		# 显示消息
		_show_message(result["message"])
	else:
		_show_message(result["message"])

## 显示消息
func _show_message(text: String):
	description_label.text = text
	description_label.visible = true
	await get_tree().create_timer(2.0).timeout
	description_label.visible = false

## 关闭按钮
func _on_close_pressed():
	close()

## 输入处理
func _input(event):
	if not visible:
		return
	
	if event.is_action_pressed("cancel"):
		close()
	elif event.is_action_pressed("confirm") and not selected_item.is_empty():
		_use_item()
