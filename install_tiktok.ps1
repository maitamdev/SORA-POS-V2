# ===== Script tự động cài APK mới nhất từ thư mục Downloads =====

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$downloads = "$env:USERPROFILE\Downloads"

Write-Host "🔍 Tìm APK trong Downloads..." -ForegroundColor Cyan

# Tìm file APK mới nhất
$apk = Get-ChildItem $downloads -Filter "*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $apk) {
    Write-Host "❌ Không tìm thấy file APK nào trong Downloads!" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Tìm thấy: $($apk.Name) ($([math]::Round($apk.Length/1MB,1)) MB)" -ForegroundColor Green
Write-Host "📱 Đang cài lên emulator..." -ForegroundColor Yellow

# Kiểm tra emulator
$devices = & $adb devices
if ($devices -notmatch "emulator") {
    Write-Host "❌ Không tìm thấy emulator! Hãy khởi động máy ảo trước." -ForegroundColor Red
    exit 1
}

# Cài APK
& $adb install -r $apk.FullName

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cài thành công! Mở TikTok trên máy ảo nhé 🎉" -ForegroundColor Green
} else {
    Write-Host "❌ Cài thất bại. Thử thêm flag --no-incremental..." -ForegroundColor Red
    & $adb install -r --no-incremental $apk.FullName
}
