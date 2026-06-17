import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, RotateCcw, Sparkles } from "lucide-react";

export interface GlobalSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sharpen: number;
  denoise: number;
  clarity: number;
}

interface GlobalControlsProps {
  globalState: GlobalSettings;
  onGlobalUpdate: (key: string, value: number) => void;
  onApplyToAll: () => void;
  onResetAll: () => void;
}

interface CtrlRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  ctrlKey: string;
  accent?: boolean;
  onUpdate: (k: string, v: number) => void;
}

function CtrlRow({ label, value, min, max, step, unit, ctrlKey, accent, onUpdate }: CtrlRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <Label className={`text-xs ${accent ? 'text-primary/80' : ''}`}>{label}</Label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums w-14 text-right">
          {value}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={(val) => onUpdate(ctrlKey, val[0])}
        data-testid={`global-slider-${ctrlKey}`}
      />
    </div>
  );
}

export function GlobalControls({ globalState, onGlobalUpdate, onApplyToAll, onResetAll }: GlobalControlsProps) {
  return (
    <div className="bg-card border rounded-xl p-5 space-y-4 sticky top-[88px]">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Global Edits</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Set values, then apply to all images.</p>
      </div>

      {/* Color adjustments */}
      <div className="space-y-3">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Color</p>
        <CtrlRow label="Brightness" value={globalState.brightness} min={0}    max={200} step={1}   unit="%" ctrlKey="brightness" onUpdate={onGlobalUpdate} />
        <CtrlRow label="Contrast"   value={globalState.contrast}   min={0}    max={200} step={1}   unit="%" ctrlKey="contrast"   onUpdate={onGlobalUpdate} />
        <CtrlRow label="Saturation" value={globalState.saturation} min={0}    max={200} step={1}   unit="%" ctrlKey="saturation" onUpdate={onGlobalUpdate} />
        <CtrlRow label="Hue"        value={globalState.hue}        min={-180} max={180} step={1}   unit="°" ctrlKey="hue"        onUpdate={onGlobalUpdate} />
        <CtrlRow label="Blur"       value={globalState.blur}       min={0}    max={10}  step={0.1} unit="px" ctrlKey="blur"      onUpdate={onGlobalUpdate} />
      </div>

      <Separator />

      {/* Enhance adjustments */}
      <div className="space-y-3">
        <p className="text-[10px] font-medium text-primary/70 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3" />Enhance
        </p>
        <CtrlRow label="Sharpen" value={globalState.sharpen} min={0} max={10} step={1} unit="" ctrlKey="sharpen" accent onUpdate={onGlobalUpdate} />
        <CtrlRow label="Denoise" value={globalState.denoise} min={0} max={10} step={1} unit="" ctrlKey="denoise" accent onUpdate={onGlobalUpdate} />
        <CtrlRow label="Clarity" value={globalState.clarity} min={0} max={10} step={1} unit="" ctrlKey="clarity" accent onUpdate={onGlobalUpdate} />
      </div>

      <Separator />

      <div className="space-y-2">
        <Button className="w-full text-xs h-9" onClick={onApplyToAll} data-testid="btn-apply-all">
          <Copy className="w-3.5 h-3.5 mr-2" />
          Apply to All Images
        </Button>
        <Button variant="outline" className="w-full text-xs h-9" onClick={onResetAll} data-testid="btn-reset-all">
          <RotateCcw className="w-3.5 h-3.5 mr-2" />
          Reset All Images
        </Button>
      </div>
    </div>
  );
}
