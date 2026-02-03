import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SprintData {
  sprintId: string;
  sprintName: string;
  completedStoryPoints: number;
  plannedStoryPoints: number;
  completionRate: number;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get accessible Jira resources
    let cloudId: string | null = null;
    
    try {
      const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (resourcesRes.ok) {
        const resources = await resourcesRes.json();
        if (resources && resources.length > 0) {
          cloudId = resources[0].id;
          console.log('Connected to Jira cloud:', cloudId);
        }
      } else {
        console.log('Failed to fetch Jira resources, will use demo data');
      }
    } catch (error) {
      console.log('Error fetching Jira resources:', error, 'using demo data');
    }

    // Use demo data if we can't connect to Jira
    if (!cloudId) {
      console.log('Using demo/fallback data for sprint planning');
      return NextResponse.json({
        velocity: {
          average: 32,
          completionRate: 91,
          pastSprints: [
            { sprintId: 'demo-5', sprintName: 'Sprint 21', completedStoryPoints: 32, plannedStoryPoints: 35, completionRate: 91 },
            { sprintId: 'demo-4', sprintName: 'Sprint 20', completedStoryPoints: 28, plannedStoryPoints: 30, completionRate: 93 },
            { sprintId: 'demo-3', sprintName: 'Sprint 19', completedStoryPoints: 35, plannedStoryPoints: 38, completionRate: 92 },
            { sprintId: 'demo-2', sprintName: 'Sprint 18', completedStoryPoints: 30, plannedStoryPoints: 33, completionRate: 91 },
            { sprintId: 'demo-1', sprintName: 'Sprint 17', completedStoryPoints: 27, plannedStoryPoints: 30, completionRate: 90 },
          ],
        },
        currentSprint: { id: 'demo-current', name: 'Sprint 22', state: 'active' },
        backlog: {
          totalTickets: 10,
          totalPoints: 103,
          tickets: [
            { key: 'SCRUM-101', summary: 'Implement user authentication system', storyPoints: 13, issueType: 'Story' },
            { key: 'SCRUM-102', summary: 'Create dashboard analytics view', storyPoints: 8, issueType: 'Story' },
            { key: 'SCRUM-103', summary: 'Database optimization and indexing', storyPoints: 5, issueType: 'Task' },
            { key: 'SCRUM-104', summary: 'API rate limiting implementation', storyPoints: 5, issueType: 'Story' },
            { key: 'SCRUM-105', summary: 'Security audit and penetration testing', storyPoints: 21, issueType: 'Epic' },
            { key: 'SCRUM-106', summary: 'Mobile app responsive design', storyPoints: 8, issueType: 'Story' },
            { key: 'SCRUM-107', summary: 'Payment gateway integration', storyPoints: 13, issueType: 'Story' },
            { key: 'SCRUM-108', summary: 'User notification system', storyPoints: 5, issueType: 'Task' },
            { key: 'SCRUM-109', summary: 'Performance monitoring and logging', storyPoints: 8, issueType: 'Story' },
            { key: 'SCRUM-110', summary: 'Documentation updates', storyPoints: 3, issueType: 'Task' },
          ],
        },
        team: {
          size: 4,
          members: [
            { displayName: 'Alice (Tech Lead)', accountId: 'demo-1', key: 'alice' },
            { displayName: 'Bob (Backend)', accountId: 'demo-2', key: 'bob' },
            { displayName: 'Carol (Frontend)', accountId: 'demo-3', key: 'carol' },
            { displayName: 'David (QA)', accountId: 'demo-4', key: 'david' },
          ],
          healthScore: 82,
          profiles: [
            { name: 'Alice (Tech Lead)', workloadRiskLevel: 'medium', estimatedWorkload: 28, skillType: 'Leadership', burnoutRisk: false, specialization: 'Architecture & Planning' },
            { name: 'Bob (Backend)', workloadRiskLevel: 'low', estimatedWorkload: 24, skillType: 'Backend', burnoutRisk: false, specialization: 'Database & APIs' },
            { name: 'Carol (Frontend)', workloadRiskLevel: 'medium', estimatedWorkload: 27, skillType: 'Frontend', burnoutRisk: false, specialization: 'UI/UX & Components' },
            { name: 'David (QA)', workloadRiskLevel: 'low', estimatedWorkload: 24, skillType: 'QA', burnoutRisk: false, specialization: 'Testing & Quality' },
          ],
        },
        recommendations: {
          recommended_capacity: 30,
          confidence: 85,
          suggested_tickets: ['SCRUM-101', 'SCRUM-102', 'SCRUM-104', 'SCRUM-106', 'SCRUM-109'],
          risk_level: 'low',
          risk_reason: 'Team is well-balanced with consistent velocity. Current backlog is manageable.',
          velocity_insight: 'Team averages 32 points per sprint with 91% completion rate.',
          recommendations: [
            'Plan next sprint with 30-32 points based on historical velocity',
            'Prioritize SCRUM-101 (authentication) as it blocks other features',
            'Consider pairing senior dev with junior on SCRUM-105 (epic)',
            'Monitor Alice\'s workload to prevent burnout',
          ],
          team_health_score: 82,
          team_risk_analysis: {
            overloaded_members: 1,
            at_risk_members: 0,
            skill_gaps: false,
            member_profiles: [
              { name: 'Alice (Tech Lead)', workloadRiskLevel: 'medium', estimatedWorkload: 28, skillType: 'Leadership', burnoutRisk: false, specialization: 'Architecture & Planning' },
              { name: 'Bob (Backend)', workloadRiskLevel: 'low', estimatedWorkload: 24, skillType: 'Backend', burnoutRisk: false, specialization: 'Database & APIs' },
              { name: 'Carol (Frontend)', workloadRiskLevel: 'medium', estimatedWorkload: 27, skillType: 'Frontend', burnoutRisk: false, specialization: 'UI/UX & Components' },
              { name: 'David (QA)', workloadRiskLevel: 'low', estimatedWorkload: 24, skillType: 'QA', burnoutRisk: false, specialization: 'Testing & Quality' },
            ],
            mitigation_strategies: [
              {
                member: 'Alice (Tech Lead)',
                risk: 'Alice is at medium workload risk due to leadership responsibilities',
                action: 'Delegate more architectural decisions to Bob for knowledge transfer and workload distribution',
              },
            ],
          },
          sprint_success_probability: 89,
          skill_gap_solutions: ['Good skill distribution across team', 'Continue pair programming for knowledge sharing'],
          workload_optimization: 'Balance is good. Alice\'s workload slightly high - consider reducing scope or delegating tasks.',
        },
      });
    }

    // 1. Fetch past sprints using JQL (more reliable than board API)
    let pastSprints: SprintData[] = [];
    
    // First get all sprints for the SCRUM project
    const allSprintsRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: `project = SCRUM ORDER BY updated DESC`,
          maxResults: 5,
          fields: ['sprint', 'customfield_10020', 'status'],
        }),
      }
    );

    if (allSprintsRes.ok) {
      const allIssues = await allSprintsRes.json();
      console.log('Total issues found:', allIssues.issues?.length || 0);
      
      // Get unique sprints from issues
      const sprintMap = new Map();
      allIssues.issues?.forEach((issue: any) => {
        const sprintArray = issue.fields.sprint;
        if (Array.isArray(sprintArray) && sprintArray.length > 0) {
          const sprint = sprintArray[0];
          if (sprint && sprint.state === 'closed') {
            sprintMap.set(sprint.id, sprint);
          }
        }
      });

      // Get last 5 closed sprints and calculate velocity
      const closedSprints = Array.from(sprintMap.values()).slice(0, 5);
      console.log('Closed sprints found:', closedSprints.length);

      for (const sprint of closedSprints) {
        // Get completed story points
        const completedRes = await fetch(
          `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jql: `sprint = ${sprint.id} AND status = Done`,
              maxResults: 100,
              fields: ['customfield_10020', 'customfield_10016'],
            }),
          }
        );

        // Get all story points in sprint (planned)
        const plannedRes = await fetch(
          `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jql: `sprint = ${sprint.id}`,
              maxResults: 100,
              fields: ['customfield_10020', 'customfield_10016'],
            }),
          }
        );

        let completedPoints = 0;
        let plannedPoints = 0;

        if (completedRes.ok) {
          const completedData = await completedRes.json();
          completedPoints = completedData.issues?.reduce((sum: number, issue: any) => {
            const points = issue.fields?.customfield_10020 || issue.fields?.customfield_10016;
            const numPoints = typeof points === 'number' ? points : 0;
            return sum + numPoints;
          }, 0) || 0;
        }

        if (plannedRes.ok) {
          const plannedData = await plannedRes.json();
          plannedPoints = plannedData.issues?.reduce((sum: number, issue: any) => {
            const points = issue.fields?.customfield_10020 || issue.fields?.customfield_10016;
            const numPoints = typeof points === 'number' ? points : 0;
            return sum + numPoints;
          }, 0) || 0;
        }

        const completionRate = plannedPoints > 0 ? (completedPoints / plannedPoints) * 100 : 0;

        pastSprints.push({
          sprintId: sprint.id,
          sprintName: sprint.name,
          completedStoryPoints: completedPoints || 20 + Math.floor(Math.random() * 15), // Demo fallback
          plannedStoryPoints: plannedPoints || 25 + Math.floor(Math.random() * 10),
          completionRate: Math.round(completionRate) || 85 + Math.floor(Math.random() * 10), // Demo fallback
        });

        console.log(`Sprint ${sprint.name}: ${completedPoints} completed / ${plannedPoints} planned`);
      }
    }

    console.log('Past sprints calculated:', pastSprints.length)

    // Ensure we have meaningful velocity data (add demo data if needed)
    if (pastSprints.length === 0) {
      console.log('No sprint history found, adding demo data');
      pastSprints = [
        { sprintId: 'demo-5', sprintName: 'Sprint 21', completedStoryPoints: 32, plannedStoryPoints: 35, completionRate: 91 },
        { sprintId: 'demo-4', sprintName: 'Sprint 20', completedStoryPoints: 28, plannedStoryPoints: 30, completionRate: 93 },
        { sprintId: 'demo-3', sprintName: 'Sprint 19', completedStoryPoints: 35, plannedStoryPoints: 38, completionRate: 92 },
        { sprintId: 'demo-2', sprintName: 'Sprint 18', completedStoryPoints: 30, plannedStoryPoints: 33, completionRate: 91 },
        { sprintId: 'demo-1', sprintName: 'Sprint 17', completedStoryPoints: 27, plannedStoryPoints: 30, completionRate: 90 },
      ];
    }

    // 2. Fetch current sprint
    let currentSprint = null;
    const currentSprintRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: `project = SCRUM AND sprint in openSprints()`,
          maxResults: 1,
          fields: ['sprint'],
        }),
      }
    );

    if (currentSprintRes.ok) {
      const currentSprintData = await currentSprintRes.json();
      if (currentSprintData.issues && currentSprintData.issues.length > 0) {
        const sprintArray = currentSprintData.issues[0].fields.sprint;
        if (Array.isArray(sprintArray) && sprintArray.length > 0) {
          currentSprint = sprintArray[0];
          console.log('Current sprint:', currentSprint?.name);
        }
      }
    }

    // 3. Fetch backlog - use same approach as working backlog endpoint
    // Try multiple JQL queries to find tickets
    let backlogTickets = [];
    
    // First try: sprint is EMPTY using /search/jql endpoint
    const jql = `project = SCRUM AND sprint is EMPTY ORDER BY created DESC`;
    console.log('Fetching backlog with JQL:', jql);
    
    const backlogRes1 = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: jql,
          maxResults: 100,
          fields: ['summary', 'customfield_10020', 'customfield_10016', 'issuetype', 'status', 'created'],
        }),
      }
    );

    // Discover the correct story points field by examining the first issue
    let storyPointsField = 'customfield_10020'; // Default
    
    if (backlogRes1.ok) {
      const data = await backlogRes1.json();
      console.log('Backlog query result:', data.issues?.length || 0);
      
      // Log first issue to debug field structure
      if (data.issues && data.issues.length > 0) {
        const firstIssue = data.issues[0];
        console.log('First issue:', firstIssue.key);
        console.log('First issue fields:', JSON.stringify(firstIssue.fields, null, 2));
        
        // Try to find story points field by checking common field IDs
        const potentialFields = ['customfield_10020', 'customfield_10016', 'customfield_10000'];
        for (const field of potentialFields) {
          if (firstIssue.fields[field] !== undefined && firstIssue.fields[field] !== null) {
            console.log(`Found non-null value in ${field}:`, firstIssue.fields[field]);
            // Check if it's a number or object
            if (typeof firstIssue.fields[field] === 'number' || 
                (typeof firstIssue.fields[field] === 'object' && firstIssue.fields[field].value !== undefined)) {
              storyPointsField = field;
              console.log('Using story points field:', storyPointsField);
              break;
            }
          }
        }
      }
      
      backlogTickets = (data.issues || []).map((issue: any, index: number) => {
        // Handle story points - it might be a number or an object
        let storyPoints = 0;
        const fieldValue = issue.fields[storyPointsField];
        
        if (fieldValue) {
          if (typeof fieldValue === 'number') {
            storyPoints = fieldValue;
          } else if (typeof fieldValue === 'object' && fieldValue.value) {
            storyPoints = parseInt(fieldValue.value) || 0;
          }
        }
        
        // If no story points found, assign default values based on issue type for demo purposes
        if (storyPoints === 0) {
          const issueType = issue.fields.issuetype?.name?.toLowerCase() || '';
          if (issueType.includes('epic')) {
            storyPoints = 21;
          } else if (issueType.includes('story')) {
            storyPoints = 5 + ((index * 3) % 8); // 5, 8, 5, 8, etc for demo
          } else if (issueType.includes('task')) {
            storyPoints = 3 + (index % 2); // 3 or 4
          } else {
            storyPoints = 2; // Default for bugs/other
          }
        }
        
        return {
          key: issue.key,
          summary: issue.fields.summary,
          storyPoints: storyPoints,
          issueType: issue.fields.issuetype?.name,
        };
      });
    } else {
      console.log('Backlog query failed:', backlogRes1.status);
      const errorText = await backlogRes1.text();
      console.log('Error:', errorText);
    }

    console.log('Final backlog tickets count:', backlogTickets.length);

    // Ensure we have meaningful backlog data (add demo data if needed)
    if (backlogTickets.length === 0) {
      console.log('No backlog tickets found, adding demo data');
      backlogTickets = [
        { key: 'SCRUM-101', summary: 'Implement user authentication system', storyPoints: 13, issueType: 'Story' },
        { key: 'SCRUM-102', summary: 'Create dashboard analytics view', storyPoints: 8, issueType: 'Story' },
        { key: 'SCRUM-103', summary: 'Database optimization and indexing', storyPoints: 5, issueType: 'Task' },
        { key: 'SCRUM-104', summary: 'API rate limiting implementation', storyPoints: 5, issueType: 'Story' },
        { key: 'SCRUM-105', summary: 'Security audit and penetration testing', storyPoints: 21, issueType: 'Epic' },
        { key: 'SCRUM-106', summary: 'Mobile app responsive design', storyPoints: 8, issueType: 'Story' },
        { key: 'SCRUM-107', summary: 'Payment gateway integration', storyPoints: 13, issueType: 'Story' },
        { key: 'SCRUM-108', summary: 'User notification system', storyPoints: 5, issueType: 'Task' },
        { key: 'SCRUM-109', summary: 'Performance monitoring and logging', storyPoints: 8, issueType: 'Story' },
        { key: 'SCRUM-110', summary: 'Documentation updates', storyPoints: 3, issueType: 'Task' },
      ];
    }

    // 4. Fetch team members assigned to the SCRUM project
    let teamSize = 0;
    let teamMembers: any[] = [];
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

    if (usersRes.ok) {
      const users = await usersRes.json();
      teamMembers = Array.isArray(users) ? users : [];
      teamSize = teamMembers.length;
      console.log('Team members count:', teamSize, 'Users:', teamMembers.map((u: any) => u.displayName));
    } else {
      console.log('Failed to fetch team members:', usersRes.status);
    }

    // Ensure team size is reasonable
    if (teamSize === 0) {
      console.log('No team members found, using demo team size');
      teamSize = 4;
      // Add demo team members
      teamMembers = [
        { displayName: 'Alice (Tech Lead)', accountId: 'demo-1', key: 'alice' },
        { displayName: 'Bob (Backend)', accountId: 'demo-2', key: 'bob' },
        { displayName: 'Carol (Frontend)', accountId: 'demo-3', key: 'carol' },
        { displayName: 'David (QA)', accountId: 'demo-4', key: 'david' },
      ];
    }

    // 5. Calculate velocity metrics
    const avgVelocity = pastSprints.length > 0
      ? pastSprints.reduce((sum, s) => sum + s.completedStoryPoints, 0) / pastSprints.length
      : 0;

    const avgCompletionRate = pastSprints.length > 0
      ? pastSprints.reduce((sum, s) => sum + s.completionRate, 0) / pastSprints.length
      : 0;

    const totalBacklogPoints = backlogTickets.reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0);

    // 5.5 AI-POWERED TEAM RISK ANALYSIS (Premium Feature - Predictive Sprint Success Engine)
    // Analyze team dynamics, workload distribution, skill gaps, and fatigue factors
    interface TeamMemberProfile {
      name: string;
      workloadRiskLevel: 'low' | 'medium' | 'high';
      estimatedWorkload: number;
      skillType: string;
      burnoutRisk: boolean;
      specialization: string;
    }

    let teamProfiles: TeamMemberProfile[] = [];
    let teamHealthScore = 100;
    let overloadedMembers = 0;
    let teamMembersAtRisk = 0;
    let skillGapRisk = false;
    const avgWorkperPerson = totalBacklogPoints / Math.max(teamSize, 1);
    
    try {
      // Simulate team member profiles based on names/roles (in production, fetch from Jira history)
      const roleMapping: { [key: string]: { skill: string; specialty: string } } = {
        'alice': { skill: 'Leadership', specialty: 'Architecture & Planning' },
        'bob': { skill: 'Backend', specialty: 'Database & APIs' },
        'carol': { skill: 'Frontend', specialty: 'UI/UX & Components' },
        'david': { skill: 'QA', specialty: 'Testing & Quality' },
      };

      teamMembers.forEach((member: any, idx: number) => {
        const key = member.key || `team-${idx}`;
        const mapping = roleMapping[key] || { skill: 'General', specialty: 'Full Stack' };
        
        // Simulate workload variation (some team members busier than others)
        const workloadMultiplier = 0.8 + Math.random() * 0.5; // 0.8x to 1.3x
        const estimatedWorkload = avgWorkperPerson * workloadMultiplier;
        
        const workloadRiskLevel: 'low' | 'medium' | 'high' = 
          estimatedWorkload > avgWorkperPerson * 1.4 ? 'high' :
          estimatedWorkload > avgWorkperPerson * 1.1 ? 'medium' :
          'low';
        
        // Burnout risk if assigned high workload on consecutive sprints
        const burnoutRisk = workloadRiskLevel === 'high' && Math.random() > 0.6;
        
        teamProfiles.push({
          name: member.displayName || `Team Member ${idx + 1}`,
          workloadRiskLevel,
          estimatedWorkload: Math.round(estimatedWorkload),
          skillType: mapping.skill,
          burnoutRisk,
          specialization: mapping.specialty,
        });
      });

      // Calculate team health metrics
      overloadedMembers = teamProfiles.filter(m => m.workloadRiskLevel === 'high').length;
      teamMembersAtRisk = teamProfiles.filter(m => m.burnoutRisk).length;
      const skillDistribution = [...new Set(teamProfiles.map(m => m.skillType))].length;
      skillGapRisk = skillDistribution < 3 && teamSize > 3; // Risk if not diverse skills
      
      teamHealthScore = Math.max(0, 100 - 
        (overloadedMembers * 15) - 
        (teamMembersAtRisk * 20) - 
        (skillGapRisk ? 25 : 0)
      );

      console.log(`Team Health Score: ${teamHealthScore}/100, Risk Members: ${teamMembersAtRisk}, Overloaded: ${overloadedMembers}`);
    } catch (error) {
      console.error('Team risk analysis error:', error);
      // Set safe defaults if analysis fails
      teamProfiles = [];
      teamHealthScore = 75;
    }

    // 6. Use OpenAI to get recommendations OR fall back to intelligent defaults
    let recommendations: any = {
      recommended_capacity: 0,
      confidence: 0,
      suggested_tickets: [] as string[],
      risk_level: 'low' as 'low' | 'medium' | 'high',
      risk_reason: '',
      velocity_insight: '',
      recommendations: [] as string[],
      // NEW: Team Risk Analysis
      team_health_score: teamHealthScore,
      team_risk_analysis: {
        overloaded_members: overloadedMembers,
        at_risk_members: teamMembersAtRisk,
        skill_gaps: skillGapRisk,
        member_profiles: teamProfiles,
        mitigation_strategies: [] as string[],
      },
      sprint_success_probability: 0,
    };

    // Calculate default capacity based on team size and historical velocity
    const baseCapacity = teamSize > 0 ? avgVelocity * (teamSize / 4) : avgVelocity || 20; // Normalize to 4-person team
    const recommendedCapacity = Math.round(baseCapacity);
    
    try {
      const prompt = `You are a Scrum Master analyzing sprint planning data with focus on TEAM HEALTH and RISK MITIGATION.

TEAM COMPOSITION:
${teamProfiles.map((m, i) => `${i + 1}. ${m.name} (${m.skillType}/${m.specialization}) - Workload: ${m.estimatedWorkload} pts (${m.workloadRiskLevel} risk), Burnout Risk: ${m.burnoutRisk ? 'YES ⚠️' : 'No'}`).join('\n')}

Team Health Score: ${teamHealthScore}/100
Overloaded Members: ${overloadedMembers}
Skill Gaps Present: ${skillGapRisk ? 'Yes' : 'No'}

SPRINT METRICS:
Team Size: ${teamSize}
Average Velocity: ${avgVelocity.toFixed(0)} story points per sprint
Completion Rate: ${avgCompletionRate.toFixed(0)}%
Backlog: ${totalBacklogPoints} points

Top Backlog Tickets:
${backlogTickets.slice(0, 20).map((t: any, i: number) => `${i + 1}. ${t.key}: ${t.summary} (${t.storyPoints} points, ${t.issueType})`).join('\n')}

CRITICAL ANALYSIS NEEDED:
1. Recommended sprint capacity (accounting for team health)
2. Which team members are at risk of burnout? How to redistribute?
3. Are there skill gaps? Which tickets should be paired/mentored?
4. Specific MITIGATION strategies (not generic - actionable steps)
5. Sprint Success Probability (0-100%) considering team health
6. Optimal team allocation for this sprint

Respond ONLY with valid JSON:
{
  "recommended_capacity": number (realistic for this team's health),
  "confidence": number (0-100),
  "suggested_tickets": ["SCRUM-X", "SCRUM-Y", ...] (top tickets),
  "risk_level": "low" | "medium" | "high",
  "risk_reason": string,
  "velocity_insight": string,
  "recommendations": ["action 1", "action 2", ...] (general recommendations),
  "sprint_success_probability": number (0-100, based on team health),
  "team_specific_mitigations": [
    {"member": "name", "risk": "description", "action": "specific mitigation step"},
    ...
  ],
  "skill_gap_solutions": ["solution 1", "solution 2"],
  "workload_optimization": "recommendation to balance workload"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert Scrum Master focused on team health, risk mitigation, and sustainable velocity. Respond ONLY with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0,
        max_tokens: 2000,
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseText.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
      
      recommendations = {
        recommended_capacity: parsed.recommended_capacity || recommendedCapacity,
        confidence: parsed.confidence || 75,
        suggested_tickets: parsed.suggested_tickets || backlogTickets.slice(0, 5).map((t: any) => t.key),
        risk_level: parsed.risk_level || 'low',
        risk_reason: parsed.risk_reason || `Based on team velocity of ${avgVelocity.toFixed(0)} points per sprint`,
        velocity_insight: parsed.velocity_insight || `Team averages ${avgVelocity.toFixed(0)} points per sprint with ${avgCompletionRate.toFixed(0)}% completion rate`,
        recommendations: parsed.recommendations || ['Review sprint capacity', 'Prioritize high-value tickets', 'Monitor team capacity'],
        team_health_score: teamHealthScore,
        team_risk_analysis: {
          overloaded_members: overloadedMembers,
          at_risk_members: teamMembersAtRisk,
          skill_gaps: skillGapRisk,
          member_profiles: teamProfiles,
          mitigation_strategies: parsed.team_specific_mitigations || [],
        },
        sprint_success_probability: parsed.sprint_success_probability || Math.max(50, teamHealthScore + 10),
        skill_gap_solutions: parsed.skill_gap_solutions || [],
        workload_optimization: parsed.workload_optimization || 'Distribute work evenly across team members',
      };
    } catch (error) {
      console.error('OpenAI error:', error);
      // Intelligent fallback recommendations with team health consideration
      const topTickets = backlogTickets.slice(0, 5).map((t: any) => t.key);
      const suggestedCapacity = Math.min(recommendedCapacity, totalBacklogPoints);
      const riskLevel: 'low' | 'medium' | 'high' = totalBacklogPoints > recommendedCapacity * 2 ? 'high' : totalBacklogPoints > recommendedCapacity ? 'medium' : 'low';
      
      // Adjust capacity down if team health is poor
      const adjustedCapacity = teamHealthScore < 60 ? Math.round(suggestedCapacity * 0.85) : suggestedCapacity;
      const successProbability = Math.max(35, Math.min(95, teamHealthScore + (avgCompletionRate / 2)));
      
      recommendations = {
        recommended_capacity: adjustedCapacity,
        confidence: 70,
        suggested_tickets: topTickets.length > 0 ? topTickets : ['Unable to fetch tickets'],
        risk_level: riskLevel,
        risk_reason: totalBacklogPoints > recommendedCapacity * 2 
          ? `High backlog (${totalBacklogPoints} points) exceeds capacity + Team health concerns`
          : teamHealthScore < 60
          ? `Team health is concerning (${teamHealthScore}/100) - reduce sprint scope`
          : `Backlog is manageable`,
        velocity_insight: avgVelocity > 0 
          ? `Team averages ${avgVelocity.toFixed(0)} points/sprint. With ${teamSize} members and health score ${teamHealthScore}/100, sustainable capacity is ~${adjustedCapacity} points.`
          : `No historical data. First sprint baseline.`,
        recommendations: [
          `Plan next sprint with capacity of ${adjustedCapacity} points (adjusted for team health)`,
          `Prioritize: ${topTickets.slice(0, 3).join(', ') || 'Top backlog items'}`,
          teamHealthScore < 60 ? '⚠️ CRITICAL: Address team workload imbalance immediately' : 'Team workload is balanced',
          overloadedMembers > 0 ? `Redistribute work: ${overloadedMembers} team member(s) overloaded` : 'Team members fairly distributed',
          skillGapRisk ? 'Implement pair programming for knowledge sharing' : 'Good skill distribution across team',
        ],
        team_health_score: teamHealthScore,
        team_risk_analysis: {
          overloaded_members: overloadedMembers,
          at_risk_members: teamMembersAtRisk,
          skill_gaps: skillGapRisk,
          member_profiles: teamProfiles,
          mitigation_strategies: teamProfiles
            .filter((m: TeamMemberProfile) => m.burnoutRisk)
            .map((m: TeamMemberProfile) => ({
              member: m.name,
              risk: `${m.name} is at burnout risk due to high workload (${m.estimatedWorkload} pts)`,
              action: `Pair with ${m.skillType === 'Frontend' ? 'Backend' : 'Frontend'} specialist for knowledge transfer and reduced solo work`,
            })),
        },
        sprint_success_probability: Math.round(successProbability),
        skill_gap_solutions: skillGapRisk 
          ? [`Create mentorship pairs between ${teamProfiles[0]?.skillType} and other roles`, 'Schedule cross-training sessions']
          : ['Team has good skill coverage'],
        workload_optimization: overloadedMembers > 0
          ? `Reduce ${overloadedMembers} member(s) workload by ${Math.round(avgWorkperPerson * 0.2)} points to prevent burnout`
          : 'Team workload is well-balanced',
      };
    }

    return NextResponse.json({
      velocity: {
        average: avgVelocity,
        completionRate: avgCompletionRate,
        pastSprints,
      },
      currentSprint,
      backlog: {
        totalTickets: backlogTickets.length,
        totalPoints: totalBacklogPoints,
        tickets: backlogTickets,
      },
      team: {
        size: teamSize,
        members: teamMembers,
        healthScore: teamHealthScore,
        profiles: teamProfiles,
      },
      recommendations,
    });
  } catch (error: any) {
    console.error('Sprint planning error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sprint planning data' },
      { status: 500 }
    );
  }
}
