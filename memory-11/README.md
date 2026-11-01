<div align="center">

# ⚔️ Sekai Duel 夜曲决斗 · 游戏王规则卡牌对战

> ⭐ Sekai 系列实战项目 11 / 14 · 单项目独立仓库

![Java](https://img.shields.io/badge/Java-red?style=flat-square&logo=openjdk&logoColor=white) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white) ![WebSocket](https://img.shields.io/badge/WebSocket-blue?style=flat-square) ![Godot 4](https://img.shields.io/badge/Godot%204-blue?style=flat-square) ![PvP](https://img.shields.io/badge/PvP-blue?style=flat-square)

[![Stars](https://img.shields.io/github/stars/sekai-lyr/sekai-product?style=flat-square&logo=github)](https://github.com/sekai-lyr/sekai-product/stargazers) [![合集](https://img.shields.io/badge/📚_全系列合集-sekai--product-8250DF?style=flat-square)](https://github.com/sekai-lyr/sekai-product)

</div>

---

基于游戏王规则的二次元卡片决斗游戏，包含 **Java Web 后端** 与 **Godot 4 客户端** 两部分。

## 项目组成

### SekaiGame（Java 后端）

- Spring Boot + WebSocket + Spring Data JPA + MySQL
- 账号系统、收藏系统、PvP 实时对战中继服务
- 采用游戏王（Yu-Gi-Oh!）规则

### SekaiGameGodot（Godot 4 客户端）

- Godot 4.7 原生客户端迁移版本
- 导入 368 张有效卡牌
- 确定性洗牌、起手手牌、抽卡与回合切换
- 怪兽召唤、魔法发动、盖牌、战斗与直接攻击
- 核心效果分发、基础 AI 回合、`/ws/pvp` 消息协议
- 详见 `SekaiGameGodot/README.md`

## 运行

### 后端

```powershell
cd SekaiGame
mvn spring-boot:run
```

### Godot 客户端

使用 Godot 4.7.1 打开 `SekaiGameGodot` 目录即可。

## 其他目录

- `pricture/`、`analysis-contact-sheets/`、`audit-70-large/`：卡面图片与素材
- `picture-inventory.json`：图片素材清单
- `.tools/`、`.tmp-superpowers-*`：本地工具与临时文件

## 说明

游戏采用游戏王规则实现，卡面素材为个人使用，正式发布前需替换版权素材。

---

## 🗺️ Sekai 项目全景导航

本项目是 **Sekai 系列作品集** 的一员，全部 14 个实战项目：

| 项目 | 简介 |
|------|------|
| [`memory-1`](../memory-1/) | 📊 二次元数据中心 |
| [`memory-2`](../memory-2/) | 🛒 二次元电商商城 |
| [`memory-3`](../memory-3/) | 📔 二次元回忆录 |
| [`memory-4`](../memory-4/) | 🎋 角色抽签与今日运势 |
| [`memory-5`](../memory-5/) | 🎵 歌词同步音乐播放器 |
| [`memory-6`](../memory-6/) | 🎮 原创角色合成小游戏 |
| [`memory-7`](../memory-7/) | 🖼️ 二次元壁纸图库系统 |
| [`memory-8`](../memory-8/) | 📖 英语单词学习系统 |
| [`memory-9`](../memory-9/) | 📝 表单收集与 AI 对话系统 |
| [`memory-10`](../memory-10/) | 📺 动漫视频导航站 |
| [`memory-11`](https://github.com/sekai-lyr/sekai-product) | ⚔️ 游戏王规则卡牌对战 |
| [`memory-12`](../memory-12/) | 🎓 游戏化学习平台 |
| [`memory-13`](../memory-13/) | 🎭 Ren'Py 视觉小说 |
| [`memory-14`](../memory-14/) | 🤖 识番推荐与 RAG 助手平台 |

📦 **一站式浏览全部项目**：[sekai-lyr/sekai-product](https://github.com/sekai-lyr/sekai-product)（monorepo 合集）

<div align="center">

**如果这个项目对你有帮助或启发，欢迎点一个 ⭐ Star 支持一下！**

*Made with ❤️ by [sekai-lyr](https://github.com/sekai-lyr)*

</div>
