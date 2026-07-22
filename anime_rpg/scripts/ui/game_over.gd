## GameOver - 游戏结束界面
extends Control

@onready var title_label: Label = $TitleLabel
@onready var retry_button: Button = $VBoxContainer/RetryButton
@onready var menu_button: Button = $VBoxContainer/MenuButton
@onready var quit_button: Button = $VBoxContainer/QuitButton

func _ready():
	retry_button.pressed.connect(_on_retry_pressed)
	menu_button.pressed.connect(_on_menu_pressed)
	quit_button.pressed.connect(_on_quit_pressed)
	
	# 淡入效果
	modulate.a = 0
	var tween = create_tween()
	tween.tween_property(self, "modulate:a", 1.0, 1.0)

func _on_retry_pressed():
	# 从存档重新开始
	if SaveSystem.has_save_data():
		GameManager.continue_game()
	else:
		GameManager.start_new_game()

func _on_menu_pressed():
	# 返回主菜单
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")

func _on_quit_pressed():
	get_tree().quit()
