'use client';

import { useState, useEffect } from 'react';

interface RelatedTicket {
  key: string;
  summary: string;
  status: string;
  score: number;
  reason: string;
}

export default function RelatedTickets() {
  const [tickets, setTickets] = useState<RelatedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<string>('');

  useEffect(() => {
    fetchRelatedTickets();
    const interval = setInterval(fetchRelatedTickets, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchRelatedTickets = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      
      const response = await fetch('/api/jira/related-tickets');
      const data = await response.json();
      
      if (data.tickets) {
        setTickets(data.tickets);
        setCurrentTicket(data.currentTicket || '');
      }
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching related tickets:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-light rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg">
        <div className="mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-dark mb-2 md:mb-3">Related Tickets</h2>
          <p className="text-sm md:text-base lg:text-lg text-gray">
            AI is analyzing tickets to find relevant matches...
          </p>
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg lg:rounded-xl p-3 sm:p-4 border-l-4 border-gray-300 animate-pulse"
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 bg-gray-300 rounded"></div>
                  <div className="h-6 w-16 bg-gray-300 rounded"></div>
                </div>
                <div className="h-6 w-20 bg-gray-300 rounded-full"></div>
              </div>
              
              <div className="h-5 bg-gray-300 rounded w-3/4 mb-3"></div>
              
              <div className="bg-gray-light rounded-lg md:rounded-xl p-4 md:p-5 mb-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-full"></div>
                  <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-gray-300 rounded"></div>
                <div className="h-4 w-28 bg-gray-300 rounded"></div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-center mt-6 gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <span className="text-sm text-gray font-medium">Loading related tickets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-light rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-dark mb-2 md:mb-3">Related Tickets</h2>
          {currentTicket && (
            <p className="text-sm md:text-base lg:text-lg text-gray">
              AI-suggested tickets related to <span className="font-semibold text-dark">{currentTicket}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => fetchRelatedTickets(true)}
          disabled={refreshing}
          className="w-full md:w-auto px-5 md:px-6 lg:px-7 py-2.5 md:py-3 bg-primary text-dark rounded-xl font-bold hover:bg-opacity-90 transition-all shadow-md hover:shadow-lg text-sm md:text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
          <span>{refreshing ? 'Analyzing...' : 'Refresh'}</span>
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray">No related tickets found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {tickets.map((ticket, index) => (
            <div
              key={ticket.key}
              className="bg-white rounded-lg lg:rounded-xl p-3 sm:p-4 border-l-4 border-primary hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-base sm:text-lg font-bold text-primary">#{index + 1}</span>
                  <span className="text-xs sm:text-sm font-semibold bg-dark text-primary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                    {ticket.key}
                  </span>
                </div>
                <div className="flex items-center space-x-2">                 <span className="text-xs bg-primary text-dark px-2 py-1 rounded-full font-semibold">
                    {ticket.score}% match
                  </span>
                </div>
              </div>

              <h4 className="text-sm sm:text-base font-semibold text-dark mb-2">{ticket.summary}</h4>
              
              <div className="bg-gray-light rounded-lg md:rounded-xl p-4 md:p-5 mb-4">
                <p className="text-sm md:text-base text-dark leading-relaxed">{ticket.reason}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs md:text-sm text-gray font-medium">Status: {ticket.status}</span>
                <a
                  href={`https://autodev-ai.atlassian.net/browse/${ticket.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs md:text-sm text-primary font-bold hover:underline"
                >
                  View in Jira →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
