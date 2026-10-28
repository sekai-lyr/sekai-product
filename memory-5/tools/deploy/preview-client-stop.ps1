$ErrorActionPreference='Stop'
$stateFile=Join-Path $PSScriptRoot '.test-state.json'
if(Test-Path -LiteralPath $stateFile){
    $state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    $process=Get-CimInstance Win32_Process -Filter ('ProcessId={0}' -f [int]$state.pid)
    if($process -and $process.Name -eq 'ssh.exe' -and $process.CommandLine.Contains('sekai-preview@101.37.89.111') -and $process.CommandLine.Contains([string]$state.key)){Stop-Process -Id $process.ProcessId -Force}
    Remove-Item -LiteralPath $stateFile -Force
}
Write-Host 'Private test disconnected.'
