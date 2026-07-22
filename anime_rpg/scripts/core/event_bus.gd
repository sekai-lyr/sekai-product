## EventBus - 全局事件总线
## 用于解耦系统间通信
extends Node

# 游戏状态事件
signal game_state_changed(old_state: GameState, new_state: GameState)
signal scene_transition_started(scene_name: String)
signal scene_transition_finished()

# 战斗事件
signal battle_started(enemies: Array)
signal battle_ended(result: BattleResult)
signal action_ready(character: CharacterData)
signal damage_dealt(attacker: CharacterData, target: CharacterData, damage: int)
signal character_defeated(character: CharacterData)

# 对话事件
signal dialogue_started(dialogue_id: String)
signal dialogue_ended()
signal dialogue_option_selected(option_index: int)
signal affection_changed(character_id: String, new_value: int)

# UI事件
signal menu_opened(menu_name: String)
signal menu_closed()
signal inventory_changed()
signal item_used(item: ItemData)

# 玩家事件
signal player_leveled_up(new_level: int)
signal player_healed(amount: int)
signal player_damaged(amount: int)
signal experience_gained(amount: int)

# 探索事件
signal area_entered(area_name: String)
signal chest_opened(chest_id: String)
signal npc_interaction_started(npc_id: String)
signal random_encounter_triggered(enemy_group: String)

# 枚举定义
enum GameState {
	MAIN_MENU,
	EXPLORING,
	BATTLE,
	DIALOGUE,
	PAUSED,
	GAME_OVER
}

enum BattleResult {
	VICTORY,
	DEFEAT,
	ESCAPE,
	DRAW
}
