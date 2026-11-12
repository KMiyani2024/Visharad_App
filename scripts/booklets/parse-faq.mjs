/**
 * Final Exam FAQ booklet (PDF, Word-generated) → sectioned Booklet JSON.
 *
 *   import { parse } from './parse-faq.mjs';
 *   const booklet = await parse({ file, lang: 'en', paper: 'faq', source: 'FAQ_ENGLISH.pdf' });
 *
 * or from the command line: node scripts/booklets/parse-faq.mjs <file.pdf> [out.json]
 *
 * One section per question ("question-N"). Text comes from pdfjs text items, so font
 * weight and indentation are available: wholly bold lines become sub-headings, "•", "o",
 * "▪" and "-" bullets become lists (one list block per bullet level), "1." lines become
 * ordered lists and quoted scripture with a source becomes quote blocks. Devanagari
 * verses are emitted as `crop` blocks (page slices) because the PDF's font maps their
 * conjuncts to the wrong code points, so the extracted Unicode is not faithful.
 *
 * Text is kept exactly as printed: only wrapped lines are joined (no space after a
 * line-final hyphen or em dash; a manual line break becomes "\n") and runs of spaces
 * are collapsed. The booklet's text is never written to the repository.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BULLETS = new Set(['•', '·', 'o', '▪', '§', '-', '–']);
const LEVEL = { '•': 'bullet', '·': 'bullet', '-': 'dash', '–': 'dash', o: 'sub', '▪': 'subsub', '§': 'subsub' };
const DEVANAGARI = /[ऀ-ॿ]/g;
const QUOTE_CHARS = /["“”]/g;
const SCRIPTURE =
    /\d|Vachanamrut|Vach\.|Swamini|Vato|Shikshapatri|Satsang Diksha|Prakash|Bhakti|Bhakta|Purana|Agni|Gita|Upanishad|Sutra|Harililamrut|Ramcharitmanas|Manusmriti/i;

async function loadPdfjs() {
    return import('pdfjs-dist/legacy/build/pdf.mjs');
}

/** Text items per page, with font name, weight and style. */
async function readItems(file) {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await readFile(file));
    const task = pdfjs.getDocument({ data, verbosity: 0, fontExtraProperties: true, isEvalSupported: false });
    const doc = await task.promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const [, , , pageHeight] = page.view;
        const tc = await page.getTextContent();
        await page.getOperatorList(); // resolves fonts so their real names can be read
        const fonts = new Map();
        const items = [];
        for (const it of tc.items) {
            if (!('str' in it) || it.str === '') continue;
            if (!fonts.has(it.fontName)) {
                let name = '';
                try {
                    name = page.commonObjs.get(it.fontName)?.name ?? '';
                } catch {
                    name = tc.styles[it.fontName]?.fontFamily ?? '';
                }
                fonts.set(it.fontName, name.replace(/^[A-Z]{6}\+/, ''));
            }
            const font = fonts.get(it.fontName);
            items.push({
                s: it.str,
                x: it.transform[4],
                y: it.transform[5],
                w: it.width,
                h: it.height,
                font,
                bold: /bold|black|heavy/i.test(font),
                italic: /italic|oblique/i.test(font),
            });
        }
        pages.push({ page: p, height: pageHeight, items });
        page.cleanup();
    }
    await task.destroy();
    return pages;
}

const isSpace = (s) => /^\s*$/.test(s);

