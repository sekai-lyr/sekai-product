# memory-2 · eBusiness 电商练习项目

一个基于 **Spring Boot + MyBatis** 的电商业务练习项目，使用 `com.youkeda.application.ebusiness` 包结构，采用 control / service / dao / dataobject / model 分层设计。

## 项目结构

- `control/`：接口入口
- `service/`：业务逻辑
- `dao/`：数据访问层
- `dataobject/`：数据库实体
- `model/`：前后端传输对象
- `data-build/`：数据库初始化脚本

## 技术栈

- Java + Spring Boot
- MyBatis
- Maven（含 mvnw 包装器）

## 运行

```powershell
mvn spring-boot:run
```

## 说明

本项目为学习/练习性质项目，数据库初始化脚本位于 `data-build/` 目录。
