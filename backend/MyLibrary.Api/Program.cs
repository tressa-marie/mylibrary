using Microsoft.EntityFrameworkCore;
using MyLibrary.Api.Books;
using MyLibrary.Api.Data;
using MyLibrary.Api.OwnedBooks;
using MyLibrary.Api.Shelves;

var builder = WebApplication.CreateBuilder(args);
var libraryConnectionString = builder.Configuration.GetConnectionString("Library")
    ?? throw new InvalidOperationException("The Library database connection string is missing.");
builder.Services.AddDbContext<LibraryDbContext>(options =>
    options.UseSqlite(libraryConnectionString));
builder.Services.AddHealthChecks();
if (builder.Configuration["Books:Provider"] != "GoogleBooks")
    throw new InvalidOperationException("Unsupported Books:Provider. Configure GoogleBooks or register another IBookProvider adapter.");
builder.Services.AddHttpClient<IBookProvider, GoogleBooksProvider>(http =>
{
    http.BaseAddress = new Uri(builder.Configuration["Books:BaseUrl"]!);
    http.Timeout = TimeSpan.FromSeconds(10);
    http.MaxResponseContentBufferSize = 4 * 1024 * 1024;
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
// Provider URLs may contain the API key; do not log them.
builder.Logging.AddFilter("System.Net.Http.HttpClient", LogLevel.None);

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<LibraryDbContext>().Database.MigrateAsync();
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Books:ApiKey"]))
    app.Logger.LogWarning("Books:ApiKey is not configured. Set Books__ApiKey in the terminal that starts the API.");
app.MapBooks();
app.MapOwnedBooks();
app.MapShelves();

app.MapHealthChecks("/api/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = (context, report) => context.Response.WriteAsJsonAsync(new
    {
        status = report.Status.ToString(),
        service = "My Library API"
    })
});

app.Run();
