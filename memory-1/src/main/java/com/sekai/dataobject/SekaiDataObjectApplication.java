package com.sekai.dataobject;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.sekai.dataobject.mapper")
public class SekaiDataObjectApplication {

    public static void main(String[] args) {
        SpringApplication.run(SekaiDataObjectApplication.class, args);
    }
}
