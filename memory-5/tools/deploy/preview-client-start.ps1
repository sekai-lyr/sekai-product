param([switch]$NoBrowser, [ValidateRange(0,60)][int]$TestHoldSeconds=0)
$ErrorActionPreference='Stop'
$sshPath=Join-Path $env:SystemRoot 'System32/OpenSSH/ssh.exe'
if (!(Test-Path -LiteralPath $sshPath)) { throw 'Install OpenSSH Client from Windows Optional Features first.' }
if ([DateTimeOffset]::UtcNow -ge [DateTimeOffset]::Parse('2026-10-18T04:10:00Z')) { throw 'This preview key expired. Ask the site owner for a new invitation.' }
$key=Join-Path $PSScriptRoot 'preview_key'
$hosts=Join-Path $PSScriptRoot 'known_hosts'
$stateFile=Join-Path $PSScriptRoot '.test-state.json'
if (Get-NetTCPConnection -LocalPort 18085 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 18085 is already in use. Run stop-test.cmd before starting again.' }
$sourceKey=$key
$keyDirectory=Join-Path $env:LOCALAPPDATA ('Sekai-Preview-Key-' + [Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $keyDirectory
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
$acl=New-Object Security.AccessControl.DirectorySecurity
$acl.SetOwner($identity)
$acl.SetAccessRuleProtection($true,$false)
$rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $keyDirectory -AclObject $acl
$key=Join-Path $keyDirectory 'preview_key'
$arguments='-N -T -i "{0}" -o "UserKnownHostsFile={1}" -o GlobalKnownHostsFile=NUL -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ExitOnForwardFailure=yes -o ConnectTimeout=12 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -L 127.0.0.1:18085:127.0.0.1:8081 sekai-preview@101.37.89.111' -f $key,$hosts
$connection=$null
try {
    Copy-Item -LiteralPath $sourceKey -Destination $key
    $connection=Start-Process -FilePath $sshPath -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $PSScriptRoot 'connection.log')
    $state=@{pid=$connection.Id;key=$key} | ConvertTo-Json -Compress
    Set-Content -LiteralPath $stateFile -Value $state -Encoding ASCII
    $ready=$false
    for($attempt=0;$attempt -lt 30;$attempt++) {
        if($connection.HasExited){throw 'Connection failed. See connection.log, or check whether the test key was revoked.'}
        try {
            $probe=[Net.HttpWebRequest]::Create('http://127.0.0.1:18085/login')
            $probe.Proxy=$null; $probe.Timeout=2000; $probe.AllowAutoRedirect=$false
            $response=$probe.GetResponse()
            try { if([int]$response.StatusCode -eq 200){$ready=$true;break} } finally { $response.Close() }
        } catch {}
        Start-Sleep -Milliseconds 300
    }
    if(!$ready){throw 'The private website did not respond. Check network access to SSH port 22.'}
    Write-Host 'Private test ready: http://localhost:18085/login' -ForegroundColor Green
    Write-Host 'Keep this window open. Music must be selected from YOUR computer.'
    if(!$NoBrowser){Start-Process 'http://localhost:18085/login'}
    if($TestHoldSeconds -gt 0){Start-Sleep -Seconds $TestHoldSeconds}
    else{$null=Read-Host 'Press ENTER to disconnect (if you close this window, run stop-test.cmd)'}
} finally {
    if($connection -and !$connection.HasExited){Stop-Process -Id $connection.Id -Force -ErrorAction SilentlyContinue}
    if(Test-Path -LiteralPath $stateFile){Remove-Item -LiteralPath $stateFile -Force}
    if(Test-Path -LiteralPath $key){Remove-Item -LiteralPath $key -Force}
    Remove-Item -LiteralPath $keyDirectory
}
