import { User, Complaint } from '../types';
import React, { useState, useEffect, useRef } from 'react';
import { addComplaint, getComplaints, toggleUpvoteComplaint, awardPoints } from '../lib/firebase';
import { getDistance } from 'geolib';
import { MapPin, Sparkles, Loader2, ArrowLeft, CheckCircle, Heart, Crop as CropIcon, X, Check, ArrowUp, AlertCircle } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { compressImage } from '../lib/compressImage';
import { GoToTop } from './GoToTop';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function LocationMapUpdater({ location }: { location: { lat: number, lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && location) {
      map.panTo(location);
    }
  }, [map, location]);
  return null;
}

interface ComplaintFormProps {
  imageSrc: string;
  currentUser: User | null;
  onSuccess: () => void;
  onCancel: () => void;
  onRetake: () => void;
  detectedRegion?: string | null;
}

export function ComplaintForm({ imageSrc, currentUser, onSuccess, onCancel, onRetake, detectedRegion }: ComplaintFormProps) {
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [landmark, setLandmark] = useState('');
  const [region, setRegion] = useState(detectedRegion || '');
  const [userDescription, setUserDescription] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isLocating, setIsLocating] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [error, setError] = useState('');
  
  const isVideo = imageSrc.startsWith('data:video');

  // Crop state
  const [croppedImageSrc, setCroppedImageSrc] = useState(imageSrc);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 50,
    height: 50,
    x: 25,
    y: 25
  });
  const [completedCrop, setCompletedCrop] = useState<any>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let mounted = true;
    compressImage(imageSrc).then(compressed => {
      if (mounted) setCroppedImageSrc(compressed);
    });
    return () => { mounted = false; };
  }, [imageSrc]);

  const applyCrop = async () => {
    if (!completedCrop || !imgRef.current) return;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Check if the crop size is virtually zero (meaning they just clicked without dragging)
    if (completedCrop.width === 0 || completedCrop.height === 0) {
      setIsCropping(false);
      return;
    }

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      );
      
      const base64Image = canvas.toDataURL('image/jpeg');
      const compressed = await compressImage(base64Image);
      setCroppedImageSrc(compressed);
      setIsCropping(false);
    }
  };

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });
          
          try {
            const res = await fetch('/api/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat, lng })
            });
            const data = await res.json();
            if (data && data.region) {
              setRegion(data.region);
            }
          } catch (e) {
            console.error("Geocoding failed", e);
          }
          setIsLocating(false);
        },
        (err) => {
          console.error("Error getting location:", err);
          setError("Failed to get location. Please enable location services.");
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
      setIsLocating(false);
    }
  }, []);

  const handleGenerateDescription = async () => {
    if (!croppedImageSrc) return;
    setIsGenerating(true);
    setError('');
    setVerificationError('');
    
    try {
      const match = croppedImageSrc.match(/data:([^;]+);/);
      const mimeType = match ? match[1] : (isVideo ? 'video/mp4' : 'image/jpeg');

      const response = await fetch('/api/describe-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: croppedImageSrc,
          mimeType 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.description) {
        setDescription(data.description);
      } else {
        setError(data.error || 'Failed to generate description');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while generating description');
    } finally {
      setIsGenerating(false);
    }
  };

  const checkForDuplicates = async () => {
    if (!location) return null;
    
    try {
      const existingComplaints = await getComplaints() as Complaint[];
      const radiusInMeters = 100; // Check within 100 meters
      
      const nearbyComplaints = existingComplaints.filter((comp) => {
        if (!comp.latitude || !comp.longitude) return false;
        // MUST match the same category to be considered a duplicate
        if (category && comp.category !== category) return false;
        
        const distance = getDistance(
          { latitude: location.lat, longitude: location.lng },
          { latitude: comp.latitude, longitude: comp.longitude }
        );
        return distance <= radiusInMeters;
      });

      // Simple keyword matching for description similarity
      const currentWords = description.toLowerCase().split(/\W+/);
      
      for (const comp of nearbyComplaints) {
        if (!comp.description) {
           const distance = getDistance(
             { latitude: location.lat, longitude: location.lng },
             { latitude: comp.latitude, longitude: comp.longitude }
           );
           if (distance <= 20) return comp;
           continue;
        }
        
        const compWords = comp.description.toLowerCase().split(/\W+/);
        const commonWords = currentWords.filter(w => w.length > 3 && compWords.includes(w));
        
        const distance = getDistance(
          { latitude: location.lat, longitude: location.lng },
          { latitude: comp.latitude, longitude: comp.longitude }
        );

        // More strict duplicate matching: same category, and either very close physically OR sharing significant keywords
        if (commonWords.length >= 3 || distance <= 30) {
          return comp;
        }
      }
      return null;
    } catch (err) {
      console.error("Error checking duplicates:", err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent, ignoreDuplicate = false) => {
    e.preventDefault();
    if (!location || !description.trim() || !userDescription.trim()) {
      setError("Location and both descriptions are required.");
      return;
    }

    setIsSubmitting(true);
    setError('');
    setVerificationError('');

    if (!ignoreDuplicate) {
      // First verify the issue
      try {
        setIsVerifying(true);
        const match = croppedImageSrc.match(/data:([^;]+);/);
        const mimeType = match ? match[1] : (isVideo ? 'video/mp4' : 'image/jpeg');
        
        // We might want to compress or extract frames from video, but for now we send base64
        const response = await fetch('/api/verify-issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            mediaBase64: croppedImageSrc,
            mimeType,
            userDescription 
          }),
        });
        
        const data = await response.json();
        setIsVerifying(false);

        if (response.ok && data.result) {
          if (data.result.startsWith('INVALID')) {
            setVerificationError(data.result);
            setIsSubmitting(false);
            return;
          }
        } else {
          setError(data.error || 'Failed to verify issue');
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        setIsVerifying(false);
        setError('Network error during verification');
        setIsSubmitting(false);
        return;
      }

      const duplicate = await checkForDuplicates();
      if (duplicate) {
        setDuplicateWarning(duplicate);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await addComplaint({
        imageBase64: croppedImageSrc, // for simplicity, assuming we store video as base64 too
        latitude: location.lat,
        longitude: location.lng,
        landmark,
        region,
        description: `User: ${userDescription}`,
        detailed_description:`additional description: ${description}`,
        category,
        status: 'Pending',
        upvotedBy: [],
        userId: currentUser?.id
      });
      if (currentUser) {
        await awardPoints(currentUser.id, 10, "Reported a new civic issue"); // 10 points for reporting
      }
      onSuccess();
    } catch (err) {
      console.error("Error submitting complaint:", err);
      setError("Failed to submit complaint. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleSupport = async () => {
    if (!duplicateWarning || !currentUser) return;
    setIsSubmitting(true);
    try {
      const hasUpvoted = duplicateWarning.upvotedBy?.includes(currentUser.id) || false;
      if (!hasUpvoted) {
        await toggleUpvoteComplaint(duplicateWarning.id, currentUser.id, hasUpvoted);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setError("Failed to support issue.");
      setIsSubmitting(false);
    }
  };

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
      if (isHeaderVisible) setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY.current) {
      if (!isHeaderVisible) setIsHeaderVisible(true);
    }
    lastScrollY.current = currentScrollY;
  };

  return (
    <div ref={scrollRef} className="max-w-2xl mx-auto bg-white h-full border-x border-black overflow-y-auto" onScroll={handleScroll}>
      <div className={`p-6 md:p-8 border-b border-black flex items-center gap-6 sticky top-0 bg-white z-10 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <button onClick={onCancel} className="p-2 border border-black hover:bg-black hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">New Entry</span>
          <h2 className="text-3xl font-light tracking-tighter uppercase leading-none">Register Issue</h2>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8">
        <div className="relative aspect-video w-full border border-black overflow-hidden bg-black/5 group">
          {isCropping ? (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col p-4 md:p-8">
              <div className="flex-1 overflow-hidden flex items-center justify-center">
                <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
                  <img ref={imgRef} src={imageSrc} alt="Crop" className="max-h-full max-w-full object-contain" />
                </ReactCrop>
              </div>
              <div className="flex gap-4 justify-end mt-4">
                <button type="button" onClick={() => setIsCropping(false)} className="bg-white text-black p-4 font-bold uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-colors flex items-center gap-2">
                  <X size={16} /> Cancel
                </button>
                <button type="button" onClick={applyCrop} className="bg-black text-white border border-white p-4 font-bold uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-colors flex items-center gap-2">
                  <Check size={16} /> Apply Crop
                </button>
              </div>
            </div>
          ) : (
            <>
              {isVideo ? (
                <video src={croppedImageSrc} className="w-full h-full object-cover" controls autoPlay loop muted />
              ) : (
                <img src={croppedImageSrc} alt="Captured issue" className="w-full h-full object-cover" />
              )}
              
              <div className="absolute bottom-0 left-0 p-4 flex gap-2 w-full justify-between bg-gradient-to-t from-black/80 to-transparent pt-12">
                <button type="button" onClick={onRetake} className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-white hover:bg-white hover:text-black transition-colors">
                  Retake
                </button>
                {croppedImageSrc === imageSrc && !isVideo && (
                  <button type="button" onClick={() => setIsCropping(true)} className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-white hover:bg-white hover:text-black transition-colors flex items-center gap-2">
                    <CropIcon size={12} /> Crop
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="p-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest">
            {error}
          </div>
        )}
        
        {verificationError && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-red-600 p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
              <div className="flex items-center gap-3 text-red-600 font-bold uppercase tracking-widest text-sm border-b border-red-200 pb-4">
                <AlertCircle size={24} /> 
                <span>Issue Verification Failed</span>
              </div>
              <p className="text-base font-medium text-gray-900 leading-relaxed">
                {verificationError}
              </p>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setVerificationError('')}
                  className="flex-1 p-4 border border-black text-black font-bold uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={onRetake}
                  className="flex-1 p-4 bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors"
                >
                  Retake Media
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest uppercase">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-4 border border-black bg-white focus:outline-none focus:ring-1 focus:ring-black transition-shadow text-sm uppercase tracking-widest"
              required
            >
              <option value="" disabled>Select a Category</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Water Supply">Water Supply</option>
              <option value="Electricity">Electricity</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-2">
              <MapPin size={14} /> Location Data
            </label>
            <div className="p-4 border border-black bg-white flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                {isLocating ? (
                  <span className="text-black flex items-center gap-2 text-xs font-bold uppercase mb-2">
                    <Loader2 size={16} className="animate-spin" /> Fetching Coordinates
                  </span>
                ) : null}
                
                {hasValidKey ? (
                  <div className="w-full h-48 border border-black relative">
                    <APIProvider apiKey={API_KEY} version="weekly">
                      <Map
                        defaultCenter={location || { lat: 37.42, lng: -122.08 }}
                        defaultZoom={location ? 16 : 4}
                        mapId="DEMO_MAP_ID"
                        onClick={(e) => {
                          if (e.detail.latLng) {
                            setLocation(e.detail.latLng);
                          }
                        }}
                        disableDefaultUI={true}
                        zoomControl={true}
                      >
                        {location && (
                          <AdvancedMarker position={location}>
                            <Pin background="#000" glyphColor="#fff" borderColor="#fff" />
                          </AdvancedMarker>
                        )}
                        <LocationMapUpdater location={location} />
                      </Map>
                    </APIProvider>
                    <div className="absolute top-2 left-2 bg-white border border-black px-2 py-1 text-[9px] font-bold uppercase tracking-widest z-10 shadow-sm pointer-events-none">
                      Tap map to adjust location
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 w-full mb-2">
                    <span className="text-black/60 text-xs font-bold uppercase">Location unavailable. Enter manually:</span>
                    <div className="flex items-center gap-2 font-mono text-sm tracking-widest w-full">
                      <input type="number" step="any" placeholder="Lat" value={location?.lat || ''} onChange={e => setLocation(prev => ({lat: parseFloat(e.target.value), lng: prev?.lng || 0}))} className="w-1/2 p-2 border border-black bg-transparent outline-none focus:bg-black/5" />
                      <span>,</span>
                      <input type="number" step="any" placeholder="Lng" value={location?.lng || ''} onChange={e => setLocation(prev => ({lat: prev?.lat || 0, lng: parseFloat(e.target.value)}))} className="w-1/2 p-2 border border-black bg-transparent outline-none focus:bg-black/5" />
                    </div>
                  </div>
                )}
                
                {location && (
                  <div className="font-mono text-[10px] tracking-widest text-black/60 mt-1">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-black/10">
                 <label className="text-[10px] font-bold tracking-widest uppercase mb-1 block opacity-60">Region / Neighborhood</label>
                 <input
                   type="text"
                   value={region}
                   onChange={(e) => setRegion(e.target.value)}
                   className="w-full bg-transparent outline-none font-bold uppercase text-sm tracking-widest"
                   placeholder="Enter Region"
                   required
                 />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest uppercase">
              Landmark Reference
            </label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="w-full p-4 border border-black bg-white focus:outline-none focus:ring-1 focus:ring-black transition-shadow text-sm"
              placeholder="e.g., Near Central Park entrance"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest uppercase">
              Your Description
            </label>
            <textarea
              value={userDescription}
              onChange={(e) => setUserDescription(e.target.value)}
              rows={3}
              className="w-full p-4 border border-black bg-white focus:outline-none focus:ring-1 focus:ring-black transition-shadow resize-none text-sm"
              placeholder="Briefly describe what you see..."
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end mb-2">
              <label className="text-[10px] font-bold tracking-widest uppercase">
                Detailed Description
              </label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={isGenerating}
                className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 text-black hover:opacity-70 transition-opacity disabled:opacity-50 border border-black px-2 py-1"
                title="Auto-generate detailed description"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Auto Describe
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full p-4 border border-black bg-white focus:outline-none focus:ring-1 focus:ring-black transition-shadow resize-none text-sm"
              placeholder="Detailed description..."
              required
            />
          </div>

          {duplicateWarning ? (
            <div className="p-6 border border-black bg-white space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-widest border-b border-black pb-2">
                <CheckCircle size={16} /> Duplicate Detected
              </h3>
              <p className="text-[11px] font-medium uppercase tracking-wider opacity-60">
                A similar issue was recently reported at this location.
              </p>
              
              <div className="flex gap-4 p-4 bg-black/5 border border-black items-start">
                {duplicateWarning.imageBase64 && (
                  duplicateWarning.imageBase64.startsWith('data:video') ? (
                    <video src={duplicateWarning.imageBase64} className="w-24 h-24 object-cover border border-black grayscale" />
                  ) : (
                    <img src={duplicateWarning.imageBase64} alt="Original issue" className="w-24 h-24 object-cover border border-black grayscale" />
                  )
                )}
                <div className="text-sm font-mono line-clamp-4">
                  "{duplicateWarning.description}"
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleSupport}
                  disabled={isSubmitting || (duplicateWarning.upvotedBy?.includes(currentUser?.id) || false)}
                  className="w-full p-4 bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-black/90 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
                  {duplicateWarning.upvotedBy?.includes(currentUser?.id) ? 'Already Upvoted' : 'Upvote Existing Issue'}
                </button>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 p-4 border border-black font-bold uppercase tracking-widest text-[10px] hover:bg-black hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={isSubmitting}
                    className="flex-1 p-4 border border-black font-bold uppercase tracking-widest text-[10px] hover:bg-black hover:text-white transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                  >
                    Force Submit New
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || !location || isLocating}
              className="w-full p-6 bg-black text-white font-bold uppercase tracking-widest text-sm hover:bg-black/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3 mt-8"
            >
              {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : isVerifying ? <><Loader2 size={24} className="animate-spin" /> VERIFYING AI...</> : 'SUBMIT REPORT'}
            </button>
          )}
        </form>
      </div>
      <GoToTop containerRef={scrollRef} />
    </div>
  );
}
