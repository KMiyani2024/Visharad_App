/**
 * Parser for the Final Exam "Vishay Prastuti" (Subject Explanations) booklets.
 *
 *   import { parse } from './parse-subject-explanations.mjs';
 *   const booklet = await parse({ file, lang: 'en' | 'gu', paper, source });
 *
 * Returns a `Booklet` (src/lib/booklet.ts): one group ("all") with 17 sections,
 * "topic-1" … "topic-17", each a list of h / p / list / quote / crop blocks.
 * Sanskrit (Devanagari) is never emitted as text: its lines are `crop` blocks,
 * slices of the page image (see "Devanagari → crops" below).
 *
 * Both booklets are tagged PDFs exported from Google Docs, so the parser combines
 * three readings of the same file:
 *
 *  1. Text: `pdftotext -bbox-layout` words. Poppler applies the PDF's ActualText,
 *     so Gujarati and Devanagari come out in logical order (pdf.js gives visual
 *     order and U+0000 for some conjuncts). Its only fault is false word breaks
 *     where a glyph's box is narrow (e.g. "દે હ", "છે ."), which we re-join by
 *     measuring the gap between word boxes.
 *  2. Structure: the tag tree. `pdfinfo -struct-text` lists every tagged element
 *     in reading order, with one string per marked-content sequence; pdf.js
 *     `getStructTree()` lists the same sequences page by page. Walking both in step
 *     maps each (page, MCID) to a document-level element, so a paragraph that runs
 *     over a page break stays one paragraph, and list items keep their list.
 *  3. Style: the pdf.js operator list gives the font and fill colour of every
 *     glyph run inside each marked-content sequence. The booklets use colour
 *     consistently: maroon (#800000/#c00000) headings, orange (#b45000) Sanskrit
 *     shlokas, grey (#555555) stand-alone citations, 24 pt for topic titles.
 *
 * Words are tied to marked content by geometry (each pdftotext word box is matched
 * to the pdf.js text item it overlaps). Page numbers are untagged artifacts and are
 * dropped with everything else outside the tag tree; the cover and table of
 * contents come before the first topic title and are skipped.
 *
 * Text is kept as printed: the only changes are joining wrapped lines, removing
 * zero-width characters (U+200B, U+FEFF, U+2060, U+00AD), removing whitespace
 * that pdftotext leaves before an Indic combining mark, and putting a misplaced
 * Gujarati mark back in order where pdf.js proves the order (see `reconcile`).
 *
 * Needs poppler's pdftotext, pdfinfo and pdftoppm, and pdfjs-dist.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const PAPER = 'subject-explanations';
const TITLES = { en: 'Vishay Prastuti (English)', gu: 'વિષયપ્રસ્તુતિ (ગુજરાતી)' };
const GU_DIGITS = '૦૧૨૩૪૫૬૭૮૯';

function tool(name) {
    for (const dir of ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin']) {
        if (existsSync(`${dir}/${name}`)) return `${dir}/${name}`;
    }
    return name; // fall back to PATH
}

function run(cmd, args) {
    return execFileSync(tool(cmd), args, { encoding: 'utf8', maxBuffer: 1 << 28 });
}

/* ------------------------------------------------------------------ text cleanup */

// Gujarati and Devanagari combining marks (vowel signs, virama, nukta, anusvara …).
const GU_MARKS = '\\u0A81-\\u0A83\\u0ABC\\u0ABE-\\u0AC5\\u0AC7-\\u0AC9\\u0ACB-\\u0ACD\\u0AE2\\u0AE3';
const DEVA_MARKS = '\\u0900-\\u0903\\u093A-\\u093C\\u093E-\\u094F\\u0951-\\u0957\\u0962\\u0963';
const SPACE_BEFORE_MARK = new RegExp(`\\s+(?=[${GU_MARKS}${DEVA_MARKS}])`, 'gu');
const ZERO_WIDTH = /[​﻿⁠­]/g;

export function cleanText(s) {
    return s.replace(ZERO_WIDTH, '').replace(SPACE_BEFORE_MARK, '').replace(/\s+/g, ' ').trim();
}

const toLatinDigits = (s) => s.replace(/[૦-૯]/g, (d) => String(GU_DIGITS.indexOf(d)));
const toGujaratiDigits = (n) => String(n).replace(/\d/g, (d) => GU_DIGITS[+d]);

/* ------------------------------------------------------- 1. tag tree (pdfinfo) */

/** One entry per marked-content leaf, in reading order: the chain of enclosing elements. */
function readStructLeaves(file) {
    const out = run('pdfinfo', ['-struct-text', file]);
    const leaves = [];
    const stack = [];
    let nextId = 0;
    for (const line of out.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        const indent = line.length - line.trimStart().length;
        while (stack.length && stack.at(-1).indent >= indent) stack.pop();
        if (t.startsWith('"')) {
            leaves.push(stack.map(({ id, role }) => ({ id, role })));
        } else if (/^[A-Za-z][\w:-]*( \((block|inline)\))?$/.test(t)) {
            stack.push({ indent, id: nextId++, role: t.split(' ')[0] });
        }
        // Anything else (attribute lines) is ignored.
    }
    return leaves;
}

/* ------------------------------------------------------- 2. words (pdftotext) */

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (s) =>
    s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, e) =>
        e[0] === '#'
            ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
            : (XML_ENTITIES[e] ?? m),
    );

