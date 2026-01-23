using System.Reflection;

using InterviewCoach.Mcp.InterviewData;

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var connection = new SqliteConnection("Filename=:memory:");
connection.Open();

builder.Services.AddSingleton(connection);

builder.Services.AddDbContext<InterviewDataDbContext>(options => options.UseSqlite(connection));
builder.Services.AddScoped<IInterviewSessionRepository, InterviewSessionRepository>();

builder.Services.AddMcpServer()
                .WithHttpTransport(o => o.Stateless = true)
                .WithToolsFromAssembly(Assembly.GetEntryAssembly());

var app = builder.Build();

app.MapDefaultEndpoints();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<InterviewDataDbContext>();
    dbContext.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment() == false)
{
    app.UseHttpsRedirection();
}

app.MapMcp("/mcp");

await app.RunAsync();
