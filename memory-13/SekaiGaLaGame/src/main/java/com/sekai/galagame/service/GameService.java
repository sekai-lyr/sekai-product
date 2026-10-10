package com.sekai.galagame.service;

import com.sekai.galagame.model.GameState;
import com.sekai.galagame.model.Result;
import com.sekai.galagame.model.SaveInfo;
import com.sekai.galagame.model.StoryFrame;
import com.sekai.galagame.model.User;

import java.util.List;

public interface GameService {
    StoryFrame start(User user, GameState state, Integer chapterNo);

    StoryFrame advance(User user, GameState state);

    StoryFrame choose(User user, GameState state, String nextKey);

    StoryFrame current(User user, GameState state);

    Result<Boolean> save(User user, GameState state, int slotNo);

    Result<List<SaveInfo>> saves(User user);

    Result<StoryFrame> load(User user, GameState state, int slotNo);

    Result<Boolean> deleteSave(User user, int slotNo);
}