/**
 * Words per page: { t, x0, y0, x1, y1, line, idx } in points from the top-left
 * corner; `line` numbers pdftotext's lines, `idx` keeps its word order.
 */
function readWords(file) {
    const html = run('pdftotext', ['-bbox-layout', '-remove-hyphens', 'none', '-enc', 'UTF-8', file, '-']);
    const pages = [];
    const re = /<page\b[^>]*>|<line\b[^>]*>|<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
    let m;
    let line = 0;
    let idx = 0;
    while ((m = re.exec(html))) {
        if (m[0].startsWith('<page')) pages.push([]);
        else if (m[0].startsWith('<line')) line++;
        else pages.at(-1).push({ t: decodeXml(m[5]), x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], line, idx: idx++ });
    }
    return pages;
}

/* ------------------------------------------- 3. items, styles, tags (pdf.js) */

const MAROON = new Set(['#800000', '#c00000']);
const ORANGE = '#b45000';
const GREY = '#555555';

async function readPdf(file) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(readFileSync(file)),
        fontExtraProperties: true,
        disableFontFace: true,
        isEvalSupported: false,
        verbosity: 0,
    }).promise;
    const OPS = pdfjs.OPS;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const height = page.view[3] - page.view[1];
        const width = page.view[2] - page.view[0];

        // Marked-content sequences in tag-tree order.
        const order = [];
        const walk = (node) => {
            for (const c of node?.children ?? []) {
                if (c.type === 'content') order.push(mcidOf(c.id));
                else walk(c);
            }
        };
        walk(await page.getStructTree());

        // Per-MCID glyph statistics from the operator list.
        const ol = await page.getOperatorList();
        const fontName = (id) => {
            try {
                return page.commonObjs.get(id)?.name?.replace(/^[A-Z]{6}\+/, '') ?? '';
            } catch {
                return '';
            }
        };
        const stats = new Map();
        const gs = [];
        let state = { fill: '#000000', font: '' };
        const mcStack = [];
        let mc = null;
        for (let i = 0; i < ol.fnArray.length; i++) {
            const fn = ol.fnArray[i];
            const a = ol.argsArray[i];
            if (fn === OPS.save) gs.push({ ...state });
            else if (fn === OPS.restore) state = gs.pop() ?? state;
            else if (fn === OPS.setFillRGBColor) state.fill = String(a[0]).toLowerCase();
            else if (fn === OPS.setFont) state.font = fontName(a[0]);
            else if (fn === OPS.beginMarkedContentProps) {
                mcStack.push(mc);
                if (typeof a[1] === 'number') mc = a[1];
            } else if (fn === OPS.beginMarkedContent) mcStack.push(mc);
            else if (fn === OPS.endMarkedContent) mc = mcStack.pop() ?? null;
            else if (fn === OPS.showText || fn === OPS.showSpacedText) {
                if (mc === null) continue;
                if (!stats.has(mc)) stats.set(mc, newStats());
                const s = stats.get(mc);
                for (const g of a[0]) {
                    if (!g || typeof g !== 'object') continue;
                    const u = g.unicode ?? '';
                    if (/^\s*$/.test(u) && u !== '\u0000') {
                        s.spaces++;
                        if (/Bold/i.test(state.font)) s.boldSpaces++;
                        continue;
                    }
                    s.glyphs++;
                    if (MAROON.has(state.fill)) s.maroon++;
                    if (state.fill === ORANGE || /Mangal/i.test(state.font)) s.orange++;
                    if (state.fill === GREY) s.grey++;
                    if (/Bold/i.test(state.font)) s.bold++;
                    if (/Italic|Oblique/i.test(state.font)) s.italic++;
                }
            }
        }

        // Text items with their MCID.
        const tc = await page.getTextContent({ includeMarkedContent: true });
        const items = [];
        const spaces = []; // explicit space glyphs: proof of a word break
        const tcStack = [];
        let cur = null;
        for (const it of tc.items) {
            if (it.type === 'beginMarkedContentProps' || it.type === 'beginMarkedContent') {
                tcStack.push(cur);
                if (it.type === 'beginMarkedContentProps' && it.id) cur = mcidOf(it.id);
                continue;
            }
            if (it.type === 'endMarkedContent') {
                cur = tcStack.pop() ?? null;
                continue;
            }
            if (!('str' in it) || !it.str) continue;
            const [, , c, d, e, f] = it.transform;
            const size = Math.hypot(c, d);
            const base = height - f;
            if (!it.str.trim()) {
                if (it.width > 0.05 * size) spaces.push({ x0: e, x1: e + it.width, base, size });
                continue;
            }
            items.push({ mcid: cur, str: it.str, x0: e, x1: e + it.width, base, top: base - 0.8 * size, bottom: base + 0.25 * size, size });
        }
        pages.push({ width, height, order, stats, items, spaces });
    }
    return pages;
}

const mcidOf = (id) => {
    const m = /_mc(\d+)$/.exec(String(id));
    return m ? +m[1] : null;
};

const newStats = () => ({ glyphs: 0, maroon: 0, orange: 0, grey: 0, bold: 0, italic: 0, spaces: 0, boldSpaces: 0 });
const addStats = (a, b) => {
    for (const k of Object.keys(a)) a[k] += b[k];
    return a;
};

