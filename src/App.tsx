/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CameraView } from './components/CameraView';
import { ComplaintForm } from './components/ComplaintForm';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { VerifierDashboard } from './components/VerifierDashboard';
import { Leaderboard } from './components/Leaderboard';
import { PointsHistory } from './components/PointsHistory';
import { RoleSelector } from './components/RoleSelector';
import { Chatbot } from './components/Chatbot';
import { GoToTop } from './components/GoToTop';
import { LocalNotifications } from './components/LocalNotifications';
import { useUserRegion } from './hooks/useUserRegion';
import { User, Complaint } from './types';
import { AlertTriangle, List, PlusCircle, CheckCircle, Shield, Trophy, User as UserIcon, CheckSquare, Menu, X, LogOut, MapPin, Loader2, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getComplaints } from './lib/firebase';

type ViewState = 'landing' | 'camera' | 'form' | 'dashboard' | 'admin' | 'verifier' | 'leaderboard' | 'success' | 'contributions' | 'verifications' | 'points_history';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showRoleSelector, setShowRoleSelector] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | undefined>(undefined);
  const [initialCategory, setInitialCategory] = useState<string>('All');
  const mainRef = React.useRef<HTMLElement>(null);
  
  const [trends, setTrends] = useState<{ category: string, region: string, count: number }[]>([]);
  const [prediction, setPrediction] = useState<string>('');

  const { region: detectedRegion, isLoading: isLoadingRegion } = useUserRegion();

  // Keep showing RoleSelector until user selects
  useEffect(() => {
    if (currentUser) setShowRoleSelector(false);
  }, [currentUser]);

  useEffect(() => {
    const loadTrends = async () => {
      try {
        const complaints = await getComplaints();
        if (complaints.length === 0) {
          setTrends([]);
          setPrediction("No current data available for predictive analysis.");
          return;
        }

        const counts: Record<string, { category: string, region: string, count: number }> = {};
        let dominantRegion = '';
        let maxRegionCount = 0;
        const regionCounts: Record<string, number> = {};

        complaints.forEach(c => {
          const key = `${c.category}-${c.region}`;
          if (!counts[key]) {
            counts[key] = { category: c.category, region: c.region || 'Unknown', count: 0 };
          }
          counts[key].count++;

          const r = c.region || 'Unknown';
          regionCounts[r] = (regionCounts[r] || 0) + 1;
          if (regionCounts[r] > maxRegionCount) {
            maxRegionCount = regionCounts[r];
            dominantRegion = r;
          }
        });

        const sortedTrends = Object.values(counts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 2);
        
        setTrends(sortedTrends);

        if (sortedTrends.length > 0) {
          setPrediction(`Increased reporting frequency of ${sortedTrends[0].category} in ${sortedTrends[0].region} suggests potential underlying infrastructural stress.`);
        }
      } catch (err) {
        console.error("Failed to load trends", err);
      }
    };
    loadTrends();
  }, [currentView]);

  const handleCapture = (imageSrc: string) => {
    setCapturedImage(imageSrc);
    setCurrentView('form');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowRoleSelector(true);
    setCurrentView('landing');
    setIsMobileMenuOpen(false);
  };

  const NavLinks = () => (
    <>
      {currentUser?.role === 'Citizen' && (
        <button onClick={() => { setCurrentView('landing'); setIsMobileMenuOpen(false); }} className={`text-[11px] font-bold tracking-widest uppercase ${currentView === 'landing' ? 'border-b-2 border-black' : 'opacity-40 hover:opacity-100'}`}>Home</button>
      )}
      {currentUser?.role === 'Verifier' && (
        <button onClick={() => { setCurrentView('verifier'); setIsMobileMenuOpen(false); }} className={`text-[11px] font-bold tracking-widest uppercase ${currentView === 'verifier' ? 'border-b-2 border-black' : 'opacity-40 hover:opacity-100'}`}>Verification Center</button>
      )}
      <button onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }} className={`text-[11px] font-bold tracking-widest uppercase ${currentView === 'dashboard' ? 'border-b-2 border-black' : 'opacity-40 hover:opacity-100'}`}>Issues</button>
      <button onClick={() => { setCurrentView('leaderboard'); setIsMobileMenuOpen(false); }} className={`text-[11px] font-bold tracking-widest uppercase ${currentView === 'leaderboard' ? 'border-b-2 border-black' : 'opacity-40 hover:opacity-100'}`}>Impact</button>
      {currentUser?.role === 'Admin' && (
        <button onClick={() => { setCurrentView('admin'); setIsMobileMenuOpen(false); }} className={`text-[11px] font-bold tracking-widest uppercase ${currentView === 'admin' ? 'border-b-2 border-black text-red-600' : 'text-red-600/60 hover:text-red-600'}`}>Command Center</button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-black flex flex-col overflow-hidden selection:bg-black selection:text-white">
      {showRoleSelector && (
        <RoleSelector onSelect={setCurrentUser} />
      )}

      {/* Header */}
      <header className="flex justify-between items-center px-6 md:px-10 py-6 md:py-8 border-b border-black">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-2 cursor-pointer" onClick={() => { setCurrentView('landing'); setIsMobileMenuOpen(false); }}>
            <span className="text-xl md:text-2xl font-black tracking-tighter uppercase italic">Community Hero</span>
            <span className="text-[10px] tracking-widest uppercase opacity-50 hidden md:inline-block">Hyperlocal Problem Solver</span>
          </div>
          
          {(isLoadingRegion || detectedRegion) && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-black/5 rounded-full border border-black/10">
              <MapPin size={12} className="opacity-70" />
              {isLoadingRegion ? (
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <Loader2 size={10} className="animate-spin" /> Locating...
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-widest">{detectedRegion}</span>
              )}
            </div>
          )}
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-8 items-center">
          <NavLinks />
          <div className="flex items-center gap-4 border-l border-black pl-4">
            <div className="flex items-center gap-2">
              <UserIcon size={14} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase">{currentUser?.name || 'Guest'}</span>
                <span className="text-[8px] font-bold uppercase opacity-60">{currentUser?.role || 'Unassigned'} • {currentUser?.points || 0} PTS</span>
              </div>
            </div>
            {currentUser && (
              <button onClick={handleLogout} className="text-red-600 hover:text-red-800 transition-colors" title="Log Out">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </nav>

        {/* Mobile Nav Toggle */}
        <button className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-[73px] left-0 right-0 bg-white border-b border-black z-40 p-6 flex flex-col gap-6"
          >
            {(isLoadingRegion || detectedRegion) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-black/5 rounded-lg border border-black/10">
                <MapPin size={14} className="opacity-70" />
                {isLoadingRegion ? (
                  <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Locating...
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-widest">{detectedRegion}</span>
                )}
              </div>
            )}
            <NavLinks />
            <div className="flex items-center justify-between border-t border-black/10 pt-4">
              <div className="flex items-center gap-2">
                <UserIcon size={14} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase">{currentUser?.name || 'Guest'}</span>
                  <span className="text-[8px] font-bold uppercase opacity-60">
                    {currentUser?.role || 'Unassigned'}
                    {currentUser?.role === 'Citizen' && ` • ${currentUser?.points || 0} PTS`}
                  </span>
                </div>
              </div>
              {currentUser && (
                <button onClick={handleLogout} className="text-red-600 hover:text-red-800 p-2 border border-red-200 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors">
                  <LogOut size={14} /> Log Out
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main ref={mainRef} className="flex-grow flex flex-col relative overflow-hidden overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentView === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col md:flex-row"
            >
              {/* Left Section: Action Hub */}
              <section className="w-full md:w-2/3 border-b md:border-b-0 md:border-r border-black flex flex-col bg-white overflow-hidden relative">
                {(!currentUser || currentUser.role === 'Citizen') ? (
                  <div className="flex-grow flex flex-col items-center justify-center w-full px-6 py-12 md:py-20 text-center overflow-y-auto overflow-x-hidden h-full">
                    {/* Arch of Images */}
                    <div className="relative w-full h-40 md:h-56 flex justify-center items-start mb-8 md:mb-12 mt-8">
                      {[
                        "/image1.jpeg", 
                        "/image2.jpeg", 
                        "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&q=80&w=200&h=200", 
                        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=200&h=200", 
                        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=200&h=200", 
                        "/image3.jpeg", 
                        "/image4.jpeg"
                      ].map((src, i) => {
                        const offset = i - 3; 
                        const rotate = offset * 12;
                        const translateY = Math.abs(offset) * 12 + (offset * offset * 2);
                        const translateX = offset * 45;
                        return (
                          <div 
                            key={i} 
                            className="absolute w-20 h-20 md:w-28 md:h-28 overflow-hidden shadow-lg border-2 md:border-4 border-white transition-transform hover:-translate-y-2 duration-300"
                            style={{
                              transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg)`,
                              transformOrigin: 'bottom center',
                              zIndex: 10 - Math.abs(offset)
                            }}
                          >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                    </div>

                    <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-gray-900 leading-tight">Build a Cleaner<br/>Community</h2>
                    <p className="text-gray-600 mb-10 max-w-sm text-sm md:text-base leading-relaxed">
                      Find, organize, and help resolve local issues.    Raise reports and track your impact.
                    </p>

                    <div className="flex flex-col w-full max-w-sm gap-4">
                      <button 
                        onClick={() => setCurrentView('camera')}
                        className="w-full py-4 px-6 bg-black text-white font-bold text-sm tracking-widest uppercase border border-black hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2"
                      >
                        <PlusCircle size={18} />
                        Raise Report
                      </button>
                      <button 
                        onClick={() => setCurrentView('dashboard')}
                        className="w-full py-4 px-6 bg-white text-black border border-black font-bold text-sm tracking-widest uppercase hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2"
                      >
                        <List size={18} />
                        Explore Issues
                      </button>
                      
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <button 
                          onClick={() => setCurrentView('leaderboard')}
                          className="w-full py-4 px-4 bg-white text-black border border-black font-bold text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors flex flex-col items-center justify-center gap-2"
                        >
                          <Trophy size={18} />
                          Leaderboard
                        </button>
                        <button 
                          onClick={() => { setTargetUserId(undefined); setCurrentView('contributions'); }}
                          className="w-full py-4 px-4 bg-white text-black border border-black font-bold text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors flex flex-col items-center justify-center gap-2"
                        >
                          <UserIcon size={18} />
                          My Contributions
                        </button>
                      </div>
                      <button 
                        onClick={() => setCurrentView('points_history')}
                        className="w-full py-3 px-4 bg-white text-black border border-black font-bold text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2"
                      >
                        <Clock size={16} />
                        Points History
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col w-full h-full">
                    <div className="flex-grow grid grid-cols-2">
                      {/* Action 1: Verify or Command Center */}
                      {currentUser?.role === 'Verifier' ? (
                        <button 
                          onClick={() => setCurrentView('verifier')}
                          className="group p-6 md:p-12 flex flex-col justify-between border-r border-black hover:bg-black hover:text-white transition-colors text-left"
                        >
                          <div>
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest block mb-4">Option 01</span>
                            <h2 className="text-3xl md:text-6xl font-light leading-none mb-4 md:mb-6 tracking-tighter">VERIFY<br/>REPORTS</h2>
                            <p className="text-[10px] md:text-sm opacity-60 max-w-[200px]">Review pending issues and update status.</p>
                          </div>
                          <div className="w-12 h-12 md:w-16 md:h-16 border border-black flex items-center justify-center group-hover:border-white mt-8 md:mt-0">
                            <CheckSquare className="w-5 h-5 md:w-6 md:h-6" />
                          </div>
                        </button>
                      ) : (
                        <button 
                          onClick={() => setCurrentView('admin')}
                          className="group p-6 md:p-12 flex flex-col justify-between border-r border-black hover:bg-black hover:text-white transition-colors text-left"
                        >
                          <div>
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest block mb-4">Option 01</span>
                            <h2 className="text-3xl md:text-6xl font-light leading-none mb-4 md:mb-6 tracking-tighter">SYSTEM<br/>CONTROL</h2>
                            <p className="text-[10px] md:text-sm opacity-60 max-w-[200px]">Manage users and system data.</p>
                          </div>
                          <div className="w-12 h-12 md:w-16 md:h-16 border border-black flex items-center justify-center group-hover:border-white mt-8 md:mt-0">
                            <Shield className="w-5 h-5 md:w-6 md:h-6" />
                          </div>
                        </button>
                      )}

                      {/* Action 2: Browse Archives */}
                      <button 
                        onClick={() => setCurrentView('dashboard')}
                        className="group p-6 md:p-12 flex flex-col justify-between hover:bg-black hover:text-white transition-colors text-left"
                      >
                        <div>
                          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest block mb-4">Option 02</span>
                          <h2 className="text-3xl md:text-6xl font-light leading-none mb-4 md:mb-6 tracking-tighter">EXPLORE<br/>ISSUES</h2>
                          <p className="text-[10px] md:text-sm opacity-60 max-w-[200px]">Review local reports and track progress.</p>
                        </div>
                        <div className="w-12 h-12 md:w-16 md:h-16 border border-black flex items-center justify-center group-hover:border-white mt-8 md:mt-0">
                          <List className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                      </button>
                    </div>

                    {/* Additional Buttons Grid */}
                    <div className="grid grid-cols-2 border-t border-black">
                        <button 
                          onClick={() => setCurrentView('leaderboard')}
                          className="group p-8 flex items-center justify-between border-r border-black hover:bg-black hover:text-white transition-colors text-left"
                        >
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Community</span>
                            <span className="text-xl font-medium tracking-tight">Leaderboard</span>
                          </div>
                          <Trophy size={20} className="opacity-50 group-hover:opacity-100" />
                        </button>
                        
                        {currentUser?.role === 'Admin' ? (
                          <button 
                            onClick={() => setCurrentView('admin')}
                            className="group p-8 flex items-center justify-between hover:bg-black hover:text-white transition-colors text-left bg-black/5"
                          >
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">System</span>
                              <span className="text-xl font-medium tracking-tight">Command Center</span>
                            </div>
                            <Shield size={20} className="opacity-50 group-hover:opacity-100" />
                          </button>
                        ) : currentUser?.role === 'Verifier' ? (
                          <button 
                            onClick={() => { setTargetUserId(undefined); setCurrentView('verifications'); }}
                            className="group p-8 flex items-center justify-between hover:bg-black hover:text-white transition-colors text-left"
                          >
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Identity</span>
                              <span className="text-xl font-medium tracking-tight">My Verifications</span>
                            </div>
                            <CheckSquare size={20} className="opacity-50 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setTargetUserId(undefined); setCurrentView('contributions'); }}
                            className="group p-8 flex items-center justify-between hover:bg-black hover:text-white transition-colors text-left"
                          >
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">Identity</span>
                              <span className="text-xl font-medium tracking-tight">My Contributions</span>
                            </div>
                            <UserIcon size={20} className="opacity-50 group-hover:opacity-100" />
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </section>

              {/* Right Section: Trends & Intelligence */}
              <aside className="w-full md:w-1/3 flex flex-col bg-white">
                <div className="p-8 border-b border-black flex-grow">
                  <span className="text-[10px] font-bold uppercase tracking-widest block mb-6">Regional Trends {detectedRegion ? `/ ${detectedRegion}` : ''}</span>
                  <div className="space-y-6">
                    {trends.length > 0 ? trends.map((trend, idx) => (
                      <button 
                        key={idx}
                        onClick={() => { setInitialCategory(trend.category); setCurrentView('dashboard'); }}
                        className="w-full flex justify-between items-end border-b border-gray-200 pb-2 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="text-sm font-bold tracking-tight">{trend.category}</span>
                          <span className="text-[10px] opacity-40 block uppercase font-bold">{trend.region} ({trend.count} reports)</span>
                        </div>
                        <div className="flex gap-1 items-end h-8">
                          {/* Simulated bar chart relative to index for visual effect */}
                          <div className={`w-1 bg-black ${idx === 0 ? 'h-4' : 'h-2'}`}></div>
                          <div className={`w-1 bg-black ${idx === 0 ? 'h-6' : 'h-4'}`}></div>
                          <div className={`w-1 bg-black ${idx === 0 ? 'h-5' : 'h-3'}`}></div>
                          <div className={`w-1 bg-black ${idx === 0 ? 'h-8' : 'h-4'}`}></div>
                          <div className={`w-1 bg-black ${idx === 0 ? 'h-7' : 'h-5'}`}></div>
                        </div>
                      </button>
                    )) : (
                      <div className="text-xs italic opacity-50">Not enough data to determine trends yet.</div>
                    )}
                  </div>
                  
                  {(!currentUser?.role || currentUser.role === 'Citizen') && (
                    <div className="mt-8 pt-6 border-t border-black">
                       <span className="text-[10px] font-bold uppercase tracking-widest block mb-4">Your Impact</span>
                       <div className="flex items-end justify-between">
                         <span className="text-4xl font-light">{currentUser?.points || 0} <span className="text-xs font-bold uppercase tracking-widest opacity-50">PTS</span></span>
                         <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-black text-white">{currentUser?.role || 'Citizen'}</span>
                       </div>
                    </div>
                  )}
                </div>

                {/* Predictive Footer */}
                <div className="p-8 border-t border-black bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-black"></div>
                    <span className="text-[10px] font-bold uppercase tracking-[.2em]">Predictive Analysis</span>
                  </div>
                  <p className="text-[11px] mt-2 leading-relaxed italic opacity-70 font-medium">
                    "{prediction || 'Collecting more reports to generate reliable predictive analysis for infrastructure maintenance.'}"
                  </p>
                </div>
              </aside>
            </motion.div>
          )}

          {currentView === 'camera' && (
            <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20">
              <CameraView 
                onCapture={handleCapture} 
                onCancel={() => setCurrentView('landing')} 
              />
            </motion.div>
          )}

          {currentView === 'form' && capturedImage && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-white">
              <ComplaintForm 
                imageSrc={capturedImage}
                currentUser={currentUser}
                onSuccess={() => setCurrentView('success')}
                onCancel={() => {
                  setCapturedImage(null);
                  setCurrentView('landing');
                }}
                onRetake={() => setCurrentView('camera')}
                detectedRegion={detectedRegion}
              />
            </motion.div>
          )}

          {currentView === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-white">
              <Dashboard onBack={() => { setInitialCategory('All'); setCurrentView('landing'); }} currentUser={currentUser} />
            </motion.div>
          )}

          {currentView === 'contributions' && (
            <motion.div key="contributions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-white">
              <Dashboard onBack={() => { setInitialCategory('All'); setCurrentView('landing'); }} currentUser={currentUser} showOnlyUserContributions={true} targetUserIdForContributions={targetUserId} />
            </motion.div>
          )}

          {currentView === 'verifications' && (
            <motion.div key="verifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-white">
              <Dashboard onBack={() => { setInitialCategory('All'); setCurrentView('landing'); }} currentUser={currentUser} showOnlyUserVerifications={true} />
            </motion.div>
          )}
          
          {currentView === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-white">
              <AdminDashboard onBack={() => setCurrentView('landing')} currentUser={currentUser} />
            </motion.div>
          )}

          {currentView === 'verifier' && (
            <motion.div key="verifier" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-white">
              <VerifierDashboard onBack={() => setCurrentView('landing')} currentUser={currentUser} />
            </motion.div>
          )}
          
          {currentView === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-white">
              <Leaderboard 
                onBack={() => setCurrentView('landing')} 
                onUserClick={(userId) => {
                  setTargetUserId(userId);
                  setCurrentView('contributions');
                }}
              />
            </motion.div>
          )}

          {currentView === 'points_history' && (
            <motion.div key="points_history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-white">
              <PointsHistory onBack={() => setCurrentView('landing')} currentUser={currentUser} />
            </motion.div>
          )}

          {currentView === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-24 h-24 mb-6 border border-black rounded-none flex items-center justify-center text-black">
                <CheckCircle size={48} />
              </div>
              <h2 className="text-3xl font-black tracking-tighter mb-2 uppercase">REPORT SUBMITTED</h2>
              <p className="text-black/60 mb-8 font-medium max-w-sm">
                Data captured and synchronized. You have earned 10 points for participating in community verification.
              </p>
              <button 
                onClick={() => {
                  setCapturedImage(null);
                  setCurrentView('landing');
                }}
                className="px-8 py-4 bg-black text-white font-bold uppercase tracking-widest text-sm hover:bg-black/90 transition-colors"
              >
                RETURN HOME
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Status Bar */}
      <footer className="shrink-0 h-12 border-t border-black bg-black text-white flex items-center px-6 md:px-10 justify-between relative z-30">
        <div className="flex gap-6 items-center text-[9px] font-bold tracking-[.3em] uppercase">
          <span>Status: Operating Nominal</span>
          <span className="opacity-40 hidden sm:inline">|</span>
          <span className="hidden sm:inline">Encrypted Database: Online</span>
        </div>
        <div className="text-[9px] font-bold tracking-[.3em] uppercase">
          System Time: {new Date().toLocaleTimeString()}
        </div>
      </footer>

      {/* Global Utilities */}
      <LocalNotifications currentUser={currentUser} />
      <Chatbot currentUser={currentUser} currentView={currentView} />
      <GoToTop containerRef={mainRef} />
    </div>
  );
}
