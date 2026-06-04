param(
    [string]$BaseUrl = "http://localhost:8083",
    [int]$CountPerStatus = 20
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Invoke-JsonPost {
    param(
        [string]$Uri,
        [object]$Body
    )

    $json = $Body | ConvertTo-Json -Depth 10
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Invoke-RestMethod -Method Post -Uri $Uri -ContentType "application/json; charset=utf-8" -Body $bytes
}

function New-BasePayload {
    param(
        [string]$Name,
        [string]$Phone,
        [string]$Region,
        [int]$Age,
        [string]$Gender
    )

    @{
        name = $Name
        age = [string]$Age
        gender = $Gender
        region = $Region
        phone = $Phone
        height = "160"
        weight = "58"
        smoking = "없음"
        drinking = "없음"
        allergies = "없음"
        medicineCount = "없음"
        diabetes = "없음"
        hypertension = "없음"
        heart = "없음"
        joint = "없음"
        stroke = "없음"
        kidney = "없음"
        lung = "없음"
        liver = "없음"
        cancer = "없음"
        walkingAid = "없음"
        dementia = "없음"
        vision = "정상"
        hearing = "정상"
        recentFall = "없음"
        hasSurgery = "없음"
        maxHours = "4"
        maxDistance = "도보 30분 이내"
        disabledWork = @()
        payType = "무관"
        hopeDays = @("주 3일")
        hopeJobType = @("공익활동")
        hopeCondition = @("가벼운 실내외 업무")
        memo = "experiment 프로필 테스트 데이터"
    }
}

$regions = @(
    "서울시 동작구 상도동",
    "서울시 관악구 신림동",
    "서울시 강남구 역삼동",
    "서울시 송파구 잠실동",
    "서울시 강서구 화곡동",
    "서울시 광진구 자양동"
)

Write-Host "experiment 서버 확인 중: $BaseUrl"
try {
    Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/seniors" | Out-Null
} catch {
    Write-Host "experiment 서버를 먼저 실행해주세요."
    Write-Host 'cd D:\nuri\nuri-geonhee\woorispring'
    Write-Host '.\mvnw spring-boot:run "-Dspring-boot.run.profiles=experiment"'
    exit 1
}

$created = @()
$failed = 0

for ($i = 1; $i -le $CountPerStatus; $i++) {
    $suffix = $i.ToString("00")
    $region = $regions[($i - 1) % $regions.Count]

    $good = New-BasePayload -Name "테스트양호$suffix" -Phone "010-9101-$($i.ToString("0000"))" -Region $region -Age (68 + ($i % 8)) -Gender "여성"
    $caution = New-BasePayload -Name "테스트주의$suffix" -Phone "010-9102-$($i.ToString("0000"))" -Region $region -Age (70 + ($i % 7)) -Gender "남성"
    $danger = New-BasePayload -Name "테스트위험$suffix" -Phone "010-9103-$($i.ToString("0000"))" -Region $region -Age (73 + ($i % 9)) -Gender "여성"

    if ($i % 2 -eq 0) {
        $caution.medicineCount = "3~5개"
        $cautionReason = "복약 3개 이상"
    } else {
        $caution.joint = "가벼운 통증 있음"
        $cautionReason = "관절질환 정상 아님"
    }

    if ($i % 3 -eq 0) {
        $danger.heart = "활동 제한 필요"
        $danger.maxHours = "2"
        $dangerReason = "심장질환 활동 제한"
    } elseif ($i % 3 -eq 1) {
        $danger.recentFall = "최근 낙상 있음"
        $danger.maxHours = "2"
        $dangerReason = "최근 낙상 이력"
    } else {
        $danger.joint = "통증 때문에 작업 제한 필요"
        $danger.walkingAid = "보행 보조기구 사용"
        $danger.maxHours = "2"
        $dangerReason = "관절질환 및 보행 제한"
    }

    $payloads = @(
        @{ expected = "양호"; reason = "위험/주의 조건 없음"; body = $good },
        @{ expected = "주의"; reason = $cautionReason; body = $caution },
        @{ expected = "위험"; reason = $dangerReason; body = $danger }
    )

    foreach ($item in $payloads) {
        try {
            $response = Invoke-JsonPost -Uri "$BaseUrl/api/seniors" -Body $item.body
            $status = $response.healthInfo.healthStatus
            $created += [pscustomobject]@{
                Name = $response.senior.name
                Status = $status
                Expected = $item.expected
                Reason = $item.reason
            }
            Write-Host "생성 완료: $($response.senior.name) / $status / 사유: $($item.reason)"
        } catch {
            $failed++
            Write-Host "생성 실패: $($item.body.name) / $($_.Exception.Message)"
        }
    }
}

$allSeniors = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/seniors/welfare"
$createdCounts = $created | Group-Object Status | ForEach-Object { "$($_.Name): $($_.Count)명" }
$allCounts = $allSeniors | Group-Object healthStatus | ForEach-Object { "$($_.Name): $($_.Count)명" }

Write-Host ""
Write-Host "생성 요약"
Write-Host "- 성공: $($created.Count)명"
Write-Host "- 실패: $($failed)명"
Write-Host "- 서버 전체 대상자 수: $($allSeniors.Count)명"
Write-Host ""
Write-Host "이번 실행 생성 데이터 건강 상태"
$createdCounts | ForEach-Object { Write-Host "- $_" }
Write-Host ""
Write-Host "서버 전체 건강 상태"
$allCounts | ForEach-Object { Write-Host "- $_" }
