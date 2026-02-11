'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChartBarIcon, SparklesIcon, ExclamationCircleIcon, CheckCircleIcon, DocumentChartBarIcon } from '@heroicons/react/24/outline';

interface VelocityData {
  average: number;
  completionRate: number;
  pastSprints: Array<{
    sprintId: string;
    sprintName: string;
    completedStoryPoints: number;
    plannedStoryPoints: number;
    completionRate: number;
  }>;
}

interface BacklogData {
  totalTickets: number;
  totalPoints: number;
  tickets: Array<{
    key: string;
    summary: string;
    storyPoints: number;
    issueType: string;
  }>;
}

interface RecommendationsData {
  recommended_capacity: number;
  confidence: number;
  suggested_tickets: string[];
  risk_level: 'low' | 'medium' | 'high';
  risk_reason: string;
  velocity_insight: string;
  recommendations: string[];
  // NEW: Team Risk Analysis
  team_health_score?: number;
  team_risk_analysis?: {
    overloaded_members: number;
    at_risk_members: number;
    skill_gaps: boolean;
    member_profiles: Array<{
      name: string;
      workloadRiskLevel: 'low' | 'medium' | 'high';
      estimatedWorkload: number;
      skillType: string;
      burnoutRisk: boolean;
      specialization: string;
    }>;
    mitigation_strategies: Array<{
      member: string;
      risk: string;
      action: string;
    }>;
  };
  sprint_success_probability?: number;
  skill_gap_solutions?: string[];
  workload_optimization?: string;
}

interface SprintPlanningData {
  velocity: VelocityData;
  currentSprint: any;
  backlog: BacklogData;
  team: { 
    size: number;
    healthScore?: number;
    profiles?: any[];
    members?: any[];
  };
  recommendations: RecommendationsData;
}

