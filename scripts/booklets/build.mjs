#!/usr/bin/env node
// Builds the sectioned Final Exam booklets (see src/lib/booklet.ts).
//
//   node scripts/booklets/build.mjs <folder with the booklet files> <output folder>
//
// Needs poppler's `pdftotext` on PATH (brew install poppler). Download the
// booklets first, then upload the JSON next to them in the private container:
//
//   az storage blob download-batch -s documents -d ./booklets --account-name examfinal --auth-mode login
//   node scripts/booklets/build.mjs ./booklets ./booklet-sections
//   az storage blob upload-batch -d documents --destination-path sections -s ./booklet-sections \
//     --pattern '*.json' --content-type application/json --overwrite --account-name examfinal --auth-mode login
//
// The app re-reads sections/<paper>-<lang>.json within 10 minutes; no redeploy needed.
// Keep BOOKLETS in step with the `files` lists in src/lib/finalExam.ts.

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const BOOKLETS = [
    { paper: 'mukhpath', lang: 'en', blob: 'Satsang Diksha Visharad Selected Mukhpath_English.pdf' },
    { paper: 'mukhpath', lang: 'gu', blob: 'Satsang Diksha Visharad Selected Mukhpath_Gujarati.pdf' },
    { paper: 'shlok-explanations', lang: 'gu', blob: 'Shloka Samjuti Gujarati.docx' },
    { paper: 'subject-explanations', lang: 'en', blob: 'Copy of Vishay Prastuti 1-17.pdf' },
    { paper: 'subject-explanations', lang: 'gu', blob: 'Copy of વિષયપ્રસ્તુતિ ૧-૧૭.pdf' },
    { paper: 'faq', lang: 'en', blob: 'FAQ_ENGLISH.pdf' },
];

const BLOCK_TYPES = new Set(['h', 'p', 'list', 'quote', 'ref', 'html', 'crop']);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Returns a list of problems; empty means the booklet is usable. */
function validate(b, expect) {
    const errs = [];
    if (b?.version !== 1) errs.push('version must be 1');
    if (b?.paper !== expect.paper || b?.lang !== expect.lang) errs.push(`paper/lang mismatch: ${b?.paper}/${b?.lang}`);
    if (!Array.isArray(b?.groups) || !b.groups.length) return [...errs, 'no groups'];
    const ids = new Set();
    for (const g of b.groups) {
        if (!ID.test(g.id ?? '')) errs.push(`bad group id "${g.id}"`);
        if (!Array.isArray(g.sections) || !g.sections.length) errs.push(`group ${g.id} has no sections`);
        for (const s of g.sections ?? []) {
            if (!ID.test(s.id ?? '') || s.id === 'original') errs.push(`bad section id "${s.id}"`);
            if (ids.has(s.id)) errs.push(`duplicate section id "${s.id}"`);
            ids.add(s.id);
            if (!s.title?.trim()) errs.push(`section ${s.id} has no title`);
            if (!s.blocks?.length) errs.push(`section ${s.id} is empty`);
            for (const blk of s.blocks ?? []) {
                if (!BLOCK_TYPES.has(blk.t)) errs.push(`section ${s.id}: unknown block "${blk.t}"`);
                if (blk.t === 'crop' && !(blk.page >= 1 && blk.bottom > blk.top && blk.top >= 0)) errs.push(`section ${s.id}: bad crop`);
                if (blk.t === 'html' && /<script|\son[a-z]+\s*=|javascript:/i.test(blk.html)) errs.push(`section ${s.id}: unsafe html`);
            }
        }
    }
    return errs;
}

async function main() {
    const [inDir, outDir] = process.argv.slice(2);
    if (!inDir || !outDir) {
        console.error('usage: node scripts/booklets/build.mjs <booklets folder> <output folder>');
        process.exit(2);
    }
    await mkdir(outDir, { recursive: true });
    let failed = 0;

    for (const bk of BOOKLETS) {
        const name = `${bk.paper}-${bk.lang}`;
        const file = path.resolve(inDir, bk.blob);
        const parserPath = path.join(HERE, `parse-${bk.paper}.mjs`);
        try {
            await access(file);
        } catch {
            console.warn(`- ${name}: skipped (no ${bk.blob} in ${inDir})`);
            continue;
        }
        try {
            const { parse } = await import(pathToFileURL(parserPath).href);
            const booklet = await parse({ file, lang: bk.lang, paper: bk.paper, source: bk.blob });
            const errs = validate(booklet, bk);
            if (errs.length) {
                failed++;
                console.error(`✗ ${name}:\n    ${errs.slice(0, 20).join('\n    ')}`);
                continue;
            }
            await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(booklet));
            const sections = booklet.groups.reduce((n, g) => n + g.sections.length, 0);
            console.log(`✓ ${name}: ${booklet.groups.length} group(s), ${sections} sections`);
        } catch (e) {
            failed++;
            console.error(`✗ ${name}: ${e?.stack ?? e}`);
        }
    }
    process.exit(failed ? 1 : 0);
}

main();
