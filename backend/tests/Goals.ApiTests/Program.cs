using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using MyLibrary.Api.Data;
using MyLibrary.Api.Domain;
using MyLibrary.Api.Goals;
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
var scopedConnection = new NpgsqlConnectionStringBuilder(connectionString) { SearchPath = schema };
builder.Services.AddDbContext<LibraryDbContext>(options => options.UseNpgsql(scopedConnection.ConnectionString));
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
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<LibraryDbContext>();
        await db.Database.MigrateAsync();
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
        new { startDate = "2026-01-01", endDate = "2026-12-31", goalType = "PageCount", num = 1.5 }
    })
    {
        await Request(HttpMethod.Post, route, invalid, HttpStatusCode.BadRequest);
        await Request(HttpMethod.Put, $"{route}/{saved[0]["id"]}", invalid, HttpStatusCode.BadRequest);
    }
    Check(JsonNode.DeepEquals(await Request(HttpMethod.Get, $"{route}/{saved[0]["id"]}", null, HttpStatusCode.OK), saved[0]), "Invalid PUT changed saved data.");
    var updated = await Request(HttpMethod.Put, $"{route}/{saved[0]["id"]}",
        new { startDate = "2027-02-01", endDate = "2027-02-01", goalType = "ReadBookPercentage", num = 100 }, HttpStatusCode.OK);
    Check(updated!["id"]!.GetValue<string>() == saved[0]["id"]!.GetValue<string>(), "Update changed ID.");
    Check(updated["num"]!.GetValue<int>() == 100 && updated["goalType"]!.GetValue<string>() == "ReadBookPercentage", "Update lost values.");
    // A fresh context and connection verify values were persisted, independently of HTTP tracking.
    await using (var db = new LibraryDbContext(new DbContextOptionsBuilder<LibraryDbContext>().UseNpgsql(scopedConnection.ConnectionString).Options))
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
    await app.StopAsync();
    Console.WriteLine("PASS: PostgreSQL migration, all goal types, CRUD, validation, persistence, and missing records.");
}
finally
{
    await using var drop = new NpgsqlCommand($"DROP SCHEMA \"{schema}\" CASCADE", connection);
    await drop.ExecuteNonQueryAsync();
}
