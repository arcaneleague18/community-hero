import React, { useEffect, useState } from 'react';
import { getComplaints, toggleUpvoteComplaint } from '../lib/firebase';
import { Complaint, User } from '../types';
import { ArrowLeft, Loader2, MapPin, Clock, AlertCircle, ArrowUp, Filter, X, Map as MapIcon, List, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { IssuesMap } from './IssuesMap';
import { GoToTop } from './GoToTop';

export function Dashboard({ onBack, currentUser, showOnlyUserContributions = false, showOnlyUserVerifications = false, targetUserIdForContributions }: { onBack: () => void, currentUser: User | null, showOnlyUserContributions?: boolean, showOnlyUserVerifications?: boolean, targetUserIdForContributions?: string }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [users, setUsers] = useState<Record<string, User>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [focusLocation, setFocusLocation] = useState<{ lat: number, lng: number } | undefined>(undefined);
  
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = React.useRef(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
      // Scrolling down
      if (isHeaderVisible) setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY.current) {
      // Scrolling up
      if (!isHeaderVisible) setIsHeaderVisible(true);
    }
    lastScrollY.current = currentScrollY;
  };

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const [data, allUsersData] = await Promise.all([
          getComplaints(),
          import('../lib/firebase').then(m => m.getAllUsers())
        ]);
        setComplaints(data as Complaint[]);
        
        const usersMap: Record<string, User> = {};
        allUsersData.forEach((u: any) => {
          usersMap[u.id] = u as User;
        });
        setUsers(usersMap);
      } catch (error) {
        console.error("Error fetching complaints or users:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const handleToggleUpvote = async (complaint: Complaint) => {
    if (!currentUser) return;
    if (currentUser.role === 'Verifier') return; // Verifiers cannot upvote
    if (complaint.userId === currentUser.id) return; // Cannot upvote own issue
    
    const hasUpvoted = complaint.upvotedBy?.includes(currentUser.id) || false;
    
    try {
      await toggleUpvoteComplaint(complaint.id, currentUser.id, hasUpvoted);
      setComplaints(complaints.map(c => {
        if (c.id === complaint.id) {
          const newUpvotedBy = hasUpvoted 
            ? (c.upvotedBy || []).filter(id => id !== currentUser.id)
            : [...(c.upvotedBy || []), currentUser.id];
          return { ...c, upvotedBy: newUpvotedBy };
        }
        return c;
      }));
    } catch (error) {
      console.error("Error toggling upvote:", error);
    }
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
            userName: c.userId && users[c.userId] ? users[c.userId].name : 'Unknown' 
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

  const filteredComplaints = complaints.filter(c => 
    (!showOnlyUserContributions || (targetUserIdForContributions ? c.userId === targetUserIdForContributions : c.userId === currentUser?.id)) &&
    (!showOnlyUserVerifications || (c.statusUpdatedBy?.includes(currentUser?.id || ''))) &&
    (searchResults === null || searchResults.includes(c.id))
  );

  return (
    <div ref={scrollRef} className="w-full bg-white h-full flex flex-col overflow-y-auto" onScroll={handleScroll}>
      <div className={`p-6 md:p-10 border-b border-black flex flex-col gap-6 sticky top-0 bg-white z-10 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="p-2 border border-black hover:bg-black hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Archive</span>
              <h2 className="text-xl md:text-3xl font-light tracking-tighter uppercase leading-none">
                {showOnlyUserVerifications ? "My Verifications" : showOnlyUserContributions ? "My Contributions" : "Community Issues"}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-black">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
              >
                <List size={16} /> <span className="hidden md:inline" style={{ width: '87.38499999999999px' }}>List</span>
              </button>
              <button 
                onClick={() => { setFocusLocation(undefined); setViewMode('map'); }}
                className={`p-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors border-l border-black ${viewMode === 'map' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
              >
                <MapIcon size={16} /> <span className="hidden md:inline" style={{ width: '104.552px' }}>Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`flex-grow ${viewMode === 'map' ? '' : 'p-6 md:p-10'}`}>
        {/* Search */}
        <div className="mb-6">
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

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={32} className="animate-spin text-black" />
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="text-center py-20 border border-black p-8 max-w-xl mx-auto mt-6">
            <AlertCircle size={48} className="mx-auto mb-4" />
            <p className="font-bold uppercase tracking-widest text-sm">No Active Reports</p>
          </div>
        ) : viewMode === 'map' ? (
          <div className="w-full h-[calc(100vh-140px)] min-h-[500px]">
            <IssuesMap complaints={filteredComplaints} focusLocation={focusLocation} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredComplaints.map((complaint) => (
              <div key={complaint.id} className="border border-black group bg-white flex flex-col">
                <div className="w-full aspect-video border-b border-black overflow-hidden bg-black/5">
                  {complaint.imageBase64 ? (
                    complaint.imageBase64.startsWith('data:video') ? (
                      <video src={complaint.imageBase64} className="w-full h-full object-cover grayscale transition-all duration-500" controls />
                    ) : (
                      <img src={complaint.imageBase64} alt="Issue" className="w-full h-full object-cover grayscale transition-all duration-500" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-black/20">
                      <AlertCircle size={32} />
                    </div>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6 border-b border-black pb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-black text-white text-[9px] font-bold uppercase tracking-widest">
                          {complaint.status}
                        </span>
                        {complaint.category && (
                          <span className="px-2 py-1 border border-black text-black text-[9px] font-bold uppercase tracking-widest">
                            {complaint.category}
                          </span>
                        )}
                      </div>
                      {complaint.createdAt && (
                        <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                          <Clock size={12} />
                          {formatDistanceToNow(complaint.createdAt.toDate(), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-sm leading-relaxed mb-6 line-clamp-3">
                      {complaint.description || 'No description provided.'}
                    </p>
                    {complaint.status === 'Rejected' && complaint.rejectionReason && (
                      <div className="bg-red-50 border border-red-200 p-3 mb-6">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-red-600 block mb-1">Rejection Reason</span>
                        <p className="text-xs text-red-800">{complaint.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 pt-4 border-t border-black">
                    {complaint.userId && users[complaint.userId] && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold">
                          {users[complaint.userId].name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">{users[complaint.userId].name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => {
                          setFocusLocation({ lat: complaint.latitude, lng: complaint.longitude });
                          setViewMode('map');
                        }}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest flex-1 min-w-0 pr-4 hover:underline text-left"
                      >
                        <MapPin size={14} className="shrink-0" />
                        <span className="truncate">
                          {complaint.region || complaint.landmark || `${complaint.latitude.toFixed(4)}, ${complaint.longitude.toFixed(4)}`}
                        </span>
                      </button>
                      <button 
                        onClick={() => handleToggleUpvote(complaint)}
                        disabled={!currentUser || currentUser.role === 'Verifier' || complaint.userId === currentUser.id}
                        className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed ${complaint.upvotedBy?.includes(currentUser?.id || '') ? 'text-black' : 'text-black/50'}`}
                      >
                        <ArrowUp size={14} className={complaint.upvotedBy?.includes(currentUser?.id || '') ? 'text-black' : 'text-black/50'} />
                        {complaint.upvotedBy?.length || 0}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <GoToTop containerRef={scrollRef} />
    </div>
  );
}
