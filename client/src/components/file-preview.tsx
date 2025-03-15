import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type File } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface FilePreviewProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
}

export function FilePreview({ file, isOpen, onClose }: FilePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const isImage = file.mimeType.startsWith("image/");
  const isPDF = file.mimeType === "application/pdf";
  const isText = file.mimeType.startsWith("text/") || file.mimeType === "application/json";

  const fileUrl = `/api/files/${file.id}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogTitle>{file.name}</DialogTitle>
        <div className="w-full h-[80vh] overflow-auto relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {isImage && (
            <img
              src={fileUrl}
              alt={file.name}
              className="max-w-full h-auto"
              onLoad={() => setIsLoading(false)}
              crossOrigin="use-credentials"
            />
          )}
          {isPDF && (
            <iframe
              src={fileUrl}
              className="w-full h-full"
              title={file.name}
              onLoad={() => setIsLoading(false)}
            />
          )}
          {isText && (
            <pre className="p-4 bg-muted rounded-lg overflow-auto">
              <code>
                <iframe
                  src={fileUrl}
                  className="w-full h-full border-none"
                  onLoad={(e) => {
                    setIsLoading(false);
                    const iframe = e.target as HTMLIFrameElement;
                    if (iframe.contentWindow) {
                      iframe.style.height =
                        iframe.contentWindow.document.documentElement.scrollHeight + "px";
                    }
                  }}
                />
              </code>
            </pre>
          )}
          {!isImage && !isPDF && !isText && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Preview não disponível para este tipo de arquivo ({file.mimeType})
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}