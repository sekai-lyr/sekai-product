package com.sekai.animevideo.service;

import com.sekai.animevideo.model.Result;
import com.sekai.animevideo.model.User;

public interface UserService {
    Result<User> register(User user);
    Result<User> login(String userName, String password);
}
