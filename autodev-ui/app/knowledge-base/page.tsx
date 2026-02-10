'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceReference[];
  confidence?: 'high' | 'medium' | 'low';
  suggestedFollowUps?: string[];
  timestamp: Date;
}

interface SourceReference {
  file: string;
  type: string;
  relevance: number;
  snippet?: string;
}

export default function KnowledgeBasePage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAsk = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/knowledge-base/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || 'Sorry, I couldn\'t generate an answer.',
        sources: data.sources || [],
        confidence: data.confidence || 'medium',
        suggestedFollowUps: data.suggestedFollowUps || [],
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReindex = async () => {
    setIsIndexing(true);
    try {
      const response = await fetch('/api/knowledge-base/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to reindex');
      }

      const data = await response.json();
      alert(data.message || 'Knowledge base reindexed successfully!');
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to reindex'}`);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleFollowUp = (question: string) => {
    setInput(question);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-black">
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="rounded-2xl px-7 py-7 text-white border border-green-500/20 shadow-xl" style={{background: 'linear-gradient(135deg, #1a1a1a 0%, #2d4a2e 50%, #1a1a1a 100%)'}}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 leading-tight">
                Knowledge Base <span style={{color: '#b9ff66'}}>Q&A</span>
              </h1>
              <p className="text-sm md:text-base lg:text-lg text-gray-300 leading-relaxed max-w-4xl">
                Ask questions about your codebase and Jira tickets - powered by AI
              </p>
            </div>
            <button
              onClick={handleReindex}
              disabled={isIndexing}
              style={{backgroundColor: '#b9ff66'}}
              className="px-4 py-2 text-black font-semibold rounded-lg hover:opacity-90 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {isIndexing ? 'Reindexing...' : 'Reindex'}
            </button>
          </div>
        </div>

        {/* Example Questions */}
        {messages.length === 0 && (
          <div className="bg-gray-900 rounded-lg shadow-lg border border-green-500/20 p-6">
            <h3 className="text-lg font-semibold mb-4" style={{color: '#b9ff66'}}>Try asking:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'What changes should I make for SCRUM-19?',
                'How does authentication work?',
                'What API endpoints are available?',
                'Which components handle user management?',
                'Where is the Jira integration implemented?',
                'What microservices are in this project?',
              ].map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleFollowUp(question)}
                  className="text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 hover:border-green-500/50 border border-gray-700 rounded-lg text-gray-300 transition-colors"
                >
                  "{question}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="bg-gray-900 rounded-lg shadow-lg border border-green-500/20 p-6 min-h-[400px] max-h-[600px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-xl text-gray-400">Ask me anything about your codebase!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3xl ${
                      message.role === 'user'
                        ? 'text-black shadow-lg'
                        : 'bg-gray-800 text-gray-200 border border-gray-700'
                    } rounded-lg p-4`}
                    style={message.role === 'user' ? {backgroundColor: '#b9ff66'} : {}}
                  >
                    {message.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-3" style={{color: '#b9ff66'}} {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-4 mb-2" style={{color: '#b9ff66'}} {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-3 mb-2" style={{color: '#b9ff66'}} {...props} />,
                            h4: ({node, ...props}) => <h4 className="text-base font-semibold mt-2 mb-1" style={{color: '#b9ff66'}} {...props} />,
                            p: ({node, ...props}) => <p className="mb-3 leading-relaxed text-gray-200" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 space-y-1 text-gray-200" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-200" {...props} />,
                            li: ({node, ...props}) => <li className="ml-4 text-gray-200" {...props} />,
                            code: ({node, inline, ...props}: any) => 
                              inline ? (
                                <code className="px-2 py-1 rounded text-sm font-mono border border-green-500/30" style={{backgroundColor: '#1a1a1a', color: '#b9ff66'}} {...props} />
                              ) : (
                                <code className="block px-4 py-3 rounded-lg text-sm font-mono overflow-x-auto border border-green-500/30 my-2" style={{backgroundColor: '#1a1a1a', color: '#b9ff66'}} {...props} />
                              ),
                            pre: ({node, ...props}) => <pre className="mb-3 overflow-x-auto" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold" style={{color: '#b9ff66'}} {...props} />,
                            em: ({node, ...props}) => <em className="italic text-gray-300" {...props} />,
                            a: ({node, ...props}) => <a className="underline hover:no-underline" style={{color: '#b9ff66'}} {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-green-500 pl-4 italic my-3 text-gray-300" {...props} />,
                            hr: ({node, ...props}) => <hr className="my-4 border-gray-600" {...props} />,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Sources */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-600">
                        <p className="font-semibold text-sm mb-2" style={{color: '#b9ff66'}}>
                          Sources ({message.confidence} confidence):
                        </p>
                        {message.sources.map((source, index) => (
                          <div key={index} className="text-sm mb-2">
                            <span className="font-mono bg-gray-900 px-2 py-1 rounded border border-green-500/30" style={{color: '#b9ff66'}}>
                              {source.file}
                            </span>
                            <span className="ml-2 text-gray-400">
                              ({source.type}) - {(source.relevance * 100).toFixed(0)}% relevant
                            </span>
                            {source.snippet && (
                              <p className="text-xs text-gray-500 ml-2 mt-1">{source.snippet}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Follow-up suggestions */}
                    {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-600">
                        <p className="font-semibold text-sm mb-2" style={{color: '#b9ff66'}}>Follow-up questions:</p>
                        {message.suggestedFollowUps.map((q, index) => (
                          <button
                            key={index}
                            onClick={() => handleFollowUp(q)}
                            className="block text-left text-sm hover:underline mt-1"
                            style={{color: '#b9ff66'}}
                          >
                            • {q}
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-gray-900 rounded-lg shadow-lg border border-green-500/20 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleAsk()}
              placeholder="Ask a question about your codebase..."
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-200 placeholder-gray-500"
              disabled={isLoading}
            />
            <button
              onClick={handleAsk}
              disabled={isLoading || !input.trim()}
              style={{backgroundColor: isLoading || !input.trim() ? '' : '#b9ff66'}}
              className="px-6 py-3 text-black font-semibold rounded-lg hover:opacity-90 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <div className="relative mr-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-800"></div>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-transparent border-t-primary absolute top-0 left-0" style={{background: 'conic-gradient(from 0deg, #1a1a1a, #86efac, #1a1a1a)', borderRadius: '50%', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0)', mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0)'}}></div>
                  </div>
                  Thinking...
                </span>
              ) : (
                'Ask'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
