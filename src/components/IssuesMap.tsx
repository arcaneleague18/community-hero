import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef, useMap } from '@vis.gl/react-google-maps';
import { Complaint } from '../types';
import { formatDistanceToNow } from 'date-fns';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Suppress expected Google Maps warnings to keep the console clean
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string') {
    if (args[0].includes("A Map's preregistered map type may not apply all custom styles")) return;
    if (args[0].includes("google.maps.Marker is deprecated")) return;
  }
  originalWarn(...args);
};

function MarkerWithInfoWindow({ complaint }: { complaint: Complaint }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  const isResolved = complaint.status === 'Resolved';

  return (
    <>
      <AdvancedMarker 
        ref={markerRef} 
        position={{ lat: complaint.latitude, lng: complaint.longitude }} 
        onClick={() => setOpen(true)}
      >
        <Pin background={isResolved ? '#10b981' : '#000'} glyphColor="#fff" borderColor="#fff" />
      </AdvancedMarker>
      
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-2 max-w-[200px] font-sans">
            <div className="font-bold text-xs uppercase tracking-widest mb-1">{complaint.category || 'Issue'}</div>
            <p className="text-sm line-clamp-2 mb-2">{complaint.description}</p>
            <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-widest">
              <span>{complaint.status}</span>
              {complaint.createdAt && <span>{formatDistanceToNow(complaint.createdAt.toDate())} ago</span>}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function IssuesMap({ complaints, focusLocation }: { complaints: Complaint[], focusLocation?: { lat: number, lng: number } }) {
  const [mapTypeId, setMapTypeId] = useState<string>('roadmap');

  if (!hasValidKey) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 text-center bg-gray-50">
        <h2 className="text-lg font-bold mb-2">Map Unavailable</h2>
        <p className="text-sm text-gray-600 mb-4">A Google Maps API key is required to view the interactive map.</p>
        <p className="text-xs text-gray-500">Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> in the Secrets settings.</p>
      </div>
    );
  }

  // Calculate center based on complaints or default
  const defaultCenter = focusLocation || (complaints.length > 0 
    ? { lat: complaints[0].latitude, lng: complaints[0].longitude }
    : { lat: 37.42, lng: -122.08 });

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 right-4 z-10 bg-white border border-black flex overflow-hidden shadow-sm">
        <button 
          onClick={() => setMapTypeId('roadmap')}
          className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${mapTypeId === 'roadmap' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Map
        </button>
        <button 
          onClick={() => setMapTypeId('hybrid')}
          className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${mapTypeId === 'hybrid' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Satellite
        </button>
      </div>
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={focusLocation ? 16 : 12}
          mapId="DEMO_MAP_ID"
          mapTypeId={mapTypeId}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          disableDefaultUI={true}
          zoomControl={true}
        >
          {complaints.map(complaint => (
            <MarkerWithInfoWindow key={complaint.id} complaint={complaint} />
          ))}
          <MapUpdater focusLocation={focusLocation} />
        </Map>
      </APIProvider>
    </div>
  );
}

function MapUpdater({ focusLocation }: { focusLocation?: { lat: number, lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (map && focusLocation) {
      map.panTo(focusLocation);
      map.setZoom(16);
    }
  }, [map, focusLocation]);
  return null;
}
