import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get accessible resources
    const resourcesRes = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!resourcesRes.ok) {
      return NextResponse.json(
        { error: 'Failed to get Jira resources' },
        { status: resourcesRes.status }
      );
    }

    const resources = await resourcesRes.json();

    if (!resources || resources.length === 0) {
      return NextResponse.json(
        { error: 'No accessible Jira resources found' },
        { status: 404 }
      );
    }

    const cloudId = resources[0].id;

    // Get users who can be assigned to issues in the project
    // First, let's get the project key (assuming SCRUM based on earlier code)
    const projectKey = 'SCRUM';
    
    const usersRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/user/assignable/search?project=${projectKey}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!usersRes.ok) {
      return NextResponse.json(
        { error: 'Failed to get team members' },
        { status: usersRes.status }
      );
    }

    const users = await usersRes.json();

    // Format the users data
    const teamMembers = users.map((user: any) => ({
      accountId: user.accountId,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      avatarUrl: user.avatarUrls?.['48x48'] || user.avatarUrls?.['32x32'] || user.avatarUrls?.['24x24'],
      active: user.active,
    }));

    return NextResponse.json({ teamMembers });

  } catch (error: any) {
    console.error('Error in team-members:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}
