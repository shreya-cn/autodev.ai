import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Get the current ticket from git branch and run AI suggester
    const workspaceRoot = process.cwd().replace('/autodev-ui', '');
    const { stdout } = await execAsync(
      `cd "${workspaceRoot}" && python3 ai_ticket_suggester.py 2>&1`,
      { 
        shell: '/bin/zsh',
        env: { ...process.env }
      }
    );

    // Parse the output to extract related tickets
    // The Python script outputs JSON or structured text
    const lines = stdout.split('\n');
    const tickets: any[] = [];
    let currentTicket = '';

    // Extract current ticket and suggestions from output
    lines.forEach(line => {
      if (line.includes('Current:')) {
        currentTicket = line.split(':')[1]?.trim() || '';
      }
      // Parse ticket information from output
      const ticketMatch = line.match(/(\w+-\d+)\s+-\s+(.+?)\s+\((\d+)%\s+match\)/);
      if (ticketMatch) {
        tickets.push({
          key: ticketMatch[1],
          summary: ticketMatch[2],
          score: parseInt(ticketMatch[3]),
          status: 'Unknown',
          reason: 'Related to current work',
        });
      }
    });

    return NextResponse.json({ tickets, currentTicket });
  } catch (error) {
    console.error('Error fetching related tickets:', error);
    
    // Return mock data
    return NextResponse.json({
      tickets: [
        {
          key: 'KAN-6',
          summary: 'Add filter to users-list table',
          status: 'To Do',
          score: 100,
          reason: 'Add filter option to users-list table',
        },
        {
          key: 'KAN-5',
          summary: 'Change table header',
          status: 'To Do',
          score: 100,
          reason: 'Add a new column in the users-list table. The column name should be "Address"',
        },
        {
          key: 'KAN-8',
          summary: 'Outdated npm dependencies detected',
          status: 'To Do',
          score: 100,
          reason: 'Limited support for React hooks, which restricts the ability to manage routing state',
        },
      ],
      currentTicket: 'KAN-4',
    });
  }
}
