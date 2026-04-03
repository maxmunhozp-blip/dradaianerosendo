import { useState, useEffect, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, Download, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  data: ArrayBuffer;
  fileName: string;
  onClose: () => void;
  onDownload?: () => void;
}

export function PdfViewer({ data, fileName, onClose, onDownload }: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageDimensions, setPageDimensions] = useState<{ w: number; h: number }[]>([]);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const thumbsContainerRef = useRef<HTMLDivElement>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const isScrollingToPage = useRef(false);
  const renderingPages = useRef<Set<number>>(new Set());

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRenderedPages(new Set());
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
    loadingTask.promise.then(async (pdfDoc) => {
      if (cancelled) return;
      setPdf(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);

      // Pre-compute all page dimensions for placeholders
      const dims: { w: number; h: number }[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        dims.push({ w: vp.width, h: vp.height });
      }
      if (!cancelled) {
        setPageDimensions(dims);
        setLoading(false);
      }
    }).catch((err) => {
      console.error("PDF load error:", err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; loadingTask.destroy(); };
  }, [data]);

  // Generate thumbnails (background, doesn't block)
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

  // Render a single page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || renderingPages.current.has(pageNum)) return;
    const canvas = canvasRefs.current.get(pageNum);
    if (!canvas) return;

    renderingPages.current.add(pageNum);
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvasContext: ctx, viewport }).promise;
      setRenderedPages((prev) => new Set(prev).add(pageNum));
    } catch (err) {
      console.error(`PDF render error page ${pageNum}:`, err);
    } finally {
      renderingPages.current.delete(pageNum);
    }
  }, [pdf, scale]);

  // Intersection Observer for lazy rendering
  useEffect(() => {
    if (!pdf || loading || pageDimensions.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number((entry.target as HTMLElement).dataset.page);
            if (pageNum && !renderedPages.has(pageNum)) {
              renderPage(pageNum);
            }
          }
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "200px 0px", // pre-render 200px above/below viewport
      }
    );

    pageElementsRef.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pdf, loading, pageDimensions, renderPage, renderedPages]);

  // Re-render visible pages on scale change
  useEffect(() => {
    if (!pdf || loading) return;
    setRenderedPages(new Set());
    renderingPages.current.clear();
  }, [scale, pdf, loading]);

  // Track current page on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || totalPages === 0) return;

    const handleScroll = () => {
      if (isScrollingToPage.current) return;
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      let closestPage = 1;
      let closestDist = Infinity;

      pageElementsRef.current.forEach((el, pageNum) => {
        const rect = el.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const dist = Math.abs(pageCenter - containerCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closestPage = pageNum;
        }
      });

      setCurrentPage(closestPage);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [totalPages]);

  // Sync thumbnail highlight
  useEffect(() => {
    const container = thumbsContainerRef.current;
    if (!container) return;
    const activeThumb = container.querySelector(`[data-page="${currentPage}"]`);
    activeThumb?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    const el = pageElementsRef.current.get(page);
    if (el && scrollContainerRef.current) {
      isScrollingToPage.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => { isScrollingToPage.current = false; }, 600);
    }
  };

  const setCanvasRef = useCallback((pageNum: number) => (el: HTMLCanvasElement | null) => {
    if (el) canvasRefs.current.set(pageNum, el);
    else canvasRefs.current.delete(pageNum);
  }, []);

  const setPageRef = useCallback((pageNum: number) => (el: HTMLDivElement | null) => {
    if (el) pageElementsRef.current.set(pageNum, el);
    else pageElementsRef.current.delete(pageNum);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium truncate">{fileName}</span>
          {totalPages > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {totalPages} {totalPages === 1 ? "página" : "páginas"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground min-w-[60px] text-center">
            {currentPage} / {totalPages || "…"}
          </span>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          {onDownload && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onDownload}>
                <Download className="w-3.5 h-3.5" />
                Baixar
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
          className="w-[140px] border-r border-border bg-muted/30 overflow-y-auto shrink-0 p-2 space-y-2 hidden md:block"
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
                className={`w-full rounded overflow-hidden border-2 transition-all ${
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
                className={`w-full h-24 rounded border-2 flex items-center justify-center text-xs text-muted-foreground transition-all ${
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

        {/* All pages - continuous scroll with lazy rendering */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-muted/20">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Carregando documento...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 gap-4">
              {pageDimensions.map((dim, i) => {
                const pageNum = i + 1;
                const w = dim.w * scale;
                const h = dim.h * scale;
                const isRendered = renderedPages.has(pageNum);
                return (
                  <div
                    key={i}
                    ref={setPageRef(pageNum)}
                    data-page={pageNum}
                    className="relative"
                    style={{ width: w, height: h }}
                  >
                    <canvas
                      ref={setCanvasRef(pageNum)}
                      className="shadow-lg rounded-sm absolute inset-0"
                    />
                    {!isRendered && (
                      <div
                        className="absolute inset-0 bg-white shadow-lg rounded-sm flex items-center justify-center"
                      >
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
                      {pageNum}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile page indicator */}
      <div className="flex md:hidden items-center justify-center gap-2 py-2 border-t border-border bg-muted/50">
        <span className="text-xs text-muted-foreground">
          Página {currentPage} de {totalPages}
        </span>
      </div>
    </div>
  );
}
