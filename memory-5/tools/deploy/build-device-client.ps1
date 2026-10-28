$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$source = Join-Path $projectRoot 'tools/device-sharing'
$destination = Join-Path $projectRoot 'src/main/resources/static/downloads'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
# Explicit allow-list: no credentials, indices, fixtures or deployment keys.
$files = @('client.mjs','provider.mjs','files.mjs','range.mjs','config.mjs','start-sharing.cmd','README.md') |
    ForEach-Object { Join-Path $source $_ }
$archive = Join-Path $destination 'sekai-device-client.zip'
Compress-Archive -LiteralPath $files -DestinationPath $archive -Force
Get-Item -LiteralPath $archive | Select-Object FullName,Length