/* ----------------------------------------------------------- 4. words → items */

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** The text item a word box overlaps most (vertically first, then horizontally). */
function overlapItem(w, items) {
    let best = null;
    let bestScore = 0;
    for (const it of items) {
        const v = overlap(w.y0, w.y1, it.top, it.bottom);
        const x = overlap(w.x0, w.x1, it.x0, it.x1);
        if (v <= 0 || x <= 0) continue;
        const score = v * 1000 + x;
        if (score > bestScore) {
            best = it;
            bestScore = score;
        }
    }
    return best;
}

/** The item nearest a word horizontally, within `max` points. */
function nearestItem(w, items, max) {
    let best = null;
    let dist = max;
    for (const it of items) {
        const d = w.x1 < it.x0 ? it.x0 - w.x1 : w.x0 > it.x1 ? w.x0 - it.x1 : 0;
        if (d < dist) {
            best = it;
            dist = d;
        }
    }
    return best;
}

/**
 * Matches every word of a page to a text item. Each pdftotext line first picks the
 * baseline most of its (width-weighted) words overlap; its words are then matched
 * only among the items on that baseline. Gujarati word boxes are taller than the
 * line pitch, and a lone mark ("ં", "ુ") can overlap the line below better than
 * its own, so per-word geometry alone misplaces marks.
 */
function matchWords(words, items) {
    const match = new Array(words.length).fill(null);
    const byLine = new Map();
    words.forEach((w, i) => {
        if (!byLine.has(w.line)) byLine.set(w.line, []);
        byLine.get(w.line).push(i);
    });
    for (const idxs of byLine.values()) {
        const votes = new Map();
        for (const i of idxs) {
            const w = words[i];
            const it = overlapItem(w, items);
            if (it) votes.set(it.base, (votes.get(it.base) ?? 0) + Math.max(0.1, w.x1 - w.x0));
        }
        let base = null;
        let top = 0;
        for (const [b, v] of votes) if (v > top) [base, top] = [b, v];
        if (base === null) {
            // No overlap at all (e.g. a line of zero-width marks): use the nearest item.
            for (const i of idxs) {
                const w = words[i];
                const near = items.filter((it) => overlap(w.y0, w.y1, it.top, it.bottom) >= 0.5 * (it.bottom - it.top));
                match[i] = nearestItem(w, near, 6);
            }
            continue;
        }
        const onLine = items.filter((it) => Math.abs(it.base - base) <= 0.4 * it.size);
        for (const i of idxs) match[i] = overlapItem(words[i], onLine) ?? nearestItem(words[i], onLine, 12);
    }
    return match;
}

/**
 * Joins the words of one chunk into its text, line by line. Two word boxes are
 * separated by a space if the gap is a real space wide (≥ 0.19 em; false breaks
 * measure ≤ 0.16 em) or an explicit space glyph lies between them. Each Indic
 * token is then checked against pdf.js (see `reconcile`).
 */
function chunkLines(words, page, pageNo, counts) {
    const sorted = [...words].sort((a, b) => a.base - b.base || a.x0 - b.x0);
    const lines = [];
    for (const w of sorted) {
        const line = lines.at(-1);
        if (line && Math.abs(w.base - line.base) <= 0.4 * Math.min(w.size, line.size)) line.words.push(w);
        else lines.push({ base: w.base, size: w.size, words: [w] });
    }
    return lines.map((l) => {
        // pdftotext's own order inside each of its line segments (it places marks
        // correctly), segments left to right (it may split a justified line).
        const segX = new Map();
        for (const w of l.words) segX.set(w.line, Math.min(segX.get(w.line) ?? Infinity, w.x0));
        const ws = l.words.sort((a, b) => segX.get(a.line) - segX.get(b.line) || a.line - b.line || a.idx - b.idx);
        const tokens = [[ws[0]]];
        for (let i = 1; i < ws.length; i++) {
            const a = ws[i - 1];
            const b = ws[i];
            const em = Math.min(a.size, b.size);
            const wide = b.x0 - a.x1 > 0.19 * em;
            const glyph = page.spaces.some(
                (sp) =>
                    Math.abs(sp.base - l.base) <= 0.4 * em &&
                    (sp.x0 + sp.x1) / 2 >= a.x1 - 0.5 &&
                    (sp.x0 + sp.x1) / 2 <= b.x0 + 0.5,
            );
            if (wide || glyph) tokens.push([b]);
            else tokens.at(-1).push(b);
        }
        const texts = tokens.map((t) => reconcile(t, l.base, page.items, counts));
        return {
            text: texts.join(' '),
            tokens: texts,
            page: pageNo,
            base: l.base,
            size: l.size,
            x0: Math.min(...ws.map((w) => w.x0)),
            x1: Math.max(...ws.map((w) => w.x1)),
        };
    });
}

