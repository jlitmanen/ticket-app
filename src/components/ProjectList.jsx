import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import pb from "../api/pocketbase";
import { Plus, LayoutGrid, FolderPlus } from "lucide-react";

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", slug: "" });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const records = await pb.collection("projects").getFullList({
        sort: "-created",
        filter: "status = 'active'"
      });
      setProjects(records);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const record = await pb.collection("projects").create({
        ...newProject,
        status: "active",
        created_by: pb.authStore.model.id
      });
      
      // Auto-create a membership for the creator as owner
      await pb.collection("project_memberships").create({
        project: record.id,
        user: pb.authStore.model.id,
        role: "owner"
      });

      setNewProject({ name: "", slug: "" });
      setShowCreateModal(false);
      loadProjects();
    } catch (err) {
      console.error(err.data);
      const details = err.data?.data ? 
        Object.entries(err.data.data).map(([k, v]) => `${k}: ${v.message}`).join(", ") : 
        err.message;
      alert("Failed to create project: " + details);
    }
  };

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse font-black text-slate-300 text-2xl">Loading Workspace...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-5xl font-black text-slate-800 tracking-tighter">Workspace</h1>
          <p className="text-slate-500 font-medium mt-1">Select a project to view the board</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-900/10"
        >
          <Plus size={20} />
          <span>New Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-[3rem] border-2 border-dashed border-slate-200 p-20 text-center">
          <div className="inline-flex p-6 bg-slate-50 text-slate-400 rounded-3xl mb-6">
            <FolderPlus size={48} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">No projects yet</h2>
          <p className="text-slate-500 mb-8 max-w-xs mx-auto font-medium">
            Create your first project to start tracking tickets and managing your workflow.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-colors"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              className="group p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-slate-100 group-hover:bg-blue-500 transition-colors" />
              <div className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{project.slug}</div>
              <h2 className="text-2xl font-black text-slate-800 group-hover:text-blue-600 transition-colors mb-2">{project.name}</h2>
              <p className="text-slate-500 font-medium line-clamp-2 leading-relaxed">
                {project.description || "No description provided."}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-12 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter mb-8">New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Project Name</label>
                <input
                  autoFocus
                  required
                  type="text"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-lg font-bold"
                  placeholder="e.g. Mobile App"
                  value={newProject.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 5).toUpperCase();
                    setNewProject({ ...newProject, name, slug });
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Slug (Key)</label>
                <input
                  required
                  type="text"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 text-lg font-bold uppercase"
                  placeholder="e.g. MOB"
                  value={newProject.slug}
                  onChange={(e) => setNewProject({ ...newProject, slug: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
