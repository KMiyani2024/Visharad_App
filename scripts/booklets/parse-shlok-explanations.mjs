/**
 * Parser for the Final Exam "Shloka Samjuti" booklet (Gujarati Word .docx):
 * one section per shlok, grouped by unit. Returns a `Booklet` (src/lib/booklet.ts).
 *
 * Source layout (as of the 2026 booklet):
 *   - Front matter (dropped): "॥ શ્રી સ્વામિનારાયણો વિજયતે ॥", a header image,
 *     the booklet title, ": પ્રેરક :" and "પરમ પૂજ્ય મહંત સ્વામી મહારાજ".
 *   - Unit heading: a plain paragraph "યુનિટ-૧" … "યુનિટ-૪"  → a group.
 *   - Shlok heading: a paragraph that is entirely bold, "શ્લોક ૧" (once "શ્લોક-૧૮૦",
 *     sometimes with a trailing space)  → a section.
 *   - Inside a shlok: the Sanskrit verse (bold), its Gujarati meaning, theme lines
 *     (set in the "Amrut" display font, 18 pt, not bold) and bold labels such as
 *     "આ વિષયક મુખપાઠ માટેના સંદર્ભો:" followed by quotations and citations.
 *     Theme lines become `{ t: 'h' }` blocks; everything else stays as sanitised HTML.
 *
 * Text is never altered: paragraphs are copied from mammoth's output, with only
 * tags and attributes filtered.
 *
 * Usage: `await parse({ file, lang: 'gu', paper: 'shlok-explanations', source })`.
 * `parseWithReport` returns `{ booklet, report }` for QA (dropped front matter,
 * sanitiser counts, verse-number checks, warnings).
 */
import path from 'node:path';
import mammoth from 'mammoth';

const BOOKLET_TITLE = 'શ્લોક સમજૂતી (ગુજરાતી)';
const THEME_STYLE = 'Shlok Samjuti Theme';
const THEME_CLASS = 'shlok-theme';
const THEME_FONT = 'Amrut';
const THEME_SIZE = 18; // points

const GU_DIGIT = /[૦-૯]/g; // ૦-૯
const DEV_DIGIT = /[०-९]/g; // ०-९
const toWestern = (s) =>
    s
        .replace(GU_DIGIT, (d) => String(d.charCodeAt(0) - 0x0ae6))
        .replace(DEV_DIGIT, (d) => String(d.charCodeAt(0) - 0x0966));
const toGujarati = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x0ae6 + Number(d)));

/** "શ્લોક ૧", "શ્લોક-૧૮૦", "શ્લોક ૧૯ " (tested on the trimmed text of an all-bold paragraph). */
const SHLOK_RE = /^શ્લોક[\s \-‐-–]*([૦-૯0-9]+)$/u;
/** "યુનિટ-૧". */
const UNIT_RE = /^યુનિટ[\s \-‐-–]*([૦-૯0-9]+)$/u;
/** The verse number that closes a Sanskrit shlok, e.g. "॥ १॥", "॥१०॥". */
const VERSE_NO_RE = /॥\s*([०-९0-9]+)\s*॥\s*$/u;
const DEVANAGARI_RE = /[ऀ-ॿ]/u;

// ——— Sanitiser ———

const ALLOWED = new Set([
    'p', 'strong', 'em', 'b', 'i', 'u', 'br', 'ul', 'ol', 'li', 'table', 'thead', 'tbody',
    'tr', 'td', 'th', 'sup', 'sub', 'h3', 'h4', 'img',
]);
const RENAME = { h1: 'h3', h2: 'h3', h5: 'h4', h6: 'h4' };
const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'head', 'title',
]);
const VOID = new Set(['br', 'img', 'hr', 'wbr', 'col', 'input', 'meta', 'link', 'area', 'base', 'source', 'track', 'param']);
const BOLD = new Set(['strong', 'b']);
const BLOCKS = new Set(['p', 'h3', 'h4', 'ul', 'ol', 'table']);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
    s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
        if (e[0] === '#') {
            const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
        }
        return ENTITIES[e.toLowerCase()] ?? m;
    });
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

