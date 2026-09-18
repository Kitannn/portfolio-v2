# Copies shared content from the main site (../Portfolio) into this repo so v2 deploys on its own.
# Run after editing content in Portfolio/data.js or adding images:  powershell -File .\sync.ps1
$ErrorActionPreference = "Stop"
$src = Resolve-Path (Join-Path $PSScriptRoot "..\Portfolio")
$dst = $PSScriptRoot

# Mirror folders (deletions in Portfolio propagate). Skip large source originals the site never loads.
$jobs = @(
  @{ From = "images";        To = "images";        Exclude = @("birbKit.jpg", "CC_KeyArt_*.png") },
  @{ From = "assets\resume"; To = "assets\resume"; Exclude = @() }
)
foreach ($j in $jobs) {
  $rcArgs = @((Join-Path $src $j.From), (Join-Path $dst $j.To), "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
  if ($j.Exclude.Count) { $rcArgs += "/XF"; $rcArgs += $j.Exclude }
  robocopy @rcArgs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $($j.From) (exit $LASTEXITCODE)" }
}

# Single files
foreach ($f in "data.js", "cv.html") { Copy-Item (Join-Path $src $f) (Join-Path $dst $f) -Force }

$count = (Get-ChildItem (Join-Path $dst "images") -Recurse -File).Count
$mb = (Get-ChildItem (Join-Path $dst "images"), (Join-Path $dst "assets") -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
"Synced data.js, cv.html, $count images, resume ({0:N1} MB) from $src" -f $mb
