import React from 'react';
import { 
  Truck, 
  Scale, 
  FlaskConical, 
  FileText, 
  CreditCard, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  DoorOpen,
  Activity,
  Sparkles
} from 'lucide-react';
import { useKisanFlow } from '../../context/KisanFlowContext';

export const DigitalTwinSimulation: React.FC = () => {
  const { bookings, isCounter3Open } = useKisanFlow();

  // Categorize active farmers in each physical station
  const gateFarmers = bookings.filter(b => b.status === 'ARRIVED');
  const queueFarmers = bookings.filter(b => b.status === 'IN_QUEUE');
  const weighingFarmers = bookings.filter(b => b.status === 'WEIGHING');
  const qualityFarmers = bookings.filter(b => b.status === 'QUALITY_CHECK');
  const processingFarmers = bookings.filter(b => b.status === 'PROCESSING');
  const completedFarmers = bookings.filter(b => b.status === 'COMPLETED');

  // Detect station bottlenecks
  const isWeighbridgeBottleneck = weighingFarmers.length >= 2;
  const isGateBottleneck = queueFarmers.length >= 6;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold border border-indigo-500/40">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              <span>Centre Digital Twin & Flow Simulation</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/30">
                LIVE 2D MODEL
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Visual floorplan tracking physical bottleneck locations across Mandi stations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Flow Moving</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-300">Bottleneck Warning</span>
          </div>
        </div>
      </div>

      {/* Visual Mandi Flow Diagram (Matches PDF Page 17) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative pt-2">
        {/* Stage 1: Gate & Entry Token Verification */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-3.5 space-y-2 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <DoorOpen className="w-4 h-4 text-emerald-400" />
              <span>1. Gate & OTP</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-700/80 px-2 py-0.5 rounded text-slate-300">
              {gateFarmers.length} At Gate
            </span>
          </div>

          <div className="min-h-[70px] bg-slate-900/80 rounded-xl p-2 border border-slate-800 space-y-1.5">
            {gateFarmers.length === 0 ? (
              <span className="text-[10px] text-slate-500 italic block text-center pt-5">Gate Clear</span>
            ) : (
              gateFarmers.slice(0, 3).map(f => (
                <div key={f.id} className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-200 flex items-center justify-between border border-slate-700 font-mono">
                  <span>{f.tokenNumber}</span>
                  <span className="text-emerald-400 font-bold">{f.cropType}</span>
                </div>
              ))
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-center font-medium">
            Tractor Queue: {queueFarmers.length}
          </div>
        </div>

        {/* Stage 2: Dual Verification Counters */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-3.5 space-y-2 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>2. Counters</span>
            </div>
            <span className="text-[10px] font-mono bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
              {isCounter3Open ? '3 Open' : '2 Open'}
            </span>
          </div>

          <div className="min-h-[70px] bg-slate-900/80 rounded-xl p-2 border border-slate-800 space-y-1">
            <div className="text-[10px] flex items-center justify-between text-slate-300 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
              <span>Counter 1:</span>
              <span className="text-emerald-400 font-bold font-mono">Active (Staff 1)</span>
            </div>
            <div className="text-[10px] flex items-center justify-between text-slate-300 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
              <span>Counter 2:</span>
              <span className="text-emerald-400 font-bold font-mono">Active (Staff 2)</span>
            </div>
            {isCounter3Open && (
              <div className="text-[10px] flex items-center justify-between text-amber-300 bg-amber-950/40 px-2 py-1 rounded border border-amber-500/40">
                <span>Counter 3:</span>
                <span className="font-bold font-mono">Overload Relief</span>
              </div>
            )}
          </div>

          <div className="text-[10px] text-emerald-400 text-center font-medium">
            Docs & Identity Check
          </div>
        </div>

        {/* Stage 3: Weighbridge WB-01 & WB-02 */}
        <div className={`border rounded-2xl p-3.5 space-y-2 relative ${
          isWeighbridgeBottleneck ? 'bg-amber-950/20 border-amber-500/60' : 'bg-slate-800/60 border-slate-700/70'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Scale className="w-4 h-4 text-indigo-400" />
              <span>3. Weighbridge</span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              isWeighbridgeBottleneck ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-700/80 text-slate-300'
            }`}>
              {weighingFarmers.length} Vehicles
            </span>
          </div>

          <div className="min-h-[70px] bg-slate-900/80 rounded-xl p-2 border border-slate-800 space-y-1.5">
            {weighingFarmers.length === 0 ? (
              <div className="text-[10px] text-slate-400 text-center pt-4">
                <Truck className="w-5 h-5 mx-auto text-slate-600 mb-1" />
                <span>Ready for Next Vehicle</span>
              </div>
            ) : (
              weighingFarmers.map(f => (
                <div key={f.id} className="text-[10px] bg-indigo-950/50 border border-indigo-500/40 px-2 py-1 rounded text-indigo-200 flex items-center justify-between font-mono">
                  <span>{f.tokenNumber}</span>
                  <span className="font-bold">{f.estimatedQuantity} Qtl</span>
                </div>
              ))
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-center font-medium">
            Electronic Net Tare Scale
          </div>
        </div>

        {/* Stage 4: Quality Testing Lab */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-3.5 space-y-2 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <FlaskConical className="w-4 h-4 text-teal-400" />
              <span>4. Quality Lab</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-700/80 px-2 py-0.5 rounded text-slate-300">
              {qualityFarmers.length} Samples
            </span>
          </div>

          <div className="min-h-[70px] bg-slate-900/80 rounded-xl p-2 border border-slate-800 space-y-1.5">
            {qualityFarmers.length === 0 ? (
              <span className="text-[10px] text-slate-500 italic block text-center pt-5">Lab Ready</span>
            ) : (
              qualityFarmers.map(f => (
                <div key={f.id} className="text-[10px] bg-teal-950/50 border border-teal-500/40 px-2 py-1 rounded text-teal-200 flex items-center justify-between font-mono">
                  <span>{f.tokenNumber}</span>
                  <span className="text-emerald-400 font-bold">13.2% Moist</span>
                </div>
              ))
            )}
          </div>

          <div className="text-[10px] text-teal-300 text-center font-medium">
            Moisture & Refraction Test
          </div>
        </div>

        {/* Stage 5: Procurement & Direct Benefit Transfer (DBT) */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-3.5 space-y-2 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>5. DBT Payment</span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
              {completedFarmers.length} Paid
            </span>
          </div>

          <div className="min-h-[70px] bg-slate-900/80 rounded-xl p-2 border border-slate-800 space-y-1.5">
            {completedFarmers.slice(0, 2).map(f => (
              <div key={f.id} className="text-[10px] bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded text-emerald-200 flex items-center justify-between font-mono">
                <span>{f.tokenNumber}</span>
                <span className="font-bold text-white">₹{f.totalAmount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-emerald-400 text-center font-medium">
            Instant PFMS Payout Trigger
          </div>
        </div>
      </div>
    </div>
  );
};
