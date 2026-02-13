'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, pointerWithin, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  assigneeAccountId?: string;
  priority: string;
}

interface BoardColumn {
  id: string;
  name: string;
  tickets: JiraTicket[];
}

interface SortableTicketProps {
  ticket: JiraTicket;
  jiraBaseUrl: string;
  onTicketClick: (key: string) => void;
  onAssigneeClick: (key: string, event: React.MouseEvent) => void;
  showAssigneeMenu: boolean;
  teamMembers: any[];
  onAssignToUser: (key: string, accountId: string | null, event: React.MouseEvent) => void;
  assigningTicket: string | null;
  getAssigneeInitials: (name: string) => string;
  getAssigneeColor: (name: string) => string;
  suggestedAssignees: Record<string, any>;
  onFetchAssignee: (ticket: JiraTicket) => void;
}

function SortableTicketCard({ ticket, jiraBaseUrl, onTicketClick, onAssigneeClick, showAssigneeMenu, teamMembers, onAssignToUser, assigningTicket, getAssigneeInitials, getAssigneeColor, suggestedAssignees, onFetchAssignee }: SortableTicketProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-gray-800 rounded-lg p-3 border-l-4 border-primary hover:shadow-md hover:bg-gray-700 transition cursor-grab active:cursor-grabbing relative"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span 
            onClick={(e) => {
              e.stopPropagation();
              onTicketClick(ticket.key);
            }}
            className="text-xs font-semibold text-dark bg-primary px-2 py-1 rounded cursor-pointer hover:bg-opacity-80"
          >
            {ticket.key}
          </span>
        </div>
      </div>
      <h4 className="text-sm font-medium text-gray-200 mb-2 line-clamp-2">
        {ticket.summary}
      </h4>
      <div className="flex items-center justify-between relative">
        <button
          onClick={(e) => onAssigneeClick(ticket.key, e)}
          disabled={assigningTicket === ticket.key}
          className="flex items-center space-x-2 bg-gray-700/50 hover:bg-gray-600 p-1 px-2 rounded transition-colors disabled:opacity-50"
        >
          <div className={`h-6 w-6 rounded-full flex items-center justify-center ${getAssigneeColor(ticket.assignee)}`}>
            <span className="text-xs font-semibold">
              {getAssigneeInitials(ticket.assignee)}
            </span>
          </div>
          <span className="text-xs text-gray-200 font-medium">{assigningTicket === ticket.key ? 'Updating...' : (ticket.assignee || 'Unassigned')}</span>
          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        
        {showAssigneeMenu && (
          <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 max-h-48 overflow-y-auto">
            <button
              onClick={(e) => onAssignToUser(ticket.key, null, e)}
              className="w-full text-left px-3 py-2 text-xs text-dark hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                ✕
              </div>
              <span>Unassigned</span>
            </button>
            {teamMembers.filter(m => m.active).map((member) => (
              <button
                key={member.accountId}
                onClick={(e) => onAssignToUser(ticket.key, member.accountId, e)}
                className="w-full text-left px-3 py-2 text-xs text-dark hover:bg-gray-100 transition-colors flex items-center gap-2"
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${getAssigneeColor(member.displayName)}`}>
                  {getAssigneeInitials(member.displayName)}
                </div>
                <span>{member.displayName}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface DroppableColumnProps {
  column: BoardColumn;
  jiraBaseUrl: string;
  onTicketClick: (key: string) => void;
  onAssigneeClick: (key: string, event: React.MouseEvent) => void;
  showAssigneeMenu: string | null;
  teamMembers: any[];
  onAssignToUser: (key: string, accountId: string | null, event: React.MouseEvent) => void;
  assigningTicket: string | null;
  getAssigneeInitials: (name: string) => string;
  getAssigneeColor: (name: string) => string;
  suggestedAssignees: Record<string, any>;
  onFetchAssignee: (ticket: JiraTicket) => void;
}

function DroppableColumn({ column, jiraBaseUrl, onTicketClick, onAssigneeClick, showAssigneeMenu, teamMembers, onAssignToUser, assigningTicket, getAssigneeInitials, getAssigneeColor, suggestedAssignees, onFetchAssignee }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`bg-gray-900 rounded-xl md:rounded-2xl p-4 md:p-5 lg:p-6 min-h-[350px] md:min-h-[400px] shadow-md hover:shadow-xl transition-all border ${
        isOver ? 'ring-2 ring-primary bg-primary/5 border-green-500' : 'border-gray-800'
      }`}
    >
      <div className="flex items-center justify-between mb-4 md:mb-5 pb-3 md:pb-4 border-b-2 border-gray-800">
        <h3 className="font-bold text-sm md:text-base lg:text-lg text-white">{column.name}</h3>
        <span className="bg-primary text-dark text-xs md:text-sm font-bold px-3 py-1.5 rounded-full shadow-sm">
          {column.tickets.length}
        </span>
      </div>

      <SortableContext
        items={column.tickets.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4 min-h-[200px]">
          {column.tickets.map((ticket) => (
            <SortableTicketCard
              key={ticket.id}
              ticket={ticket}
              jiraBaseUrl={jiraBaseUrl}
              onTicketClick={onTicketClick}
              onAssigneeClick={onAssigneeClick}
              showAssigneeMenu={showAssigneeMenu === ticket.key}
              teamMembers={teamMembers}
              onAssignToUser={onAssignToUser}
              assigningTicket={assigningTicket}
              getAssigneeInitials={getAssigneeInitials}
              getAssigneeColor={getAssigneeColor}
              suggestedAssignees={suggestedAssignees}
              onFetchAssignee={onFetchAssignee}
              />
            ))
          }
        </div>
      </SortableContext>
    </div>
  );
}

export default function JiraBoard() {
  const { data: session } = useSession();
  const [columns, setColumns] = useState<BoardColumn[]>([
    { id: 'todo', name: 'To Do', tickets: [] },
    { id: 'inprogress', name: 'In Progress', tickets: [] },
    { id: 'review', name: 'Review', tickets: [] },
    { id: 'done', name: 'Done', tickets: [] },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string>('');
  const [assigningTicket, setAssigningTicket] = useState<string | null>(null);
  const [transitioningTicket, setTransitioningTicket] = useState<string | null>(null);
  const [showTransitionMenu, setShowTransitionMenu] = useState<string | null>(null);
  const [availableTransitions, setAvailableTransitions] = useState<{ [key: string]: any[] }>({});
  const [activeTicket, setActiveTicket] = useState<JiraTicket | null>(null);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [suggestedAssignees, setSuggestedAssignees] = useState<Record<string, any>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchJiraBoard();
    fetchTeamMembers();
    // Real-time updates every 30 seconds
    const interval = setInterval(fetchJiraBoard, 30000);
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

  const fetchAssigneeSuggestion = async (ticket: JiraTicket) => {
    try {
      const response = await fetch('/api/auto-asignee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: ticket.summary,
          description: '',
          issueType: 'Task'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuggestedAssignees(prev => ({
          ...prev,
          [ticket.key]: data
        }));
      }
    } catch (error) {
      console.error(`Failed to fetch assignee for ${ticket.key}:`, error);
    }
  };

  const fetchJiraBoard = async () => {
    try {
      const response = await fetch('/api/jira/user-tickets');
      const data = await response.json();
      
      // Check if unauthorized or session expired
      if (response.status === 401 || data.logout) {
        window.location.href = '/login';
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

  const toggleAssigneeMenu = (ticketKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setShowAssigneeMenu(showAssigneeMenu === ticketKey ? null : ticketKey);
  };

  const handleAssignToUser = async (ticketKey: string, accountId: string | null, event: React.MouseEvent) => {
    event.stopPropagation();

    setAssigningTicket(ticketKey);
    setShowAssigneeMenu(null);
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
        await fetchJiraBoard();
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
    
    if (showTransitionMenu === ticketKey) {
      setShowTransitionMenu(null);
      return;
    }

    setShowTransitionMenu(ticketKey);
    
    if (availableTransitions[ticketKey]) {
      return;
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
        setShowTransitionMenu(null);
      }
    } catch (error) {
      console.error('Error loading transitions:', error);
      setError('Failed to load transitions');
      setShowTransitionMenu(null);
    }
  };

  const handleStatusChange = async (ticketKey: string, transitionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setTransitioningTicket(ticketKey);
    setShowTransitionMenu(null);
    
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
        await fetchJiraBoard();
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const ticket = columns
      .flatMap(col => col.tickets)
      .find(t => t.id === active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);

    if (!over) return;

    const activeTicketId = active.id as string;
    let targetColumnId = over.id as string;

    // Find the ticket and its current column
    let sourceColumn: BoardColumn | undefined;
    let ticket: JiraTicket | undefined;

    for (const col of columns) {
      const foundTicket = col.tickets.find(t => t.id === activeTicketId);
      if (foundTicket) {
        ticket = foundTicket;
        sourceColumn = col;
        break;
      }
    }

    if (!ticket || !sourceColumn) return;

    // Check if over.id is a ticket ID, if so find its column
    let targetColumn = columns.find(col => col.id === targetColumnId);
    if (!targetColumn) {
      // over.id might be a ticket ID, find which column it belongs to
      for (const col of columns) {
        if (col.tickets.some(t => t.id === targetColumnId)) {
          targetColumn = col;
          targetColumnId = col.id;
          break;
        }
      }
    }

    if (!targetColumn || sourceColumn.id === targetColumn.id) return;

    // Optimistically update UI
    setColumns(prevColumns => {
      const newColumns = prevColumns.map(col => ({
        ...col,
        tickets: [...col.tickets]
      }));

      const sourceCol = newColumns.find(c => c.id === sourceColumn.id);
      const targetCol = newColumns.find(c => c.id === targetColumnId);

      if (sourceCol && targetCol) {
        sourceCol.tickets = sourceCol.tickets.filter(t => t.id !== activeTicketId);
        targetCol.tickets.push({ ...ticket!, status: targetCol.name });
      }

      return newColumns;
    });

    // Get available transitions for the ticket
    try {
      const response = await fetch(`/api/jira/transition?ticketKey=${ticket.key}`);
      const data = await response.json();

      if (response.ok && data.transitions) {
        // Find the transition that matches the target column
        const statusMap: { [key: string]: string[] } = {
          'todo': ['To Do', 'Backlog', 'Open'],
          'inprogress': ['In Progress', 'In Development'],
          'review': ['In Review', 'Review', 'Code Review'],
          'done': ['Done', 'Closed', 'Resolved']
        };

        const targetStatuses = statusMap[targetColumnId] || [targetColumn.name];
        const transition = data.transitions.find((t: any) =>
          targetStatuses.some(status => 
            t.name.toLowerCase().includes(status.toLowerCase()) ||
            t.to?.name?.toLowerCase().includes(status.toLowerCase())
          )
        );

        if (transition) {
          // Perform the transition
          const transitionResponse = await fetch('/api/jira/transition', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ticketKey: ticket.key,
              transitionId: transition.id,
            }),
          });

          if (transitionResponse.ok) {
            // Refresh to get accurate data
            await fetchJiraBoard();
          } else {
            throw new Error('Failed to transition ticket');
          }
        } else {
          throw new Error('No matching transition found');
        }
      } else {
        throw new Error('Failed to get transitions');
      }
    } catch (error) {
      console.error('Error transitioning ticket:', error);
      setError('Failed to move ticket. Refreshing board...');
      // Revert by refreshing
      await fetchJiraBoard();
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
    if (!name || name === 'Unassigned') return 'bg-gray-600 text-white';
    
    const colors = [
      'bg-blue-600 text-white font-bold shadow-sm',
      'bg-green-600 text-white font-bold shadow-sm',
      'bg-purple-600 text-white font-bold shadow-sm',
      'bg-pink-600 text-white font-bold shadow-sm',
      'bg-indigo-600 text-white font-bold shadow-sm',
      'bg-orange-600 text-white font-bold shadow-sm',
      'bg-red-600 text-white font-bold shadow-sm',
      'bg-cyan-600 text-white font-bold shadow-sm',
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
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-6 bg-dark rounded-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
          <div>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">Jira Board</h2>
            <p className="text-sm text-gray-400 mt-1">Drag tickets to change status</p>
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
            <DroppableColumn
              key={column.id}
              column={column}
              jiraBaseUrl={jiraBaseUrl}
              onTicketClick={handleTicketClick}
              onAssigneeClick={toggleAssigneeMenu}
              showAssigneeMenu={showAssigneeMenu}
              teamMembers={teamMembers}
              onAssignToUser={handleAssignToUser}
              assigningTicket={assigningTicket}
              getAssigneeInitials={getAssigneeInitials}
              getAssigneeColor={getAssigneeColor}
              suggestedAssignees={suggestedAssignees}
              onFetchAssignee={fetchAssigneeSuggestion}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTicket ? (
            <div className="bg-gray-light rounded-lg p-3 border-l-4 border-primary shadow-lg opacity-90 rotate-3">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-primary bg-dark px-2 py-1 rounded">
                  {activeTicket.key}
                </span>
              </div>
              <h4 className="text-sm font-medium text-dark mb-2 line-clamp-2">
                {activeTicket.summary}
              </h4>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
