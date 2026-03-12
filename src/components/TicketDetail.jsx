import React, { useState, useEffect } from "react";
import pb from "../api/pocketbase";
import { X, Send, Paperclip, User, Calendar, Tag, AlertCircle, History, MessageSquare } from "lucide-react";

export default function TicketDetail({ ticket, onClose, onUpdate }) {
  const [details, setDetails] = useState(ticket);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("comments"); // 'comments' | 'history'
  const [newComment, setNewComment] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadComments();
    loadUsers();
    loadHistory();
  }, [ticket.id]);

  const loadComments = async () => {
    try {
      const records = await pb.collection("comments").getFullList({
        filter: `ticket = "${ticket.id}"`,
        sort: "created",
        expand: "author_user,author_reporter"
      });
      setComments(records);
    } catch (err) {
      console.error("Failed to load comments", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const loadHistory = async () => {
      try {
          const records = await pb.collection("ticket_history").getFullList({
              filter: `ticket = "${ticket.id}"`,
              sort: "-created",
              expand: "actor_user"
          });
          setHistory(records);
      } catch (err) {
          console.error("Failed to load history", err);
      } finally {
          setLoadingHistory(false);
      }
  };

  const loadUsers = async () => {
    try {
      const records = await pb.collection("users").getFullList();
      setUsers(records);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  const handleUpdateField = async (field, value) => {
    try {
      const updated = await pb.collection("tickets").update(ticket.id, { [field]: value });
      setDetails(updated);
      onUpdate(updated);
      loadHistory(); // Reload history after update
    } catch (err) {
      alert("Failed to update ticket");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const comment = await pb.collection("comments").create({
        ticket: ticket.id,
        body: newComment,
        author_user: pb.authStore.model.id,
        is_internal: false 
      });
      
      const expandedComment = {
          ...comment,
          expand: { author_user: pb.authStore.model }
      };
      
      setComments([...comments, expandedComment]);
      setNewComment("");
    } catch (err) {
      alert("Failed to add comment");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              {details.short_id || "ID-PENDING"}
              <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${
                details.type === 'bug' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {details.type}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 leading-tight">{details.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8">
            
            {/* Properties Grid */}
            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</label>
                <select 
                  value={details.status}
                  onChange={(e) => handleUpdateField("status", e.target.value)}
                  className="w-full p-2 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="backlog">Backlog</option>
                  <option value="waiting">Waiting</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assignee</label>
                <select 
                  value={details.assignee || ""}
                  onChange={(e) => handleUpdateField("assignee", e.target.value)}
                  className="w-full p-2 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                <select 
                  value={details.priority || "none"}
                  onChange={(e) => handleUpdateField("priority", e.target.value)}
                  className="w-full p-2 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="none">None</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Description</label>
              <div className="prose prose-slate max-w-none text-slate-600">
                {details.description ? (
                    <p className="whitespace-pre-wrap">{details.description}</p>
                ) : (
                    <p className="italic text-slate-400">No description provided.</p>
                )}
              </div>
            </div>

            {/* Attachments */}
            {details.attachments && details.attachments.length > 0 && (
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Attachments</label>
                    <div className="flex flex-wrap gap-2">
                        {details.attachments.map(file => (
                            <a 
                                key={file}
                                href={`${pb.baseUrl}/api/files/tickets/${details.id}/${file}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                <Paperclip size={14} />
                                <span>{file}</span>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs Section */}
            <div className="pt-8 border-t border-slate-100">
              <div className="flex gap-6 mb-6">
                  <button 
                    onClick={() => setActiveTab("comments")}
                    className={`flex items-center gap-2 text-sm font-black uppercase tracking-widest transition-colors ${activeTab === 'comments' ? 'text-slate-900 border-b-2 border-slate-900 pb-2' : 'text-slate-400 hover:text-slate-600 pb-2'}`}
                  >
                      <MessageSquare size={16} />
                      Comments
                  </button>
                  <button 
                    onClick={() => setActiveTab("history")}
                    className={`flex items-center gap-2 text-sm font-black uppercase tracking-widest transition-colors ${activeTab === 'history' ? 'text-slate-900 border-b-2 border-slate-900 pb-2' : 'text-slate-400 hover:text-slate-600 pb-2'}`}
                  >
                      <History size={16} />
                      History
                  </button>
              </div>
              
              {activeTab === 'comments' ? (
                  <>
                    <div className="space-y-6 mb-8">
                        {comments.map((comment) => {
                            const author = comment.expand?.author_user || comment.expand?.author_reporter;
                            const name = author?.name || author?.email || "Unknown";
                            return (
                                <div key={comment.id} className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-500 shrink-0">
                                        {name[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800 text-sm">{name}</span>
                                            <span className="text-xs font-medium text-slate-400">
                                                {new Date(comment.created).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                            {comment.body}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {comments.length === 0 && !loadingComments && (
                            <div className="text-center py-8 text-slate-400 italic text-sm">No comments yet.</div>
                        )}
                    </div>

                    <form onSubmit={handleAddComment} className="relative">
                        <textarea
                        className="w-full p-4 pr-12 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[100px] text-sm font-medium resize-none"
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        />
                        <button 
                        type="submit"
                        disabled={!newComment.trim()}
                        className="absolute bottom-3 right-3 p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 transition-colors"
                        >
                        <Send size={16} />
                        </button>
                    </form>
                  </>
              ) : (
                  <div className="space-y-6">
                      {history.map((log) => (
                          <div key={log.id} className="flex gap-4">
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                  <History size={14} />
                              </div>
                              <div className="flex-1">
                                  <div className="text-sm text-slate-700 leading-snug">
                                      <span className="font-bold">{log.expand?.actor_user?.name || log.expand?.actor_user?.email || 'System'}</span>
                                      {' changed '}
                                      <span className="font-bold text-blue-600 uppercase text-[10px] tracking-widest">{log.field}</span>
                                      {' from '}
                                      <span className="text-slate-400 italic">"{log.old_value}"</span>
                                      {' to '}
                                      <span className="font-bold">"{log.new_value}"</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                      {new Date(log.created).toLocaleString()}
                                  </div>
                              </div>
                          </div>
                      ))}
                      {history.length === 0 && !loadingHistory && (
                          <div className="text-center py-8 text-slate-400 italic text-sm">No history recorded yet.</div>
                      )}
                  </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