export default function SprintPlanning() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<SprintPlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState('');
  const [reportDate, setReportDate] = useState<string>('');
  const [minDate, setMinDate] = useState<string>('');
  const [maxDate, setMaxDate] = useState<string>('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState<{ type: 'success' | 'error'; message: string; url?: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSprintData();
    }
  }, [status]);

  const fetchSprintData = async () => {
    try {
      const response = await fetch('/api/jira/sprint-planning');
      const result = await response.json();
      setData(result);
      setSelectedTickets(result.recommendations?.suggested_tickets || []);

      const today = new Date().toISOString().split('T')[0];

      // Set date constraints based on sprint dates
      if (result.currentSprint?.startDate && result.currentSprint?.endDate) {
        const startDate = new Date(result.currentSprint.startDate).toISOString().split('T')[0];
        const endDate = new Date(result.currentSprint.endDate).toISOString().split('T')[0];

        // Allow selecting any date within the sprint period for testing
        setMinDate(startDate);
        setMaxDate(endDate);
        setReportDate(today >= startDate && today <= endDate ? today : startDate);
      } else {
        // No active sprint - disable date picker by setting invalid range
        setMinDate('');
        setMaxDate('');
        setReportDate('');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching sprint data:', error);
      setLoading(false);
    }
  };

  const generateSprintReport = async () => {
    if (!reportDate) {
      setReportMessage({ type: 'error', message: 'Please select a date' });
      return;
    }

    setGeneratingReport(true);
    setReportMessage(null);

    try {
      const response = await fetch('/api/jira/generate-sprint-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toDate: reportDate,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setReportMessage({
          type: 'success',
          message: 'Report generated successfully!',
          url: result.confluence_url,
        });
      } else {
        setReportMessage({
          type: 'error',
          message: result.error || 'Failed to generate report',
        });
      }
    } catch (error) {
      setReportMessage({
        type: 'error',
        message: 'Error generating report: ' + (error as Error).message,
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Please log in to access sprint planning</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded"></div>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600">Error loading sprint planning data</p>
      </div>
    );
  }

  // Ensure data structure is safe
  const backlogTickets = data?.backlog?.tickets || [];
  const velocityData = data?.velocity || { average: 0, completionRate: 0, pastSprints: [] };
  const teamData = data?.team || { size: 0, healthScore: 0, profiles: [], members: [] };

  const totalSelectedPoints = backlogTickets
    .filter(t => selectedTickets.includes(t.key))
    .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  const predictedDaysToComplete = velocityData.average > 0
    ? Math.ceil(totalSelectedPoints / (velocityData.average / 14))
    : 0;

  return (
    <div className="min-h-screen bg-black px-6 md:px-10 lg:px-16 xl:px-24 py-6 md:py-8 lg:py-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="rounded-2xl px-7 py-7 text-white shadow-xl mb-8 border border-green-500/20" style={{background: 'linear-gradient(135deg, #1a1a1a 0%, #2d4a2e 50%, #1a1a1a 100%)'}}>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 leading-tight flex items-center gap-3">
            <SparklesIcon className="h-10 w-10" style={{color: '#b9ff66'}} />
            <span style={{color: '#b9ff66'}}>Sprint Planning</span> Assistant
          </h1>
          <p className="text-sm md:text-base lg:text-lg text-gray-300 leading-relaxed max-w-4xl">
            AI-powered sprint composition and capacity analysis
          </p>
        </div>

        {/* Sprint Progress Report Generator */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 border-l-4 border-primary">
          {!data?.currentSprint ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-4">
              <p className="text-sm font-medium">⚠️ No active sprint found</p>
              <p className="text-xs mt-1">Create or activate a sprint in JIRA to generate progress reports</p>
            </div>
          ) : null}
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Generate Sprint Progress Report
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Create a comprehensive progress report from sprint start to a specific date
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  min={minDate}
                  max={maxDate}
                  disabled={!data?.currentSprint}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 font-medium disabled:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-500"
                  style={{ colorScheme: 'light' }}
                />
                <button
                  onClick={generateSprintReport}
                  disabled={generatingReport}
                  className="px-6 py-2 bg-primary text-dark font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <DocumentChartBarIcon className="h-5 w-5" />
                  {generatingReport ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>
          </div>

          {/* Report Status Message */}
          {reportMessage && (
            <div className={`mt-4 p-4 rounded-lg ${
              reportMessage.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <p className="text-sm font-medium">
                {reportMessage.type === 'success' ? '✅' : '❌'} {reportMessage.message}
              </p>
              {reportMessage.type === 'success' && reportMessage.url && (
                <a
                  href={reportMessage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold underline mt-2 inline-block hover:opacity-80"
                >
                  View Report in Confluence →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-primary hover:shadow-md transition">
            <p className="text-sm text-gray font-medium">Avg Team Velocity</p>
            <p className="text-3xl font-bold mt-2" style={{color: '#92c951'}}>
              {velocityData.average.toFixed(0)}
            </p>
            <p className="text-xs text-gray mt-1">story points/sprint</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-primary hover:shadow-md transition">
            <p className="text-sm text-gray font-medium">Completion Rate</p>
            <p className="text-3xl font-bold mt-2" style={{color: '#92c951'}}>
              {velocityData.completionRate.toFixed(0)}%
            </p>
            <p className="text-xs text-gray mt-1">average completion</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-primary hover:shadow-md transition">
            <p className="text-sm text-gray font-medium">Team Size</p>
            <p className="text-3xl font-bold mt-2" style={{color: '#92c951'}}>{teamData.size}</p>
            <p className="text-xs text-gray mt-1">members</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-primary hover:shadow-md transition">
            <p className="text-sm text-gray font-medium">Backlog</p>
            <p className="text-3xl font-bold mt-2" style={{color: '#92c951'}}>{data?.backlog?.totalPoints || 0}</p>
            <p className="text-xs text-gray mt-1">total points</p>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className={`rounded-lg shadow p-6 mb-8 border-l-4 ${
          data?.recommendations?.risk_level === 'low' ? 'bg-white' :
          data?.recommendations?.risk_level === 'medium' ? 'bg-white border-yellow-500' :
          'bg-white border-red-500'
        }`} style={data?.recommendations?.risk_level === 'low' ? {borderLeftColor: '#92c951'} : {}}>
          <div className="flex items-start gap-4">
            {data?.recommendations?.risk_level === 'low' && (
              <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
            )}
            {data?.recommendations?.risk_level !== 'low' && (
              <ExclamationCircleIcon className={`h-6 w-6 flex-shrink-0 mt-1 ${
                data?.recommendations?.risk_level === 'medium' ? 'text-yellow-600' : 'text-red-600'
              }`} />
            )}
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">
                Risk Level: {data?.recommendations?.risk_level?.toUpperCase() || 'UNKNOWN'}
              </h3>
              <p className="text-gray mt-1">{data?.recommendations?.risk_reason || 'Unable to assess risk'}</p>
              <p className="text-sm text-gray mt-2 italic">{data?.recommendations?.velocity_insight || ''}</p>
            </div>
          </div>
        </div>

        {/* NEW: AI-Powered Team Risk Analysis (Predictive Sprint Success Engine) */}
        {data?.recommendations?.team_health_score !== undefined && (
          <div className="mb-10">
            <div className="bg-dark rounded-lg shadow-lg p-8 text-white mb-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-2 flex items-center gap-2">
                    Predictive Sprint Success Engine
                  </h2>
                  <p className="text-gray-300">AI-Powered Team Health & Risk Analysis</p>
                </div>
                <div className="text-right">
                  <p className="text-5xl font-bold text-primary">{data.recommendations?.sprint_success_probability || 85}%</p>
                  <p className="text-xs text-gray-300">Success Probability</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/10 rounded p-4 border border-white/20">
                  <p className="text-xs text-gray-300 uppercase">Team Health Score</p>
                  <p className="text-3xl font-bold text-primary mt-2">{data.recommendations?.team_health_score || 75}/100</p>
                </div>
                <div className="bg-white/10 rounded p-4 border border-white/20">
                  <p className="text-xs text-gray-300 uppercase">Overloaded Members</p>
                  <p className="text-3xl font-bold text-yellow-400 mt-2">{data.recommendations?.team_risk_analysis?.overloaded_members || 0}</p>
                </div>
                <div className="bg-white/10 rounded p-4 border border-white/20">
                  <p className="text-xs text-gray-300 uppercase">At-Risk for Burnout</p>
                  <p className="text-3xl font-bold text-red-400 mt-2">{data.recommendations?.team_risk_analysis?.at_risk_members || 0}</p>
                </div>
                <div className="bg-white/10 rounded p-4 border border-white/20">
                  <p className="text-xs text-gray-300 uppercase">Skill Gap Risk</p>
                  <p className="text-xl font-bold text-primary mt-2">{data.recommendations?.team_risk_analysis?.skill_gaps ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {/* Mitigation Strategies */}
              {data?.recommendations?.team_risk_analysis?.mitigation_strategies && data?.recommendations?.team_risk_analysis?.mitigation_strategies.length > 0 && (
                <div className="bg-white/5 rounded p-4 border border-orange-500/30 mb-4">
                  <h3 className="text-sm font-bold text-orange-300 mb-3 uppercase">Critical Mitigation Strategies</h3>
                  <div className="space-y-2">
                    {data?.recommendations?.team_risk_analysis?.mitigation_strategies.map((strategy, i) => (
                      <div key={i} className="text-sm border-l-2 border-orange-400 pl-3">
                        <p className="font-semibold text-white">{strategy.member}</p>
                        <p className="text-gray-300 text-xs">{strategy.risk}</p>
                        <p className="text-orange-300 text-xs mt-1">→ {strategy.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workload Optimization */}
              {data?.recommendations?.workload_optimization && (
                <div className="text-sm text-gray-200 bg-white/5 p-3 rounded border border-white/10">
                  <span className="font-semibold">Workload Optimization:</span> {data?.recommendations?.workload_optimization}
                </div>
              )}
            </div>

            {/* Team Member Profiles */}
            {data?.recommendations?.team_risk_analysis?.member_profiles && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Team Member Risk Assessment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {data?.recommendations?.team_risk_analysis?.member_profiles.map((member, i) => (
                    <div key={i} className={`rounded p-4 border-l-4 ${
                      member.burnoutRisk ? 'bg-red-50 border-red-500' :
                      member.workloadRiskLevel === 'high' ? 'bg-yellow-50 border-yellow-500' :
                      member.workloadRiskLevel === 'medium' ? 'bg-blue-50 border-blue-500' :
                      'bg-green-50 border-green-500'
                    }`}>
                      <p className="font-semibold text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{member.specialization}</p>
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <p className="text-xs text-gray-700"><span className="font-semibold">Workload:</span> {member.estimatedWorkload} pts</p>
                        <p className="text-xs text-gray-700 mt-1"><span className="font-semibold">Risk:</span> <span className={`${
                          member.workloadRiskLevel === 'high' ? 'text-red-600' :
                          member.workloadRiskLevel === 'medium' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>{member.workloadRiskLevel.toUpperCase()}</span></p>
                        {member.burnoutRisk && <p className="text-xs text-red-600 font-semibold mt-1">Burnout Risk</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skill Gap Solutions */}
            {data?.recommendations?.skill_gap_solutions && data?.recommendations?.skill_gap_solutions.length > 0 && (
              <div className="bg-indigo-50 rounded-lg shadow p-6 border-l-4 border-indigo-500">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Skill Gap Solutions</h3>
                <ul className="space-y-2">
                  {data?.recommendations?.skill_gap_solutions.map((solution, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-indigo-600 font-bold">•</span>
                      {solution}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* AI Recommendations */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-dark rounded-lg shadow p-6 text-white border-l-4 border-primary">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2 mb-4">
                <SparklesIcon className="h-5 w-5" />
                AI Recommendations
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-300 uppercase tracking-wide">Recommended Capacity</p>
                  <p className="text-2xl font-bold text-primary mt-2">{data?.recommendations?.recommended_capacity || 0} points</p>
                  <p className="text-xs text-gray-300 mt-2">Confidence: {data?.recommendations?.confidence || 0}%</p>
                </div>

                <div className="border-t border-gray-600 pt-3">
                  <p className="text-sm font-semibold text-white mb-2">Suggested Actions:</p>
                  <ul className="space-y-1">
                    {data?.recommendations?.recommendations?.map((rec: string, i: number) => (
                      <li key={i} className="text-sm text-gray-300 flex gap-2">
                        <span className="text-primary font-bold">✓</span>
                        {rec}
                      </li>
                    )) || <li className="text-sm text-gray-300">No recommendations available</li>}
                  </ul>
                </div>
              </div>
            </div>

            {/* Sprint Summary */}
            <div className="bg-dark rounded-lg shadow p-6 text-white border-l-4 border-primary">
              <h2 className="text-lg font-bold text-primary mb-4">Selected Sprint</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-300 uppercase tracking-wide">Selected Points</p>
                  <p className="text-2xl font-bold text-primary mt-2">{totalSelectedPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-300 uppercase tracking-wide">Predicted Duration</p>
                  <p className="text-2xl font-bold text-white mt-2">{predictedDaysToComplete} days</p>
                </div>
                <div className={`pt-3 border-t border-gray-600 ${
                  Math.abs(totalSelectedPoints - (data?.recommendations?.recommended_capacity ?? 0)) < 10
                    ? 'text-primary'
                    : 'text-yellow-400'
                }`}>
                  <p className="text-sm font-semibold">
                    {Math.abs(totalSelectedPoints - (data?.recommendations?.recommended_capacity ?? 0)) < 10
                      ? 'Capacity is optimal'
                      : Math.abs(totalSelectedPoints - (data?.recommendations?.recommended_capacity ?? 0)) > 20
                      ? 'Consider adjusting capacity'
                      : '✓ Reasonable capacity'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Backlog Tickets */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-primary">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                <ChartBarIcon className="h-5 w-5" style={{color: '#92c951'}} />
                Select Tickets for Sprint
              </h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {backlogTickets.length > 0 ? (
                  backlogTickets.map(ticket => (
                    <label
                      key={ticket.key}
                      className="flex items-center gap-3 p-3 rounded hover:bg-gray-50 border border-gray-200 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTickets.includes(ticket.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTickets([...selectedTickets, ticket.key]);
                          } else {
                            setSelectedTickets(selectedTickets.filter(t => t !== ticket.key));
                          }
                        }}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{color: '#92c951'}}>{ticket.key}</p>
                        <p className="text-xs text-gray truncate">{ticket.summary}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-2 py-1 rounded font-medium" style={{backgroundColor: 'rgba(146, 201, 81, 0.1)', color: '#92c951'}}>
                          {ticket.storyPoints} pts
                        </span>
                        <span className="text-xs text-gray">{ticket.issueType}</span>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-gray text-sm py-4">No tickets in backlog</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Velocity Trend Chart */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-dark mb-6">Velocity Trend (Last 5 Sprints)</h2>
          <div className="flex items-end gap-2 h-40">
            {velocityData.pastSprints && velocityData.pastSprints.length > 0 ? (
              velocityData.pastSprints.map((sprint, i) => (
                <div key={sprint.sprintId} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative w-full h-32 flex items-end justify-center">
                    <div
                      className="w-full rounded-t"
                      style={{
                        background: 'linear-gradient(to top, rgba(146, 201, 81, 0.1), rgba(146, 201, 81, 0.5))',
                        borderTop: '1px solid #92c951',
                        height: `${(sprint.completedStoryPoints / Math.max(...velocityData.pastSprints.map(s => s.completedStoryPoints || 1))) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-dark">{sprint.completedStoryPoints}</p>
                    <p className="text-xs text-gray">{sprint.sprintName.replace(/\s*\(Sprint #\d+\)/, '')}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray text-center w-full">No velocity data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
