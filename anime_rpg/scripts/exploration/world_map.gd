## WorldMap - 世界地图控制
extends Control

@onready var village_button: Button = $MapContainer/VillageButton
@onready var field_button: Button = $MapContainer/FieldButton
@onready var dungeon_button: Button = $MapContainer/DungeonButton
@onready var back_button: Button = $BackButton

@onready var player_level_label: Label = $PlayerInfo/LevelLabel
@onready var player_area_label: Label = $PlayerInfo/AreaLabel

func _ready():
	village_button.pressed.connect(_on_village_pressed)
	field_button.pressed.connect(_on_field_pressed)
	dungeon_button.pressed.connect(_on_dungeon_pressed)
	back_button.pressed.connect(_on_back_pressed)
	
	_update_player_info()
	_update_area_buttons()

func _update_player_info():
	var player = GameManager.get_player()
	if player:
		player_level_label.text = "等级: %d" % player.level
		player_area_label.text = "当前区域: %s" % player.current_area

func _update_area_buttons():
	var player = GameManager.get_player()
	if player:
		village_button.disabled = not GameManager.is_area_unlocked("village")
		field_button.disabled = not GameManager.is_area_unlocked("field")
		dungeon_button.disabled = not GameManager.is_area_unlocked("dungeon")

func _on_village_pressed():
	_enter_area("village")

func _on_field_pressed():
	_enter_area("field")

func _on_dungeon_pressed():
	_enter_area("dungeon")

func _on_back_pressed():
	# 返回之前的场景
	get_tree().change_scene_to_file("res://scenes/exploration/village.tscn")

func _enter_area(area_name: String):
	GameManager.player_data.current_area = area_name
	GameManager.change_scene("res://scenes/exploration/%s.tscn" % area_name, area_name)
