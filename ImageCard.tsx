import React, { useState, useEffect, useCallback } from "react";
import { ImageEditState, getFilterString, defaultSettings, PRESETS, PRESET_KEYS, PresetName, exportEditedImage, getEnhanceSvgParams } from "@/lib/image-processing";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, X, Wand2, Download, Eye } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ImageCardProps {
  state: ImageEditState;
  onUpdate: (id: string, updates: Partial<ImageEditState>) => void;
  onRemove: (id: string) => void;
  onReset: (id: string) => void;
}

export function ImageCard({ state, onUpdate, onRemove, onReset }: ImageCardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetName>('none');

  useEffect(() => {
    if (!state.dimensions) {
      const img = new Image();
      img.onload = () => onUpdate(state.id, { dimensions: { width: img.width, height: img.height } });
      img.src = state.previewUrl;
    }
  }, [state.id, state.previewUrl, state.dimensions, onUpdate]);

  // Build SVG filter params for live preview
  const { sharpenAmount, denoiseStd } = getEnhanceSvgParams(state.sharpen, state.denoise);
  const hasSvgFilter = state.sharpen > 0 || state.denoise > 0;

  const filterStyle = showOriginal ? {} : { filter: getFilterString(state) };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleColorSlider = (key: 'brightness' | 'contrast' | 'saturation' | 'hue' | 'blur', value: number) => {
    setActivePreset('none');
    onUpdate(state.id, { [key]: value, aiAdjusted: false });
  };

  const handleEnhanceSlider = (key: 'sharpen' | 'denoise' | 'clarity', value: number) => {
    onUpdate(state.id, { [key]: value });
  };

  const handlePreset = (preset: PresetName) => {
    setActivePreset(preset);
    onUpdate(state.id, { ...PRESETS[preset].settings, aiAdjusted: false });
  };

  const handleReset = () => {
    setActivePreset('none');
    onReset(state.id);
  };

  const handleDownloadSingle = useCallback(async () => {
    setIsDownloading(true);
    try {
      const blob = await exportEditedImage(state.previewUrl, state);
      const parts = state.file.name.split('.');
      const ext = parts.length > 1 ? parts.pop() : 'jpg';
      const base = parts.join('.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}_edited.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }, [state]);

  return (
    <Card className="overflow-hidden flex flex-col group relative animate-in fade-in zoom-in duration-300">
      {/* SVG filter defs for per-image live preview */}
      {hasSvgFilter && (
        <svg style={{ display: 'none' }} aria-hidden>
          <defs>
            <filter id={`enhance-${state.id}`} colorInterpolationFilters="sRGB">
              {state.denoise > 0 && (
                <>
                  <feGaussianBlur in="SourceGraphic" stdDeviation={denoiseStd} result="blurred" />
                  <feComposite in="SourceGraphic" in2="blurred" operator="arithmetic"
                    k1={0} k2={1 - denoiseStd * 0.35} k3={denoiseStd * 0.35} k4={0} result="denoised" />
                </>
              )}
              {state.sharpen > 0 && (
                <feConvolveMatrix
                  in={state.denoise > 0 ? "denoised" : "SourceGraphic"}
                  order={3}
                  kernelMatrix={`0 ${-sharpenAmount} 0 ${-sharpenAmount} ${1 + 4 * sharpenAmount} ${-sharpenAmount} 0 ${-sharpenAmount} 0`}
                  preserveAlpha
                />
              )}
            </filter>
          </defs>
        </svg>
      )}

      {/* Remove button */}
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(state.id)}
        data-testid={`btn-remove-${state.id}`}
      >
        <X className="w-3.5 h-3.5" />
      </Button>

      {state.aiAdjusted && (
        <Badge className="absolute top-2 left-2 z-10 bg-primary hover:bg-primary/90 text-[10px] px-1.5 py-0.5">
          <Wand2 className="w-2.5 h-2.5 mr-1" />AI
        </Badge>
      )}

      {/* Image preview with before/after */}
      <div
        className="relative aspect-video w-full bg-black/30 overflow-hidden cursor-pointer select-none"
        onMouseDown={() => setShowOriginal(true)}
        onMouseUp={() => setShowOriginal(false)}
        onMouseLeave={() => setShowOriginal(false)}
        onTouchStart={() => setShowOriginal(true)}
        onTouchEnd={() => setShowOriginal(false)}
        title="Hold to compare with original"
        data-testid={`img-preview-${state.id}`}
        style={{ filter: hasSvgFilter ? `url(#enhance-${state.id}) ${getFilterString({ ...state, sharpen: 0, denoise: 0 })}` : undefined }}
      >
        <img
          src={state.previewUrl}
          alt={state.file.name}
          className="w-full h-full object-contain transition-all duration-150"
          style={hasSvgFilter ? {} : filterStyle}
          draggable={false}
        />
        {showOriginal && (
          <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
            <span className="bg-black/70 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">Original</span>
          </div>
        )}
        {!showOriginal && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none">
            <Eye className="w-4 h-4 text-white drop-shadow" />
          </div>
        )}
      </div>

      {/* File info */}
      <div className="px-3 pt-3 pb-1 space-y-0.5">
        <p className="font-medium text-sm truncate" title={state.file.name}>{state.file.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {state.dimensions ? `${state.dimensions.width}×${state.dimensions.height}` : "—"} · {formatSize(state.file.size)}
          {state.upscale2x && <span className="ml-1 text-primary font-medium">→ 2×</span>}
        </p>
        {state.aiAnalysis && (
          <p className="text-[10px] text-primary/70 font-medium">{state.aiAnalysis.label}</p>
        )}
      </div>

      {/* Preset chips */}
      <div className="px-3 pb-2 flex flex-wrap gap-1">
        {PRESET_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            data-testid={`btn-preset-${key}-${state.id}`}
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors",
              activePreset === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-muted-foreground/30 text-muted-foreground hover:border-primary/60 hover:text-foreground"
            )}
          >
            {PRESETS[key].label}
          </button>
        ))}
      </div>

      {/* Tabs: Adjust / Enhance */}
      <CardContent className="px-3 pb-0 flex-grow">
        <Tabs defaultValue="adjust">
          <TabsList className="w-full h-8 mb-3">
            <TabsTrigger value="adjust" className="flex-1 text-xs">Adjust</TabsTrigger>
            <TabsTrigger value="enhance" className="flex-1 text-xs">
              Enhance
              {(state.sharpen > 0 || state.denoise > 0 || state.clarity > 0 || state.upscale2x) && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="adjust" className="space-y-3 mt-0">
            <SliderRow label="Brightness" value={state.brightness} min={0}    max={200} step={1}   unit="%" onChange={(v) => handleColorSlider('brightness', v)} testId={`slider-brightness-${state.id}`} />
            <SliderRow label="Contrast"   value={state.contrast}   min={0}    max={200} step={1}   unit="%" onChange={(v) => handleColorSlider('contrast', v)}   testId={`slider-contrast-${state.id}`} />
            <SliderRow label="Saturation" value={state.saturation} min={0}    max={200} step={1}   unit="%" onChange={(v) => handleColorSlider('saturation', v)} testId={`slider-saturation-${state.id}`} />
            <SliderRow label="Hue"        value={state.hue}        min={-180} max={180} step={1}   unit="°" onChange={(v) => handleColorSlider('hue', v)}        testId={`slider-hue-${state.id}`} />
            <SliderRow label="Blur"       value={state.blur}       min={0}    max={10}  step={0.1} unit="px" onChange={(v) => handleColorSlider('blur', v)}      testId={`slider-blur-${state.id}`} />
          </TabsContent>

          <TabsContent value="enhance" className="space-y-3 mt-0">
            <p className="text-[10px] text-muted-foreground -mt-1 mb-2">
              Pixel-level processing applied on export. Hold image to preview.
            </p>
            <SliderRow
              label="Sharpen"
              value={state.sharpen}
              min={0} max={10} step={1} unit=""
              onChange={(v) => handleEnhanceSlider('sharpen', v)}
              testId={`slider-sharpen-${state.id}`}
              accent
            />
            <SliderRow
              label="Denoise"
              value={state.denoise}
              min={0} max={10} step={1} unit=""
              onChange={(v) => handleEnhanceSlider('denoise', v)}
              testId={`slider-denoise-${state.id}`}
              accent
            />
            <SliderRow
              label="Clarity"
              value={state.clarity}
              min={0} max={10} step={1} unit=""
              onChange={(v) => handleEnhanceSlider('clarity', v)}
              testId={`slider-clarity-${state.id}`}
              accent
            />
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className="text-[11px]">2× Export Upscale</Label>
                <p className="text-[10px] text-muted-foreground">Double resolution on export</p>
              </div>
              <Switch
                checked={state.upscale2x}
                onCheckedChange={(v) => onUpdate(state.id, { upscale2x: v })}
                data-testid={`switch-upscale-${state.id}`}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="px-3 py-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleReset} data-testid={`btn-reset-${state.id}`}>
          <RotateCcw className="w-3 h-3 mr-1.5" />Reset
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleDownloadSingle} disabled={isDownloading} data-testid={`btn-download-${state.id}`}>
          <Download className="w-3 h-3 mr-1.5" />
          {isDownloading ? "Saving…" : "Save"}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── SliderRow helper ──────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  testId?: string;
  accent?: boolean;
}

function SliderRow({ label, value, min, max, step, unit, onChange, testId, accent }: SliderRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className={cn("text-[11px]", accent ? "text-primary/80" : "text-muted-foreground")}>{label}</Label>
        <span className="text-[11px] font-mono tabular-nums">{value}{unit}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(val) => onChange(val[0])} data-testid={testId} />
    </div>
  );
}
