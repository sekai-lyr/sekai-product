$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
$entries=Get-Content -LiteralPath 'D:\dsh-render\qq-pack-assets\entries.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$target='D:\顾天鹏完整歌单.zip'
if(Test-Path -LiteralPath $target){throw '目标压缩包已存在，停止避免覆盖'}
$bytes=($entries | ForEach-Object {(Get-Item -LiteralPath $_.path).Length} | Measure-Object -Sum).Sum
if((Get-PSDrive D).Free -lt ($bytes+2GB)){throw '磁盘空间不足，停止'}
$file=[System.IO.File]::Open($target,[System.IO.FileMode]::CreateNew)
$zip=[System.IO.Compression.ZipArchive]::new($file,[System.IO.Compression.ZipArchiveMode]::Create,$false)
try{
 foreach($item in $entries){
  $entry=$zip.CreateEntry($item.name,[System.IO.Compression.CompressionLevel]::NoCompression)
  $inputFile=[System.IO.File]::OpenRead($item.path)
  $outputStream=$entry.Open()
  try{$inputFile.CopyTo($outputStream)}finally{$outputStream.Dispose();$inputFile.Dispose()}
  Write-Output $item.name
 }
}finally{$zip.Dispose();$file.Dispose()}
$verify=[System.IO.Compression.ZipFile]::OpenRead($target)
try{
 if($verify.Entries.Count -ne $entries.Count){throw '压缩包条目数量不一致'}
 foreach($item in $entries){if($verify.GetEntry($item.name).Length -ne (Get-Item -LiteralPath $item.path).Length){throw '文件大小校验失败'}}
}finally{$verify.Dispose()}
Get-Item -LiteralPath $target | Select-Object FullName,Length
