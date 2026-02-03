import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Ticket {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  type?: string;
  updated?: string;
  created?: string;
}

interface Column {
  id: string;
  name: string;
  tickets: Ticket[];
}

export async function GET() {
  try {
    // Call the Python script to get Jira board data
    const workspaceRoot = process.cwd().replace('/autodev-ui', '');
    const { stdout, stderr } = await execAsync(
      `cd "${workspaceRoot}" && python3 -c "from jira_ticket_manager import JiraTicketManager; import json; manager = JiraTicketManager(); tickets = manager.get_all_open_tickets(); print(json.dumps({'tickets': tickets}))"`,
      { 
        shell: '/bin/zsh',
        env: { ...process.env },
        timeout: 10000 // 10 second timeout
      }
    );

    if (stderr && !stderr.includes('✓')) {
      console.error('Python script error:', stderr);
    }

    const data = JSON.parse(stdout.trim());
    
    // Organize tickets by status
    const columns: Column[] = [
      { id: 'todo', name: 'To Do', tickets: [] },
      { id: 'inprogress', name: 'In Progress', tickets: [] },
      { id: 'review', name: 'Review', tickets: [] },
      { id: 'done', name: 'Done', tickets: [] },
    ];

    // Distribute tickets into columns based on status
    if (data.tickets && Array.isArray(data.tickets)) {
      data.tickets.forEach((ticket: Ticket) => {
        const status = ticket.status?.toLowerCase() || '';
        
        if (status.includes('to do') || status.includes('todo') || status.includes('backlog')) {
          columns[0].tickets.push(ticket);
        } else if (status.includes('in progress') || status.includes('progress')) {
          columns[1].tickets.push(ticket);
        } else if (status.includes('review') || status.includes('code review')) {
          columns[2].tickets.push(ticket);
        } else if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
          columns[3].tickets.push(ticket);
        } else {
          columns[0].tickets.push(ticket); // Default to To Do
        }
      });
    }

    return NextResponse.json({ columns });
  } catch (error) {
    console.error('Error fetching Jira board:', error);
    
    // Return empty columns with error message
    return NextResponse.json({
      error: 'Failed to fetch Jira tickets. Please check your Jira credentials in .env.local',
      columns: [
        {
          id: 'todo',
          name: 'To Do',
          tickets: [],
        },
        {
          id: 'inprogress',
          name: 'In Progress',
          tickets: [],
        },
        {
          id: 'review',
          name: 'Review',
          tickets: [],
        },
        {
          id: 'done',
          name: 'Done',
          tickets: [],
        },
      ],
    });
  }
}
