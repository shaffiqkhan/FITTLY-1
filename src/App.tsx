/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Camera, 
  Upload, 
  Ruler, 
  User, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShoppingBag,
  Palette,
  Scissors,
  Download
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface Measurements {
  neck: number;
  armLength: number;
  shoulderWidth: number;
  legLength: number;
  chest: number;
  waist: number;
  belly: number;
  hips: number;
  thigh: number;
  inseam: number;
  sleeveLength: number;
  wrist: number;
}

interface Keypoint {
  id: string;
  name: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  pose: 'front' | 'side';
}

interface Recommendation {
  brand: string;
  article: string;
  size: string;
  confidence: number;
  reasoning: string;
  link?: string;
  colorMatch: string;
}

interface UserProfile {
  name: string;
  measurements: Measurements;
  lastUpdated: string;
  unit: 'cm' | 'in';
}

interface GarmentPoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

interface GarmentDimensions {
  shirtLength: number;
  sleeveLength: number;
  shoulder: number;
  collarSize: number;
  trouserLength: number;
  trouserWaist: number;
  waistMeasure: number;
}

const BODY_POINTS_FRONT = [
  { id: 'top_head', name: 'Top of Head' },
  { id: 'neck', name: 'Neck' },
  { id: 'left_shoulder', name: 'Left Shoulder' },
  { id: 'right_shoulder', name: 'Right Shoulder' },
  { id: 'left_elbow', name: 'Left Elbow' },
  { id: 'right_elbow', name: 'Right Elbow' },
  { id: 'left_wrist', name: 'Left Wrist' },
  { id: 'right_wrist', name: 'Right Wrist' },
  { id: 'left_hip', name: 'Left Hip' },
  { id: 'right_hip', name: 'Right Hip' },
  { id: 'left_knee', name: 'Left Knee' },
  { id: 'right_knee', name: 'Right Knee' },
  { id: 'left_ankle', name: 'Left Ankle' },
  { id: 'right_ankle', name: 'Right Ankle' },
  { id: 'waist_left', name: 'Waist Left' },
  { id: 'waist_right', name: 'Waist Right' },
  { id: 'chest_left', name: 'Chest Left' },
  { id: 'chest_right', name: 'Chest Right' },
];

const BODY_POINTS_SIDE = [
  { id: 'side_head', name: 'Side Head' },
  { id: 'side_neck', name: 'Side Neck' },
  { id: 'side_shoulder', name: 'Side Shoulder' },
  { id: 'side_chest', name: 'Side Chest' },
  { id: 'side_waist', name: 'Side Waist' },
  { id: 'side_belly', name: 'Side Belly' },
  { id: 'side_hip', name: 'Side Hip' },
  { id: 'side_knee', name: 'Side Knee' },
  { id: 'side_ankle', name: 'Side Ankle' },
];

const GARMENT_POINTS = [
  { id: 'shirt_top', name: 'Collar/Neck' },
  { id: 'shirt_bottom', name: 'Shirt Hem' },
  { id: 'shoulder_left', name: 'Shoulder Left' },
  { id: 'shoulder_right', name: 'Shoulder Right' },
  { id: 'sleeve_left', name: 'Sleeve Left' },
  { id: 'sleeve_right', name: 'Sleeve Right' },
  { id: 'trouser_waist', name: 'Trouser Waist' },
  { id: 'trouser_bottom', name: 'Trouser Hem' },
];

// --- Components ---

interface FinalizedDesign {
  id: string;
  name: string;
  date: string;
  image: string;
  dimensions: GarmentDimensions;
  unit: 'cm' | 'in';
}

