const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const exercisesPath = path.join(root, 'content/curated_exercises/exercises.json');
const bookDataPath = path.join(root, 'content/book/book_data.json');

const CATEGORY_ORDER = [
  'social_communication',
  'daily_life',
  'people_relationships',
  'opinions_feelings',
  'home_food',
  'work_school',
  'shopping_money',
  'travel_city',
  'health_body',
  'time_weather',
  'general',
];

const SECTION_CATEGORY_BY_ID = {
  useful_verbs_p1: 'daily_life',
  getting_to_know_each_other: 'social_communication',
  useful_adjectives_p1: 'opinions_feelings',
  personal_belongings: 'daily_life',
  food: 'home_food',
  at_the_restaurant: 'home_food',
  meals_and_drinks: 'home_food',
  fruits_and_veggies: 'home_food',
  family: 'people_relationships',
  colours: 'shopping_money',
  useful_verbs_p2: 'daily_life',
  appearances: 'people_relationships',
  characters_and_personalities: 'opinions_feelings',
  house_and_home: 'daily_life',
  in_the_bathroom: 'health_body',
  in_the_kitchen: 'home_food',
  in_the_livingroom_and_bedroom: 'daily_life',
  hobbies_and_freetime: 'opinions_feelings',
  health_and_diseases: 'health_body',
  everyday_activities: 'daily_life',
  useful_adjectives_p2: 'opinions_feelings',
  time: 'time_weather',
  transport_and_moving_around_the_city: 'travel_city',
  clothes_shoes_jewlery: 'shopping_money',
  in_the_city_and_countryside: 'travel_city',
  geography: 'travel_city',
  weather: 'time_weather',
  holidays_and_celebrations: 'social_communication',
  shopping: 'shopping_money',
  adverbs_and_various: 'general',
  useful_verbs_p3: 'daily_life',
  money: 'shopping_money',
  jobs: 'work_school',
  work: 'work_school',
  computer_and_internet: 'work_school',
  culture_and_art: 'general',
  music: 'general',
  travel: 'travel_city',
  states_and_emotions: 'opinions_feelings',
  useful_adjectives_p3: 'opinions_feelings',
};

const CATEGORY_TERMS = {
  social_communication: [
    'dziękuję',
    'dzięki',
    'proszę',
    'przepraszam',
    'cześć',
    'pa',
    'witaj',
    'dzień dobry',
    'dobranoc',
    'do widzenia',
    'smacznego',
    'hello',
    'thanks',
    'thank you',
    'please',
    'sorry',
    'bye',
    'good morning',
  ],
  daily_life: [
    'robi',
    'idę',
    'idziemy',
    'wracam',
    'wróci',
    'czekam',
    'dzisiaj',
    'jutro',
    'wczoraj',
    'teraz',
    'rano',
    'wieczorem',
    'codziennie',
    'zawsze',
    'nigdy',
    'domu',
    'mieszk',
    'spać',
    'sleep',
    'home',
    'today',
    'tomorrow',
    'yesterday',
    'always',
    'never',
  ],
  people_relationships: [
    'mama',
    'mamus',
    'matka',
    'tata',
    'ojciec',
    'siostra',
    'brat',
    'rodzina',
    'dziecko',
    'dzieci',
    'mąż',
    'żona',
    'przyjaciel',
    'kolega',
    'friend',
    'family',
    'mother',
    'father',
    'sister',
    'brother',
    'husband',
    'wife',
    'children',
  ],
  opinions_feelings: [
    'lubi',
    'chcę',
    'chcesz',
    'chce',
    'myślę',
    'wiem',
    'czuję',
    'koch',
    'nienawidzę',
    'boję',
    'ciesz',
    'smut',
    'szczęśliw',
    'zmęcz',
    'want',
    'like',
    'think',
    'know',
    'feel',
    'love',
    'hate',
    'afraid',
    'happy',
    'tired',
  ],
  home_food: [
    'jedzenie',
    'jeść',
    'jem',
    'pić',
    'pij',
    'kawa',
    'herbata',
    'woda',
    'chleb',
    'obiad',
    'śniadanie',
    'kolacja',
    'kuchnia',
    'pokój',
    'mieszkanie',
    'food',
    'eat',
    'drink',
    'coffee',
    'tea',
    'water',
    'breakfast',
    'dinner',
    'kitchen',
    'room',
  ],
  work_school: [
    'praca',
    'prac',
    'szkoła',
    'uczę',
    'uczyć',
    'student',
    'nauczyciel',
    'lekcja',
    'egzamin',
    'biuro',
    'job',
    'work',
    'school',
    'study',
    'teacher',
    'lesson',
    'exam',
    'office',
  ],
  shopping_money: [
    'kup',
    'sklep',
    'kosztuje',
    'cena',
    'pieniądze',
    'zapłacić',
    'rachunek',
    'tani',
    'drogi',
    'buy',
    'shop',
    'store',
    'cost',
    'price',
    'money',
    'pay',
    'bill',
    'cheap',
    'expensive',
  ],
  travel_city: [
    'autobus',
    'pociąg',
    'samochód',
    'metro',
    'lotnisko',
    'hotel',
    'miasto',
    'ulica',
    'droga',
    'bilet',
    'podróż',
    'travel',
    'bus',
    'train',
    'car',
    'airport',
    'city',
    'street',
    'ticket',
  ],
  health_body: [
    'lekarz',
    'chor',
    'gorącz',
    'ból',
    'głowa',
    'brzuch',
    'ręka',
    'noga',
    'zdrow',
    'doctor',
    'sick',
    'ill',
    'fever',
    'pain',
    'head',
    'stomach',
    'health',
  ],
  time_weather: [
    'pogoda',
    'deszcz',
    'śnieg',
    'zimno',
    'ciepło',
    'gorąco',
    'godzina',
    'minut',
    'czas',
    'weather',
    'rain',
    'snow',
    'cold',
    'warm',
    'hot',
    'hour',
    'minute',
    'time',
  ],
};

