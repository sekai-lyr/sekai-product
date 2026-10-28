package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.model.WheelOption;
import com.sekai.draw.lots.model.WheelSpinRecord;
import com.sekai.draw.lots.model.WheelSpinResult;
import com.sekai.draw.lots.model.WheelSuggestion;

import java.util.List;

public interface WheelService {
    List<WheelOption> options(User user);
    List<WheelSpinRecord> recentSpins(User user, int limit);
    List<WheelSuggestion> suggestions(User user);
    Result<Integer> importSuggestions(User user);
    Result<WheelOption> addOption(User user, String title, String detail, Integer weight, String color);
    Result<Boolean> deleteOption(User user, Long optionId);
    Result<WheelSpinResult> spin(User user);
}
