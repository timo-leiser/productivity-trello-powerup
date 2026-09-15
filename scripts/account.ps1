$ErrorActionPreference = 'Stop'
function Set-ProjectGitHubAccount {
    # gh's active account is global. Select this project's token only in this process.
    $projectToken = & gh auth token --hostname github.com --user timo-leiser 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $projectToken) {
        throw 'No GitHub login for timo-leiser. Run: gh auth login --hostname github.com'
    }
    $env:GH_TOKEN = "$projectToken".Trim()
    $projectLogin = & gh api user --jq .login 2>$null
    if ($LASTEXITCODE -ne 0 -or "$projectLogin".Trim() -ne 'timo-leiser') {
        throw 'GitHub account mismatch: this project requires timo-leiser.'
    }
    $env:GH_REPO = 'timo-leiser/productivity-trello-powerup'
}
