---
name: code-reviewer
description: >-
  Review code for best practices, potential bugs, and improvements.
  Use when asked to review, analyze, or critique code quality.
---

## Instructions

When reviewing code:

1. **Best Practices** — Check adherence to language conventions and patterns.
2. **Potential Bugs** — Identify null references, race conditions, or logic errors.
3. **Improvements** — Suggest refactoring opportunities and performance gains.
4. **Security** — Flag any security concerns (SQL injection, hardcoded secrets, etc.).

For automated analysis, use the script at `scripts/analyze.cs` which performs
basic static checks on C# source files. Run with: `dotnet run scripts/analyze.cs -- <file.cs>`

Rate each finding as: 🔴 Critical | 🟡 Warning | 🟢 Suggestion