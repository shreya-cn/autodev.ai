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

  useEffect(() => {
    fetchJiraBoard();
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchJiraBoard, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchJiraBoard = async () => {
    try {
      const response = await fetch('/api/jira/board');
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setError(null);
      }
      
      if (data.columns) {
        setColumns(data.columns);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching Jira board:', error);
      setError('Failed to connect to Jira API');
      setLoading(false);
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
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-dark">Jira Board</h2>
        <button
          onClick={fetchJiraBoard}
          className="w-full md:w-auto px-5 md:px-6 lg:px-7 py-2.5 md:py-3 bg-primary text-dark rounded-xl font-bold hover:bg-opacity-90 transition-all shadow-md hover:shadow-lg text-sm md:text-base flex items-center justify-center gap-2"
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 rounded-lg">
          <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
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
                    className="bg-gray-light rounded-lg p-3 border-l-4 border-primary hover:shadow-md transition cursor-pointer"
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
