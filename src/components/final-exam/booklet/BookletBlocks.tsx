import type { BookletBlock } from '@/lib/booklet';
import { safeHtml } from '@/lib/bookletView';
import { PdfCrop } from './PdfCrop';

/** Renders one section's content blocks (see src/lib/booklet.ts). */
export function BookletBlocks({ blocks, pdfSrc, lang, label }: { blocks: BookletBlock[]; pdfSrc: string; lang: 'en' | 'gu'; label: string }) {
    const refs = blocks.filter((b) => b.t === 'ref').length;
    // Position of each reference among the section's references (1-based).
    const refNos = blocks.map((_, i) => blocks.slice(0, i + 1).filter((b) => b.t === 'ref').length);
    const gu = lang === 'gu' ? 'font-gujarati' : '';

    return (
        <div className={`booklet-prose ${gu}`} lang={lang}>
            {blocks.map((b, i) => {
                switch (b.t) {
                    case 'h':
                        return <h3 key={i}>{b.text}</h3>;
                    case 'p':
                        return <p key={i}>{b.text}</p>;
                    case 'list': {
                        const List = b.ordered ? 'ol' : 'ul';
                        return (
                            <List key={i}>
                                {b.items.map((it, j) => (
                                    <li key={j}>{it}</li>
                                ))}
                            </List>
                        );
                    }
                    case 'quote':
                        return (
                            <blockquote key={i}>
                                <p>{b.text}</p>
                                {b.cite && <cite>{b.cite}</cite>}
                            </blockquote>
                        );
                    case 'ref':
                        return (
                            <div key={i} className="booklet-ref">
                                {refs > 1 && <div className="booklet-ref-no">{refNos[i]} / {refs}</div>}
                                <p className="booklet-ref-text">{b.text}</p>
                                {b.cite && <cite>{b.cite}</cite>}
                                {b.translation && <p className="booklet-ref-tr" lang="en">{b.translation}</p>}
                            </div>
                        );
                    case 'html':
                        return <div key={i} className="docx-content" dangerouslySetInnerHTML={{ __html: safeHtml(b.html) }} />;
                    case 'crop':
                        return <PdfCrop key={i} src={pdfSrc} page={b.page} top={b.top} bottom={b.bottom} left={b.left} right={b.right} label={`${label}, page ${b.page}`} />;
                }
            })}
        </div>
    );
}
