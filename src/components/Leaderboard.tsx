import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../lib/firebase';
import { User } from '../types';
import { ArrowLeft, Loader2, Trophy, Medal, Star } from 'lucide-react';
import { GoToTop } from './GoToTop';

export function Leaderboard({ onBack, onUserClick }: { onBack: () => void, onUserClick?: (userId: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = React.useRef(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
      if (isHeaderVisible) setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY.current) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
    }
    lastScrollY.current = currentScrollY;
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getLeaderboard();
        setUsers(data as User[]);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div ref={scrollRef} className="w-full bg-white h-full flex flex-col font-sans overflow-y-auto" onScroll={handleScroll}>
      <div className={`p-6 md:p-10 border-b border-black flex items-center gap-6 sticky top-0 bg-white z-10 justify-between transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 border border-black hover:bg-black hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Impact</span>
            <h2 className="text-3xl font-light tracking-tighter uppercase leading-none">Leaderboard</h2>
          </div>
        </div>
      </div>

      <div className="flex-grow p-6 md:p-10">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={32} className="animate-spin text-black" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 border border-black p-8 max-w-xl mx-auto">
            <Trophy size={48} className="mx-auto mb-4" />
            <p className="font-bold uppercase tracking-widest text-sm">No Contributors Yet</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {users.map((user, index) => (
              <button 
                key={user.id} 
                onClick={() => onUserClick && onUserClick(user.id)}
                className={`p-6 border border-black flex items-center justify-between text-left transition-colors ${index === 0 ? 'bg-black text-white' : 'bg-white hover:bg-black/5'} ${onUserClick ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 flex items-center justify-center border ${index === 0 ? 'border-white' : 'border-black'} font-black text-xl`}>
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg uppercase tracking-tight">{user.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 border ${index === 0 ? 'border-white/50' : 'border-black/20'}`}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-8">
                  {user.badges && user.badges.length > 0 && (
                    <div className="hidden md:flex gap-2">
                      {user.badges.map(badge => (
                        <div key={badge} className={`p-2 border ${index === 0 ? 'border-white' : 'border-black'} flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest`} title={badge}>
                          {badge === 'Community Hero' ? <Star size={14} /> : <Medal size={14} />}
                          <span className="hidden lg:inline">{badge}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-right">
                    <span className="block text-3xl font-light leading-none">{user.points || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Points</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <GoToTop containerRef={scrollRef} />
    </div>
  );
}
