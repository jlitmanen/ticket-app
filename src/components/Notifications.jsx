import React, { useState, useEffect } from "react";
import pb from "../api/pocketbase";
import { Bell, Check, X } from "lucide-react";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();

    // Realtime subscription
    // Use recipient instead of user
    pb.collection("notifications").subscribe("*", (e) => {
      if (e.action === "create") {
        setNotifications((prev) => [e.record, ...prev]);
        setUnreadCount((prev) => prev + 1);
      } else if (e.action === "update") {
        setNotifications((prev) =>
          prev.map((n) => (n.id === e.record.id ? e.record : n))
        );
      }
    });

    return () => pb.collection("notifications").unsubscribe("*");
  }, []);

  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length);
  }, [notifications]);

  const loadNotifications = async () => {
    try {
      const result = await pb.collection("notifications").getList(1, 20, {
        sort: "-created",
        expand: "ticket",
      });
      setNotifications(result.items);
      setUnreadCount(result.items.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  const markAsRead = async (notification) => {
    try {
      if (notification.read) return;
      
      await pb.collection("notifications").update(notification.id, { read: true });
      
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => pb.collection("notifications").update(n.id, { read: true })));
      
      // Optimistic
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-slate-100 rounded-xl transition-colors relative"
      >
        <Bell size={20} className="text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm italic">
                  No notifications yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      onClick={() => markAsRead(notification)}
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1">
                             <div className={`w-2 h-2 rounded-full ${!notification.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                        </div>
                        <div className="flex-1">
                           <p className="text-sm text-slate-700 leading-snug mb-1">
                               {notification.message}
                           </p>
                           <p className="text-[10px] font-bold text-slate-400">
                               {new Date(notification.created).toLocaleString()}
                           </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
