import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from "@dnd-kit/core";
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import pb from "../api/pocketbase";
import { 
    Plus, ArrowLeft, LogOut, Loader2, GripVertical, 
    AlertCircle, LayoutGrid, List, Settings, Search, X 
} from "lucide-react";
import TicketDetail from "./TicketDetail";
import TicketList from "./TicketList";
import ProjectSettings from "./ProjectSettings";

// --- Constants ---
const COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "waiting", label: "Waiting" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
  { id: "rejected", label: "Rejected" },
];

// --- Sortable Ticket Item ---
function SortableTicket({ ticket, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: ticket.id, data: { ...ticket } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={() => onClick(ticket)}
      className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group relative hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing mb-3"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{ticket.short_id || "..."}</div>
        <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <h4 className="text-sm font-bold text-slate-800 leading-snug mb-3">{ticket.title}</h4>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
            ticket.type === 'bug' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
            }`}>
            {ticket.type}
            </span>
            {ticket.priority && ticket.priority !== 'none' && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    ticket.priority === 'critical' ? 'bg-red-600 text-white' : 'bg-orange-50 text-orange-600'
                }`}>
                    {ticket.priority}
                </span>
            )}
        </div>
        
        {ticket.expand?.assignee && (
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm" title={ticket.expand.assignee.name || ticket.expand.assignee.email}>
                {(ticket.expand.assignee.name || ticket.expand.assignee.email)[0].toUpperCase()}
            </div>
        )}
      </div>
    </div>
  );
}

