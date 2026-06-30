import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function GoToTop({ containerRef }: { containerRef?: React.RefObject<HTMLElement> }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      const scrollY = containerRef?.current ? containerRef.current.scrollTop : window.scrollY;
      if (scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    const target = containerRef?.current || window;
    target.addEventListener('scroll', toggleVisibility);
    return () => target.removeEventListener('scroll', toggleVisibility);
  }, [containerRef]);

  const scrollToTop = () => {
    if (containerRef?.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40">
      <button
        onClick={scrollToTop}
        className="w-12 h-12 bg-white text-black border-2 border-black shadow-lg flex items-center justify-center hover:bg-black hover:text-white transition-all group animate-in slide-in-from-bottom-10 fade-in duration-300"
        title="Go to Top"
      >
        <ArrowUp size={24} className="group-hover:-translate-y-1 transition-transform" />
      </button>
    </div>
  );
}
