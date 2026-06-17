import React, { useState, useCallback, useEffect } from "react";
import { UploadZone } from "@/components/UploadZone";
import { ImageCard } from "@/components/ImageCard";
import { GlobalControls, GlobalSettings } from "@/components/GlobalControls";
import { DownloadButton } from "@/components/DownloadButton";
import { ImageEditState, defaultSettings, analyzeImage } from "@/lib/image-processing";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2, Trash2, Sparkles, Images } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const GLOBAL_DEFAULT: GlobalSettings = {
  brightness: 100, contrast: 100, saturation: 100,
  hue: 0, blur: 0, sharpen: 0, denoise: 0, clarity: 0,
};

function PixelBatch() {
  const [images, setImages] = useState<ImageEditState[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(GLOBAL_DEFAULT);
  const [aiProgress, setAiProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => { images.forEach((img) => URL.revokeObjectURL(img.previewUrl)); };
  }, []);

  const handleImagesSelected = useCallback((files: File[]) => {
    const newImages: ImageEditState[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      dimensions: null,
      ...defaultSettings,
      aiAdjusted: false,
    }));
    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const handleUpdateImage = useCallback((id: string, updates: Partial<ImageEditState>) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...updates } : img)));
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const toRemove = prev.find((i) => i.id === id);
      if (toRemove) URL.revokeObjectURL(toRemove.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleResetImage = useCallback(
    (id: string) => {
      handleUpdateImage(id, { ...defaultSettings, aiAdjusted: false, aiAnalysis: undefined });
    },
    [handleUpdateImage]
  );

  const handleGlobalUpdate = (key: string, value: number) => {
    setGlobalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyToAll = () => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        brightness: globalSettings.brightness,
        contrast:   globalSettings.contrast,
        saturation: globalSettings.saturation,
        hue:        globalSettings.hue,
        blur:       globalSettings.blur,
        sharpen:    globalSettings.sharpen,
        denoise:    globalSettings.denoise,
        clarity:    globalSettings.clarity,
        aiAdjusted: false,
      }))
    );
    toast({ title: "Applied to all", description: `Settings applied to ${images.length} image${images.length !== 1 ? 's' : ''}.` });
  };

  const handleResetAll = () => {
    setImages((prev) => prev.map((img) => ({ ...img, ...defaultSettings, aiAdjusted: false, aiAnalysis: undefined })));
    setGlobalSettings(GLOBAL_DEFAULT);
    toast({ title: "Reset complete", description: "All images restored to defaults." });
  };

  const handleAiAutoAdjust = async () => {
    if (images.length === 0) return;
    setAiProgress({ current: 0, total: images.length });

    const results: ImageEditState[] = [];
    let errorCount = 0;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const analysis = await analyzeImage(img.previewUrl);
        results.push({
          ...img,
          brightness: analysis.brightness,
          contrast:   analysis.contrast,
          saturation: analysis.saturation,
          hue:        analysis.hue,
          sharpen:    analysis.sharpen,
          denoise:    analysis.denoise,
          clarity:    analysis.clarity,
          aiAdjusted: true,
          aiAnalysis: analysis.aiAnalysis,
        });
      } catch {
        results.push(img);
        errorCount++;
      }
      setAiProgress({ current: i + 1, total: images.length });
    }

    setImages(results);
    setAiProgress(null);

    toast({
      title: errorCount === 0 ? "AI Adjust complete" : "Partial success",
      description: errorCount === 0
        ? `Optimized ${images.length} image${images.length !== 1 ? 's' : ''} — color, clarity, sharpness & denoise.`
        : `${images.length - errorCount} adjusted; ${errorCount} failed.`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const handleClearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  const totalSize = images.reduce((acc, img) => acc + img.file.size, 0);
  const formattedSize = totalSize === 0 ? "0 B"
    : totalSize < 1024 * 1024 ? (totalSize / 1024).toFixed(1) + " KB"
    : (totalSize / (1024 * 1024)).toFixed(2) + " MB";

  const isProcessingAi = aiProgress !== null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-none">PixelBatch</h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Pro Image Editor</p>
            </div>
          </div>

          {images.length > 0 && (
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-xs text-muted-foreground hidden md:inline shrink-0">
                <span className="font-medium text-foreground">{images.length}</span> images · {formattedSize}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAiAutoAdjust}
                disabled={isProcessingAi}
                className="gap-1.5 shrink-0 h-9 text-xs"
                data-testid="btn-ai-adjust"
              >
                {isProcessingAi
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Wand2 className="w-3.5 h-3.5 text-primary" />}
                {isProcessingAi
                  ? `Analyzing ${aiProgress.current}/${aiProgress.total}…`
                  : "AI Auto-Adjust"}
              </Button>

              <DownloadButton images={images} />
            </div>
          )}
        </div>

        {isProcessingAi && (
          <Progress value={(aiProgress.current / aiProgress.total) * 100} className="h-0.5 rounded-none" />
        )}
      </header>

      <main className="container mx-auto px-4 py-8">
        {images.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                <Images className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-3">Batch editing, instantly.</h2>
              <p className="text-muted-foreground text-base leading-relaxed max-w-lg mx-auto">
                Upload images, apply presets and manual adjustments, run AI analysis, then export a pixel-enhanced ZIP in one click.
              </p>
            </div>
            <UploadZone onImagesSelected={handleImagesSelected} />

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { icon: "🎨", title: "8 Presets", desc: "Vivid, B&W, Warm, Matte & more" },
                { icon: "🧠", title: "AI Analyze", desc: "Histogram + edge + noise detection" },
                { icon: "✨", title: "Pixel Enhance", desc: "Sharpen, Denoise, Clarity, 2× Upscale" },
                { icon: "📦", title: "Batch Export", desc: "ZIP with selectable quality" },
              ].map((f) => (
                <div key={f.title} className="p-4 rounded-xl bg-card border">
                  <div className="text-xl mb-1">{f.icon}</div>
                  <p className="text-xs font-semibold mb-0.5">{f.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 order-2 lg:order-1">
              <GlobalControls
                globalState={globalSettings}
                onGlobalUpdate={handleGlobalUpdate}
                onApplyToAll={handleApplyToAll}
                onResetAll={handleResetAll}
              />
            </div>

            <div className="lg:col-span-3 order-1 lg:order-2 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight">
                  Images <span className="text-sm font-normal text-muted-foreground">({images.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-xs h-8"
                    onClick={() => document.getElementById("add-more-upload")?.click()}
                    data-testid="btn-add-more">
                    Add More
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-8 text-destructive hover:text-destructive"
                    onClick={handleClearAll} data-testid="btn-clear-all">
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />Clear All
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {images.map((img) => (
                  <ImageCard
                    key={img.id}
                    state={img}
                    onUpdate={handleUpdateImage}
                    onRemove={handleRemoveImage}
                    onReset={handleResetImage}
                  />
                ))}
                <div
                  className="min-h-[200px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl border-muted hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer gap-2"
                  onClick={() => document.getElementById("add-more-upload")?.click()}
                  data-testid="add-more-zone"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-xl leading-none">+</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Add more images</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <input id="add-more-upload" type="file" multiple accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleImagesSelected(Array.from(e.target.files));
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}

function App() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);
  return (
    <TooltipProvider>
      <PixelBatch />
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
