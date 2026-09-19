import React, { useState } from 'react';
import { User, Role } from '../types';
import { User as UserIcon, Loader2 } from 'lucide-react';
import { createUser, getUser, signInAnon } from '../lib/firebase';

interface RoleSelectorProps {
  onSelect: (user: User) => void;
}

export function RoleSelector({ onSelect }: RoleSelectorProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
    setError('');

    try {
      // Sign in anonymously to get a Firebase Auth UID
      const authUid = await signInAnon();

      // Check if this auth user already has a profile
      let user = await getUser(authUid);
      if (!user) {
        // New user -- always starts as Citizen.
        // Roles can only be elevated by an Admin through the Admin Dashboard.
        user = {
          id: authUid,
          name: name.trim(),
          role: 'Citizen' as Role,
          points: 0,
          badges: []
        };
        await createUser(user);
      } else {
        if (user.role === 'Banned') {
          setError("This account has been banned.");
          setIsLoading(false);
          return;
        }
        // Update display name if the user changed it
        if (user.name !== name.trim()) {
          user.name = name.trim();
          await createUser(user);
        }
      }
      onSelect(user as User);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm font-sans">
      <div className="bg-white p-10 max-w-md w-full border border-black">
        <h2 className="text-3xl font-light tracking-tighter uppercase mb-2 text-center">System Access</h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-center opacity-60 mb-10">Enter Your Name to Continue</p>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-widest">Your Name</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-4 border border-black bg-white focus:outline-none text-sm font-medium"
              placeholder="Enter your name"
            />
          </div>

          <div className="flex items-center gap-4 p-4 border border-black/20 bg-black/5">
            <UserIcon size={20} />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest block">Role: Citizen</span>
              <span className="text-[9px] uppercase tracking-widest opacity-60 block mt-1">Roles are assigned by administrators</span>
            </div>
          </div>

          {error && (
            <div className="p-4 border border-red-500 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full p-6 bg-black text-white font-bold uppercase tracking-widest text-sm hover:bg-black/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
