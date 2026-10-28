# Sekai Song Player

`memory-5` 是一个 Spring Boot + Thymeleaf + MyBatis 的二次元音乐播放器，专注于个人歌库整理、歌单管理和本地播放。

## 功能

- 用户注册、登录、退出
- 歌曲库、收藏、歌单和全局搜索
- LRC 同步歌词、播放队列、顺序/随机/单曲循环
- 睡眠定时、播放速度、音量、均衡器和 A-B 片段循环
- 时间书签、最近播放记录和本地音频/视频绑定
- 网易云、QQ 音乐、B 站歌曲/视频链接导入

网易云、QQ 音乐、B 站仅用于粘贴歌曲/歌单链接导入歌曲信息，不内嵌第三方平台页面。

## 手机端适配（2026-10-10）

电脑（≥981px）保持原有左侧栏布局不变；手机和平板（≤980px）走同一套响应式层：

- 侧栏变成 65px 吸顶导航条，导航项收进「菜单」折叠面板（遮罩点击、Esc、选中链接都会关闭）。
- 歌曲库 / 歌单页的横向胶片条允许纵向拖动，翻页控件固定在首屏内，卡片封面不再是长方形裁切。
- 播放页三种演出（唱片 / 字阵 / Folia）按真实可视高度布局：封面与圆盘不再左右被裁，
  进度条命中区 44px（视觉轨道粗细不变），控件条在窄屏吸底，队列抽屉不再把「播放队列」挤成 0 高，
  字阵 / Folia 舞台在没有歌词时给出提示。
- 破坏性操作（删除歌单、移除歌曲）在手机上有 44px 命中区并带二次确认。

改动落在 `app.css` / `player-stage.css` / `songs-selection.css` / `playlists-selection.css` 末尾的
「手机端适配层」小节（用更高特异性 + 靠后的顺序压过文件前面的旧规则），
以及 `fragments.html`、`app-motion.js`、`songs-selection.js`、`playlists-selection.js`、`lyrics-stage.js`。
模板里的静态资源版本号已同步更新，回访用户不会拿到旧 CSS/JS。

### 手机端回归验证

```bash
# 111 项布局/交互断言（导航、胶片条、舞台、抽屉、触控尺寸、长列表可见性）
# 依赖 tools/browser-qa-runtime 下已安装的 playwright-core，浏览器用本机 Edge
node tools/browser-qa-runtime/verify-mobile.js --url=http://127.0.0.1:8085

# 全站几何体检（横向溢出 / 越界元素 / 小触控目标 / 小字号）
node tools/browser-qa-runtime/mobile-audit.js --url=http://127.0.0.1:8085

# 截图（手机 390 / 平板 768 / 桌面 1440）
node tools/browser-qa-runtime/shot.js --url=http://127.0.0.1:8085 --vps=390,768,1440
```

验证脚本使用独立测试账号 `qa_mobile_layout`（密码 `123456`）。它由
`tools/qa-mobile-fixture.sql` 创建：从现有歌库复制少量「有歌词音频 / 无歌词音频 / B 站视频」
三类歌曲和一张歌单，方便复现三种演出和空歌词提示，不会改动你自己的歌单数据。

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

启动前设置本机 MySQL 凭据：

```powershell
$env:DB_URL="jdbc:mysql://127.0.0.1:3306/sekai_friend?serverTimezone=Asia/Shanghai&useUnicode=true&characterEncoding=utf-8&useSSL=false&allowPublicKeyRetrieval=true"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="你的数据库密码"
```

如果使用 IntelliJ IDEA，请将上述变量填入运行配置的 **Environment variables**。

```bash
mvn spring-boot:run
```

默认端口：`8085`