// --- Kanban Column ---
function KanbanColumn({ column, tickets, onTicketClick }) {
  const columnTickets = tickets.filter(t => t.status === column.id);

  return (
    <div className="w-80 shrink-0 flex flex-col h-full bg-slate-100/50 rounded-3xl border border-slate-200/50 p-4">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">{column.label}</h3>
        <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">
          {columnTickets.length}
        </span>
      </div>
      
      <SortableContext 
        items={columnTickets.map(t => t.id)} 
        strategy={verticalListSortingStrategy}
        id={column.id}
      >
        <div className="flex-1 overflow-y-auto min-h-[100px]">
          {columnTickets.map((ticket) => (
            <SortableTicket key={ticket.id} ticket={ticket} onClick={onTicketClick} />
          ))}
          {columnTickets.length === 0 && (
             <div className="h-full border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 text-xs font-bold uppercase tracking-widest min-h-[100px]">
                 Empty
             </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// --- Main Component ---
export default function Kanban() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  
  // UI State
  const [view, setView] = useState("board"); // 'board' | 'list'
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // New Ticket Form State
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("task");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadData();
    
    pb.collection("tickets").subscribe("*", (e) => {
        if (e.record.project !== id) return;
        if (e.action === "create" || e.action === "update") {
            // Re-fetch to get expansions or manually merge if optimized
            loadTickets(); 
        } else if (e.action === "delete") {
            setTickets(prev => prev.filter(t => t.id !== e.record.id));
        }
    }, { expand: "assignee" });

    return () => pb.collection("tickets").unsubscribe("*");
  }, [id]);

  const loadData = async () => {
    try {
      const proj = await pb.collection("projects").getOne(id);
      setProject(proj);
      await loadTickets();
    } catch (err) {
      console.error("Failed to load project/tickets", err);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
      const tix = await pb.collection("tickets").getFullList({
        filter: `project = "${id}"`,
        sort: "position",
        expand: "assignee"
      });
      setTickets(tix);
  };

  const filteredTickets = useMemo(() => {
      if (!search.trim()) return tickets;
      const s = search.toLowerCase();
      return tickets.filter(t => 
        t.title.toLowerCase().includes(s) || 
        t.short_id.toLowerCase().includes(s) ||
        (t.description && t.description.toLowerCase().includes(s))
      );
  }, [tickets, search]);

  // --- Drag Handlers ---
  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    const activeTicket = tickets.find(t => t.id === activeId);
    if (!activeTicket) return;
    const overStatus = COLUMNS.find(c => c.id === overId) ? overId : tickets.find(t => t.id === overId)?.status;
    if (overStatus && activeTicket.status !== overStatus) {
      setTickets(prev => prev.map(t => t.id === activeId ? { ...t, status: overStatus } : t));
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    const activeTicket = tickets.find(t => t.id === activeId);
    const newStatus = COLUMNS.find(c => c.id === overId) ? overId : tickets.find(t => t.id === overId)?.status;
    
    if (activeTicket && newStatus) {
        try {
            await pb.collection("tickets").update(activeId, { status: newStatus });
        } catch (err) {
            console.error("Failed to update ticket status", err);
            loadTickets(); // Revert
        }
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await pb.collection("tickets").create({
        title: newTitle,
        type: newType,
        project: id,
        status: "backlog",
        position: tickets.length
      });
      setNewTitle("");
      setShowAddModal(false);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 font-black tracking-widest uppercase animate-pulse">Loading Workspace...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       {/* Header */}
       <header className="bg-white border-b border-slate-100 p-4 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <ArrowLeft size={20} className="text-slate-500" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-800 tracking-tight">{project?.name}</h1>
                {project?.status === 'archived' && (
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">Archived</span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{project?.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
              {/* Search */}
              <div className="relative group hidden md:block">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Search tickets..."
                    className="pl-11 pr-4 py-2 bg-slate-100 rounded-xl text-sm font-bold border-none focus:ring-4 focus:ring-blue-500/10 w-64 transition-all"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
              </div>

              {/* View Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setView("board")}
                    className={`p-2 rounded-lg transition-all ${view === 'board' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      <LayoutGrid size={18} />
                  </button>
                  <button 
                    onClick={() => setView("list")}
                    className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      <List size={18} />
                  </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                    onClick={() => setShowSettings(true)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                >
                    <Settings size={20} />
                </button>
                <button 
                onClick={() => setShowAddModal(true)}
                disabled={project?.status === 'archived'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                <Plus size={18} />
                <span className="hidden sm:inline">Create Ticket</span>
                </button>
              </div>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 overflow-x-auto p-6">
        {view === "board" ? (
            <DndContext 
                sensors={sensors} 
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex gap-6 min-h-full items-start w-max pb-8">
                    {COLUMNS.map((col) => (
                        <KanbanColumn 
                            key={col.id} 
                            column={col} 
                            tickets={filteredTickets} 
                            onTicketClick={setSelectedTicket}
                        />
                    ))}
                </div>

                <DragOverlay>
                    {activeId ? (
                        <div className="bg-white p-4 rounded-2xl shadow-xl border border-blue-500 rotate-2 cursor-grabbing opacity-90 scale-105 w-72">
                            <h4 className="text-sm font-bold text-slate-800 leading-snug">
                                {tickets.find(t => t.id === activeId)?.title}
                            </h4>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        ) : (
            <div className="max-w-[1400px] mx-auto">
                <TicketList tickets={filteredTickets} onTicketClick={setSelectedTicket} />
            </div>
        )}
      </main>

      {/* Modals */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-6">New Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Title</label>
                <input
                  autoFocus
                  type="text"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-900/5 text-lg font-medium"
                  placeholder="What needs to be done?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                  <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Type</label>
                  <div className="flex gap-2">
                      {['task', 'bug', 'feature'].map(type => (
                          <button
                              key={type}
                              type="button"
                              onClick={() => setNewType(type)}
                              className={`flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-colors ${
                                  newType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                          >
                              {type}
                          </button>
                      ))}
                  </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-colors">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTicket && (
          <TicketDetail 
              ticket={selectedTicket} 
              onClose={() => setSelectedTicket(null)}
              onUpdate={loadTickets}
          />
      )}

      {showSettings && (
          <ProjectSettings 
            project={project} 
            onClose={() => setShowSettings(false)}
            onUpdate={(u) => { setProject(u); loadTickets(); }}
          />
      )}
    </div>
  );
}
