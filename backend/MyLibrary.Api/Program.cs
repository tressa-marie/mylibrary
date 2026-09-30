var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapHealthChecks("/api/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = (context, report) => context.Response.WriteAsJsonAsync(new
    {
        status = report.Status.ToString(),
        service = "My Library API"
    })
});

app.Run();
