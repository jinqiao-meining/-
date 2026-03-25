param(
    [Parameter(Mandatory = $true)]
    [string]$Title,

    [Parameter(Mandatory = $true)]
    [string]$Category,

    [Parameter(Mandatory = $true)]
    [string]$SourceFile,

    [string]$HtmlFile = "",

    [string]$Summary = "",

    [string]$Slug = ""
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function New-Slug {
    param([string]$Text)

    $value = $Text.ToLowerInvariant()
    $value = [regex]::Replace($value, "[^a-z0-9]+", "-")
    $value = $value.Trim("-")
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = "item-" + (Get-Date -Format "yyyyMMddHHmmss")
    }
    return $value
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$docsDir = Join-Path $repoRoot "docs"
$contentPath = Join-Path $docsDir "content.json"

if (-not (Test-Path -LiteralPath $SourceFile)) {
    throw "找不到 SourceFile: $SourceFile"
}

if ($HtmlFile -and -not (Test-Path -LiteralPath $HtmlFile)) {
    throw "找不到 HtmlFile: $HtmlFile"
}

if ([string]::IsNullOrWhiteSpace($Slug)) {
    $Slug = New-Slug $Title
}

$itemDir = Join-Path $docsDir ("files\" + $Slug)
New-Item -ItemType Directory -Force -Path $itemDir | Out-Null

$pdfName = [System.IO.Path]::GetFileName($SourceFile)
$pdfTarget = Join-Path $itemDir $pdfName
Copy-Item -LiteralPath $SourceFile -Destination $pdfTarget -Force

$htmlRelative = $null
if ($HtmlFile) {
    $htmlName = [System.IO.Path]::GetFileName($HtmlFile)
    $htmlTarget = Join-Path $itemDir $htmlName
    Copy-Item -LiteralPath $HtmlFile -Destination $htmlTarget -Force
    $htmlRelative = "./files/$Slug/$htmlName"
}

if (-not (Test-Path -LiteralPath $contentPath)) {
    "[]" | Set-Content -LiteralPath $contentPath -Encoding UTF8
}

$items = Get-Content -LiteralPath $contentPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($null -eq $items) {
    $items = @()
}

$items = @($items | Where-Object { $_.id -ne $Slug })

$newItem = [PSCustomObject]@{
    id = $Slug
    title = $Title
    date = Get-Date -Format "yyyy-MM-dd"
    category = $Category
    summary = $Summary
    pdf = "./files/$Slug/$pdfName"
    html = $htmlRelative
}

$items = ,$newItem + $items
$items | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $contentPath -Encoding UTF8

Write-Output "已添加内容：$Title"
Write-Output "目录：$itemDir"
