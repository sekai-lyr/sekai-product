<div align="center">

# 🎋 Sekai Fortune · 角色抽签与今日运势

> ⭐ Sekai 系列实战项目 04 / 14 · 单项目独立仓库

![Java](https://img.shields.io/badge/Java-red?style=flat-square&logo=openjdk&logoColor=white) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white) ![MyBatis](https://img.shields.io/badge/MyBatis-blue?style=flat-square) ![Thymeleaf](https://img.shields.io/badge/Thymeleaf-blue?style=flat-square) ![MySQL](https://img.shields.io/badge/MySQL-blue?style=flat-square)

[![Stars](https://img.shields.io/github/stars/sekai-lyr/memory-4?style=flat-square&logo=github)](https://github.com/sekai-lyr/memory-4/stargazers) [![合集](https://img.shields.io/badge/📚_全系列合集-sekai--product-8250DF?style=flat-square)](https://github.com/sekai-lyr/sekai-product)

</div>

---

统一角色库抽签与今日运势 Web 应用。普通用户不能新增角色，只能从数据库已有角色里抽签、收藏、查看历史；角色库由项目种子数据维护。

项目保留 `control / model / dataobject / mapper / service` 分层，数据表使用 `sekai_Draw_lots_` 前缀。

## 功能范围

- 抽签：今日固定签、随机再抽、三连签仪式（免费开放）。
- 转盘：自建分区转盘 + 智能补全分区（根据最近抽签历史生成，免费开放）。
- 伙伴库 / 历史 / 收藏 / 成就徽章。
- 抽签结果可生成分享卡（免费开放）。

## 初始化数据库

先创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS sekai_friend DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

在项目根目录执行：

```powershell
mysql -uroot -p --default-character-set=utf8mb4 -D sekai_friend < build-data/init.sql
```

## 运行

设置数据库环境变量：

```powershell
$env:DB_URL="jdbc:mysql://127.0.0.1:3306/sekai_friend?serverTimezone=Asia/Shanghai&useUnicode=true&characterEncoding=utf-8&useSSL=false&allowPublicKeyRetrieval=true"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="你的数据库密码"
$env:SERVER_PORT="8084"
```

启动应用：

```powershell
mvn spring-boot:run
```

默认端口：`8084`。

---

## 🗺️ Sekai 项目全景导航

本项目是 **Sekai 系列作品集** 的一员，全部 14 个实战项目：

| 项目 | 简介 |
|------|------|
| [`memory-1`](https://github.com/sekai-lyr/memory-1) | 📊 二次元数据中心 |
| [`memory-2`](https://github.com/sekai-lyr/memory-2) | 🛒 二次元电商商城 |
| [`memory-3`](https://github.com/sekai-lyr/memory-3) | 📔 二次元回忆录 |
| [`memory-4`](https://github.com/sekai-lyr/memory-4) | 🎋 角色抽签与今日运势 |
| [`memory-5`](https://github.com/sekai-lyr/memory-5) | 🎵 歌词同步音乐播放器 |
| [`memory-6`](https://github.com/sekai-lyr/memory-6) | 🎮 原创角色合成小游戏 |
| [`memory-7`](https://github.com/sekai-lyr/memory-7) | 🖼️ 二次元壁纸图库系统 |
| [`memory-8`](https://github.com/sekai-lyr/memory-8) | 📖 英语单词学习系统 |
| [`memory-9`](https://github.com/sekai-lyr/memory-9) | 📝 表单收集与 AI 对话系统 |
| [`memory-10`](https://github.com/sekai-lyr/memory-10) | 📺 动漫视频导航站 |
| [`memory-11`](https://github.com/sekai-lyr/memory-11) | ⚔️ 游戏王规则卡牌对战 |
| [`memory-12`](https://github.com/sekai-lyr/memory-12) | 🎓 游戏化学习平台 |
| [`memory-13`](https://github.com/sekai-lyr/memory-13) | 🎭 Ren'Py 视觉小说 |
| [`memory-14`](https://github.com/sekai-lyr/memory-14) | 🤖 识番推荐与 RAG 助手平台 |

📦 **一站式浏览全部项目**：[sekai-lyr/sekai-product](https://github.com/sekai-lyr/sekai-product)（monorepo 合集）

<div align="center">

**如果这个项目对你有帮助或启发，欢迎点一个 ⭐ Star 支持一下！**

*Made with ❤️ by [sekai-lyr](https://github.com/sekai-lyr)*

</div>
