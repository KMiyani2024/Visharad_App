/**
 * Parser for the Final Exam "Selected Mukhpath" booklets (PDF) -> Booklet JSON
 * (see src/lib/booklet.ts).
 *
 *   English (lang 'en'): the text extracts cleanly, so each "●" reference becomes
 *   a { t: 'ref', text, cite, translation } block.
 *
 *   Gujarati (lang 'gu'): the fonts map vowel signs wrongly ("નિમેષ" extracts as
 *   "નનમેષ"), so no text is ever emitted. Each shlok becomes one or more
 *   { t: 'crop', page, top, bottom, left, right } slices of the original pages
 *   (left/right: the text column plus a margin, leaving the page border out), located with
 *   the parts that do extract correctly (the "શ્લોક <digits>" headings, the
 *   "- <digits>" of the unit headings and the "⚫" bullets).
 *
 * Text rules (scripture that students memorise):
 *   - Words are copied exactly as extracted; nothing is re-spelt or normalised.
 *   - A line that was wrapped by the page width is joined to the next with a
 *     space. A line that ends early (a verse line or a paragraph end: the first
 *     word of the next line would have fitted) is kept as a hard break, "\n".
 *     Renderers should use `white-space: pre-line`.
 *   - A line ending in a hyphen attached to a word ("all-", "Swāmī-") is joined
 *     without a space, because Word only breaks a line there at a real hyphen.
 *   - The outer parentheses come off `cite` and `translation`; a closing one is
 *     removed only when it is the unmatched outer one.
 *
 * Usage: import { parse } from './parse-mukhpath.mjs';
 *        await parse({ file, lang: 'en' | 'gu', paper: 'mukhpath', source })
 * Needs poppler's `pdftotext` (env PDFTOTEXT, else /usr/local/bin, else PATH).
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const PDFTOTEXT =
    process.env.PDFTOTEXT ||
    (existsSync('/usr/local/bin/pdftotext') ? '/usr/local/bin/pdftotext' : 'pdftotext');

const TITLES = {
    en: 'Selected Mukhpath (English)',
    gu: 'પસંદ કરેલ મુખપાઠ (ગુજરાતી)',
};

/** Padding around Gujarati crops, in PDF points: above/below, and either side. */
const CROP_PAD = 6;
const CROP_PAD_X = 8;
/**
 * Pages whose text extent stays within this many points of the booklet-wide
 * extent all share it, so every slice has the same width and lines up.
 */
const SHARED_EXTENT_TOLERANCE = 24;

export async function parse(opts) {
    return (await parseDetailed(opts)).booklet;
}

/** Same as parse(), plus diagnostics for QA (skipped lines, joins, bullet counts). */
export async function parseDetailed({ file, lang, paper, source }) {
    if (!file) throw new Error('parse-mukhpath: `file` is required');
    const pages = readBbox(file);
    let result;
    if (lang === 'en') result = parseEnglish(pages);
    else if (lang === 'gu') result = parseGujarati(pages);
    else throw new Error(`parse-mukhpath: unsupported lang ${JSON.stringify(lang)}`);
    const booklet = {
        version: 1,
        paper: paper || 'mukhpath',
        lang,
        title: TITLES[lang],
        source: source ?? '',
        generatedAt: new Date().toISOString(),
        groups: result.groups,
    };
    return { booklet, diagnostics: result.diagnostics };
}

/* ------------------------------------------------------------------ */
/* pdftotext -bbox-layout reader                                       */
/* ------------------------------------------------------------------ */

