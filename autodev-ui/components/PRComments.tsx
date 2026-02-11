'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface PRComment {
  id: string;
  prNumber: number;
  prTitle: string;
  ticketKey: string;
  comment: string;
  summary: string; 
  author: string;
  createdAt: string;
  url: string;
}

interface CommentsByTicket {
  [ticketKey: string]: PRComment[];
}

export default function PRComments() {
  const [commentsByTicket, setCommentsByTicket] = useState<CommentsByTicket>({});
  const [loading, setLoading] = useState(true);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPRComments();
    const interval = setInterval(fetchPRComments, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPRComments = async () => {
    try {
      const response = await fetch('/api/github/pr-comments');

      if (!response.ok) {
        console.warn('PR comments API returned error:', response.status);
        setLoading(false);
        return;
      }

      const data = await response.json();
      const newComments = data.commentsByTicket || {};

      setCommentsByTicket(newComments);

      // Auto-expand all tickets on first load
      if (expandedTickets.size === 0 && Object.keys(newComments).length > 0) {
        setExpandedTickets(new Set(Object.keys(newComments)));
      }

      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const toggleTicket = (ticketKey: string) => {
    const updated = new Set(expandedTickets);
    if (updated.has(ticketKey)) {
      updated.delete(ticketKey);
    } else {
      updated.add(ticketKey);
    }
    setExpandedTickets(updated);
  };

  const ticketKeys = Object.keys(commentsByTicket).sort();

  const totalComments = Object.values(commentsByTicket).reduce(
    (sum, comments) => sum + comments.length,
    0
  );

  if (loading) {
    return (
      <div className="bg-dark rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Open PR Comments</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 shadow-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
          Open PR Comments
        </h2>

        <div className="flex gap-3 items-center">
          <span className="bg-primary text-dark text-sm px-4 py-2 rounded-full font-bold">
            {ticketKeys.length} {ticketKeys.length === 1 ? 'Ticket' : 'Tickets'}
          </span>
        </div>
      </div>

      {/* No Data */}
      {ticketKeys.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500 font-medium">
            No PR comments found for your assigned tickets.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ticketKeys.map((ticketKey) => {
            const ticketComments = commentsByTicket[ticketKey];
            const isExpanded = expandedTickets.has(ticketKey);
            const firstComment = ticketComments[0];
            const ticketCommentCount = ticketComments.length;

            const prUrl = `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER}/${process.env.NEXT_PUBLIC_GITHUB_REPO_NAME}/pull/${firstComment.prNumber}`;

            return (
              <div
                key={ticketKey}
                className="bg-white rounded-xl shadow-md overflow-hidden"
              >
                {/* Ticket Header */}
                <button
                  onClick={() => toggleTicket(ticketKey)}
                  className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 transition border-l-4 border-primary"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary text-dark px-3 py-1 rounded-lg font-bold text-sm">
                        {ticketKey}
                      </span>
                      <span className="bg-gray-200 text-dark px-2 py-1 rounded-md text-xs font-semibold">
                        {ticketCommentCount}{' '}
                        {ticketCommentCount === 1 ? 'Comment' : 'Comments'}
                      </span>
                    </div>

                    <div className="text-left">
                      <a
                        href={prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-base font-semibold text-dark hover:text-primary transition"
                      >
                        {firstComment.prTitle}
                      </a>
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUpIcon className="h-5 w-5 text-dark" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-dark" />
                  )}
                </button>

                {/* Comments */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {ticketComments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-gray-50 rounded-lg p-4 border-l-4 border-primary/40"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-dark">
                              {comment.author}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                              •{' '}
                              {new Date(
                                comment.createdAt
                              ).toLocaleDateString()}
                            </span>
                          </div>

                          <a
                            href={comment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline uppercase"
                          >
                            View on GitHub
                          </a>
                        </div>

                        {/* AI Summary */}
                        <p className="text-sm text-dark leading-relaxed">
                          {comment.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
