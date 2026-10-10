package com.sekai.galagame.service;

import com.sekai.galagame.model.Result;
import com.sekai.galagame.model.User;

public interface UserService {
    Result<User> register(String username, String password, String nickname);

    Result<User> login(String username, String password);

    Result<User> me(Long userId);
}
