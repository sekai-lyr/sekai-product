package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;

public interface UserService {
    Result<User> register(User user);
    Result<User> login(String userName, String password);
    Result<User> resetPassword(String userName, String newPassword);
}