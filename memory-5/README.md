# Sekai Song Player · 二次元音乐播放器

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![MyBatis](https://img.shields.io/badge/MyBatis-3-lightgrey)
![Thymeleaf](https://img.shields.io/badge/Thymeleaf-3-005F0F)
![LRC](https://img.shields.io/badge/LRC-歌词同步-brightgreen)

二次元主题音乐播放器：专属动漫歌曲库、LRC 歌词同步、自定义歌单与授权体系，内置商业化服务页。

## ✨ 功能亮点

- 用户注册、登录、退出
- 专属动漫歌曲库
- 背景二次元播放器皮肤
- LRC 歌词同步显示
- 收藏歌曲
- 自定义歌单和歌单歌曲管理
- 歌曲 / 歌单搜索
- 网易云单曲分享链接直接播放（粘贴到"音频 URL / 网易云单曲分享链接"即可）
- 商业化服务页，用于展示私有音乐库部署、主题定制和维护套餐

## 💰 商业化定位

推荐把项目作为"私有化音乐库搭建服务"售卖：

- ✅ 可以收费：本地部署、NAS/服务器部署、主题定制、数据迁移、备份恢复、长期维护
- ⚠️ 不要售卖：QQ 音乐、网易云音乐、B 站等第三方平台的歌曲资源、视频资源或公开在线播放曲库
- 📌 用户上传内容应由用户自行确认拥有合法使用权

### 内置商业页面

- `/business`：接单介绍和报价思路展示页
- `/service`：公开获客页，客户可提交咨询
- `/license`：授权中心，客户输入授权码激活专业版或续费（默认新账号 7 天试用期）
- `/business/licenses`：授权码管理页（默认管理员 `sekai`），可生成专业版、试用版和永久版授权码
- `/business/leads`：线索管理后台

平台发布文案见 `docs/monetization-platform-copy.md`。

## 📁 外部上传目录

大体积本地音频可放外部目录（默认 `D:/SekaiSongExternalUploads/memory-5/uploads`，URL 前缀 `/external-uploads/**`）：

```bash
SEKAI_EXTERNAL_UPLOAD_ROOT=D:/YourUploadRoot/uploads
mvn spring-boot:run
```

## 🗄️ 数据库

表创建在 `sekai_friend` 数据库中，前缀 `sekai_song_`：

```sql
SOURCE build-data/sekai-song.sql;
```

默认测试账号：`sekai` / `123456`

## ▶️ 启动

```bash
mvn spring-boot:run
```

默认端口：`8085`
