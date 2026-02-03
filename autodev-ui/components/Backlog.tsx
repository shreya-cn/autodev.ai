'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface BacklogTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  assigneeAccountId?: string;
  priority: string;
  type?: string;
  created?: string;
}

export default function Backlog() {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<BacklogTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string>('');
  const [assigningTicket, setAssigningTicket] = useState<string | null>(null);
  const [transitioningTicket, setTransitioningTicket] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState<string | null>(null);
  const [availableTransitions, setAvailableTransitions] = useState<{ [key: string]: any[] }>({});
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    fetchBacklog();
    fetchTeamMembers();
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchBacklog, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/jira/team-members');
      const data = await response.json();
      if (response.ok) {
        setTeamMembers(data.teamMembers || []);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchBacklog = async () => {
    try {
      const response = await fetch('/api/jira/backlog', { method: 'POST' });
      const data = await response.json();
      
      // Check if unauthorized or session expired
      if (response.status === 401 || data.logout) {
        window.location.href = '/login';
        return;
      }
      
      if (data.error) {
        setError(data.error);
        if (data.tickets) {
          setTickets(data.tickets);
        }
      } else {
        setError(null);
        if (data.tickets) {
          setTickets(data.tickets);
        }
        if (data.jiraBaseUrl) {
          setJiraBaseUrl(data.jiraBaseUrl);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching backlog:', error);
      setError('Failed to connect to Jira API. Please try again later.');
      setLoading(false);
    }
  };

  const handleTicketClick = (ticketKey: string) => {
    if (jiraBaseUrl) {
      window.open(`${jiraBaseUrl}/browse/${ticketKey}`, '_blank');
    }
  };

  const toggleAssigneeMenu = (ticketKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowAssigneeMenu(showAssigneeMenu === ticketKey ? null : ticketKey);
  };

  const handleAssignToUser = async (ticketKey: string, accountId: string | null, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setAssigningTicket(ticketKey);
    setShowAssigneeMenu(null);
    
    try {
      const response = await fetch('/api/jira/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketKey,
          accountId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh the ticket list to show updated assignee
        await fetchBacklog();
      } else {
        setError(data.error || 'Failed to assign ticket');
      }
    } catch (error) {
      console.error('Error assigning ticket:', error);
      setError('Failed to assign ticket');
    } finally {
      setAssigningTicket(null);
    }
  };

  const loadTransitions = async (ticketKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (showStatusMenu === ticketKey) {
      setShowStatusMenu(null);
      return;
    }

    setShowStatusMenu(ticketKey);
    
    if (availableTransitions[ticketKey]) {
      return; // Already loaded
    }

    try {
      const response = await fetch(`/api/jira/transition?ticketKey=${ticketKey}`);
      const data = await response.json();

      if (response.ok) {
        setAvailableTransitions(prev => ({
          ...prev,
          [ticketKey]: data.transitions || []
        }));
      } else {
        setError(data.error || 'Failed to load transitions');
        setShowStatusMenu(null);
      }
    } catch (error) {
      console.error('Error loading transitions:', error);
      setError('Failed to load transitions');
      setShowStatusMenu(null);
    }
  };

  const handleStatusChange = async (ticketKey: string, transitionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setTransitioningTicket(ticketKey);
    setShowStatusMenu(null);
    
    try {
      const response = await fetch('/api/jira/transition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketKey,
          transitionId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh the ticket list to show updated status
        await fetchBacklog();
      } else {
        setError(data.error || 'Failed to change status');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      setError('Failed to change status');
    } finally {
      setTransitioningTicket(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'highest':
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      case 'lowest':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'bug':
        return (
          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.5 8a.5.5 0 000 1h7a.5.5 0 000-1h-7zm0 2a.5.5 0 000 1h7a.5.5 0 000-1h-7zM5.5 6a.5.5 0 01.5-.5h8a.5.5 0 01.5.5v8a.5.5 0 01-.5.5H6a.5.5 0 01-.5-.5V6zm-1.5.5A1.5 1.5 0 015.5 5h9A1.5 1.5 0 0116 6.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 014 15.5v-9zM10 3a1 1 0 011 1v1h-2V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        );
      case 'story':
        return (
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
          </svg>
        );
      case 'task':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'epic':
        return (
          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getAssigneeInitials = (name: string) => {
    if (!name || name === 'Unassigned') return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAssigneeColor = (name: string) => {
    if (!name || name === 'Unassigned') return 'bg-gray-200 text-gray-600';
    
    const colors = [
      'bg-blue-500 text-white',
      'bg-green-500 text-white',
      'bg-purple-500 text-white',
      'bg-pink-500 text-white',
      'bg-indigo-500 text-white',
      'bg-yellow-500 text-white',
      'bg-red-500 text-white',
      'bg-teal-500 text-white',
    ];
    
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-800"></div>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-primary absolute top-0 left-0" style={{background: 'conic-gradient(from 0deg, #1a1a1a, #86efac, #1a1a1a)', borderRadius: '50%', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #fff 0)', mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #fff 0)'}}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-dark">Product Backlog</h2>
          <p className="text-sm text-gray-500 mt-1">All unscheduled tickets</p>
        </div>
        <button
          onClick={fetchBacklog}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-dark font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-semibold">No backlog tickets</p>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-dark">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Key</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Summary</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {tickets.map((ticket) => (
                <tr 
                  key={ticket.id}
                  onClick={() => handleTicketClick(ticket.key)}
                  className="hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary text-dark font-bold text-sm shadow-sm">
                      {ticket.key}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-white font-medium line-clamp-2">{ticket.summary}</p>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(ticket.type || 'Task')}
                      <span className="text-sm text-gray-300">{ticket.type || 'Task'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority || 'Medium'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="relative">
                      <button
                        onClick={(e) => toggleAssigneeMenu(ticket.key, e)}
                        disabled={assigningTicket === ticket.key}
                        className="flex items-center gap-2 hover:bg-gray-700 p-2 rounded transition-colors disabled:opacity-50 w-full"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getAssigneeColor(ticket.assignee)}`}>
                          {getAssigneeInitials(ticket.assignee)}
                        </div>
                        <span className="text-sm text-gray-300">{assigningTicket === ticket.key ? 'Updating...' : (ticket.assignee || 'Unassigned')}</span>
                        <svg className="w-3 h-3 ml-auto text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {showAssigneeMenu === ticket.key && (
                        <div className="absolute z-50 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 max-h-64 overflow-y-auto">
                          <button
                            onClick={(e) => handleAssignToUser(ticket.key, null, e)}
                            className="w-full text-left px-4 py-2 text-sm text-dark hover:bg-gray-100 transition-colors flex items-center gap-2"
                          >
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                              ✕
                            </div>
                            <span>Unassigned</span>
                          </button>
                          {teamMembers.filter(m => m.active).map((member) => (
                            <button
                              key={member.accountId}
                              onClick={(e) => handleAssignToUser(ticket.key, member.accountId, e)}
                              className="w-full text-left px-4 py-2 text-sm text-dark hover:bg-gray-100 transition-colors flex items-center gap-2"
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getAssigneeColor(member.displayName)}`}>
                                {getAssigneeInitials(member.displayName)}
                              </div>
                              <span>{member.displayName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="relative">
                      <button
                        onClick={(e) => loadTransitions(ticket.key, e)}
                        disabled={transitioningTicket === ticket.key}
                        className="text-xs font-semibold px-3 py-1.5 rounded bg-gray-600 text-white hover:bg-gray-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {transitioningTicket === ticket.key ? 'Updating...' : ticket.status}
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {showStatusMenu === ticket.key && availableTransitions[ticket.key] && (
                        <div className="absolute z-50 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 max-h-64 overflow-y-auto">
                          {availableTransitions[ticket.key].map((transition: any) => (
                            <button
                              key={transition.id}
                              onClick={(e) => handleStatusChange(ticket.key, transition.id, e)}
                              className="w-full text-left px-4 py-2 text-sm text-dark hover:bg-gray-100 transition-colors"
                            >
                              {transition.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        Total: {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
