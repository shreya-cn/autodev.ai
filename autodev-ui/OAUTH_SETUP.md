# AutoDev.ai - Setup Guide

## Atlassian OAuth Configuration

To enable Atlassian OAuth authentication, follow these steps:

### 1. Create an Atlassian OAuth App

1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Click **"Create"** → **"OAuth 2.0 integration"**
3. Name your app: `AutoDev.ai` (or any name you prefer)

### 2. Configure Permissions

Add the following scopes to your OAuth app:

**Jira API:**
- `read:jira-user` - Read user data from Jira
- `read:jira-work` - Read Jira project and issue data

**Confluence API:**
- `read:confluence-user` - Read user data from Confluence
- `read:confluence-content.all` - Read all Confluence content

**General:**
- `offline_access` - Get refresh tokens for long-lived sessions

### 3. Add Callback URL

In the OAuth app settings, add the following callback URL:

```
http://localhost:3000/api/auth/callback/atlassian
```

For production, add:
```
https://your-domain.com/api/auth/callback/atlassian
```

### 4. Get Client Credentials

1. After creating the app, you'll see:
   - **Client ID** - Copy this
   - **Secret** - Click "Generate Secret" and copy it

2. Create `.env.local` file in the `autodev-ui` directory:

```bash
cp .env.local.example .env.local
```

3. Update the following values in `.env.local`:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Atlassian OAuth
ATLASSIAN_CLIENT_ID=<your-client-id-from-step-4>
ATLASSIAN_CLIENT_SECRET=<your-client-secret-from-step-4>

# Jira/Confluence API (existing)
JIRA_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=<your-jira-api-token>

CONFLUENCE_URL=https://your-domain.atlassian.net
CONFLUENCE_USER=your-email@example.com
CONFLUENCE_API_TOKEN=<your-confluence-api-token>
SPACE_KEY=<your-space-key>
```

### 5. Generate NextAuth Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and use it as `NEXTAUTH_SECRET` in your `.env.local` file.

### 6. Start the Application

```bash
npm run dev
```

Visit `http://localhost:3000` and click "Sign in with Atlassian" to test the OAuth flow.

## How It Works

1. **User clicks "Sign in with Atlassian"** → Redirected to Atlassian login
2. **User authenticates with their Atlassian credentials** → Can use any Jira/Confluence account
3. **Atlassian redirects back to your app** → User details are fetched from Atlassian API
4. **Session is created** → User can access the application with their real Atlassian profile

## Features

- ✅ No hardcoded credentials
- ✅ Real user data from Atlassian (name, email, profile picture)
- ✅ Secure OAuth 2.0 flow
- ✅ Session management with refresh tokens
- ✅ Automatic token refresh

## Troubleshooting

### "OAuth callback URL mismatch" error
- Make sure the callback URL in your Atlassian app matches exactly: `http://localhost:3000/api/auth/callback/atlassian`

### "Invalid client credentials" error
- Double-check your `ATLASSIAN_CLIENT_ID` and `ATLASSIAN_CLIENT_SECRET` in `.env.local`

### Can't sign in
- Ensure you've added all the required scopes in the Atlassian OAuth app
- Check that `NEXTAUTH_SECRET` is set and valid

### User info not showing
- Verify the `read:jira-user` and `read:confluence-user` scopes are enabled
- Check browser console for any API errors
