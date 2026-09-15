# All arguments are forwarded as separate arguments, never evaluated as shell code.
$projectArgs = $args
$previousToken = $env:GH_TOKEN
$previousRepo = $env:GH_REPO
try {
    . "$PSScriptRoot/account.ps1"
    Set-ProjectGitHubAccount
    & gh @projectArgs
    $projectExitCode = $LASTEXITCODE
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    $projectExitCode = 1
} finally {
    $env:GH_TOKEN = $previousToken
    $env:GH_REPO = $previousRepo
}
exit $projectExitCode
