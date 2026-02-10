import { NextResponse } from 'next/server';
import OpenAI from 'openai';

interface GeneratedTicket {
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  suggestedType: 'Story' | 'Bug' | 'Task' | 'Epic';
  suggestedPriority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  relatedComponents: string[];
  technicalNotes: string;
  storyPoints: number;
  subtasks?: Array<{
    summary: string;
    description: string;
    storyPoints: number;
  }>;
}

export async function POST(request: Request) {
  try {
    const { userInput } = await request.json();

    if (!userInput || typeof userInput !== 'string') {
      return NextResponse.json(
        { error: 'User input is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey || openaiApiKey === 'mock') {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Fetch project documentation context
    const workspaceRoot = process.cwd().replace('/autodev-ui', '');
    let projectContext = '';
    
    try {
      // Fetch documentation data
      const docResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/documentation`);
      if (docResponse.ok) {
        const docData = await docResponse.json();
        projectContext = `
Project Microservices: ${docData.microservices?.join(', ') || 'N/A'}

Available Documentation:
${docData.documentation?.slice(0, 5).map((doc: any) => `- ${doc.service}: ${doc.title}`).join('\n') || 'No documentation available'}
`;
      }
    } catch (error) {
      // Continue without context
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Create a comprehensive prompt for ticket generation
    const systemPrompt = `You are an expert software project manager and technical writer. Your task is to transform brief user descriptions of problems or enhancements into comprehensive, well-structured Jira tickets.

${projectContext}

When generating a ticket, you should:
1. Create a clear, concise summary (max 100 characters)
2. Write a detailed description with proper structure including:
   - Background/Context
   - Problem Statement or Enhancement Goal
   - Current Behavior (for bugs) or Current State (for enhancements)
   - Expected Behavior or Desired Outcome
   - Impact on users/system
3. Define specific, measurable acceptance criteria
4. Suggest appropriate issue type:
   - Use "Story" for most feature requests and enhancements
   - Use "Bug" for defects and issues
   - Use "Task" for technical work or chores
   - **IMPORTANT: NEVER use "Epic" for tickets with > 8 story points that will have subtasks**
   - Epics are for high-level initiatives without subtasks
   - If story points > 8, always use "Story" type so subtasks can be created
5. Recommend priority level:
   - DEFAULT to "Medium" for all tickets
   - ONLY use "High" or "Highest" if the user explicitly mentions: urgent, critical, high priority, ASAP, immediately, emergency, blocking, showstopper
   - Use "Low" or "Lowest" only if explicitly mentioned as low priority or nice-to-have
6. Identify related components or services
7. Include relevant technical notes, implementation hints, or references
8. Estimate story points (1, 2, 3, 5, 8, 13, 21) based on complexity
9. If story points > 8, break down into smaller subtasks with their own story points

Format your response as valid JSON with this exact structure:
{
  "summary": "Brief, action-oriented summary",
  "description": "Detailed multi-paragraph description with proper structure",
  "acceptanceCriteria": ["Criterion 1", "Criterion 2", ...],
  "suggestedType": "Story" | "Bug" | "Task" | "Epic",
  "suggestedPriority": "Highest" | "High" | "Medium" | "Low" | "Lowest",
  "relatedComponents": ["Component1", "Component2", ...],
  "technicalNotes": "Implementation guidance, architecture considerations, or technical references",
  "storyPoints": 1 | 2 | 3 | 5 | 8 | 13 | 21,
  "subtasks": [
    {
      "summary": "Subtask summary",
      "description": "Detailed subtask description",
      "storyPoints": 1 | 2 | 3 | 5 | 8
    }
  ]
}

Guidelines for quality:
- Use clear, professional language
- Be specific and avoid vague terms
- Include measurable outcomes in acceptance criteria
- Reference relevant technical details when applicable
- Consider edge cases and non-functional requirements
- Use Jira-compatible formatting (no markdown in description)
- Make it easily understandable for both technical and non-technical stakeholders
- Estimate story points based on: 1-2 (trivial), 3 (small), 5 (medium), 8 (large), 13+ (very large)
- **MANDATORY: For tickets > 8 story points, you MUST create 3-5 logical subtasks that sum to the total story points**
- Each subtask should be independently deliverable and testable
- The subtasks array must NOT be empty for tickets with > 8 story points`;

    const userPrompt = `User's brief description of the problem or enhancement:

"${userInput}"

Please generate a comprehensive Jira ticket based on this description. Ensure the ticket is well-structured, professional, and includes all necessary details for developers and stakeholders to understand and implement the solution.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const generatedTicket: GeneratedTicket = JSON.parse(responseContent);

    // Validate the response structure
    if (!generatedTicket.summary || !generatedTicket.description) {
      throw new Error('Invalid response structure from OpenAI');
    }

    // Validate subtasks for large tickets
    if (generatedTicket.storyPoints > 8) {
      if (!generatedTicket.subtasks || generatedTicket.subtasks.length === 0) {
        throw new Error(`Ticket has ${generatedTicket.storyPoints} story points but no subtasks were generated. Please try again or break down the requirement manually.`);
      }
    }

    return NextResponse.json(generatedTicket);

  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate ticket',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
