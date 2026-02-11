'use client';

import React, { useState, useEffect } from 'react';

interface Ticket {
  id: string;
  summary: string;
  description: string;
  status: string;
  assignee: string;
  priority: string;
  created: string;
  updated: string;
  analyzed: boolean;
  analysis: {
    comment_found?: boolean;
    comment_author?: string;
    comment_created?: string;
  };
}

interface DashboardStats {
  total_tickets: number;
  analyzed_tickets: number;
  pending_analysis: number;
  critical_issues: number;
  high_issues: number;
  assigned_tickets: number;
  unassigned_tickets: number;
  analysis_rate: number;
}

export default function SupportAnalyticsDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAnalyzed, setFilterAnalyzed] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAnalyzedTickets();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAnalyzedTickets, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalyzedTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/analyzed-tickets');
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success || (data.tickets && Array.isArray(data.tickets))) {
        setTickets(data.tickets || []);
        calculateStats(data.tickets || []);
      } else if (data.error) {
        setError(`API Error: ${data.error}`);
      } else {
        setError('Failed to fetch tickets');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error connecting to API';
      setError(errorMessage);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ticketList: Ticket[]) => {
    const stats: DashboardStats = {
      total_tickets: ticketList.length,
      analyzed_tickets: ticketList.filter(t => t.analyzed).length,
      pending_analysis: ticketList.filter(t => !t.analyzed).length,
      critical_issues: ticketList.filter(t => t.priority === 'Critical' || t.priority === 'Highest').length,
      high_issues: ticketList.filter(t => t.priority === 'High').length,
      assigned_tickets: ticketList.filter(t => t.assignee !== 'Unassigned').length,
      unassigned_tickets: ticketList.filter(t => t.assignee === 'Unassigned').length,
      analysis_rate: ticketList.length > 0 ? Math.round((ticketList.filter(t => t.analyzed).length / ticketList.length) * 100) : 0
    };
    setStats(stats);
  };

  const getFilteredTickets = () => {
    return tickets.filter(ticket => {
      const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
      const matchesAnalyzed = 
        filterAnalyzed === 'all' || 
        (filterAnalyzed === 'analyzed' && ticket.analyzed) ||
        (filterAnalyzed === 'pending' && !ticket.analyzed);
      const matchesSearch = 
        ticket.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesAnalyzed && matchesSearch;
    });
  };

  const getSeverityColor = (priority: string): string => {
    switch (priority) {
      case 'Critical':
      case 'Highest':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'in progress':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'done':
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'to do':
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredTickets = getFilteredTickets();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Support Issues Analytics</h1>
          <p className="text-gray-600">Track and monitor AI-analyzed support tickets across your team</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Tickets"
              value={stats.total_tickets.toString()}
              color="from-blue-500 to-blue-600"
            />
            <StatCard
              label="Analyzed"
              value={`${stats.analyzed_tickets}/${stats.total_tickets}`}
              color="from-green-500 to-green-600"
              subtext={`${stats.analysis_rate}%`}
            />
            <StatCard
              label="Critical Issues"
              value={stats.critical_issues.toString()}
              color="from-red-500 to-red-600"
            />
            <StatCard
              label="Assigned"
              value={`${stats.assigned_tickets}/${stats.total_tickets}`}
              color="from-purple-500 to-purple-600"
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔍 Filters & Search</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Ticket ID or summary..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Analysis</label>
              <select
                value={filterAnalyzed}
                onChange={(e) => setFilterAnalyzed(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Tickets</option>
                <option value="analyzed">✅ Analyzed</option>
                <option value="pending">⏳ Pending</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchAnalyzedTickets}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              📋 Issues ({filteredTickets.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin">🔄</div>
              <p className="text-gray-600 mt-2">Loading tickets...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p>❌ {error}</p>
              <button
                onClick={fetchAnalyzedTickets}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No tickets found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Summary</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Priority</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Assignee</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Analyzed</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`https://auto-dev.atlassian.net/browse/${ticket.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {ticket.id}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">{ticket.summary}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {ticket.assignee === 'Unassigned' ? (
                            <span className="text-gray-400 italic">Unassigned</span>
                          ) : (
                            <span>{ticket.assignee}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${ticket.analyzed ? 'text-green-600' : 'text-yellow-600'}`}>
                          {ticket.analyzed ? '✅ Yes' : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(ticket.created)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`https://auto-dev.atlassian.net/browse/${ticket.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Insights Section */}
        {stats && stats.total_tickets > 0 && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <InsightCard
              title="Analysis Coverage"
              value={`${stats.analysis_rate}%`}
              description={`${stats.analyzed_tickets} out of ${stats.total_tickets} tickets analyzed`}
              color="from-blue-400 to-blue-600"
            />
            <InsightCard
              title="Critical Attention"
              value={stats.critical_issues.toString()}
              description="Critical priority tickets that need attention"
              color="from-red-400 to-red-600"
            />
            <InsightCard
              title="Team Workload"
              value={stats.assigned_tickets.toString()}
              description={`${stats.unassigned_tickets} tickets awaiting assignment`}
              color="from-purple-400 to-purple-600"
            />
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 How This Works</h3>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>✅ When a ticket is created in the AS project, the system automatically analyzes it</li>
            <li>✅ AI identifies category, severity, and root causes</li>
            <li>✅ Structured analysis is posted as a comment in the JIRA ticket</li>
            <li>✅ Developer is auto-assigned based on expertise matching</li>
            <li>✅ This dashboard shows all analyzed tickets and team metrics</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: string;
  subtext?: string;
}

function StatCard({label, value, color, subtext }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-lg shadow p-6 text-white`}>
      <p className="text-white/80 text-sm font-medium">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtext && <p className="text-white/60 text-xs mt-2">{subtext}</p>}
    </div>
  );
}

interface InsightCardProps {
  title: string;
  value: string;
  description: string;
  color: string;
}

function InsightCard({ title, value, description, color }: InsightCardProps) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-lg shadow p-6 text-white`}>
      <h4 className="font-semibold mb-2">{title}</h4>
      <p className="text-3xl font-bold mb-2">{value}</p>
      <p className="text-white/80 text-sm">{description}</p>
    </div>
  );
}
