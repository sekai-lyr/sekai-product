# Build the offline APK (SekaiGame Android WebView shell).
#
# Steps: sync www -> generate mobile webp -> stash source PNGs -> gradle assembleRelease -> zipalign -> apksigner
# The source PNGs (images/vfx, ~500MB) are NOT packaged: mobile loads images/vfx-mobile webp only.
#
# NOTE: this file is deliberately ASCII-only. Windows PowerShell 5.1 reads .ps1 as ANSI
# unless it has a UTF-8 BOM, so non-ASCII text here would be mis-decoded.
param(
    [string]$Version = "2.4.0",
    [switch]$SkipSync
)
$ErrorActionPreference = "Stop"
$Game = Split-Path -Parent $PSScriptRoot
$App = Join-Path $Game "android-app"
$Www = Join-Path $App "app\src\main\assets\www"
$VfxPng = Join-Path $Www "images\vfx"
$Stash = Join-Path $App "build\_vfx-excluded"
$Sdk = "B:\RenPy\renpy-8.5.3-sdk\rapt\Sdk"
$BuildTools = Join-Path $Sdk "build-tools\35.0.0"
$Keystore = Join-Path $App "build\apk-direct\sekai-debug.keystore"
$Out = Join-Path $Game "dist"

if (-not $SkipSync) {
    Write-Host "[1/5] sync www assets"
    node (Join-Path $Game "tools\sync-apk-www.mjs")
    if ($LASTEXITCODE -ne 0) { throw "www sync check failed" }
    Write-Host "[2/5] generate mobile webp"
    python (Join-Path $Game "tools\build-mobile-vfx.py")
    if ($LASTEXITCODE -ne 0) { throw "webp generation failed" }
}

Write-Host "[3/5] stash source PNGs (not packaged)"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Stash) | Out-Null
if (Test-Path $VfxPng) {
    if (Test-Path $Stash) { Remove-Item $Stash -Recurse -Force }
    Move-Item $VfxPng $Stash
    Write-Host ("  stashed {0} png files" -f (Get-ChildItem $Stash -File).Count)
} else {
    Write-Host "  source PNGs already stashed, skipping"
}

try {
    Write-Host "[4/5] gradle assembleRelease"
    Push-Location $App
    try {
        & .\gradlew.bat --no-daemon -q assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "gradle build failed" }
    } finally { Pop-Location }

    $unsigned = Get-ChildItem -Path $App -Recurse -Filter "app-release-unsigned.apk" |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $unsigned) { throw "app-release-unsigned.apk not found" }
    Write-Host ("  built: {0} ({1} MB)" -f $unsigned.FullName, [math]::Round($unsigned.Length/1MB,1))

    Write-Host "[5/5] zipalign + sign"
    $tag = $Version.Replace('.', '')
    $aligned = Join-Path $App "build\apk-direct\aligned-offline-v$tag.apk"
    $signed = Join-Path $Out "SekaiGame-offline-v$Version.apk"
    New-Item -ItemType Directory -Force -Path $Out | Out-Null
    # build-tools 的 .bat 会把 JDK 警告写到 stderr。PowerShell 5.1 会把原生命令的 stderr
    # 当成 NativeCommandError，即使 ErrorActionPreference=Continue 也可能在稍后升级为终止错误。
    # 因此统一走 cmd /c 并丢弃 stderr，只保留退出码与实际产物。
    & cmd.exe /c "`"$(Join-Path $BuildTools 'zipalign.exe')`" -f -p 4 `"$($unsigned.FullName)`" `"$aligned`" 2>nul"
    if ($LASTEXITCODE -ne 0) { throw "zipalign failed ($LASTEXITCODE)" }
    & cmd.exe /c "`"$(Join-Path $BuildTools 'apksigner.bat')`" sign --ks `"$Keystore`" --ks-key-alias sekai --ks-pass pass:android --key-pass pass:android --v4-signing-enabled false --out `"$signed`" `"$aligned`" 2>nul"
    if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed ($LASTEXITCODE)" }
    # 先整段收下输出再筛选：Select-Object -First 会提前中断管道，把上游进程杀掉，
    # 使 $LASTEXITCODE 变成 -1（真实踩过）。
    $verifyOut = & cmd.exe /c "`"$(Join-Path $BuildTools 'apksigner.bat')`" verify --print-certs `"$signed`" 2>nul"
    if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed ($LASTEXITCODE)" }
    $verifyOut | Select-String -Pattern "Signer #1 certificate (DN|SHA-256)" | Select-Object -First 2
    Remove-Item "$signed.idsig" -Force -ErrorAction SilentlyContinue
    Write-Host ("`nDONE: {0} ({1} MB)" -f $signed, [math]::Round((Get-Item $signed).Length/1MB,1))
} finally {
    if (Test-Path $Stash) {
        if (Test-Path $VfxPng) { Remove-Item $VfxPng -Recurse -Force }
        Move-Item $Stash $VfxPng
        Write-Host ("restored source PNG dir ({0} files)" -f (Get-ChildItem $VfxPng -File).Count)
    }
}
