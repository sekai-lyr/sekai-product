### 任务 13：全量回归 + 平衡冒烟 + 打包重启验收

**文件：** 无代码改动（除非回归发现问题）

- [ ] **步骤 1：前端全量检查**

运行（`static`）：`npm run check && npm test`
预期：0 失败

- [ ] **步骤 2：规则测试与不变量**

运行（`SekaiGame`）：`node --test src/test/js/*.test.js`
预期：全部 PASS（含 pilot-roster、effect-diversity、premium 等）
运行（`static`）：`npm run fuzz && npm run selftest`
预期：无异常

- [ ] **步骤 3：平衡对比**

运行（`static`）：`npm run balance`
预期：输出各卡组胜率；与改动前对比无某个取向 >75% 或 <25%（若有，回调 §7 数值并同步规格/测试）。

- [ ] **步骤 4：重新打包并重启服务**

```powershell
# 停止占用 8091 的旧进程
$p = Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue
if ($p) { Stop-Process -Id $p.OwningProcess -Force }
# 编译（环境变量缺失会启动失败：生成临时 JWT 密钥）
$env:JAVA_HOME = "C:\Program Files\Java\latest\jdk-21"
Set-Location "D:\Sekai_two\memory-16\SekaiGame"
mvn clean package -DskipTests
```

启动（带 JWT 环境变量，后台）：

```powershell
$env:APP_JWT_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
Start-Process -FilePath "C:\Program Files\Java\latest\jdk-21\bin\java.exe" `
  -ArgumentList "-jar","target\sekai-game-1.0.0.jar" `
  -WorkingDirectory "D:\Sekai_two\memory-16\SekaiGame" -WindowStyle Hidden `
  -RedirectStandardOutput "target\server.out.log" -RedirectStandardError "target\server.err.log"
```

- [ ] **步骤 5：验证新资源已上线**

```powershell
$r = Invoke-WebRequest "http://127.0.0.1:8091/js/status-effects.js" -UseBasicParsing -TimeoutSec 10
"HTTP $($r.StatusCode) | $($r.RawContentLength) bytes"
```

预期：HTTP 200（新模块已打进 jar）；`themed-effects.js` 大小较旧版增加。

- [ ] **步骤 6：用户验收**

用户在 `http://127.0.0.1:8091`（或局域网 `192.168.101.13:8091`）试玩：
1. 30 张试点卡任意一张：技能横幅 + 对应特效 + 状态标签层数；
2. 灼烧→引爆连锁 / 剧毒→引爆扩散 / 净化清诅咒；
3. 四张领域卡的全屏领域演出；
4. 善逸/乐奈抛硬币两种结果都出现（多打几局）。

---