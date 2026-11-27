$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '../..')
$env:ROOMLET_TEST_URL = 'http://127.0.0.1:3211'
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54331'
$homePage = Invoke-WebRequest -UseBasicParsing -Uri $env:ROOMLET_TEST_URL -MaximumRedirection 0 -TimeoutSec 15
if ($homePage.Content -notmatch 'class="store-demo-label"') {
    throw 'Start the isolated Roomlet preview with npm run demo:dev first.'
}
$accounts = Get-Content -Raw -LiteralPath '.roomlet-demo/accounts.json' | ConvertFrom-Json
foreach ($role in @('maker', 'owner', 'customer')) {
    $account = @($accounts | Where-Object role -eq $role)
    if ($account.Count -ne 1 -or !$account[0].email -or !$account[0].password) { throw "Missing demo account for $role" }
}
$maker = $accounts | Where-Object role -eq 'maker'
$env:ROOMLET_LOCAL_MAKER_EMAIL = $maker.email
$env:ROOMLET_LOCAL_MAKER_PASSWORD = $maker.password
$run = Join-Path '.roomlet-demo' ('playwright-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $run | Out-Null
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = (Join-Path (Resolve-Path $run).Path 'results.json')
Write-Host "Playwright report: $env:PLAYWRIGHT_JSON_OUTPUT_NAME"
& node node_modules/@playwright/test/cli.js test --workers=1 '--reporter=list,json' "--output=$run/artifacts"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$stats = (Get-Content -Raw -Encoding UTF8 -LiteralPath $env:PLAYWRIGHT_JSON_OUTPUT_NAME | ConvertFrom-Json).stats
if ($stats.expected -lt 26 -or $stats.skipped -or $stats.flaky -or $stats.unexpected) { throw 'Playwright did not pass the full suite cleanly.' }
