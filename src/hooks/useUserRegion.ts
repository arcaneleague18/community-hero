import { useState, useEffect } from 'react';

export function useUserRegion() {
  const [region, setRegion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          try {
            const res = await fetch('/api/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat, lng })
            });
            const data = await res.json();
            if (data && data.region && data.region !== 'Unknown Region') {
              setRegion(data.region);
            }
          } catch (e) {
            console.error("Geocoding failed", e);
            setError('Failed to fetch region');
          } finally {
            setIsLoading(false);
          }
        },
        (err) => {
          setError(err.message);
          setIsLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  }, []);

  return { region, isLoading, error };
}
