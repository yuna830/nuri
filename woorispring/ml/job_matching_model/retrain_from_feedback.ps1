param(
    [string]$ServerUrl = "http://localhost:8083",
    [string]$InputPath = "",
    [string]$OutputDir = "artifacts",
    [int]$MinimumRows = 10,
    [switch]$SkipPrediction
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Resolve-LocalPath([string]$PathValue) {
    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return $PathValue
    }

    return Join-Path $scriptDir $PathValue
}

function Ensure-PythonEnvironment {
    $pythonPath = Join-Path $scriptDir ".venv\Scripts\python.exe"

    if (-not (Test-Path $pythonPath)) {
        Write-Host "Creating Python virtual environment."
        python -m venv .venv
    }

    Write-Host "Checking Python packages."
    & $pythonPath -m pip install -r requirements.txt | Out-Host

    return $pythonPath
}

function Download-TrainingData([string]$BaseUrl) {
    $targetDir = Join-Path $scriptDir "data"
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $targetPath = Join-Path $targetDir "job_matching_feedback_$timestamp.csv"
    $apiUrl = "$($BaseUrl.TrimEnd('/'))/api/job-matching/training-data.csv"

    Write-Host "Downloading training data from Spring: $apiUrl"
    Invoke-WebRequest -Uri $apiUrl -OutFile $targetPath | Out-Null

    return $targetPath
}

function Validate-TrainingData([string]$CsvPath, [int]$MinRows) {
    if (-not (Test-Path $CsvPath)) {
        throw "Training data file not found: $CsvPath"
    }

    $rows = @(Import-Csv -Path $CsvPath -Encoding UTF8)
    if ($rows.Count -lt $MinRows) {
        throw "Not enough training data. Current: $($rows.Count), required: $MinRows."
    }

    $labelCounts = $rows | Group-Object label | Sort-Object Name
    if ($labelCounts.Count -lt 2) {
        throw "Not enough label diversity. At least two labels are required."
    }

    Write-Host "Training data checked: $($rows.Count) rows"
    foreach ($group in $labelCounts) {
        Write-Host "- $($group.Name): $($group.Count) rows"
    }
}

function Print-Metrics([string]$MetricsPath) {
    if (-not (Test-Path $MetricsPath)) {
        Write-Host "metrics.json not found: $MetricsPath"
        return
    }

    $metrics = Get-Content -Path $MetricsPath -Raw -Encoding UTF8 | ConvertFrom-Json

    Write-Host ""
    Write-Host "Retraining metrics"
    Write-Host "- data: $($metrics.data_file)"
    Write-Host "- rows: $($metrics.rows)"
    Write-Host "- train rows: $($metrics.train_rows)"
    Write-Host "- test rows: $($metrics.test_rows)"
    Write-Host "- feature count: $($metrics.feature_count)"
    Write-Host "- accuracy: $([Math]::Round($metrics.accuracy * 100, 2))%"
    Write-Host "- balanced_accuracy: $([Math]::Round($metrics.balanced_accuracy * 100, 2))%"
    Write-Host "- macro_f1: $([Math]::Round($metrics.macro_f1 * 100, 2))%"
}

try {
    if ([string]::IsNullOrWhiteSpace($InputPath)) {
        $trainingDataPath = Download-TrainingData $ServerUrl
    } else {
        $trainingDataPath = Resolve-LocalPath $InputPath
    }

    Validate-TrainingData $trainingDataPath $MinimumRows

    $pythonPath = Ensure-PythonEnvironment
    $resolvedOutputDir = Resolve-LocalPath $OutputDir

    Write-Host "Training model."
    & $pythonPath train_job_matching_model.py --input $trainingDataPath --output-dir $resolvedOutputDir | Out-Host

    Print-Metrics (Join-Path $resolvedOutputDir "metrics.json")

    if (-not $SkipPrediction) {
        Write-Host ""
        Write-Host "Sample prediction"
        & $pythonPath predict_job_match.py `
            --input (Join-Path $scriptDir "data\predict_sample.json") `
            --model (Join-Path $resolvedOutputDir "job_matching_model.joblib") `
            --feature-columns (Join-Path $resolvedOutputDir "feature_columns.json") | Out-Host
    }

    Write-Host ""
    Write-Host "Done: Spring ML API uses $OutputDir/job_matching_model.joblib."
} catch {
    Write-Error $_
    exit 1
}
