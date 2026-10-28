# B 站视频封面：改为本地文件引用（2026-10-25）

## 设计原则（本次修正）

本项目**只做路径连接**：媒体与图片留在用户设备或原站，服务器不存副本。
B 站只是"取图渠道"——爬虫把封面抓到本地文件夹（`D:\Sekai_Song\sekai(B站)\bilibili-<id>-<cid>.jpg`），
应用再连**本地文件**，不再依赖 B 站 CDN。

> 中途我曾把 386 张封面下载到服务器（99 MB）做自托管，**违背这个原则，已全部删除并还原数据库**。

## 问题清单与修复

| # | 问题 | 修复 |
|---|---|---|
| 1 | 模板对 B 站条目不渲染 `<img>`，只输出纯 CSS 占位块 | 封面图始终渲染，`▶ B站视频` 降级为角标 |
| 2 | 本机关联不保存封面句柄，其它页面拿不到封面 | `addFiles()` 一并写入 `coverHandle` |
| 3 | 导入时封面优先取 `first_frame` 首帧截图 | 改为先取稿件 `pic`（仍只存引用） |
| 4 | 改了 CSS 没升 `?v=` 版本号，新旧样式叠加成"重影" | 相关资源版本升到 `20261025cover` / `20261025local` |
| 5 | 只认远程 URL，本地文件名会被当成相对路径 | 模板改用 `th:attr` 注入 `data-local-cover`，由前端解析成本地 blob |
| 6 | 曾用服务器副本绕开 B 站防盗链 | 已回滚，改为本地文件引用 |

## 数据：`cover_url` / `skin_url` 现在是本地文件名

- 328 首：`cover_url` = `bilibili-<歌曲id>-<cid>.jpg`（本地文件，爬虫已下载）
- 58 首：本地没有对应图片文件，保留原有的 B 站 URL（仅作兜底）
- 服务器 `/external-uploads/covers/` 已删除，0 个服务器副本

备份：`/opt/sekai-backups/bilibili-covers-local-20261025-192352/covers-before.tsv`（386 行旧值）

## 前端如何解析

`local-library-covers.js`（所有页面都加载）：

1. 卡片的 `data-local-cover` 是文件名 → 在"记住的文件夹"里按文件名匹配同名图片 → `URL.createObjectURL` 显示
2. 有本机关联的封面句柄（`user:<id>:song:<id>` 的 `cover`）→ 直接用
3. 视频没有同名图 → 从视频抽一帧兜底
4. 播放页 `local-player.js` 只把 `http(s)`/`/` 开头的值当 URL，文件名不做 URL 用

**前提**：浏览器里要保留对该文件夹的授权。之前用「选择文件夹 / 关联已有歌曲」方式关联过的账号
已经存了 `user:<id>:directories`，刷新即可；若只逐个选过文件，需要再选一次文件夹
（导入本地音乐 →「关联已有歌曲」→ 选文件夹），之后封面句柄会一并持久化。

## 发布记录

| 发布目录 | 内容 |
|---|---|
| `20261025-183810` | 模板 + CSS + JS + 导入顺序 |
| `20261025-185047` | 资源版本号（修重影） |
| `20261025-185750` | 封面 `referrerpolicy` |
| `20261025-19xxxx`（local-ref） | `data-local-cover` 本地文件名引用 |
| `20261025-19xxxx`（th:attr fix） | 改用 `th:attr` 注入属性（普通属性不会被 Thymeleaf 解析） |

部署方式：`tools/deploy/upgrade-playback-only.sh`（只换 jar，失败自动回滚）。

## 验收

- `/songs` `/playlist-detail` `/player/{id}` 全部 200，无模板异常
- 渲染结果里 `data-local-cover` 带的是真实取值（该歌曲的文件名或 URL），`tnsrc` 对本地文件名回落到占位图，不再产生 404
- Edge 真实登录：脚本加载成功、无页面报错；B 站远程封面图（未本地化的行）仍可加载（`no-referrer`）
- 服务器磁盘：`/opt/sekai-song/external-uploads` 8 KB

## 回滚

```bash
# 代码
install -o sekai -g sekai -m 640 /opt/sekai-backups/20261025-183810/app.jar /opt/sekai-song/app.jar
systemctl restart sekai-song
# 封面引用还原为 B 站 URL（如需）
mysql sekai_friend < /opt/sekai-backups/bilibili-covers-local-20261025-192352/migration.sql  # 反向使用前请先截取 backup 里的旧值
```
