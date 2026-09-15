import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  // We use a stage tracker to orchestrate the smooth CSS transitions
  const [stage, setStage] = useState<'hidden' | 'entering' | 'exiting'>('hidden');

  useEffect(() => {
    // 1. Start the fade-in animation slightly after component mounts
    const enterTimer = setTimeout(() => {
      setStage('entering');
    }, 150);

    // 2. Hold the screen for 2.5 seconds, then trigger the fade-out blur
    const exitTimer = setTimeout(() => {
      setStage('exiting');
    }, 2800);

    // 3. Completely remove the component and reveal the App
    const unmountTimer = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
    };
  }, [onComplete]);

  // Dynamic Tailwind classes based on the current animation stage
  const contentAnim = 
    stage === 'hidden' ? 'opacity-0 translate-y-8 scale-95 blur-sm' : 
    stage === 'exiting' ? 'opacity-0 -translate-y-8 scale-105 blur-md' : 
    'opacity-100 translate-y-0 scale-100 blur-0';

  const imageAnim = 
    stage === 'hidden' ? 'opacity-0 translate-y-24' : 
    stage === 'exiting' ? 'opacity-0 translate-y-12 blur-md' : 
    'opacity-100 translate-y-0';

  const footerAnim = 
    stage === 'hidden' ? 'opacity-0 translate-y-4' : 
    stage === 'exiting' ? 'opacity-0 translate-y-4' : 
    'opacity-100 translate-y-0';

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center overflow-hidden">
      
      {/* BACKGROUND IMAGE LAYER: Rises from bottom, fades into the dark background at the center */}
      <div className={`absolute bottom-0 w-full h-[65%] transition-all duration-1000 ease-out ${imageAnim}`}>
        {/* Gradient Overlay: Creates the fade effect blending the image into the top half */}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/60 via-slate-950/90 to-slate-950 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?auto=format&fit=crop&w=800&q=80" 
          alt="Indian Agriculture Fields" 
          className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
        />
      </div>

      {/* TOP SPACER */}
      <div className="flex-1" />

      {/* CENTER LOGO */}
      <div className={`relative z-20 flex flex-col items-center transition-all duration-1000 ease-out delay-150 ${contentAnim}`}>
        <h1 className="text-5xl font-black tracking-tight text-white mb-2 drop-shadow-2xl">
          Kisan<span className="text-emerald-400">Flow</span>
        </h1>
        <div className="h-0.5 w-12 bg-emerald-500 rounded-full mb-3 opacity-80" />
        <p className="text-[10px] font-bold tracking-[0.25em] text-emerald-100/60 uppercase text-center">
          Smart Mandi Procurement
        </p>
      </div>

      {/* BOTTOM SPACER & FOOTER */}
      <div className="flex-1 flex flex-col justify-end pb-10 z-20 w-full">
         <p className={`text-[11px] text-slate-500 font-mono font-semibold uppercase tracking-widest text-center transition-all duration-1000 delay-500 ${footerAnim}`}>
           Built by <span className="text-emerald-500/80">Team Code Drifter</span>
         </p>
      </div>
      
    </div>
  );
};