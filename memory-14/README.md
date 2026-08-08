# anime-ai · 动漫 AI 聊天平台

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![Spring AI](https://img.shields.io/badge/Spring%20AI-1.0-purple)
![RAG](https://img.shields.io/badge/RAG-知识库-8A2BE2)
![ONNX](https://img.shields.io/badge/ONNX-Runtime-005B96)
![Thymeleaf](https://img.shields.io/badge/Thymeleaf-3-005F0F)

基于 **Spring Boot + Spring AI + Thymeleaf** 的动漫角色 AI 聊天平台，支持角色识别、番剧推荐、追番提醒与 RAG 知识库问答。

## ✨ 功能

- 动漫角色识别
- 番剧推荐与追番提醒
- AI 聊天对话
- 宠物 / 植物档案（PetProfile、PlantProfile）与护理记录（CareRecord）管理
- RAG 知识库问答（`rag_knowledge.sqlite`）

## 🛠️ 技术栈

- Java + Spring Boot（spring-ai-bom）
- Thymeleaf 模板
- 视觉模型推理（ONNX Runtime，含 CUDA 支持）
- H2 / SQLite 数据存储

## 📐 项目结构

```text
memory-14
├── pom.xml
├── src/                       # Spring Boot 源码
│   ├── PetProfile.java / PlantProfile.java / CareRecord.java
│   └── repository / service / control 分层
├── data/                      # 数据库与视觉模型（vision_model.onnx 等，大文件未上传）
├── rag_knowledge.sqlite       # RAG 知识库
└── tools/
```

## ▶️ 运行

```powershell
mvn spring-boot:run
```

## 📝 说明

- `data/`：数据库文件与视觉模型（`vision_model.onnx` 等，大文件未上传）
- `.venv-clip/`：本地 CLIP 虚拟环境，未上传
- `.edge-*`：本地调试临时目录
