import { createHash } from 'crypto';

export type GameRecord = {
    id: string;
    title: string;
    answer: string;
    clue: string;
    source: string;
    createdAt: string;
};

export type PublicGame = Omit<GameRecord, 'answer'>;

// Word list related to BAPS and Hinduism - 5 letter words
const BHAGAVAT_WORD_LIST: Array<{ word: string; meaning: string; classRef?: string }> = [
    // BAPS Related
    { word: 'SHAKTI', meaning: 'Divine feminine energy, the soul\'s spark' },
    { word: 'SANSAR', meaning: 'The cycle of birth and death, worldly life' },
    { word: 'PREMA', meaning: 'Spiritual love for the Divine' },
    { word: 'BHAKTI', meaning: 'Devotion to God and His divine abode' },
    { word: 'SAKHI', meaning: 'A close friend, specifically Krishna\'s intimate companions' },
    
    // Hinduism/Sanskrit Terms
    { word: 'DILIP', meaning: 'One who shines like the sun' },
    { word: 'AMRIT', meaning: 'Immortal nectar of divinity' },
    { word: 'DIVYA', meaning: 'Divine, celestial' },
    { word: 'MANAS', meaning: 'The mind, thought faculty' },
    { word: 'JNANA', meaning: 'Spiritual knowledge, divine wisdom' },
    
    // BAPS Shri Swaminarayan Sanstha Specific
    { word: 'GIRIJA', meaning: 'Lord Krishna\'s mother, Goddess Durga' },
    { word: 'SHANTA', meaning: 'Peaceful one, serene being' },
    { word: 'VILAS', meaning: 'Divine pleasure palace in Vrindavan' },
    { word: 'SUKTAM', meaning: 'Hymn of praise and devotion' },
    { word: 'SHRIN', meaning: 'Sanctum, sacred inner space' },
    
    // More BAPS-related terms
    { word: 'MANAV', meaning: 'A human being, person' },
    { word: 'SATYA', meaning: 'Truth, eternal reality' },
    { word: 'SHUBH', meaning: 'Auspicious, good fortune' },
    { word: 'PREMNI', meaning: 'Filled with divine love' },
    { word: 'SANTO', meaning: 'Holy person, saint' },
];

// Get today's date component as a hash key
function getDateKey(): string {
    const now = new Date();
    // Use UTC to ensure consistent date worldwide
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

// Get index from date key using hash
function getIndexFromKey(dateKey: string): number {
    const hash = createHash('md5');
    hash.update(dateKey);
    const hashValue = hash.digest('hex');
    return parseInt(hashValue.substring(0, 8), 16) % BHAGAVAT_WORD_LIST.length;
}

// Get today's word
function getDailyWord(): { word: string; meaning: string; classRef?: string } {
    const dateKey = getDateKey();
    const index = getIndexFromKey(dateKey);
    return BHAGAVAT_WORD_LIST[index];
}

/**
 * Utility function to get today's word (for debugging/admin)
 */
export function getTodaysWord(): { word: string; meaning: string } {
    const daily = getDailyWord();
    return { word: daily.word, meaning: daily.meaning };
}

export const AVAILABLE_GAMES: GameRecord[] = [
    {
        id: 'visharad-wordle',
        title: 'Visharad Wordle',
        answer: getDailyWord().word,
        clue: `${getDailyWord().meaning}`,
        source: 'Daily BAPS/Hinduism word',
        createdAt: new Date().toISOString(),
    },
];

export function toPublicGame(game: GameRecord): PublicGame {
    return {
        id: game.id,
        title: game.title,
        clue: game.clue,
        source: game.source,
        createdAt: game.createdAt,
    };
}
