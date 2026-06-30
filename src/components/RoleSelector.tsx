import React, { useState } from 'react';
import { User, Role } from '../types';
import { User as UserIcon, Shield, Star, Loader2 } from 'lucide-react';
import { createUser, getUser } from '../lib/firebase';

interface RoleSelectorProps {
  onSelect: (user: User) => void;
}

export function RoleSelector({ onSelect }: RoleSelectorProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Citizen');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);

    const userId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    try {
      let user = await getUser(userId);
      if (!user) {
        user = {
          id: userId,
          name,
          role,
          points: 0,
          badges: []
        };
        await createUser(user);
      } else {
        if (user.role === 'Banned') {
          alert("This account has been banned.");
          setIsLoading(false);
          return;
        }
        // Update role if changed
        if (user.role !== role) {
          user.role = role;
          await createUser(user);
        }
      }
      onSelect(user as User);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm font-sans">
      <div className="bg-white p-10 max-w-md w-full border border-black">
        <h2 className="text-3xl font-light tracking-tighter uppercase mb-2 text-center">System Access</h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-center opacity-60 mb-10">Select Identity Profile</p>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-widest">Operator Name</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-4 border border-black bg-white focus:outline-none text-sm font-medium"
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-widest">Authorization Level</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Citizen', 'Verifier', 'Admin'] as Role[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`p-4 flex flex-col items-center justify-center gap-2 border border-black transition-colors ${role === r ? 'bg-black text-white' : 'bg-white hover:bg-black/5'}`}
                >
                  {r === 'Citizen' && <UserIcon size={20} />}
                  {r === 'Verifier' && <Star size={20} />}
                  {r === 'Admin' && <Shield size={20} />}
                  <span className="text-[9px] font-bold uppercase tracking-widest mt-2">{r}</span>
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full p-6 bg-black text-white font-bold uppercase tracking-widest text-sm hover:bg-black/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
