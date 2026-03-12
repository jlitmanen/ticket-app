import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import pb from "../api/pocketbase";
import { CheckCircle, AlertCircle } from "lucide-react";

export default function Reporter() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("bug");
  const [files, setFiles] = useState([]);

  useEffect(() => {
    // In a real implementation, we would validate the token and fetch project details
    // For now, we'll simulate a fetch or try to find a project with this token if we have backend logic
    // But since backend logic for token lookup isn't standard in PB without custom endpoints or filters,
    // we might need to rely on a specific collection or just assume it's valid for this UI demo if the backend isn't fully ready.
    
    // However, the spec says: "Look up reporters by (project, email)".
    // The token is on the project: `reporter_intake_token`.
    // We can try to find the project by this token if we have public access, or use a custom endpoint.
    // Let's assume there's a custom endpoint or we can filter projects (if public).
    // If not, we'll just show the form and let the submit handle errors.
    
    const checkToken = async () => {
        try {
            // Attempt to find project by token. 
            // NOTE: This requires the 'projects' collection to be publicly readable with a filter, 
            // or a custom endpoint. We'll assume a standard list for now.
             const result = await pb.collection("projects").getFirstListItem(`reporter_intake_token="${token}"`, {
                 requestKey: null
             });
             setProject(result);
             setLoading(false);
        } catch (err) {
             console.error("Invalid token or project not found", err);
             setError("Invalid or expired reporter token.");
             setLoading(false);
        }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!project) return;

    try {
      // 1. Check/Create Reporter (This logic usually lives in backend for security, but we can try client-side if allowed)
      // The spec says "Reporter deduplication: ... Look up existing reporters record ... If not found, create".
      // We'll try to find a reporter with this email and project.
      
      let reporterId;
      try {
          const existingReporter = await pb.collection("reporters").getFirstListItem(`email="${email}" && project="${project.id}"`);
          reporterId = existingReporter.id;
      } catch (err) {
          // Not found, create new
          const newReporter = await pb.collection("reporters").create({
              project: project.id,
              name,
              email,
          });
          reporterId = newReporter.id;
      }

      // 2. Create Ticket
      const formData = new FormData();
      formData.append("project", project.id);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("type", type);
      formData.append("status", "backlog");
      formData.append("reporter_ext", reporterId); // Link to reporter
      
      // Attachments
      for (let i = 0; i < files.length; i++) {
          formData.append("attachments", files[i]);
      }

      await pb.collection("tickets").create(formData);
      
      setSuccess(true);
      setTitle("");
      setDescription("");
      setFiles([]);
    } catch (err) {
      console.error(err);
      setError("Failed to submit ticket: " + err.message);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;
  if (success) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-xl">
                  <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2">Ticket Submitted!</h2>
                  <p className="text-slate-500 mb-8">
                      Thanks for your report. We've sent a confirmation email to <strong>{email}</strong> with a link to track your ticket.
                  </p>
                  <button 
                    onClick={() => setSuccess(false)}
                    className="w-full py-4 bg-slate-100 text-slate-800 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                  >
                      Submit Another
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-slate-200/50">
        <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter mb-2">{project.name} Support</h1>
            <p className="text-slate-500 font-medium">Submit a bug report or feature request directly to the team.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Your Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Email Address</label>
                <input
                  required
                  type="email"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Ticket Type</label>
            <div className="flex gap-4">
                {['bug', 'question', 'other'].map(t => (
                    <label key={t} className={`
                        flex-1 py-3 px-4 rounded-xl border-2 cursor-pointer transition-all font-bold text-center capitalize
                        ${type === t 
                            ? 'border-slate-900 bg-slate-900 text-white' 
                            : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'}
                    `}>
                        <input 
                            type="radio" 
                            name="type" 
                            value={t} 
                            checked={type === t} 
                            onChange={e => setType(e.target.value)} 
                            className="hidden"
                        />
                        {t}
                    </label>
                ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Title</label>
            <input
              required
              type="text"
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-lg"
              placeholder="Brief summary of the issue"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Description</label>
            <textarea
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-medium min-h-[150px]"
              placeholder="Detailed explanation..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Attachments</label>
            <input
              type="file"
              multiple
              onChange={e => setFiles(e.target.files)}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 mt-4"
          >
            Submit Ticket
          </button>
        </form>
      </div>
    </div>
  );
}
