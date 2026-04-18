package com.youkeda.application.ebusiness.control;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class CategoryTestControl{

    @GetMapping(path = "/test/category")
Map testCategory(){


        Map<String, Object> result = new HashMap<>();
        result.put("code", 200);
        result.put("message", "恭喜你！接口访问成功啦！");

        return result;
    }



}