function decodeEntities(s) {
    return s
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

const NUM = '(-?[\\d.]+)';
const BOX = `xMin="${NUM}" yMin="${NUM}" xMax="${NUM}" yMax="${NUM}"`;

/**
 * Returns [{ n, width, height, rows }], rows sorted top to bottom. A row is one
 * visual line: pdftotext lines that share a baseline band are merged (e.g. a
 * bullet glyph that sits in its own block).
 */
function readBbox(file) {
    const xml = execFileSync(PDFTOTEXT, ['-bbox-layout', file, '-'], {
        encoding: 'utf8',
        maxBuffer: 512 * 1024 * 1024,
    });
    const pages = [];
    const pageRe = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g;
    const lineRe = new RegExp(`<line ${BOX}>([\\s\\S]*?)</line>`, 'g');
    const wordRe = new RegExp(`<word ${BOX}>([\\s\\S]*?)</word>`, 'g');
    for (const pm of xml.matchAll(pageRe)) {
        const n = pages.length + 1;
        const lines = [];
        for (const lm of pm[3].matchAll(lineRe)) {
            const words = [...lm[5].matchAll(wordRe)]
                .map((w) => ({ x0: +w[1], y0: +w[2], x1: +w[3], y1: +w[4], t: decodeEntities(w[5]) }))
                .filter((w) => w.t.trim() !== '');
            if (words.length) lines.push({ x0: +lm[1], y0: +lm[2], x1: +lm[3], y1: +lm[4], words });
        }
        pages.push({ n, width: +pm[1], height: +pm[2], rows: toRows(lines, n) });
    }
    if (!pages.length) throw new Error(`parse-mukhpath: pdftotext found no pages in ${file}`);
    return pages;
}

function toRows(lines, page) {
    lines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const rows = [];
    for (const l of lines) {
        const r = rows.find((r) => {
            const overlap = Math.min(r.y1, l.y1) - Math.max(r.y0, l.y0);
            return overlap > 0.5 * Math.min(r.y1 - r.y0, l.y1 - l.y0);
        });
        if (r) {
            r.words.push(...l.words);
            r.x0 = Math.min(r.x0, l.x0);
            r.x1 = Math.max(r.x1, l.x1);
            r.y0 = Math.min(r.y0, l.y0);
            r.y1 = Math.max(r.y1, l.y1);
        } else {
            rows.push({ page, x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, words: [...l.words] });
        }
    }
    for (const r of rows) {
        r.words.sort((a, b) => a.x0 - b.x0);
        r.text = r.words.map((w) => w.t).join(' ');
        r.compact = r.text.replace(/\s+/g, '');
    }
    rows.sort((a, b) => a.y0 - b.y0);
    return rows;
}

/** Page numbers / running footers or headers: a bare number in the top or bottom margin band. */
function isPageFurniture(row, page) {
    const inMargin = row.y1 > page.height * 0.9 || row.y0 < page.height * 0.06;
    return inMargin && /^[\d૦-૯\-–—.\s]+$/.test(row.text) && row.compact.length <= 4;
}

/* ------------------------------------------------------------------ */
/* English                                                             */
/* ------------------------------------------------------------------ */

function parseEnglish(pages) {
    const diagnostics = { skipped: [], hyphenJoins: [], hardBreaks: 0, warnings: [] };
    const rows = [];
    for (const p of pages) {
        for (const r of p.rows) {
            if (isPageFurniture(r, p)) diagnostics.skipped.push({ page: p.n, why: 'page furniture', text: r.text });
            else rows.push(r);
        }
    }

    // Classify.
    for (const r of rows) {
        let m;
        if ((m = r.text.match(/^Unit\s*[-–]\s*(\d+)$/i))) r.kind = 'unit', (r.num = m[1]);
        else if ((m = r.text.match(/^Shlok\s+(\d+(?:\s*[-–]\s*\d+)*)$/i))) r.kind = 'shlok', (r.num = m[1].replace(/\s+/g, '').replace(/–/g, '-'));
        else if (r.words[0].t === '●' || r.words[0].t.startsWith('●')) r.kind = 'bullet';
        else r.kind = 'body';
    }
    // Right margin of the text column: cites are right-aligned to it.
    const right = Math.max(...rows.filter((r) => r.kind === 'body').map((r) => r.x1));
    for (const r of rows) {
        if (r.kind === 'body' && r.text.startsWith('(') && r.text.endsWith(')') && r.x0 >= 200 && r.x1 >= right - 15) {
            r.kind = 'cite';
        }
    }
    const spaceW = medianSpace(rows);

    const first = rows.findIndex((r) => r.kind === 'unit');
    if (first < 0) throw new Error('parse-mukhpath: no "Unit-N" heading found');
    for (const r of rows.slice(0, first)) diagnostics.skipped.push({ page: r.page, why: 'front matter', text: r.text });

    const groups = [];
    let group = null;
    let section = null;
    let part = null; // { text: rows[], cite: row, trans: rows[] }
    let phase = null; // 'text' | 'trans'

    const flush = () => {
        if (!part) return;
        if (!section) throw new Error(`parse-mukhpath: reference before any "Shlok" heading (page ${part.text[0]?.page})`);
        const block = { t: 'ref', text: joinRows(part.text, right, spaceW, diagnostics) };
        if (part.cite) block.cite = stripOuter(part.cite.text);
        else diagnostics.warnings.push(`${section.id}: reference without a cite: "${block.text.slice(0, 60)}"`);
        if (part.trans.length) block.translation = translationOf(part.trans, right, spaceW, diagnostics, section.id);
        else diagnostics.warnings.push(`${section.id}: reference without a translation (cite ${block.cite})`);
        section.blocks.push(block);
        part = null;
        phase = null;
    };

    for (let i = first; i < rows.length; i++) {
        const r = rows[i];
        if (r.kind === 'unit') {
            flush();
            group = { id: `unit-${r.num}`, title: `Unit ${r.num}`, sections: [] };
            groups.push(group);
            section = null;
        } else if (r.kind === 'shlok') {
            flush();
            if (!group) throw new Error(`parse-mukhpath: "Shlok ${r.num}" before any unit`);
            section = { id: `shlok-${r.num}`, title: `Shlok ${r.num}`, blocks: [] };
            group.sections.push(section);
        } else if (r.kind === 'bullet') {
            flush();
            const rest = { ...r, words: r.words[0].t === '●' ? r.words.slice(1) : [{ ...r.words[0], t: r.words[0].t.slice(1) }, ...r.words.slice(1)] };
            rest.x0 = rest.words[0]?.x0 ?? r.x0;
            rest.text = rest.words.map((w) => w.t).join(' ');
            part = { text: rest.words.length ? [rest] : [], cite: null, trans: [] };
            phase = 'text';
        } else if (!part) {
            diagnostics.warnings.push(`page ${r.page}: text outside any reference, kept out: "${r.text}"`);
            diagnostics.skipped.push({ page: r.page, why: 'outside reference', text: r.text });
        } else if (r.kind === 'cite') {
            if (phase === 'text') {
                part.cite = r;
                phase = 'trans';
            } else {
                diagnostics.warnings.push(`page ${r.page}: second cite with no text before it: ${r.text}`);
                part.trans.push(r);
            }
        } else if (phase === 'text') {
            part.text.push(r);
        } else {
            // Translation, unless a new text + cite pair starts inside the same bullet
            // (a closed translation, then an unparenthesised line, then a cite).
            const prev = part.trans[part.trans.length - 1];
            if (prev && depth(part.trans.map((t) => t.text).join(' ')) <= 0 && prev.text.endsWith(')') && !r.text.startsWith('(') && citeAhead(rows, i)) {
                diagnostics.warnings.push(`${section.id}: one bullet holds two references (second starts "${r.text.slice(0, 40)}"); split into two ref blocks`);
                flush();
                part = { text: [r], cite: null, trans: [] };
                phase = 'text';
            } else {
                part.trans.push(r);
            }
        }
    }
    flush();
    return { groups, diagnostics };
}

/** Is there a cite row before the next bullet or heading? */
function citeAhead(rows, i) {
    for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].kind === 'cite') return true;
        if (rows[j].kind !== 'body') return false;
    }
    return false;
}

