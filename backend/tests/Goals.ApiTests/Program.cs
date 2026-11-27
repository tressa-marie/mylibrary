using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using MyLibrary.Api.Data;
using MyLibrary.Api.Domain;
using MyLibrary.Api.Goals;
using MyLibrary.Api.OwnedBooks;
using Npgsql;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}

var valid = new SaveGoalRequest
{
    StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31),
    GoalType = GoalType.BookCount, Num = 12
};
Check(valid.Validate().Count == 0, "Valid goal rejected.");
Check(new SaveGoalRequest().Validate().Count == 4, "Missing required fields accepted.");
valid.EndDate = valid.StartDate.Value.AddDays(-1);
Check(valid.Validate().ContainsKey("endDate"), "Reversed dates accepted.");
valid.EndDate = valid.StartDate;
valid.Num = 0;
Check(valid.Validate().Count == 0, "Same-day goal or zero target rejected.");
valid.Num = -1;
Check(valid.Validate().ContainsKey("num"), "Negative target accepted.");
valid.GoalType = (GoalType)999;
Check(valid.Validate().ContainsKey("goalType"), "Unknown goal type accepted.");
valid.GoalType = GoalType.ReadBookPercentage;
valid.Num = 101;
Check(valid.Validate().ContainsKey("num"), "Percentage over 100 accepted.");
valid.Num = 100;
Check(valid.Validate().Count == 0, "100 percent rejected.");
valid.IncludeNonLibraryBooks = true;
foreach (var type in Enum.GetValues<GoalType>())
{
    valid.GoalType = type;
    var allowed = type is GoalType.BookCount or GoalType.PageCount;
    Check(valid.Validate().ContainsKey("includeNonLibraryBooks") != allowed,
        $"Incorrect outside-library validation for {type}.");
}
Console.WriteLine("PASS: goal request validation.");
if (args.Contains("--validation-only")) return;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddUserSecrets(typeof(LibraryDbContext).Assembly, optional: true);
builder.Configuration.AddEnvironmentVariables();
var connectionString = builder.Configuration["GoalsTest:ConnectionString"]
    ?? builder.Configuration.GetConnectionString("Library")
    ?? throw new InvalidOperationException("Set GoalsTest__ConnectionString to a PostgreSQL test database connection string.");
// Only this unique schema is migrated and removed; existing library tables are untouched.
var schema = "goals_test_" + Guid.NewGuid().ToString("N");
Console.WriteLine($"Using isolated test schema: {schema}");
var scopedConnection = new NpgsqlConnectionStringBuilder(connectionString) { SearchPath = schema };
var schemaInterceptor = new TestSchemaInterceptor(schema);
builder.Services.AddDbContext<LibraryDbContext>(options => options.UseNpgsql(scopedConnection.ConnectionString).AddInterceptors(schemaInterceptor));
builder.WebHost.UseUrls("http://127.0.0.1:0");
builder.Logging.ClearProviders();
await using var connection = new NpgsqlConnection(connectionString);
await connection.OpenAsync();
await using (var create = new NpgsqlCommand($"CREATE SCHEMA \"{schema}\"", connection))
    await create.ExecuteNonQueryAsync();
