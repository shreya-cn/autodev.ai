'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState } from 'react';

interface ExtractedTicket {
  summary: string;
  description: string;
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  type: 'Story' | 'Bug' | 'Task' | 'Epic';
  storyPoints: number;
  assignee?: string;
  selected: boolean;
  actionItemNumber: number;
}

interface MeetingMetadata {
  date?: string;
  time?: string;
  duration?: string;
  participants?: string[];
}

export default function MOMTranscriptionPage() {
  const { data: session, status } = useSession();
  const [inputMethod, setInputMethod] = useState<'url' | 'file' | 'text'>('text');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedTickets, setExtractedTickets] = useState<ExtractedTicket[]>([]);
  const [meetingMetadata, setMeetingMetadata] = useState<MeetingMetadata | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [relatedTickets, setRelatedTickets] = useState<number[][]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      
      // Read file content if it's a text file (.txt, .vtt, or .docx)
      if (selectedFile.type === 'text/plain' || 
          selectedFile.name.endsWith('.txt') || 
          selectedFile.name.endsWith('.vtt') ||
          selectedFile.name.endsWith('.docx') ||
          selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setTranscriptionText(event.target?.result as string || '');
        };
        reader.readAsText(selectedFile);
      } else {
        // For audio files, we'll send to API for transcription
        setTranscriptionText('');
      }
    }
  };

  const handleProcessTranscription = async () => {
    if (inputMethod === 'url' && !meetingUrl.trim()) {
      setError('Please enter a meeting URL');
      return;
    }
    if (inputMethod === 'file' && !file) {
      setError('Please upload a file');
      return;
    }
    if (inputMethod === 'text' && !transcriptionText.trim()) {
      setError('Please paste transcription text');
      return;
    }

    setIsProcessing(true);
    setError('');
    setExtractedTickets([]);
    setMeetingMetadata(null);

    try {
      let requestBody: any = {};

      if (inputMethod === 'url') {
        requestBody = { url: meetingUrl };
      } else if (inputMethod === 'file') {
        // Convert file to base64 for API
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file!);
        });
        requestBody = { 
          file: base64, 
          fileName: file!.name,
          fileType: file!.type 
        };
      } else {
        requestBody = { transcription: transcriptionText };
      }

      const response = await fetch('/api/jira/process-mom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process transcription');
      }

      const data = await response.json();
      setExtractedTickets(data.tickets.map((t: any) => ({ ...t, selected: true })));
      setMeetingMetadata(data.metadata || null);
      setRelatedTickets(data.relatedTickets || []);
      
      if (data.relatedTickets && data.relatedTickets.length > 0) {
        setShowLinkDialog(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateTickets = async () => {
    const selectedTickets = extractedTickets.filter(t => t.selected);
    if (selectedTickets.length === 0) {
      setError('Please select at least one ticket to create');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/jira/create-bulk-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tickets: selectedTickets,
          linkRelated: relatedTickets.length > 0 ? relatedTickets : undefined,
          metadata: meetingMetadata
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create tickets');
      }

      const data = await response.json();
      setSuccess(`Successfully created ${data.created} ticket(s)${data.linked ? ` with ${data.linked} link(s)` : ''}`);
      setExtractedTickets([]);
      setTranscriptionText('');
      setFile(null);
      setMeetingUrl('');
      setMeetingMetadata(null);
      setRelatedTickets([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTicketSelection = (index: number) => {
    setExtractedTickets(prev => 
      prev.map((ticket, i) => 
        i === index ? { ...ticket, selected: !ticket.selected } : ticket
      )
    );
  };

  const updateTicketType = (index: number, type: 'Story' | 'Bug' | 'Task' | 'Epic') => {
    setExtractedTickets(prev =>
      prev.map((ticket, i) =>
        i === index ? { ...ticket, type } : ticket
      )
    );
  };

  const updateTicketPriority = (index: number, priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest') => {
    setExtractedTickets(prev =>
      prev.map((ticket, i) =>
        i === index ? { ...ticket, priority } : ticket
      )
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-black">
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="rounded-2xl px-7 py-7 text-white border border-green-500/20 shadow-xl" style={{background: 'linear-gradient(135deg, #1a1a1a 0%, #2d4a2e 50%, #1a1a1a 100%)'}}>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 leading-tight">
            MOM <span style={{color: '#b9ff66'}}>Transcription</span>
          </h1>
          <p className="text-sm md:text-base lg:text-lg text-gray-300 leading-relaxed max-w-4xl">
            Upload your Teams meeting transcript and automatically extract action items as Jira tickets
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-dark rounded-lg shadow-md p-6 border border-green-500/20">
          <h2 className="text-lg font-semibold text-white mb-4">Input Method</h2>
          
          {/* Input Method Selector */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setInputMethod('text')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                inputMethod === 'text'
                  ? 'bg-gray-700 text-white border-2'
                  : 'bg-gray-800 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }`}
              style={inputMethod === 'text' ? {borderColor: '#b9ff66'} : {}}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Paste Text
              </div>
            </button>
            <button
              onClick={() => setInputMethod('file')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                inputMethod === 'file'
                  ? 'bg-gray-700 text-white border-2'
                  : 'bg-gray-800 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }`}
              style={inputMethod === 'file' ? {borderColor: '#b9ff66'} : {}}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload File
              </div>
            </button>
            <button
              onClick={() => setInputMethod('url')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                inputMethod === 'url'
                  ? 'bg-gray-700 text-white border-2'
                  : 'bg-gray-800 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }`}
              style={inputMethod === 'url' ? {borderColor: '#b9ff66'} : {}}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Meeting URL
              </div>
            </button>
          </div>

          {/* Text Input */}
          {inputMethod === 'text' && (
            <div className="mb-4">
              <label htmlFor="transcription" className="block text-sm font-medium text-gray-300 mb-2">
                Paste Transcription Text
              </label>
              <textarea
                id="transcription"
                value={transcriptionText}
                onChange={(e) => setTranscriptionText(e.target.value)}
                placeholder="Paste your Teams meeting transcript here...&#10;&#10;Example format:&#10;Action item 1: Fix the login API that's not working&#10;Action item 2: Investigate the database connection timeout issue"
                className="w-full h-60 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none text-gray-200 placeholder-gray-500 font-mono text-sm"
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-400 mt-2">
                Use "Action item 1:", "Action item 2:" format to separate different tickets
              </p>
            </div>
          )}
          
          {/* File Upload */}
          {inputMethod === 'file' && (
            <div className="mb-4">
              <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-2">
                Upload Audio or Text File
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors border border-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Choose File
                  <input
                    id="file-upload"
                    type="file"
                    accept=".txt,.vtt,.docx,.mp3,.wav,.m4a,.mp4,audio/*,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {file && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{file.name}</span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Supported formats: Audio (.mp3, .wav, .m4a), Text (.txt), Subtitles (.vtt), or Documents (.docx)
              </p>
            </div>
          )}

          {/* URL Input */}
          {inputMethod === 'url' && (
            <div className="mb-4">
              <label htmlFor="meeting-url" className="block text-sm font-medium text-gray-300 mb-2">
                Meeting Recording URL
              </label>
              <input
                id="meeting-url"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://teams.microsoft.com/l/meetup-join/..."
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-200 placeholder-gray-500"
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-400 mt-2">
                Paste the URL to your Teams meeting recording or transcript
              </p>
            </div>
          )}

          <button
            onClick={handleProcessTranscription}
            disabled={isProcessing || (inputMethod === 'url' && !meetingUrl.trim()) || (inputMethod === 'file' && !file) || (inputMethod === 'text' && !transcriptionText.trim())}
            style={{backgroundColor: isProcessing || (inputMethod === 'url' && !meetingUrl.trim()) || (inputMethod === 'file' && !file) || (inputMethod === 'text' && !transcriptionText.trim()) ? '' : '#b9ff66'}}
            className="px-6 py-3 text-black font-semibold rounded-lg hover:opacity-90 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isProcessing ? (
              <span className="flex items-center">
                <div className="relative mr-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-800"></div>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-transparent border-t-primary absolute top-0 left-0" style={{background: 'conic-gradient(from 0deg, #1a1a1a, #86efac, #1a1a1a)', borderRadius: '50%', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0)', mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0)'}}></div>
                </div>
                Processing...
              </span>
            ) : (
              'Extract Action Items'
            )}
          </button>
        </div>

        {/* Meeting Metadata */}
        {meetingMetadata && (
          <div className="bg-gray-900 border border-green-500/20 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Meeting Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {meetingMetadata.date && (
                <div>
                  <span className="text-gray-500">Date:</span>
                  <p className="text-gray-300 font-medium">{meetingMetadata.date}</p>
                </div>
              )}
              {meetingMetadata.time && (
                <div>
                  <span className="text-gray-500">Time:</span>
                  <p className="text-gray-300 font-medium">{meetingMetadata.time}</p>
                </div>
              )}
              {meetingMetadata.duration && (
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <p className="text-gray-300 font-medium">{meetingMetadata.duration}</p>
                </div>
              )}
              {meetingMetadata.participants && meetingMetadata.participants.length > 0 && (
                <div>
                  <span className="text-gray-500">Participants:</span>
                  <p className="text-gray-300 font-medium">{meetingMetadata.participants.length}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Link Dialog */}
        {showLinkDialog && relatedTickets.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Related Tickets Detected</h3>
                <p className="text-gray-300 mb-4">
                  We found {relatedTickets.length} group(s) of related action items from this meeting. Would you like to link them together in Jira?
                </p>
                <div className="mb-4 space-y-2">
                  {relatedTickets.map((group, idx) => (
                    <div key={idx} className="bg-gray-800 p-3 rounded border border-gray-700">
                      <p className="text-sm text-gray-400 mb-1">Related Group {idx + 1}:</p>
                      <div className="flex flex-wrap gap-2">
                        {group.map((ticketIdx) => (
                          <span key={ticketIdx} className="text-xs px-2 py-1 bg-blue-900/40 text-blue-300 border border-blue-500/50 rounded">
                            Action Item {extractedTickets[ticketIdx]?.actionItemNumber}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowLinkDialog(false);
                      // Keep relatedTickets array so linking happens on creation
                    }}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Yes, Link Related Tickets
                  </button>
                  <button
                    onClick={() => {
                      setRelatedTickets([]);
                      setShowLinkDialog(false);
                    }}
                    className="px-4 py-2 bg-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    No, Create Independently
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        
        {success && (
          <div className="border px-4 py-3 rounded-lg" style={{backgroundColor: 'rgba(185, 255, 102, 0.1)', borderColor: '#b9ff66', color: '#b9ff66'}}>
            {success}
          </div>
        )}

        {/* Extracted Tickets */}
        {extractedTickets.length > 0 && (
          <div className="bg-dark rounded-lg shadow-md p-6 border border-green-500/20">
            {relatedTickets.length > 0 && !showLinkDialog && (
              <div className="mb-4 px-4 py-3 bg-blue-900/20 border border-blue-500/50 rounded-lg">
                <p className="text-blue-300 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                  Related tickets will be linked when created
                </p>
              </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Extracted Action Items ({extractedTickets.filter(t => t.selected).length} selected)
              </h2>
              <button
                onClick={handleCreateTickets}
                disabled={isProcessing || extractedTickets.filter(t => t.selected).length === 0}
                style={{backgroundColor: isProcessing || extractedTickets.filter(t => t.selected).length === 0 ? '' : '#b9ff66'}}
                className="px-6 py-3 text-black font-semibold rounded-lg hover:opacity-90 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {isProcessing ? 'Creating...' : relatedTickets.length > 0 && !showLinkDialog 
                  ? `Create & Link ${extractedTickets.filter(t => t.selected).length} Ticket(s)` 
                  : `Create ${extractedTickets.filter(t => t.selected).length} Ticket(s)`}
              </button>
            </div>

            <div className="space-y-4">
              {extractedTickets.map((ticket, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 transition-all ${
                    ticket.selected 
                      ? 'border-green-500/40 bg-gray-800' 
                      : 'border-gray-700 bg-gray-900/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={ticket.selected}
                      onChange={() => toggleTicketSelection(index)}
                      className="mt-1 w-5 h-5 rounded accent-green-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded" style={{backgroundColor: 'rgba(185, 255, 102, 0.2)', color: '#b9ff66'}}>
                            Action Item {ticket.actionItemNumber}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400">
                            {ticket.storyPoints} SP
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{ticket.summary}</h3>
                      <p className="text-gray-300 text-sm mb-3">{ticket.description}</p>
                      
                      {/* Type and Priority Selectors */}
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Type:</label>
                          <select
                            value={ticket.type}
                            onChange={(e) => updateTicketType(index, e.target.value as any)}
                            className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded border border-gray-600 focus:ring-1 focus:ring-green-500"
                          >
                            <option value="Task">Task</option>
                            <option value="Story">Story</option>
                            <option value="Bug">Bug</option>
                            <option value="Epic">Epic</option>
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Priority:</label>
                          <select
                            value={ticket.priority}
                            onChange={(e) => updateTicketPriority(index, e.target.value as any)}
                            className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded border border-gray-600 focus:ring-1 focus:ring-green-500"
                          >
                            <option value="Lowest">Lowest</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Highest">Highest</option>
                          </select>
                        </div>

                        {ticket.assignee && (
                          <span className="px-3 py-1 bg-purple-900/40 text-purple-300 border border-purple-500/50 rounded-full text-xs">
                            Assignee: {ticket.assignee}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
