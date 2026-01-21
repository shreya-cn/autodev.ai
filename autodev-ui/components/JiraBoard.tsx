'use client';

import { useState, useEffect } from 'react';

interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
}

interface BoardColumn {
  id: string;
  name: string;
  tickets: JiraTicket[];
}

export default function JiraBoard() {
  const [columns, setColumns] = useState<BoardColumn[]>([
    { id: 'todo', name: 'To Do', tickets: [] },
    { id: 'inprogress', name: 'In Progress', tickets: [] },
    { id: 'review', name: 'Review', tickets: [] },
    { id: 'done', name: 'Done', tickets: [] },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string>('');

  useEffect(() => {
    fetchJiraBoard();
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchJiraBoard, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchJiraBoard = async () => {
    try {
      const response = await fetch('/api/jira/user-tickets');
      const data = await response.json();
      
      // Check if session expired
      if (data.logout) {
        window.location.href = '/signout';
        return;
      }
      
      if (data.error) {
        setError(data.error);
        // Still set empty columns if provided
        if (data.columns) {
          setColumns(data.columns);
        }
      } else {
        setError(null);
        if (data.columns) {
          setColumns(data.columns);
        }
        if (data.jiraBaseUrl) {
          setJiraBaseUrl(data.jiraBaseUrl);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching Jira board:', error);
      setError('Failed to connect to Jira API. Please try again later.');
      setLoading(false);
    }
  };

  const handleTicketClick = (ticketKey: string) => {
    if (jiraBaseUrl) {
      window.open(`${jiraBaseUrl}/browse/${ticketKey}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-light rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-dark">Jira Board</h2>
          <p className="text-sm text-gray-600 mt-1">All tickets from ScrumAutoDev project</p>
        </div>
        <button
          onClick={fetchJiraBoard}
          className="w-full md:w-auto px-5 md:px-6 lg:px-7 py-2.5 md:py-3 bg-primary text-dark rounded-xl font-bold hover:bg-opacity-90 transition-all shadow-md hover:shadow-lg text-sm md:text-base flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
        {columns.map((column) => (
          <div key={column.id} className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 lg:p-6 min-h-[350px] md:min-h-[400px] shadow-md hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4 md:mb-5 pb-3 md:pb-4 border-b-2 border-gray-200">
              <h3 className="font-bold text-sm md:text-base lg:text-lg text-dark">{column.name}</h3>
              <span className="bg-primary text-dark text-xs md:text-sm font-bold px-3 py-1.5 rounded-full shadow-sm">
                {column.tickets.length}
              </span>
            </div>

            <div className="space-y-4">
              {column.tickets.length === 0 ? (
                <p className="text-gray text-sm text-center py-8">No tickets</p>
              ) : (
                column.tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => handleTicketClick(ticket.key)}
                    className="bg-gray-light rounded-lg p-3 border-l-4 border-primary hover:shadow-md hover:bg-white transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-semibold text-primary bg-dark px-2 py-1 rounded">
                        {ticket.key}
                      </span>
                      <span className="text-xs text-gray">{ticket.priority}</span>
                    </div>
                    <h4 className="text-sm font-medium text-dark mb-2 line-clamp-2">
                      {ticket.summary}
                    </h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-dark text-xs font-semibold">
                            {ticket.assignee ? ticket.assignee[0].toUpperCase() : 'U'}
                          </span>
                        </div>
                        <span className="text-xs text-gray">{ticket.assignee || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
