# Sekai Song Player

`memory-5` 是一个和 `memory-three` 同类结构的 Spring Boot + Thymeleaf + MyBatis 项目，主题是二次元音乐播放器。

## 功能

- 用户注册、登录、退出
- 专属动漫歌曲库
- 背景二次元播放器皮肤
- LRC 歌词同步显示
- 收藏歌曲
- 自定义歌单和歌单歌曲管理
- 歌曲 / 歌单搜索
- 网易云单曲分享链接播放，粘贴到“音频 URL / 网易云单曲分享链接”即可
- 商业化服务页，用于展示私有音乐库部署、主题定制和维护套餐

## 商业化定位

推荐把项目作为“私有化音乐库搭建服务”售卖：

- 可以收费：本地部署、NAS/服务器部署、主题定制、数据迁移、备份恢复、长期维护。
- 不要收费售卖：QQ 音乐、网易云音乐、B 站等第三方平台的歌曲资源、视频资源或公开在线播放曲库。
- 用户上传内容应由用户自行确认拥有合法使用权，公开演示环境建议使用自制音乐、授权音乐或无版权素材。

项目内置 `/business` 页面，可以作为接单介绍和报价思路的展示页。
公开获客页为 `/service`，客户可以在页面里提交咨询；登录后台后可在 `/business/leads` 查看和更新线索状态。
授权中心为 `/license`，客户可输入授权码激活专业版或续费；默认新注册账号有 7 天试用期。
授权码管理页为 `/business/licenses`，默认管理员账号 `sekai` 可以生成专业版、试用版和永久版授权码。

平台发布文案见：

```text
docs/monetization-platform-copy.md
```

## 外部上传目录

大体积本地音频可以放在外部上传目录，默认路径：

```text
D:/SekaiSongExternalUploads/memory-5/uploads
```

访问 URL 前缀为 `/external-uploads/**`。如果要换目录，可以通过环境变量或 JVM 参数配置：

```bash
SEKAI_EXTERNAL_UPLOAD_ROOT=D:/YourUploadRoot/uploads
mvn spring-boot:run
```

或：

```bash
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Dsekai.externalUploadRoot=D:/YourUploadRoot/uploads"
```

## 数据库

表都创建在 `sekai_friend` 数据库中，前缀为 `sekai_song_`。

```sql
SOURCE build-data/sekai-song.sql;
```

默认测试账号：

- 用户名：`sekai`
- 密码：`123456`

## 启动

```bash
mvn spring-boot:run
```

默认端口：`8085`
