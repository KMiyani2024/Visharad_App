import 'server-only';
import { findPaper } from './finalExam';
import { flatSections, type Booklet, type BookletBlock, type BookletSection } from './booklet';
import { getBooklet } from './bookletStore';

/** Paper + booklet file for a /final-exam/read/<paper>/<lang> URL, or null. */
export function resolveBooklet(key: string, lang: string) {
    const paper = findPaper(key);
    const file = paper?.files.find((f) => f.lang === lang);
    return paper && file ? { paper, file } : null;
}

export const readerHref = (paper: string, lang: string, section?: string) =>
    `/final-exam/read/${paper}/${lang}${section ? `/${encodeURIComponent(section)}` : ''}`;

/** The booklet's name without its "(English)" / "(Gujarati)" tag. */
export const bookletTitle = (document: string) => document.replace(/\s*\((?:English|Gujarati)\)/, '');

const stripTags = (html: string) =>
    html
        .replace(/<img[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

function blockText(b: BookletBlock): string {
    switch (b.t) {
        case 'h':
        case 'p':
            return b.text;
        case 'list':
            return b.items.join(' ');
        case 'quote':
            return `${b.text} ${b.cite ?? ''}`;
        case 'ref':
            return `${b.text} ${b.cite ?? ''} ${b.translation ?? ''}`;
        case 'html':
            return stripTags(b.html);
        case 'crop':
            return '';
    }
}

/** Plain text of a section, for search. */
export const sectionText = (s: BookletSection) =>
    s.blocks.map(blockText).join(' ').replace(/\s+/g, ' ').trim();

/**
 * Short sections titled like "Shlok 12" read best as a grid of numbers;
 * anything with real titles reads best as a list.
 */
export function contentsLayout(b: Booklet): 'grid' | 'list' {
    const all = flatSections(b).map((x) => x.section);
    return all.every((s) => !s.subtitle && s.title.length <= 14) ? 'grid' : 'list';
}

/** Both language editions of a paper's sectioned booklet (null where missing). */
export async function bookletsFor(paperKey: string, langs: string[]) {
    const entries = await Promise.all(langs.map(async (l) => [l, await getBooklet(paperKey, l)] as const));
    return Object.fromEntries(entries) as Record<string, Booklet | null>;
}

/** Removes anything executable from Word-derived HTML (defence in depth; the builder already sanitises). */
export const safeHtml = (html: string) =>
    html
        .replace(/<(script|style|iframe|object|embed|link|meta)\b[\s\S]*?(?:<\/\1>|\/?>)/gi, '')
        .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*"\s*(?:javascript|vbscript):[^"]*"/gi, '$1="#"');
