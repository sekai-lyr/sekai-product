package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;

public interface UserService {
    Result<User> register(User user);
    Result<User> login(String userName, String password);
    Result<String> rotateRecoveryCode(User user, String currentPassword);
    Result<String> beginReset(String userName, String recoveryCode);
    Result<Boolean> resetPassword(String token, String newPassword);
}
