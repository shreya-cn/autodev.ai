'use client';

import { useState, useEffect } from 'react';

interface RelatedTicket {
  key: string;
  summary: string;
  status: string;
  score: number;
  reason: string;
  category?: 'current-sprint' | 'backlog' | 'unassigned';
  assignee?: string;
  reasoning?: string;
  relatedToTicket?: string;
  relatedToTitle?: string;
}

interface SuggestionGroup {
  ticketKey: string;
  title: string;
  suggestions: RelatedTicket[];
}

export default function RelatedTickets() {
  const [suggestionGroups, setSuggestionGroups] = useState<SuggestionGroup[]>([]);
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
      
      const response = await fetch('/api/jira/user-suggestions');
      const data = await response.json();
      
      // Check if session expired
      if (data.logout) {
        window.location.href = '/signout';
        return;
      }
      
      if (data.suggestions) {
        // Keep grouped structure for display
        const groups = data.suggestions.map((suggestion: any) => ({
          ticketKey: suggestion.ticketKey,
          title: suggestion.title,
          suggestions: suggestion.suggestions.map((ticket: any) => ({
            key: ticket.key,
            summary: ticket.summary,
            status: ticket.status,
            score: ticket.relevance || 0,
            reason: ticket.reasoning || `Related to ${suggestion.ticketKey}: ${suggestion.title}`,
            category: ticket.category || 'backlog',
            assignee: ticket.assignee || 'Unassigned',
            reasoning: ticket.reasoning,
            relatedToTicket: suggestion.ticketKey,
            relatedToTitle: suggestion.title
          }))
        }));
        setSuggestionGroups(groups);
        setCurrentTicket(data.suggestions[0]?.ticketKey || '');
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
      <div className="bg-dark rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg border border-gray-700">
        <div className="mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-primary mb-2 md:mb-3">AI Ticket Suggestions</h2>
          <p className="text-sm md:text-base lg:text-lg text-gray-300">
            AI is analyzing your tickets to find relevant matches...
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
    <div className="bg-dark rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg border border-gray-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-primary mb-2 md:mb-3">AI Ticket Suggestions</h2>
          <p className="text-sm md:text-base lg:text-lg text-gray-300">
            Personalized suggestions based on your tickets and work patterns
          </p>
        </div>
        <button
          onClick={() => fetchRelatedTickets(true)}
          disabled={refreshing}
          className="w-full md:w-auto px-5 md:px-6 lg:px-7 py-2.5 md:py-3 bg-primary text-dark rounded-xl font-bold hover:bg-opacity-90 transition-all shadow-md hover:shadow-lg text-sm md:text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{refreshing ? 'Analyzing...' : 'Refresh'}</span>
        </button>
      </div>

      {suggestionGroups.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-300">No related tickets found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(() => {
            // Track duplicate tickets across groups
            const ticketCounts = new Map<string, number>();
            suggestionGroups.forEach(group => {
              group.suggestions.forEach(ticket => {
                ticketCounts.set(ticket.key, (ticketCounts.get(ticket.key) || 0) + 1);
              });
            });

            return suggestionGroups.map((group, groupIndex) => (
            <div key={group.ticketKey} className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px bg-primary flex-grow"></div>
                <div className="flex items-center gap-2 px-3 py-2 bg-primary bg-opacity-10 rounded-lg border border-primary">
                  <span className="text-base font-bold text-dark bg-primary px-3 py-1 rounded">{group.ticketKey}</span>
                </div>
                <div className="h-px bg-primary flex-grow"></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {group.suggestions.map((ticket, index) => {
                  const isCurrentSprint = ticket.category === 'current-sprint';
                  const isBacklog = ticket.category === 'backlog';
                  
                  const isDuplicate = ticketCounts.get(ticket.key)! > 1;
                  
                  const categoryBadge = isCurrentSprint 
                    ? 'CURRENT SPRINT' 
                    : 'BACKLOG';
                  
                  const categoryColor = isCurrentSprint
                    ? 'bg-blue-500 text-white'
                    : 'bg-yellow-500 text-dark';
                  
                  const borderColor = isCurrentSprint
                    ? 'border-blue-500'
                    : 'border-yellow-500';
                  
                  return (
                    <div
                      key={ticket.key}
                      className={`bg-white rounded-lg lg:rounded-xl p-3 sm:p-4 border-l-4 ${borderColor} hover:shadow-md transition relative`}
                    >
                      {isDuplicate && (
                        <div className="absolute top-2 right-2 group">
                          <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 6l7-5 7 5v10l-7 5-7-5V6zm6 0v9l1 .7 1-.7V6l-1-.7-1 .7z"/>
                          </svg>
                          <div className="absolute right-0 top-6 hidden group-hover:block bg-dark text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                            Relevant to {ticketCounts.get(ticket.key)} tickets
                          </div>
                        </div>
                      )} <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <div className="flex items-center space-x-2 flex-wrap gap-1">
                          <span className="text-base sm:text-lg font-bold text-primary">#{index + 1}</span>
                          <span className="text-xs sm:text-sm font-semibold bg-dark text-primary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                            {ticket.key}
                          </span>
                          <span className={`text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded ${categoryColor}`}>
                            {categoryBadge}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-primary text-dark px-2 py-1 rounded-full font-semibold">
                            {ticket.score}% match
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm sm:text-base font-semibold text-dark mb-2">{ticket.summary}</h4>
                      
                      <div className="bg-gray-light rounded-lg md:rounded-xl p-4 md:p-5 mb-4">
                        <p className="text-sm md:text-base text-dark leading-relaxed">
                          {ticket.reasoning || ticket.reason}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs md:text-sm text-gray font-medium">Status: {ticket.status}</span>
                          <span className="text-xs text-gray mt-1">{ticket.assignee}</span>
                        </div>
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
                  );
                })}
              </div>
            </div>
          ));
          })()}
        </div>
      )}
    </div>
  );
}
