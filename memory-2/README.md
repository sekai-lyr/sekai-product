# eBusiness 电商练习项目

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![MyBatis](https://img.shields.io/badge/MyBatis-3-lightgrey)
![Maven](https://img.shields.io/badge/Maven-Wrapper-blue)

基于 **Spring Boot + MyBatis** 的电商业务练习项目，采用 `com.youkeda.application.ebusiness` 包结构，分层清晰，适合作为电商后端入门与进阶参考。

## 📐 分层架构

```text
control ──▶ service ──▶ dao ──▶ MySQL
    │            │
    └── model ───┘ (前后端传输对象)
```

- `control/`：接口入口
- `service/`：业务逻辑
- `dao/`：数据访问层
- `dataobject/`：数据库实体
- `model/`：前后端传输对象
- `data-build/`：数据库初始化脚本

## 🛠️ 技术栈

- Java + Spring Boot
- MyBatis
- Maven（含 `mvnw` 包装器）

## ▶️ 运行

```powershell
mvn spring-boot:run
```

## 📝 说明

本项目为学习 / 练习性质项目，数据库初始化脚本位于 `data-build/` 目录。
