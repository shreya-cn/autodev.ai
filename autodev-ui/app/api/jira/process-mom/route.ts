import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedTicket {
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
    const body = await request.json();
    const { url, file, fileName, fileType, transcription } = body;

    let transcriptText = '';

    // Handle different input methods
    if (transcription) {
      // Direct text input
      transcriptText = transcription;
    } else if (file) {
      // File upload (audio or text)
      const base64Data = file.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      if (fileType?.includes('audio') || fileName?.match(/\.(mp3|wav|m4a|mp4)$/i)) {
        // Transcribe audio file using OpenAI Whisper
        const audioFile = new File([buffer], fileName, { type: fileType });
        
        try {
          const transcriptionResponse = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            response_format: 'text',
          });
          transcriptText = transcriptionResponse as unknown as string;
        } catch (error) {
          console.error('Whisper transcription error:', error);
          throw new Error('Failed to transcribe audio file');
        }
      } else if (fileType?.includes('text') || fileName?.endsWith('.txt')) {
        // Text file
        transcriptText = buffer.toString('utf-8');
      } else if (fileName?.endsWith('.vtt')) {
        // WebVTT subtitle file - extract text and remove timing codes
        const vttContent = buffer.toString('utf-8');
        // Remove WEBVTT header and timing codes
        transcriptText = vttContent
          .split('\n')
          .filter(line => !line.startsWith('WEBVTT') && !line.match(/^\d{2}:\d{2}:\d{2}\.\d{3}/) && !line.includes('-->'))
          .filter(line => line.trim().length > 0)
          .join('\n');
      } else if (fileName?.endsWith('.docx') || fileType?.includes('wordprocessingml')) {
        // DOCX file - for now, try to extract as text
        // Note: This is a basic implementation. For better results, consider using a library like 'mammoth'
        try {
          transcriptText = buffer.toString('utf-8');
        } catch (error) {
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

    // Extract action items and metadata using GPT-4
    const extractionPrompt = `Analyze this meeting transcript and extract action items. Each action item should be formatted as a Jira ticket.

Transcript:
${transcriptText}

Instructions:
1. Look for action items marked as "Action item 1:", "Action item 2:", etc., OR identify implied action items from the discussion
2. For each action item, extract:
   - A clear, concise summary (under 100 characters)
   - Detailed description of what needs to be done
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

4. Identify groups of related action items (items that work together or depend on each other)

Respond with JSON in this exact format:
{
  "tickets": [
    {
      "actionItemNumber": 1,
      "summary": "Fix login API endpoint",
      "description": "The login API is returning 500 errors intermittently...",
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
  },
  "relatedTickets": [[0, 1], [2, 3, 4]]
}

Note: relatedTickets contains arrays of ticket indices that are related to each other.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing meeting transcripts and extracting actionable Jira tickets with appropriate metadata.',
        },
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

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
      type: ticket.type || 'Task',
      priority: ticket.priority || 'Medium',
      storyPoints: toFibonacci(ticket.storyPoints || 3),
      assignee: ticket.assignee,
    }));

    const metadata: MeetingMetadata = result.metadata || {};
    const relatedTickets: number[][] = result.relatedTickets || [];

    return NextResponse.json({
      tickets,
      metadata,
      relatedTickets,
    });
  } catch (error) {
    console.error('Error processing MOM:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process transcript' },
      { status: 500 }
    );
  }
}
