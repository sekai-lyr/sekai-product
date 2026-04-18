package com.youkeda.application.ebusiness.service.impl;

import com.youkeda.application.ebusiness.dao.UserDAO;
import com.youkeda.application.ebusiness.dataobject.UserDO;
import com.youkeda.application.ebusiness.model.Result;
import com.youkeda.application.ebusiness.model.User;
import com.youkeda.application.ebusiness.service.UserService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {

    // 注入 DAO，操作数据库
    @Resource
    private UserDAO userDAO;

    /**
     * 注册方法：把用户信息存入数据库
     */
    @Override
    public Result<User> register(User user) {
        // 1. 非空校验（核心校验，防止空数据入库）
        if (user.getUserName() == null || user.getUserName().trim().isEmpty()) {
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("用户名不能为空");
            result.setSuccess(false);
            return result;
        }
        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("密码不能为空");
            result.setSuccess(false);
            return result;
        }
        if (user.getMobile() == null || user.getMobile().trim().isEmpty()) {
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("电话号码不能为空");
            result.setSuccess(false);
            return result;
        }

        // 2. 检查用户名是否已存在（避免重复注册）
        UserDO existUser = userDAO.findByUserName(user.getUserName());
        if (existUser != null) {
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("用户名已存在");
            result.setSuccess(false);
            return result;
        }

        // 3. 调用 DAO 插入数据库
        UserDO userDO=new UserDO(user);
        int insertRow = userDAO.add(userDO);
        if (insertRow > 0) {
            Result<User> result = new Result<User>();
            result.setCode("200");
            result.setMessage("注册成功，数据库已保存");
            result.setSuccess(true);
            result.setData(user);
            return result;
        } else {
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("数据库异常");
            result.setSuccess(false);
            return result;
        }
    }

    /**
     * 登录方法：根据用户名密码查询数据库，校验登录
     */
    @Override
    public Result<User> login(String usrName, String pwd) {
        // 1. 非空校验
        if (usrName == null || usrName.trim().isEmpty()) {
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("用户名不能为空");
            result.setSuccess(false);
            return result;
        }
        if (pwd == null || pwd.trim().isEmpty()) {
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("密码不能为空");
            result.setSuccess(false);
            return result;
        }

        // 2. 根据用户名查询数据库
        UserDO dbUser = userDAO.findByUserName(usrName);
        if (dbUser == null) {
            // 用户名不存在
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("用户名不存在");
            result.setSuccess(false);
            return result;
        }

        // 3. 校验密码是否正确
        if (!dbUser.getPassword().equals(pwd)) {
            Result<User> result = new Result<User>();
            result.setCode("400");
            result.setMessage("密码不正确");
            result.setSuccess(false);
            return result;
        }

        // 4. 校验通过，登录成功
        Result<User> result = new Result<User>();
        result.setCode("200");
        result.setMessage("登陆成功");
        result.setSuccess(true);
        return result;
    }
}