/* Indic text checks. */
const GU_VS = '\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB\u0ACC\u0AE2\u0AE3';
const DV_VS = '\u093A\u093B\u093E-\u094C\u094E\u094F\u0955-\u0957\u0962\u0963';
const INDIC = /[\u0900-\u097F\u0A80-\u0AFF]/u;
const BROKEN_INDIC = new RegExp(
    [
        `(^|[^\\u0900-\\u097F\\u0A80-\\u0AFF\\u200C\\u200D])[\\u0A81-\\u0A83\\u0ABC${GU_VS}\\u0ACD\\u0900-\\u0903\\u093C${DV_VS}\\u094D]`, // mark with no base
        `[${GU_VS}][${GU_VS}]|[${DV_VS}][${DV_VS}]`, // two vowel signs
        `[\\u0A81-\\u0A83][${GU_VS}]|[\\u0901-\\u0903][${DV_VS}]`, // anusvara/visarga before a vowel sign
        `\\u0ACD[${GU_VS}\\u0A81-\\u0A83]|\\u094D[${DV_VS}\\u0900-\\u0903]`, // virama before a vowel sign
    ].join('|'),
    'u',
);
/** True if a Gujarati/Devanagari string has an impossible mark sequence. */
export const brokenIndic = (s) => BROKEN_INDIC.test(s.replace(ZERO_WIDTH, ''));
const sameLetters = (a, b) => [...a].sort().join('') === [...b].sort().join('');
// pdf.js keeps glyph order: right for everything except pre-base vowel signs (ि િ)
// and glyphs with no Unicode (U+0000: reph, some conjuncts).
const trustedRun = (s) => !/[\u0000\u093F\u0ABF]/.test(s);

/**
 * pdftotext gives Indic text in logical order through the PDF's ActualText, but
 * where a word has none it falls back to glyph order and can misplace ु ૂ ં
 * ("न्यनूा", "સારંુ"). pdf.js reads the same glyphs: its runs are reliable unless
 * they hold a pre-base vowel sign or an unmapped glyph. For each Indic token we
 * rebuild the text from pdf.js's reliable runs, filling its one unreliable gap
 * (if any) with pdftotext's leftover letters, and use it only when it is an exact
 * permutation of pdftotext's letters and pdftotext's token has an impossible mark
 * sequence that the rebuilt one does not. Letters are never added, dropped or
 * changed; a token that is wrong but well-formed (e.g. a misplaced ु that still
 * follows a consonant) cannot be detected and is left as pdftotext gave it.
 */
function reconcile(words, base, items, counts) {
    const t = words.map((w) => w.t).join('');
    const plain = t.replace(ZERO_WIDTH, '');
    if (!INDIC.test(plain)) return t;
    const x0 = Math.min(...words.map((w) => w.x0));
    const x1 = Math.max(...words.map((w) => w.x1));
    const runs = items
        .filter((it) => Math.abs(it.base - base) <= 0.4 * it.size && overlap(x0 - 0.5, x1 + 0.5, it.x0, it.x1) > 0.05)
        .sort((a, b) => a.x0 - b.x0);
    // Every run must lie inside the token (no neighbouring words) and hold no spaces.
    if (!runs.length || runs.some((r) => r.x0 < x0 - 1.5 || r.x1 > x1 + 1.5 || /\s/.test(r.str.trim()))) return t;
    const strs = runs.map((r) => r.str.trim());
    let fixed;
    if (strs.every(trustedRun)) fixed = strs.join('');
    else {
        // Merge consecutive unreliable runs; allow exactly one such gap.
        const parts = [];
        for (const s of strs) {
            const ok = trustedRun(s);
            if (!ok && parts.at(-1) && !parts.at(-1).ok) parts.at(-1).s += s;
            else parts.push({ s, ok });
        }
        if (parts.filter((p) => !p.ok).length !== 1) return t;
        const left = [...plain];
        for (const p of parts.filter((q) => q.ok)) {
            for (const ch of p.s) {
                const k = left.indexOf(ch);
                if (k < 0) return t;
                left.splice(k, 1);
            }
        }
        fixed = parts.map((p) => (p.ok ? p.s : left.join(''))).join('');
    }
    if (fixed === plain || !sameLetters(fixed, plain)) return t;
    const use = brokenIndic(plain) && !brokenIndic(fixed);
    if (counts) (counts.reconcile ??= []).push(`${use ? 'USE ' : 'skip'} ${plain} → ${fixed}`);
    return use ? fixed : t;
}

/** Joins wrapped lines: no space after a hyphen, dash or slash that ends a word. */
function joinLines(lines) {
    let out = '';
    for (const raw of lines) {
        const l = raw.trim();
        if (!l) continue;
        if (!out) out = l;
        else if (/[\p{L}\p{M}\p{N}][-‐‑–—/]$/u.test(out)) out += l;
        else out += ' ' + l;
    }
    return out;
}

/* ------------------------------------------------------------ 5. elements */

const BLOCK_ROLES = /^(P|H\d?|LI|Caption|BlockQuote|Quote|Note|TOCI|Figure)$/;

/**
 * Reads the PDF into document-level elements in reading order, each with its text,
 * role, list ancestry, glyph statistics, size and pages. Exported for QA.
 */
