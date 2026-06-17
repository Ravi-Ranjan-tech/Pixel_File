import React, { useCallback, useState } from "react";
import { UploadCloud, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onImagesSelected: (files: File[]) => void;
}

export function UploadZone({ onImagesSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter(
          (file) =>
            file.type.startsWith("image/jpeg") ||
            file.type.startsWith("image/png") ||
            file.type.startsWith("image/webp")
        );
        if (files.length > 0) {
          onImagesSelected(files);
        }
      }
    },
    [onImagesSelected]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        onImagesSelected(files);
        // Reset so same file can be selected again if needed
        e.target.value = "";
      }
    },
    [onImagesSelected]
  );

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center w-full min-h-[300px] border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer overflow-hidden",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50",
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => document.getElementById("file-upload")?.click()}
      data-testid="upload-zone"
    >
      <input
        id="file-upload"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
        data-testid="input-file"
      />
      <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center pointer-events-none">
        <div className="p-4 rounded-full bg-muted">
          <UploadCloud className="w-10 h-10 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xl font-medium">Drag & drop your images here</p>
          <p className="text-sm text-muted-foreground mt-2">
            Supports JPG, PNG, WebP
          </p>
        </div>
      </div>
    </div>
  );
}
