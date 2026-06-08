[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Net.Http

$rootPath = "C:\github\nuri\woori-vault"

# folder name: 복지정책
$folderName = -join ([char[]]@(0xBCF5, 0xC9C0, 0xC815, 0xCC45))
$folderPath = Join-Path $rootPath $folderName

$apiBaseUrl = "http://localhost:8001/api/upload/markdown/ingest"

Write-Host "Target folder: $folderPath"

if (-not (Test-Path -LiteralPath $folderPath)) {
    Write-Host "Folder not found."
    exit
}

$files = Get-ChildItem -LiteralPath $folderPath -Filter "*.md" -File -Recurse

$total = $files.Count
$success = 0
$failed = @()

Write-Host "Total markdown files: $total"
Write-Host "--------------------------------"

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromMinutes(5)

foreach ($file in $files) {
    $documentId = $file.BaseName
    $encodedDocumentId = [System.Uri]::EscapeDataString($documentId)

    $url = "{0}?document_id={1}&chunk_start=0&chunk_limit=100" -f $apiBaseUrl, $encodedDocumentId

    Write-Host "Uploading: $documentId"

    try {
        $multipart = New-Object System.Net.Http.MultipartFormDataContent

        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $fileContent = New-Object System.Net.Http.ByteArrayContent(,$bytes)

        # 서버의 FastAPI 파라미터명이 file 이므로 반드시 "file"
        # 파일명은 영문 임시 이름으로 전달해서 한글 파일명 문제를 피함
        $multipart.Add($fileContent, "file", "current_upload.md")

        $result = $client.PostAsync($url, $multipart).Result
        $responseBody = $result.Content.ReadAsStringAsync().Result
        $statusCode = [int]$result.StatusCode

        Write-Host "HTTP_STATUS:$statusCode"
        Write-Host $responseBody

        if ($statusCode -ge 200 -and $statusCode -lt 300 -and (
            $responseBody -match '"status"\s*:\s*"queued"' -or
            $responseBody -match '"status"\s*:\s*"ok"' -or
            $responseBody -match '"status"\s*:\s*"EMBEDDED"' -or
            $responseBody -match '"status"\s*:\s*"SKIPPED_EXISTS"'
        )) {
            $success++
        } else {
            $failed += $file.Name
        }

        $multipart.Dispose()
        $fileContent.Dispose()
    } catch {
        Write-Host "FAILED: $($_.Exception.Message)"
        $failed += $file.Name
    }

    Start-Sleep -Milliseconds 800
    Write-Host "--------------------------------"
}

$client.Dispose()

Write-Host ""
Write-Host "UPLOAD REQUEST FINISHED"
Write-Host "Total: $total"
Write-Host "Success: $success"
Write-Host "Failed: $($failed.Count)"

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed files:"
    $failed | ForEach-Object {
        Write-Host "- $_"
    }
}