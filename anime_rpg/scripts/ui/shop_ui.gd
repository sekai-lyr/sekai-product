## ShopUI - 商店界面
extends Control

signal closed()

# 商店配置
@export var shop_name: String = "商店"

# UI引用
@onready var title_label: Label = $Panel/VBoxContainer/TitleLabel
@onready var gold_label: Label = $Panel/VBoxContainer/GoldLabel
@onready var item_container: VBoxContainer = $Panel/VBoxContainer/ScrollContainer/ItemContainer
@onready var close_button: Button = $Panel/VBoxContainer/CloseButton
@onready var description_label: Label = $Panel/DescriptionLabel

# 商品列表
var shop_items: Array[Dictionary] = []

func _ready():
	close_button.pressed.connect(_on_close_pressed)
	visible = false

## 打开商店
func open():
	visible = true
	title_label.text = shop_name
	_load_shop_items()
	_update_gold_display()
	_populate_items()

## 关闭商店
func close():
	visible = false
	closed.emit()

## 加载商店物品
func _load_shop_items():
	# 从物品数据库加载可购买物品
	shop_items = ItemDatabase.get_buyable_items()

## 更新金币显示
func _update_gold_display():
	if GameManager.player_data:
		gold_label.text = "金币: %d" % GameManager.player_data.gold

## 填充物品列表
func _populate_items():
	# 清除旧的物品
	for child in item_container.get_children():
		child.queue_free()
	
	# 添加商店物品
	for item in shop_items:
		var hbox = HBoxContainer.new()
		
		var name_label = Label.new()
		name_label.text = item["name"]
		name_label.custom_minimum_size.x = 200
		
		var price_label = Label.new()
		price_label.text = "%d 金币" % item["price"]
		price_label.custom_minimum_size.x = 100
		
		var buy_button = Button.new()
		buy_button.text = "购买"
		buy_button.custom_minimum_size = Vector2(80, 30)
		buy_button.pressed.connect(_on_buy_item.bind(item))
		
		hbox.add_child(name_label)
		hbox.add_child(price_label)
		hbox.add_child(buy_button)
		item_container.add_child(hbox)

## 购买物品
func _on_buy_item(item: Dictionary):
	if not GameManager.player_data:
		return
	
	var price = item["price"]
	if GameManager.player_data.gold >= price:
		# 扣除金币
		GameManager.player_data.gold -= price
		# 添加物品
		GameManager.player_data.add_item(item["id"], item["name"], 1)
		# 更新显示
		_update_gold_display()
		_show_message("购买了 %s" % item["name"])
	else:
		_show_message("金币不足！")

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
