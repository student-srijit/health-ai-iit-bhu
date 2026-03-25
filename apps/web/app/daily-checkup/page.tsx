"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Activity, BrainCircuit, HeartPulse, Loader2 } from "lucide-react";

export default function DailyCheckup() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<"idle" | "running" | "processing">("idle");
  const [timeLeft, setTimeLeft] = useState(15);
  const [textEntry, setTextEntry] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [baselineMap, setBaselineMap] = useState(90);
  
  // Data Streams
  const greenChannelRef = useRef<number[]>([]);
  const dwellTimes = useRef<number[]>([]);
  const flightTimes = useRef<number[]>([]);
  const imuAccel = useRef<number[]>([]);
  const lastKeyTime = useRef<number>(Date.now());

  useEffect(() => {
    const handleMotion = (e: DeviceMotionEvent) => {
      if (sessionState === "running" && e.accelerationIncludingGravity) {
        const { x, y, z } = e.accelerationIncludingGravity;
        const mag = Math.sqrt((x||0)**2 + (y||0)**2 + (z||0)**2);
        imuAccel.current.push(mag);
      }
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [sessionState]);

  const handleKeyDown = () => {
    if (sessionState !== "running") return;
    const now = Date.now();
    const flight = now - lastKeyTime.current;
    if (flight < 2000) flightTimes.current.push(flight);
    lastKeyTime.current = now;
  };

  const handleKeyUp = () => {
    if (sessionState !== "running") return;
    const now = Date.now();
    const dwell = now - lastKeyTime.current;
    dwellTimes.current.push(dwell);
  };

  const startSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      setSessionState("running");
      setTimeLeft(15);
      greenChannelRef.current = [];
      dwellTimes.current = [];
      flightTimes.current = [];
      imuAccel.current = [];
      
      // Extract rPPG Green Channel every 33ms (~30fps)
      const interval = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        
        ctx.drawImage(videoRef.current, 0, 0, 64, 64);
        const frame = ctx.getImageData(0, 0, 64, 64);
        let greenSum = 0;
        for (let i = 1; i < frame.data.length; i += 4) {
          greenSum += frame.data[i]; // Green channel
        }
        greenChannelRef.current.push(greenSum / (64 * 64));
      }, 33);

      // Countdown Timer
      let t = 15;
      const count = setInterval(() => {
        t -= 1;
        setTimeLeft(t);
        if (t <= 0) {
          clearInterval(interval);
          clearInterval(count);
          finishSession();
        }
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("Please allow camera permissions for rPPG Vitals tracking.");
    }
  };

  const finishSession = async () => {
    if (!textEntry.trim()) {
      alert("Please enter your daily journal before running checkup.");
      setSessionState("idle");
      return;
    }

    setSessionState("processing");
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

    try {
      const durationSec = 15;
      const payload = {
        text: textEntry,
        baselineMap,
        ppgSamplingRateHz: greenChannelRef.current.length / durationSec,
        kineticareSamplingRateHz: imuAccel.current.length / durationSec,
        dwellTimes: dwellTimes.current,
        flightTimes: flightTimes.current,
        imuAccelMagnitude: imuAccel.current,
        green_channel: greenChannelRef.current
      };

      const res = await fetch("/api/unified-checkup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      // Store globally for the report dashboard
      localStorage.setItem("kinetiCare_latestReport", JSON.stringify(data));
      router.push("/patient-report");
      
    } catch (error) {
      console.error("Processing failed:", error);
      setSessionState("idle");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Omni-Sensing Clinical Capture
          </h1>
          <p className="text-slate-400">
            Simultaneously extracting rPPG Vitals, Neuromotor Tremors, and Linguistic Phenotypes without traditional medical hardware.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Camera Feed for rPPG */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video border-2 border-slate-800 flex items-center justify-center">
            {sessionState === "idle" && <Camera className="w-12 h-12 text-slate-700" />}
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover absolute inset-0 opacity-80" />
            <canvas ref={canvasRef} width={64} height={64} className="hidden" />
            
            {sessionState === "running" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border-4 border-teal-500/30 rounded-full animate-pulse flex items-center justify-center">
                  <div className="w-24 h-24 border-2 border-teal-400/50 rounded-full animate-ping" />
                </div>
              </div>
            )}
          </div>

          {/* Active Status Display */}
          <div className="bg-slate-800/50 rounded-xl p-6 flex flex-col justify-center gap-4">
            <div className="flex items-center gap-4">
              <HeartPulse className={\`w-6 h-6 \${sessionState === "running" ? "text-rose-500 animate-bounce" : "text-slate-600"}\`} />
              <div>
                <div className="text-sm text-slate-400">Facial rPPG</div>
                <div className="font-medium text-slate-200">Tracking Vitals</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Activity className={\`w-6 h-6 \${sessionState === "running" ? "text-amber-500 animate-pulse" : "text-slate-600"}\`} />
              <div>
                <div className="text-sm text-slate-400">KinetiCare IMU</div>
                <div className="font-medium text-slate-200">Recording Micro-tremors</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <BrainCircuit className={\`w-6 h-6 \${sessionState === "running" ? "text-blue-500 animate-pulse" : "text-slate-600"}\`} />
              <div>
                <div className="text-sm text-slate-400">Keystroke Dynamics</div>
                <div className="font-medium text-slate-200">Analyzing Dwell/Flight</div>
              </div>
            </div>
          </div>
        </div>

        {/* Journal Entry */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-teal-400 mb-2">
            Daily Physical & Mental Journal (Required)
          </label>
          <textarea
            value={textEntry}
            onChange={(e) => setTextEntry(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            disabled={sessionState !== "running"}
            placeholder={sessionState === "running" ? "Begin typing your journal entry now..." : "Click 'Start Diagnostic Capture' below to begin."}
            className="w-full h-32 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-teal-400 mb-2">
            Baseline MAP (mmHg)
          </label>
          <input
            type="number"
            min={50}
            max={200}
            value={baselineMap}
            onChange={(e) => setBaselineMap(Number(e.target.value))}
            className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center">
          {sessionState === "idle" && (
            <button
              onClick={startSession}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98]"
            >
              Start Diagnostic Capture
            </button>
          )}

          {sessionState === "running" && (
            <div className="w-full">
              <div className="flex justify-between text-sm mb-2 text-slate-300">
                <span>Hold Phone Steady</span>
                <span className="font-mono text-teal-400">{timeLeft}s remaining</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-400 to-blue-500 transition-all duration-1000 ease-linear"
                  style={{ width: \`\${(timeLeft / 15) * 100}%\` }}
                />
              </div>
            </div>
          )}

          {sessionState === "processing" && (
            <div className="flex items-center gap-3 text-teal-400 font-medium">
              <Loader2 className="w-6 h-6 animate-spin" />
              Ingesting 5-Stream Pipeline...
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
