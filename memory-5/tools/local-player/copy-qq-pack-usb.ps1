param([Parameter(Mandatory=$true)][string]$Archive,[Parameter(Mandatory=$true)][string]$Destination,[Parameter(Mandatory=$true)][string]$Invitation)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$target=[System.IO.Path]::GetFullPath($Destination)
if(-not $target.StartsWith('F:\',[System.StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected destination drive'}
if(Test-Path -LiteralPath $target){throw 'Destination already exists; refusing overwrite'}
$inviteTarget='F:\Sekai-Friend-Test.zip'
if(Test-Path -LiteralPath $inviteTarget){throw 'Invitation already exists; refusing overwrite'}
$zip=[System.IO.Compression.ZipFile]::OpenRead($Archive)
try{
 $required=($zip.Entries | Measure-Object -Property Length -Sum).Sum
 if((Get-PSDrive F).Free -lt ($required+512MB)){throw 'Insufficient USB free space'}
 foreach($entry in $zip.Entries){
  if($entry.Length -ge 4GB){throw 'Entry exceeds FAT32 file size limit'}
  $path=[System.IO.Path]::GetFullPath([System.IO.Path]::Combine($target,$entry.FullName))
  if(-not $path.StartsWith($target+'\',[System.StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe archive entry path'}
 }
 [System.IO.Directory]::CreateDirectory($target) | Out-Null
 $done=0
 foreach($entry in $zip.Entries){
  $path=[System.IO.Path]::Combine($target,$entry.FullName)
  $sourceStream=$entry.Open()
  $destinationStream=[System.IO.File]::Open($path,[System.IO.FileMode]::CreateNew)
  try{$sourceStream.CopyTo($destinationStream);$destinationStream.Flush($true)}finally{$destinationStream.Dispose();$sourceStream.Dispose()}
  if((Get-Item -LiteralPath $path).Length -ne $entry.Length){throw 'File size verification failed'}
  $done++
  if($done%15 -eq 0){Write-Output ('Copied {0}/{1} entries' -f $done,$zip.Entries.Count)}
 }
 Copy-Item -LiteralPath $Invitation -Destination $inviteTarget
 if((Get-FileHash -LiteralPath $Invitation).Hash -ne (Get-FileHash -LiteralPath $inviteTarget).Hash){throw 'Invitation hash mismatch'}
 $audio=@($zip.Entries | Where-Object {$_.FullName.EndsWith('.flac')})
 foreach($entry in @($audio[0],$audio[[int]($audio.Count/2)],$audio[-1])){
  $sourceStream=$entry.Open();$sha=[System.Security.Cryptography.SHA256]::Create()
  try{$expected=[System.BitConverter]::ToString($sha.ComputeHash($sourceStream)).Replace('-','')}finally{$sha.Dispose();$sourceStream.Dispose()}
  $actual=(Get-FileHash -LiteralPath ([System.IO.Path]::Combine($target,$entry.FullName)) -Algorithm SHA256).Hash
  if($expected -ne $actual){throw 'Audio sample hash mismatch'}
  Write-Output ('SHA256 verified: '+$entry.FullName)
 }
 $files=Get-ChildItem -LiteralPath $target -File
 $files | Group-Object Extension | Select-Object Name,Count | Format-Table
 Write-Output ('USB copy verified: '+$target)
}finally{$zip.Dispose()}
