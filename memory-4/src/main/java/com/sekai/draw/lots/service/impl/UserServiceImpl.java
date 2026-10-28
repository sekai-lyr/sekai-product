package com.sekai.draw.lots.service.impl;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsUserDO;
import com.sekai.draw.lots.mapper.SekaiDrawLotsUserMapper;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.UserService;
import com.sekai.draw.lots.util.PasswordHashUtil;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserServiceImpl implements UserService {

    @Resource
    private SekaiDrawLotsUserMapper userMapper;

    @Override
    @Transactional
    public Result<User> register(User user) {
        if (user == null) {
            return Result.fail("User info cannot be null");
        }
        user.setUserName(trimToNull(user.getUserName()));
        user.setPassword(trimToNull(user.getPassword()));
        user.setNickName(trimToNull(user.getNickName()));

        if (user.getUserName() == null) {
            return Result.fail("Username cannot be empty");
        }
        if (user.getPassword() == null || user.getPassword().length() < 6) {
            return Result.fail("Password must be at least 6 characters");
        }
        if (userMapper.selectByUserName(user.getUserName()) != null) {
            return Result.fail("Username already exists");
        }
        if (user.getNickName() == null) {
            user.setNickName(user.getUserName());
        }
        user.setAvatar("https://api.dicebear.com/8.x/thumbs/svg?seed=" + user.getUserName());
        user.setPassword(PasswordHashUtil.hash(user.getPassword()));

        SekaiDrawLotsUserDO userDO = new SekaiDrawLotsUserDO(user);
        int insertRow = userMapper.insert(userDO);
        if (insertRow <= 0 || userDO.getId() == null) {
            return Result.fail("Registration failed, please try again");
        }
        return Result.ok(userMapper.selectByPrimaryKey(userDO.getId()).convertToUser());
    }

    @Override
    @Transactional
    public Result<User> login(String userName, String password) {
        userName = trimToNull(userName);
        password = trimToNull(password);
        if (userName == null || password == null) {
            return Result.fail("Username and password cannot be empty");
        }

        SekaiDrawLotsUserDO dbUser = userMapper.selectByLoginName(userName);
        if (dbUser == null) {
            return Result.fail("User not found, please register first");
        }
        if (!PasswordHashUtil.matches(password, dbUser.getPassword())) {
            return Result.fail("Incorrect password");
        }
        if (!PasswordHashUtil.isHashed(dbUser.getPassword())) {
            dbUser.setPassword(PasswordHashUtil.hash(password));
            userMapper.updateByPrimaryKeySelective(dbUser);
        }
        return Result.ok(dbUser.convertToUser());
    }

    @Override
    @Transactional
    public Result<User> resetPassword(String userName, String newPassword) {
        userName = trimToNull(userName);
        newPassword = trimToNull(newPassword);
        if (userName == null || newPassword == null) {
            return Result.fail("Username and password cannot be empty");
        }
        if (newPassword.length() < 6) {
            return Result.fail("Password must be at least 6 characters");
        }
        SekaiDrawLotsUserDO dbUser = userMapper.selectByUserName(userName);
        if (dbUser == null) {
            return Result.fail("User not found");
        }
        dbUser.setPassword(PasswordHashUtil.hash(newPassword));
        userMapper.updateByPrimaryKeySelective(dbUser);
        return Result.ok(dbUser.convertToUser());
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}