const TOKEN_RE = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function tokenize(html) {
    const out = [];
    for (const m of html.matchAll(TOKEN_RE)) {
        const raw = m[0];
        if (raw.startsWith('<!--')) continue;
        if (m[1]) {
            const name = m[1].toLowerCase();
            if (raw[1] === '/') {
                out.push({ type: 'close', name });
            } else {
                const attrs = {};
                for (const a of (m[2] || '').matchAll(ATTR_RE)) {
                    attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
                }
                out.push({ type: VOID.has(name) || /\/\s*$/.test(m[2] || '') ? 'void' : 'open', name, attrs });
            }
        } else {
            out.push({ type: 'text', text: decode(raw) });
        }
    }
    return out;
}

/** Filters one token to the allowed set; returns HTML or '' and records what was dropped. */
function renderToken(tok, stats) {
    const name = RENAME[tok.name] || tok.name;
    if (tok.type === 'close') return ALLOWED.has(name) && name !== 'br' && name !== 'img' ? `</${name}>` : '';
    if (!ALLOWED.has(name)) {
        stats.droppedTags[tok.name] = (stats.droppedTags[tok.name] || 0) + 1;
        return '';
    }
    const keep = [];
    for (const [k, v] of Object.entries(tok.attrs)) {
        let ok = false;
        if (name === 'img' && k === 'src') ok = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(v);
        else if (name === 'img' && k === 'alt') ok = true;
        else if ((name === 'td' || name === 'th') && (k === 'colspan' || k === 'rowspan')) ok = /^\d{1,3}$/.test(v);
        if (ok) keep.push(`${k}="${escapeAttr(v)}"`);
        else if (!(name === 'img' && k === 'src')) stats.droppedAttrs[`${name}@${k}`] = (stats.droppedAttrs[`${name}@${k}`] || 0) + 1;
    }
    if (name === 'img') {
        if (!keep.some((a) => a.startsWith('src='))) {
            stats.droppedImgs += 1;
            return '';
        }
        return `<img ${keep.join(' ')} />`;
    }
    if (name === 'br') return '<br />';
    return `<${name}${keep.length ? ' ' + keep.join(' ') : ''}>`;
}

/**
 * Splits mammoth HTML into top-level nodes (paragraphs, headings, lists, tables),
 * each sanitised, with its plain text and a few facts used for splitting.
 */
export function toNodes(html, stats = { droppedTags: {}, droppedAttrs: {}, droppedImgs: 0 }) {
    const tokens = tokenize(html);
    const nodes = [];
    let cur = null;
    let depth = 0;
    let skip = null; // { name, depth } while inside a DROP_WITH_CONTENT element
    let boldDepth = 0;

    const begin = (tag, attrs) => {
        cur = {
            tag,
            classes: (attrs?.class || '').split(/\s+/).filter(Boolean),
            parts: [],
            text: '',
            boldText: '',
            hasImg: false,
            implicit: !attrs,
        };
    };
    const end = () => {
        if (!cur) return;
        if (cur.implicit) cur.parts.unshift('<p>'), cur.parts.push('</p>');
        nodes.push({
            tag: cur.tag,
            classes: cur.classes,
            html: cur.parts.join(''),
            text: cur.text,
            hasImg: cur.hasImg,
            boldOnly: cur.text.trim() !== '' && cur.text.replace(/\s/g, '') === cur.boldText.replace(/\s/g, ''),
        });
        cur = null;
        boldDepth = 0;
    };

    for (const tok of tokens) {
        if (skip) {
            if (tok.type === 'open' && tok.name === skip.name) skip.depth += 1;
            else if (tok.type === 'close' && tok.name === skip.name && --skip.depth === 0) skip = null;
            continue;
        }
        if ((tok.type === 'open' || tok.type === 'void') && DROP_WITH_CONTENT.has(tok.name)) {
            stats.droppedTags[tok.name] = (stats.droppedTags[tok.name] || 0) + 1;
            if (tok.type === 'open') skip = { name: tok.name, depth: 1 };
            continue;
        }
        const name = RENAME[tok.name] || tok.name;
        const nests = ALLOWED.has(name) && !VOID.has(name); // counts towards depth

        if (!cur || (cur.implicit && depth === 0)) {
            // At top level (or between inline elements of an implicit paragraph).
            if (tok.type === 'open' && BLOCKS.has(name)) {
                if (cur) end(); // close an implicit paragraph of stray inline content
                begin(name, tok.attrs);
                cur.parts.push(renderToken(tok, stats));
                depth = 1;
                continue;
            }
            if (tok.type === 'text' && !cur && tok.text.trim() === '') continue;
            if (tok.type === 'close') {
                stats.droppedTags[`/${tok.name}`] = (stats.droppedTags[`/${tok.name}`] || 0) + 1;
                continue;
            }
            if (!cur) begin('p', null); // inline content outside any block: wrap it in a paragraph
        }

        if (tok.type === 'text') {
            cur.parts.push(escapeText(tok.text));
            cur.text += tok.text;
            if (boldDepth > 0) cur.boldText += tok.text;
            continue;
        }
        const html = renderToken(tok, stats);
        if (tok.type === 'void') {
            if (html.startsWith('<img')) cur.hasImg = true;
            cur.parts.push(html);
            continue;
        }
        if (tok.type === 'open') {
            if (BOLD.has(name)) boldDepth += 1;
            if (nests) depth += 1;
            cur.parts.push(html);
            continue;
        }
        // close
        if (BOLD.has(name) && boldDepth > 0) boldDepth -= 1;
        cur.parts.push(html);
        if (nests) {
            depth -= 1;
            if (depth === 0 && !cur.implicit) end();
        }
    }
    if (cur) end();
    return nodes;
}

