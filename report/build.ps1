<#
.SYNOPSIS
    OmniCourse Report Build & Packaging Tool (PowerShell)
.DESCRIPTION
    Builds XeLaTeX reports (Weekly reports, Project Assignment packages) and produces ready-to-submit ZIP archives.
.EXAMPLE
    .\build.ps1                    # Builds all documents
    .\build.ps1 -Target week3      # Builds only Weekly Report Week 3
    .\build.ps1 -Target weekly     # Builds all weekly reports
    .\build.ps1 -Target pa1        # Builds all PA1 documents
    .\build.ps1 -Target pa2        # Builds all PA2 documents
    .\build.ps1 -Package pa1       # Builds and packages PA1 for submission
    .\build.ps1 -Package pa2       # Builds and packages PA2 for submission
    .\build.ps1 -Clean             # Cleans auxiliary LaTeX files
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Target = "all",

    [Parameter()]
    [string]$Package = "",

    [Parameter()]
    [switch]$Docker,

    [Parameter()]
    [switch]$Clean
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# Pinned TeX Live release; bump the dated tag deliberately, never use :latest
$TexLiveImage = "ghcr.io/xu-cheng/texlive-full:20261001"

if ($Docker) {
    $runtime = if (Get-Command podman -ErrorAction SilentlyContinue) { "podman" } elseif (Get-Command docker -ErrorAction SilentlyContinue) { "docker" } else { $null }
    if (-not $runtime) {
        Write-Error "Neither docker nor podman was found in PATH to execute containerized build."
        exit 1
    }
    $targetArg = if ($Package) { "package-$($Package.ToLower())" } else { $Target }
    Write-Host "Running XeLaTeX build via $runtime container ($TexLiveImage)..." -ForegroundColor Cyan
    $projectRoot = Split-Path -Parent $ScriptDir
    & $runtime run --rm -v "${projectRoot}:/work" -w /work/report $TexLiveImage bash ./build.sh $targetArg
    exit $LASTEXITCODE
}

function Clean-AuxFiles {
    param([string]$Dir)
    Get-ChildItem -Path $Dir -Include *.aux, *.log, *.out, *.toc, *.build.log -Recurse -File -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

if ($Clean) {
    Write-Host "Cleaning LaTeX auxiliary files in $ScriptDir..." -ForegroundColor Cyan
    Clean-AuxFiles -Dir $ScriptDir
    Write-Host "Clean completed." -ForegroundColor Green
    exit 0
}

# Pre-flight check for the real team metadata (git-ignored)
if (-not (Test-Path (Join-Path $ScriptDir "shared\meta.tex"))) {
    Write-Host "Error: report\shared\meta.tex is missing." -ForegroundColor Red
    Write-Host "Copy meta.example.tex to meta.tex and fill in the real names, student IDs and group ID:" -ForegroundColor Yellow
    Write-Host "  Copy-Item report\shared\meta.example.tex report\shared\meta.tex" -ForegroundColor Cyan
    exit 1
}

# Pre-flight check for xelatex
if (-not (Get-Command xelatex -ErrorAction SilentlyContinue)) {
    Write-Host "Error: 'xelatex' executable was not found in PATH." -ForegroundColor Red
    Write-Host "To compile without installing local TeX tools, use Docker/Podman:" -ForegroundColor Yellow
    Write-Host "  .\build.ps1 -Docker" -ForegroundColor Cyan
    exit 1
}

function Compile-TexFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TexPath
    )

    $FileDir = Split-Path -Parent $TexPath
    $FileName = [System.IO.Path]::GetFileNameWithoutExtension($TexPath)
    $RelativePath = $TexPath.Replace($ScriptDir, "").TrimStart("\/")

    Write-Host ("Compiling: {0,-40}" -f $RelativePath) -NoNewline

    $LogFile = Join-Path $FileDir "$FileName.build.log"

    # Pass 1
    & xelatex -interaction=nonstopmode -halt-on-error "-output-directory=$FileDir" "$TexPath" *>$LogFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAILED]" -ForegroundColor Red
        Write-Host "  See log: $LogFile" -ForegroundColor Yellow
        return $false
    }

    # Pass 2 (for TOC / LastPage cross-references)
    & xelatex -interaction=nonstopmode -halt-on-error "-output-directory=$FileDir" "$TexPath" *>$LogFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAILED on Pass 2]" -ForegroundColor Red
        Write-Host "  See log: $LogFile" -ForegroundColor Yellow
        return $false
    }

    $PdfPath = Join-Path $FileDir "$FileName.pdf"
    if (Test-Path $PdfPath) {
        Write-Host "[OK]" -ForegroundColor Green
        # Remove build log on success
        Remove-Item $LogFile -Force -ErrorAction SilentlyContinue
        return $true
    } else {
        Write-Host "[NO PDF]" -ForegroundColor Red
        return $false
    }
}

function Get-GroupId {
    $metaFile = Join-Path $ScriptDir "shared\meta.tex"
    if (Test-Path $metaFile) {
        $content = Get-Content $metaFile -Raw
        if ($content -match '\\newcommand\{\\OmniCourseGroup\}\{([^}]+)\}') {
            return $matches[1]
        }
    }
    return "PA1-GroupXX"
}