try
{
    await using var app = builder.Build();
    app.MapGoals();
    app.MapOwnedBooks();
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<LibraryDbContext>();
        var activeSchema = await db.Database.SqlQueryRaw<string>("SELECT current_schema() AS \"Value\"").SingleAsync();
        Check(activeSchema == schema, "Stopped before migration because schema isolation was not established.");
        await db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>().MigrateAsync("20261127043848_AddGoals");
        var legacyId = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Goals" ("Id", "StartDate", "EndDate", "GoalType", "Num")
            VALUES ({legacyId}, {new DateOnly(2026, 1, 1)}, {new DateOnly(2026, 12, 31)}, 'BookCount', 12)
            """);
        await db.Database.MigrateAsync();
        var legacyGoal = await db.Goals.SingleAsync(x => x.Id == legacyId);
        Check(!legacyGoal.IncludeNonLibraryBooks && legacyGoal.Num == 12 && legacyGoal.CompletedCount is null, "Migration did not preserve existing goals with automatic progress.");
        db.Goals.Remove(legacyGoal);
        await db.SaveChangesAsync();
        Check(!db.Database.HasPendingModelChanges(), "Migration does not match model.");
    }
    await app.StartAsync();
    var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
    using var client = new HttpClient { BaseAddress = new Uri(address) };
    async Task<JsonNode?> Request(HttpMethod method, string path, object? body, HttpStatusCode status)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null) request.Content = JsonContent.Create(body);
        using var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        Check(response.StatusCode == status, $"{method} {path}: expected {status}, got {response.StatusCode}: {text}");
        return string.IsNullOrEmpty(text) ? null : JsonNode.Parse(text);
    }
    const string route = "/api/goals";
    Check((await Request(HttpMethod.Get, "/api/library/books", null, HttpStatusCode.OK))!.AsArray().Count == 0,
        "Isolated test library must be empty before adding progress data.");
    var progressBook = await Request(HttpMethod.Post, "/api/library/books", new {
        title = "Progress data", pageCount = 321, isRead = true,
        dateRead = "2026-01-15", dateAcquired = "2026-01-01"
    }, HttpStatusCode.Created);
    var summaries = (await Request(HttpMethod.Get, "/api/library/books", null, HttpStatusCode.OK))!.AsArray();
    Check(summaries.Count == 1, $"One POST should create exactly one library copy; got {summaries.Count}.");
    var summary = summaries.Single(x => x!["id"]!.GetValue<Guid>() == progressBook!["id"]!.GetValue<Guid>())!;
    Check(summary["pageCount"]!.GetValue<int>() == 321
        && summary["dateRead"]!.GetValue<string>() == "2026-01-15"
        && summary["dateAcquired"]!.GetValue<string>() == "2026-01-01", "Library summary is missing goal progress data.");
    Guid unreadId;
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<LibraryDbContext>();
        var legacyUnread = new OwnedBook { Title = "Unread rating fixture", Author = "Test author", IsRead = false, Rating = 4.5,
            PageCount = 123, PurchaseLocation = "Test shop", DateAcquired = new DateOnly(2026, 1, 2), DateRead = new DateOnly(2020, 1, 1), Genres = ["Fantasy"] };
        db.OwnedBooks.Add(legacyUnread);
        await db.SaveChangesAsync();
        unreadId = legacyUnread.Id;
    }
    var readPath = $"/api/library/books/{unreadId}";
    var originalUnread = await Request(HttpMethod.Get, readPath, null, HttpStatusCode.OK);
    foreach (var invalidRating in new[] { -1, 6 })
        await Request(HttpMethod.Patch, readPath + "/read", new { rating = invalidRating }, HttpStatusCode.BadRequest);
    Check(JsonNode.DeepEquals(originalUnread, await Request(HttpMethod.Get, readPath, null, HttpStatusCode.OK)), "Invalid rating changed the book.");
    var skippedRead = await Request(HttpMethod.Patch, readPath + "/read", new { dateRead = "2026-11-27" }, HttpStatusCode.OK);
    var expectedSkip = originalUnread!.DeepClone();
    expectedSkip["isRead"] = true;
    expectedSkip["dateRead"] = "2026-11-27";
    Check(JsonNode.DeepEquals(expectedSkip, skippedRead), "Skip must update isRead and dateRead while preserving the existing rating and other fields.");
    Check(JsonNode.DeepEquals(expectedSkip, await Request(HttpMethod.Get, readPath, null, HttpStatusCode.OK)), "Skip was not persisted.");
    foreach (var rating in new[] { 0.0, 3.75, 5.0 })
    {
        var ratedRead = await Request(HttpMethod.Patch, readPath + "/read", new { rating, dateRead = "2026-11-28" }, HttpStatusCode.OK);
        expectedSkip["rating"] = rating;
        expectedSkip["dateRead"] = "2026-11-28";
        Check(JsonNode.DeepEquals(expectedSkip, ratedRead), "Rating submission changed unrelated fields.");
        Check(JsonNode.DeepEquals(ratedRead, await Request(HttpMethod.Get, readPath, null, HttpStatusCode.OK)), "Submitted rating was not persisted.");
    }
    await Request(HttpMethod.Patch, $"/api/library/books/{Guid.NewGuid()}/read", new { }, HttpStatusCode.NotFound);
    var fallbackDate = await Request(HttpMethod.Patch, readPath + "/read", new { }, HttpStatusCode.OK);
    Check(fallbackDate!["dateRead"]!.GetValue<string>() == DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd"), "Missing action date must default to today.");
    var addedRead = await Request(HttpMethod.Post, "/api/library/books", new { title = "Added as read", isRead = true }, HttpStatusCode.Created);
    Check(addedRead!["dateRead"] is null, "Adding a read book must not automatically set a read date.");
    var addedUnread = await Request(HttpMethod.Post, "/api/library/books", new { title = "Edited to read", isRead = false, dateRead = "2020-02-02" }, HttpStatusCode.Created);
    var editedRead = await Request(HttpMethod.Put, $"/api/library/books/{addedUnread!["id"]}", new { title = "Edited to read", isRead = true, dateRead = "2020-02-02" }, HttpStatusCode.OK);
    Check(editedRead!["dateRead"]!.GetValue<string>() == "2020-02-02", "Editing read status must not replace the supplied read date with today.");
    var editedWithoutDate = await Request(HttpMethod.Put, $"/api/library/books/{addedRead["id"]}", new { title = "Added as read", isRead = true }, HttpStatusCode.OK);
    Check(editedWithoutDate!["dateRead"] is null, "Editing a read book must not automatically set a read date.");
    Console.WriteLine("PASS: book-icon Skip/Submit update read date; Add/Edit never auto-date read status; rating and metadata preservation verified.");
    if (args.Contains("--books-only"))
    {
        await app.StopAsync();
        return;
    }
    Check((await Request(HttpMethod.Get, route, null, HttpStatusCode.OK))!.AsArray().Count == 0, "Initial list is not empty.");
    var saved = new List<JsonNode>();
    foreach (var type in Enum.GetNames<GoalType>())
    {
        var payload = new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = type, num = 12 };
        using var response = await client.PostAsJsonAsync(route, payload);
        Check(response.StatusCode == HttpStatusCode.Created, "Create failed.");
        var goal = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        var id = goal["id"]!.GetValue<Guid>();
        Check(id != Guid.Empty, "Empty ID.");
        Check(response.Headers.Location?.ToString() == $"{route}/{id}", "Incorrect Location header.");
        Check(goal["goalType"]!.GetValue<string>() == type && goal["num"]!.GetValue<int>() == 12, "Incorrect fields.");
        Check(!goal["includeNonLibraryBooks"]!.GetValue<bool>(), "Omitted flag must default to false.");
        Check(goal["startDate"]!.GetValue<string>() == payload.startDate && goal["endDate"]!.GetValue<string>() == payload.endDate, "Dates changed.");
        Check(JsonNode.DeepEquals(await Request(HttpMethod.Get, $"{route}/{id}", null, HttpStatusCode.OK), goal), "Read differs from create.");
        saved.Add(goal);
    }
    foreach (var invalid in new object[] {
        new { }, new { startDate = "2026-01-01", endDate = "2025-12-31", goalType = "BookCount", num = 1 },
        new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = "BookCount", num = -1 },
        new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = "ReadBookPercentage", num = 101 },
        new { startDate = "invalid", endDate = "2026-12-31", goalType = "BookCount", num = 1 },
        new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = "Unknown", num = 1 },
        new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = 999, num = 1 },
        new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = "PageCount", num = 1.5 },
        new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = "BuyBookCount", num = 12, includeNonLibraryBooks = true },
        new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = "ReadBookPercentage", num = 50, includeNonLibraryBooks = true }
    })
    {
        await Request(HttpMethod.Post, route, invalid, HttpStatusCode.BadRequest);
        await Request(HttpMethod.Put, $"{route}/{saved[0]["id"]}", invalid, HttpStatusCode.BadRequest);
    }
    Check(JsonNode.DeepEquals(await Request(HttpMethod.Get, $"{route}/{saved[0]["id"]}", null, HttpStatusCode.OK), saved[0]), "Invalid PUT changed saved data.");
    foreach (var type in new[] { "BookCount", "PageCount" })
    {
        var goal = saved.Single(x => x["goalType"]!.GetValue<string>() == type);
        var path = $"{route}/{goal["id"]}";
        var enabled = new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = type, num = 12, includeNonLibraryBooks = true };
        var enabledGoal = await Request(HttpMethod.Put, path, enabled, HttpStatusCode.OK);
        Check(enabledGoal!["includeNonLibraryBooks"]!.GetValue<bool>(), "Allowed update did not enable outside books.");
        Check(JsonNode.DeepEquals(await Request(HttpMethod.Get, path, null, HttpStatusCode.OK), enabledGoal), "Flag did not persist on update.");
        foreach (var forbiddenType in new[] { "BuyBookCount", "ReadBookPercentage" })
        {
            await Request(HttpMethod.Put, path, new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = forbiddenType, num = 12, includeNonLibraryBooks = true }, HttpStatusCode.BadRequest);
            Check(JsonNode.DeepEquals(await Request(HttpMethod.Get, path, null, HttpStatusCode.OK), enabledGoal), "Rejected type change modified saved data.");
        }
        var duplicate = await Request(HttpMethod.Post, route, enabled, HttpStatusCode.Conflict);
        Check(duplicate!["errors"]!["goalType"] is not null, "Duplicate type did not return a goalType error.");
    }
    foreach (var original in saved)
    {
        var path = $"{route}/{original["id"]}";
        var type = original["goalType"]!.GetValue<string>();
        var count = type == "ReadBookPercentage" ? 75.25m : 4m;
        var manual = await Request(HttpMethod.Put, path, new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = type, num = 12, completedCount = count }, HttpStatusCode.OK);
        Check(manual!["completedCount"]!.GetValue<decimal>() == count, "Manual count was not saved.");
        Check(JsonNode.DeepEquals(await Request(HttpMethod.Get, path, null, HttpStatusCode.OK), manual), "Manual count was not persisted.");
        foreach (var invalidCount in new[] { -1m, type == "ReadBookPercentage" ? 101m : 1.5m })
            await Request(HttpMethod.Put, path, new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = type, num = 12, completedCount = invalidCount }, HttpStatusCode.BadRequest);
        Check(JsonNode.DeepEquals(await Request(HttpMethod.Get, path, null, HttpStatusCode.OK), manual), "Invalid manual count changed saved data.");
        var differentType = type == "BookCount" ? "PageCount" : "BookCount";
        await Request(HttpMethod.Put, path, new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = differentType, num = 12 }, HttpStatusCode.BadRequest);
        var automatic = await Request(HttpMethod.Put, path, new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = type, num = 12, completedCount = (decimal?)null }, HttpStatusCode.OK);
        Check(automatic!["completedCount"] is null, "Automatic progress was not restored.");
    }
    var updated = await Request(HttpMethod.Put, $"{route}/{saved[0]["id"]}",
        new { startDate = "2027-02-01", endDate = "2027-02-01", goalType = "BookCount", num = 100 }, HttpStatusCode.OK);
    Check(updated!["id"]!.GetValue<string>() == saved[0]["id"]!.GetValue<string>(), "Update changed ID.");
    Check(updated["num"]!.GetValue<int>() == 100 && updated["goalType"]!.GetValue<string>() == "BookCount", "Update lost values.");
    Check(!updated["includeNonLibraryBooks"]!.GetValue<bool>(), "Omitting the flag on PUT must reset it to false.");
    // A fresh context and connection verify values were persisted, independently of HTTP tracking.
    await using (var db = new LibraryDbContext(new DbContextOptionsBuilder<LibraryDbContext>().UseNpgsql(scopedConnection.ConnectionString).AddInterceptors(schemaInterceptor).Options))
    {
        var persisted = await db.Goals.AsNoTracking().SingleAsync(x => x.Id == updated["id"]!.GetValue<Guid>());
        Check(persisted.Num == 100 && persisted.StartDate == new DateOnly(2027, 2, 1) && persisted.EndDate == persisted.StartDate,
            "Update was not persisted.");
    }
    Check((await Request(HttpMethod.Get, route, null, HttpStatusCode.OK))!.AsArray().Count == 4, "Invalid requests created records.");
    foreach (var goal in saved)
    {
        var path = $"{route}/{goal["id"]}";
        await Request(HttpMethod.Delete, path, null, HttpStatusCode.NoContent);
        await Request(HttpMethod.Get, path, null, HttpStatusCode.NotFound);
        await Request(HttpMethod.Put, path, new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = "BookCount", num = 1 }, HttpStatusCode.NotFound);
        await Request(HttpMethod.Delete, path, null, HttpStatusCode.NotFound);
    }
    Check((await Request(HttpMethod.Get, route, null, HttpStatusCode.OK))!.AsArray().Count == 0, "Delete did not persist.");
    foreach (var type in Enum.GetNames<GoalType>())
    {
        var payload = new { startDate = "2028-01-01", endDate = "2028-12-31", goalType = type, num = 12 };
        var responses = await Task.WhenAll(client.PostAsJsonAsync(route, payload), client.PostAsJsonAsync(route, payload));
        try
        {
            Check(responses.Count(x => x.StatusCode == HttpStatusCode.Created) == 1
                && responses.Count(x => x.StatusCode == HttpStatusCode.Conflict) == 1,
                "Concurrent creates must produce one goal and one conflict; got " + string.Join(", ", responses.Select(x => (int)x.StatusCode)) + ". " +
                string.Join(" ", await Task.WhenAll(responses.Select(x => x.Content.ReadAsStringAsync()))));
            var conflict = JsonNode.Parse(await responses.Single(x => x.StatusCode == HttpStatusCode.Conflict).Content.ReadAsStringAsync())!;
            Check(conflict["errors"]!["goalType"] is not null, "Race conflict did not return the goal type error.");
            var newGoal = JsonNode.Parse(await responses.Single(x => x.StatusCode == HttpStatusCode.Created).Content.ReadAsStringAsync())!;
            await Request(HttpMethod.Post, route, new { startDate = "2029-01-01", endDate = "2029-12-31", goalType = type, num = 20 }, HttpStatusCode.Conflict);
            await Request(HttpMethod.Delete, $"{route}/{newGoal["id"]}", null, HttpStatusCode.NoContent);
        }
        finally { foreach (var response in responses) response.Dispose(); }
    }
    await app.StopAsync();
    Console.WriteLine("PASS: PostgreSQL migration, all goal types, CRUD, validation, persistence, and missing records.");
}
finally
{
    // The admin connection may have been idle during long integration runs.
    await using var cleanupConnection = new NpgsqlConnection(connectionString);
    await cleanupConnection.OpenAsync();
    await using var drop = new NpgsqlCommand($"DROP SCHEMA \"{schema}\" CASCADE", cleanupConnection);
    await drop.ExecuteNonQueryAsync();
}
