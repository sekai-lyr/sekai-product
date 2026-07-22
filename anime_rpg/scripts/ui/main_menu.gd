## MainMenu - 主菜单脚本
extends Control

# 按钮引用
@onready var new_game_button: Button = $VBoxContainer/NewGameButton
@onready var continue_button: Button = $VBoxContainer/ContinueButton
@onready var settings_button: Button = $VBoxContainer/SettingsButton
@onready var quit_button: Button = $VBoxContainer/QuitButton
@onready var title_label: Label = $TitleLabel
@onready var version_label: Label = $VersionLabel

func _ready():
	# 连接按钮信号
	new_game_button.pressed.connect(_on_new_game_pressed)
	continue_button.pressed.connect(_on_continue_pressed)
	settings_button.pressed.connect(_on_settings_pressed)
	quit_button.pressed.connect(_on_quit_pressed)
	
	# 检查是否有存档
	continue_button.disabled = not SaveSystem.has_save_data()
	
	# 设置版本号
	version_label.text = "v0.1.0 Alpha"
	
	# 播放标题动画（可选）
	_play_title_animation()

func _play_title_animation():
	# 标题淡入效果
	title_label.modulate.a = 0
	var tween = create_tween()
	tween.tween_property(title_label, "modulate:a", 1.0, 1.0)

func _on_new_game_pressed():
	# 开始新游戏
	GameManager.start_new_game()

func _on_continue_pressed():
	# 继续游戏
	GameManager.continue_game()

func _on_settings_pressed():
	# 打开设置菜单（暂时无功能）
	print("设置菜单 - 待实现")

func _on_quit_pressed():
	# 退出游戏
	get_tree().quit()

# 键盘导航
func _input(event):
	if event.is_action_pressed("confirm"):
		# 如果有按钮被聚焦，触发它
		var focused = get_viewport().gui_get_focus_owner()
		if focused is Button:
			focused.emit_signal("pressed")
	elif event.is_action_pressed("cancel"):
		# ESC键退出
		_on_quit_pressed()