/** Groups items into visual lines and works out marker, text, weight and geometry. */
function buildLines(pages) {
    const lines = [];
    for (const { page, height, items } of pages) {
        let cur = null;
        for (const it of items) {
            if (!cur || Math.abs(cur.y - it.y) > 3) {
                cur = { page, pageHeight: height, y: it.y, items: [] };
                lines.push(cur);
            }
            cur.items.push(it);
        }
    }
    const out = [];
    for (const l of lines) {
        const its = l.items;
        const ink = its.filter((i) => !isSpace(i.s));
        if (!ink.length) continue;
        const size = Math.max(...ink.map((i) => i.h));
        let start = 0;
        while (start < its.length && isSpace(its[start].s)) start++;
        let marker = null;
        const first = its[start];
        const next = its[start + 1];
        const t = first.s.trim();
        if (BULLETS.has(t)) {
            const symbolFont = /symbol|wingding|courier|webding/i.test(first.font);
            const tab = next && isSpace(next.s) && next.w >= 6;
            if (symbolFont || tab) {
                marker = t;
                start++;
                while (start < its.length && isSpace(its[start].s)) start++;
            }
        }
        const body = its.slice(start);
        let text = '';
        let prev = null;
        for (const i of body) {
            // pdfjs normally emits explicit space items; add one if two inked items are apart.
            if (prev && !isSpace(prev.s) && !isSpace(i.s) && !/\s$/.test(prev.s) && !/^\s/.test(i.s) && i.x - (prev.x + prev.w) > 0.15 * size) text += ' ';
            text += i.s;
            prev = i;
        }
        text = text.replace(/[ \t ]+/g, ' ').trim();
        const inkBody = body.filter((i) => !isSpace(i.s));
        const chars = (f) => inkBody.filter(f).reduce((n, i) => n + i.s.replace(/\s/g, '').length, 0);
        const total = chars(() => true);
        const devanagari = (text.match(DEVANAGARI) || []).length;
        // Stretch: extra width of explicit space items beyond a normal space (justified lines
        // before a manual line break are stretched to the full measure).
        const spaces = body.filter((i) => isSpace(i.s) && i.w > 0);
        const extra = spaces.reduce((n, i) => n + i.w, 0) - spaces.length * 0.278 * size;
        out.push({
            page: l.page,
            pageHeight: l.pageHeight,
            y: l.y,
            size,
            marker,
            x: (inkBody[0] ?? first).x,
            right: Math.max(...ink.map((i) => i.x + i.w)),
            text,
            boldRatio: total ? chars((i) => i.bold) / total : 0,
            italicRatio: total ? chars((i) => i.italic) / total : 0,
            startsBold: !!inkBody[0]?.bold,
            devanagari: devanagari > 0 && devanagari >= 0.5 * text.replace(/[\s\d॥।|.,]/g, '').length,
            extra,
            charWidth: total ? inkBody.reduce((n, i) => n + i.w, 0) / total : 0.5 * size,
        });
    }
    return out;
}

const QUESTION_RE = /^Question\s+(\d+)\s*[-–—]?\s*\(([^)]*)\)\s*[:\-–—]?\s*/;

/** Groups lines into paragraphs: a bullet, a gap, a short line or a weight change ends one. */
function buildParagraphs(lines) {
    // Full measure: the right edge most body lines reach (the text is justified).
    const rights = lines.filter((l) => !l.devanagari).map((l) => Math.round(l.right));
    const counts = new Map();
    for (const r of rights) counts.set(r, (counts.get(r) ?? 0) + 1);
    const measure = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 523;
    const firstWord = (l) => (l.text.split(' ')[0] ?? '').length * l.charWidth + 0.278 * l.size;
    // The text is justified, so a wrapped line reaches the measure: a line that stops short ends
    // its paragraph. Exception: a lone "(source)" line under a bullet belongs to that bullet.
    const shortLine = (a, b) => a.right < measure - 8 && !(/^\([^()]+\)\.?$/.test(b.text) && SCRIPTURE.test(b.text) && b.x > a.x - 8);
    // A justified line stretched by more than the next line's first word would need ends in a
    // manual line break (Shift+Enter), not a wrap.
    const manualBreak = (a, b) => a.extra > firstWord(b) + 6;

    const paras = [];
    let cur = null;
    let prev = null;
    for (const l of lines) {
        // Page furniture: bare page numbers in the top or bottom margin.
        if (/^\d{1,3}$/.test(l.text) && (l.y < 60 || l.y > l.pageHeight - 60)) continue;
        const question = l.startsBold && /^Question\s+\d+\b/.test(l.text);
        const heading = l.boldRatio >= 0.8;
        let fresh = !cur || question || !!l.marker || l.devanagari !== cur.devanagari;
        if (!fresh && l.devanagari) fresh = l.page !== prev.page;
        if (!fresh && !l.devanagari) {
            if (l.page !== prev.page) fresh = shortLine(prev, l);
            else fresh = prev.y - l.y > 1.5 * Math.max(prev.size, l.size) || shortLine(prev, l);
            if (!fresh && cur.kind === 'heading' && !heading) {
                // A bold run that wraps into regular text is a paragraph with a bold start;
                // a bold line ended by a line break is a heading of its own.
                if (manualBreak(prev, l) || /[:?!.]$/.test(prev.text)) fresh = true;
                else cur.kind = 'text';
            }
        }
        if (fresh) {
            cur = {
                kind: question ? 'question' : l.devanagari ? 'crop' : heading ? 'heading' : 'text',
                marker: l.marker,
                devanagari: l.devanagari,
                lines: [l],
                italic: l.italicRatio,
            };
            paras.push(cur);
        } else {
            cur.lines.push(l);
        }
        prev = l;
    }
    for (const p of paras) {
        let text = '';
        p.lines.forEach((l, i) => {
            if (i === 0) {
                text = l.text;
                return;
            }
            if (/[^\s][-—]$/.test(text)) text += l.text;
            // A manual line break, or the end of a verse line (danda), keeps its line break.
            else text += (manualBreak(p.lines[i - 1], l) || /[|।॥]$/.test(text) ? '\n' : ' ') + l.text;
        });
        if (p.kind === 'heading') {
            const total = p.lines.reduce((n, l) => n + l.text.length, 0);
            const bold = p.lines.reduce((n, l) => n + l.boldRatio * l.text.length, 0);
            if (bold < 0.8 * total) p.kind = 'text';
        }
        p.text = text.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
        p.italic = p.lines.reduce((n, l) => n + l.italicRatio, 0) / p.lines.length;
    }
    return paras;
}

