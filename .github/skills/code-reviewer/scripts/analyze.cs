// Simple C# file-based app for basic code analysis
// Usage: dotnet run scripts/analyze.cs -- <file.cs>

var filePath = args.FirstOrDefault() ?? "Program.cs";

if (!File.Exists(filePath))
{
    Console.WriteLine($"File not found: {filePath}");
    Environment.Exit(1);
}

var lines = File.ReadAllLines(filePath);
var totalLines = lines.Length;
var emptyLines = lines.Count(l => string.IsNullOrWhiteSpace(l));
var todoCount = lines.Count(l => l.Contains("TODO", StringComparison.OrdinalIgnoreCase));
var longLines = lines.Count(l => l.Length > 120);

Console.WriteLine($"=== Code Analysis: {Path.GetFileName(filePath)} ===");
Console.WriteLine($"Total lines:    {totalLines}");
Console.WriteLine($"Empty lines:    {emptyLines} ({100.0 * emptyLines / totalLines:F1}%)");
Console.WriteLine($"TODO comments:  {todoCount}");
Console.WriteLine($"Long lines:     {longLines} (>120 chars)");

if (longLines > 0)
    Console.WriteLine("⚠️  Consider breaking long lines for readability.");
if (todoCount > 0)
    Console.WriteLine("⚠️  Unresolved TODO comments found.");