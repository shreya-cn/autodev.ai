'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface AnalysisResult {
  ticket_id: string;
  support_analysis: {
    category: string;
    severity: string;
    confidence: number;
    suggested_code_areas?: string[];
    suspected_root_causes?: string[];
    suggested_developer?: string;
  };
  developer_suggestion: {
    suggested_developer: string;
    confidence: number;
    matching_files?: string[];
    reason: string;
  };
  github_analysis: {
    recent_changes?: any[];
    related_commits?: any[];
  };
  recommended_actions?: string[];
}

export default function SupportDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'manual' | 'jira'>('jira');
  const [ticketSummary, setTicketSummary] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [errorLog, setErrorLog] = useState('');
  const [jiraTicketId, setJiraTicketId] = useState('');
  const [updateJira, setUpdateJira] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const handleAnalyze = async () => {
    if (!ticketSummary.trim()) {
      setError('Please enter a ticket summary');
      return;
    }

    setAnalyzing(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await fetch('/api/analyze-support-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: ticketSummary,
          description: ticketDescription,
          error_log: errorLog,
          ticket_id: `SUPPORT-${Date.now()}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to analyze ticket');
        return;
      }

      setAnalysis(data.data);
    } catch (err) {
      setError(`Error analyzing ticket: ${(err as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeJiraTicket = async () => {
    if (!jiraTicketId.trim()) {
      setError('Please enter a JIRA ticket ID');
      return;
    }

    setAnalyzing(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await fetch('/api/analyze-jira-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: jiraTicketId,
          update_jira: updateJira,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to analyze JIRA ticket');
        return;
      }

      setAnalysis(data.data);
    } catch (err) {
      setError(`Error analyzing JIRA ticket: ${(err as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    if (severity.includes('Critical')) return 'text-red-600 bg-red-50';
    if (severity.includes('High')) return 'text-orange-600 bg-orange-50';
    if (severity.includes('Medium')) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Please log in to access support dashboard</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 md:px-10 lg:px-16 xl:px-24 py-6 md:py-8 lg:py-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-dark rounded-2xl px-6 md:px-10 py-8 md:py-12 text-white shadow-xl mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center gap-3">
            <SparklesIcon className="h-10 w-10 text-primary" />
            <span className="text-primary">Support Ticket</span> Analyzer
          </h1>
          <p className="text-gray-300">
            AI-powered root cause analysis for support tickets with automatic developer assignment
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              {/* Tab Selector */}
              <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('jira')}
                  className={`px-4 py-2 font-semibold transition ${
                    activeTab === 'jira'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  From JIRA
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`px-4 py-2 font-semibold transition ${
                    activeTab === 'manual'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Manual Entry
                </button>
              </div>

              {activeTab === 'jira' ? (
                <>
                  <h2 className="text-xl font-bold text-dark mb-4">Analyze JIRA Ticket</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        JIRA Ticket ID *
                      </label>
                      <input
                        type="text"
                        value={jiraTicketId}
                        onChange={(e) => setJiraTicketId(e.target.value.toUpperCase())}
                        placeholder="e.g., AUT-123, SUPPORT-45"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono text-dark bg-white placeholder-gray-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the JIRA ticket key from your board
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="updateJira"
                        checked={updateJira}
                        onChange={(e) => setUpdateJira(e.target.checked)}
                        className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
                      />
                      <label htmlFor="updateJira" className="text-sm text-gray-700">
                        Add analysis as comment to JIRA ticket
                      </label>
                    </div>

                    <button
                      onClick={handleAnalyzeJiraTicket}
                      disabled={analyzing}
                      className="w-full px-6 py-3 bg-primary text-dark font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition"
                    >
                      {analyzing ? 'Analyzing...' : 'Fetch & Analyze Ticket'}
                    </button>

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                      <strong>How it works:</strong>
                      <ul className="mt-1 ml-4 list-disc space-y-1">
                        <li>Fetches ticket from JIRA with description & attachments</li>
                        <li>Analyzes error logs from attachments automatically</li>
                        <li>Suggests root causes and best developer</li>
                        <li>Optionally updates ticket with AI analysis</li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-dark mb-4">New Support Ticket</h2>
                  
                  <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Issue Summary *
                  </label>
                  <input
                    type="text"
                    value={ticketSummary}
                    onChange={(e) => setTicketSummary(e.target.value)}
                    placeholder="e.g., Login page shows blank"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    placeholder="Detailed description of the issue..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Error Log/Stack Trace
                  </label>
                  <textarea
                    value={errorLog}
                    onChange={(e) => setErrorLog(e.target.value)}
                    placeholder="Paste error logs here..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono text-xs"
                  />
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full px-6 py-3 bg-primary text-dark font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition"
                >
                  {analyzing ? 'Analyzing...' : '🤖 Analyze Ticket'}
                </button>
                  </div>
                </>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Analysis Results */}
          <div className="lg:col-span-2 space-y-6">
            {analysis ? (
              <>
                {/* JIRA Ticket Info (if from JIRA) */}
                {(analysis as any).ticket_details && (
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-dark flex items-center gap-2">
                          📋 JIRA Ticket Details
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Fetched from {(analysis as any).ticket_key}
                        </p>
                      </div>
                      {(analysis as any).ticket_url && (
                        <a
                          href={(analysis as any).ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-semibold"
                        >
                          View in JIRA →
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700">Summary:</span>
                        <p className="text-gray-600 mt-1">{(analysis as any).ticket_details.summary}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Status:</span>
                        <p className="text-gray-600 mt-1">{(analysis as any).ticket_details.status}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Reporter:</span>
                        <p className="text-gray-600 mt-1">{(analysis as any).ticket_details.reporter.name}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Priority:</span>
                        <p className="text-gray-600 mt-1">{(analysis as any).ticket_details.priority}</p>
                      </div>
                      {(analysis as any).ticket_details.attachments?.length > 0 && (
                        <div className="col-span-2">
                          <span className="font-semibold text-gray-700">Attachments:</span>
                          <ul className="mt-1 space-y-1">
                            {(analysis as any).ticket_details.attachments.map((att: any, i: number) => (
                              <li key={i} className="text-xs text-gray-600">
                                📎 {att.filename} ({Math.round(att.size / 1024)}KB)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(analysis as any).jira_updated && (
                        <div className="col-span-2">
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                            ✅ Analysis added to JIRA ticket
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-bold text-dark mb-4">Analysis Results</h2>
                  
                  <div className={`p-4 rounded-lg mb-4 ${getSeverityColor(analysis.support_analysis.severity)}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-lg">{analysis.support_analysis.severity}</p>
                        <p className="text-sm mt-1">{analysis.support_analysis.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">{analysis.support_analysis.confidence}%</p>
                        <p className="text-xs mt-1">Confidence</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Suggested Developer */}
                <div className="bg-white rounded-lg shadow p-6 border-l-4 border-primary">
                  <h3 className="text-lg font-bold text-dark mb-3">👨‍💻 Suggested Developer</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-dark text-lg">{analysis.developer_suggestion.suggested_developer}</span>
                      <span className="text-sm bg-green-100 text-green-900 font-bold px-3 py-1 rounded-full">
                        {analysis.developer_suggestion.confidence}% match
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 font-medium">{analysis.developer_suggestion.reason}</p>
                    {(analysis.developer_suggestion.matching_files?.length ?? 0) > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-xs font-bold text-gray-900 mb-2">Related Files:</p>
                        <ul className="space-y-1">
                          {(analysis.developer_suggestion.matching_files || []).slice(0, 3).map((file, i) => (
                            <li key={i} className="text-xs text-gray-800 font-mono font-semibold">
                              📄 {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Code Areas to Check */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-6 w-6 text-orange-500" />
                    Code Areas to Check
                  </h3>
                  <div className="space-y-2">
                    {(analysis.support_analysis.suggested_code_areas?.length ?? 0) > 0 ? (
                      (analysis.support_analysis.suggested_code_areas || []).map((area, i) => (
                        <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded font-mono text-sm text-blue-900">
                          📍 {area}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-600">No specific code areas identified</p>
                    )}
                  </div>
                </div>

                {/* Root Causes */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                    Suspected Root Causes
                  </h3>
                  <ol className="space-y-2">
                    {(analysis.support_analysis.suspected_root_causes?.length ?? 0) > 0 ? (
                      (analysis.support_analysis.suspected_root_causes || []).map((cause, i) => (
                        <li key={i} className="p-3 bg-yellow-100 border-l-4 border-yellow-500 text-sm text-gray-900 font-medium">
                          <strong className="text-gray-900">{i + 1}.</strong> {cause}
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-700">No specific root causes identified</li>
                    )}
                  </ol>
                </div>

                {/* Recommended Actions */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-dark mb-4">💡 Recommended Actions</h3>
                  <ol className="space-y-2">
                    {(analysis.recommended_actions || []).map((action, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="font-semibold text-primary font-bold">{i + 1}.</span>
                        <span className="text-gray-800 font-medium">{action}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Recent Changes */}
                {(analysis.github_analysis.recent_changes?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-dark mb-4">📝 Recent Code Changes</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(analysis.github_analysis.recent_changes || []).slice(0, 5).map((commit, i) => (
                        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                          <p className="font-semibold text-dark">{commit.message}</p>
                          <p className="text-xs text-gray-600 mt-1">by {commit.author}</p>
                          <div className="mt-2 space-y-1">
                            {commit.files?.slice(0, 2).map((file: any, j: number) => (
                              <p key={j} className="text-xs text-gray-500 font-mono ml-3">
                                • {file.name}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-50 rounded-lg p-12 text-center">
                <p className="text-gray-600">
                  Enter a support ticket summary and click "Analyze Ticket" to get AI-powered insights
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