// ——— Theme lines (Amrut 18 pt, not bold, not centred) ———

function markThemeParagraphs(stats) {
    const { transforms } = mammoth;
    return transforms.paragraph((p) => {
        if (p.alignment === 'center') return p;
        let total = 0;
        let amrut = 0;
        let bold = false;
        let sizeOk = true;
        for (const run of transforms.getDescendantsOfType(p, 'run')) {
            const text = transforms.getDescendantsOfType(run, 'text').map((t) => t.value).join('');
            const n = text.replace(/\s/g, '').length;
            if (!n) continue;
            total += n;
            if (run.isBold) bold = true;
            if (run.font === THEME_FONT) {
                amrut += n;
                if (run.fontSize !== THEME_SIZE) sizeOk = false;
            }
        }
        if (total > 0 && !bold && sizeOk && amrut / total >= 0.8) {
            stats.themeParagraphs += 1;
            return { ...p, styleName: THEME_STYLE };
        }
        return p;
    });
}

// ——— Parser ———

export async function parseWithReport({ file, lang = 'gu', paper = 'shlok-explanations', source } = {}) {
    if (!file) throw new Error('parse-shlok-explanations: `file` (path to the .docx) is required');
    if (lang !== 'gu') throw new Error(`parse-shlok-explanations: this booklet is Gujarati only (got lang "${lang}")`);

    const stats = { themeParagraphs: 0, droppedTags: {}, droppedAttrs: {}, droppedImgs: 0 };
    const result = await mammoth.convertToHtml(
        { path: file },
        {
            styleMap: [`p[style-name='${THEME_STYLE}'] => h4.${THEME_CLASS}:fresh`],
            transformDocument: markThemeParagraphs(stats),
        },
    );

    const nodes = toNodes(result.value, stats);
    const report = {
        mammothMessages: result.messages,
        topLevelNodes: nodes.length,
        frontMatter: [],
        emptyParagraphsDropped: 0,
        orphans: [],
        headings: [],
        verseChecks: [],
        warnings: [],
        sanitiser: stats,
    };

    const groups = [];
    const seenIds = new Map();
    let group = null;
    let section = null;
    let started = false; // past the first shlok heading
    let pending = []; // content after a unit heading but before its first shlok
    let chunk = [];

    const flush = () => {
        if (section && chunk.length) section.blocks.push({ t: 'html', html: chunk.join('') });
        chunk = [];
    };
    const addContent = (node) => {
        if (node.tag === 'h4' && node.classes.includes(THEME_CLASS)) {
            flush();
            section.blocks.push({ t: 'h', text: node.text.trim() });
        } else {
            chunk.push(node.html);
        }
    };

    for (const node of nodes) {
        const text = node.text.trim();
        if (!text && !node.hasImg && /^(p|h3|h4)$/.test(node.tag)) {
            report.emptyParagraphsDropped += 1;
            continue;
        }

        const unit = node.tag === 'p' || node.tag === 'h4' ? UNIT_RE.exec(text) : null;
        if (unit) {
            flush();
            section = null;
            const n = Number(toWestern(unit[1]));
            group = { id: `unit-${n}`, title: text, sections: [] };
            if (groups.some((g) => g.id === group.id)) report.warnings.push(`duplicate unit heading "${text}"`);
            groups.push(group);
            continue;
        }

        const shlok = node.boldOnly ? SHLOK_RE.exec(text) : null;
        if (!shlok && SHLOK_RE.test(text)) report.warnings.push(`paragraph "${text}" looks like a shlok heading but is not bold; kept as content`);
        if (shlok) {
            flush();
            started = true;
            if (!group) {
                group = { id: 'all', title: '', sections: [] };
                groups.push(group);
            }
            const n = Number(toWestern(shlok[1]));
            let id = `shlok-${n}`;
            const times = (seenIds.get(id) || 0) + 1;
            seenIds.set(id, times);
            if (times > 1) {
                report.warnings.push(`duplicate shlok number ${n}; second copy gets id ${id}-${times}`);
                id = `${id}-${times}`;
            }
            section = { id, title: `શ્લોક ${toGujarati(n)}`, blocks: [], _nodes: [] };
            report.headings.push({ id, printed: node.text, title: section.title });
            group.sections.push(section);
            for (const p of pending) addContent(p), section._nodes.push(p);
            pending = [];
            continue;
        }

        if (!started) {
            report.frontMatter.push({
                tag: node.tag,
                text: node.text,
                image: node.hasImg ? (node.html.match(/src="(data:[^;,"]{0,40})/)?.[1] ?? 'img') : undefined,
            });
            continue;
        }
        if (!section) {
            report.orphans.push(node.text);
            report.warnings.push(`content between a unit heading and its first shlok moved into the next shlok: "${text.slice(0, 60)}"`);
            pending.push(node);
            continue;
        }
        section._nodes.push(node);
        addContent(node);
    }
    flush();
    if (pending.length) {
        const last = groups.at(-1)?.sections.at(-1);
        report.warnings.push(`${pending.length} trailing node(s) after the last unit heading appended to ${last?.id}`);
        if (last) {
            section = last;
            for (const p of pending) addContent(p);
            flush();
        }
    }

    // Subtitle: the shlok's first Sanskrit line; check the closing verse number.
    for (const g of groups) {
        for (const s of g.sections) {
            const lead = [];
            for (const n of s._nodes) {
                if (!n.boldOnly || !DEVANAGARI_RE.test(n.text)) break;
                lead.push(n.text.trim());
            }
            const first = lead.find((t) => !/^\(.*\)$/.test(t));
            if (first) s.subtitle = first;
            else report.warnings.push(`${s.id}: no Sanskrit verse found at the start`);
            const closing = lead.map((t) => VERSE_NO_RE.exec(t)).filter(Boolean).at(-1);
            const verse = closing ? Number(toWestern(closing[1])) : null;
            const heading = Number(s.id.replace(/^shlok-(\d+).*$/, '$1'));
            report.verseChecks.push({ id: s.id, verse, ok: verse === heading });
            if (verse !== heading) report.warnings.push(`${s.id}: verse number in the Sanskrit text is ${verse ?? 'missing'}`);
            delete s._nodes;
            // Key order as in BookletSection.
            const { id, title, subtitle, blocks } = s;
            for (const k of Object.keys(s)) delete s[k];
            Object.assign(s, subtitle ? { id, title, subtitle, blocks } : { id, title, blocks });
        }
    }

    const booklet = {
        version: 1,
        paper,
        lang,
        title: BOOKLET_TITLE,
        source: source || path.basename(file),
        generatedAt: new Date().toISOString(),
        groups,
    };
    return { booklet, report };
}

export async function parse(options) {
    return (await parseWithReport(options)).booklet;
}
