import NextAuth, { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'atlassian',
      name: 'Atlassian',
      type: 'oauth',
      authorization: {
        url: 'https://auth.atlassian.com/authorize',
        params: {
          audience: 'api.atlassian.com',
          prompt: 'consent',
          scope: 'read:me read:jira-user read:jira-work write:jira-work manage:jira-project read:board-scope:jira-software read:sprint:jira-software offline_access',
          response_type: 'code',
        },
      },
      token: {
        url: 'https://auth.atlassian.com/oauth/token',
        async request({ client, params, checks, provider }) {
          const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: provider.clientId as string,
            client_secret: provider.clientSecret as string,
            code: params.code as string,
            redirect_uri: provider.callbackUrl as string,
          });
          
          const response = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          });
          
          const tokens = await response.json();
          
          if (!response.ok) {
            throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`);
          }
          
          return { tokens };
        },
      },
      userinfo: {
        url: 'https://api.atlassian.com/me',
        async request({ tokens, provider }) {
          const response = await fetch('https://api.atlassian.com/me', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          });
          
          const profile = await response.json();
          
          if (!response.ok) {
            throw new Error(`Userinfo fetch failed: ${JSON.stringify(profile)}`);
          }
          
          return profile;
        },
      },
      clientId: process.env.ATLASSIAN_CLIENT_ID,
      clientSecret: process.env.ATLASSIAN_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.account_id,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accountId = (profile as any).account_id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.accessToken) {
        session.accessToken = token.accessToken;
      }
      if (token.accountId) {
        session.accountId = token.accountId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
