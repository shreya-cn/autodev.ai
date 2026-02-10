'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface PRComment {
  id: string;
  prNumber: number;
  prTitle: string;
  ticketKey: string;
  comment: string;
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
      const data = await response.json();
      
      const newComments = data.commentsByTicket || {};
      setCommentsByTicket(newComments);
      
      // Auto-expand on first load
      if (expandedTickets.size === 0 && Object.keys(newComments).length > 0) {
        setExpandedTickets(new Set(Object.keys(newComments)));
      }
      setLoading(false);
    } catch (error) {
      console.error("Fetch error:", error);
      setLoading(false);
    }
  };

  const toggleTicket = (ticketKey: string) => {
    const newExpanded = new Set(expandedTickets);
    if (newExpanded.has(ticketKey)) {
      newExpanded.delete(ticketKey);
    } else {
      newExpanded.add(ticketKey);
    }
    setExpandedTickets(newExpanded);
  };

  const truncateComment = (comment: string, lines: number = 3) => {
    const split = comment.split('\n');
    return split.length <= lines ? comment : split.slice(0, lines).join('\n') + '...';
  };

  const ticketKeys = Object.keys(commentsByTicket).sort();
  const totalComments = Object.values(commentsByTicket).reduce((sum, comments) => sum + comments.length, 0);

  if (loading) {
    return (
      <div className="bg-dark rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Open PR Comments</h2>
        <div className="flex items-center justify-center h-32">
          <div className="relative">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-gray-800"></div>
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-transparent border-t-primary absolute top-0 left-0" style={{background: 'conic-gradient(from 0deg, #1a1a1a, #86efac, #1a1a1a)', borderRadius: '50%', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #fff 0)', mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #fff 0)'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">Open PR Comments</h2>
        <div className="flex gap-2 items-center">
          <span className="bg-primary text-dark text-sm px-5 py-2 rounded-full font-bold shadow-md">
            {ticketKeys.length} {ticketKeys.length === 1 ? 'Ticket' : 'Tickets'}
          </span>
          <span className="bg-dark text-white text-sm px-5 py-2 rounded-full font-bold shadow-md">
            {totalComments} {totalComments === 1 ? 'Comment' : 'Comments'}
          </span>
        </div>
      </div>

      {ticketKeys.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500 font-medium">No automated feedback found for your assigned tickets.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ticketKeys.map((ticketKey) => {
            const ticketComments = commentsByTicket[ticketKey];
            const isExpanded = expandedTickets.has(ticketKey);
            const firstComment = ticketComments[0];
            const prUrl = `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER}/${process.env.NEXT_PUBLIC_GITHUB_REPO_NAME}/pull/${firstComment.prNumber}`;

            return (
              <div key={ticketKey} className="bg-white rounded-xl shadow-md overflow-hidden">
                <button
                  onClick={() => toggleTicket(ticketKey)}
                  className="w-full flex items-center justify-between p-4 md:p-5 bg-primary/5 hover:bg-primary/10 transition border-l-4 border-primary"
                >
                  <div className="flex items-center gap-3">
                    <span className="bg-primary text-dark px-3 py-1 rounded-lg font-bold text-sm">{ticketKey}</span>
                    <div className="text-left">
                      <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-dark hover:text-primary transition" onClick={(e) => e.stopPropagation()}>
                        {firstComment.prTitle}
                      </a>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUpIcon className="h-5 w-5 text-dark" /> : <ChevronDownIcon className="h-5 w-5 text-dark" />}
                </button>

                {isExpanded && (
                  <div className="p-4 md:p-5 space-y-4">
                    {ticketComments.map((comment) => (
                      <div key={comment.id} className="bg-gray-light rounded-lg p-4 border-l-2 border-primary/40">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-dark flex items-center gap-1">🤖 AutoRev</span>
                            <span className="text-[10px] text-gray uppercase tracking-tighter">• {new Date(comment.createdAt).toLocaleDateString()}</span>
                          </div>
                          <a href={comment.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline uppercase">View on GitHub</a>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap text-xs md:text-sm text-dark leading-relaxed font-sans">{truncateComment(comment.comment)}</pre>
                        </div>
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