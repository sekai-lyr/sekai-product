# SekaiAnimeVideo · 动漫视频导航站

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1)

基于 **Spring Boot** 的动漫视频站点导航 / 聚合项目，作为动漫流媒体站点统一入口。

## ✨ 功能

- 动漫视频站点聚合与导航
- 站点跳转（redirect）服务

## 📐 项目结构

```text
SekaiAnimeVideo/
├── database/    # 数据库脚本
└── src/         # control / service / dataobject / model 分层
```

## ▶️ 运行

```powershell
cd SekaiAnimeVideo
mvn spring-boot:run
```

## 📝 说明

- 根目录包含 `fix_*.py` 修复脚本与运行日志（`*.log`、`*.txt`）
- `cookies.txt` 等为本地运行调试文件，请注意不要泄露敏感信息
