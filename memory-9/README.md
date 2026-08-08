# SekaiForm · 表单与 AI 对话系统

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![Thymeleaf](https://img.shields.io/badge/Thymeleaf-3-005F0F)
![MyBatis](https://img.shields.io/badge/MyBatis-3-lightgrey)
![Live2D](https://img.shields.io/badge/Live2D-pixi--live2d-ff69b4)
![AI](https://img.shields.io/badge/意图识别-工具调用-purple)

基于 **Spring Boot + Thymeleaf + MyBatis** 的表单与 AI 对话系统：收集用户表单数据、意图识别与工具调用，支持 Live2D 角色展示。

## ✨ 功能

- 用户表单填写与提交
- 意图识别（intent）与多轮对话
- 城市选择 / 日志记录 / 模型选择
- Live2D（pixi-live2d）角色展示
- 工具调用（tool choice）
- 对话状态检查与异步处理

## 📐 项目结构

- `SekaiForm/`：Spring Boot 主项目（`com.sekai.sekai_form`，control / service / dataobject 分层）
- 根目录下包含多个 Python 辅助脚本：
  - `add_*.py`：向数据库或系统添加城市、意图、日志、模型、Live2D、工具选择等数据
  - `check_*.py`：检查状态、函数、共存、最终一致性等
  - `chk_*.py`：对话 / 代码 / 异步校验脚本
  - `chat_method.txt`：对话方式说明

## ▶️ 运行

```powershell
cd SekaiForm
mvn spring-boot:run
```

## 📝 说明

业务数据表统一使用 `sekai_form_` 前缀，数据库为 `sekai_friend`。
