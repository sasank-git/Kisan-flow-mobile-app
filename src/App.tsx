import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { KisanFlowProvider } from './context/KisanFlowContext';
import { FarmerApp } from './components/farmer/FarmerApp';
import { Login } from './components/Login';

// Import the new Splash Screen! 
// (Make sure the path matches exactly where you saved it in your components folder)
import { SplashScreen } from './components/farmer/SplashScreen';

const MobileLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      <main className="flex-1 w-full mx-auto">
        <div className="max-w-md mx-auto w-full h-full">
          <FarmerApp />
        </div>
      </main>
    </div>
  );
};

export default function App() {
  // Add state to track if the splash screen is currently playing
  const [showSplash, setShowSplash] = useState(true);

  return (
    <KisanFlowProvider>
      
      {/* 1. The Splash Screen sits completely on top of everything */}
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}

      {/* 2. Your entire working app is wrapped in this fading container. 
             It stays hidden (h-0 overflow-hidden) while the splash plays to prevent scrolling,
             then smoothly fades in (opacity-100) when the splash finishes. */}
      <div className={`transition-opacity duration-700 ease-in-out ${showSplash ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
        <BrowserRouter>
          <Routes>
            {/* Standalone Login Screen */}
            <Route path="/login" element={<Login />} />
            {/* Main Mobile App */}
            <Route path="/" element={<MobileLayout />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>

    </KisanFlowProvider>
  );
}