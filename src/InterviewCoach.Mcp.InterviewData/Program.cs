using System.Reflection;

using InterviewCoach.Mcp.InterviewData;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.AddCosmosDbContext<InterviewDataDbContext>("interviewdb", "interviewdb");
builder.Services.AddScoped<IInterviewSessionRepository, InterviewSessionRepository>();

builder.Services.AddMcpServer()
                .WithHttpTransport(o => o.Stateless = true)
                .WithToolsFromAssembly(Assembly.GetEntryAssembly());

var app = builder.Build();

app.MapDefaultEndpoints();

if (app.Environment.IsDevelopment())
{
    // The Cosmos DB emulator uses local key auth, so the app can create the database and
    // container here for a smooth local dev experience. In Azure the account is keyless
    // (Entra ID), which does not permit management-plane operations from the data-plane SDK,
    // so the database and container are provisioned by Aspire (AddCosmosDatabase/AddContainer).
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<InterviewDataDbContext>();
    await dbContext.Database.EnsureCreatedAsync();
}
else
{
    app.UseHttpsRedirection();
}

app.MapMcp("/mcp");

await app.RunAsync();
