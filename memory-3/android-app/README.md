# Sekai Memory Book Android Offline

独立 Android 离线版。应用将 HTML/CSS/JavaScript 全部打包进 APK，通过 WebView 运行；番剧、角色和台词数据保存在 Android WebView 的本地存储中，不依赖 Spring Boot 或 MySQL。

## 功能

- 手机竖屏布局和底部导航
- 番剧、角色、台词的新增、编辑、删除和搜索
- 首页统计、观看状态筛选
- JSON 文件导出备份和恢复
- 阻止访问外部页面，不申请网络权限

## 构建

需要 JDK 17 和 Android SDK 35/36：

```powershell
$env:JAVA_HOME = '你的 JDK 17 路径'
.\gradlew.bat assembleDebug
```

调试 APK 输出在 `app/build/outputs/apk/debug/app-debug.apk`。

> 当前电脑若出现 `Unable to establish loopback connection`，请把 `TEMP`、`TMP` 和 `java.io.tmpdir` 指向不含短路径的简单目录后再构建。
