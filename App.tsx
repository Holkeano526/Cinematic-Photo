import React, { useState, useRef, useCallback, useEffect } from 'react';
import Layout from './components/Layout';
import { ModelType, GenerationConfig, GenerationResult } from './types';
import { GeminiService } from './services/geminiService';

// Fix: Added readonly modifier to aistudio declaration to match global definitions and resolve the TypeScript error.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    readonly aistudio: AIStudio;
  }
}

const DEFAULT_PROMPT = "Una fotografía nocturna dramática con flash directo. El sujeto está de pie con confianza sobre suelo nevado frente a una imponente catedral gótica de piedra oscura. La persona mantiene su parecido facial y sus accesorios como esta en el [input image] pero lleva puesto un tuxedo, medias negras transparentes, botas de cuero. Apunta con una pistola compacta directamente a la cámara mientras sujeta con fuerza una pesada correa de cadena. A su lado, un musculoso Doberman se lanza hacia adelante a medio gruñido, con la boca abierta y los dientes desnudos, congelado en detalle nítido por el flashazo. Detrás de ellos, un Lamborghini Aventador rojo con las puertas de tijera abiertas capta fragmentos de luz. Aire frío de invierno, nieve dispersa, sombras profundas, tensión cinematográfica.";

const App: React.FC = () => {
  const [prompt] = useState(DEFAULT_PROMPT); // Removed setPrompt as it's no longer used for editing
  const [model, setModel] = useState<ModelType>(ModelType.FLASH);
  const [aspectRatio, setAspectRatio] = useState<GenerationConfig['aspectRatio']>("16:9");
  const [imageSize, setImageSize] = useState<GenerationConfig['imageSize']>("1K");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geminiService = GeminiService.getInstance();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const checkAndGenerate = async () => {
    setError(null);

    // If using PRO model, must ensure API key is selected
    if (model === ModelType.PRO) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        try {
          await window.aistudio.openSelectKey();
          // Instructions: assume success and proceed after openSelectKey
        } catch (e) {
          setError("Failed to open key selection dialog.");
          return;
        }
      }
    }

    triggerGeneration();
  };

  const triggerGeneration = async () => {
    setIsGenerating(true);
    try {
      const imageUrl = await geminiService.generateImage(
        prompt,
        model,
        referenceImage || undefined,
        { aspectRatio, imageSize }
      );

      const newResult: GenerationResult = {
        imageUrl,
        prompt,
        timestamp: Date.now(),
        model
      };

      setHistory(prev => [newResult, ...prev]);
    } catch (err: any) {
      if (err.message === "API_KEY_ERROR") {
        setError("API Session expired or key invalid. Please re-select your key.");
        if (model === ModelType.PRO) {
          await window.aistudio.openSelectKey();
        }
      } else {
        setError(err.message || "An unexpected error occurred during generation.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
        
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <i className="fas fa-sliders text-red-500"></i> Studio Controls
            </h2>

            {/* Reference Image Upload */}
            <div className="space-y-4 mb-8">
              <label className="text-sm font-medium text-gray-400 block">Reference Portrait</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative group h-40 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden
                  ${referenceImage ? 'border-red-500/50' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}
              >
                {referenceImage ? (
                  <>
                    <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs font-bold text-white uppercase tracking-widest">Change Image</span>
                    </div>
                  </>
                ) : (
                  <>
                    <i className="fas fa-cloud-upload-alt text-2xl mb-2 text-gray-500 group-hover:text-red-400 transition-colors"></i>
                    <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">Drop or Click to upload reference</p>
                  </>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-4 mb-8">
              <label className="text-sm font-medium text-gray-400 block">Engine Precision</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-lg border border-white/10">
                <button 
                  onClick={() => setModel(ModelType.FLASH)}
                  className={`py-2 px-3 rounded text-xs font-bold transition-all ${model === ModelType.FLASH ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:text-white'}`}
                >
                  FLASH 2.5
                </button>
                <button 
                  onClick={() => setModel(ModelType.PRO)}
                  className={`py-2 px-3 rounded text-xs font-bold transition-all ${model === ModelType.PRO ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-gray-500 hover:text-white'}`}
                >
                  PRO 3 (2K/4K)
                </button>
              </div>
              {model === ModelType.PRO && (
                <p className="text-[10px] text-amber-500/80 uppercase tracking-tighter italic">
                  *Requires Billing-enabled project. Use only for final production.
                </p>
              )}
            </div>

            {/* Prompt Area (REMOVED UI - Fixed Backend) */}

            {/* Dimensions */}
            <div className="space-y-4 mb-8">
              <label className="text-sm font-medium text-gray-400 block">Aspect Ratio</label>
              <div className="flex flex-wrap gap-2">
                {(["1:1", "4:3", "16:9", "9:16", "3:4"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all ${aspectRatio === ratio ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {model === ModelType.PRO && (
               <div className="space-y-4 mb-8">
               <label className="text-sm font-medium text-gray-400 block">Output Resolution</label>
               <div className="flex gap-2">
                 {(["1K", "2K", "4K"] as const).map((size) => (
                   <button
                     key={size}
                     onClick={() => setImageSize(size)}
                     className={`flex-1 py-1.5 rounded-md text-[10px] font-bold border transition-all ${imageSize === size ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}
                   >
                     {size}
                   </button>
                 ))}
               </div>
             </div>
            )}

            <button 
              disabled={isGenerating}
              onClick={checkAndGenerate}
              className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-2
                ${isGenerating 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-900/40 active:scale-[0.98]'}`}
            >
              {isGenerating ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i> Synthesizing...
                </>
              ) : (
                <>
                  <i className="fas fa-bolt"></i> Generate Masterpiece
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-xs flex items-center gap-2">
                <i className="fas fa-exclamation-triangle"></i>
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Preview Area */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-[#070707] border border-white/5 shadow-2xl group">
            {history.length > 0 ? (
              <div className="w-full h-full relative">
                <img 
                  src={history[0].imageUrl} 
                  alt="Current Output" 
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 cinematic-gradient p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="flex justify-between items-end">
                      <div>
                        <span className="text-xs text-red-500 font-black uppercase tracking-widest block mb-1">Generated Output</span>
                        <h3 className="text-lg font-bold text-white truncate max-w-md">{history[0].prompt.substring(0, 60)}...</h3>
                        <p className="text-xs text-gray-400 mt-1 uppercase tracking-tighter">{history[0].model} • {new Date(history[0].timestamp).toLocaleTimeString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = history[0].imageUrl;
                            link.download = `cinematic-gen-${history[0].timestamp}.png`;
                            link.click();
                          }}
                          className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg text-white text-xs font-bold transition-all"
                        >
                          <i className="fas fa-download mr-2"></i> Save
                        </button>
                      </div>
                   </div>
                </div>
              </div>
            ) : isGenerating ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center">
                <div className="w-24 h-24 mb-6 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-red-900/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-red-600 border-t-transparent animate-spin"></div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Capturing the Moment</h3>
                <p className="text-gray-500 max-w-md">Our neural engine is rendering the scene with high-intensity direct flash parameters. Gothic architecture being reconstructed...</p>
                <div className="mt-8 w-64 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 shimmer"></div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <i className="fas fa-image text-3xl text-gray-700"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-400 mb-2">Studio Empty</h3>
                <p className="text-gray-600 max-w-xs">Upload a reference photo and hit generate to see the cinematic magic unfold.</p>
              </div>
            )}
          </div>

          {/* History / Gallery */}
          {history.length > 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <i className="fas fa-history"></i> Production History
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {history.slice(1).map((item, idx) => (
                  <div 
                    key={item.timestamp} 
                    className="aspect-square rounded-xl overflow-hidden border border-white/5 bg-[#111] hover:border-red-500/50 transition-all cursor-pointer group"
                    onClick={() => {
                       // Move selected to front
                       const newHistory = [...history];
                       const selected = newHistory.splice(idx + 1, 1)[0];
                       setHistory([selected, ...newHistory]);
                    }}
                  >
                    <img src={item.imageUrl} alt={`Gen ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default App;