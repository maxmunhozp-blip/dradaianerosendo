import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  fileName: string;
  onClose: () => void;
  onDownload?: () => void;
}

export function PdfViewer({ url, fileName, onClose, onDownload }: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbsContainerRef = useRef<HTMLDivElement>(null);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise.then((pdfDoc) => {
      if (cancelled) return;
      setPdf(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; loadingTask.destroy(); };
  }, [url]);

  // Generate thumbnails
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    const generateThumbs = async () => {
      const thumbs: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs.push(canvas.toDataURL());
      }
      if (!cancelled) setThumbnails(thumbs);
    };
    generateThumbs();
    return () => { cancelled = true; };
  }, [pdf]);

  // Render current page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || !mainCanvasRef.current) return;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = mainCanvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
  }, [pdf, scale]);

  useEffect(() => {
    renderPage(currentPage);
  }, [currentPage, renderPage]);

  // Scroll active thumb into view
  useEffect(() => {
    const container = thumbsContainerRef.current;
    if (!container) return;
    const activeThumb = container.querySelector(`[data-page="${currentPage}"]`);
    activeThumb?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium truncate">{fileName}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {currentPage} / {totalPages || "..."}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          {onDownload && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownload}>
                <Download className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnails sidebar */}
        <div
          ref={thumbsContainerRef}
          className="w-36 border-r border-border bg-muted/30 overflow-y-auto shrink-0 p-2 space-y-2 hidden md:block"
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : thumbnails.length > 0 ? (
            thumbnails.map((thumb, idx) => (
              <button
                key={idx}
                data-page={idx + 1}
                onClick={() => goToPage(idx + 1)}
                className={`w-full rounded-md overflow-hidden border-2 transition-all ${
                  currentPage === idx + 1
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent hover:border-muted-foreground/30"
                }`}
              >
                <img src={thumb} alt={`Página ${idx + 1}`} className="w-full" />
                <span className="block text-[10px] text-center text-muted-foreground py-0.5">
                  {idx + 1}
                </span>
              </button>
            ))
          ) : (
            Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                data-page={i + 1}
                onClick={() => goToPage(i + 1)}
                className={`w-full h-24 rounded-md border-2 flex items-center justify-center text-xs text-muted-foreground transition-all ${
                  currentPage === i + 1
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                {i + 1}
              </button>
            ))
          )}
        </div>

        {/* PDF canvas */}
        <div className="flex-1 overflow-auto flex justify-center bg-muted/20 p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Carregando documento...</span>
            </div>
          ) : (
            <canvas
              ref={mainCanvasRef}
              className="shadow-lg rounded bg-white max-w-full"
              style={{ height: "auto" }}
            />
          )}
        </div>
      </div>

      {/* Mobile page indicator */}
      <div className="flex md:hidden items-center justify-center gap-2 py-2 border-t border-border bg-muted/50">
        <Button variant="ghost" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {currentPage} de {totalPages}
        </span>
        <Button variant="ghost" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
