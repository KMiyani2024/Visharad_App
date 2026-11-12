'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useReadingSize } from './SectionControls';

/**
 * One slice of a PDF page, drawn with pdf.js: used for the Gujarati Mukhpath,
 * whose text can't be extracted faithfully, so each shlok is shown exactly as
 * printed. Several slices on a page share one loaded document.
 */
const docs = new Map<string, Promise<PDFDocumentProxy>>();

function loadDoc(src: string) {
    let p = docs.get(src);
    if (!p) {
        p = (async () => {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
                import.meta.url,
            ).toString();
            return pdfjs.getDocument({ url: src }).promise;
        })();
        p.catch(() => docs.delete(src));
        docs.set(src, p);
    }
    return p;
}

/** Larger reading sizes draw the slice wider than the column; it then scrolls sideways. */
const ZOOM = { md: 1, lg: 1.35, xl: 1.7 } as const;

export function PdfCrop({
    src,
    page,
    top,
    bottom,
    left,
    right,
    label,
}: {
    src: string;
    page: number;
    top: number;
    bottom: number;
    left?: number;
    right?: number;
    label: string;
}) {
    const zoom = ZOOM[useReadingSize()];
    const boxRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [boxWidth, setBoxWidth] = useState(0);
    const [pageWidth, setPageWidth] = useState(595); // A4 until measured
    const width = Math.floor(boxWidth * zoom);
    const x0 = left ?? 0;
    const sliceWidth = (right ?? pageWidth) - x0;
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setBoxWidth(Math.floor(entry.contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (width <= 0) return;
        let task: RenderTask | undefined;
        let cancelled = false;
        (async () => {
            const doc = await loadDoc(src);
            const pg = await doc.getPage(page);
            const base = pg.getViewport({ scale: 1 });
            if (cancelled) return;
            setPageWidth(base.width);
            const cropW = (right ?? base.width) - (left ?? 0);
            const css = width / cropW;
            const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
            const scale = css * dpr;
            // Shift the page so only [left, right] × [top, bottom] lands on the canvas.
            const viewport = pg.getViewport({ scale, offsetX: -(left ?? 0) * scale, offsetY: -top * scale });
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = Math.floor(cropW * scale);
            canvas.height = Math.max(1, Math.floor((bottom - top) * scale));
            task = pg.render({ canvas, viewport });
            await task.promise;
            if (!cancelled) setState('ready');
        })().catch((e: unknown) => {
            if ((e as { name?: string })?.name === 'RenderingCancelledException') return;
            console.error('PDF slice failed', e);
            if (!cancelled) setState('error');
        });
        return () => {
            cancelled = true;
            task?.cancel();
        };
    }, [src, page, top, bottom, left, right, width]);

    const height = width > 0 ? Math.round(((bottom - top) * width) / sliceWidth) : 160;

    return (
        <div ref={boxRef} className={`w-full rounded-xl ring-1 ring-black/5 dark:ring-white/10 ${zoom > 1 ? 'overflow-x-auto' : 'overflow-hidden'}`}>
        <div className="relative bg-white dark:bg-[#1a1a1a]" style={{ height, width: width || '100%' }}>
            {state !== 'ready' && (
                <div className={`absolute inset-0 ${state === 'error' ? 'flex items-center justify-center bg-red-50 text-sm text-red-700' : 'bg-shimmer'}`}>
                    {state === 'error' && 'This part of the booklet could not be shown.'}
                </div>
            )}
            <canvas
                ref={canvasRef}
                role="img"
                aria-label={label}
                // In dark mode the page is inverted (hue-rotated back so colours keep their hue).
                className={`block h-full w-full transition-opacity duration-300 dark:[filter:invert(0.9)_hue-rotate(180deg)] ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
        </div>
    );
}
