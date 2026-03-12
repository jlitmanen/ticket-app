import React from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Login from "./components/Login";
import ProjectList from "./components/ProjectList";
import Kanban from "./components/Kanban";
import Reporter from "./components/Reporter";
import Notifications from "./components/Notifications";

function PrivateLayout() {
  const { isValid, logout, user } = useAuth();
  const location = useLocation();

  if (!isValid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       <header className="bg-white border-b border-slate-100 p-4 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Butter</h1>
          </div>
          <div className="flex items-center gap-4">
            <Notifications />
            <span className="text-sm font-bold text-slate-500">{user?.email}</span>
            <button 
              onClick={logout}
              className="px-4 py-2 bg-slate-100 text-slate-800 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/report/:token" element={<Reporter />} />
      
      <Route element={<PrivateLayout />}>
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:id" element={<Kanban />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
