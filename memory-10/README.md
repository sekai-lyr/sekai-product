# memory-10 · SekaiAnimeVideo 动漫视频导航站

一个基于 **Spring Boot** 的动漫视频站点导航/聚合项目，作为动漫流媒体站点入口。

## 功能

- 动漫视频站点聚合与导航
- 站点跳转（redirect）服务

## 项目结构

- `SekaiAnimeVideo/`：Spring Boot 主项目
  - `database/`：数据库脚本
  - `src/`：源码（control / service / dataobject / model 分层）

## 运行

```powershell
cd SekaiAnimeVideo
mvn spring-boot:run
```

## 说明

- 根目录包含 `fix_*.py` 修复脚本与运行日志（`*.log`、`*.txt`）。
- `cookies.txt` 等为本地运行调试文件，请注意不要泄露敏感信息。
