## ItemDatabase - 物品数据库
extends Node

# 物品数据缓存
var items: Dictionary = {}
var chest_contents: Dictionary = {}

func _ready():
	_load_items()

## 加载物品数据
func _load_items():
	var file = FileAccess.open("res://data/items.json", FileAccess.READ)
	if file == null:
		push_warning("无法加载物品数据库")
		return
	
	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	file.close()
	
	if error != OK:
		push_warning("物品数据库格式错误")
		return
	
	var data = json.data
	
	# 加载物品定义
	for item in data.get("items", []):
		items[item["id"]] = item
	
	# 加载宝箱内容
	chest_contents = data.get("chest_contents", {})

## 获取物品信息
func get_item(item_id: String) -> Dictionary:
	return items.get(item_id, {})

## 获取物品名称
func get_item_name(item_id: String) -> String:
	var item = get_item(item_id)
	return item.get("name", item_id)

## 获取物品描述
func get_item_description(item_id: String) -> String:
	var item = get_item(item_id)
	return item.get("description", "")

## 获取物品价格
func get_item_price(item_id: String) -> int:
	var item = get_item(item_id)
	return item.get("price", 0)

## 检查物品是否可购买
func is_item_buyable(item_id: String) -> bool:
	var item = get_item(item_id)
	return item.get("buyable", false)

## 获取宝箱内容
func get_chest_contents(chest_id: String) -> Array:
	return chest_contents.get(chest_id, [])

## 执行物品效果
func use_item(item_id: String, target: CharacterData) -> Dictionary:
	var item = get_item(item_id)
	if item.is_empty():
		return {"success": false, "message": "物品不存在"}
	
	var effect = item.get("effect", {})
	if effect.is_empty():
		return {"success": false, "message": "该物品无法使用"}
	
	var result = {"success": true, "message": ""}
	
	match effect.get("type", ""):
		"heal_hp":
			var amount = effect.get("value", 0)
			target.heal(amount)
			result["message"] = "恢复了 %d HP" % amount
		"heal_mp":
			var amount = effect.get("value", 0)
			target.restore_mp(amount)
			result["message"] = "恢复了 %d MP" % amount
		"full_heal":
			target.hp = target.max_hp
			target.mp = target.max_mp
			result["message"] = "完全恢复了HP和MP"
		"cure_poison":
			# 暂时简化处理
			result["message"] = "解除了中毒状态"
		"damage_all":
			# 战斗中使用，对所有敌人造成伤害
			result["message"] = "对所有敌人造成了伤害"
		_:
			result["success"] = false
			result["message"] = "未知的物品效果"
	
	return result

## 获取所有可购买物品
func get_buyable_items() -> Array[Dictionary]:
	var buyable = []
	for item_id in items:
		if items[item_id].get("buyable", false):
			buyable.append(items[item_id])
	return buyable
