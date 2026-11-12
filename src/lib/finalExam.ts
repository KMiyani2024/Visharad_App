// The Visharad Final Exam: four presentation-style papers, 100 marks (40 Mukhpath +
// 60 Presentation). There is no written exam. Content from the Pathshala's
// "Final Exam Revision Guide". The booklets live in Azure Blob storage
// (storage account `examfinal`, container `documents`); see finalExamFiles.ts.

export type PaperKey = 'mukhpath' | 'shlok-explanations' | 'subject-explanations' | 'faq';

/** One downloadable booklet: a blob in the final-exam container. */
export type ExamFile = {
    lang: 'en' | 'gu';
    /** Button label. */
    label: string;
    /** Blob name inside the container (exactly as stored). */
    blob: string;
    format: 'pdf' | 'docx';
};

export type ExamPaper = {
    key: PaperKey;
    number: 1 | 2 | 3 | 4;
    /** Short name used in the marks bar and legend. */
    name: string;
    examTitle: string;
    document: string;
    /** As given in the guide; every paper is "Presentation-style Exam". */
    type: string;
    section: 'Mukhpath' | 'Presentation';
    /** How much of the course the paper draws on, e.g. 80 of 300 references. */
    scope?: { selected: number; of?: number; unit: string };
    purpose: string;
    revise: string;
    assessed: string;
    /** The examiner picks any `count` items, each worth `each` marks. */
    marks: { count: number; unit: string; each: number };
    /** The booklet(s) for this paper, served via /final-exam/files/<paper>/<lang>. */
    files: ExamFile[];
};

export const FINAL_EXAM_TOTAL = 100;

export const SUBJECT_TOPICS: string[] = [
    'Literal Meaning of Satsang and Its Importance',
    'Eligibility for Entering Satsang',
    'The Indispensability of the Aksharbrahma Guru',
    'The Home Shrine (Ghar Mandir)',
    'The Purpose of Building Temples in the Swaminarayan Sampradaya and the Rules to Follow in a Temple',
    'Pure Upasana (Worship) of Parabrahman Bhagwan Swaminarayan',
    'Gunatitanand Swami: The Manifest Aksharbrahman',
    'Manifestation of Parabrahman through Aksharbrahman',
    'The Nature and Glory of Parabrahman',
    'Intense Love for the Aksharbrahman Guru',
    'Parabrahman is the All-Doer',
    'Samp, Suhrudbhav, Unity, and Divine Feelings',
    'Bhakti to Purushottam by Becoming Aksharrup',
    'Sang-Vivek (Prudence in Association)',
    'Ideological Sadhana',
    'Practice of Dharma',
    'Nishkam Dharma',
];

/** Mukhpath oral: how each vachan is marked. */
export const MUKHPATH_RULES: string[] = [
    'The examiner cues the opening 2–3 words; you complete the vachan word for word (future tense excluded).',
    'Up to 2 mistakes or prompts per vachan are forgiven before marks drop.',
    '5 or more mistakes cancels that vachan.',
];

/** FAQ booklet: worked examples of how each Q&A is tied to a shlok. */
export const FAQ_EXAMPLES: { q: number; shlok: number; topic: string }[] = [
    { q: 1, shlok: 17, topic: 'Equality within Satsang' },
    { q: 2, shlok: 21, topic: 'The significance of the Kanthi' },
];

export const EXAM_PAPERS: ExamPaper[] = [
    {
        key: 'mukhpath',
        number: 1,
        name: 'Mukhpath',
        examTitle: 'Final Exam – Mukhpath',
        document: 'Satsang Diksha Visharad – Selected Mukhpath',
        type: 'Presentation-style Exam',
        section: 'Mukhpath',
        scope: { selected: 80, of: 300, unit: 'references' },
        purpose: "Tests retention of the full year's memorised references (vachans) across all 4 units.",
        revise: 'Out of 300 references, 80 have been selected. Memorise all 80 in Gujarati: any of them can be asked in the exam.',
        assessed: 'Recitation of 20 vachans drawn from the booklet.',
        marks: { count: 20, unit: 'vachans', each: 2 },
        files: [
            { lang: 'en', label: 'English', blob: 'Satsang Diksha Visharad Selected Mukhpath_English.pdf', format: 'pdf' },
            { lang: 'gu', label: 'ગુજરાતી', blob: 'Satsang Diksha Visharad Selected Mukhpath_Gujarati.pdf', format: 'pdf' },
        ],
    },
    {
        key: 'shlok-explanations',
        number: 2,
        name: 'Shloka Samjuti',
        examTitle: 'Final Exam – Shloka Samjuti (Shlok Meanings)',
        document: 'Shloka Samjuti – Shlok Meanings',
        type: 'Presentation-style Exam',
        section: 'Presentation',
        scope: { selected: 51, of: 315, unit: 'shloks' },
        purpose: 'Tests understanding of each shlok by giving its meaning and doctrinal context, beyond rote recitation.',
        revise: '51 of the 315 shloks have been selected. For each one, revise its mukhpath reference and its “reinforce the principle” references.',
        assessed: "Any 4 shlok explanations, given in the student's own words and supported by the scriptural references.",
        marks: { count: 4, unit: 'shlok explanations', each: 5 },
        files: [
            { lang: 'gu', label: 'ગુજરાતી', blob: 'Shloka Samjuti Gujarati.docx', format: 'docx' },
        ],
    },
    {
        key: 'subject-explanations',
        number: 3,
        name: 'Vishay Prastuti',
        examTitle: 'Final Exam – Vishay Prastuti (Topic Presentation)',
        document: 'Vishay Prastuti, Topics 1–17',
        type: 'Presentation-style Exam',
        section: 'Presentation',
        scope: { selected: 17, unit: 'topics' },
        purpose: 'Tests the ability to explain the fundamental topics of our upasana using references from the Satsang Diksha.',
        revise: 'All 17 topics (listed below).',
        assessed: "2 topic explanations, drawn from any of the 17 topics, in the student's own words supported by the scriptural references given.",
        marks: { count: 2, unit: 'topic explanations', each: 10 },
        files: [
            { lang: 'en', label: 'English', blob: 'Copy of Vishay Prastuti 1-17.pdf', format: 'pdf' },
            { lang: 'gu', label: 'ગુજરાતી', blob: 'Copy of વિષયપ્રસ્તુતિ ૧-૧૭.pdf', format: 'pdf' },
        ],
    },
    {
        key: 'faq',
        number: 4,
        name: 'FAQs',
        examTitle: 'Final Exam – FAQ',
        document: 'FAQ (English)',
        type: 'Presentation-style Exam',
        section: 'Presentation',
        purpose:
            'Strengthens understanding of our Satsang philosophy through questions and answers. The answers clarify common questions a Vidvan or Vidushi will face in life, and show clearly how BAPS is grounded in Sanatan values.',
        revise: 'Every Q&A pair in the FAQ booklet, each tied to the shlok it relates to.',
        assessed: "2 FAQ answers, in the student's own words supported by the scriptural references given.",
        marks: { count: 2, unit: 'FAQ answers', each: 10 },
        files: [
            { lang: 'en', label: 'English', blob: 'FAQ_ENGLISH.pdf', format: 'pdf' },
        ],
    },
];

export function paperMarks(p: ExamPaper) {
    return p.marks.count * p.marks.each;
}

export function findPaper(key: string) {
    return EXAM_PAPERS.find((p) => p.key === key);
}
