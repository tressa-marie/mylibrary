param([int]$Port = 5097, [string]$Configuration = 'Verification')

$ErrorActionPreference = 'Stop'
$apiProject = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../MyLibrary.Api'))
$testDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('mylibrary-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testDirectory | Out-Null
$database = Join-Path $testDirectory 'library.db'
$baseUrl = "http://127.0.0.1:$Port"
$apiProcess = $null
$launchNumber = 0

function Assert-True($condition, [string]$message) {
    if (-not $condition) { throw $message }
}

function Start-TestApi {
    $script:launchNumber++
    $dll = Join-Path $apiProject "bin/$Configuration/net10.0/MyLibrary.Api.dll"
    $script:apiProcess = Start-Process -FilePath 'dotnet' -WindowStyle Hidden -PassThru `
        -WorkingDirectory $apiProject `
        -ArgumentList @("`"$dll`"", '--urls', $baseUrl, '--environment', 'Development',
            '--Logging:EventLog:LogLevel:Default=None',
            "`"--ConnectionStrings:Library=Data Source=$database`"") `
        -RedirectStandardOutput (Join-Path $testDirectory "api-$launchNumber.log") `
        -RedirectStandardError (Join-Path $testDirectory "api-$launchNumber.err")
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        if ($apiProcess.HasExited) {
            Get-Content -LiteralPath (Join-Path $testDirectory "api-$launchNumber.err")
            Get-Content -LiteralPath (Join-Path $testDirectory "api-$launchNumber.log")
            throw 'The test API exited before it was ready.'
        }
        try {
            Invoke-RestMethod "$baseUrl/api/health" -TimeoutSec 1 | Out-Null
            return
        } catch { Start-Sleep -Milliseconds 200 }
    }
    throw 'The test API did not become ready.'
}

function Stop-TestApi {
    if ($script:apiProcess -and -not $script:apiProcess.HasExited) {
        Stop-Process -Id $script:apiProcess.Id
        $script:apiProcess.WaitForExit()
    }
}

try {
    dotnet build $apiProject --nologo --configuration $Configuration
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
    # Development startup must migrate a brand-new database without manual setup.
    Start-TestApi
    $empty = Invoke-RestMethod "$baseUrl/api/library/books"
    Assert-True ($empty.Count -eq 0) 'A new library must be empty.'
    $payload = @{
        title = '  Test Library Book  '; author = ' Test Author '; sourceBookId = 'ADbRywEACAAJ'
        isbn = '978-1784702861'; description = "First line`nSecond line"
        coverUrl = '/api/books/ADbRywEACAAJ/cover'; format = 'Paperback'; authorGender = 'other'
        isRead = $false; rating = 4; purchaseLocation = ' Local store '; publicationYear = 2020
        publisher = 'Vintage'; edition = 'First'; pageCount = 498
        genre = ' Fantasy '; shelfLocation = ' Living room, shelf 2 '
    }
    $response = Invoke-WebRequest "$baseUrl/api/library/books" -Method Post -ContentType 'application/json' `
        -Body ($payload | ConvertTo-Json) -UseBasicParsing
    Assert-True ($response.StatusCode -eq 201) 'A valid POST must return 201.'
    $saved = $response.Content | ConvertFrom-Json
    Assert-True ($saved.title -eq 'Test Library Book') 'Title must be trimmed.'
    Assert-True ($saved.author -eq 'Test Author') 'Author must be trimmed.'
    Assert-True ($saved.isbn -eq '9781784702861') 'ISBN must be normalized.'
    Assert-True ($null -eq $saved.rating) 'Unread books must have no rating.'
    Assert-True ($saved.purchaseLocation -eq 'Local store') 'Purchase location must be trimmed.'
    Assert-True ($saved.genre -eq 'Fantasy') 'Genre must be trimmed and saved.'
    Assert-True ($saved.shelfLocation -eq 'Living room, shelf 2') 'Shelf location must be trimmed and saved.'
    Assert-True ($saved.pageCount -eq 498 -and $saved.description -eq $payload.description) 'Metadata must be retained.'
    Assert-True ($saved.sourceBookId -eq $payload.sourceBookId -and $saved.coverUrl -eq $payload.coverUrl) 'Source and cover must be retained.'
    Assert-True ($saved.createdAtUtc -and [guid]::Parse($saved.id)) 'Server must generate ID and timestamp.'
    Assert-True ($response.Headers.Location -eq "/api/library/books/$($saved.id)") 'Location must identify the saved book.'
    Assert-True ([guid]::Parse($saved.editionId)) 'Saved copy must reference an edition.'

    foreach ($invalid in @(@{ title = '   ' }, @{ title = 'Invalid'; isRead = $true; rating = 6 },
            @{ title = 'Invalid'; pageCount = -1 }, @{ title = 'Invalid'; isbn = 'wrong' },
            @{ title = 'Invalid'; genre = ('x' * 101) }, @{ title = 'Invalid'; shelfLocation = ('x' * 501) })) {
        $status = 0
        try {
            Invoke-WebRequest "$baseUrl/api/library/books" -Method Post -ContentType 'application/json' `
                -Body ($invalid | ConvertTo-Json) -UseBasicParsing | Out-Null
        } catch { $status = [int]$_.Exception.Response.StatusCode }
        Assert-True ($status -eq 400) 'Invalid data must return 400.'
    }
    $manual = Invoke-RestMethod "$baseUrl/api/owned-books" -Method Post -ContentType 'application/json' `
        -Body (@{ title = 'Manual Book'; isRead = $true; rating = 5 } | ConvertTo-Json)
    Assert-True ($manual.rating -eq 5 -and $null -eq $manual.sourceBookId) 'Manual entry and read rating must save.'
    Assert-True ($null -eq $manual.genre -and $null -eq $manual.shelfLocation) 'Genre and shelf location are optional.'
    $books = Invoke-RestMethod "$baseUrl/api/owned-books"
    Assert-True ($books.Count -eq 2) 'Invalid requests must not insert records.'
    $library = Invoke-RestMethod "$baseUrl/api/library/books"
    Assert-True ($library.Count -eq 2) 'Both routes must expose the same library.'
    $missingStatus = 0
    try { Invoke-WebRequest "$baseUrl/api/owned-books/$([guid]::NewGuid())" -UseBasicParsing | Out-Null }
    catch { $missingStatus = [int]$_.Exception.Response.StatusCode }
    Assert-True ($missingStatus -eq 404) 'Missing records must return 404.'

    Stop-TestApi
    Start-TestApi
    $reloaded = Invoke-RestMethod "$baseUrl/api/library/books/$($saved.id)"
    foreach ($field in @('title', 'author', 'isbn', 'edition', 'publisher', 'publicationYear',
            'pageCount', 'description', 'coverUrl', 'sourceBookId', 'format', 'authorGender', 'editionId',
            'genre', 'shelfLocation')) {
        Assert-True ($reloaded.$field -eq $saved.$field) "Persisted $field must survive restarting the API."
    }
    Write-Output 'PASS: save, normalization, validation, manual entry, listing, missing records, and persistence.'
} finally {
    Stop-TestApi
    # Only files created inside this unique temporary directory are removed.
    Get-ChildItem -LiteralPath $testDirectory -File | Remove-Item -Force
    Remove-Item -LiteralPath $testDirectory
}
