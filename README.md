# Sekai Product · 次元产品集

> 13 个可运行的完整项目，覆盖电商、社交、音乐、游戏、AI、RAG、视觉小说与 PvP 实时对战。
> 从 `memory-2` 到 `memory-14`，每一段 memory 都是一个独立的实战项目。

![Build](https://img.shields.io/github/actions/workflow/status/sekai-lyr/sekai-product/ci.yml?branch=main&label=CI%20Build&logo=github)
![License](https://img.shields.io/github/license/sekai-lyr/sekai-product)
![Java](https://img.shields.io/badge/Java-17|21-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x%20%7C%204.x-brightgreen)
![MyBatis](https://img.shields.io/badge/MyBatis-3-lightgrey)
![Vue 3](https://img.shields.io/badge/Vue%203-Composition-brightgreen)
![Godot 4](https://img.shields.io/badge/Godot-4.7-blue)
![Ren'Py](https://img.shields.io/badge/Ren'Py-AVG-ff69b4)
![Spring AI](https://img.shields.io/badge/Spring%20AI-1.0-purple)
![WebSocket](https://img.shields.io/badge/WebSocket-PvP-blueviolet)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1)
![Thymeleaf](https://img.shields.io/badge/Thymeleaf-3-005F0F)

---

## ✨ 项目一览

| Memory | 项目 | 类型 | 亮点技术 |
|--------|------|------|----------|
| [memory-2](memory-2/) | eBusiness 电商练习 ✅ | 电商 Web | Spring Boot + MyBatis 分层架构（[独立仓库](https://github.com/sekai-lyr/sekai-ebusiness)） |
| [memory-3](memory-3/) | Sekai Memory Book ✅ | 二次元回忆录 | 番剧/角色/台词记录，带盐哈希密码（[独立仓库](https://github.com/sekai-lyr/sekai-memory-book)） |
| [memory-4](memory-4/) | Sekai Fortune 抽签 ✅ | 运势抽签 MVP | 会员闭环、后台审批、环境变量化配置（[独立仓库](https://github.com/sekai-lyr/sekai-fortune)） |
| [memory-5](memory-5/) | Sekai Song Player ✅ | 音乐播放器 | LRC 歌词同步、网易云分享链接、授权体系（[独立仓库](https://github.com/sekai-lyr/sekai-song-player)） |
| [memory-6](memory-6/) | Sekai 2048 ✅ | 休闲游戏 | VIP 订阅、云存档、AI 教练、广告位（[独立仓库](https://github.com/sekai-lyr/sekai-2048)） |
| [memory-7](memory-7/) | Sekai Picture Wallpaper ✅ | 壁纸图库 | 上传、筛选、批量操作、运营看板（[独立仓库](https://github.com/sekai-lyr/sekai-wallpaper)） |
| [memory-8](memory-8/) | English Word Learning ✅ | 单词学习 | Vue 3 + Spring Data JPA + 错题本（[独立仓库](https://github.com/sekai-lyr/english-word-learning)） |
| [memory-9](memory-9/) | SekaiForm AI 对话 ✅ | AI 表单 | 意图识别、工具调用、Live2D 角色（[独立仓库](https://github.com/sekai-lyr/sekai-form-ai)） |
| [memory-10](memory-10/) | SekaiAnimeVideo ✅ | 动漫导航站 | 站点聚合与跳转服务（[独立仓库](https://github.com/sekai-lyr/sekai-anime-video)） |
| [memory-11](memory-11/) | Sekai Duel 夜曲决斗 ✅ | 卡牌游戏 | WebSocket PvP + Godot 4 客户端 + 游戏王规则（[独立仓库](https://github.com/sekai-lyr/sekai-duel)） |
| [memory-12](memory-12/) | SekaiLearning ✅ | 学习平台 | 游戏化学习、积分、社群（[独立仓库](https://github.com/sekai-lyr/sekai-learning)） |
| [memory-13](memory-13/) | 谎言十年 ✅ | 视觉小说 AVG | Ren'Py 引擎、多语言、APK 发布（[独立仓库](https://github.com/sekai-lyr/lies-ten-years)） |
| [memory-14](memory-14/) | anime-ai 动漫智能助手 ✅ | AI 应用 | 截图识番 + 角色识别 + Spring AI + RAG + TTS/ASR（[独立仓库](https://github.com/sekai-lyr/anime-ai)） |

---

## 🧱 技术栈全景

```text
后端      Java 17 · Spring Boot 3 · MyBatis · Spring Data JPA · Spring Security
前端      Thymeleaf · Vue 3 · Axios · 原生 CSS · Live2D (pixi-live2d)
实时通信  WebSocket (PvP 对战中继)
AI        Spring AI · RAG (SQLite 知识库) · ONNX Runtime (CUDA) · 意图识别 · 工具调用
游戏      Godot 4.7 · Ren'Py · 游戏王规则引擎
数据      MySQL 8 · H2 · SQLite
构建      Maven (mvnw 包装器) · npm
```

---

## 🚀 快速开始

每个 memory 都是独立可运行的 Spring Boot 项目：

```powershell
# 以 memory-8 为例
cd memory-8
mysql -uroot -p < database/schema.sql
mvn spring-boot:run
# 访问 http://localhost:8088/login
```

各项目的数据库脚本（`build-data/` 或 `database/`）与环境变量说明见对应目录 README。

---

## 🏗️ 架构模式

所有 Web 项目遵循统一分层，便于学习与二开：

```text
control → service → dataobject / repository / dao
   ↑                    ↓
model ◄──────────  MySQL (sekai_friend)
```

- `control/`：REST / 页面接口入口
- `service/`：业务逻辑
- `dataobject/` / `repository` / `dao`：数据层
- `model/`：前后端传输对象与统一返回

数据库统一使用 `sekai_friend`，业务表带 `sekai_` 前缀，数据访问全部环境变量化，不写死生产密码。

---

## 🎯 设计理念

- **每个 memory 都是完整闭环**：数据库脚本 → 后端 → 前端 → 测试 → 部署说明
- **商业化为纲**：多个项目内置会员体系、授权码、后台线索、运营看板
- **场景多元**：从传统 CRUD 到 PvP 实时对战、从表单到 AI + RAG
- **版权合规**：涉及动漫素材的项目均保留原创设定替换方案与商用提醒

---

## 📄 License

[MIT](LICENSE)
