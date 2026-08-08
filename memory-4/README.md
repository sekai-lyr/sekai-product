# Sekai Fortune · 角色抽签与今日运势

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-brightgreen)
![MyBatis](https://img.shields.io/badge/MyBatis-3-lightgrey)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1)
![VIP](https://img.shields.io/badge/会员-闭环-gold)

统一角色库抽签与今日运势 MVP。普通用户只能从数据库已有角色里抽签、收藏、查看历史；角色库由项目种子数据和管理员维护，并内置完整的会员收款闭环。

## ✨ 核心功能

- 统一角色种子数据，所有用户共享同一套角色库
- 普通用户无新增 / 编辑 / 删除角色入口
- 角色图片为空或拉取失败时，后端自动生成兜底 SVG 头像
- 数据库连接环境变量化，避免生产密码写入仓库

## 💳 手动收款会员闭环

无需微信商户号即可跑通收款 MVP：

1. 用户进入 `/membership` 选择套餐并生成订单
2. 页面展示微信收款码和付款备注
3. 用户扫码付款时填写备注
4. 确认到账后，后台审批接口开通会员

会员权益：三连签仪式 · 深度趋势分析 · 高分签回放 · 抽签分享卡

查看待处理订单：

```powershell
Invoke-WebRequest "http://localhost:8084/admin/membership/orders?token=$env:ADMIN_TOKEN" -UseBasicParsing
```

批准订单：

```powershell
Invoke-WebRequest "http://localhost:8084/admin/membership/orders/订单ID/approve?token=$env:ADMIN_TOKEN" -Method POST -UseBasicParsing
```

## 📐 初始化数据库

```sql
CREATE DATABASE IF NOT EXISTS sekai_friend DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```powershell
mysql -uroot -p --default-character-set=utf8mb4 -D sekai_friend < build-data/init.sql
```

## ▶️ 运行

设置数据库环境变量：

```powershell
$env:DB_URL="jdbc:mysql://127.0.0.1:3306/sekai_friend?serverTimezone=Asia/Shanghai&useUnicode=true&characterEncoding=utf-8&useSSL=false&allowPublicKeyRetrieval=true"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="你的数据库密码"
$env:SERVER_PORT="8084"
$env:ADMIN_TOKEN="自己设置一个后台审批密钥"
$env:WECHAT_QR_URL="/img/wechat-qr.jpg"
```

启动应用，默认端口 `8084`：

```powershell
mvn spring-boot:run
```

自定义收款码：将图片放到 `src/main/resources/static/img/wechat-qr.jpg` 并设置 `WECHAT_QR_URL` 即可。

## 🚀 下一步变现方向

1. **免费版**：每日固定签、基础历史、少量伙伴
2. **会员版**：三连签仪式、深度趋势报告、更多伙伴主题、分享卡片
3. **B 端定制**：为社群、创作者、活动方定制伙伴库和抽签页面，按项目费或月费收费