/** Splits a trailing "(source)" off a text, when it reads like a scripture reference. */
function splitCite(text) {
    const m = text.match(/^([\s\S]*?)\s*\(([^()]+)\)\s*$/);
    if (!m || !m[1].trim() || !SCRIPTURE.test(m[2])) return null;
    return { text: m[1].trim(), cite: m[2].trim() };
}

const startsWithQuote = (s) => /^["“]/.test(s);
const quoteCount = (s) => (s.match(QUOTE_CHARS) || []).length;

/** True when the whole text is quotation: quoted segments separated only by space or punctuation. */
function allQuoted(s) {
    if (!startsWithQuote(s) || quoteCount(s) % 2) return false;
    const outside = s.replace(/["“][\s\S]*?["”]/g, '');
    return /^[\s.,;:!?]*$/.test(outside);
}

/** A Title Case line without sentence punctuation, e.g. "Rest for the Digestive System". */
function titleCaseLine(s) {
    if (s.length > 70 || /\n/.test(s) || /[.?!;,"“”)]$/.test(s)) return false;
    const words = s.replace(/:$/, '').split(/\s+/);
    const long = words.filter((w) => w.replace(/[^A-Za-z]/g, '').length >= 4);
    return words.length >= 2 && long.length >= 2 && long.every((w) => /^[A-Z]/.test(w)) && /^[A-Z]/.test(words[0]);
}

function toBlocks(paras, notes) {
    // First pass: one provisional block per paragraph.
    const raw = [];
    for (const p of paras) {
        if (p.kind === 'crop') {
            const first = p.lines[0];
            const last = p.lines[p.lines.length - 1];
            const top = first.pageHeight - (first.y + 1.15 * first.size) - 4;
            const bottom = last.pageHeight - (last.y - 0.55 * last.size) + 4;
            raw.push({ t: 'crop', page: first.page, top: Math.max(0, Math.round(top)), bottom: Math.round(bottom), _lines: p.lines.length });
        } else if (p.kind === 'heading') {
            raw.push({ t: 'h', text: p.text, _marker: p.marker });
        } else if (p.marker) {
            raw.push({ t: 'item', level: LEVEL[p.marker] ?? 'bullet', text: p.text });
        } else if (/^\d{1,2}\.\s/.test(p.text)) {
            raw.push({ t: 'item', level: 'ordered', text: p.text });
        } else {
            raw.push({ t: 'p', text: p.text, _italic: p.italic });
        }
    }

    // Drop the "Answer:" label from the opening paragraph.
    const firstText = raw.find((b) => b.t === 'p' || b.t === 'item');
    if (firstText?.t === 'p' && /^Answer\b/.test(firstText.text)) {
        firstText.text = firstText.text.replace(/^Answer(?:\s*[:\-–—]\s*|\s+)/, '');
    }

    // Quotes.
    const blocks = [];
    for (let i = 0; i < raw.length; i++) {
        const b = raw[i];
        const before = blocks[blocks.length - 1];
        if (b.t === 'item') {
            // A bullet that is a quotation with its source.
            const c = splitCite(b.text);
            if (c && startsWithQuote(b.text)) {
                blocks.push({ t: 'quote', text: c.text, cite: c.cite });
                notes.quotes.push(`${b.level} item → quote (${c.cite})`);
                continue;
            }
            // A bullet that introduces a quotation with its source: "… has clearly stated: "…" (source)".
            const m = c && c.text.match(/^([\s\S]*?:)\s+(["“][\s\S]*["”][.]?)$/);
            if (m && allQuoted(m[2])) {
                blocks.push({ ...b, text: m[1] }, { t: 'quote', text: m[2], cite: c.cite });
                notes.quotes.push(`${b.level} item ending "…: "quote" (source)" → item + quote (${c.cite})`);
                continue;
            }
            blocks.push(b);
            continue;
        }
        if (b.t !== 'p') {
            blocks.push(b);
            continue;
        }
        // A verse set in italics (transliterated Sanskrit), with or without its source.
        if (b._italic >= 0.9) {
            const c = splitCite(b.text);
            blocks.push(c ? { t: 'quote', text: c.text, cite: c.cite } : { t: 'quote', text: b.text });
            notes.quotes.push(`italic verse → quote${c ? ` (${c.cite})` : ''}`);
            continue;
        }
        // A paragraph (or run of paragraphs) that is wholly a quotation, with or without a source.
        if (startsWithQuote(b.text)) {
            const run = [b];
            let n = quoteCount(b.text);
            let j = i;
            while (n % 2 && j + 1 < raw.length && raw[j + 1].t === 'p' && run.length < 4) {
                j++;
                run.push(raw[j]);
                n += quoteCount(raw[j].text);
            }
            const last = run[run.length - 1];
            const c = splitCite(last.text);
            const joined = run.map((r) => r.text).join('\n');
            const core = c ? joined.slice(0, joined.length - last.text.length) + c.text : joined;
            if (n % 2 === 0 && (allQuoted(core) || (run.length > 1 && /["”][.]?$/.test(core)))) {
                run.forEach((r, k) => {
                    const isLast = k === run.length - 1;
                    const text = isLast && c ? c.text : r.text;
                    blocks.push(isLast && c ? { t: 'quote', text, cite: c.cite } : { t: 'quote', text });
                });
                notes.quotes.push(`${run.length > 1 ? `${run.length}-paragraph ` : ''}quoted paragraph → quote${c ? ` (${c.cite})` : ''}`);
                i = j;
                continue;
            }
        }
        const c = splitCite(b.text);
        // "… teaches:" followed by a paragraph that ends with its source.
        if (c && before && (before.t === 'p' || before.t === 'item') && /:$/.test(before.text) && (!quoteCount(c.text) || allQuoted(c.text))) {
            blocks.push({ t: 'quote', text: c.text, cite: c.cite });
            notes.quotes.push(`paragraph after "…:" → quote (${c.cite})`);
            continue;
        }
        // "… In Swami's own words: "…" (source)" → paragraph + quote.
        if (c) {
            const m = c.text.match(/^([\s\S]*?:)\s+(["“][\s\S]*["”][.]?)$/);
            if (m && allQuoted(m[2])) {
                blocks.push({ t: 'p', text: m[1] }, { t: 'quote', text: m[2], cite: c.cite });
                notes.quotes.push(`paragraph ending "…: "quote" (source)" → p + quote (${c.cite})`);
                continue;
            }
        }
        // A short Title Case line standing alone between paragraphs reads as a sub-heading.
        if (titleCaseLine(b.text) && i + 1 < raw.length) {
            blocks.push({ t: 'h', text: b.text });
            notes.plainHeadings.push(b.text);
            continue;
        }
        blocks.push({ t: 'p', text: b.text });
    }

    // Lists: consecutive items of one kind form one list block.
    const out = [];
    for (const b of blocks) {
        if (b.t === 'item') {
            const prevBlock = out[out.length - 1];
            if (prevBlock?.t === 'list' && prevBlock._level === b.level) prevBlock.items.push(b.text);
            else out.push({ t: 'list', _level: b.level, items: [b.text] });
            continue;
        }
        if (b.t === 'h') {
            out.push({ t: 'h', text: b.text });
            if (b._marker) notes.bulletHeadings.push(b.text);
            continue;
        }
        out.push(b);
    }
    for (const b of out) {
        if (b.t !== 'list') continue;
        if (b._level === 'ordered') {
            const nums = b.items.map((s) => Number(s.match(/^(\d+)\./)[1]));
            if (nums.every((n, k) => n === k + 1)) {
                b.items = b.items.map((s) => s.replace(/^\d+\.\s+/, ''));
                b.ordered = true;
            }
        }
        delete b._level;
    }
    for (const b of out) {
        for (const k of Object.keys(b)) if (k.startsWith('_')) delete b[k];
    }
    return out;
}

/**
 * @param {{ file: string, lang?: 'en' | 'gu', paper?: string, source?: string }} opts
 * @returns {Promise<import('../../src/lib/booklet').Booklet & { _notes?: object }>}
 */
export async function parse({ file, lang = 'en', paper = 'faq', source } = {}) {
    if (!file) throw new Error('parse-faq: file is required');
    const pages = await readItems(file);
    const lines = buildLines(pages);
    const paras = buildParagraphs(lines);

    const sections = [];
    const notes = { quotes: [], plainHeadings: [], bulletHeadings: [], crops: [], questionsWithoutVerse: [], skippedBeforeFirstQuestion: 0 };
    let current = null;
    for (const p of paras) {
        if (p.kind === 'question') {
            // "Question 2 - (Shloka 21) Why…", "Question 1 (Verse 17): In…", "Question 6 (Shloka 58) - Can…"
            const m = p.text.match(QUESTION_RE) ?? p.text.match(/^Question\s+(\d+)()\s*[:\-–—]?\s*/);
            if (!m[2]) notes.questionsWithoutVerse.push(m[1]);
            current = { n: m[1], label: m[2].trim(), title: p.text.slice(m[0].length).replace(/\s+/g, ' ').trim(), paras: [] };
            sections.push(current);
            continue;
        }
        if (!current) {
            notes.skippedBeforeFirstQuestion++;
            continue;
        }
        current.paras.push(p);
    }

    const seen = new Set();
    const out = sections.map((s) => {
        let id = `question-${s.n}`;
        for (let k = 2; seen.has(id); k++) id = `question-${s.n}-${k}`;
        seen.add(id);
        const blocks = toBlocks(s.paras, notes);
        for (const b of blocks) if (b.t === 'crop') notes.crops.push(`${id}: page ${b.page} ${b.top}–${b.bottom}`);
        return { id, title: s.title, subtitle: s.label ? `Question ${s.n} · ${s.label}` : `Question ${s.n}`, blocks };
    });

    const booklet = {
        version: 1,
        paper: paper || 'faq',
        lang,
        title: lang === 'gu' ? 'FAQs (Gujarati)' : 'FAQs (English)',
        source: source ?? path.basename(file),
        generatedAt: new Date().toISOString(),
        groups: [{ id: 'all', title: '', sections: out }],
    };
    Object.defineProperty(booklet, '_notes', { value: notes, enumerable: false });
    return booklet;
}

// CLI: node scripts/booklets/parse-faq.mjs <file.pdf> [out.json]
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const [file, outFile] = process.argv.slice(2);
    if (!file) {
        console.error('usage: node scripts/booklets/parse-faq.mjs <file.pdf> [out.json]');
        process.exit(2);
    }
    const booklet = await parse({ file, lang: 'en', paper: 'faq', source: path.basename(file) });
    const json = JSON.stringify(booklet, null, 2) + '\n';
    if (outFile) {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(outFile, json);
    } else process.stdout.write(json);
}
