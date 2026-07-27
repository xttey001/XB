# XB Notes 启动脚本
$ProjectPath = "d:\XB"
$Port = 3300
$Url = "http://localhost:$Port"

Set-Location $ProjectPath

# 检查端口是否已被占用
$connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($connection) {
    Write-Host "服务已经在运行，正在打开浏览器..." -ForegroundColor Green
    Start-Process $Url
    exit 0
}

Write-Host "正在启动 XB Notes 开发服务..." -ForegroundColor Cyan
Write-Host "地址: $Url" -ForegroundColor Cyan

# 最小化窗口启动 npm run dev，方便用户看到服务状态并关闭
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/k title XB Notes Server && npm run dev" -WorkingDirectory $ProjectPath -WindowStyle Minimized -PassThru

# 等待服务就绪（最多 30 秒）
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
    Write-Host "." -NoNewline
}
Write-Host ""

if ($ready) {
    Write-Host "服务已就绪，正在打开浏览器..." -ForegroundColor Green
    Start-Process $Url
} else {
    Write-Host "服务启动可能失败，请检查是否有报错。" -ForegroundColor Red
    Read-Host "按 Enter 键关闭"
}
