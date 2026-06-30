import React, { useEffect, useState } from 'react';
import { getComplaints, updateComplaintStatus, toggleUpvoteComplaint, getAllUsers } from '../lib/firebase';
import { Complaint, User } from '../types';
import { ArrowLeft, Loader2, MapPin, Clock, AlertCircle, ArrowUp, CheckCircle, CheckSquare, User as UserIcon, Search, List, Map as MapIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, PanInfo } from 'motion/react';
import { IssuesMap } from './IssuesMap';
import { GoToTop } from './GoToTop';

export function VerifierDashboard({ onBack, currentUser }: { onBack: () => void, currentUser: User | null }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [focusLocation, setFocusLocation] = useState<{ lat: number, lng: number } | undefined>(undefined);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<string[] | null>(null);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

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
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const [complaintsData, usersData] = await Promise.all([
        getComplaints(),
        getAllUsers()
      ]);
      setComplaints(complaintsData as Complaint[]);
      const usersMap: Record<string, User> = {};
      usersData.forEach((u: any) => {
        usersMap[u.id] = u;
      });
      setUsers(usersMap);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string, reason?: string) => {
    if (newStatus === 'Rejected' && !reason) {
      setRejectingId(id);
      return;
    }
    try {
      await updateComplaintStatus(id, newStatus, currentUser?.name, currentUser?.id, reason);
      setComplaints(complaints.map(c => c.id === id ? { ...c, status: newStatus as any, assignedTo: currentUser?.name, rejectionReason: reason } : c));
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const submitRejection = async () => {
    if (rejectingId && rejectionReason.trim()) {
      await handleStatusChange(rejectingId, 'Rejected', rejectionReason.trim());
      setRejectingId(null);
      setRejectionReason("");
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

  if (currentUser?.role !== 'Verifier') {
    return (
      <div className="w-full bg-white min-h-screen flex flex-col p-10 text-center items-center justify-center">
        <AlertCircle size={48} className="mb-4 text-red-500" />
        <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Access Denied</h2>
        <p className="mb-8 font-medium">Verifier privileges required to view this module.</p>
        <button onClick={onBack} className="p-4 bg-black text-white font-bold uppercase tracking-widest text-xs hover:bg-black/90">Return Home</button>
      </div>
    );
  }

  // Filter for Verifier specific top section (Pending or Assigned to me)
  const verifierComplaints = complaints.filter(c => 
    (c.status === 'Pending' || c.assignedTo === currentUser.name) &&
    (searchResults === null || searchResults.includes(c.id))
  );

  const allFilteredComplaints = complaints.filter(c => 
    (searchResults === null || searchResults.includes(c.id))
  );

  const renderComplaintCard = (complaint: Complaint, showStatusUpdate: boolean) => (
    <div key={complaint.id} className="relative border border-black overflow-hidden bg-gray-100 group">
      {/* Swipe Background Actions */}
      {showStatusUpdate && (
        <div className="absolute inset-0 flex justify-between items-center px-8 z-0 font-bold tracking-widest text-sm uppercase pointer-events-none">
          <div className="flex flex-col items-start text-blue-600 opacity-70">
             <CheckSquare size={24} className="mb-2" />
             <span className="text-[10px]">Verify</span>
          </div>
          <div className="flex flex-col items-end text-green-600 opacity-70">
             <CheckCircle size={24} className="mb-2" />
             <span className="text-[10px]">Resolve</span>
          </div>
        </div>
      )}

      <motion.div
        drag={showStatusUpdate ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={(e, info) => {
          if (!showStatusUpdate) return;
          if (info.offset.x > 100) {
            handleStatusChange(complaint.id, 'Verified');
          } else if (info.offset.x < -100) {
            handleStatusChange(complaint.id, 'Resolved');
          }
        }}
        className="w-full h-full bg-white relative z-10 flex flex-col border-r border-l border-transparent"
      >
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
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shrink-0 text-black/60">
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
          
          <div className="flex flex-col gap-4 pt-4 border-t border-black">
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
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-black/60">
                  <ArrowUp size={12} />
                  <span>{complaint.upvotedBy?.length || 0}</span>
                </div>
                {complaint.userId && users[complaint.userId] && (
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-black/60">
                    <UserIcon size={12} />
                    <span>{users[complaint.userId].name}</span>
                  </div>
                )}
              </div>
            </div>
            
            {showStatusUpdate && (
              <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-black/10">
                <label className="text-[10px] font-bold uppercase tracking-widest flex justify-between">
                  <span>Update Status</span>
                  <span className="opacity-40 font-normal normal-case">Or swipe to quick resolve</span>
                </label>
                <select
                  value={complaint.status}
                  onChange={(e) => handleStatusChange(complaint.id, e.target.value)}
                  className="p-3 border border-black bg-white text-sm focus:outline-none"
                >
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div ref={scrollRef} className="w-full bg-white h-full flex flex-col font-sans overflow-y-auto" onScroll={handleScroll}>
      <div className={`p-6 md:p-10 border-b border-black flex flex-col gap-6 sticky top-0 bg-white z-10 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="p-2 border border-black hover:bg-black hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Verifier Area</span>
              <h2 className="text-xl md:text-3xl font-light tracking-tighter uppercase leading-none">Verification Center</h2>
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

      <div className="flex-grow flex flex-col gap-12 p-6 md:p-10">
        <div className="mb-2">
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
        ) : viewMode === 'map' ? (
          <div className="w-full h-[calc(100vh-140px)] min-h-[500px]">
            <IssuesMap complaints={allFilteredComplaints} focusLocation={focusLocation} />
          </div>
        ) : (
          <>
            <section>
              <h3 className="text-xl font-bold uppercase tracking-widest mb-6">Action Required</h3>
              {verifierComplaints.length === 0 ? (
                <div className="text-center py-10 border border-black p-8 max-w-xl">
                  <p className="font-bold uppercase tracking-widest text-sm">No Pending or Assigned Reports</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                  {verifierComplaints.map(c => renderComplaintCard(c, true))}
                </div>
              )}
            </section>

            <section className="pt-12 border-t border-black">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <h3 className="text-xl font-bold uppercase tracking-widest">All Community Issues</h3>
              </div>

              {allFilteredComplaints.length === 0 ? (
                <div className="text-center py-10 border border-black p-8 max-w-xl">
                  <p className="font-bold uppercase tracking-widest text-sm">No Reports Match Filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                  {allFilteredComplaints.map(c => renderComplaintCard(c, false))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-black p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
            <div className="flex items-center gap-3 text-red-600 font-bold uppercase tracking-widest text-sm border-b border-red-200 pb-4">
              <AlertCircle size={24} /> 
              <span>Provide Rejection Reason</span>
            </div>
            <p className="text-sm text-gray-900 leading-relaxed">
              Please specify why this report is being rejected. This will deduct points from the reporter.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Duplicate report, invalid image, not a civic issue..."
              className="w-full p-3 border border-black min-h-[100px] text-sm focus:outline-none"
            />
            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                className="flex-1 p-4 border border-black text-black font-bold uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={submitRejection}
                disabled={!rejectionReason.trim()}
                className="flex-1 p-4 bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Reject Report
              </button>
            </div>
          </div>
        </div>
      )}
      <GoToTop containerRef={scrollRef} />
    </div>
  );
}
