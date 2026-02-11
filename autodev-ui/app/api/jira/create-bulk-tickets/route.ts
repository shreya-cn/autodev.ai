import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

interface TicketToCreate {
  summary: string;
  description: string;
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  type: 'Story' | 'Bug' | 'Task' | 'Epic';
  storyPoints: number;
  assignee?: string;
  actionItemNumber: number;
}

interface MeetingMetadata {
  date?: string;
  time?: string;
  duration?: string;
  participants?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login with Jira' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tickets, linkRelated, metadata }: { 
      tickets: TicketToCreate[], 
      linkRelated?: number[][], 
      metadata?: MeetingMetadata 
    } = body;

    if (!tickets || tickets.length === 0) {
      return NextResponse.json(
        { error: 'No tickets provided' },
        { status: 400 }
      );
    }

    // Get Jira cloud ID
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!resourcesRes.ok) {
      return NextResponse.json({ 
        error: 'Failed to fetch Jira resources'
      }, { status: resourcesRes.status });
    }

    const resources = await resourcesRes.json();
    
    if (!resources || resources.length === 0) {
      return NextResponse.json({ 
        error: 'No Jira sites found for your account'
      }, { status: 404 });
    }

    const cloudId = resources[0].id;
    const createdTickets: { key: string; index: number }[] = [];

    // Create meeting metadata description
    const meetingInfo = metadata ? `
*Meeting Information:*
${metadata.date ? `Date: ${metadata.date}` : ''}
${metadata.time ? `Time: ${metadata.time}` : ''}
${metadata.duration ? `Duration: ${metadata.duration}` : ''}
${metadata.participants ? `Participants: ${metadata.participants.join(', ')}` : ''}
` : '';

    // Create all tickets
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      
      // Map issue type to Jira's expected format
      let issueType = ticket.type;
      if (issueType === 'Epic') {
        issueType = 'Epic';
      } else if (issueType === 'Bug') {
        issueType = 'Bug';
      } else if (issueType === 'Story') {
        issueType = 'Story';
      } else {
        issueType = 'Task';
      }

      const issueData = {
        fields: {
          project: {
            key: 'SCRUM',
          },
          summary: `AI - ${ticket.summary}`,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `${ticket.description}\n\n${meetingInfo}\n*Action Item #${ticket.actionItemNumber}*`
                  }
                ]
              }
            ]
          },
          issuetype: {
            name: issueType,
          },
          priority: {
            name: ticket.priority,
          },
          labels: ticket.storyPoints ? [`sp-${ticket.storyPoints}`] : [], // Story Points in labels
        },
      };

      // Add assignee if specified
      if (ticket.assignee) {
        try {
          // Search for user by name
          const userSearchResponse = await fetch(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/user/search?query=${encodeURIComponent(ticket.assignee)}`,
            {
              headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
              },
            }
          );

          if (userSearchResponse.ok) {
            const users = await userSearchResponse.json();
            if (users && users.length > 0) {
              (issueData.fields as any).assignee = {
                accountId: users[0].accountId,
              };
            }
          }
        } catch (error) {
          // Continue without assignee
        }
      }

      const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(issueData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create ticket ${i + 1}: ${errorData.errors ? JSON.stringify(errorData.errors) : errorData.message || 'Unknown error'}`);
      }

      const createdIssue = await response.json();
      createdTickets.push({ key: createdIssue.key, index: i });
    }

    // Link related tickets if requested
    let linkedCount = 0;
    if (linkRelated && linkRelated.length > 0) {
      for (const group of linkRelated) {
        // Link each pair in the group
        for (let i = 0; i < group.length - 1; i++) {
          const fromTicket = createdTickets.find(t => t.index === group[i]);
          const toTicket = createdTickets.find(t => t.index === group[i + 1]);

          if (fromTicket && toTicket) {
            try {
              const linkResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issueLink`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.accessToken}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  type: {
                    name: 'Relates',
                  },
                  inwardIssue: {
                    key: fromTicket.key,
                  },
                  outwardIssue: {
                    key: toTicket.key,
                  },
                }),
              });

              if (linkResponse.ok) {
                linkedCount++;
              }
            } catch (error) {
              // Continue even if linking fails
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      created: createdTickets.length,
      linked: linkedCount,
      keys: createdTickets.map(t => t.key),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create tickets' },
      { status: 500 }
    );
  }
}
