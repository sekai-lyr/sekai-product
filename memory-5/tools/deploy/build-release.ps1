$ErrorActionPreference = 'Stop'
if (-not $env:DB_PASSWORD) {
    throw 'Release tests connect to the local MySQL instance; set $env:DB_PASSWORD (and optionally $env:DB_USERNAME) before building.'
}
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$releaseDirectory = Join-Path 'D:/dsh-render' ('release-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $releaseDirectory | Out-Null
$sourceDirectory = Join-Path $releaseDirectory 'source'
New-Item -ItemType Directory -Path $sourceDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'pom.xml') -Destination $sourceDirectory
Copy-Item -LiteralPath (Join-Path $projectRoot 'src') -Destination $sourceDirectory -Recurse
New-Item -ItemType Directory -Path (Join-Path $sourceDirectory 'tools') | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'tools/device-sharing') -Destination (Join-Path $sourceDirectory 'tools') -Recurse
& mvn -q -o -f (Join-Path $sourceDirectory 'pom.xml') package
if ($LASTEXITCODE -ne 0) { throw 'Release build or tests failed' }
$artifact = Join-Path $releaseDirectory 'app.jar'
Copy-Item -LiteralPath (Join-Path $sourceDirectory 'target/memory-5-0.0.1-SNAPSHOT.jar') -Destination $artifact
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$archive = [IO.Compression.ZipFile]::Open($artifact, [IO.Compression.ZipArchiveMode]::Update)
try {
    $archive.GetEntry('BOOT-INF/classes/application.properties').Delete()
    $entry = $archive.CreateEntry('BOOT-INF/classes/application.properties')
    $writer = [IO.StreamWriter]::new($entry.Open(), [Text.UTF8Encoding]::new($false))
    try { $writer.Write([IO.File]::ReadAllText((Join-Path $projectRoot 'tools/deploy/jar/BOOT-INF/classes/application.properties'))) }
    finally { $writer.Dispose() }
} finally { $archive.Dispose() }
$archive = [IO.Compression.ZipFile]::OpenRead($artifact)
try {
    $reader = [IO.StreamReader]::new($archive.GetEntry('BOOT-INF/classes/application.properties').Open())
    try { $configuration = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if (!$configuration.Contains('${SEKAI_DB_PASSWORD}')) { throw 'Artifact secrets sanitization failed' }
    $class = $archive.GetEntry('BOOT-INF/classes/com/sekai/song/SekaiSongApplication.class').Open()
    try { $header = [byte[]]::new(8); $null = $class.Read($header,0,8) } finally { $class.Dispose() }
    if (($header[6] * 256 + $header[7]) -gt 65) { throw 'Artifact requires a newer Java version than server Java 21' }
    # Static assets excluded by .gitignore are still required at runtime; a build copied
    # from a git checkout silently drops them (see docs/mobile-performance-2026-10-25.md).
    $assets = @('static/images/login-music-room.png', 'static/js/vendor/folia-sekai-source.zip')
    foreach ($asset in $assets) {
        if ($null -eq $archive.GetEntry("BOOT-INF/classes/$asset")) { throw "Artifact is missing required static asset: $asset" }
    }
    $gallery = @($archive.Entries | Where-Object { $_.FullName -like 'BOOT-INF/classes/static/js/vendor/folia-gallery/*.png' })
    if ($gallery.Count -eq 0) { throw 'Artifact is missing the FOLIa gallery avatar images' }
} finally { $archive.Dispose() }
foreach ($name in @('feedback-overview.sql','listener-plaza-upgrade.sql','device-sharing.sql')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot "src/main/resources/db/$name") -Destination $releaseDirectory
}
$tests = 0
foreach ($report in Get-ChildItem (Join-Path $sourceDirectory 'target/surefire-reports/TEST-*.xml')) {
    $suite = ([xml](Get-Content -LiteralPath $report.FullName)).testsuite
    if ([int]$suite.failures -gt 0 -or [int]$suite.errors -gt 0) { throw 'Release tests failed' }
    $tests += [int]$suite.tests
}
[pscustomobject]@{Directory=$releaseDirectory;Artifact=$artifact;Bytes=(Get-Item $artifact).Length;SHA256=(Get-FileHash $artifact -Algorithm SHA256).Hash.ToLower();Tests=$tests} | ConvertTo-Json -Compress
