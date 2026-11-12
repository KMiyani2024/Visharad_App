/**
 * Sectioned Final Exam booklets.
 *
 * scripts/booklets/build.mjs turns each booklet (PDF or Word) into one JSON file,
 * `<paper>-<lang>.json`, split into groups (e.g. Unit 1) and sections (e.g. Shlok 3).
 * The JSON sits next to the booklets in the private `documents` container under
 * `sections/`, so booklet text never enters the (public) repository.
 */

export type BookletBlock =
    /** A sub-heading inside a section. */
    | { t: 'h'; text: string }
    /** A paragraph of plain text. */
    | { t: 'p'; text: string }
    /** A bulleted or numbered list. */
    | { t: 'list'; items: string[]; ordered?: boolean }
    /** A quoted passage, with its scripture source when given. */
    | { t: 'quote'; text: string; cite?: string }
    /** A Mukhpath reference to memorise: the text, its source and an optional translation. */
    | { t: 'ref'; text: string; cite?: string; translation?: string }
    /** Sanitised HTML from a Word booklet (paragraphs, bold, italics, lists, tables, images). */
    | { t: 'html'; html: string }
    /**
     * A slice of a PDF page, shown as the original page image. Used where a PDF's
     * text cannot be extracted faithfully (the Gujarati Mukhpath). `page` is
     * 1-based; `top` and `bottom` are PDF points from the top of the page, and
     * the optional `left` and `right` are PDF points from its left edge.
     */
    | { t: 'crop'; page: number; top: number; bottom: number; left?: number; right?: number };

export type BookletSection = {
    /** URL slug, unique within the booklet, e.g. "shlok-3", "topic-12", "question-7". */
    id: string;
    /** Display title, e.g. "Shlok 3", "Topic 12: Parabrahman is the All-Doer". */
    title: string;
    /** Optional short line under the title (e.g. "Verse 17" for an FAQ question). */
    subtitle?: string;
    blocks: BookletBlock[];
};

export type BookletGroup = {
    /** e.g. "unit-1"; a booklet without natural groups has one group with id "all". */
    id: string;
    /** e.g. "Unit 1"; empty string for the single "all" group. */
    title: string;
    sections: BookletSection[];
};

export type Booklet = {
    version: 1;
    paper: string;
    lang: 'en' | 'gu';
    title: string;
    /** Blob name of the booklet this was built from. */
    source: string;
    generatedAt: string;
    groups: BookletGroup[];
};

/** All sections in reading order, with their group. */
export function flatSections(b: Booklet) {
    return b.groups.flatMap((g) => g.sections.map((s) => ({ group: g, section: s })));
}
