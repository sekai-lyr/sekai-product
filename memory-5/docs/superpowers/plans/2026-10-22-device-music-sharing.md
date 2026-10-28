# 设备音乐共享实现计划

> 面向执行者：使用 executing-plans 按任务实现；每个任务先运行失败测试，再实现并验证。本目录不是 Git 仓库，不创建虚假的提交记录。

目标：任意账号可持久绑定供音电脑，并可启停同账号跨设备音乐共享。

架构：MySQL 管理设备身份及原有歌曲字段，Node.js 电脑端持久保存授权目录和实际文件映射，主动 WSS 中转，浏览器使用同源受保护媒体 URL。在线目录每次连接重新登记，不将绝对路径存入云端。源码默认禁用；用户确认后才启用正式站。

2026-10-23 发布状态与逐项验证边界见 [发布记录](../../device-sharing-release-2026-10-23.md)。下列尚未勾选的验收项不能被解释为已经通过全部实体设备、视觉和负载测试。

技术栈：Java 21、Spring Boot 4、JdbcTemplate、MySQL、Node.js、现有播放器。

## 任务 1：设备身份和权限边界

文件：新增 db/device-sharing.sql、service/DeviceSharingService.java、control/DeviceSharingControl.java、service/DeviceSharingServiceTest.java；前缀均位于现有 src/main/resources 或 src/main/java/com/sekai/song 下。

- [x] 先写配对、过期、重放、错误凭证、跨账号、撤销、默认禁用测试。对不存在的实现运行测试观察失败。
- [x] 使用 SecureRandom 生成 32 字节配对凭证和设备凭证，持久化 SHA-256 摘要；事务内一次性消费配对凭证。`authenticate(deviceId, token)` 只接受未撤销设备。
- [x] 所有网页写操作使用现有 localLibraryCsrf。功能由 `sekai.deviceSharing.enabled=false` 默认禁用。创建 SQL 为人工迁移脚本，不在启动时自动改线上数据库。
- [x] `mvn -o -Dtest=DeviceSharingServiceTest test`；默认禁用、未登录、无 CSRF、错误所有者和凭证重放均拒绝。

## 任务 2：电脑端授权目录和文件读取

文件：tools/device-sharing/files.mjs、files.test.mjs、client.mjs、README.md。

- [x] 先测试路径穿越、junction/symlink、文件删除、重名冲突及重启回读。
- [x] 本机保存根目录和 `{songId, relativePath, size}` 映射；每次读取校验所有路径分量、真实路径和文件类型，只读音视频及已确认的歌词封面，不接受服务器下发绝对路径。
- [x] 本机配置采用当前用户加密凭证及原子替换，回读校验成功才显示记住。启动默认不共享，不自动设开机任务。
- [x] `node --test tools/device-sharing/files.test.mjs`，临时夹具结束回收；不扫描真实用户目录进行测试。

## 任务 3：受限流式通道

文件：新增 config/DeviceChannelConfig.java、service/DeviceRelay.java、control/DeviceMediaControl.java 及对应测试；扩展 client.mjs。

- [ ] 增加 spring-boot-starter-websocket；先测试认证、断开、取消、第三路请求、超时及停止共享。
- [x] JSON 仅传控制消息；二进制帧传输媒体，每帧最多 64 KiB，每路最多 256 KiB 在途，最多 2 路。客户端响应正文获得确认后再读下一块。
- [x] GET/HEAD 经账号、歌曲和设备权限校验后建立中转；单段 Range 正确返回 206/416。输出无整文件缓冲、无音频落盘。关闭共享或撤销时取消所有活动请求。
- [ ] 独立端到端测试使用临时合成音频，验证 Range、取消、停止、离线及磁盘/内存边界；不把真实曲库当作公开测试文件。

## 任务 4：设置页面和播放器

文件：新增 templates/device-sharing.html、static/js/device-sharing.js；修改 PageControl、fragments.html 和 local-player.js；补浏览器与播放器回归。

- [ ] 先测试同账号状态列表、配对、开关以及本机优先/远程后备行为。
- [x] 共享页只展示本人设备和连接状态，开关需服务端及电脑端确认；未连接不显示共享成功。页面沿用现有样式，不改登录注册和演出布局。
- [x] 播放器区分 File/blob 与受保护远程 URL，沿用当前演出模式和音频主时钟；缺源仅提示，不连跳歌单。
- [ ] 验证完整 23 种演出接入未受破坏、远程音视频拖动、两账号隔离及停止共享。

## 发布门槛

- [ ] 规格中的 7 组验收逐项提供通过或未验证证据；没有完成电脑端和真实跨网络播放不得宣称功能已完成。
- [x] 全部已有测试通过。备份程序和数据库，人工新增表，源码默认禁用；用户已确认测试结果并允许在正式站启用。
- [x] 不创建公共文件目录、不复用部署密钥、不购买服务。Nginx 中转关闭代理磁盘缓冲，日志不泄露凭证或本地路径。
