# 浏览器本地音乐

入口 `/local-player` 是导入工具：选择文件夹或单首音乐 → 检查匹配结果 → 选择原歌曲库、已有歌单或新歌单 → 确认导入。确认前不保存账户字段。未登录可预览，登录后重新选择文件即可导入。确认后跳转原歌曲库或歌单，不建立第二套曲库。

从原歌曲库/歌单打开 `/player/{id}` 时，进入带 songId 的本地播放页，用本机文件句柄恢复并支持四种演出。音频通过 Blob URL 播放，不写入服务器，也不复制到 IndexedDB。普通文件输入的浏览器关闭页面后需要重新选择；播放入口重新关联后原地播放，不再跳回歌曲库。

登录后加载账户歌曲和歌单。服务器只新增 `sekai_song_local_binding` 字段表，保存文件名、大小、修改时间，以及收藏、循环、书签、音量、速度、播放位置和演出偏好。新增音乐只提交JSON字段，不提交音频或封面二进制。所有修改按session账户鉴权并使用独立CSRF令牌。

支持 File System Access API 的浏览器在“选择音乐文件夹”时自动记住只读文件句柄，IndexedDB不保存音频Blob。同目录同名 .lrc、.jpg/.jpeg/.png/.webp 自动匹配；缺歌词或封面在结果中提示，仍可导入。文件留在各个用户自己的设备，不会自动转移到手机。换设备、换浏览器、换域名都需要重新关联。授权失效时才显示重新授权按钮；文件缺失不自动删除账户记录。歌词文本作为小字段保存到账户，封面二进制仍在本机。最终域名为 `sekaisong.com`，持久文件授权需要HTTPS（localhost测试也属于安全上下文）。

`/local-stage` 复用四种既有演出。父页面保留 File 引用，切换舞台时保留播放时间及暂停状态。内嵌标签由 music-metadata 的 parseBlob 按片段读取；优先使用内嵌同步歌词或同名 LRC。无同步时间戳的歌词不伪造逐字时间。云端歌词匹配需要现有登录账号，只发送标题和歌手。

构建解析器：在 D:/dsh-render/local-player-build 安装 music-metadata@12.1.0 与 esbuild，运行 `node tools/local-player/build.mjs`。解析器为 MIT 许可，许可证随 vendor 资源保留。

当前本机验收：`node tools/local-player/import-preview-qa.mjs`、`node tools/local-player/layout-qa.mjs`；验证确认前无POST、桌面/手机布局。

`node tools/local-player/import-flow-qa.mjs` 使用独立浏览器、账户API测试替身和真实本地音频，验证自动匹配、导入请求、句柄重新打开和四种演出；不修改数据库。真实数据库与原歌单/歌曲库页面验收：`mvn -q -o -Dtest=LocalImportIntegrationTest test`，使用已有QA账户31，测试写入全部事务回滚，不修改用户表。旧 qa.mjs/account-qa.mjs 是旧“选择后立即保存”流程的历史脚本，不用于新版导入流程验收。

`seed-sekai.mjs` 只为现有sekai歌曲记录本机文件名和大小，保留全部歌曲，不上传音频、不修改用户密码。它生成可同步到服务器的字段SQL和匹配报告。
