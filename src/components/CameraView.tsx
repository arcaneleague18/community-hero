import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Moon, Sun } from 'lucide-react';

interface CameraViewProps {
  onCapture: (mediaSrc: string) => void;
  onCancel: () => void;
}

export function CameraView({ onCapture, onCancel }: CameraViewProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isNightMode, setIsNightMode] = useState(false);

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  const videoConstraints = {
    facingMode: "environment",
  };

  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleUserMediaError = (error: string | DOMException) => {
    console.error("Camera error:", error);
    setCameraError("Camera access denied or unavailable.");
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans">
      <div className="relative flex-1 flex flex-col justify-center items-center">
        {cameraError ? (
          <div className="text-red-500 p-6 text-center bg-black/80 w-full h-full flex flex-col justify-center items-center absolute inset-0 z-10">
            <p className="font-bold mb-4 uppercase tracking-widest">{cameraError}</p>
            <p className="text-sm opacity-80 mb-6 max-w-sm">
              Please ensure you have granted camera permissions in your browser. You may need to open this app in a new tab to manage permissions.
            </p>
            <button 
              onClick={onCancel}
              className="px-6 py-2 border border-white text-white hover:bg-white hover:text-black transition-colors uppercase font-bold text-xs tracking-widest"
            >
              Go Back
            </button>
          </div>
        ) : null}
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          onUserMediaError={handleUserMediaError}
          className={`w-full h-full object-cover absolute inset-0 ${isNightMode ? 'brightness-150 contrast-125' : ''}`}
        />
        
        {/* Controls Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
          <button 
            onClick={onCancel}
            className="text-white border border-white/50 bg-black/30 px-6 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsNightMode(!isNightMode)}
              className="text-white border border-white/50 bg-black/30 px-6 py-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
            >
              {isNightMode ? <Sun size={14} /> : <Moon size={14} />}
              {isNightMode ? 'Normal' : 'Night'}
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-10 flex justify-center items-center pb-20 gap-8">
          <button 
            onClick={capturePhoto}
            className="w-24 h-24 rounded-none border border-white/50 flex items-center justify-center bg-black/30 hover:bg-white hover:text-black transition-colors text-white"
          >
            <Camera size={32} />
          </button>
        </div>
      </div>
    </div>
  );
}
