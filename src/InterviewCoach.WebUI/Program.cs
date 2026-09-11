using InterviewCoach.WebUI.Components;
using InterviewCoach.WebUI.Services;

using Microsoft.Agents.AI.AGUI;
using Microsoft.Extensions.AI;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddRazorComponents()
                .AddInteractiveServerComponents();

#pragma warning disable EXTEXP0001
builder.Services.AddHttpClient("agent", client =>
{
    client.BaseAddress = new Uri("https+http://agent");
    client.Timeout = TimeSpan.FromMinutes(5);
})
// A model turn can take longer than the default 30-second policy. Retrying a
// state-changing agent POST could repeat tool writes.
.RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001

builder.Services.AddScoped<FileUploadService>();

builder.Services.AddChatClient(sp => new AGUIChatClient(
    httpClient: sp.GetRequiredService<IHttpClientFactory>().CreateClient("agent"),
    endpoint: "ag-ui")
);

var app = builder.Build();

app.MapDefaultEndpoints();

if (app.Environment.IsDevelopment() == false)
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseAntiforgery();

app.UseStaticFiles();

app.MapRazorComponents<App>()
   .AddInteractiveServerRenderMode();

await app.RunAsync();
