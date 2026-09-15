param([string]$Operation)
$ErrorActionPreference = 'Stop'
if ($Operation -ne 'get') { exit 0 }
$request = @{}
while ($null -ne ($line = [Console]::ReadLine()) -and $line -ne '') {
    $parts = $line.Split('=', 2)
    if ($parts.Count -eq 2) { $request[$parts[0]] = $parts[1] }
}
if ($request['protocol'] -ne 'https' -or $request['host'] -ne 'github.com') { exit 0 }
if ($request['username'] -and $request['username'] -ne 'timo-leiser') {
    [Console]::Error.WriteLine('This project requires GitHub account timo-leiser.')
    exit 1
}
try {
    . "$PSScriptRoot/account.ps1"
    Set-ProjectGitHubAccount
    # Git consumes this pipe. Never invoke this helper manually or log its output.
    [Console]::WriteLine('username=timo-leiser')
    [Console]::WriteLine("password=$env:GH_TOKEN")
    [Console]::WriteLine('')
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