export default function App() {
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [sideImage, setSideImage] = useState<string | null>(null);
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [garmentPoints, setGarmentPoints] = useState<GarmentPoint[]>([]);
  const [garmentDimensions, setGarmentDimensions] = useState<GarmentDimensions | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('');
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [shopSearchContext, setShopSearchContext] = useState<{ measurements: any, color?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'measure' | 'tailor' | 'profile' | 'shop' | 'designs'>('measure');
  const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null);
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const [error, setError] = useState<string | null>(null);
  const [finalizedDesigns, setFinalizedDesigns] = useState<FinalizedDesign[]>([]);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [designName, setDesignName] = useState('');
  const [initialGarmentPoints, setInitialGarmentPoints] = useState<GarmentPoint[]>([]);
  const [initialGarmentDimensions, setInitialGarmentDimensions] = useState<GarmentDimensions | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);
  const frontCaptureRef = useRef<HTMLInputElement>(null);
  const sideCaptureRef = useRef<HTMLInputElement>(null);

  const cmToIn = (cm: number) => (cm / 2.54).toFixed(1);
  const inToCm = (inches: number) => (inches * 2.54).toFixed(1);

  const formatValue = (val: number) => {
    return unit === 'cm' ? `${val} cm` : `${cmToIn(val)} in`;
  };

  // --- AI Logic ---

  const detectKeypoints = async (frontBase64: string | null, sideBase64: string | null) => {
    if (!frontBase64 && !sideBase64) return;
    setIsProcessing(true);
    setKeypoints([]);
    setMeasurements(null);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const parts: any[] = [];
      if (frontBase64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: frontBase64.split(',')[1] } });
      }
      if (sideBase64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: sideBase64.split(',')[1] } });
      }

      parts.push({ text: `Analyze the human body in the provided image(s) (Front and/or Side view). 
      1. Detect keypoints for each view. 
      2. Calculate highly accurate body measurements in centimeters.
      
      Front keypoints: ${BODY_POINTS_FRONT.map(p => p.id).join(', ')}
      Side keypoints: ${BODY_POINTS_SIDE.map(p => p.id).join(', ')}
      
      Measurements to calculate: neck, armLength, shoulderWidth, legLength, chest, waist, belly, hips, thigh, inseam, sleeveLength, wrist.
      
      Return ONLY a JSON object:
      {
        "keypoints": [{"id": "string", "name": "string", "x": number, "y": number, "pose": "front" | "side"}],
        "measurements": { "neck": 0, "armLength": 0, ... }
      }
      
      IMPORTANT: x and y coordinates MUST be percentages from 0 to 100 relative to the image dimensions.` });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      if (result.keypoints) {
        // Normalize coordinates if they are in 0-1 range
        const normalizedKeypoints = result.keypoints.map((kpValue: any) => {
          let { x, y } = kpValue;
          if (x <= 1 && y <= 1 && (x > 0 || y > 0)) {
            x *= 100;
            y *= 100;
          }
          return { ...kpValue, x, y };
        });
        setKeypoints(normalizedKeypoints);
        
        // Robust garment points initialization with fallbacks
        const neck = normalizedKeypoints.find((k: any) => k.id === 'neck') || normalizedKeypoints.find((k: any) => k.pose === 'front');
        const waist = normalizedKeypoints.find((k: any) => k.id === 'waist_left' || k.id === 'waist_right' || k.id === 'side_waist');
        const hip = normalizedKeypoints.find((k: any) => k.id === 'left_hip' || k.id === 'right_hip' || k.id === 'side_hip');
        
        const refX = neck?.x || 50;
        const refY = neck?.y || 20;

        const initialGarmentPoints = [
          { id: 'shirt_top', name: 'Collar Line', x: refX, y: refY },
          { id: 'shirt_bottom', name: 'Shirt Hem', x: refX, y: hip?.y || refY + 40 },
          { id: 'shoulder_left', name: 'Shoulder Left', x: normalizedKeypoints.find((k: any) => k.id === 'left_shoulder')?.x || refX - 10, y: refY },
          { id: 'shoulder_right', name: 'Shoulder Right', x: normalizedKeypoints.find((k: any) => k.id === 'right_shoulder')?.x || refX + 10, y: refY },
          { id: 'sleeve_left', name: 'Sleeve Left', x: normalizedKeypoints.find((k: any) => k.id === 'left_wrist')?.x || refX - 20, y: waist?.y || refY + 20 },
          { id: 'sleeve_right', name: 'Sleeve Right', x: normalizedKeypoints.find((k: any) => k.id === 'right_wrist')?.x || refX + 20, y: waist?.y || refY + 20 },
          { id: 'waist_measure_left', name: 'Waist Left', x: normalizedKeypoints.find((k: any) => k.id === 'waist_left')?.x || refX - 8, y: waist?.y || refY + 30 },
          { id: 'waist_measure_right', name: 'Waist Right', x: normalizedKeypoints.find((k: any) => k.id === 'waist_right')?.x || refX + 8, y: waist?.y || refY + 30 },
          { id: 'trouser_waist', name: 'Trouser Waist', x: refX, y: waist?.y || refY + 30 },
          { id: 'trouser_bottom', name: 'Trouser Hem', x: refX, y: normalizedKeypoints.find((k: any) => k.id === 'left_ankle')?.y || refY + 70 },
        ];
        setGarmentPoints(initialGarmentPoints);
        if (result.measurements) {
          setMeasurements(result.measurements);
        }
        calculateGarmentDimensions(initialGarmentPoints, result.measurements);
      }
    } catch (error) {
      console.error("Keypoint detection failed:", error);
      setError("Failed to analyze body pose. Please try a clearer photo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const matchSize = async () => {
    const contextMeasurements = shopSearchContext?.measurements || measurements;
    if (!contextMeasurements || !url) return;
    setIsMatching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on these measurements (in cm): ${JSON.stringify(contextMeasurements)} and the user's preferred color "${color || shopSearchContext?.color || 'any'}", extract the size chart from the website ${url}.
        Recommend a specific BRAND ARTICLE (cloth item) that best suits the user.
        
        Return a JSON object:
        {
          "brand": "string",
          "article": "string",
          "size": "string",
          "confidence": number,
          "reasoning": "string",
          "link": "string",
          "colorMatch": "string"
        }`,
        config: {
          tools: [{ urlContext: {} }],
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || '{}');
      setRecommendation(result);
    } catch (error) {
      console.error("Size matching failed:", error);
    } finally {
      setIsMatching(false);
    }
  };

  // --- Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, pose: 'front' | 'side') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (pose === 'front') {
          setFrontImage(base64);
          detectKeypoints(base64, sideImage);
        } else {
          setSideImage(base64);
          detectKeypoints(frontImage, base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const recalculateMeasurements = async (updatedKeypoints: Keypoint[]) => {
    if (!frontImage && !sideImage) return;
    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const parts: any[] = [];
      if (frontImage) parts.push({ inlineData: { mimeType: "image/jpeg", data: frontImage.split(',')[1] } });
      if (sideImage) parts.push({ inlineData: { mimeType: "image/jpeg", data: sideImage.split(',')[1] } });

      parts.push({ text: `Based on these updated keypoint coordinates (percentages): ${JSON.stringify(updatedKeypoints)}, recalculate the body measurements in centimeters. 
      Return ONLY a JSON object with the measurements: { "neck": 0, "armLength": 0, "shoulderWidth": 0, "legLength": 0, "chest": 0, "waist": 0, "belly": 0, "hips": 0, "thigh": 0, "inseam": 0, "sleeveLength": 0, "wrist": 0 }` });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || '{}');
      if (result) setMeasurements(result);
    } catch (error) {
      console.error("Recalculation failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateGarmentDimensions = async (points = garmentPoints, currentMeasurements = measurements) => {
    if (!currentMeasurements || points.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on these body measurements: ${JSON.stringify(currentMeasurements)} and these custom garment points (percentages on image): ${JSON.stringify(points)}, calculate the custom garment dimensions in centimeters.
        Return ONLY a JSON object: { "shirtLength": 0, "sleeveLength": 0, "shoulder": 0, "collarSize": 0, "trouserLength": 0, "trouserWaist": 0, "waistMeasure": 0 }`,
        config: { responseMimeType: "application/json" }
      });
      const result = JSON.parse(response.text || '{}');
      setGarmentDimensions(result);
      if (!initialGarmentDimensions) {
        setInitialGarmentDimensions(result);
        setInitialGarmentPoints([...points]);
      }
    } catch (error) {
      console.error("Garment calculation failed:", error);
      setError("Failed to calculate garment dimensions. Please try moving the markers.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGarmentPointDrag = (id: string, x: number, y: number) => {
    setGarmentPoints(prev => {
      const updated = prev.map(gp => gp.id === id ? { ...gp, x, y } : gp);
      
      // Local recalculation for immediate feedback
      if (initialGarmentDimensions && initialGarmentPoints.length > 0) {
        const getDist = (pts: GarmentPoint[], id1: string, id2: string) => {
          const p1 = pts.find(p => p.id === id1);
          const p2 = pts.find(p => p.id === id2);
          if (!p1 || !p2) return 1;
          return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        };

        const newDims = { ...garmentDimensions } as GarmentDimensions;
        
        const pairs: Record<string, [string, string]> = {
          shirtLength: ['shirt_top', 'shirt_bottom'],
          sleeveLength: ['shoulder_left', 'sleeve_left'],
          shoulder: ['shoulder_left', 'shoulder_right'],
          trouserLength: ['trouser_waist', 'trouser_bottom'],
          waistMeasure: ['waist_measure_left', 'waist_measure_right'],
        };

        Object.entries(pairs).forEach(([dimKey, [p1Id, p2Id]]) => {
          const initialDist = getDist(initialGarmentPoints, p1Id, p2Id);
          const currentDist = getDist(updated, p1Id, p2Id);
          const initialVal = (initialGarmentDimensions as any)[dimKey];
          if (initialDist > 0 && initialVal > 0) {
            (newDims as any)[dimKey] = Math.round(initialVal * (currentDist / initialDist));
          }
        });
        
        setGarmentDimensions(newDims);
      }
      
      return updated;
    });
  };

  const handlePointDrag = (id: string, x: number, y: number) => {
    setKeypoints(prev => prev.map(kp => kp.id === id ? { ...kp, x, y } : kp));
  };

  const handlePointDragEnd = () => {
    recalculateMeasurements(keypoints);
  };

  const saveProfile = () => {
    if (measurements) {
      const profile: UserProfile = {
        name: userProfile?.name || "User",
        measurements,
        lastUpdated: new Date().toLocaleDateString(),
        unit
      };
      setUserProfile(profile);
      localStorage.setItem('fitmeasure_profile', JSON.stringify(profile));
      setActiveTab('profile');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('fitmeasure_profile');
    if (saved) setUserProfile(JSON.parse(saved));
    
    const savedDesigns = localStorage.getItem('fitmeasure_designs');
    if (savedDesigns) setFinalizedDesigns(JSON.parse(savedDesigns));
  }, []);

  const handleFinalizeDesign = () => {
    if (!garmentDimensions || !frontImage) return;
    
    const newDesign: FinalizedDesign = {
      id: Math.random().toString(36).substr(2, 9),
      name: designName || `Design ${finalizedDesigns.length + 1}`,
      date: new Date().toLocaleDateString(),
      image: frontImage,
      dimensions: { ...garmentDimensions },
      unit
    };

    const updated = [...finalizedDesigns, newDesign];
    setFinalizedDesigns(updated);
    localStorage.setItem('fitmeasure_designs', JSON.stringify(updated));
    setShowFinalizeModal(false);
    setDesignName('');
    setActiveTab('designs');
  };

  const handlePointDragStart = (e: React.MouseEvent | React.TouchEvent, id: string, type: 'keypoint' | 'garment' = 'keypoint') => {
    e.preventDefault();
    const isTouch = 'touches' in e;
    const moveEvent = isTouch ? 'touchmove' : 'mousemove';
    const upEvent = isTouch ? 'touchend' : 'mouseup';
    
    // Find the container and the image within it to get correct dimensions
    const container = (e.currentTarget as HTMLElement).closest('.relative');
    const img = container?.querySelector('img');
    if (!img) return;

    const onMove = (moveEvent: any) => {
      const rect = img.getBoundingClientRect();
      const clientX = isTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = isTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      
      if (type === 'keypoint') {
        handlePointDrag(id, x, y);
      } else {
        handleGarmentPointDrag(id, x, y);
      }
    };

    const onUp = () => {
      document.removeEventListener(moveEvent, onMove);
      document.removeEventListener(upEvent, onUp);
      if (type === 'keypoint') {
        handlePointDragEnd();
      } else {
        calculateGarmentDimensions();
      }
    };

    document.addEventListener(moveEvent, onMove);
    document.addEventListener(upEvent, onUp);
  };

  // --- Render Helpers ---

  const renderMeasureTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 space-y-8">
        <section className="card-professional min-h-[700px] flex flex-col">
          <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Body Scan Analysis</h2>
              <p className="text-sm text-zinc-500 mt-1">Upload front and side poses for 3D reconstruction</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => { setFrontImage(null); setSideImage(null); setMeasurements(null); setKeypoints([]); }}
                className="p-3 bg-zinc-100 text-zinc-600 rounded-2xl hover:bg-zinc-200 transition-all shadow-sm"
                title="Reset Scan"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-50/50">
            {/* Front Pose */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Front Pose (Required)</label>
              <div className="relative aspect-[3/4] rounded-[2rem] border-2 border-dashed border-zinc-200 bg-white flex flex-col items-center justify-center overflow-hidden group hover:border-emerald-400 transition-all duration-500 shadow-sm">
                {frontImage ? (
                  <div className="relative w-full h-full">
                    <img src={frontImage} alt="Front" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <button onClick={() => frontInputRef.current?.click()} className="p-4 bg-white rounded-2xl shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                        <RefreshCw className="w-6 h-6 text-emerald-600" />
                      </button>
                    </div>
                    {/* Keypoints Overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {keypoints.filter(k => k.pose === 'front').map((kp) => (
                        <g 
                          key={kp.id} 
                          className="pointer-events-auto cursor-move group"
                          onMouseDown={(e) => handlePointDragStart(e, kp.id, 'keypoint')}
                          onTouchStart={(e) => handlePointDragStart(e, kp.id, 'keypoint')}
                        >
                          <circle
                            cx={`${kp.x}%`}
                            cy={`${kp.y}%`}
                            r="5"
                            fill="#10b981"
                            stroke="white"
                            strokeWidth="2"
                            className="group-hover:r-7 transition-all shadow-lg"
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                      <Camera className="w-10 h-10 text-emerald-600" />
                    </div>
                    <div className="flex flex-col gap-3 w-full max-w-[200px] mx-auto">
                      <button 
                        onClick={() => frontInputRef.current?.click()}
                        className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
                      >
                        Upload Front Pose
                      </button>
                      <button 
                        onClick={() => frontCaptureRef.current?.click()}
                        className="w-full py-4 bg-emerald-100 text-emerald-800 rounded-2xl font-bold text-sm hover:bg-emerald-200 transition-all flex items-center justify-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Take Photo
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 mt-6 font-medium">Clear lighting, tight clothing recommended</p>
                  </div>
                )}
                <input type="file" ref={frontInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'front')} />
                <input type="file" ref={frontCaptureRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleImageUpload(e, 'front')} />
              </div>
            </div>

            {/* Side Pose */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Side Pose (Optional)</label>
              <div className="relative aspect-[3/4] rounded-[2rem] border-2 border-dashed border-zinc-200 bg-white flex flex-col items-center justify-center overflow-hidden group hover:border-emerald-400 transition-all duration-500 shadow-sm">
                {sideImage ? (
                  <div className="relative w-full h-full">
                    <img src={sideImage} alt="Side" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <button onClick={() => sideInputRef.current?.click()} className="p-4 bg-white rounded-2xl shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                        <RefreshCw className="w-6 h-6 text-emerald-600" />
                      </button>
                    </div>
                    {/* Keypoints Overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {keypoints.filter(k => k.pose === 'side').map((kp) => (
                        <g 
                          key={kp.id} 
                          className="pointer-events-auto cursor-move group"
                          onMouseDown={(e) => handlePointDragStart(e, kp.id, 'keypoint')}
                          onTouchStart={(e) => handlePointDragStart(e, kp.id, 'keypoint')}
                        >
                          <circle
                            cx={`${kp.x}%`}
                            cy={`${kp.y}%`}
                            r="5"
                            fill="#10b981"
                            stroke="white"
                            strokeWidth="2"
                            className="group-hover:r-7 transition-all shadow-lg"
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                      <Camera className="w-10 h-10 text-zinc-400" />
                    </div>
                    <div className="flex flex-col gap-3 w-full max-w-[200px] mx-auto">
                      <button 
                        onClick={() => sideInputRef.current?.click()}
                        className="w-full py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-all"
                      >
                        Upload Side Pose
                      </button>
                      <button 
                        onClick={() => sideCaptureRef.current?.click()}
                        className="w-full py-4 bg-emerald-100 text-emerald-800 rounded-2xl font-bold text-sm hover:bg-emerald-200 transition-all flex items-center justify-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Take Photo
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 mt-6 font-medium">Helps improve measurement depth</p>
                  </div>
                )}
                <input type="file" ref={sideInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'side')} />
                <input type="file" ref={sideCaptureRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleImageUpload(e, 'side')} />
              </div>
            </div>
          </div>

          <div className="p-8 bg-white border-t border-zinc-100">
            <button 
              disabled={!frontImage || isProcessing}
              onClick={() => detectKeypoints(frontImage, sideImage)}
              className="w-full py-5 bg-zinc-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-4 shadow-2xl shadow-zinc-900/30"
            >
              {isProcessing ? (
                <>
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  AI Engine Analyzing...
                </>
              ) : (
                <>
                  <Maximize2 className="w-6 h-6 text-emerald-400" />
                  Run Precision Analysis
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* Right Column: Measurements & Recommendations */}
      <div className="lg:col-span-4 space-y-8">
        {/* Measurements Card */}
        <section className="card-professional p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
              <Ruler className="w-5 h-5 text-emerald-600" />
              Precise Measurements
            </h2>
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button 
                onClick={() => setUnit('cm')}
                className={clsx("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", unit === 'cm' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400")}
              >
                CM
              </button>
              <button 
                onClick={() => setUnit('in')}
                className={clsx("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", unit === 'in' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400")}
              >
                IN
              </button>
            </div>
          </div>
          
          {!measurements ? (
            <div className="space-y-3 opacity-20">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="h-12 bg-zinc-100 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(measurements).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center p-4 rounded-2xl bg-zinc-50 border border-zinc-100 hover:border-emerald-200 transition-all group">
                    <span className="text-xs font-bold text-zinc-500 capitalize group-hover:text-zinc-900 transition-colors">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="font-mono font-black text-sm text-zinc-900">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
              <button 
                onClick={saveProfile}
                className="w-full mt-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-zinc-900/20"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Save as Size Chart
              </button>
            </div>
          )}
        </section>

        {/* Profile Quick View */}
        {userProfile && (
          <section className="bg-zinc-900 text-white rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl shadow-zinc-900/40">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <User className="w-32 h-32" />
            </div>
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <User className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="font-bold text-lg">{userProfile.name}</div>
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Last Sync: {userProfile.lastUpdated}</div>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('profile')}
                className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Chest</div>
                <div className="font-mono font-black text-emerald-400">{userProfile.measurements.chest}cm</div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Waist</div>
                <div className="font-mono font-black text-emerald-400">{userProfile.measurements.waist}cm</div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <section className="card-professional p-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center shadow-xl shadow-zinc-900/20">
              <User className="text-emerald-400 w-10 h-10" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-zinc-900">Personal Size Chart</h2>
              <p className="text-zinc-500 mt-1">Verified measurements for your digital twin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200/50">
              <button 
                onClick={() => setUnit('cm')}
                className={clsx("px-6 py-2 rounded-xl text-sm font-bold transition-all", unit === 'cm' ? "bg-white shadow-md text-zinc-900" : "text-zinc-400")}
              >
                Centimeters
              </button>
              <button 
                onClick={() => setUnit('in')}
                className={clsx("px-6 py-2 rounded-xl text-sm font-bold transition-all", unit === 'in' ? "bg-white shadow-md text-zinc-900" : "text-zinc-400")}
              >
                Inches
              </button>
            </div>
            {userProfile && (
              <button 
                onClick={() => {
                  const text = `FITTLY - PERSONAL SIZE CHART\nGenerated on: ${userProfile.lastUpdated}\n\n` + 
                    Object.entries(userProfile.measurements)
                      .map(([key, val]) => `${key.replace(/([A-Z])/g, ' $1').toUpperCase()}: ${val} cm (${cmToIn(val)} in)`)
                      .join('\n');
                  const blob = new Blob([text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `fitmeasure_size_chart_${userProfile.lastUpdated.replace(/\//g, '-')}.txt`;
                  a.click();
                }}
                className="p-4 bg-zinc-100 text-zinc-600 rounded-2xl hover:bg-zinc-200 transition-all"
                title="Download Size Chart"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {userProfile ? (
          <div className="space-y-8">
            <div className="overflow-hidden rounded-[2rem] border border-zinc-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50">
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Measurement</th>
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Value</th>
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {Object.entries(userProfile.measurements).map(([key, value]) => (
                    <tr key={key} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-8 py-5 text-sm font-bold text-zinc-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                      <td className="px-8 py-5 font-mono font-black text-zinc-900">{formatValue(value)}</td>
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      </td>
                      <td className="px-8 py-5 text-xs font-medium text-zinc-400">{userProfile.lastUpdated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <button 
              onClick={() => {
                setShopSearchContext({ measurements: userProfile.measurements });
                setRecommendation(null);
                setActiveTab('shop');
              }}
              className="w-full py-5 bg-zinc-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-4 shadow-2xl shadow-zinc-900/30"
            >
              <ShoppingBag className="w-6 h-6 text-emerald-400" />
              Shop with this Size Chart
            </button>
          </div>
        ) : (
          <div className="text-center py-24 bg-zinc-50 rounded-[2.5rem] border border-dashed border-zinc-200">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <User className="w-10 h-10 text-zinc-200" />
            </div>
            <p className="text-zinc-400 font-bold text-lg">No size chart found</p>
            <p className="text-zinc-400 text-sm mt-2 mb-8">Complete a body scan to generate your profile</p>
            <button 
              onClick={() => setActiveTab('measure')}
              className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
            >
              Start Measuring
            </button>
          </div>
        )}
      </section>
    </div>
  );

  const renderShopTab = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <section className="card-professional p-12">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm shadow-emerald-100/50">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-zinc-900">Smart Shopping Assistant</h2>
          <p className="text-zinc-500 mt-2">
            {shopSearchContext 
              ? `Shopping with context: ${shopSearchContext.color || 'Custom'} Design` 
              : "Paste a product URL and we'll find your perfect size"}
          </p>
          {shopSearchContext && (
            <button 
              onClick={() => setShopSearchContext(null)}
              className="mt-4 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
            >
              Clear Shopping Context
            </button>
          )}
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Store URL</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="https://store.com/item" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full p-5 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all pl-14 font-medium"
                />
                <ExternalLink className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-300" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Preferred Color</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="e.g. Midnight Blue" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full p-5 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all pl-14 font-medium"
                />
                <Palette className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-300" />
              </div>
            </div>
          </div>

          <button 
            disabled={(!measurements && !shopSearchContext) || !url || isMatching}
            onClick={matchSize}
            className="w-full py-5 bg-zinc-900 text-white rounded-[1.5rem] font-bold text-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-4 shadow-2xl shadow-zinc-900/30"
          >
            {isMatching ? (
              <>
                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                AI Engine Analyzing Size Charts...
              </>
            ) : (
              <>
                <ShoppingBag className="w-6 h-6 text-emerald-400" />
                Find My Perfect Fit
              </>
            )}
          </button>

          {!measurements && !shopSearchContext && (
            <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-amber-900 uppercase tracking-wider">Measurements Required</p>
                <p className="text-xs text-amber-800/70 mt-1 font-medium leading-relaxed">Please complete your body analysis first to get accurate size recommendations.</p>
              </div>
            </div>
          )}

          <AnimatePresence>
            {recommendation && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="mt-12 p-10 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] relative overflow-hidden shadow-xl shadow-emerald-100/20"
              >
                <div className="absolute top-0 right-0 p-10 opacity-5">
                  <CheckCircle2 className="w-48 h-48 text-emerald-600" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.2em]">Article Recommendation</span>
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{Math.round(recommendation.confidence * 100)}% Confidence</span>
                  </div>
                  
                  <div className="mb-8">
                    <div className="text-sm font-black text-emerald-600 uppercase tracking-[0.2em] mb-2">{recommendation.brand}</div>
                    <div className="text-4xl font-display font-black text-emerald-900 leading-tight mb-4">{recommendation.article}</div>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2.5 px-4 py-2 bg-white/50 rounded-xl border border-emerald-100">
                        <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: recommendation.colorMatch }}></div>
                        <span className="text-xs font-bold text-emerald-800">{recommendation.colorMatch}</span>
                      </div>
                      <div className="text-3xl font-display font-black text-emerald-900">Size: <span className="text-emerald-600">{recommendation.size}</span></div>
                    </div>
                  </div>

                  <div className="max-w-xl">
                    <p className="text-emerald-900/80 leading-relaxed font-medium mb-8 text-lg italic">
                      "{recommendation.reasoning}"
                    </p>
                    
                    {recommendation.link && (
                      <a 
                        href={recommendation.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30"
                      >
                        Buy Now <ExternalLink className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );

  const renderDesignsTab = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Custom Designs</h2>
          <p className="text-zinc-500 font-medium">Your collection of finalized tailoring specifications</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl border border-emerald-100 font-bold text-xs uppercase tracking-widest">
          {finalizedDesigns.length} Designs Saved
        </div>
      </div>

      {finalizedDesigns.length === 0 ? (
        <div className="card-professional p-20 text-center">
          <div className="w-24 h-24 bg-zinc-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
            <Scissors className="w-12 h-12 text-zinc-300" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 mb-2">No designs yet</h3>
          <p className="text-zinc-500 max-w-md mx-auto mb-8">Start tailoring a garment in the Tailor tab and finalize it to see it here.</p>
          <button 
            onClick={() => setActiveTab('tailor')}
            className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
          >
            Go to Tailor Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {finalizedDesigns.map((design) => (
            <div key={design.id} className="card-professional group overflow-hidden flex flex-col">
              <div className="relative aspect-[3/4] bg-zinc-100 overflow-hidden">
                <img 
                  src={design.image} 
                  alt={design.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                <div className="absolute bottom-0 left-0 p-6 w-full">
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{design.date}</div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{design.name}</h3>
                </div>
              </div>
              <div className="p-6 space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(design.dimensions).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="font-mono font-black text-xs text-zinc-900">
                        {design.unit === 'cm' ? `${value}cm` : `${cmToIn(value as number)}in`}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-zinc-100 flex gap-2">
                  <button 
                    onClick={() => {
                      const specs = Object.entries(design.dimensions)
                        .map(([key, val]) => `${key.replace(/([A-Z])/g, ' $1').trim()}: ${design.unit === 'cm' ? val : cmToIn(val as number)} ${design.unit}`)
                        .join('\n');
                      alert(`FULL SPECIFICATIONS for ${design.name}:\n\n${specs}`);
                    }}
                    className="flex-1 py-3 bg-zinc-100 text-zinc-900 rounded-xl font-bold text-xs hover:bg-zinc-200 transition-all"
                  >
                    View Specs
                  </button>
                  <button 
                    onClick={() => {
                      setShopSearchContext({ measurements: design.dimensions, color: design.name });
                      setRecommendation(null);
                      setActiveTab('shop');
                    }}
                    className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                  >
                    <ShoppingBag className="w-3 h-3" />
                    Shop
                  </button>
                  <button 
                    onClick={() => {
                      const updated = finalizedDesigns.filter(d => d.id !== design.id);
                      setFinalizedDesigns(updated);
                      localStorage.setItem('fitmeasure_designs', JSON.stringify(updated));
                    }}
                    className="w-12 h-12 bg-zinc-100 text-zinc-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTailorTab = () => (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-[85vh]">
      <div className="flex-1 flex flex-col min-w-0">
        <section className="card-professional flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-white shrink-0">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-3">
                <Scissors className="w-6 h-6 text-emerald-600" />
                Tailoring Studio
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                <button 
                  onClick={() => setUnit('cm')}
                  className={clsx("px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest", unit === 'cm' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400")}
                >
                  CM
                </button>
                <button 
                  onClick={() => setUnit('in')}
                  className={clsx("px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest", unit === 'in' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400")}
                >
                  IN
                </button>
              </div>
              <button 
                onClick={() => { setGarmentPoints([]); setGarmentDimensions(null); setInitialGarmentDimensions(null); setInitialGarmentPoints([]); }}
                className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-all"
                title="Reset Markers"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-zinc-950 flex items-center justify-center overflow-hidden">
            {error && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-2xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                {error}
                <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">✕</button>
              </div>
            )}
            
            {isProcessing && !frontImage && (
              <div className="absolute inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  <p className="text-emerald-500 font-bold text-sm uppercase tracking-widest">Processing...</p>
                </div>
              </div>
            )}

            {!frontImage ? (
              <div className="text-center text-zinc-500 p-12">
                <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                  <Camera className="w-12 h-12 opacity-20" />
                </div>
                <p className="text-xl font-bold text-zinc-400">No front pose detected</p>
                <p className="text-sm opacity-60 mt-2 max-w-xs mx-auto">Upload a photo in the Measure tab to start your custom tailoring session</p>
                <button 
                  onClick={() => setActiveTab('measure')}
                  className="mt-8 px-8 py-4 bg-zinc-800 text-white rounded-2xl font-bold text-sm hover:bg-zinc-700 transition-all"
                >
                  Go to Measure
                </button>
              </div>
            ) : garmentPoints.length === 0 ? (
              <div className="text-center text-zinc-500 p-12">
                <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                  <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin" />
                </div>
                <p className="text-xl font-bold text-zinc-400">Initializing Studio...</p>
                <p className="text-sm opacity-60 mt-2">Identifying tailoring points on your pose</p>
                <button 
                  onClick={() => {
                    const fallbackPoints = [
                      { id: 'shirt_top', name: 'Collar Line', x: 50, y: 20 },
                      { id: 'shirt_bottom', name: 'Shirt Hem', x: 50, y: 60 },
                      { id: 'shoulder_left', name: 'Shoulder Left', x: 40, y: 20 },
                      { id: 'shoulder_right', name: 'Shoulder Right', x: 60, y: 20 },
                      { id: 'sleeve_left', name: 'Sleeve Left', x: 30, y: 40 },
                      { id: 'sleeve_right', name: 'Sleeve Right', x: 70, y: 40 },
                      { id: 'waist_measure_left', name: 'Waist Left', x: 42, y: 50 },
                      { id: 'waist_measure_right', name: 'Waist Right', x: 58, y: 50 },
                      { id: 'trouser_waist', name: 'Trouser Waist', x: 50, y: 50 },
                      { id: 'trouser_bottom', name: 'Trouser Hem', x: 50, y: 90 },
                    ];
                    setGarmentPoints(fallbackPoints);
                    if (measurements) calculateGarmentDimensions(fallbackPoints, measurements);
                  }}
                  className="mt-6 px-6 py-3 bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold hover:bg-zinc-700 transition-all"
                >
                  Manual Initialize
                </button>
              </div>
            ) : (
              <div className="relative h-full w-full flex items-center justify-center p-4">
                <div className="relative h-full max-w-full shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-900">
                  <img 
                    src={frontImage} 
                    alt="Tailoring" 
                    className="block h-full w-auto object-contain select-none opacity-70 grayscale"
                    referrerPolicy="no-referrer"
                    onDragStart={(e) => e.preventDefault()}
                  />
                  {/* Garment Visualization Overlay */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
                    {/* Body Keypoint References */}
                    {keypoints.filter(kp => kp.pose === 'front').map(kp => (
                      <circle
                        key={`ref-${kp.id}`}
                        cx={`${kp.x}%`}
                        cy={`${kp.y}%`}
                        r="3"
                        fill="#10b981"
                        fillOpacity="0.3"
                        className="drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]"
                      />
                    ))}

                    {/* Measurement Lines */}
                    {/* Shirt Length */}
                    <line 
                      x1={`${garmentPoints.find(p => p.id === 'shirt_top')?.x}%`}
                      y1={`${garmentPoints.find(p => p.id === 'shirt_top')?.y}%`}
                      x2={`${garmentPoints.find(p => p.id === 'shirt_bottom')?.x}%`}
                      y2={`${garmentPoints.find(p => p.id === 'shirt_bottom')?.y}%`}
                      stroke={selectedMeasurement === 'shirtLength' ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}
                      strokeWidth={selectedMeasurement === 'shirtLength' ? '4' : '2'}
                      strokeDasharray="5 5"
                    />

                    {/* Sleeve Length Left */}
                    <line 
                      x1={`${garmentPoints.find(p => p.id === 'shoulder_left')?.x}%`}
                      y1={`${garmentPoints.find(p => p.id === 'shoulder_left')?.y}%`}
                      x2={`${garmentPoints.find(p => p.id === 'sleeve_left')?.x}%`}
                      y2={`${garmentPoints.find(p => p.id === 'sleeve_left')?.y}%`}
                      stroke={selectedMeasurement === 'sleeveLength' ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}
                      strokeWidth={selectedMeasurement === 'sleeveLength' ? '4' : '2'}
                      strokeDasharray="5 5"
                    />

                    {/* Shoulder Width */}
                    <line 
                      x1={`${garmentPoints.find(p => p.id === 'shoulder_left')?.x}%`}
                      y1={`${garmentPoints.find(p => p.id === 'shoulder_left')?.y}%`}
                      x2={`${garmentPoints.find(p => p.id === 'shoulder_right')?.x}%`}
                      y2={`${garmentPoints.find(p => p.id === 'shoulder_right')?.y}%`}
                      stroke={selectedMeasurement === 'shoulder' ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}
                      strokeWidth={selectedMeasurement === 'shoulder' ? '4' : '2'}
                      strokeDasharray="5 5"
                    />

                    {/* Trouser Length */}
                    <line 
                      x1={`${garmentPoints.find(p => p.id === 'trouser_waist')?.x}%`}
                      y1={`${garmentPoints.find(p => p.id === 'trouser_waist')?.y}%`}
                      x2={`${garmentPoints.find(p => p.id === 'trouser_bottom')?.x}%`}
                      y2={`${garmentPoints.find(p => p.id === 'trouser_bottom')?.y}%`}
                      stroke={selectedMeasurement === 'trouserLength' ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}
                      strokeWidth={selectedMeasurement === 'trouserLength' ? '4' : '2'}
                      strokeDasharray="5 5"
                    />

                    {/* Waist Measure */}
                    <line 
                      x1={`${garmentPoints.find(p => p.id === 'waist_measure_left')?.x}%`}
                      y1={`${garmentPoints.find(p => p.id === 'waist_measure_left')?.y}%`}
                      x2={`${garmentPoints.find(p => p.id === 'waist_measure_right')?.x}%`}
                      y2={`${garmentPoints.find(p => p.id === 'waist_measure_right')?.y}%`}
                      stroke={selectedMeasurement === 'waistMeasure' ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}
                      strokeWidth={selectedMeasurement === 'waistMeasure' ? '4' : '2'}
                      strokeDasharray="5 5"
                    />
                    
                    {garmentPoints.map((gp) => {
                      const isRelevant = !selectedMeasurement || 
                        (selectedMeasurement === 'shirtLength' && (gp.id === 'shirt_top' || gp.id === 'shirt_bottom')) ||
                        (selectedMeasurement === 'sleeveLength' && (gp.id === 'shoulder_left' || gp.id === 'sleeve_left' || gp.id === 'shoulder_right' || gp.id === 'sleeve_right')) ||
                        (selectedMeasurement === 'shoulder' && (gp.id === 'shoulder_left' || gp.id === 'shoulder_right')) ||
                        (selectedMeasurement === 'trouserLength' && (gp.id === 'trouser_waist' || gp.id === 'trouser_bottom')) ||
                        (selectedMeasurement === 'waistMeasure' && (gp.id === 'waist_measure_left' || gp.id === 'waist_measure_right'));

                      return (
                        <g 
                          key={gp.id} 
                          className={clsx(
                            "pointer-events-auto cursor-grab active:cursor-grabbing group transition-opacity duration-300",
                            isRelevant ? "opacity-100" : "opacity-20 hover:opacity-100"
                          )}
                          onMouseDown={(e) => handlePointDragStart(e, gp.id, 'garment')}
                          onTouchStart={(e) => handlePointDragStart(e, gp.id, 'garment')}
                        >
                          <circle
                            cx={`${gp.x}%`}
                            cy={`${gp.y}%`}
                            r={isRelevant ? "12" : "8"}
                            fill="#10b981"
                            stroke="white"
                            strokeWidth="2"
                            className="drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] group-hover:r-14 transition-all"
                          />
                          <circle
                            cx={`${gp.x}%`}
                            cy={`${gp.y}%`}
                            r="4"
                            fill="white"
                          />
                          <foreignObject
                            x={`${gp.x - 10}%`}
                            y={`${gp.y + 3}%`}
                            width="20%"
                            height="40"
                            className="pointer-events-none"
                          >
                            <div className="flex justify-center">
                              <span className="bg-zinc-900 text-white text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap border border-emerald-500/50 shadow-xl uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                {gp.name}
                              </span>
                            </div>
                          </foreignObject>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">
        <section className="card-professional p-6 flex flex-col flex-1">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900">
              <Ruler className="w-5 h-5 text-emerald-600" />
              Garment Specs
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {garmentDimensions ? (
              Object.entries(garmentDimensions).map(([key, value]) => (
                <button 
                  key={key} 
                  onClick={() => setSelectedMeasurement(selectedMeasurement === key ? null : key)}
                  className={clsx(
                    "w-full flex justify-between items-center p-4 rounded-2xl border transition-all group text-left",
                    selectedMeasurement === key 
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                      : "bg-zinc-50 border-zinc-100 hover:border-emerald-200 text-zinc-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                      selectedMeasurement === key ? "bg-white/20" : "bg-white"
                    )}>
                      <Scissors className={clsx("w-4 h-4", selectedMeasurement === key ? "text-white" : "text-emerald-600")} />
                    </div>
                    <span className={clsx(
                      "text-xs font-bold capitalize",
                      selectedMeasurement === key ? "text-white" : "text-zinc-500"
                    )}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                  <span className="font-mono font-black text-sm">{formatValue(value)}</span>
                </button>
              ))
            ) : (
              <div className="space-y-3 opacity-20">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-16 bg-zinc-100 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => setShowFinalizeModal(true)}
            disabled={!garmentDimensions || isProcessing}
            className="w-full mt-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-xl shadow-zinc-900/20"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Finalize Design
          </button>
        </section>
      </div>

      {/* Finalize Modal */}
      <AnimatePresence>
        {showFinalizeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">Finalize Your Design?</h3>
              <p className="text-zinc-500 mb-8">This will save your custom tailoring specifications to your collection.</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Design Name</label>
                  <input 
                    type="text" 
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    placeholder="e.g., Summer Linen Shirt"
                    className="w-full mt-2 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowFinalizeModal(false)}
                  className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleFinalizeDesign}
                  className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
                >
                  Confirm & Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFC] text-zinc-900 font-sans selection:bg-emerald-100">
      {/* Navigation */}
      <nav className="glass-nav px-6 py-4 no-print">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg shadow-zinc-900/20">
              <Ruler className="text-emerald-400 w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl tracking-tight leading-none">FITTLY</h1>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">Digital Tailoring Studio</p>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center bg-zinc-100/80 p-1.5 rounded-[1.25rem] border border-zinc-200/50">
            {[
              { id: 'measure', label: 'Measure', icon: Camera },
              { id: 'tailor', label: 'Tailor', icon: Scissors },
              { id: 'designs', label: 'Designs', icon: Scissors },
              { id: 'profile', label: 'Size Chart', icon: User },
              { id: 'shop', label: 'Shop', icon: ShoppingBag },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  "flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                  activeTab === tab.id 
                    ? "bg-white shadow-md text-zinc-900" 
                    : "text-zinc-400 hover:text-zinc-600 hover:bg-white/50"
                )}
              >
                <tab.icon className={clsx("w-4 h-4", activeTab === tab.id ? "text-emerald-500" : "text-zinc-400")} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-100/50">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">AI Engine Active</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 pb-32 lg:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {activeTab === 'measure' && renderMeasureTab()}
            {activeTab === 'tailor' && renderTailorTab()}
            {activeTab === 'designs' && renderDesignsTab()}
            {activeTab === 'profile' && renderProfileTab()}
            {activeTab === 'shop' && renderShopTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-zinc-100 px-6 py-4 z-[100] no-print">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {[
            { id: 'measure', icon: Camera, label: 'Measure' },
            { id: 'tailor', icon: Scissors, label: 'Tailor' },
            { id: 'designs', icon: Scissors, label: 'Designs' },
            { id: 'profile', icon: User, label: 'Profile' },
            { id: 'shop', icon: ShoppingBag, label: 'Shop' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "flex flex-col items-center gap-1 transition-all",
                activeTab === tab.id ? "text-emerald-600" : "text-zinc-400"
              )}
            >
              <tab.icon className={clsx("w-5 h-5", activeTab === tab.id ? "fill-emerald-600/10" : "")} />
              <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-12 text-center no-print">
        <div className="w-full h-px bg-zinc-200/50 mb-12"></div>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 opacity-20 grayscale">
            <Ruler className="w-5 h-5" />
            <span className="font-display font-bold tracking-tighter">FITTLY</span>
          </div>
          <p className="text-zinc-400 text-sm font-medium">© 2026 FITTLY • Precision Sizing for Everyone</p>
          <div className="flex gap-6 mt-2">
            <a href="#" className="text-xs font-bold text-zinc-300 hover:text-zinc-500 transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs font-bold text-zinc-300 hover:text-zinc-500 transition-colors">Terms of Service</a>
            <a href="#" className="text-xs font-bold text-zinc-300 hover:text-zinc-500 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