export async function extract(file) {
    const leaves = readStructLeaves(file);
    const wordPages = readWords(file);
    const pdfPages = await readPdf(file);

    const total = pdfPages.reduce((n, p) => n + p.order.length, 0);
    if (total !== leaves.length) {
        throw new Error(`Tag tree mismatch in ${file}: pdfinfo has ${leaves.length} leaves, pdf.js ${total}.`);
    }

    const elements = [];
    const byId = new Map();
    const unmatched = [];
    const gaps = {}; // QA counters (see reconcile)
    const pageLines = []; // every text line's baseline and size per page (crop limits)
    let leafIndex = 0;

    pdfPages.forEach((pg, pi) => {
        // Assign this page's words to marked content.
        const byMc = new Map();
        const pageWords = wordPages[pi] ?? [];
        const matches = matchWords(pageWords, pg.items);
        const seen = new Map();
        for (const it of matches) if (it && it.base !== undefined) seen.set(Math.round(it.base * 2), { base: it.base, size: it.size });
        pageLines[pi] = [...seen.values()].sort((a, b) => a.base - b.base);
        for (const [wi, w] of pageWords.entries()) {
            const it = matches[wi];
            if (!it) {
                unmatched.push({ page: pi + 1, text: w.t });
                continue;
            }
            if (it.mcid === null) continue; // artifact: page number
            if (!byMc.has(it.mcid)) byMc.set(it.mcid, []);
            byMc.get(it.mcid).push({ ...w, base: it.base, size: it.size });
        }

        for (const mcid of pg.order) {
            const chain = leaves[leafIndex++];
            if (chain[0]?.role === 'Document') chain.shift();
            const words = byMc.get(mcid) ?? [];
            const stats = pg.stats.get(mcid) ?? newStats();
            if (!words.length && !stats.glyphs) continue;

            // The block element: the deepest P/H/LI…; LBody, Lbl and Span roll up to it.
            let k = chain.length - 1;
            while (k > 0 && !BLOCK_ROLES.test(chain[k].role)) k--;
            const el = chain[k] ?? { id: -1 - leafIndex, role: 'P' };
            const lists = chain.slice(0, k + 1).filter((c) => c.role === 'L');
            let e = byId.get(el.id);
            if (!e) {
                e = {
                    id: el.id,
                    role: el.role,
                    roles: chain.map((c) => c.role).join('>'),
                    listId: lists[0]?.id ?? null,
                    listDepth: lists.length,
                    lines: [],
                    stats: newStats(),
                    size: 0,
                    pages: [],
                };
                byId.set(el.id, e);
                elements.push(e);
            }
            e.lines.push(...chunkLines(words, pg, pi + 1, gaps));
            addStats(e.stats, stats);
            for (const w of words) e.size = Math.max(e.size, w.size);
            if (!e.pages.includes(pi + 1)) e.pages.push(pi + 1);
        }
    });

    for (const e of elements) {
        e.rawText = joinLines(e.lines.map((l) => l.text));
        e.text = cleanText(e.rawText);
        const g = e.stats.glyphs || 1;
        e.maroon = e.stats.maroon / g;
        e.orange = e.stats.orange / g;
        e.grey = e.stats.grey / g;
        e.bold = e.stats.bold / g;
        e.italic = e.stats.italic / g;
        e.boldSpaces = e.stats.spaces ? e.stats.boldSpaces / e.stats.spaces : 0;
    }
    const pages = pdfPages.map((pg, pi) => ({ width: pg.width, height: pg.height, lines: pageLines[pi] }));
    return { elements: elements.filter((e) => e.text), unmatched, gaps, pages };
}

/* ---------------------------------------------------------- 6. classification */

