import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

interface CreateTicketRequest {
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  suggestedType: 'Story' | 'Bug' | 'Task' | 'Epic';
  suggestedPriority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  relatedComponents: string[];
  technicalNotes: string;
  storyPoints: number;
  recommendedAssignee?: string;
  assigneeMatchLevel?: string;
  assigneeReason?: string;
  assigneeAlternatives?: Array<{
    name: string;
    matchLevel: string;
    reason: string;
  }>;
  subtasks?: Array<{
    summary: string;
    description: string;
    storyPoints: number;
  }>;
  createSubtasks?: boolean;
}

export async function POST(request: Request) {
  try {
    const ticketData: CreateTicketRequest = await request.json();

    // Validate required fields
    if (!ticketData.summary || !ticketData.description) {
      return NextResponse.json(
        { error: 'Summary and description are required' },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ 
        error: 'Unauthorized - Please sign in again'
      }, { status: 401 });
    }

    // Get Jira resources
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!resourcesRes.ok) {
      if (resourcesRes.status === 401) {
        return NextResponse.json({ 
          error: 'Session expired',
          logout: true
        }, { status: 401 });
      }
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

    // Fetch Jira fields to find the Recommended Assignee field ID
    let recommendedAssigneeFieldId = null;
    try {
      const fieldsResponse = await fetch(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/field`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (fieldsResponse.ok) {
        const fields = await fieldsResponse.json();
        const recommendedAssigneeField = fields.find((field: any) => 
          field.name && field.name.toLowerCase().includes('recommended assignee')
        );
        if (recommendedAssigneeField) {
          recommendedAssigneeFieldId = recommendedAssigneeField.id;
        }
      }
    } catch (e) {
      console.log('Could not fetch field metadata, will skip custom field');
    }

    // Build the description with all sections
    let fullDescription = ticketData.description;

    // Add acceptance criteria section if available
    if (ticketData.acceptanceCriteria && ticketData.acceptanceCriteria.length > 0) {
      fullDescription += '\n\n*Acceptance Criteria:*\n';
      ticketData.acceptanceCriteria.forEach((criterion, index) => {
        fullDescription += `${index + 1}. ${criterion}\n`;
      });
    }

    // Add technical notes if available
    if (ticketData.technicalNotes && ticketData.technicalNotes.trim()) {
      fullDescription += '\n\n*Technical Notes:*\n';
      fullDescription += ticketData.technicalNotes;
    }

    // Add related components if available
    if (ticketData.relatedComponents && ticketData.relatedComponents.length > 0) {
      fullDescription += '\n\n*Related Components:*\n';
      fullDescription += ticketData.relatedComponents.join(', ');
    }

    // Create Jira ticket payload
    const issuePayload: any = {
      fields: {
        project: {
          key: 'SCRUM' // Update this to match your project key
        },
        summary: `AI - ${ticketData.summary}`,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: fullDescription
                }
              ]
            }
          ]
        },
        issuetype: {
          name: ticketData.suggestedType
        },
        priority: {
          name: ticketData.suggestedPriority
        },
        labels: ticketData.storyPoints ? [`sp-${ticketData.storyPoints}`] : []
      }
    };

    // Add recommended assignee to the custom field if available
    if (ticketData.recommendedAssignee && 
        ticketData.recommendedAssignee !== 'Unassigned' && 
        recommendedAssigneeFieldId) {
      
      // Set the Recommended Assignee field (keep it simple to stay under 255 char limit)
      issuePayload.fields[recommendedAssigneeFieldId] = ticketData.recommendedAssignee;
      
      // Also add as a label for easy filtering
      const assigneeLabel = `recommended-${ticketData.recommendedAssignee.replace(/\s+/g, '-').toLowerCase()}`;
      issuePayload.fields.labels = [...(issuePayload.fields.labels || []), assigneeLabel];
    }

    // Create the issue in Jira
    const createResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(issuePayload)
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.json();
      return NextResponse.json(
        { 
          error: 'Failed to create Jira ticket',
          details: error.errors || error.errorMessages || 'Unknown error'
        },
        { status: createResponse.status }
      );
    }

    const createdIssue = await createResponse.json();
    
    // Create subtasks if requested and available
    const createdSubtasks = [];
    
    if (ticketData.createSubtasks && ticketData.subtasks && ticketData.subtasks.length > 0) {
      // Check if parent issue type supports subtasks
      if (ticketData.suggestedType === 'Epic') {
        // Don't attempt to create subtasks for Epics
      } else {
        for (const subtask of ticketData.subtasks) {
          try {

          const subtaskPayload = {
            fields: {
              project: {
                key: 'SCRUM'
              },
              parent: {
                key: createdIssue.key
              },
              summary: `AI - ${subtask.summary}`,
              description: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: subtask.description
                      }
                    ]
                  }
                ]
              },
              issuetype: {
                name: 'Subtask'  // Try 'Subtask' first, then 'Sub-task' if this fails
              },
              labels: subtask.storyPoints ? [`sp-${subtask.storyPoints}`] : []
            }
          };

          const subtaskResponse = await fetch(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(subtaskPayload)
            }
          );

          if (subtaskResponse.ok) {
            const subtaskResult = await subtaskResponse.json();
            createdSubtasks.push(subtaskResult.key);
          }
        } catch (error) {
          // Continue creating other subtasks even if one fails
        }
      }
      }
    }
    
    return NextResponse.json({
      success: true,
      key: createdIssue.key,
      id: createdIssue.id,
      self: createdIssue.self,
      subtasks: createdSubtasks,
      message: createdSubtasks.length > 0 
        ? `Ticket ${createdIssue.key} created successfully with ${createdSubtasks.length} subtasks`
        : ticketData.createSubtasks && ticketData.suggestedType === 'Epic'
        ? `Epic ${createdIssue.key} created successfully (Note: Epics cannot have subtasks in Jira)`
        : `Ticket ${createdIssue.key} created successfully`
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create ticket',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
