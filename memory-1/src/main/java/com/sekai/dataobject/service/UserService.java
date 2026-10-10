package com.sekai.dataobject.service;

import com.sekai.dataobject.model.Result;
import com.sekai.dataobject.model.User;

public interface UserService {

    Result<User> register(User user);

    Result<User> login(String userName, String password);

    User getByUserName(String userName);
}