const BULLET = /^[●○◦•▪▫■□◆◇❖➢➤►▶✓✔⮚•]\s*/u;
const O_BULLET = /^o\s+(?=\S)/; // Word's Courier "o" sub-bullet
const NUM_LABEL = /^(\(?([0-9૦-૯]+)[.)])\s+/u;
const PAREN_NUM = /^\(\s*[0-9૦-૯]+\s*\)\s*\S/u;
const OPEN_QUOTE = /["“‘']/u;
// A quotation that closes the paragraph, then a parenthesised source.
const INLINE_CITE = /^([\s\S]*[”"’'][.,;:।]?)\s*\(([^()]*[0-9૦-૯][^()]*)\)\s*[.।]?$/u;
const CITE_ONLY = /^\(([^()]+)\)\s*[.।]?$/u;

const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;
const endsSentence = (s) => /[.!।]["”’']?$/u.test(s);

function topicHeading(e, lang) {
    if (e.size < 21 || e.maroon < 0.6) return null;
    const m =
        lang === 'gu'
            ? /^વિષય\s*([૦-૯0-9]+)\s*[-–—:]\s*(.+)$/u.exec(e.text)
            : /^Topic\s*(\d+)\s*[:.–-]\s*(.+)$/iu.exec(e.text);
    return m ? { n: +toLatinDigits(m[1]), title: m[2].trim() } : null;
}

function isHeading(e, text) {
    if (e.maroon >= 0.6) return true;
    const short = text.length <= 110 && wordCount(text) <= 16;
    if (!short || endsSentence(text) || OPEN_QUOTE.test(text[0]) || CITE_ONLY.test(text)) return false;
    if (/^H\d?$/.test(e.role)) return true; // tagged heading
    if (e.role === 'LI') return false;
    if (e.bold >= 0.8 || (e.boldSpaces >= 0.8 && e.stats.spaces >= 1)) return true; // bold line
    if (e.italic >= 0.8 && /[:?]$/.test(text)) return true; // "(1) Liberation … through Satsang:"
    if (PAREN_NUM.test(text) && /[:?]$/.test(text)) return true; // "(૧) સત્સંગ કરવાથી …:"
    if (NUM_LABEL.test(text) && wordCount(text) <= 12) return true; // "2. Naivedya (Offering of Food – Thal)"
    return false;
}

function finishList(blocks) {
    const b = blocks.at(-1);
    if (b?.t !== 'list' || !b._raw) return;
    // Numbered items 1…n become an ordered list without their labels.
    const nums = b._raw.map((s) => NUM_LABEL.exec(s));
    if (nums.every(Boolean) && nums.every((m, i) => +toLatinDigits(m[2]) === i + 1)) {
        b.items = b._raw.map((s) => s.replace(NUM_LABEL, ''));
        b.ordered = true;
    }
    delete b._raw;
    delete b._key;
}

/* ------------------------------------------------------- Devanagari → crops */

/*
 * The Sanskrit (Devanagari) in these PDFs cannot be extracted faithfully: Word
 * saved wrong glyph-to-Unicode data, so vowel signs land on the wrong consonant
 * ("गुरोः" → "गरुोः", "सुखा" → "सखुा"), and some of the errors are well-formed.
 * No Devanagari text is ever emitted: every line holding Devanagari becomes part
 * of a `crop` block (a slice of the page image), and the text around it stays text.
 *
 * Devanagari means Unicode Script=Devanagari. The danda and double danda (U+0964,
 * U+0965) are Script=Common and close Gujarati verses too, so outside a Sanskrit
 * line they stay text. Set CROP_DANDA to treat them as Devanagari as well.
 */
const CROP_DANDA = false;
const DEVANAGARI = CROP_DANDA ? /[\p{Script=Devanagari}\u0964\u0965]/u : /\p{Script=Devanagari}/u;
// Quote marks and closing punctuation next to a verse go with it into the crop.
const VERSE_BEFORE = /^[“"‘']+$/u;
const VERSE_AFTER = /^[”"’'।॥.,;:!?]+$/u;

/**
 * Splits an element into pieces in reading order: { text } for runs of tokens
 * without Devanagari and { crop: lines } for the lines holding Devanagari. A line
 * that mixes scripts is cropped whole; its other words are kept as text as well,
 * so the text still reads in full.
 */
function splitDevanagari(e) {
    if (!DEVANAGARI.test(e.text)) return [{ text: e.text }];
    const seq = e.lines.flatMap((l, li) => l.tokens.map((t) => ({ t, li })));
    const deva = seq.map((x) => DEVANAGARI.test(x.t));
    for (let i = 0; i < seq.length; i++) {
        if (!deva[i]) continue;
        for (let j = i - 1; j >= 0 && !deva[j] && VERSE_BEFORE.test(cleanText(seq[j].t)); j--) deva[j] = true;
        for (let j = i + 1; j < seq.length && !deva[j] && VERSE_AFTER.test(cleanText(seq[j].t)); j++) deva[j] = true;
    }
    const pieces = [];
    for (let i = 0; i < seq.length; ) {
        let j = i;
        while (j < seq.length && deva[j] === deva[i]) j++;
        const run = seq.slice(i, j);
        if (deva[i]) {
            const lis = [...new Set(run.map((x) => x.li))];
            const prev = pieces.at(-1);
            if (prev?.crop) prev.crop.push(...lis.filter((li) => !prev.crop.includes(li)));
            else pieces.push({ crop: lis });
        } else {
            const byLine = [];
            for (const x of run) {
                if (byLine.at(-1)?.li !== x.li) byLine.push({ li: x.li, ts: [] });
                byLine.at(-1).ts.push(x.t);
            }
            const text = cleanText(joinLines(byLine.map((b) => b.ts.join(' '))));
            if (text) pieces.push({ text });
        }
        i = j;
    }
    for (const p of pieces) if (p.crop) p.crop = p.crop.sort((a, b) => a - b).map((li) => e.lines[li]);
    return pieces;
}

/** Adds crop lines to the section, extending the previous crop on the same page. */
function pushCrop(blocks, lines) {
    for (const l of lines) {
        const last = blocks.at(-1);
        if (last?.t === 'crop' && last.page === l.page) last._lines.push(l);
        else blocks.push({ t: 'crop', page: l.page, top: 0, bottom: 0, _lines: [l] });
    }
}

/* ------------------------------------------------------------ classification */

function classify(elements, lang) {
    const sections = [];
    let sec = null;
    let shloka = null; // the open quote block collecting non-Devanagari verse lines

    const push = (block) => {
        if (block.t !== 'list') finishList(sec.blocks);
        sec.blocks.push(block);
    };

    for (const e of elements) {
        const top = topicHeading(e, lang);
        if (top) {
            if (sec) finishList(sec.blocks);
            sec = {
                id: `topic-${top.n}`,
                title: top.title,
                subtitle: lang === 'gu' ? `વિષય ${toGujaratiDigits(top.n)}` : `Topic ${top.n}`,
                blocks: [],
                _x: [Infinity, -Infinity],
            };
            sections.push(sec);
            shloka = null;
            continue;
        }
        if (!sec) continue; // cover and table of contents
        for (const l of e.lines) sec._x = [Math.min(sec._x[0], l.x0), Math.max(sec._x[1], l.x1)];

        splitDevanagari(e).forEach((piece, n) => {
            if (piece.crop) {
                finishList(sec.blocks);
                pushCrop(sec.blocks, piece.crop);
                return;
            }
            // Text after a crop continues the element as a plain paragraph.
            classifyText(n === 0 ? e : { ...e, role: 'P', listId: null, listDepth: 0 }, piece.text);
        });
    }
    if (sec) finishList(sec.blocks);
    return sections;

    function classifyText(e, text) {
        const blocks = sec.blocks;
        const last = blocks.at(-1);

        // Verse lines in orange that are not Devanagari: one quote, one line each.
        if (e.orange >= 0.6) {
            if (shloka && last === shloka) shloka.text += '\n' + text;
            else push((shloka = { t: 'quote', text }));
            return;
        }

        // A citation on its own line belongs to the passage above it; after a
        // cropped verse it stays a paragraph of its own.
        const co = CITE_ONLY.exec(text);
        if (co && (e.grey >= 0.6 || /[0-9૦-૯]/.test(co[1])) && last && !last.cite) {
            if (last.t === 'quote') {
                last.cite = co[1].trim();
                return;
            }
            if (last.t === 'p') {
                blocks[blocks.length - 1] = { t: 'quote', text: last.text, cite: co[1].trim() };
                return;
            }
        }

        const bullet = BULLET.test(text) || (e.role === 'LI' && O_BULLET.test(text));
        const stripped = text.replace(BULLET, '').replace(e.role === 'LI' ? O_BULLET : /^$/, '');
        if (!stripped) return;

        if (isHeading(e, stripped)) {
            push({ t: 'h', text: stripped });
            return;
        }

        if (e.role === 'LI' || (bullet && e.role !== 'P')) {
            const key = `${e.listId}:${e.listDepth}`;
            if (last?.t === 'list' && last._key === key) {
                last._raw.push(stripped);
                last.items.push(stripped);
            } else {
                finishList(blocks);
                blocks.push({ t: 'list', items: [stripped], _raw: [stripped], _key: key });
            }
            return;
        }

        const ic = INLINE_CITE.exec(text);
        if (ic && OPEN_QUOTE.test(ic[1])) {
            push({ t: 'quote', text: ic[1].trim(), cite: ic[2].trim() });
            return;
        }

        push({ t: 'p', text });
    }
}

/* ---------------------------------------------------------------- crop edges */

const DPI = 144;
const PX = DPI / 72; // pixels per point
const INK = 200; // grey level below which a pixel is ink (the verse panel is ~251)
const PAD = 4; // points of white kept around the verse
const MIN_GAP = 1.5; // points: the thinnest blank band taken for a gap between lines
// Verse ink reaches at most 1.01 em above and 0.44 em below the baseline (measured
// over every crop of both booklets that has a clean gap).
const ENV_TOP = 1.02;
const ENV_BOTTOM = 0.46;

/** Renders one page as an 8-bit grey PGM: { w, h, data }. */
function renderPage(file, page) {
    const buf = execFileSync(tool('pdftoppm'), ['-f', String(page), '-l', String(page), '-r', String(DPI), '-gray', '-singlefile', file], {
        maxBuffer: 1 << 28,
    });
    // Header: "P5" w h maxval, separated by whitespace, then one byte per pixel.
    let pos = 0;
    const fields = [];
    while (fields.length < 4) {
        while (/\s/.test(String.fromCharCode(buf[pos]))) pos++;
        let tok = '';
        while (!/\s/.test(String.fromCharCode(buf[pos]))) tok += String.fromCharCode(buf[pos++]);
        fields.push(tok);
    }
    pos++;
    if (fields[0] !== 'P5' || +fields[3] !== 255) throw new Error(`Unexpected pdftoppm output for page ${page}`);
    return { w: +fields[1], h: +fields[2], data: buf.subarray(pos) };
}

/**
 * Sets each crop's top and bottom (PDF points from the top of the page) and the
 * booklet-wide left and right. The search for each edge runs from the verse's
 * outer line towards the neighbouring text line (or 3 em when there is none) and
 * takes the nearest band of blank rows across [left, right] as the gap between
 * them: the edge goes PAD points into that gap from the verse side, at most half
 * way, so no ink of the verse is cut and none of the neighbour is shown.
 */
function resolveCrops(file, sections, pages) {
    const crops = sections.flatMap((s) => s.blocks.filter((b) => b.t === 'crop'));
    if (!crops.length) return { left: 0, right: 0, notes: [] };
    const x0 = Math.min(...sections.map((s) => s._x[0]));
    const x1 = Math.max(...sections.map((s) => s._x[1]));
    const width = pages[0].width;
    const left = Math.max(0, Math.floor(x0 - 8));
    const right = Math.min(width, Math.ceil(x1 + 8));
    const notes = [];
    const envelope = []; // measured ink extents, returned for QA
    const renders = new Map();
    for (const c of crops) {
        if (!renders.has(c.page)) renders.set(c.page, renderPage(file, c.page));
        const img = renders.get(c.page);
        const cx0 = Math.round(left * PX);
        const cx1 = Math.min(img.w, Math.round(right * PX));
        const blank = (row) => {
            if (row < 0 || row >= img.h) return true;
            const o = row * img.w;
            for (let x = cx0; x < cx1; x++) if (img.data[o + x] < INK) return false;
            return true;
        };
        const lines = c._lines.sort((a, b) => a.base - b.base);
        const first = lines[0];
        const last = lines.at(-1);
        const pageLines = pages[c.page - 1].lines;
        const above = pageLines.filter((l) => l.base < first.base - 0.6 * first.size).at(-1);
        const below = pageLines.find((l) => l.base > last.base + 0.6 * last.size);
        const height = pages[c.page - 1].height;

        // Blank bands (runs of blank rows, at least MIN_GAP) between two pixel rows.
        const bands = (from, to) => {
            const out = [];
            let start = null;
            for (let r = from; r <= to; r++) {
                const b = r < to && blank(r);
                if (b && start === null) start = r;
                if (!b && start !== null) {
                    if (r - start >= MIN_GAP * PX) out.push({ start, end: r, len: r - start });
                    start = null;
                }
            }
            return out;
        };

        // Top: the band nearest the verse that lies above its matra zone (so the
        // gap under an anusvara dot is not taken for the line gap), else the nearest.
        const up = bands(
            Math.max(0, Math.round((above ? above.base : first.base - 3 * first.size) * PX)),
            Math.round((first.base - 0.35 * first.size) * PX),
        ).reverse();
        const g1 = up.find((g) => g.end <= (first.base - 0.9 * first.size) * PX) ?? up[0];
        // Bottom: the first band below the verse's baseline.
        const g2 = bands(
            Math.round(last.base * PX),
            Math.min(Math.round(height * PX), Math.round((below ? below.base - 0.35 * below.size : last.base + 3 * last.size) * PX)),
        )[0];

        // Lines set too tight for a blank band: cut at the least-inked row of the
        // zone between the two lines (ties: nearest the middle of the zone), but
        // never inside the verse's own ink envelope, so nothing of it is cut off.
        const inkCount = (row) => {
            const o = row * img.w;
            let n = 0;
            for (let x = cx0; x < cx1; x++) if (img.data[o + x] < INK) n++;
            return n;
        };
        const valley = (z0, z1) => {
            let [a, b] = [Math.round(Math.min(z0, z1) * PX), Math.round(Math.max(z0, z1) * PX)];
            const mid = (a + b) / 2;
            let best = null;
            for (let r = a; r <= b; r++) {
                const n = inkCount(r);
                if (!best || n < best.n || (n === best.n && Math.abs(r - mid) < Math.abs(best.r - mid))) best = { r, n };
            }
            return best;
        };

        if (g1) envelope.push({ side: 'top', em: (first.base - g1.end / PX) / first.size, page: c.page });
        if (g2) envelope.push({ side: 'bottom', em: (g2.start / PX - last.base) / last.size, page: c.page });
        if (g1) c.top = (g1.end - Math.min(PAD * PX, g1.len / 2)) / PX;
        else if (above) {
            const v = valley(above.base + 0.15 * above.size, first.base - 0.75 * first.size);
            c.top = Math.min(v.r / PX, first.base - ENV_TOP * first.size);
            notes.push(`page ${c.page}: lines touch above the verse at ${first.base.toFixed(1)}; cut at ${c.top.toFixed(1)} (thinnest row ${(v.r / PX).toFixed(1)}, ${v.n} ink px)`);
        } else c.top = first.base - 1.15 * first.size - PAD;
        if (g2) c.bottom = (g2.start + Math.min(PAD * PX, g2.len / 2)) / PX;
        else if (below) {
            const v = valley(last.base + 0.2 * last.size, below.base - 0.75 * below.size);
            c.bottom = Math.max((v.r + 1) / PX, last.base + ENV_BOTTOM * last.size);
            notes.push(`page ${c.page}: lines touch below the verse at ${last.base.toFixed(1)}; cut at ${c.bottom.toFixed(1)} (thinnest row ${((v.r + 1) / PX).toFixed(1)}, ${v.n} ink px)`);
        } else c.bottom = last.base + 0.55 * last.size + PAD;
        c.top = Math.max(0, Math.floor(c.top * 2) / 2);
        c.bottom = Math.min(height, Math.ceil(c.bottom * 2) / 2);
        c.left = left;
        c.right = right;
        delete c._lines;
    }
    return { left, right, notes, envelope };
}

/* -------------------------------------------------------------------- entry */

/**
 * @param {{ file: string, lang: 'en' | 'gu', paper?: string, source?: string }} opts
 * @returns {Promise<import('../../src/lib/booklet').Booklet>}
 */
export async function parse({ file, lang, paper = PAPER, source }) {
    if (lang !== 'en' && lang !== 'gu') throw new Error(`lang must be 'en' or 'gu', got ${lang}`);
    const { elements, pages } = await extract(file);
    const sections = classify(elements, lang);
    const crops = resolveCrops(file, sections, pages);
    for (const n of crops.notes) console.warn(`parse-subject-explanations: ${basename(file)}: ${n}`);
    for (const sec of sections) delete sec._x;

    const ns = sections.map((s) => s.id);
    const expected = Array.from({ length: 17 }, (_, i) => `topic-${i + 1}`);
    if (ns.join() !== expected.join()) {
        throw new Error(`Expected topic-1 … topic-17 in ${file}, found: ${ns.join(', ')}`);
    }

    const devanagari = JSON.stringify(sections).match(new RegExp(DEVANAGARI.source, 'gu'));
    if (devanagari) throw new Error(`Devanagari left in the text of ${file}: ${devanagari.slice(0, 10).join(' ')}`);

    return {
        version: 1,
        paper: paper || PAPER,
        lang,
        title: TITLES[lang],
        source: source ?? basename(file),
        generatedAt: new Date().toISOString(),
        groups: [{ id: 'all', title: '', sections }],
    };
}