const COMMON_TERMS = [
  'jestem',
  'jesteś',
  'jest',
  'są',
  'mam',
  'masz',
  'mamy',
  'może',
  'mogę',
  'możesz',
  'muszę',
  'musisz',
  'chcę',
  'chcesz',
  'wiem',
  'wiesz',
  'nie wiem',
  'lubię',
  'myślę',
  'potrzebuję',
  'gdzie',
  'kiedy',
  'dlaczego',
  'jak',
  'ile',
  'co',
  'kto',
  'czy',
  'i am',
  "i'm",
  'you are',
  "you're",
  'i have',
  'you have',
  'can i',
  'can you',
  'i need',
  'i want',
  'where',
  'when',
  'why',
  'how',
  'what',
  'who',
];

const SUBORDINATORS = [
  'że',
  'żeby',
  'który',
  'która',
  'które',
  'ponieważ',
  'chociaż',
  'kiedy',
  'jeśli',
  'gdyby',
  'that',
  'which',
  'because',
  'although',
  'while',
  'if',
  'when',
];

function cleanText(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalize(value) {
  return cleanText(value)
    .toLocaleLowerCase('pl-PL')
    .replace(/[“”‘’"'.,!?;:()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return cleanText(value).match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)?/gu) ?? [];
}

function countMatches(text, terms) {
  const normalized = normalize(text);
  return terms.reduce((count, term) => count + (normalized.includes(normalize(term)) ? 1 : 0), 0);
}

function pairKey(pl, en) {
  return `${normalize(pl)}|${normalize(en)}`;
}

function extractQuotedEnglish(prompt) {
  const cleaned = cleanText(prompt);
  const match = cleaned.match(/'(.+)'/);
  return match ? cleanText(match[1]) : cleaned;
}

function getGeneratedPracticePair(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const en = extractQuotedEnglish(item.prompt_en);
  let pl = '';

  if (item.type === 'multiple_choice') {
    pl = cleanText(item.correct_answer);
  } else if (item.type === 'word_bank') {
    pl = cleanText(item.answer_pl);
  } else if (item.type === 'typed_input') {
    pl = cleanText(Array.isArray(item.accepted_answers) ? item.accepted_answers[0] : '');
  }

  return pl && en ? { pl, en } : null;
}

function getFallbackCategory(pl, en) {
  const text = `${pl} ${en}`;
  let bestCategory = 'general';
  let bestScore = 0;

  for (const category of CATEGORY_ORDER) {
    if (category === 'general') {
      continue;
    }

    const score = countMatches(text, CATEGORY_TERMS[category] ?? []);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}

function getSentenceType(pl, en) {
  if (pl.includes('?') || en.includes('?')) {
    return 'question';
  }

  if (pl.includes('!') || en.includes('!')) {
    return 'exclamation';
  }

  const firstPl = normalize(pl).split(' ')[0] ?? '';
  const firstEn = normalize(en).split(' ')[0] ?? '';

  if (['chodź', 'przyjdź', 'powiedz', 'daj', 'zadzwoń', 'poczekaj', 'weź'].includes(firstPl)) {
    return 'command';
  }

  if (['come', 'tell', 'give', 'call', 'wait', 'take', 'please'].includes(firstEn)) {
    return 'command';
  }

  return 'statement';
}

function getDifficulty(pl, en, category) {
  const plTokens = tokenize(pl).length;
  const enTokens = tokenize(en).length;
  const maxTokens = Math.max(plTokens, enTokens);
  const commaCount = (pl.match(/,/g) ?? []).length + (en.match(/,/g) ?? []).length;
  const subordinatorCount = countMatches(`${pl} ${en}`, SUBORDINATORS);

  if (maxTokens <= 5 && commaCount === 0 && subordinatorCount === 0) {
    return 'A1';
  }

  if (maxTokens <= 9 && commaCount <= 1 && subordinatorCount <= 1 && category !== 'general') {
    return 'A2';
  }

  if (maxTokens <= 15 && commaCount <= 2) {
    return 'B1';
  }

  return 'B2';
}

function scoreExercise(pl, en, category, sentenceType, difficulty, sourceInfo) {
  const maxTokens = Math.max(tokenize(pl).length, tokenize(en).length);
  const text = `${pl} ${en}`;
  let score = sourceInfo ? 86 : 74;

  if (maxTokens <= 5) score += 12;
  else if (maxTokens <= 8) score += 9;
  else if (maxTokens <= 12) score += 4;
  else score -= 4;

  if (sentenceType === 'question') score += 7;
  if (sentenceType === 'command') score += 5;
  if (sentenceType === 'exclamation') score += 3;

  score += Math.min(14, countMatches(text, COMMON_TERMS) * 2);
  score += Math.min(10, countMatches(text, CATEGORY_TERMS[category] ?? []) * 2);

  if (sourceInfo?.source === 'generated') score += 3;
  if (typeof sourceInfo?.sectionNumber === 'number' && sourceInfo.sectionNumber <= 10) score += 5;
  if (typeof sourceInfo?.sectionNumber === 'number' && sourceInfo.sectionNumber >= 30) score -= 4;
  if (/[()"]/u.test(text)) score -= 5;
  if (/[,;:]/.test(text)) score -= 3;
  if (/\d/.test(text)) score -= 3;
  if (difficulty === 'A1') score += 5;
  if (difficulty === 'A2') score += 3;
  if (difficulty === 'B2') score -= 8;

  return Math.round(score * 10) / 10;
}

function buildBookLookup(bookData) {
  const entries = bookData.entries ?? {};
  const sectionIds = bookData.indexes?.by_kind?.sections ?? Object.keys(entries);
  const lookup = new Map();

  for (const sectionId of sectionIds) {
    const entry = entries[sectionId];
    const data = entry?.data;
    if (!data || typeof data !== 'object') {
      continue;
    }

    const category = SECTION_CATEGORY_BY_ID[sectionId] ?? getFallbackCategory(entry.topic_pl, entry.topic_en);
    const sourceBase = {
      source: 'book',
      sectionId,
      sectionNumber: typeof entry.section_number === 'number' ? entry.section_number : null,
      topicEn: cleanText(entry.topic_en),
      topicPl: cleanText(entry.topic_pl),
      category,
    };

    for (const item of data.sentences ?? []) {
      const pl = cleanText(item?.pl);
      const en = cleanText(item?.en);
      if (pl && en) {
        lookup.set(pairKey(pl, en), sourceBase);
      }
    }

    for (const item of data.generated_practice ?? []) {
      const pair = getGeneratedPracticePair(item);
      if (pair) {
        lookup.set(pairKey(pair.pl, pair.en), {
          ...sourceBase,
          source: 'generated',
        });
      }
    }
  }

  return lookup;
}

const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));
const bookData = JSON.parse(fs.readFileSync(bookDataPath, 'utf8'));
const bookLookup = buildBookLookup(bookData);

if (!Array.isArray(exercises)) {
  throw new Error('Expected exercises.json to contain a top-level array.');
}

const enriched = exercises.map((item, index) => {
  const pl = cleanText(item?.pl);
  const en = cleanText(item?.en);
  const sourceInfo = bookLookup.get(pairKey(pl, en));
  const category = sourceInfo?.category ?? getFallbackCategory(pl, en);
  const sentenceType = getSentenceType(pl, en);
  const difficulty = getDifficulty(pl, en, category);
  const score = scoreExercise(pl, en, category, sentenceType, difficulty, sourceInfo);

  return {
    id: `book-exercise-${String(index + 1).padStart(4, '0')}`,
    pl,
    en,
    category,
    sentenceType,
    difficulty,
    commonality: 'book_curated',
    score,
    handpicked: typeof item?.handpicked === 'boolean' ? item.handpicked : false,
  };
});

fs.writeFileSync(exercisesPath, `${JSON.stringify(enriched, null, 2)}\n`);

const matchedCount = enriched.filter((item) => bookLookup.has(pairKey(item.pl, item.en))).length;
const counts = enriched.reduce(
  (acc, item) => {
    acc.categories[item.category] = (acc.categories[item.category] ?? 0) + 1;
    acc.difficulties[item.difficulty] = (acc.difficulties[item.difficulty] ?? 0) + 1;
    acc.sentenceTypes[item.sentenceType] = (acc.sentenceTypes[item.sentenceType] ?? 0) + 1;
    return acc;
  },
  { categories: {}, difficulties: {}, sentenceTypes: {} }
);

console.log(`Enriched ${enriched.length} exercises in ${path.relative(root, exercisesPath)}.`);
console.log(`Matched ${matchedCount} exercises back to book_data.json.`);
console.log(JSON.stringify(counts, null, 2));
