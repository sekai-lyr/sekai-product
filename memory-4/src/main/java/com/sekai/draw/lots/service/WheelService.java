package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.model.WheelOption;
import com.sekai.draw.lots.model.WheelSpinRecord;
import com.sekai.draw.lots.model.WheelSpinResult;
import com.sekai.draw.lots.model.WheelSuggestion;

import java.util.List;

public interface WheelService {
    List<WheelOption> options(User user, Long deckId);
    List<WheelSpinRecord> recentSpins(User user, Long deckId, int limit);
    List<WheelSuggestion> suggestions(User user);
    Result<Integer> importSuggestions(User user, Long deckId);
    Result<WheelOption> addOption(User user, Long deckId, String title, String detail, Integer weight, String color);
    Result<Boolean> deleteOption(User user, Long deckId, Long optionId);
    Result<WheelSpinResult> spin(User user, Long deckId);
    List<com.sekai.draw.lots.model.WheelDeck> decks(User user);
    com.sekai.draw.lots.model.WheelDeck resolveDeck(User user, Long deckId);
    Result<com.sekai.draw.lots.model.WheelDeck> createDeck(User user, String name);
    Result<Boolean> renameDeck(User user, Long deckId, String name);
    Result<Boolean> updateOption(User user, Long deckId, Long optionId, String title, String detail, Integer weight, String color, int sortOrder, boolean enabled);
}
