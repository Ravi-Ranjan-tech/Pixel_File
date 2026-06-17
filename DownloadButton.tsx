import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { ImageEditState, exportEditedImage } from "@/lib/image-processing";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Quality = "high" | "medium" | "low";
const QUALITY_MAP: Record<Quality, { label: string; q: number }> = {
  high:   { label: "High (92%)",   q: 0.92 },
  medium: { label: "Medium (75%)", q: 0.75 },
  low:    { label: "Low (55%)",    q: 0.55 },
};

interface DownloadButtonProps {
  images: ImageEditState[];
  disabled?: boolean;
}

export function DownloadButton({ images, disabled }: DownloadButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentName, setCurrentName] = useState("");
  const [quality, setQuality] = useState<Quality>("high");
  const { toast } = useToast();

  const handleDownload = async () => {
    if (images.length === 0) return;
    setIsExporting(true);
    setProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder("PixelBatch_Export")!;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        setCurrentName(img.file.name);
        try {
          const blob = await exportEditedImage(img.previewUrl, img, QUALITY_MAP[quality].q);
          const parts = img.file.name.split(".");
          const ext = parts.length > 1 ? parts.pop() : "jpg";
          const base = parts.join(".");
          folder.file(`${base}_edited.${ext}`, blob);
        } catch (e) {
          console.error(`Failed to export ${img.file.name}`, e);
        }
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PixelBatch_Export.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export complete",
        description: `${images.length} image${images.length !== 1 ? "s" : ""} exported at ${QUALITY_MAP[quality].label}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Something went wrong while packaging the images.",
      });
    } finally {
      setIsExporting(false);
      setProgress(0);
      setCurrentName("");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={quality}
        onValueChange={(v) => setQuality(v as Quality)}
        disabled={isExporting || images.length === 0}
      >
        <SelectTrigger className="h-9 w-[120px] text-xs" data-testid="select-quality">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(QUALITY_MAP) as Quality[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs" data-testid={`quality-${k}`}>
              {QUALITY_MAP[k].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        onClick={handleDownload}
        disabled={disabled || isExporting || images.length === 0}
        className="relative overflow-hidden transition-all duration-300 min-w-[160px] h-9"
        data-testid="btn-download-all"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin relative z-10" />
            <span className="relative z-10 text-xs">
              {progress}% · {currentName || "…"}
            </span>
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/15 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 mr-2" />
            Download All ({images.length})
          </>
        )}
      </Button>
    </div>
  );
}
