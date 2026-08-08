# memory-9 · SekaiForm 表单与对话系统

一个基于 **Spring Boot + Thymeleaf + MyBatis** 的表单与 AI 对话系统，用于收集用户表单数据、意图识别与工具调用。

## 功能

- 用户表单填写与提交
- 意图识别（intent）与多轮对话
- 城市选择 / 日志记录 / 模型选择
- Live2D（pixi-live2d）角色展示
- 工具调用（tool choice）
- 对话状态检查与异步处理

## 项目结构

- `SekaiForm/`：Spring Boot 主项目（`com.sekai.sekai_form`，control / service / dataobject 分层）
- 根目录下包含多个 Python 辅助脚本：
  - `add_*.py`：向数据库或系统添加城市、意图、日志、模型、Live2D、工具选择等数据
  - `check_*.py`：检查状态、函数、共存、最终一致性等
  - `chk_*.py`：对话/代码/异步校验脚本
  - `chat_method.txt`：对话方式说明

## 运行

```powershell
cd SekaiForm
mvn spring-boot:run
```

## 说明

本项目的业务数据表统一使用 `sekai_form_` 前缀，数据库为 `sekai_friend`。
