# memory-14 · anime-ai 动漫 AI 聊天平台

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
