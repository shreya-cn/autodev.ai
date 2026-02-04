# 🔐 Security Configuration Guide

## Overview
This document outlines how to properly configure secrets and credentials for the AutoDev.ai application. **Never commit secrets to the repository** - always use environment variables.

## Environment Variables

All sensitive configuration should be stored in `.env.local` (which is gitignored). Copy `.env.local.example` and fill in your actual values:

```bash
cp .env.local.example .env.local
```

### Required Variables

#### NextAuth Configuration
```env
NEXTAUTH_URL=http://localhost:3000  # Your application URL
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>  # Generate with: openssl rand -base64 32
```

#### Atlassian OAuth (for user authentication)
```env
ATLASSIAN_CLIENT_ID=<from-developer.atlassian.com>
ATLASSIAN_CLIENT_SECRET=<from-developer.atlassian.com>
```

#### OpenAI API
```env
OPENAI_API_KEY=sk-proj-<your-key>  # Get from https://platform.openai.com/account/api-keys
```

#### Jira API Access
```env
JIRA_URL=https://your-instance.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=<generate-at-id.atlassian.com>
```

### Optional Variables

```env
JIRA_PROJECT_KEY=SCRUM  # Change if your project key differs
CONFLUENCE_URL=https://your-instance.atlassian.net
CONFLUENCE_USER=your-email@example.com
CONFLUENCE_API_TOKEN=<generate-at-id.atlassian.com>
SPACE_KEY=~your-space-key
```

## How to Generate Secrets

### 1. NextAuth Secret
```bash
openssl rand -base64 32
```

### 2. Jira API Token
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the generated token
4. Add to `.env.local` as `JIRA_API_TOKEN`

### 3. OpenAI API Key
1. Go to https://platform.openai.com/account/api-keys
2. Create new secret key
3. Copy immediately (can't be retrieved later)
4. Add to `.env.local` as `OPENAI_API_KEY`

### 4. Atlassian OAuth Credentials
1. Go to https://developer.atlassian.com/console/myapps/
2. Create OAuth 2.0 integration
3. Add required scopes:
   - `read:me`
   - `read:jira-user`
   - `read:jira-work`
   - `write:jira-work`
   - `manage:jira-project`
   - `offline_access`
4. Add callback URL: `http://localhost:3000/api/auth/callback/atlassian`
5. Copy Client ID and Secret
6. Add to `.env.local` as `ATLASSIAN_CLIENT_ID` and `ATLASSIAN_CLIENT_SECRET`

## Security Best Practices

### ✅ DO
- ✅ Store all secrets in `.env.local`
- ✅ Use environment variables in code: `process.env.VARIABLE_NAME`
- ✅ Keep `.gitignore` rules for `.env*` files
- ✅ Rotate API keys regularly
- ✅ Use strong, unique secrets
- ✅ Document environment variable requirements in `.env.local.example`
- ✅ Use GitHub Secrets for CI/CD pipelines

### ❌ DON'T
- ❌ Never hardcode secrets in source code
- ❌ Never commit `.env.local` to git
- ❌ Never expose API keys in error messages
- ❌ Never log sensitive information
- ❌ Never share `.env.local` file
- ❌ Never use the same key for dev and production

## GitHub Actions / CI/CD

When using GitHub Actions or other CI/CD tools, configure secrets through the platform's secret management:

### GitHub Actions Example
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
  ATLASSIAN_CLIENT_SECRET: ${{ secrets.ATLASSIAN_CLIENT_SECRET }}
```

Never use `echo` or `print` statements that might expose secrets in logs.

## Verification

To verify your configuration is correct:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Check for errors in console:**
   - Look for "not configured" or "401 Unauthorized" errors
   - These indicate missing or incorrect environment variables

3. **Test OAuth login:**
   - Navigate to http://localhost:3000
   - Click "Sign in with Atlassian"
   - You should be redirected to Atlassian login

4. **Test API access:**
   - After login, the Related Tickets component should load
   - Check browser console for any API errors

## Troubleshooting

### 401 Unauthorized / Invalid API Key
- **OpenAI:** Check key starts with `sk-proj-` and account has credits
- **Jira:** Verify token at https://id.atlassian.com/manage-profile/security/api-tokens
- **Atlassian OAuth:** Verify credentials match your OAuth app settings

### Session Expired / Logout Loop
- Check `NEXTAUTH_SECRET` is set
- Verify `NEXTAUTH_URL` matches your domain
- Clear browser cookies and try again

### No Related Tickets Showing
- Verify `OPENAI_API_KEY` is valid
- Check you have assigned tickets in Jira
- Check browser console for errors

## Removing Secrets from Git History

If you accidentally committed secrets to git:

```bash
# Remove from entire history (requires force push)
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --tree-filter 'rm -f .env.local' -- --all

# Force push to update remote
git push --force-with-lease
```

⚠️ **WARNING:** This rewrites git history and requires all team members to re-clone.

**Recommended:** Use `git-filter-repo` for more reliable history rewriting:
```bash
git filter-repo --invert-paths --path .env.local
```

## References

- [NextAuth.js Configuration](https://next-auth.js.org/getting-started/example)
- [Atlassian OAuth Apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Jira Cloud API Authentication](https://developer.atlassian.com/cloud/jira/rest/authenticate-asap/)
- [OpenAI API Keys](https://platform.openai.com/docs/guides/authentication)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
