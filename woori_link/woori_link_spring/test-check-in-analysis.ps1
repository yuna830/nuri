#Requires -Version 5.1

$ErrorActionPreference = "Stop"

chcp 65001 > $null

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$BaseUrl = $env:WOORI_LINK_API_BASE_URL
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw "WOORI_LINK_API_BASE_URL environment variable is required."
}

function Read-ErrorBody {
    param(
        [Parameter(Mandatory = $true)]
        $ErrorRecord
    )

    if (
        $null -ne $ErrorRecord.ErrorDetails -and
        -not [string]::IsNullOrWhiteSpace(
            $ErrorRecord.ErrorDetails.Message
        )
    ) {
        return $ErrorRecord.ErrorDetails.Message
    }

    $response = $ErrorRecord.Exception.Response

    if ($null -eq $response) {
        return ""
    }

    try {
        $stream = $response.GetResponseStream()

        if ($null -eq $stream) {
            return ""
        }

        $reader = New-Object System.IO.StreamReader(
            $stream,
            [System.Text.Encoding]::UTF8
        )

        try {
            return $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
            $stream.Dispose()
        }
    }
    catch {
        return ""
    }
}

$SeniorId = 0L

while ($SeniorId -le 0) {
    $seniorIdInput = Read-Host "Senior ID"

    $parsedSeniorId = 0L

    $isValidSeniorId = [long]::TryParse(
        $seniorIdInput,
        [ref]$parsedSeniorId
    )

    if ($isValidSeniorId -and $parsedSeniorId -gt 0) {
        $SeniorId = $parsedSeniorId
    }
    else {
        Write-Host `
            "Senior ID must be a number greater than 0." `
            -ForegroundColor Yellow
    }
}

$secureToken = Read-Host `
    "Guardian JWT without Bearer" `
    -AsSecureString

$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
    $secureToken
)

try {
    $Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
        $tokenPointer
    )
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
        $tokenPointer
    )
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "JWT was not entered."
}

$Token = $Token.Trim()

$Token = [regex]::Replace(
    $Token,
    "(?i)^Bearer\s+",
    ""
)

$Token = $Token.Trim().Trim('"').Trim("'")

$tokenParts = $Token.Split(".")

if ($tokenParts.Length -ne 3) {
    throw "The entered value does not appear to be a valid JWT."
}

$RequestUrl = (
    "$BaseUrl/api/care/seniors/" +
    "$SeniorId/check-in-analysis"
)

$Headers = @{
    Authorization = "Bearer $Token"
    Accept = "application/json"
}

Write-Host ""
Write-Host "Request URL: $RequestUrl" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Method Get `
        -Uri $RequestUrl `
        -Headers $Headers `
        -ContentType "application/json; charset=utf-8"

    Write-Host "Request succeeded." -ForegroundColor Green
    Write-Host ""

    $response |
        ConvertTo-Json -Depth 20
}
catch {
    $statusCode = $null

    if ($null -ne $_.Exception.Response) {
        try {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        catch {
            $statusCode = $null
        }
    }

    $responseBody = Read-ErrorBody `
        -ErrorRecord $_

    Write-Host "Request failed." -ForegroundColor Red

    if ($null -ne $statusCode) {
        Write-Host "HTTP status: $statusCode"
    }

    if (
        -not [string]::IsNullOrWhiteSpace(
            $responseBody
        )
    ) {
        Write-Host "Response body:"
        Write-Host $responseBody
    }
    else {
        Write-Host "The server returned no response body."
    }

    Write-Host ""

    if ($statusCode -eq 401) {
        Write-Host `
            "The JWT is missing, invalid, or expired." `
            -ForegroundColor Yellow
    }

    if ($statusCode -eq 403) {
        Write-Host `
            "The JWT may not belong to a GUARDIAN account, or the guardian may not be connected to this senior." `
            -ForegroundColor Yellow
    }

    exit 1
}