# --- Handle Packaging ---
if ($Package) {
    $pkg = $Package.ToLower()
    $GroupId = Get-GroupId
    $distDir = Join-Path $ScriptDir "dist"

    if ($pkg -eq "pa1") {
        Write-Host "=== Packaging PA1 Submission ($GroupId) ===" -ForegroundColor Magenta
        
        # Compile needed files
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "assignments\PA1\ProjectPlan.tex")
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "assignments\PA1\Vision.tex")
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "weekly\WeeklyReport-Week01.tex")
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "weekly\WeeklyReport-Week02.tex")

        $outDir = Join-Path $distDir $GroupId
        if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null

        Copy-Item (Join-Path $ScriptDir "assignments\PA1\ProjectPlan.pdf") (Join-Path $outDir "ProjectPlan.pdf")
        Copy-Item (Join-Path $ScriptDir "assignments\PA1\Vision.pdf") (Join-Path $outDir "Vision.pdf")
        Copy-Item (Join-Path $ScriptDir "weekly\WeeklyReport-Week01.pdf") (Join-Path $outDir "WeeklyReport-Week01.pdf")
        Copy-Item (Join-Path $ScriptDir "weekly\WeeklyReport-Week02.pdf") (Join-Path $outDir "WeeklyReport-Week02.pdf")

        # Zip
        $zipFile = Join-Path $distDir "$GroupId.zip"
        if (Test-Path $zipFile) { Remove-Item -Force $zipFile }
        Compress-Archive -Path "$outDir\*" -DestinationPath $zipFile

        Clean-AuxFiles -Dir $ScriptDir
        Write-Host "PA1 submission packaged successfully:" -ForegroundColor Green
        Write-Host "  Directory: $outDir"
        Write-Host "  Archive:   $zipFile"
        exit 0
    }
    elseif ($pkg -eq "pa2") {
        $pa2GroupId = $GroupId.Replace("PA1", "PA2")
        Write-Host "=== Packaging PA2 Submission ($pa2GroupId) ===" -ForegroundColor Magenta
        
        # Compile needed files
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "assignments\PA2\ProjectPlan.tex")
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "assignments\PA2\Vision.tex")
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "assignments\PA2\UseCase-Specification.tex")
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "weekly\WeeklyReport-Week03.tex")
        $null = Compile-TexFile -TexPath (Join-Path $ScriptDir "weekly\WeeklyReport-Week04.tex")

        $outDir = Join-Path $distDir $pa2GroupId
        if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null

        Copy-Item (Join-Path $ScriptDir "assignments\PA2\ProjectPlan.pdf") (Join-Path $outDir "ProjectPlan.pdf")
        Copy-Item (Join-Path $ScriptDir "assignments\PA2\Vision.pdf") (Join-Path $outDir "Vision.pdf")
        Copy-Item (Join-Path $ScriptDir "assignments\PA2\UseCase-Specification.pdf") (Join-Path $outDir "UseCase-Specification.pdf")
        Copy-Item (Join-Path $ScriptDir "weekly\WeeklyReport-Week03.pdf") (Join-Path $outDir "WeeklyReport-Week03.pdf")
        Copy-Item (Join-Path $ScriptDir "weekly\WeeklyReport-Week04.pdf") (Join-Path $outDir "WeeklyReport-Week04.pdf")

        # Zip
        $zipFile = Join-Path $distDir "$pa2GroupId.zip"
        if (Test-Path $zipFile) { Remove-Item -Force $zipFile }
        Compress-Archive -Path "$outDir\*" -DestinationPath $zipFile

        Clean-AuxFiles -Dir $ScriptDir
        Write-Host "PA2 submission packaged successfully:" -ForegroundColor Green
        Write-Host "  Directory: $outDir"
        Write-Host "  Archive:   $zipFile"
        exit 0
    }
    else {
        Write-Error "Unknown package target: $Package. Supported: pa1, pa2"
    }
}

# --- Handle Compilation Targets ---
$t = $Target.ToLower()
$targets = @()

if ($t -eq "all") {
    $targets += Get-ChildItem -Path (Join-Path $ScriptDir "assignments") -Filter "*.tex" -Recurse
    $targets += Get-ChildItem -Path (Join-Path $ScriptDir "weekly") -Filter "*.tex" -Recurse
}
elseif ($t -eq "weekly") {
    $targets += Get-ChildItem -Path (Join-Path $ScriptDir "weekly") -Filter "*.tex" -Recurse
}
elseif ($t -eq "pa1") {
    $targets += Get-ChildItem -Path (Join-Path $ScriptDir "assignments\PA1") -Filter "*.tex"
}
elseif ($t -eq "pa2") {
    $targets += Get-ChildItem -Path (Join-Path $ScriptDir "assignments\PA2") -Filter "*.tex"
}
elseif ($t -match "^week-?0?(\d+)$") {
    $wNum = [int]$matches[1]
    $padded = "{0:D2}" -f $wNum
    $candidate = Join-Path $ScriptDir "weekly\WeeklyReport-Week$padded.tex"
    if (Test-Path $candidate) {
        $targets += Get-Item $candidate
    } else {
        Write-Error "Weekly report file not found: $candidate"
    }
}
else {
    # Check if direct file path was provided
    if (Test-Path $Target) {
        $targets += Get-Item $Target
    } else {
        Write-Error "Unknown target: $Target. Available targets: all, weekly, pa1, pa2, week1..week10"
    }
}

Write-Host "=== OmniCourse Report Builder: Building $($targets.Count) document(s) ===" -ForegroundColor Cyan
$successCount = 0
foreach ($item in $targets) {
    if (Compile-TexFile -TexPath $item.FullName) {
        $successCount++
    }
}

Clean-AuxFiles -Dir $ScriptDir
Write-Host "Build complete: $successCount / $($targets.Count) succeeded." -ForegroundColor $(if ($successCount -eq $targets.Count) { "Green" } else { "Yellow" })
