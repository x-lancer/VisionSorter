# PowerShell 脚本：上传文件到远程 Windows 服务器
# 使用方法：以管理员身份运行 PowerShell，然后执行此脚本

param(
    [string]$ServerIP = "119.91.36.69",
    [string]$Username = "Administrator",
    [string]$Password = "aA1234567890",
    [string]$LocalFile = "dist\LabClassificationService.exe",
    [string]$RemotePath = "C:\temp"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "上传文件到远程服务器" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查本地文件是否存在
if (-not (Test-Path $LocalFile)) {
    Write-Host "[错误] 本地文件不存在: $LocalFile" -ForegroundColor Red
    Write-Host "请先运行 build.bat 打包，或检查文件路径" -ForegroundColor Yellow
    exit 1
}

Write-Host "[信息] 本地文件: $LocalFile" -ForegroundColor Green
$fileInfo = Get-Item $LocalFile
Write-Host "     文件大小: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Gray
Write-Host ""

# 创建安全凭证
$securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($Username, $securePassword)

try {
    Write-Host "[1/3] 连接到服务器: $ServerIP..." -ForegroundColor Yellow
    $session = New-PSSession -ComputerName $ServerIP -Credential $credential -ErrorAction Stop
    Write-Host "     连接成功！" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "[2/3] 在服务器上创建目录（如果不存在）..." -ForegroundColor Yellow
    Invoke-Command -Session $session -ScriptBlock {
        param($path)
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
            Write-Host "     已创建目录: $path" -ForegroundColor Gray
        } else {
            Write-Host "     目录已存在: $path" -ForegroundColor Gray
        }
    } -ArgumentList $RemotePath
    Write-Host ""
    
    Write-Host "[3/3] 上传文件到服务器..." -ForegroundColor Yellow
    $remoteFile = Join-Path $RemotePath (Split-Path $LocalFile -Leaf)
    Copy-Item -Path $LocalFile -Destination $remoteFile -ToSession $session -Force
    
    Write-Host "     上传完成！" -ForegroundColor Green
    Write-Host ""
    
    # 验证文件
    Write-Host "验证上传的文件..." -ForegroundColor Yellow
    $remoteFileInfo = Invoke-Command -Session $session -ScriptBlock {
        param($file)
        if (Test-Path $file) {
            $info = Get-Item $file
            return @{
                Exists = $true
                Size = $info.Length
                Path = $file
            }
        } else {
            return @{ Exists = $false }
        }
    } -ArgumentList $remoteFile
    
    if ($remoteFileInfo.Exists) {
        Write-Host "✅ 文件上传成功！" -ForegroundColor Green
        Write-Host "   远程路径: $($remoteFileInfo.Path)" -ForegroundColor Gray
        Write-Host "   文件大小: $([math]::Round($remoteFileInfo.Size / 1MB, 2)) MB" -ForegroundColor Gray
    } else {
        Write-Host "❌ 文件上传失败" -ForegroundColor Red
    }
    
    # 断开连接
    Remove-PSSession $session
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "上传完成！" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "下一步：通过远程桌面连接服务器，运行文件进行测试" -ForegroundColor Yellow
    
} catch {
    Write-Host ""
    Write-Host "[错误] 上传失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能的解决方案：" -ForegroundColor Yellow
    Write-Host "1. 检查网络连接" -ForegroundColor Gray
    Write-Host "2. 确认服务器 IP 和凭据正确" -ForegroundColor Gray
    Write-Host "3. 确认服务器启用了 PowerShell Remoting" -ForegroundColor Gray
    Write-Host "4. 检查防火墙设置" -ForegroundColor Gray
    exit 1
}

