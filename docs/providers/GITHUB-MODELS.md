# GitHub Models Setup Guide

This guide shows how to configure the Interview Coach application to use GitHub Models for local development and prototyping.

## When to Use GitHub Models

**Perfect for:**

- Learning and experimentation
- Rapid prototyping without Azure setup
- Local development and testing
- Quick demos and PoCs
- Following tutorials

**NOT recommended for:**

- Production deployments
- Applications handling sensitive/confidential data
- High-volume or commercial use
- Scenarios requiring SLAs or guaranteed availability

**For production**, use [Microsoft Foundry](MICROSOFT-FOUNDRY.md) or [Azure OpenAI](AZURE-OPENAI.md).

[Compare providers →](README.md)

## What is GitHub Models?

[GitHub Models](https://github.com/marketplace/models) is a free service that lets you:

- Access AI models directly from GitHub
- Experiment with models from OpenAI, Meta, Microsoft, and more
- Test and prototype without cloud setup
- No credit card required (with rate limits)

## Prerequisites

- GitHub account ([Sign up free](https://github.com/signup))

## Step 1: Get GitHub Personal Access Token

You need a GitHub Personal Access Token (PAT) with `models:read` scope.

### Create PAT

1. Follow this document, [Creating a fine-grained personal access token](https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

## Step 2: Store Token Securely

```bash
# Store GitHub token
dotnet user-secrets --file ./apphost.cs set GitHub:Token "{{GITHUB_PAT}}"
```

## Step 3: Run the Application

```bash
# Using file-based Aspire (recommended)
aspire run --file ./apphost.cs -- --provider GitHubModels

# Using project-based Aspire
aspire run --project ./src/InterviewCoach.AppHost -- --provider GitHubModels
```

## Rate Limits and Quotas

GitHub Models has usage limits. For more details, visit this page, [GitHub Models billing](https://docs.github.com/billing/concepts/product-billing/github-models).

## Next Steps

- **[Learning Objectives](LEARNING-OBJECTIVES.md)**: Understand what you'll learn
- **[Architecture Overview](ARCHITECTURE.md)**: Deep dive into system design
- **[Tutorials](TUTORIALS.md)**: Hands-on learning exercises
- **[FAQ](FAQ.md)**: Common questions answered

## Resources

- [GitHub Models Documentation](https://docs.github.com/github-models)
- [Available Models](https://github.com/marketplace?type=models)
- [Personal Access Tokens Guide](https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub Models Terms of Service](https://docs.github.com/site-policy/github-terms/github-terms-for-additional-products-and-features#github-models)
