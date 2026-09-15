import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw, 
  Sparkles, 
  Scale, 
  Wheat, 
  User, 
  ShieldCheck, 
  QrCode,
  ArrowRight,
  Truck,
  Building2,
  PhoneCall,
  Check
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useKisanFlow } from '../../context/KisanFlowContext';

interface GateQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckInSuccess?: (tokenNumber: string) => void;
  targetTokenNumber?: string | null;
}

interface AdmittedTokenDetails {
  token_number: string;
  farmer_name: string;
  farmer_id: string;
  mobile: string;
  village: string;
  crop_type: string;
  variety?: string;
  estimated_quantity: number;
  assigned_weighbridge: string;
  assigned_counter: string;
  status: string;
  wasAlreadyCheckedIn?: boolean;
}

export const GateQrScannerModal: React.FC<GateQrScannerModalProps> = ({
  isOpen,
  onClose,
  onCheckInSuccess,
  targetTokenNumber
}) => {
  const { checkInFarmer, selectedCentreId, centres, scannerTargetToken } = useKisanFlow();
  const effectiveTargetToken = targetTokenNumber ?? scannerTargetToken;

  const rawId = useId();
  const readerElementIdRef = useRef<string>(`gate-qr-reader-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`);

  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [admittedToken, setAdmittedToken] = useState<AdmittedTokenDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isHandlingScanRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const isOpenRef = useRef<boolean>(isOpen);

  // Helper to neutralize html5-qrcode's throwing onabort/onerror handlers on video surfaces
  const neutralizeVideoSurface = useCallback((video: HTMLVideoElement) => {
    try {
      video.onabort = null;
      video.onerror = null;
      Object.defineProperty(video, 'onabort', {
        get: () => null,
        set: () => {},
        configurable: true,
      });
      Object.defineProperty(video, 'onerror', {
        get: () => null,
        set: () => {},
        configurable: true,
      });
    } catch {
      video.onabort = null;
      video.onerror = null;
    }
  }, []);

  // Web Audio chime synthesizer for instant auditory feedback
  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Dual-tone harmonic chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.16); // D6
      
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Audio not permitted without user gesture or unsupported
    }
  }, []);

  // Safe camera scanner cleanup: gracefully pauses video, stops all media tracks, and stops scanner
  const stopScanner = useCallback(async () => {
    isStoppingRef.current = true;
    try {
      // 1. Immediately neutralize onabort & onerror on all video elements to prevent html5-qrcode throwing uncaught errors
      const container = document.getElementById(readerElementIdRef.current);
      if (container) {
        const videos = container.querySelectorAll('video');
        videos.forEach(video => {
          neutralizeVideoSurface(video);
        });
      }

      // 2. Stop and clear html5QrCode instance cleanly
      if (html5QrCodeRef.current) {
        const scanner = html5QrCodeRef.current;
        html5QrCodeRef.current = null;
        try {
          if (scanner.isScanning) {
            await scanner.stop().catch(() => {});
          }
          scanner.clear();
        } catch {
          // ignore cleanup errors
        }
      }

      // 3. Cleanly pause and stop any remaining video tracks after scanner stop
      if (container) {
        const remainingVideos = container.querySelectorAll('video');
        remainingVideos.forEach(video => {
          neutralizeVideoSurface(video);
          try {
            video.pause();
            if (video.srcObject) {
              const stream = video.srcObject as MediaStream;
              stream.getTracks().forEach(track => {
                try {
                  track.stop();
                } catch {
                  // ignore
                }
              });
              video.srcObject = null;
            }
          } catch {
            // ignore
          }
        });
      }
    } finally {
      isStoppingRef.current = false;
      setScannerActive(false);
    }
  }, [neutralizeVideoSurface]);

  // Process & Check In Token (called either by QR scan or manual input)
  const processTokenCheckIn = useCallback(async (rawInput: string) => {
    if (isHandlingScanRef.current || !rawInput) return;
    isHandlingScanRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);

    // Extract token number (e.g., handles "KF-10243", JSON objects, or plain text)
    let tokenNum = rawInput.trim();
    if (tokenNum.startsWith('{')) {
      try {
        const parsed = JSON.parse(tokenNum);
        tokenNum = parsed.token || parsed.tokenNumber || parsed.token_number || tokenNum;
      } catch {
        // Not JSON, continue with raw
      }
    }

    // Match KF-XXXXX or normalize
    const match = tokenNum.match(/KF-[A-Z0-9]+/i);
    if (match) {
      tokenNum = match[0].toUpperCase();
    } else {
      tokenNum = tokenNum.toUpperCase();
    }

    try {
      // 1. Query Supabase for the token
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('token_number', tokenNum)
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        setErrorMessage(`Token "${tokenNum}" not found in national registry. Verify the number and retry.`);
        setIsProcessing(false);
        isHandlingScanRef.current = false;
        return;
      }

      const tokenRecord = data[0];
      const wasAlreadyCheckedIn = tokenRecord.status === 'CHECKED_IN' || tokenRecord.status === 'PROCESSING';

      // 2. If token is BOOKED, update it to CHECKED_IN
      let assignedWb = tokenRecord.weighbridge_number || 'WB-01';
      let assignedCtr = tokenRecord.assigned_counter || 'Counter 1';

      if (tokenRecord.status === 'BOOKED') {
        const { error: updateError } = await supabase
          .from('tokens')
          .update({
            status: 'CHECKED_IN',
            weighbridge_number: assignedWb,
            assigned_counter: assignedCtr
          })
          .eq('token_number', tokenNum);

        if (updateError) {
          console.warn('Notice updating token:', updateError.message);
        }

        // Also update local context
        checkInFarmer(tokenNum);
      }

      // Notify global listeners
      window.dispatchEvent(new CustomEvent('kisanflow:tokens-updated'));
      if (onCheckInSuccess) {
        onCheckInSuccess(tokenNum);
      }

      // Play audio chime and trigger celebratory confetti
      playSuccessChime();
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {
        // Safe if confetti fails
      }

      // Stop camera cleanly BEFORE switching to admittance card
      await stopScanner();

      // Populate admittance card
      setAdmittedToken({
        token_number: tokenRecord.token_number,
        farmer_name: tokenRecord.farmer_name || 'Farmer',
        farmer_id: tokenRecord.farmer_id || 'KF-FARMER',
        mobile: tokenRecord.mobile || '',
        village: tokenRecord.village || 'Local Village',
        crop_type: tokenRecord.crop_type || 'Wheat (Sharbati)',
        variety: tokenRecord.variety || 'Standard',
        estimated_quantity: Number(tokenRecord.estimated_quantity) || 30,
        assigned_weighbridge: assignedWb,
        assigned_counter: assignedCtr,
        status: 'CHECKED_IN',
        wasAlreadyCheckedIn
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error verifying gate token';
      setErrorMessage(msg);
      isHandlingScanRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  }, [checkInFarmer, onCheckInSuccess, playSuccessChime, stopScanner]);

  const processTokenCheckInRef = useRef(processTokenCheckIn);
  useEffect(() => {
    processTokenCheckInRef.current = processTokenCheckIn;
  }, [processTokenCheckIn]);

  // Start Camera QR Scanner
  const startScanner = useCallback(async () => {
    if (isStartingRef.current || isStoppingRef.current) return;
    if (!isOpenRef.current || !isMountedRef.current) return;

    isStartingRef.current = true;
    setCameraError(null);

    try {
      // Ensure any previous camera instance is cleanly terminated
      await stopScanner();

      if (!isOpenRef.current || !isMountedRef.current) {
        return;
      }

      const element = document.getElementById(readerElementIdRef.current);
      if (!element) {
        return;
      }

      const html5QrCode = new Html5Qrcode(readerElementIdRef.current);
      html5QrCodeRef.current = html5QrCode;

      const qrConfig = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        qrConfig,
        (decodedText: string) => {
          if (decodedText && !isHandlingScanRef.current) {
            processTokenCheckInRef.current(decodedText);
          }
        },
        () => {
          // Frame error callback, silently ignored during continuous scanning
        }
      );

      // Immediately neutralize video element handlers on startup
      if (element) {
        element.querySelectorAll('video').forEach(neutralizeVideoSurface);
      }

      if (!isOpenRef.current || !isMountedRef.current) {
        await stopScanner();
        return;
      }

      setScannerActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('play()') || 
        msg.includes('AbortError') || 
        msg.includes('interrupted') ||
        msg.includes('RenderedCameraImpl')
      ) {
        // Benign video play interruption or abort during teardown
        return;
      }
      console.warn('Camera initiation notice:', err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission blocked by browser. Please allow camera access or use manual token entry below.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError('No camera found on this device. Please use manual token entry below.');
      } else {
        setCameraError('Unable to open camera viewfinder. Please use manual token entry below.');
      }
      setScannerActive(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [stopScanner, neutralizeVideoSurface]);

  // Continuously monitor scanner container to neutralize html5-qrcode's throwing onabort/onerror handlers
  useEffect(() => {
    if (!isOpen) return;
    const container = document.getElementById(readerElementIdRef.current);
    if (!container) return;

    // Disarm any existing video elements
    container.querySelectorAll('video').forEach(neutralizeVideoSurface);

    const observer = new MutationObserver(() => {
      container.querySelectorAll('video').forEach(neutralizeVideoSurface);
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [isOpen, neutralizeVideoSurface]);

  // Handle open / close lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    isOpenRef.current = isOpen;

    if (isOpen) {
      setAdmittedToken(null);
      setErrorMessage(null);
      setManualTokenInput(effectiveTargetToken || '');
      isHandlingScanRef.current = false;

      // Small delay to ensure modal DOM is mounted before attaching camera
      const timer = setTimeout(() => {
        if (isMountedRef.current && isOpenRef.current) {
          startScanner();
        }
      }, 200);

      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }

    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, [isOpen, effectiveTargetToken, startScanner, stopScanner]);

  // Manual Check In Trigger
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTokenInput.trim()) return;
    processTokenCheckIn(manualTokenInput);
  };

  // Reset to scan next farmer
  const handleScanNext = async () => {
    setAdmittedToken(null);
    setErrorMessage(null);
    setManualTokenInput('');
    isHandlingScanRef.current = false;
    await startScanner();
  };

  if (!isOpen) return null;

  const activeCentre = centres.find(c => c.id === selectedCentreId) || centres[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative text-white my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-5 py-3.5 flex items-center justify-between border-b border-emerald-600/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-950/50 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-sm text-white">
                Live Gate QR Scanner
              </h3>
              <p className="text-[11px] text-emerald-200">
                {activeCentre.name} • Gate Entry Verification
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              await stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 text-emerald-200 hover:text-white transition-colors cursor-pointer"
            title="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* STATE 1: Token Admitted Success Card */}
          {admittedToken && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Admitted Header Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-teal-950/80 border-2 border-emerald-500/80 space-y-2 text-center relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto font-black shadow-lg shadow-emerald-950/60">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-emerald-300 uppercase block">
                    {admittedToken.wasAlreadyCheckedIn ? 'ALREADY ADMITTED • ACTIVE' : 'GATE CHECK-IN VERIFIED'}
                  </span>
                  <h4 className="font-mono text-2xl font-black text-white mt-0.5">
                    {admittedToken.token_number}
                  </h4>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    Vehicle cleared for Mandi yard entry
                  </p>
                </div>
              </div>

              {/* Farmer & Commodity Details Card */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-bold text-white block text-sm">
                        {admittedToken.farmer_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {admittedToken.farmer_id} • {admittedToken.village}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    {admittedToken.mobile}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Wheat className="w-3 h-3 text-amber-400" />
                      Crop / Commodity
                    </span>
                    <span className="font-bold text-white text-xs mt-0.5 block truncate">
                      {admittedToken.crop_type}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono block">
                      {admittedToken.estimated_quantity} Quintals
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Scale className="w-3 h-3 text-emerald-400" />
                      Assigned Station
                    </span>
                    <span className="font-bold text-emerald-300 text-xs mt-0.5 block">
                      {admittedToken.assigned_weighbridge}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {admittedToken.assigned_counter}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleScanNext}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-heading font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Next Farmer</span>
                </button>

                <button
                  onClick={async () => {
                    await stopScanner();
                    onClose();
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-heading font-bold text-xs py-3 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  Done & Close
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: Active Camera Viewfinder & Aiming Reticle (kept in DOM to prevent abrupt unmounting of media elements) */}
          <div className={admittedToken ? 'hidden' : 'space-y-4'}>
            {/* Pre-selected Target Token Focus Banner (Row-Level Integration) */}
            {effectiveTargetToken && !admittedToken && (
              <div className="p-3 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border-2 border-emerald-500/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-emerald-950/40 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-emerald-400">
                        Pre-Selected Gate Pass Target
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <span className="font-mono text-base font-extrabold text-white tracking-wide">
                      {effectiveTargetToken}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => processTokenCheckIn(effectiveTargetToken)}
                  disabled={isProcessing}
                  className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-heading font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                  title="1-tap immediate check-in without scanning"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>1-Tap Check-In Now</span>
                </button>
              </div>
            )}

            {/* Error notification if camera failed or verification error */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/50 flex items-start gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Verification Notice</span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 flex items-start gap-2 text-xs text-amber-300">
                <CameraOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Camera Notice</span>
                  <span>{cameraError}</span>
                </div>
              </div>
            )}

            {/* Live Video Camera Viewfinder Box */}
            <div className="relative w-full h-[260px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-inner flex items-center justify-center">
              {/* HTML5 QR Container Target */}
              <div 
                id={readerElementIdRef.current} 
                className="w-full h-full object-cover [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
              />

              {/* Aiming Reticle Overlay (Active when camera is running) */}
              {scannerActive && !isProcessing && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Reticle Square with glowing corners */}
                  <div className="relative w-48 h-48 border border-emerald-500/40 rounded-2xl">
                    {/* Corner Accents */}
                    <span className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                    <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />

                    {/* Animated Laser Scanning Beam */}
                    <div className="absolute inset-x-2 h-0.5 bg-emerald-400 shadow-md shadow-emerald-400 animate-[bounce_2s_infinite]" />
                  </div>

                  <div className="absolute bottom-3 inset-x-0 text-center">
                    <span className="text-[11px] font-medium bg-slate-950/80 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 backdrop-blur-sm">
                      Align Farmer E-Token QR Code inside frame
                    </span>
                  </div>
                </div>
              )}

              {/* Processing Overlay when QR code hit */}
              {isProcessing && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-bold text-white font-mono tracking-wide">
                    Verifying Token in Supabase...
                  </span>
                </div>
              )}

              {/* If camera is not active and no error, show loading */}
              {!scannerActive && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Camera className="w-7 h-7 text-emerald-400 animate-pulse" />
                  <span>Initializing webcam feed...</span>
                </div>
              )}
            </div>

            {/* Failsafe / Manual Input Section */}
            <div className="pt-2 border-t border-slate-800">
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Or enter Token Number manually (Failsafe)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">e.g. KF-10243</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    placeholder="Enter token number (e.g. KF-10243)"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white uppercase placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isProcessing || !manualTokenInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-heading font-extrabold text-xs px-4 py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isProcessing ? 'Verifying...' : 'Verify & Check In'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  Manual verification directly updates the Supabase database and live queue tables instantly.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

