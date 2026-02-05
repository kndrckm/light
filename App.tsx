import React, { useState } from 'react';
import { CanvasEditor } from './components/CanvasEditor';
import { Download, X } from 'lucide-react';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [generatedImages, setGeneratedImages] = useState<string[] | null>(null);

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `relit-image-${Date.now()}-${index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white font-sans selection:bg-blue-500/40 flex flex-col">
      {/* Main Content - No Padding for Edge-to-Edge */}
      <main className="flex-1 w-full h-full relative">
        <CanvasEditor onImageGenerated={setGeneratedImages} />
      </main>

      {/* Generated Result Modal - iOS Sheet Style */}
      {generatedImages && generatedImages.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-200">
          <div className="bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h2 className="text-xl font-semibold text-white tracking-tight">Results</h2>
              <Button 
                variant="ghost" 
                onClick={() => setGeneratedImages(null)}
                className="!p-2 hover:bg-white/10 rounded-full"
              >
                <X size={20} />
              </Button>
            </div>
            
            {/* Content Grid */}
            <div className={`flex-1 overflow-auto p-6 bg-black/20 grid gap-6 ${generatedImages.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 flex justify-center items-center'}`}>
              {generatedImages.map((imgUrl, idx) => (
                <div key={idx} className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-black/40">
                   <img 
                    src={imgUrl} 
                    alt={`Result ${idx + 1}`} 
                    className="w-full h-full object-contain max-h-[60vh]"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex justify-center">
                    <Button 
                      variant="primary" 
                      onClick={() => handleDownload(imgUrl, idx)}
                      icon={<Download size={16} />}
                      className="shadow-xl px-6"
                    >
                      Save to Photos
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;