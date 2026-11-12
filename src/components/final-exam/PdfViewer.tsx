'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, Minus, Plus } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * In-app PDF reader built on pdf.js (legacy build, so older iPhones work too).
 * Phones don't show PDFs inline in an <iframe> (Android downloads them), so
 * pages are drawn to canvases instead — lazily, as they scroll into view.
 */
export function PdfViewer({ src, downloadName }: { src: string; downloadName: string }) {
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [aspect, setAspect] = useState(1.414); // A4 until page 1 is measured
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [width, setWidth] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const frameRef = useRef<HTMLDivElement>(null);

    // Load the document.
    useEffect(() => {
        let cancelled = false;
        let destroy: (() => void) | undefined;

        (async () => {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
                import.meta.url,
            ).toString();
            const task = pdfjs.getDocument({ url: src });
            destroy = () => void task.destroy();
            const loaded = await task.promise;
            const first = await loaded.getPage(1);
            const vp = first.getViewport({ scale: 1 });
            if (cancelled) return;
            setAspect(vp.height / vp.width);
            setDoc(loaded);
        })().catch((e: unknown) => {
            console.error('PDF load failed', e);
            if (!cancelled) setError('This booklet could not be opened.');
        });

        return () => {
            cancelled = true;
            destroy?.();
        };
    }, [src]);

    // Track the reading column's width so pages fit it.
    useEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const onVisible = useCallback((n: number) => setCurrentPage(n), []);
    const pageWidth = Math.max(200, Math.floor(width * zoom));
    const numPages = doc?.numPages ?? 0;

    return (
        <div>
            {/* Toolbar */}
            <div className="glass-bar sticky top-14 md:top-[60px] z-20 -mx-4 md:mx-0 mb-4 flex items-center gap-2 border-y md:border md:rounded-2xl border-charcoal-200/70 px-3 py-2">
                <span className="text-sm font-medium text-charcoal-600 tabular-nums">
                    {numPages ? <>Page {currentPage} of {numPages}</> : 'Loading…'}
                </span>
                <div className="flex-1" />
                <div className="flex items-center rounded-full border border-charcoal-200 bg-card">
                    <button
                        type="button"
                        onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}
                        disabled={zoom <= 0.6}
                        className="flex size-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-charcoal-100 disabled:opacity-40"
                        aria-label="Zoom out"
                    >
                        <Minus size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setZoom(1)}
                        className="min-w-12 px-1 text-xs font-semibold text-charcoal-600 tabular-nums hover:text-charcoal-900"
                        aria-label="Fit to width"
                        title="Fit to width"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        type="button"
                        onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))}
                        disabled={zoom >= 2.4}
                        className="flex size-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-charcoal-100 disabled:opacity-40"
                        aria-label="Zoom in"
                    >
                        <Plus size={15} />
                    </button>
                </div>
                <a
                    href={src}
                    download={downloadName}
                    className="flex size-9 items-center justify-center rounded-full border border-charcoal-200 bg-card text-charcoal-600 hover:bg-charcoal-50 hover:text-charcoal-900"
                    aria-label="Download PDF"
                    title="Download PDF"
                >
                    <Download size={16} />
                </a>
            </div>

            {/* Pages */}
            <div ref={frameRef} className="w-full">
                {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        <AlertCircle size={36} className="mx-auto mb-3" />
                        <p className="font-semibold">{error}</p>
                        <a href={src} download={downloadName} className="mt-3 inline-block text-sm font-semibold underline">
                            Download it instead
                        </a>
                    </div>
                ) : !doc ? (
                    <div className="mx-auto space-y-4" style={{ width: pageWidth }}>
                        {[0, 1].map((i) => (
                            <div key={i} className="rounded-lg bg-shimmer" style={{ height: pageWidth * aspect }} />
                        ))}
                    </div>
                ) : (
                    <div className={`space-y-4 ${zoom > 1 ? 'overflow-x-auto' : ''}`}>
                        {Array.from({ length: numPages }, (_, i) => (
                            <PdfPage
                                key={i + 1}
                                doc={doc}
                                pageNumber={i + 1}
                                width={pageWidth}
                                aspect={aspect}
                                onVisible={onVisible}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function PdfPage({
    doc,
    pageNumber,
    width,
    aspect,
    onVisible,
}: {
    doc: PDFDocumentProxy;
    pageNumber: number;
    width: number;
    aspect: number;
    onVisible: (n: number) => void;
}) {
    const boxRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [near, setNear] = useState(pageNumber <= 2);
    const [height, setHeight] = useState(Math.round(width * aspect));

    // Render once the page is within ~1.5 screens; report which page is being read.
    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const nearObs = new IntersectionObserver(
            ([e]) => e.isIntersecting && setNear(true),
            { rootMargin: '150% 0px' },
        );
        const readObs = new IntersectionObserver(
            ([e]) => e.isIntersecting && onVisible(pageNumber),
            { rootMargin: '-45% 0px -45% 0px' },
        );
        nearObs.observe(el);
        readObs.observe(el);
        return () => {
            nearObs.disconnect();
            readObs.disconnect();
        };
    }, [pageNumber, onVisible]);

    useEffect(() => {
        if (!near || width <= 0) return;
        let task: RenderTask | undefined;
        let cancelled = false;

        (async () => {
            const page = await doc.getPage(pageNumber);
            const base = page.getViewport({ scale: 1 });
            const cssScale = width / base.width;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const viewport = page.getViewport({ scale: cssScale * dpr });
            const canvas = canvasRef.current;
            if (!canvas || cancelled) return;
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            setHeight(Math.round(base.height * cssScale));
            task = page.render({ canvas, viewport });
            await task.promise;
        })().catch((e: unknown) => {
            if ((e as { name?: string })?.name !== 'RenderingCancelledException') console.error(e);
        });

        return () => {
            cancelled = true;
            task?.cancel();
        };
    }, [near, doc, pageNumber, width]);

    return (
        <div
            ref={boxRef}
            className="relative mx-auto overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-black/5"
            style={{ width, height }}
        >
            <canvas ref={canvasRef} className="block h-full w-full" aria-label={`Page ${pageNumber}`} role="img" />
            <span className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                {pageNumber}
            </span>
        </div>
    );
}
