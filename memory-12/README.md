# SekaiLearning · 二次元游戏化学习平台

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![Thymeleaf](https://img.shields.io/badge/Thymeleaf-3-005F0F)
![MyBatis](https://img.shields.io/badge/MyBatis-3-lightgrey)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1)

基于 **Spring Boot + Thymeleaf + MyBatis** 的二次元风格学习平台，通过游戏化机制提升学习兴趣。

## ✨ 功能

- 二次元风格界面
- 背单词等学习功能
- 游戏化学习与积分机制
- 兴趣社群

## 📐 项目结构

```text
SekaiLearning/
├── seed/        # 种子数据
├── src/         # 源码
└── init.sql     # 数据库初始化脚本
```

## ▶️ 运行

```powershell
cd SekaiLearning
mvn spring-boot:run
```

## 📝 说明

- 数据库表使用 `sekai_learning_` 前缀（数据库 `sekai_friend`）
- 初始化脚本：`SekaiLearning/init.sql`
