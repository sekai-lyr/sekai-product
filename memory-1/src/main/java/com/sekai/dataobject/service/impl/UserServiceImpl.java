package com.sekai.dataobject.service.impl;

import com.sekai.dataobject.dataobject.SekaiDataObjectUserDO;
import com.sekai.dataobject.mapper.SekaiDataObjectUserMapper;
import com.sekai.dataobject.model.Result;
import com.sekai.dataobject.model.User;
import com.sekai.dataobject.service.UserService;
import com.sekai.dataobject.util.PasswordHashUtil;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserServiceImpl implements UserService {

    @Resource
    private SekaiDataObjectUserMapper userMapper;

    @Override
    @Transactional
    public Result<User> register(User user) {
        if (user == null) {
            return fail("用户信息不能为空");
        }

        user.setUserName(trimToNull(user.getUserName()));
        user.setPassword(trimToNull(user.getPassword()));
        user.setNickName(trimToNull(user.getNickName()));

        if (user.getUserName() == null) {
            return fail("用户名不能为空");
        }
        if (user.getPassword() == null) {
            return fail("密码不能为空");
        }
        if (user.getPassword().length() < 6 || user.getPassword().length() > 30) {
            return fail("密码长度需要在 6 到 30 位之间");
        }

        SekaiDataObjectUserDO existUser = userMapper.selectByUserName(user.getUserName());
        if (existUser != null) {
            return fail("用户名已存在");
        }

        user.setPassword(PasswordHashUtil.hash(user.getPassword()));
        SekaiDataObjectUserDO userDO = new SekaiDataObjectUserDO(user);
        int insertRow = userMapper.insert(userDO);
        if (insertRow <= 0 || userDO.getId() == null) {
            return fail("数据库异常，注册失败");
        }

        SekaiDataObjectUserDO dbUser = userMapper.selectByPrimaryKey(userDO.getId());
        Result<User> result = new Result<>();
        result.setCode("200");
        result.setMessage("注册成功");
        result.setSuccess(true);
        result.setData(dbUser.convertToUser());
        return result;
    }

    @Override
    @Transactional
    public Result<User> login(String userName, String password) {
        userName = trimToNull(userName);
        password = trimToNull(password);

        if (userName == null) {
            return fail("用户名不能为空");
        }
        if (password == null) {
            return fail("密码不能为空");
        }

        SekaiDataObjectUserDO dbUser = userMapper.selectByLoginName(userName);
        if (dbUser == null) {
            return fail("用户名不存在，请先注册");
        }
        if (!PasswordHashUtil.matches(password, dbUser.getPassword())) {
            return fail("密码不正确");
        }
        if (!PasswordHashUtil.isHashed(dbUser.getPassword())) {
            dbUser.setPassword(PasswordHashUtil.hash(password));
            userMapper.updateByPrimaryKeySelective(dbUser);
        }

        Result<User> result = new Result<>();
        result.setCode("200");
        result.setMessage("登录成功");
        result.setSuccess(true);
        result.setData(dbUser.convertToUser());
        return result;
    }

    @Override
    public User getByUserName(String userName) {
        userName = trimToNull(userName);
        if (userName == null) {
            return null;
        }
        SekaiDataObjectUserDO userDO = userMapper.selectByUserName(userName);
        return userDO == null ? null : userDO.convertToUser();
    }

    private Result<User> fail(String message) {
        Result<User> result = new Result<>();
        result.setCode("400");
        result.setMessage(message);
        result.setSuccess(false);
        return result;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
