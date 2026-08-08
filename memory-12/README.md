# memory-12 · SekaiLearning 二次元学习平台

一个基于 **Spring Boot + Thymeleaf + MyBatis** 的二次元风格学习平台，通过游戏化方式提升学习兴趣。

## 功能

- 二次元风格界面
- 背单词等学习功能
- 游戏化学习与积分机制
- 兴趣社群

## 项目结构

- `SekaiLearning/`：Spring Boot 主项目
  - `seed/`：种子数据
  - `src/`：源码
  - `init.sql`：数据库初始化脚本

## 运行

```powershell
cd SekaiLearning
mvn spring-boot:run
```

## 说明

- 数据库表使用 `sekai_learning_` 前缀（数据库 `sekai_friend`）。
- 初始化脚本：`SekaiLearning/init.sql`。
