"use client";

import React, { createContext, useContext, useState } from 'react';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
    id: string;
    type: NotificationType;
    message: string;
}

interface NotificationContextType {
    notifications: Notification[];
    showNotification: (type: NotificationType, message: string) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const showNotification = (type: NotificationType, message: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { id, type, message }]);
        setTimeout(() => removeNotification(id), 5000);
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ notifications, showNotification, removeNotification }}>
            {children}
            {/* Toast Render Area */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className={`px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md animate-slide-up flex items-center gap-3 min-w-[300px] ${n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            n.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                                'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                            }`}
                    >
                        <span className="text-xl">{n.type === 'success' ? '✅' : n.type === 'error' ? '🚫' : 'ℹ️'}</span>
                        <div className="flex-1 text-sm font-medium">{n.message}</div>
                        <button onClick={() => removeNotification(n.id)} className="opacity-50 hover:opacity-100">✕</button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within NotificationProvider');
    return context;
};
