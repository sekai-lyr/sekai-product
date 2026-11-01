<div align="center">

# 🤖 Anime AI · 识番推荐与 RAG 助手平台

> ⭐ Sekai 系列实战项目 14 / 14 · 单项目独立仓库

![Java](https://img.shields.io/badge/Java-red?style=flat-square&logo=openjdk&logoColor=white) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white) ![Spring AI](https://img.shields.io/badge/Spring%20AI-6DB33F?style=flat-square) ![RAG](https://img.shields.io/badge/RAG-blue?style=flat-square) ![ONNX](https://img.shields.io/badge/ONNX-blue?style=flat-square)

[![Stars](https://img.shields.io/github/stars/sekai-lyr/memory-14?style=flat-square&logo=github)](https://github.com/sekai-lyr/memory-14/stargazers) [![合集](https://img.shields.io/badge/📚_全系列合集-sekai--product-8250DF?style=flat-square)](https://github.com/sekai-lyr/sekai-product)

</div>

---

基于 **Spring Boot + Spring AI + Thymeleaf** 的动漫角色 AI 聊天平台，支持角色识别、番剧推荐与追番提醒。

## 功能

- 动漫角色识别
- 番剧推荐与追番提醒
- AI 聊天对话
- RAG 知识库问答（`rag_knowledge.sqlite`）

## 技术栈

- Java + Spring Boot（spring-ai-bom）
- Thymeleaf 模板
- 视觉模型推理（ONNX Runtime，含 CUDA 支持）
- H2 / SQLite 数据存储

## 运行

```powershell
mvn spring-boot:run
```

## 说明

- `data/`：数据库文件与视觉模型（`vision_model.onnx` 等，大文件未上传）。
- `.venv-clip/`：本地 CLIP 虚拟环境，未上传。
- `.edge-*`：本地调试临时目录。

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
