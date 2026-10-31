$ErrorActionPreference = 'Stop'
$questRoot = $PSScriptRoot
$questUrl = 'http://127.0.0.1:5173/'
function Test-QuestServer {
    try {
        $response = Invoke-WebRequest -Uri $questUrl -TimeoutSec 2 -UseBasicParsing
        return $response.StatusCode -eq 200 -and $response.Content.Contains('Questbound')
    } catch { return $false }
}
try {
    Write-Host 'Starting Questbound...' -ForegroundColor Yellow
    if (-not (Test-QuestServer)) {
        $questNode = Join-Path $env:ProgramFiles 'nodejs\node.exe'
        if (-not (Test-Path -LiteralPath $questNode)) {
            $questNode = (Get-Command node.exe -ErrorAction Stop).Source
        }
        $questVite = Join-Path $questRoot 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path -LiteralPath $questVite)) { throw 'Game dependencies are missing. Open this folder in Terminal and run npm.cmd install.' }
        $questArgs = '"' + $questVite + '" --host 127.0.0.1 --port 5173 --strictPort'
        Start-Process -FilePath $questNode -ArgumentList $questArgs -WorkingDirectory $questRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $questRoot 'game-server.log') -RedirectStandardError (Join-Path $questRoot 'game-server-error.log') | Out-Null
        $questReady = $false
        for ($questTry = 0; $questTry -lt 20; $questTry++) {
            if (Test-QuestServer) { $questReady = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $questReady) { throw 'The game server could not start. Check game-server-error.log in this folder. Port 5173 may already be in use.' }
    }
    Write-Host ('Opening ' + $questUrl) -ForegroundColor Green
    Start-Process $questUrl
    Write-Host 'The game is running. You can close this launcher window.'
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ('Game folder: ' + $questRoot)
    Read-Host 'Press Enter to close'
    exit 1
}
