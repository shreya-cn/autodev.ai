'use client';

import { useState, useEffect } from 'react';

interface PRComment {
  id: string;
  prNumber: number;
  prTitle: string;
  comment: string;
  author: string;
  createdAt: string;
  url: string;
}

export default function PRComments() {
  const [comments, setComments] = useState<PRComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPRComments();
    const interval = setInterval(fetchPRComments, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const fetchPRComments = async () => {
    try {
      const response = await fetch('/api/github/pr-comments');
      const data = await response.json();
      
      if (data.comments) {
        setComments(data.comments);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching PR comments:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-light rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-dark mb-4">Open PR Comments</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-light rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-dark">Open PR Comments</h2>
        <span className="bg-primary text-dark text-sm md:text-base px-5 md:px-6 py-2 md:py-2.5 rounded-full font-bold shadow-md">
          {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
        </span>
      </div>

      {comments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray">No open PR comments</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white rounded-xl p-4 border-l-4 border-primary hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <a
                    href={comment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold text-dark hover:text-primary transition"
                  >
                    PR #{comment.prNumber}: {comment.prTitle}
                  </a>
                  <p className="text-sm text-gray mt-1">
                    by {comment.author} • {new Date(comment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="bg-gray-light rounded-lg md:rounded-xl p-4 md:p-5">
                <p className="text-sm md:text-base text-dark leading-relaxed">{comment.comment}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
