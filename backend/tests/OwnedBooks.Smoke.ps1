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
        genres = @(' Fantasy ', 'Adventure', 'fantasy', '  '); shelfLocation = ' Living room, shelf 2 '
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
    Assert-True (($saved.genres -join '|') -eq 'Fantasy|Adventure') 'Genres must be trimmed, deduplicated, and saved as an array.'
    Assert-True ($saved.shelfLocation -eq 'Living room, shelf 2') 'Shelf location must be trimmed and saved.'
    Assert-True ($saved.pageCount -eq 498 -and $saved.description -eq $payload.description) 'Metadata must be retained.'
    Assert-True ($saved.sourceBookId -eq $payload.sourceBookId -and $saved.coverUrl -eq $payload.coverUrl) 'Source and cover must be retained.'
    Assert-True ($saved.createdAtUtc -and [guid]::Parse($saved.id)) 'Server must generate ID and timestamp.'
    Assert-True ($response.Headers.Location -eq "/api/library/books/$($saved.id)") 'Location must identify the saved book.'
    Assert-True ([guid]::Parse($saved.editionId)) 'Saved copy must reference an edition.'

    foreach ($invalid in @(@{ title = '   ' }, @{ title = 'Invalid'; isRead = $true; rating = 6 },
            @{ title = 'Invalid'; pageCount = -1 }, @{ title = 'Invalid'; isbn = 'wrong' },
            @{ title = 'Invalid'; genres = @(('x' * 101)) }, @{ title = 'Invalid'; shelfLocation = ('x' * 501) })) {
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
    Assert-True ($manual.genres.Count -eq 0 -and $null -eq $manual.shelfLocation) 'Genres default to an empty array and shelf location is optional.'
    $books = Invoke-RestMethod "$baseUrl/api/owned-books"
    Assert-True ($books.Count -eq 2) 'Invalid requests must not insert records.'
    $library = Invoke-RestMethod "$baseUrl/api/library/books"
    Assert-True ($library.Count -eq 2) 'Both routes must expose the same library.'
    $expectedFields = @('id', 'title', 'author', 'genres', 'isRead', 'rating', 'shelfId', 'shelfLocation') | Sort-Object
    foreach ($summary in $library) {
        $fields = $summary.PSObject.Properties.Name | Sort-Object
        Assert-True (($fields -join ',') -eq ($expectedFields -join ',')) 'The list endpoint must return only table summary fields.'
    }
    $summary = $library | Where-Object { $_.id -eq $saved.id }
    Assert-True ($summary.title -eq $saved.title -and $summary.author -eq $saved.author `
        -and ($summary.genres -join '|') -eq ($saved.genres -join '|') `
        -and $summary.shelfLocation -eq $saved.shelfLocation) 'List summaries must retain the table metadata.'
    $missingStatus = 0
    try { Invoke-WebRequest "$baseUrl/api/owned-books/$([guid]::NewGuid())" -UseBasicParsing | Out-Null }
    catch { $missingStatus = [int]$_.Exception.Response.StatusCode }
    Assert-True ($missingStatus -eq 404) 'Missing records must return 404.'

    Stop-TestApi
    Start-TestApi
    $reloaded = Invoke-RestMethod "$baseUrl/api/library/books/$($saved.id)"
    foreach ($field in @('title', 'author', 'isbn', 'edition', 'publisher', 'publicationYear',
            'pageCount', 'description', 'coverUrl', 'sourceBookId', 'format', 'authorGender', 'editionId',
            'genres', 'shelfLocation')) {
        Assert-True ((ConvertTo-Json -InputObject $reloaded.$field -Compress) -eq (ConvertTo-Json -InputObject $saved.$field -Compress)) "Persisted $field must survive restarting the API."
    }
    $firstShelf = Invoke-RestMethod "$baseUrl/api/shelves" -Method Post -ContentType 'application/json' `
        -Body (@{ name = 'Study shelf' } | ConvertTo-Json)
    $secondShelf = Invoke-RestMethod "$baseUrl/api/shelves" -Method Post -ContentType 'application/json' `
        -Body (@{ name = 'Living room shelf' } | ConvertTo-Json)
    $updatePayload = @{
        title = ' Updated Library Book '; author = ' Updated Author '; sourceBookId = 'updated-volume'
        isbn = '0-8044-2957-X'; description = ' Updated description '; coverUrl = '/api/books/updated-volume/cover'
        format = ' Hardcover '; authorGender = 'female'; isRead = $true; rating = 4.5
        purchaseLocation = ' New store '; publicationYear = 2024; publisher = ' New publisher '
        edition = ' Second '; pageCount = 300; genres = @(' Mystery ', 'Crime'); shelfLocation = ' Study shelf '
        shelfId = $firstShelf.id
        # Server-controlled fields must not be overwritten by request JSON.
        id = [guid]::NewGuid(); editionId = [guid]::NewGuid(); createdAtUtc = '2000-01-01T00:00:00Z'
    }
    $updateResponse = Invoke-WebRequest "$baseUrl/api/library/books/$($saved.id)" -Method Put `
        -ContentType 'application/json' -Body ($updatePayload | ConvertTo-Json) -UseBasicParsing
    Assert-True ($updateResponse.StatusCode -eq 200) 'A valid PUT must return 200.'
    $updated = $updateResponse.Content | ConvertFrom-Json
    Assert-True ($updated.id -eq $saved.id -and $updated.editionId -eq $saved.editionId `
        -and $updated.createdAtUtc -eq $saved.createdAtUtc) 'PUT must preserve IDs and creation time.'
    Assert-True ($updated.title -eq 'Updated Library Book' -and $updated.author -eq 'Updated Author') 'Updated work fields must be normalized.'
    Assert-True ($updated.description -eq 'Updated description' -and ($updated.genres -join '|') -eq 'Mystery|Crime' `
        -and $updated.authorGender -eq 'female') 'All work fields must update.'
    Assert-True ($updated.isbn -eq '080442957X' -and $updated.sourceBookId -eq 'updated-volume' `
        -and $updated.coverUrl -eq '/api/books/updated-volume/cover') 'Provider and ISBN fields must update.'
    Assert-True ($updated.format -eq 'Hardcover' -and $updated.publisher -eq 'New publisher' `
        -and $updated.publicationYear -eq 2024 -and $updated.edition -eq 'Second' `
        -and $updated.pageCount -eq 300) 'All edition fields must update.'
    Assert-True ($updated.isRead -and $updated.rating -eq 4.5 -and $updated.purchaseLocation -eq 'New store' `
        -and $updated.shelfLocation -eq 'Study shelf' -and $updated.shelfId -eq $firstShelf.id) 'Ownership fields must update.'
    $shelf = Invoke-RestMethod "$baseUrl/api/shelves/$($firstShelf.id)"
    Assert-True ($shelf.bookIds -contains $saved.id) 'PUT must assign the book to its shelf.'

    $updatePayload.shelfId = $secondShelf.id
    $updated = Invoke-RestMethod "$baseUrl/api/library/books/$($saved.id)" -Method Put `
        -ContentType 'application/json' -Body ($updatePayload | ConvertTo-Json)
    $shelf = Invoke-RestMethod "$baseUrl/api/shelves/$($firstShelf.id)"
    Assert-True ($shelf.bookIds.Count -eq 0) 'Changing shelf must remove the old assignment.'
    $shelf = Invoke-RestMethod "$baseUrl/api/shelves/$($secondShelf.id)"
    Assert-True ($shelf.bookIds -contains $saved.id) 'Changing shelf must create the new assignment.'

    foreach ($invalid in @(@{ title = ' ' }, @{ title = 'Invalid'; isRead = $true; rating = 6 },
            @{ title = 'Invalid'; isbn = 'bad' }, @{ title = 'Invalid'; pageCount = -1 },
            @{ title = 'Invalid'; publicationYear = -1 }, @{ title = 'Invalid'; shelfId = [guid]::NewGuid() },
            @{ title = 'Invalid'; genres = @(('x' * 101)) }, @{ title = 'Invalid'; shelfLocation = ('x' * 501) },
            @{ title = 'Invalid'; sourceBookId = 'bad id' }, @{ title = 'Invalid'; coverUrl = 'https://example.com/cover' })) {
        $status = 0
        try {
            Invoke-WebRequest "$baseUrl/api/library/books/$($saved.id)" -Method Put -ContentType 'application/json' `
                -Body ($invalid | ConvertTo-Json) -UseBasicParsing | Out-Null
        } catch { $status = [int]$_.Exception.Response.StatusCode }
        Assert-True ($status -eq 400) 'Invalid PUT data must return 400.'
        $unchanged = Invoke-RestMethod "$baseUrl/api/library/books/$($saved.id)"
        Assert-True (($unchanged | ConvertTo-Json -Compress) -eq ($updated | ConvertTo-Json -Compress)) `
            'Rejected updates must not change any persisted fields.'
    }
    $status = 0
    try {
        Invoke-WebRequest "$baseUrl/api/library/books/$([guid]::NewGuid())" -Method Put -ContentType 'application/json' `
            -Body ($updatePayload | ConvertTo-Json) -UseBasicParsing | Out-Null
    } catch { $status = [int]$_.Exception.Response.StatusCode }
    Assert-True ($status -eq 404) 'PUT for a missing book must return 404.'
    $other = Invoke-RestMethod "$baseUrl/api/library/books/$($manual.id)"
    Assert-True ($other.title -eq 'Manual Book' -and $other.rating -eq 5) 'Updating a book must not change other copies.'

    $cleared = Invoke-RestMethod "$baseUrl/api/owned-books/$($saved.id)" -Method Put -ContentType 'application/json' `
        -Body (@{ title = 'Minimal update'; isRead = $false; rating = 5 } | ConvertTo-Json)
    foreach ($field in @('sourceBookId', 'isbn', 'description', 'coverUrl', 'format', 'authorGender', 'rating',
            'purchaseLocation', 'shelfLocation', 'shelfId', 'publicationYear', 'publisher', 'edition', 'pageCount')) {
        Assert-True ($null -eq $cleared.$field) "Omitted optional field $field must be cleared by PUT."
    }
    Assert-True ($cleared.genres.Count -eq 0) 'Omitting genres from PUT must clear the array.'
    Assert-True ($cleared.author -eq '' -and -not $cleared.isRead) 'PUT defaults must replace editable fields.'
    $shelf = Invoke-RestMethod "$baseUrl/api/shelves/$($secondShelf.id)"
    Assert-True ($shelf.bookIds.Count -eq 0) 'Clearing shelfId must remove shelf membership.'

    $updated = Invoke-RestMethod "$baseUrl/api/library/books/$($saved.id)" -Method Put -ContentType 'application/json' `
        -Body ($updatePayload | ConvertTo-Json)
    Stop-TestApi
    Start-TestApi
    $reloaded = Invoke-RestMethod "$baseUrl/api/library/books/$($saved.id)"
    Assert-True (($reloaded | ConvertTo-Json -Compress) -eq ($updated | ConvertTo-Json -Compress)) `
        'All updated metadata and ownership fields must survive restart.'
    $library = Invoke-RestMethod "$baseUrl/api/library/books"
    Assert-True ($library.Count -eq 2) 'PUT must not insert duplicate library books.'
    Write-Output 'PASS: create, update, normalization, validation, shelf moves/removal, immutable IDs, missing records, and persistence.'
} finally {
    Stop-TestApi
    # Only files created inside this unique temporary directory are removed.
    Get-ChildItem -LiteralPath $testDirectory -File | Remove-Item -Force
    Remove-Item -LiteralPath $testDirectory
}
