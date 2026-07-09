# scripts/backfill-commits.ps1
$startDate = [datetime]"2026-05-31"
$endDate = [datetime]"2026-07-10"

# Target file
$streakFile = ".github/daily_streak.txt"
if (-not (Test-Path ".github")) {
    New-Item -ItemType Directory -Path ".github" | Out-Null
}

$currentDate = $startDate
while ($currentDate -le $endDate) {
    $dateStr = $currentDate.ToString("yyyy-MM-dd")
    Write-Host "Generating commits for $dateStr..."
    
    for ($i = 1; $i -le 10; $i++) {
        # Format date as ISO 8601, e.g. 2026-06-01T12:00:00
        # Add hours to make the timestamps distinct
        $hour = 8 + $i
        $commitDate = "${dateStr}T$($hour.ToString('00')):00:00"
        
        # Set Git environment variables
        $env:GIT_AUTHOR_DATE = $commitDate
        $env:GIT_COMMITTER_DATE = $commitDate
        
        # Write to file
        Add-Content -Path $streakFile -Value "$commitDate - Commit $i"
        
        # Add and Commit
        git add $streakFile
        git commit -m "chore: contribution update for $dateStr ($i/10)" | Out-Null
    }
    
    $currentDate = $currentDate.AddDays(1)
}

# Clean up env vars
Remove-Item Env:\GIT_AUTHOR_DATE
Remove-Item Env:\GIT_COMMITTER_DATE

Write-Host "Done! All past commits have been generated locally."
