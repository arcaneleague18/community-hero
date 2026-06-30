import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Complaint } from '../types';
import { Bell, X } from 'lucide-react';

interface Notification {
  id: string;
  complaintId: string;
  message: string;
  timestamp: Date;
}

export function LocalNotifications({ currentUser }: { currentUser: User | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const previousStatusMap = useRef<Record<string, string>>({});
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Citizen') return;

    const complaintsRef = collection(db, "complaints");
    const q = query(complaintsRef, where("userId", "==", currentUser.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data() as Complaint;
        const currentStatus = data.status;
        const prevStatus = previousStatusMap.current[change.doc.id];
        
        if (change.type === 'added') {
            previousStatusMap.current[change.doc.id] = currentStatus;
        }

        if (change.type === 'modified') {
          if (prevStatus && prevStatus !== currentStatus) {
            const newNotification: Notification = {
              id: Date.now().toString() + Math.random().toString(),
              complaintId: change.doc.id,
              message: `Your report near ${data.landmark || 'a tracked location'} was updated to ${currentStatus.toUpperCase()}.`,
              timestamp: new Date()
            };
            setNotifications(prev => [newNotification, ...prev]);
            
            // Auto dismiss after 8 seconds
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
            }, 8000);
          }
          previousStatusMap.current[change.doc.id] = currentStatus;
        }
      });
      initialLoadDone.current = true;
    });

    return () => unsubscribe();
  }, [currentUser]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (!currentUser) return null;

  return (
    <div className="fixed top-24 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 md:px-0">
      <AnimatePresence>
        {notifications.map(notif => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="bg-black text-white p-4 shadow-xl flex items-start gap-4 border border-white/20"
          >
            <div className="mt-0.5"><Bell size={18} className="text-white" /></div>
            <div className="flex-grow">
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-1 text-white/70">Update Alert</h4>
              <p className="text-sm font-medium">{notif.message}</p>
            </div>
            <button onClick={() => removeNotification(notif.id)} className="opacity-50 hover:opacity-100 transition-opacity">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