function medianSpace(rows) {
    const gaps = [];
    for (const r of rows) {
        for (let k = 1; k < r.words.length; k++) {
            const g = r.words[k].x0 - r.words[k - 1].x1;
            if (g > 0 && g < 10) gaps.push(g);
        }
    }
    gaps.sort((a, b) => a - b);
    return gaps.length ? gaps[gaps.length >> 1] : 3;
}

/**
 * Would the first word of `next` have fitted at the end of `prev`? Then the line
 * break is a real one (verse line, paragraph end); otherwise it is a wrap. Word
 * can also wrap after a hyphen, so for "Param-krupālu" only "Param-" must fit
 * (its width estimated pro rata by characters).
 */
function isHardBreak(prev, next, right, spaceW) {
    const w = next.words[0];
    let width = w.x1 - w.x0;
    const chars = [...w.t];
    const hy = chars.indexOf('-');
    if (hy > 0 && hy < chars.length - 1) width *= (hy + 1) / chars.length;
    if (right - prev.x1 < width + spaceW + 1) return false;
    // A line ending mid-sentence (no punctuation) whose next line carries on in
    // lower case is a stray manual break inside a sentence, not a verse line.
    if (/\p{Ll}$/u.test(prev.text) && /^\p{Ll}/u.test(next.text)) return false;
    return true;
}

/**
 * Splits rows into paragraphs at hard breaks; joins wrapped lines with a space.
 * With `parens` (translations), a line that opens "(" also starts a paragraph
 * when the text so far is closed, or when it is open by one and the line before
 * ended a sentence (a ")" missing in the source); "(2) …" numbering excepted.
 */
