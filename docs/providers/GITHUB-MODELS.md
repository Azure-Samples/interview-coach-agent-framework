# GitHub Models setup

For local development and prototyping. Not for production.

## When to use GitHub Models

Good for learning, quick prototyping, demos, and following tutorials. No Azure setup needed, no credit card required.

Don't use it for production, sensitive data, or anything that needs reliable availability. For that, use [Foundry](MICROSOFT-FOUNDRY.md) or [Azure OpenAI](AZURE-OPENAI.md).

[Compare providers](README.md)

## What is GitHub Models?

[GitHub Models](https://github.com/marketplace/models) gives you free access to AI models (OpenAI, Meta, Microsoft, and others) directly from GitHub. Rate-limited, but no cost.

## Prerequisites

- GitHub account ([Sign up free](https://github.com/signup))

## Step 1: Get a GitHub Personal Access Token

You need a PAT with `models:read` scope.

### Create PAT

1. Follow this document, [Creating a fine-grained personal access token](https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

## Step 2: Store token

```bash
# Store GitHub token
dotnet user-secrets --file ./apphost.cs set GitHub:Token "{{GITHUB_PAT}}"
```

## Step 3: Run the app

```bash
# Using file-based Aspire (recommended)
aspire run --file ./apphost.cs -- --provider GitHubModels

# Using project-based Aspire
aspire run --project ./src/InterviewCoach.AppHost -- --provider GitHubModels
```

## Rate limits

GitHub Models has usage limits. See [GitHub Models billing](https://docs.github.com/billing/concepts/product-billing/github-models) for details.

## Next steps

- [Learning objectives](../LEARNING-OBJECTIVES.md)
- [Architecture overview](../ARCHITECTURE.md)
- [Tutorials](../TUTORIALS.md)
- [FAQ](../FAQ.md)

## Resources

- [GitHub Models Documentation](https://docs.github.com/github-models)
- [Available Models](https://github.com/marketplace?type=models)
- [Personal Access Tokens Guide](https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub Models Terms of Service](https://docs.github.com/site-policy/github-terms/github-terms-for-additional-products-and-features#github-models)
