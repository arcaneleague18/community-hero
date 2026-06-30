import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Award } from 'lucide-react';
import { User } from '../types';
import { getLeaderboard } from '../lib/firebase'; // We can just fetch user data or pass it from App

export function PointsHistory({ onBack, currentUser }: { onBack: () => void, currentUser: User | null }) {
  const [user, setUser] = useState<User | null>(currentUser);

  useEffect(() => {
    // If we want the freshest data, fetch it.
    const fetchUser = async () => {
      if (currentUser) {
        const lb = await getLeaderboard();
        const me = lb.find((u: any) => u.id === currentUser.id);
        if (me) setUser(me as User);
      }
    };
    fetchUser();
  }, [currentUser]);

  const history = user?.pointsHistory || [];
  const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="w-full bg-white h-full flex flex-col font-sans overflow-y-auto">
      <div className="p-6 md:p-10 border-b border-black flex items-center gap-6 sticky top-0 bg-white z-10 justify-between">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 border border-black hover:bg-black hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Impact</span>
            <h2 className="text-3xl font-light tracking-tighter uppercase leading-none">Points History</h2>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Total Points</span>
          <div className="text-3xl font-light leading-none">{user?.points || 0}</div>
        </div>
      </div>

      <div className="flex-grow p-6 md:p-10">
        {sortedHistory.length === 0 ? (
          <div className="text-center py-20 border border-black p-8 max-w-xl mx-auto">
            <Clock size={48} className="mx-auto mb-4" />
            <p className="font-bold uppercase tracking-widest text-sm">No points history yet</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {sortedHistory.map((entry, index) => (
              <div 
                key={index} 
                className="p-6 border border-black flex items-center justify-between text-left bg-white"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 flex items-center justify-center border border-black font-black text-xl ${entry.amount > 0 ? 'bg-green-100 text-green-800 border-green-800' : 'bg-red-100 text-red-800 border-red-800'}`}>
                    {entry.amount > 0 ? '+' : ''}{entry.amount}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg uppercase tracking-tight">{entry.reason}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 border border-black/20 text-black/60">
                        {new Date(entry.date).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
