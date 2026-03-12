import React, { useState } from "react";
import { ChevronUp, ChevronDown, User, Calendar, Tag } from "lucide-react";

export default function TicketList({ tickets, onTicketClick }) {
  const [sortField, setSortField] = useState("created");
  const [sortDir, setSortDir] = useState("desc");

  const sortedTickets = [...tickets].sort((a, b) => {
    let valA = a[sortField] || "";
    let valB = b[sortField] || "";
    
    if (sortField === "created") {
        valA = new Date(a.created).getTime();
        valB = new Date(b.created).getTime();
    }

    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th onClick={() => handleSort("short_id")} className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600">
                <div className="flex items-center gap-2">ID <SortIcon field="short_id" /></div>
            </th>
            <th onClick={() => handleSort("title")} className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600">
                <div className="flex items-center gap-2">Title <SortIcon field="title" /></div>
            </th>
            <th onClick={() => handleSort("type")} className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600">
                <div className="flex items-center gap-2">Type <SortIcon field="type" /></div>
            </th>
            <th onClick={() => handleSort("status")} className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600">
                <div className="flex items-center gap-2">Status <SortIcon field="status" /></div>
            </th>
            <th onClick={() => handleSort("priority")} className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600">
                <div className="flex items-center gap-2">Priority <SortIcon field="priority" /></div>
            </th>
            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assignee</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sortedTickets.map(ticket => (
            <tr 
              key={ticket.id} 
              onClick={() => onTicketClick(ticket)}
              className="hover:bg-slate-50/50 cursor-pointer transition-colors group"
            >
              <td className="p-6 text-xs font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                  {ticket.short_id}
              </td>
              <td className="p-6">
                  <div className="text-sm font-bold text-slate-800">{ticket.title}</div>
              </td>
              <td className="p-6">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    ticket.type === 'bug' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                }`}>
                    {ticket.type}
                </span>
              </td>
              <td className="p-6">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">
                    {ticket.status}
                </span>
              </td>
              <td className="p-6">
                 <span className={`text-[10px] font-black uppercase tracking-widest ${
                     ticket.priority === 'critical' ? 'text-red-500' : 
                     ticket.priority === 'high' ? 'text-orange-500' : 
                     ticket.priority === 'medium' ? 'text-blue-500' : 'text-slate-400'
                 }`}>
                     {ticket.priority || 'none'}
                 </span>
              </td>
              <td className="p-6">
                  {ticket.expand?.assignee ? (
                      <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                              {ticket.expand.assignee.name?.[0] || ticket.expand.assignee.email[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-slate-600">{ticket.expand.assignee.name || ticket.expand.assignee.email}</span>
                      </div>
                  ) : (
                      <span className="text-xs font-medium text-slate-300 italic">Unassigned</span>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
