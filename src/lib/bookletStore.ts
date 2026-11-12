import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Booklet } from './booklet';
import { signedBlobUrl } from './finalExamFiles';

/**
 * Loads a sectioned booklet: `sections/<paper>-<lang>.json` in the private
 * booklet container (built by scripts/booklets/build.mjs). For local work, set
 * FINAL_EXAM_SECTIONS_DIR to a folder of those JSON files instead.
 * Results are kept in memory for 10 minutes (1 minute when missing), so a
 * re-uploaded booklet shows up without a redeploy.
 */
const cache = new Map<string, { until: number; value: Promise<Booklet | null> }>();

function isBooklet(v: unknown): v is Booklet {
    const b = v as Booklet;
    return !!b && b.version === 1 && Array.isArray(b.groups) && b.groups.every((g) => Array.isArray(g.sections));
}

async function load(paper: string, lang: string): Promise<Booklet | null> {
    const name = `${paper}-${lang}.json`;
    const dir = process.env.FINAL_EXAM_SECTIONS_DIR;
    try {
        let data: unknown;
        if (dir) {
            data = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
        } else {
            const url = signedBlobUrl(`sections/${name}`);
            if (!url) return null;
            const res = await fetch(url, { cache: 'no-store' });
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            data = await res.json();
        }
        if (!isBooklet(data)) throw new Error('not a version 1 booklet');
        return data;
    } catch (e) {
        if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') console.error(`Booklet sections ${name} failed to load`, e);
        return null;
    }
}

export function getBooklet(paper: string, lang: string): Promise<Booklet | null> {
    const key = `${paper}-${lang}`;
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    const value = load(paper, lang);
    cache.set(key, { until: Date.now() + 60_000, value });
    void value.then((b) => {
        if (b) cache.set(key, { until: Date.now() + 10 * 60_000, value });
    });
    return value;
}