function paragraphs(rows, right, spaceW, diag, parens = false) {
    const paras = [];
    let cur = '';
    let d = 0;
    rows.forEach((r, k) => {
        const t = r.text.trim();
        if (k === 0) {
            cur = t;
            d = depth(t);
            return;
        }
        const prev = rows[k - 1];
        let hard = isHardBreak(prev, r, right, spaceW);
        if (!hard && parens && t.startsWith('(')) {
            if (d <= 0) hard = true;
            else if (d === 1 && /[.?!”’'"]$/.test(cur) && !/^\(\d+\)/.test(t)) hard = true;
        }
        d += depth(t);
        if (hard) {
            paras.push(cur);
            diag.hardBreaks++;
            cur = t;
        } else if (/\p{L}-$/u.test(cur)) {
            diag.hyphenJoins.push(`${cur.split(' ').pop()}${t.split(' ')[0]}`);
            cur += t;
        } else {
            cur += ' ' + t;
        }
    });
    if (cur) paras.push(cur);
    return paras;
}

function joinRows(rows, right, spaceW, diag) {
    return paragraphs(rows, right, spaceW, diag).join('\n');
}

const count = (s, ch) => s.split(ch).length - 1;
const depth = (s) => count(s, '(') - count(s, ')');

/** Removes the outer "(" and, if it is the unmatched one, the outer ")". */
function stripOuter(s) {
    let t = s.trim();
    if (t.startsWith('(')) t = t.slice(1);
    if (t.endsWith(')') && count(t, ')') > count(t, '(')) t = t.slice(0, -1);
    return t.trim();
}

/**
 * A translation can hold several parenthesised paragraphs (a Gujarati gloss, the
 * English translation, an English gloss). Each gets its own outer parentheses
 * removed; they are joined with "\n". A paragraph that opens with "(" while the
 * previous one is still unclosed starts a new unit when the previous paragraph
 * ended a sentence (a missing ")" in the source), except numbered lines "(2) …".
 */
function translationOf(rows, right, spaceW, diag, where) {
    const paras = paragraphs(rows, right, spaceW, diag, true);
    const units = [];
    let d = 0;
    for (const p of paras) {
        const prev = units.length ? units[units.length - 1] : null;
        const opens = p.startsWith('(');
        let fresh = !prev || (opens && d <= 0);
        if (!fresh && opens && d === 1 && /[.?!”’'"]$/.test(prev[prev.length - 1]) && !/^\(\d+\)/.test(p)) {
            diag.warnings.push(`${where}: unclosed "(" before "${p.slice(0, 40)}"; treated as a new paragraph`);
            fresh = true;
        }
        if (fresh) {
            units.push([p]);
            d = depth(p);
        } else {
            prev.push(p);
            d += depth(p);
        }
    }
    return units.map((u) => stripOuter(u.join('\n'))).join('\n');
}

/* ------------------------------------------------------------------ */
/* Gujarati                                                            */
/* ------------------------------------------------------------------ */

const GU_DIGITS = '૦૧૨૩૪૫૬૭૮૯';
const toWestern = (s) => s.replace(/[૦-૯]/g, (c) => String(GU_DIGITS.indexOf(c)));

function parseGujarati(pages) {
    const diagnostics = { skipped: [], bullets: {}, warnings: [] };
    const items = []; // all content rows in reading order, with their page
    for (const p of pages) {
        for (const r of p.rows) {
            if (isPageFurniture(r, p)) {
                diagnostics.skipped.push({ page: p.n, why: 'page furniture', text: r.text });
                continue;
            }
            const centred = Math.abs((r.x0 + r.x1) / 2 - p.width / 2) < 60;
            let m;
            if ((m = r.compact.match(/^શ્લોક([૦-૯]+(?:[-–][૦-૯]+)*)$/))) {
                r.kind = 'shlok';
                r.guNum = m[1].replace(/–/g, '-');
            } else if (centred && r.compact.length <= 12 && !/^[⚫(]/.test(r.compact) && (m = r.compact.match(/[-–]([૦-૯]+)$/))) {
                r.kind = 'unit';
                r.guNum = m[1];
            } else if (r.compact.startsWith('⚫')) r.kind = 'bullet';
            else r.kind = 'body';
            r.pageObj = p;
            items.push(r);
        }
    }

    const first = items.findIndex((r) => r.kind === 'unit');
    if (first < 0) throw new Error('parse-mukhpath: no unit heading ("- <digits>") found in the Gujarati booklet');
    for (const r of items.slice(0, first)) diagnostics.skipped.push({ page: r.page, why: 'front matter', text: '[Gujarati text not reproduced]' });

    const groups = [];
    let group = null;
    for (let i = first; i < items.length; i++) {
        const r = items[i];
        if (r.kind === 'unit') {
            const n = toWestern(r.guNum);
            group = { id: `unit-${n}`, title: `યુનિટ ${r.guNum}`, sections: [] };
            groups.push(group);
            continue;
        }
        if (r.kind !== 'shlok') continue;
        if (!group) throw new Error('parse-mukhpath: Gujarati shlok before any unit');
        let end = i + 1;
        while (end < items.length && items[end].kind !== 'shlok' && items[end].kind !== 'unit') end++;
        const rows = items.slice(i, end);
        const id = `shlok-${toWestern(r.guNum)}`;
        diagnostics.bullets[id] = rows.filter((x) => x.kind === 'bullet').length;
        group.sections.push({ id, title: `શ્લોક ${r.guNum}`, blocks: cropsFor(rows) });
    }
    addHorizontalBounds(groups, pages, diagnostics);
    return { groups, diagnostics };
}

/**
 * Gives every crop `left` and `right`: the horizontal extent of all the text on
 * its page (every word, not only those inside the crop) plus CROP_PAD_X, which
 * leaves the decorative page border (vector art) outside. When each page's
 * extent is within SHARED_EXTENT_TOLERANCE of the booklet-wide one, the
 * booklet-wide extent is used for all pages.
 */
function addHorizontalBounds(groups, pages, diagnostics) {
    const used = new Set(groups.flatMap((g) => g.sections.flatMap((s) => s.blocks.map((b) => b.page))));
    const perPage = new Map();
    for (const p of pages) {
        if (!used.has(p.n)) continue;
        const words = p.rows.flatMap((r) => r.words);
        perPage.set(p.n, { left: Math.min(...words.map((w) => w.x0)), right: Math.max(...words.map((w) => w.x1)) });
    }
    const all = [...perPage.values()];
    const wide = { left: Math.min(...all.map((e) => e.left)), right: Math.max(...all.map((e) => e.right)) };
    const shared = all.every(
        (e) => e.left - wide.left <= SHARED_EXTENT_TOLERANCE && wide.right - e.right <= SHARED_EXTENT_TOLERANCE,
    );
    diagnostics.textExtent = {
        mode: shared ? 'booklet' : 'page',
        booklet: { left: round1(wide.left), right: round1(wide.right) },
        pages: Object.fromEntries([...perPage].map(([n, e]) => [n, { left: round1(e.left), right: round1(e.right) }])),
    };
    for (const g of groups) {
        for (const s of g.sections) {
            for (const b of s.blocks) {
                const e = shared ? wide : perPage.get(b.page);
                const width = pages[b.page - 1].width;
                b.left = round1(Math.max(0, e.left - CROP_PAD_X));
                b.right = round1(Math.min(width, e.right + CROP_PAD_X));
            }
        }
    }
}

/**
 * One crop per page that the section's rows touch. The padding never reaches
 * into a neighbouring row that belongs to something else (the previous shlok, a
 * unit heading, the next shlok): it stops halfway across the gap instead.
 */
function cropsFor(rows) {
    const byPage = new Map();
    for (const r of rows) {
        if (!byPage.has(r.page)) byPage.set(r.page, []);
        byPage.get(r.page).push(r);
    }
    const crops = [];
    for (const [page, rs] of byPage) {
        const p = rs[0].pageObj;
        const all = p.rows;
        const firstRow = rs[0];
        const lastRow = rs[rs.length - 1];
        const above = all.filter((x) => x.y1 <= firstRow.y0 + 0.5 && !rs.includes(x)).pop();
        const below = all.find((x) => x.y0 >= lastRow.y1 - 0.5 && !rs.includes(x) && !isPageFurniture(x, p));
        let top = firstRow.y0 - CROP_PAD;
        if (above) top = Math.max(top, (above.y1 + firstRow.y0) / 2);
        let bottom = lastRow.y1 + CROP_PAD;
        if (below) bottom = Math.min(bottom, (lastRow.y1 + below.y0) / 2);
        top = Math.max(0, top);
        bottom = Math.min(p.height, bottom);
        crops.push({ t: 'crop', page, top: round1(top), bottom: round1(bottom) });
    }
    return crops;
}

const round1 = (v) => Math.round(v * 10) / 10;
