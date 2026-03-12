import React, { useState, useEffect } from "react";
import pb from "../api/pocketbase";
import { X, UserPlus, Trash2, Shield, Settings, Mail, ShieldAlert } from "lucide-react";

export default function ProjectSettings({ project, onClose, onUpdate }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [reporterIntake, setReporterIntake] = useState(project.reporter_intake_enabled);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  useEffect(() => {
    loadMembers();
  }, [project.id]);

  const loadMembers = async () => {
    try {
      const records = await pb.collection("project_memberships").getFullList({
        filter: `project = "${project.id}"`,
        expand: "user"
      });
      setMembers(records);
    } catch (err) {
      console.error("Failed to load members", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    try {
      const updated = await pb.collection("projects").update(project.id, {
        name,
        description,
        reporter_intake_enabled: reporterIntake,
        // Generate token if enabled and missing
        reporter_intake_token: reporterIntake && !project.reporter_intake_token 
            ? Math.random().toString(36).substring(2, 15) 
            : project.reporter_intake_token
      });
      onUpdate(updated);
      alert("Settings saved");
    } catch (err) {
      alert("Error saving settings");
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      // 1. Find user by email
      let user;
      try {
          user = await pb.collection("users").getFirstListItem(`email="${inviteEmail}"`);
      } catch (err) {
          alert("User not found with this email. Invitation flow not fully implemented in demo.");
          return;
      }

      // 2. Create membership
      await pb.collection("project_memberships").create({
        project: project.id,
        user: user.id,
        role: inviteRole
      });

      setInviteEmail("");
      loadMembers();
    } catch (err) {
      alert("Failed to invite user: " + err.message);
    }
  };

  const handleRemoveMember = async (membershipId) => {
    if (!confirm("Remove this member?")) return;
    try {
      await pb.collection("project_memberships").delete(membershipId);
      setMembers(members.filter(m => m.id !== membershipId));
    } catch (err) {
      alert("Error removing member");
    }
  };

  const handleArchive = async () => {
    if (!confirm("Archive this project? It will become read-only.")) return;
    try {
        const updated = await pb.collection("projects").update(project.id, { status: "archived" });
        onUpdate(updated);
        onClose();
    } catch (err) {
        alert("Error archiving project");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 rounded-2xl text-slate-600">
                    <Settings size={24} />
                </div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Project Settings</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={24} className="text-slate-400" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-12">
            {/* General Settings */}
            <section>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">General Information</h3>
                <form onSubmit={handleUpdateProject} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Project Name</label>
                        <input 
                            type="text" 
                            className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-bold"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                        <textarea 
                            className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-medium h-24"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <div>
                            <h4 className="text-sm font-black text-blue-900">External Reporter Intake</h4>
                            <p className="text-xs text-blue-700/70 font-medium">Allow external users to submit tickets via a public link.</p>
                            {project.reporter_intake_token && (
                                <code className="text-[10px] bg-white px-2 py-1 rounded-md border border-blue-200 mt-2 inline-block">
                                    /report/{project.reporter_intake_token}
                                </code>
                            )}
                        </div>
                        <button 
                            type="button"
                            onClick={() => setReporterIntake(!reporterIntake)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${reporterIntake ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${reporterIntake ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 transition-colors">
                            Save Changes
                        </button>
                    </div>
                </form>
            </section>

            {/* Members Management */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Team Members</h3>
                </div>

                <div className="space-y-4 mb-8">
                    {members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                                    {member.expand?.user?.name?.[0] || member.expand?.user?.email?.[0].toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-800">{member.expand?.user?.name || member.expand?.user?.email}</div>
                                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{member.role}</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleRemoveMember(member.id)}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleInvite} className="flex gap-3 bg-slate-100 p-2 rounded-2xl">
                    <input 
                        type="email" 
                        placeholder="Invite by email..."
                        className="flex-1 px-4 py-2 bg-transparent border-none focus:ring-0 text-sm font-bold"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        required
                    />
                    <select 
                        className="bg-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-none focus:ring-0"
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value)}
                    >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                    </select>
                    <button type="submit" className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-colors">
                        Invite
                    </button>
                </form>
            </section>

            {/* Danger Zone */}
            <section className="pt-8 border-t border-slate-100">
                <div className="p-6 bg-red-50 rounded-3xl border border-red-100">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                        <ShieldAlert size={20} />
                        <h4 className="font-black uppercase tracking-widest text-sm">Danger Zone</h4>
                    </div>
                    <p className="text-sm text-red-700/70 mb-4 font-medium">Actions here are permanent or high-impact.</p>
                    <button 
                        onClick={handleArchive}
                        className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-colors"
                    >
                        Archive Project
                    </button>
                </div>
            </section>
        </div>
      </div>
    </div>
  );
}
