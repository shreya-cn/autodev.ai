import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import mammoth from 'mammoth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedTicket {
  summary: string;
  description: string;
  acceptanceCriteria: string[];
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
    console.log('[MOM API] Starting processing...');
    const body = await request.json();
    const { url, file, fileName, fileType, transcription } = body;
    console.log('[MOM API] Request method:', { hasUrl: !!url, hasFile: !!file, hasTranscription: !!transcription });

    let transcriptText = '';

    // Handle different input methods
    if (transcription) {
      // Direct text input
      console.log('[MOM API] Using direct transcription text');
      transcriptText = transcription;
    } else if (file) {
      console.log('[MOM API] Processing file:', fileName, fileType);
      // File upload (audio or text)
      const base64Data = file.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      if (fileType?.includes('audio') || fileName?.match(/\.(mp3|wav|m4a|mp4)$/i)) {
        console.log('[MOM API] Transcribing audio file...');
        // Transcribe audio file using OpenAI Whisper
        const audioFile = new File([buffer], fileName, { type: fileType });
        
        try {
          const transcriptionResponse = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            response_format: 'text',
          });
          transcriptText = transcriptionResponse as unknown as string;
          console.log('[MOM API] Audio transcription completed, length:', transcriptText.length);
        } catch (error) {
          console.error('[MOM API] Whisper transcription error:', error);
          throw new Error('Failed to transcribe audio file');
        }
      } else if (fileType?.includes('text') || fileName?.endsWith('.txt')) {
        // Text file
        console.log('[MOM API] Reading text file...');
        transcriptText = buffer.toString('utf-8');
      } else if (fileName?.endsWith('.vtt')) {
        console.log('[MOM API] Processing VTT file...');
        // WebVTT subtitle file - extract text and remove timing codes
        const vttContent = buffer.toString('utf-8');
        // Remove WEBVTT header and timing codes
        transcriptText = vttContent
          .split('\n')
          .filter(line => !line.startsWith('WEBVTT') && !line.match(/^\d{2}:\d{2}:\d{2}\.\d{3}/) && !line.includes('-->'))
          .filter(line => line.trim().length > 0)
          .join('\n');
      } else if (fileName?.endsWith('.docx') || fileType?.includes('wordprocessingml')) {
        console.log('[MOM API] Processing DOCX file...');
        // DOCX file - use mammoth to extract text
        try {
          const result = await mammoth.extractRawText({ buffer });
          transcriptText = result.value;
          console.log('[MOM API] DOCX text extracted, length:', transcriptText.length);
          if (result.messages && result.messages.length > 0) {
            console.log('[MOM API] Mammoth warnings:', result.messages);
          }
        } catch (error) {
          console.error('[MOM API] DOCX read error:', error);
          throw new Error('Failed to read .docx file. Please copy and paste the content as text instead.');
        }
      } else {
        throw new Error('Unsupported file type. Please upload audio (.mp3, .wav, .m4a), text (.txt), subtitles (.vtt), or Word documents (.docx).');
      }
    } else if (url) {
      // URL handling - for now, return error as we need specific Teams API integration
      // In production, you would fetch the recording/transcript from Teams API
      throw new Error('URL processing requires Teams API integration. Please use file upload or paste text for now.');
    } else {
      throw new Error('Please provide a URL, file, or transcription text');
    }

    console.log('[MOM API] Transcript text length:', transcriptText.length);
    
    if (!transcriptText || transcriptText.trim().length === 0) {
      throw new Error('No transcript text found. Please check your input.');
    }

    // Extract action items and metadata using GPT-4
    console.log('[MOM API] Calling OpenAI for extraction...');
    const extractionPrompt = `Analyze this meeting transcript and extract action items. Each action item should be formatted as a Jira ticket.

Transcript:
${transcriptText}

Instructions:
1. Look for action items marked as "Action item 1:", "Action item 2:", etc., OR identify implied action items from the discussion
2. For each action item, extract:
   - A clear, concise summary (under 100 characters)
   - Detailed description of what needs to be done (be comprehensive, include context, technical details, and expected outcomes)
   - Acceptance criteria (3-5 specific, measurable criteria that define when the task is complete)
   - Determine if it's a Bug, Story, Task, or Epic based on keywords:
     * Bug: "fix", "broken", "error", "issue", "not working", "crash", "failure"
     * Story: "feature", "enhancement", "improve", "add", "implement", "user story"
     * Epic: "large", "complex", "multiple features", "initiative"
     * Task: everything else (default)
   - Priority (Highest/High/Medium/Low/Lowest) based on urgency keywords:
     * Highest: "critical", "urgent", "ASAP", "immediately", "blocker"
     * High: "important", "soon", "high priority"
     * Medium: "normal", "standard" or no specific urgency mentioned
     * Low: "when possible", "nice to have", "low priority"
     * Lowest: "future", "someday", "backlog"
   - Story points (1, 2, 3, 5, 8, 13, 21) using Fibonacci sequence based on complexity
   - Assignee name if mentioned
   - Action item number

3. Also extract meeting metadata:
   - Date (if mentioned)
   - Time (if mentioned)
   - Duration (if mentioned)
   - Participant names

Respond with JSON in this exact format:
{
  "tickets": [
    {
      "actionItemNumber": 1,
      "summary": "Fix login API endpoint",
      "description": "The login API is returning 500 errors intermittently. This affects user authentication and prevents users from accessing their accounts. The issue appears to be related to database connection timeouts during peak hours.",
      "acceptanceCriteria": [
        "Login API returns proper 200 response for valid credentials",
        "Error handling returns appropriate 401/403 status codes",
        "API response time is under 500ms for 95% of requests",
        "All existing unit tests pass",
        "New integration tests added for error scenarios"
      ],
      "type": "Bug",
      "priority": "High",
      "storyPoints": 5,
      "assignee": "John Doe"
    }
  ],
  "metadata": {
    "date": "2026-02-05",
    "time": "14:00",
    "duration": "45 minutes",
    "participants": ["John Doe", "Jane Smith"]
  }
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing meeting transcripts and extracting actionable Jira tickets with detailed descriptions and acceptance criteria.',
        },
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    console.log('[MOM API] OpenAI response received');
    const result = JSON.parse(completion.choices[0].message.content || '{}');
    console.log('[MOM API] Parsed result:', { ticketCount: result.tickets?.length, hasMetadata: !!result.metadata });

    // Validate and ensure Fibonacci story points
    const fibonacci = [1, 2, 3, 5, 8, 13, 21];
    const toFibonacci = (num: number): number => {
      return fibonacci.reduce((prev, curr) => 
        Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
      );
    };

    // Normalize tickets
    const tickets: ExtractedTicket[] = (result.tickets || []).map((ticket: any) => ({
      actionItemNumber: ticket.actionItemNumber || 0,
      summary: ticket.summary || 'Action item',
      description: ticket.description || '',
      acceptanceCriteria: Array.isArray(ticket.acceptanceCriteria) ? ticket.acceptanceCriteria : [],
      type: ticket.type || 'Task',
      priority: ticket.priority || 'Medium',
      storyPoints: toFibonacci(ticket.storyPoints || 3),
      assignee: ticket.assignee,
    }));

    const metadata: MeetingMetadata = result.metadata || {};

    console.log('[MOM API] Analyzing ticket relationships based on keywords...');
    
    // Phase 2: Analyze relationships based on ticket summaries and descriptions
    let relatedTickets: number[][] = [];
    
    if (tickets.length > 1) {
      const ticketList = tickets.map((t, idx) => {
        const shortDesc = t.description.substring(0, 200);
        return '[' + idx + '] ' + t.summary + '\nDescription: ' + shortDesc + '...\n';
      }).join('\n');
      
      const relationshipPrompt = 'Analyze these Jira tickets and identify which ones should be linked as related.\n\n' +
        'Tickets:\n' + ticketList + '\n\n' +
        'Instructions:\n' +
        'Analyze the KEYWORDS, TOPICS, and TECHNICAL CONTENT in each ticket\'s summary and description.\n\n' +
        'Link tickets ONLY if they meet these criteria:\n\n' +
        '1. Hard Technical Dependency: One ticket blocks another\n' +
        '   LINK: "Set OAuth permissions" + "Build OAuth API" (API needs permissions first)\n' +
        '   LINK: "Create database schema" + "Create API using that schema"\n\n' +
        '2. Same Component/Feature: Both tickets work on the EXACT same component or feature\n' +
        '   LINK: "Add login form validation" + "Fix login form errors" (both modify login form)\n' +
        '   LINK: "Implement payment API" + "Add payment error handling" (both are payment feature)\n' +
        '   NO LINK: "OAuth integration" + "Knowledge base feature" (completely different features)\n' +
        '   NO LINK: "Jira board feature" + "Ticket generator feature" (different features)\n\n' +
        '3. Breaking Change Pair: Must deploy together\n' +
        '   LINK: "Change API response format" + "Update frontend to handle new format"\n\n' +
        'DO NOT link if:\n' +
        '- Different features/components (even if discussed in same meeting)\n' +
        '- Similar technology but different purposes ("both use React" is NOT a link)\n' +
        '- Vaguely related business domain ("both are tools" is NOT a link)\n\n' +
        'Extract common keywords from summaries (OAuth, API, login, payment, etc.) and ONLY link tickets sharing the SAME specific keywords for the SAME feature.\n\n' +
        'Respond with JSON:\n' +
        '{\n' +
        '  "relatedTickets": [[0, 1], [3, 4]]\n' +
        '}\n\n' +
        'If NO tickets are related, return {"relatedTickets": []}. Most tickets should NOT be linked.';




      try {
        const relationshipCompletion = await openai.chat.completions.create({
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing ticket relationships based on keywords and technical content. Be extremely conservative - only link tickets with clear technical dependencies or shared components. When in doubt, do NOT link.',
            },
            {
              role: 'user',
              content: relationshipPrompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1, // Very low temperature for consistent, conservative results
        });

        const relationshipResult = JSON.parse(relationshipCompletion.choices[0].message.content || '{}');
        relatedTickets = relationshipResult.relatedTickets || [];
        console.log('[MOM API] Found related ticket groups (before merging):', relatedTickets.length);
        
        // Merge overlapping groups - if tickets appear in multiple groups, combine them into one
        // Example: [[0,1], [0,2], [1,2]] should become [[0,1,2]]
        if (relatedTickets.length > 1) {
          const mergedGroups: number[][] = [];
          const processed = new Set<number>();
          
          for (const group of relatedTickets) {
            // Find if this group overlaps with any existing merged group
            let foundOverlap = false;
            for (let i = 0; i < mergedGroups.length; i++) {
              const hasOverlap = group.some(ticket => mergedGroups[i].includes(ticket));
              if (hasOverlap) {
                // Merge this group into the existing group
                const combined = new Set([...mergedGroups[i], ...group]);
                mergedGroups[i] = Array.from(combined).sort((a, b) => a - b);
                foundOverlap = true;
                break;
              }
            }
            
            if (!foundOverlap) {
              // No overlap found, add as new group
              mergedGroups.push([...group].sort((a, b) => a - b));
            }
          }
          
          // Second pass: merge any groups that now overlap after first pass
          let hasChanges = true;
          while (hasChanges) {
            hasChanges = false;
            for (let i = 0; i < mergedGroups.length; i++) {
              for (let j = i + 1; j < mergedGroups.length; j++) {
                const hasOverlap = mergedGroups[i].some(ticket => mergedGroups[j].includes(ticket));
                if (hasOverlap) {
                  // Merge group j into group i
                  const combined = new Set([...mergedGroups[i], ...mergedGroups[j]]);
                  mergedGroups[i] = Array.from(combined).sort((a, b) => a - b);
                  mergedGroups.splice(j, 1);
                  hasChanges = true;
                  break;
                }
              }
              if (hasChanges) break;
            }
          }
          
          relatedTickets = mergedGroups;
          console.log('[MOM API] Found related ticket groups (after merging):', relatedTickets.length);
        }
      } catch (error) {
        console.error('[MOM API] Error analyzing relationships:', error);
        // If relationship analysis fails, just continue with no relationships
        relatedTickets = [];
      }
    }

    console.log('[MOM API] Returning response:', { ticketCount: tickets.length, hasMetadata: !!metadata });

    return NextResponse.json({
      tickets,
      metadata,
      relatedTickets,
    });
  } catch (error) {
    console.error('[MOM API] Error processing MOM:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process transcript' },
      { status: 500 }
    );
  }
}
