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
        user.setNickName(trimToNull(user.getNickName()));

        if (user.getUserName() == null || !user.getUserName().matches("[a-zA-Z0-9_@.-]{3,64}")) {
            return Result.fail("用户名需为 3–64 位字母、数字或 _ @ . -");
        }
        if (!PasswordHashUtil.validNewPassword(user.getPassword())) {
            return Result.fail("密码至少 8 个字符，UTF-8 编码不超过 72 字节");
        }
        if (userMapper.selectByUserName(user.getUserName()) != null) {
            return Result.fail("这个用户名已被使用");
        }
        if (user.getNickName() == null) {
            user.setNickName(user.getUserName());
        }
        if (user.getNickName().length() > 64) {
            return Result.fail("昵称不能超过 64 个字符");
        }
        user.setAdmin(false);
        user.setSessionVersion(0);
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
        if (userName == null || password == null) {
            return Result.fail("请输入用户名和密码");
        }

        SekaiDrawLotsUserDO dbUser = userMapper.selectByLoginName(userName);
        if (dbUser == null) {
            return Result.fail("用户名或密码不正确");
        }
        if (!PasswordHashUtil.isCurrentHash(dbUser.getPassword())) password = password.trim();
        if (!PasswordHashUtil.matches(password, dbUser.getPassword())) {
            return Result.fail("用户名或密码不正确");
        }
        if (!PasswordHashUtil.isCurrentHash(dbUser.getPassword())) {
            dbUser.setPassword(PasswordHashUtil.hash(password));
            userMapper.updateByPrimaryKeySelective(dbUser);
        }
        User loginUser = dbUser.convertToUser();
        loginUser.setPassword(null);
        return Result.ok(loginUser);
    }

    @Override
    @Transactional
    public Result<String> rotateRecoveryCode(User user, String currentPassword) {
        SekaiDrawLotsUserDO dbUser = userMapper.lockById(user.getId());
        if (dbUser == null || dbUser.getSessionVersion() != user.getSessionVersion()
                || !PasswordHashUtil.matches(currentPassword, dbUser.getPassword())) {
            return Result.fail("当前密码不正确，请重试");
        }
        String code = PasswordHashUtil.newToken();
        userMapper.setRecovery(user.getId(), PasswordHashUtil.tokenHash(code));
        return Result.ok(code);
    }

    @Override
    @Transactional
    public Result<String> beginReset(String userName, String recoveryCode) {
        if (trimToNull(userName) == null || recoveryCode == null || recoveryCode.length() > 100) {
            return Result.fail("用户名或恢复码不正确，或恢复码已使用");
        }
        String token = PasswordHashUtil.newToken();
        int changed = userMapper.exchangeRecovery(userName.trim(), PasswordHashUtil.tokenHash(recoveryCode.trim()), PasswordHashUtil.tokenHash(token));
        return changed == 1 ? Result.ok(token) : Result.fail("用户名或恢复码不正确，或恢复码已使用");
    }

    @Override
    @Transactional
    public Result<Boolean> resetPassword(String token, String newPassword) {
        if (!PasswordHashUtil.validNewPassword(newPassword)) {
            return Result.fail("密码至少 8 个字符，UTF-8 编码不超过 72 字节");
        }
        if (token == null || token.length() > 100) return Result.fail("重置凭证无效或已过期");
        SekaiDrawLotsUserDO dbUser = userMapper.lockByResetToken(PasswordHashUtil.tokenHash(token));
        if (dbUser == null) {
            return Result.fail("重置凭证无效或已过期，请重新验证身份");
        }
        userMapper.resetPassword(dbUser.getId(), PasswordHashUtil.hash(newPassword));
        return Result.ok(true);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
