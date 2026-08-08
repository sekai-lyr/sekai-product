# Sekai Picture Wallpaper · 二次元壁纸图库

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![MyBatis](https://img.shields.io/badge/MyBatis-3-lightgrey)
![Thymeleaf](https://img.shields.io/badge/Thymeleaf-3-005F0F)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1)

完整的二次元壁纸图库系统：上传、分类、筛选、收藏、批量操作与运营看板一应俱全，可包装为图库系统源码 / 私有图床 / 壁纸资源站后台。

## ✨ 功能亮点

- 用户注册、登录、退出
- 壁纸分类管理和分类筛选
- 标题、角色、作品、标签关键词搜索
- 分页查询、色调筛选、比例筛选、下载量排序
- 上传自制壁纸（保存到 `uploads/wallpapers`）
- 收藏 / 取消收藏
- 一键下载和下载次数统计
- 热门壁纸推荐、随机抽图
- 批量收藏、批量取消收藏、批量移动分类
- 卡片内快速编辑标题、角色、来源、标签、色调和分类
- 会员中心演示：套餐、下载额度、商业化路径
- 运营看板：资产评分、收入模型、原创占比、收藏转化、热门榜

## 💰 变现方向

更适合包装成"图库系统源码 / 私有图床 / 壁纸资源站后台 / 接单展示项目"，不建议直接售卖未授权动漫图片。

- 卖源码：数据库脚本、部署教程、演示账号、二开服务
- 接定制：企业素材库、个人相册、COS 图库、摄影作品站
- 做会员演示：扩展 VIP 下载额度、高清包、批量打包下载
- 做作品集：展示文件上传、图片管理、分页查询、筛选、批量操作

## 🗄️ 数据表

初始化脚本在 `build-data/init.sql`：

```powershell
mysql -uroot -p123456 --default-character-set=utf8mb4 -D sekai_friend < build-data/init.sql
```

## ▶️ 启动

默认端口 `8087`：

```powershell
mvn spring-boot:run
```

访问 `http://localhost:8087/login`。

## ⚠️ 商用提醒

公开上线或收费前，请优先使用自制、授权、CC0、可商用素材，或让用户自行上传并确认版权。项目本身可以商用交付，但图片素材是否可商用需单独确认。
