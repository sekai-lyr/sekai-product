package com.sekai.galagame.service.impl;

import com.sekai.galagame.dataobject.SekaiGalagameUserDO;
import com.sekai.galagame.mapper.SekaiGalagameUserMapper;
import com.sekai.galagame.model.Result;
import com.sekai.galagame.model.User;
import com.sekai.galagame.service.UserService;
import com.sekai.galagame.util.PasswordHashUtil;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {

    @Resource
    private SekaiGalagameUserMapper userMapper;

    @Override
    public Result<User> register(String username, String password, String nickname) {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return Result.fail("用户名和密码不能为空");
        }
        if (userMapper.selectByUsername(username.trim()) != null) {
            return Result.fail("用户名已存在");
        }
        SekaiGalagameUserDO userDO = new SekaiGalagameUserDO();
        userDO.setUsername(username.trim());
        userDO.setPassword(PasswordHashUtil.hash(password));
        userDO.setNickname(nickname == null || nickname.isBlank() ? username.trim() : nickname.trim());
        userMapper.insert(userDO);
        User user = userDO.convertToUser();
        user.setPassword(null);
        return Result.ok(user);
    }

    @Override
    public Result<User> login(String username, String password) {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return Result.fail("用户名和密码不能为空");
        }
        SekaiGalagameUserDO userDO = userMapper.selectByUsername(username.trim());
        if (userDO == null || !PasswordHashUtil.matches(password, userDO.getPassword())) {
            return Result.fail("用户名或密码错误");
        }
        User user = userDO.convertToUser();
        user.setPassword(null);
        return Result.ok(user);
    }

    @Override
    public Result<User> me(Long userId) {
        SekaiGalagameUserDO userDO = userMapper.selectByPrimaryKey(userId);
        if (userDO == null) {
            return Result.fail("用户不存在");
        }
        User user = userDO.convertToUser();
        user.setPassword(null);
        return Result.ok(user);
    }
}
