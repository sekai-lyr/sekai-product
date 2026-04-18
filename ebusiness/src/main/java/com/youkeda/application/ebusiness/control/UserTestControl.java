package com.youkeda.application.ebusiness.control;


import com.youkeda.application.ebusiness.dao.UserDAO;
import com.youkeda.application.ebusiness.dataobject.UserDO;
import com.youkeda.application.ebusiness.model.Result;
import com.youkeda.application.ebusiness.model.User;
import com.youkeda.application.ebusiness.service.ProductService;
import com.youkeda.application.ebusiness.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Controller
public class UserTestControl {

    @Autowired
    private UserService userService;

    @Autowired
    private UserDAO userDAO;

    @GetMapping(path = "/login")
    public String login(Model model) {
        return "login";
    }

    @GetMapping(path = "/reg")
    public String register(Model model) {
        return "register";
    }

    @PostMapping(path = "/reg/api")
    @ResponseBody
    public Result<User> reg(@RequestBody User user, HttpServletRequest request, HttpServletResponse response,
                            HttpSession httpSession) {

        return userService.register(user);

    }
}




