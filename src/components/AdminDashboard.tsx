import React, { useEffect, useState } from 'react';
import { getComplaints, getAllUsers, updateUserRole, deleteUser } from '../lib/firebase';
import { Complaint, User, Role } from '../types';
import { ArrowLeft, Loader2, MapPin, CheckCircle, Clock, AlertCircle, Shield, Trash2, X, Settings, Search, List, Map as MapIcon, Ban } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { IssuesMap } from './IssuesMap';
import { GoToTop } from './GoToTop';

export function AdminDashboard({ onBack, currentUser }: { onBack: () => void, currentUser: User | null }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'issues' | 'users'>('users');
  const [isTabsExpanded, setIsTabsExpanded] = useState(true); // Expanded by default

  const [selectedRole, setSelectedRole] = useState('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<string[] | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [focusLocation, setFocusLocation] = useState<{ lat: number, lng: number } | undefined>(undefined);

  const [userToBan, setUserToBan] = useState<string | null>(null);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [complaintsData, usersData] = await Promise.all([
        getComplaints(),
        getAllUsers()
      ]);
      setComplaints(complaintsData as Complaint[]);
      setUsers(usersData as User[]);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error("Error updating user role:", error);
      setErrorMessage("Failed to update user role.");
    }
  };

  const confirmBanUser = async () => {
    if (!userToBan) return;
    try {
      await updateUserRole(userToBan, 'Banned' as Role);
      setUsers(users.map(u => u.id === userToBan ? { ...u, role: 'Banned' as Role } : u));
      setUserToBan(null);
    } catch (error) {
      console.error("Error banning user:", error);
      setErrorMessage("Failed to ban user.");
      setUserToBan(null);
    }
  };

  const confirmRemoveUser = async () => {
    if (!userToRemove) return;
    try {
      await deleteUser(userToRemove);
      setUsers(users.filter(u => u.id !== userToRemove));
      setUserToRemove(null);
    } catch (error) {
      console.error("Error removing user:", error);
      setErrorMessage("Failed to remove user.");
      setUserToRemove(null);
    }
  };

  const handleBanUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.role === 'Admin') {
      setErrorMessage("Cannot ban an Administrator.");
      return;
    }
    setUserToBan(userId);
  };

  const handleRemoveUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.role === 'Admin') {
      setErrorMessage("Cannot remove an Administrator.");
      return;
    }
    setUserToRemove(userId);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery, 
          issues: complaints.map(c => ({ 
            ...c, 
            userName: c.userId ? users.find(u => u.id === c.userId)?.name || 'Unknown' : 'Unknown' 
          })) 
        })
      });
      const data = await response.json();
      if (data.matchedIds) {
        setSearchResults(data.matchedIds);
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const roles = ['All', 'Citizen', 'Verifier', 'Admin'];

  const filteredUsers = users.filter(u => selectedRole === 'All' || u.role === selectedRole);
  const filteredComplaints = complaints.filter(c => 
    (searchResults === null || searchResults.includes(c.id))
  );

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="w-full bg-white min-h-screen flex flex-col p-10 text-center items-center justify-center">
        <AlertCircle size={48} className="mb-4 text-red-500" />
        <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Access Denied</h2>
        <p className="mb-8 font-medium">Administrator privileges required to view this module.</p>
        <button onClick={onBack} className="p-4 bg-black text-white font-bold uppercase tracking-widest text-xs hover:bg-black/90">Return Home</button>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="w-full bg-white h-full flex flex-col font-sans overflow-y-auto" onScroll={handleScroll}>
      <div className={`p-6 md:p-10 border-b border-black flex flex-col gap-6 sticky top-0 bg-white z-10 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="p-2 border border-black hover:bg-black hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Command Center</span>
              <h2 className="text-xl md:text-3xl font-light tracking-tighter uppercase leading-none">Admin Dashboard</h2>
            </div>
          </div>
          <button 
            onClick={() => setIsTabsExpanded(!isTabsExpanded)}
            className="flex items-center gap-2 p-2 md:px-4 md:py-2 border border-black hover:bg-black hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest shrink-0"
          >
            {isTabsExpanded ? (
              <><X size={16} /> <span className="hidden md:inline">Minimize</span></>
            ) : (
              <><Settings size={16} /> <span className="hidden md:inline">{activeTab === 'users' ? 'User Management' : 'All System Issues'}</span></>
            )}
          </button>
        </div>
        
        {isTabsExpanded && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest border border-black transition-colors flex items-center gap-2 ${
                  activeTab === 'users' ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/10'
                }`}
              >
                <Shield size={14} /> User Management
              </button>
              <button
                onClick={() => setActiveTab('issues')}
                className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest border border-black transition-colors flex items-center gap-2 ${
                  activeTab === 'issues' ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/10'
                }`}
              >
                <AlertCircle size={14} /> All System Issues
              </button>
            </div>
            
            {activeTab === 'users' ? (
              <div className="flex flex-col md:flex-row gap-4 mt-2 border-t border-black/10 pt-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest">Role Filter</label>
                  <select 
                    value={selectedRole} 
                    onChange={e => setSelectedRole(e.target.value)}
                    className="p-3 border border-black bg-white text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-black"
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 mt-2 border-t border-black/10 pt-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex flex-col gap-2 ml-auto">
                    <label className="text-[9px] font-bold uppercase tracking-widest">View Mode</label>
                    <div className="flex border border-black">
                      <button 
                        onClick={() => setViewMode('list')}
                        className={`p-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
                      >
                        <List size={14} /> <span className="hidden md:inline">List</span>
                      </button>
                      <button 
                        onClick={() => { setFocusLocation(undefined); setViewMode('map'); }}
                        className={`p-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors border-l border-black ${viewMode === 'map' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
                      >
                        <MapIcon size={14} /> <span className="hidden md:inline">Map</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`flex-grow ${activeTab === 'issues' && viewMode === 'map' ? '' : 'p-6 md:p-10'}`}>
        {/* Search for Issues Tab */}
        {activeTab === 'issues' && (
          <div className={`mb-6 ${viewMode === 'map' ? 'p-6 md:p-10 pb-0' : ''}`}>
            <form onSubmit={handleSearch} className="flex flex-row gap-2 w-full max-w-md">
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="AI Search (e.g. 'show me dirty roads')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-2 pl-8 border border-black bg-white text-xs focus:outline-none focus:ring-1 focus:ring-black"
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              <button 
                type="submit" 
                disabled={isSearching}
                className="px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                Search
              </button>
              {searchResults !== null && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                  className="px-4 py-2 border border-black text-black text-[10px] font-bold uppercase tracking-widest hover:bg-gray-100"
                >
                  Clear
                </button>
              )}
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={32} className="animate-spin text-black" />
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-6">
            {filteredUsers.map(user => (
              <div key={user.id} className="border border-black p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold">{user.name}</h3>
                  <p className="text-sm opacity-60 font-mono mt-1">ID: {user.id}</p>
                </div>
                
                <div className="flex flex-row items-center gap-4 w-full md:w-auto">
                  <div className="flex flex-col gap-1 flex-1 md:w-48">
                    <label className="text-[9px] font-bold uppercase tracking-widest">Role</label>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                      disabled={user.id === currentUser.id}
                      className="p-3 border border-black bg-white text-sm focus:outline-none uppercase tracking-widest font-bold disabled:opacity-50 w-full"
                    >
                      <option value="Citizen">Citizen</option>
                      <option value="Verifier">Verifier</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  
                  {user.id !== currentUser.id && user.role !== 'Admin' && (
                    <div className="flex gap-2 self-end shrink-0">
                      {user.role !== 'Banned' && (
                        <button 
                          onClick={() => handleBanUser(user.id)}
                          className="p-3 border border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white transition-colors"
                          title="Ban User"
                        >
                          <Ban size={20} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleRemoveUser(user.id)}
                        className="p-3 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                        title="Remove User"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-10 opacity-50 font-bold tracking-widest uppercase text-xs">No users found for this filter.</div>
            )}
          </div>
        ) : activeTab === 'issues' && viewMode === 'map' ? (
          <div className="w-full h-[calc(100vh-140px)] min-h-[500px]">
            <IssuesMap complaints={filteredComplaints} focusLocation={focusLocation} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {filteredComplaints.map((complaint) => {
              const reporter = users.find(u => u.id === complaint.userId);
              return (
              <div key={complaint.id} className="border border-black group bg-white flex flex-col">
                <div className="p-6 border-b border-black flex justify-between items-start">
                  <div>
                    <span className="px-2 py-1 bg-black text-white text-[9px] font-bold uppercase tracking-widest mb-2 inline-block">
                      {complaint.status}
                    </span>
                    <p className="font-mono text-sm line-clamp-2">
                      {complaint.description || 'No description provided.'}
                    </p>
                  </div>
                  {complaint.createdAt && (
                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shrink-0 text-black/60">
                      <Clock size={12} />
                      {formatDistanceToNow(complaint.createdAt.toDate(), { addSuffix: true })}
                    </span>
                  )}
                </div>
                
                <button 
                  onClick={() => {
                    setFocusLocation({ lat: complaint.latitude, lng: complaint.longitude });
                    setViewMode('map');
                  }}
                  className="p-4 bg-black/5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest border-b border-black hover:bg-black/10 transition-colors w-full text-left"
                >
                  <MapPin size={14} className="shrink-0" />
                  <span className="truncate">
                    {complaint.region || complaint.landmark || `${complaint.latitude.toFixed(4)}, ${complaint.longitude.toFixed(4)}`}
                  </span>
                </button>

                <div className="p-6 flex flex-col gap-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest flex flex-col gap-1 border border-black p-3 bg-white/50">
                    <span className="opacity-60">Reported By:</span>
                    <span className="text-sm">{reporter?.name || 'Unknown User'}</span>
                    <span className="font-mono opacity-80">{reporter?.email || complaint.userId}</span>
                  </div>
                  
                  {complaint.assignedTo && (
                    <div className="text-[10px] font-bold uppercase tracking-widest p-3 border border-black bg-white/50">
                      Assigned To: {complaint.assignedTo}
                    </div>
                  )}
                  {complaint.imageBase64 && (
                    complaint.imageBase64.startsWith('data:video') ? (
                      <video src={complaint.imageBase64} className="w-full h-32 object-cover border border-black mt-2" controls />
                    ) : (
                      <img src={complaint.imageBase64} alt="Issue" className="w-full h-32 object-cover border border-black mt-2" />
                    )
                  )}
                </div>
              </div>
            )})}
            {filteredComplaints.length === 0 && (
              <div className="text-center py-10 opacity-50 font-bold tracking-widest uppercase text-xs lg:col-span-2">No issues found for this filter.</div>
            )}
          </div>
        )}
      </div>

      {/* Ban Confirmation Modal */}
      {userToBan && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-orange-600 p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
            <div className="flex items-center gap-3 text-orange-600 font-bold uppercase tracking-widest text-sm border-b border-orange-200 pb-4">
              <AlertCircle size={24} /> 
              <span>Confirm Ban</span>
            </div>
            <p className="text-base font-medium text-gray-900 leading-relaxed">
              Are you sure you want to ban this user? They will not be able to access the system.
            </p>
            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setUserToBan(null)}
                className="flex-1 p-4 border border-black text-black font-bold uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={confirmBanUser}
                className="flex-1 p-4 bg-orange-600 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-orange-700 transition-colors"
              >
                Ban User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {userToRemove && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-600 p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
            <div className="flex items-center gap-3 text-red-600 font-bold uppercase tracking-widest text-sm border-b border-red-200 pb-4">
              <AlertCircle size={24} /> 
              <span>Confirm Remove</span>
            </div>
            <p className="text-base font-medium text-gray-900 leading-relaxed">
              Are you sure you want to permanently remove this user? This action cannot be undone.
            </p>
            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setUserToRemove(null)}
                className="flex-1 p-4 border border-black text-black font-bold uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={confirmRemoveUser}
                className="flex-1 p-4 bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors"
              >
                Remove User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorMessage && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-600 p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
            <div className="flex items-center gap-3 text-red-600 font-bold uppercase tracking-widest text-sm border-b border-red-200 pb-4">
              <AlertCircle size={24} /> 
              <span>Error</span>
            </div>
            <p className="text-base font-medium text-gray-900 leading-relaxed">
              {errorMessage}
            </p>
            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setErrorMessage(null)}
                className="w-full p-4 border border-black text-black font-bold uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <GoToTop containerRef={scrollRef} />
    </div>
  );
}

