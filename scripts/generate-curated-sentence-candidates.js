const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const sourcePath = path.join(root, 'content/sentences_db/Sentence pairs in Polish-English - 2026-04-10.tsv');
const existingExercisesPath = path.join(root, 'content/curated_exercises/exercises.json');
const outputPath = path.join(root, 'content/curated_exercises/sentence_candidates.json');

const TARGET_COUNT = 1000;
const sourceRows = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);

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

const CATEGORY_QUOTAS = {
  social_communication: 90,
  daily_life: 180,
  people_relationships: 115,
  opinions_feelings: 115,
  home_food: 100,
  work_school: 90,
  shopping_money: 75,
  travel_city: 80,
  health_body: 75,
  time_weather: 70,
  general: 10,
};

const SENTENCE_TYPE_TARGETS = {
  question: 450,
  statement: 450,
  command: 70,
  exclamation: 30,
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
    'student',
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
    'hotel',
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

const ABSTRACT_OR_LOW_VALUE_TERMS = [
  'wszechświat',
  'intelekt',
  'polityk',
  'rząd',
  'cesar',
  'napoleon',
  'filozof',
  'średniowiecz',
  'zapaś',
  'komiks',
  'monolingual',
  'universe',
  'government',
  'intellectual',
  'philosophy',
  'medieval',
  'napoleon',
  'caesar',
  'wrestler',
  'comic strip',
];

const BANNED_PATTERNS = [
  /\btom(a|owi|em|ie)?\b/i,
  /\bmary\b/i,
  /\btatoeba\b/i,
  /\bboston\b/i,
  /burdel/i,
  /\bsex\b/i,
  /\bseks\b/i,
  /piekł/i,
  /\bhell\b/i,
  /\bdie\b/i,
  /\bkill\b/i,
  /zabi/i,
  /przemoc/i,
  /violence/i,
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

function containsAny(text, terms) {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(normalize(term)));
}

function normalizedTokens(value) {
  return tokenize(value)
    .map(normalize)
    .filter((token) => token.length > 2);
}

function countMatches(text, terms) {
  const normalized = normalize(text);
  return terms.reduce((count, term) => count + (normalized.includes(normalize(term)) ? 1 : 0), 0);
}

function hasBannedContent(text) {
  return BANNED_PATTERNS.some((pattern) => pattern.test(text));
}

function buildTokenFrequency() {
  const frequency = new Map();

  for (const row of sourceRows) {
    if (!row.trim()) {
      continue;
    }

    const columns = row.split('\t');
    if (columns.length < 4) {
      continue;
    }

    const pl = cleanText(columns[1]);
    const en = cleanText(columns[3]);
    if (hasBadShape(pl, en)) {
      continue;
    }

    for (const token of new Set([...normalizedTokens(pl), ...normalizedTokens(en)])) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  return frequency;
}

function hasBadShape(pl, en) {
  const plTokens = tokenize(pl);
  const enTokens = tokenize(en);
  const maxTokens = Math.max(plTokens.length, enTokens.length);
  const minTokens = Math.min(plTokens.length, enTokens.length);
  const lengthRatio = Math.max(pl.length, en.length) / Math.max(1, Math.min(pl.length, en.length));

  return (
    pl.length < 3 ||
    en.length < 3 ||
    pl.length > 150 ||
    en.length > 170 ||
    minTokens === 0 ||
    maxTokens > 22 ||
    lengthRatio > 3.2 ||
    /https?:\/\//i.test(`${pl} ${en}`) ||
    /[@#*_<>]/.test(`${pl} ${en}`) ||
    /[\u0000-\u001F]/.test(`${pl}${en}`) ||
    hasBannedContent(`${pl} ${en}`)
  );
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

function getCategory(pl, en) {
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

function getCommonality(score) {
  if (score >= 95) {
    return 'very_common';
  }

  if (score >= 78) {
    return 'common';
  }

  return 'useful';
}

function getFrequencyScore(pl, en, tokenFrequency) {
  const tokens = [...normalizedTokens(pl), ...normalizedTokens(en)].filter((token) => token.length > 3);
  if (tokens.length === 0) {
    return 0;
  }

  const tokenScores = tokens.map((token) => Math.log10((tokenFrequency.get(token) ?? 0) + 1));
  const average = tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  const rareTokenCount = tokens.filter((token) => (tokenFrequency.get(token) ?? 0) <= 5).length;

  return Math.round((average * 8 - rareTokenCount * 3) * 10) / 10;
}

function scorePair(pl, en, category, sentenceType, difficulty, tokenFrequency) {
  const plTokens = tokenize(pl).length;
  const enTokens = tokenize(en).length;
  const maxTokens = Math.max(plTokens, enTokens);
  const text = `${pl} ${en}`;
  let score = 45;

  if (maxTokens <= 5) score += 23;
  else if (maxTokens <= 8) score += 20;
  else if (maxTokens <= 12) score += 10;
  else score -= 8;

  if (sentenceType === 'question') score += 12;
  if (sentenceType === 'command') score += 8;
  if (sentenceType === 'exclamation') score += 5;

  score += Math.min(28, countMatches(text, COMMON_TERMS) * 4);
  score += Math.min(20, countMatches(text, CATEGORY_TERMS[category] ?? []) * 3);
  score += getFrequencyScore(pl, en, tokenFrequency);

  if (/\b(i|you|we|my|your|me|us)\b/i.test(en)) score += 10;
  if (/\b(ja|ty|my|mnie|mi|ci|ciebie|nasz|twój|moj[aąe]?)\b/i.test(pl)) score += 10;
  if (/[,;:]/.test(`${pl} ${en}`)) score -= 6;
  if (/[()"]/u.test(`${pl} ${en}`)) score -= 12;
  if (/\d/.test(`${pl} ${en}`)) score -= 6;
  if (countMatches(text, ABSTRACT_OR_LOW_VALUE_TERMS) > 0) score -= 22;
  if (/\b[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,}\b/.test(pl.slice(1))) score -= 10;
  if (/\b[A-Z][a-z]{2,}\b/.test(en.slice(1))) score -= 10;

  if (difficulty === 'A1') score += 8;
  if (difficulty === 'A2') score += 5;
  if (difficulty === 'B2') score -= 12;

  return Math.round(score * 10) / 10;
}

function readExistingPolishSentences() {
  if (!fs.existsSync(existingExercisesPath)) {
    return new Set();
  }

  const existing = JSON.parse(fs.readFileSync(existingExercisesPath, 'utf8'));
  if (!Array.isArray(existing)) {
    return new Set();
  }

  return new Set(existing.map((item) => normalize(item.pl)).filter(Boolean));
}

function parseRows() {
  const existingPolish = readExistingPolishSentences();
  const tokenFrequency = buildTokenFrequency();
  const candidatesByPolish = new Map();

  for (const row of sourceRows) {
    if (!row.trim()) {
      continue;
    }

    const columns = row.split('\t');
    if (columns.length < 4) {
      continue;
    }

    const pl = cleanText(columns[1]);
    const en = cleanText(columns[3]);
    const normalizedPl = normalize(pl);

    if (!normalizedPl || existingPolish.has(normalizedPl) || hasBadShape(pl, en)) {
      continue;
    }

    const category = getCategory(pl, en);
    const sentenceType = getSentenceType(pl, en);
    const difficulty = getDifficulty(pl, en, category);
    const score = scorePair(pl, en, category, sentenceType, difficulty, tokenFrequency);

    if (score < 58) {
      continue;
    }

    const candidate = {
      pl,
      en,
      category,
      sentenceType,
      difficulty,
      commonality: getCommonality(score),
      score,
      handpicked: false,
    };

    const existingCandidate = candidatesByPolish.get(normalizedPl);
    if (!existingCandidate || candidate.score > existingCandidate.score || candidate.en.length < existingCandidate.en.length) {
      candidatesByPolish.set(normalizedPl, candidate);
    }
  }

  const candidatesByEnglish = new Map();

  for (const candidate of candidatesByPolish.values()) {
    const normalizedEn = normalize(candidate.en);
    const existingCandidate = candidatesByEnglish.get(normalizedEn);
    if (
      !existingCandidate ||
      candidate.score > existingCandidate.score ||
      candidate.pl.length < existingCandidate.pl.length
    ) {
      candidatesByEnglish.set(normalizedEn, candidate);
    }
  }

  return [...candidatesByEnglish.values()].sort((a, b) => b.score - a.score || a.pl.localeCompare(b.pl, 'pl'));
}

function selectBalancedCandidates(candidates) {
  const selected = [];
  const selectedKeys = new Set();
  const sentenceTypeCounts = {};
  const byCategory = new Map(CATEGORY_ORDER.map((category) => [category, []]));

  for (const candidate of candidates) {
    byCategory.get(candidate.category)?.push(candidate);
  }

  function addCandidate(candidate, respectSentenceTypeTarget) {
    const key = normalize(candidate.pl);
    if (selectedKeys.has(key)) {
      return false;
    }

    if (
      respectSentenceTypeTarget &&
      (sentenceTypeCounts[candidate.sentenceType] ?? 0) >= (SENTENCE_TYPE_TARGETS[candidate.sentenceType] ?? TARGET_COUNT)
    ) {
      return false;
    }

    selected.push(candidate);
    selectedKeys.add(key);
    sentenceTypeCounts[candidate.sentenceType] = (sentenceTypeCounts[candidate.sentenceType] ?? 0) + 1;
    return true;
  }

  for (const category of CATEGORY_ORDER) {
    const quota = CATEGORY_QUOTAS[category] ?? 0;
    let categoryCount = 0;
    for (const candidate of byCategory.get(category) ?? []) {
      if (addCandidate(candidate, true)) {
        categoryCount += 1;
      }

      if (categoryCount >= quota) {
        break;
      }
    }
  }

  if (selected.length < TARGET_COUNT) {
    for (const candidate of candidates) {
      addCandidate(candidate, false);

      if (selected.length >= TARGET_COUNT) {
        break;
      }
    }
  }

  const ranked = selected
    .slice(0, TARGET_COUNT)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.score - a.score);

  return ranked.map((candidate, index) => ({
    id: `sent-candidate-${String(index + 1).padStart(4, '0')}`,
    ...candidate,
  }));
}

const candidates = parseRows();
const selected = selectBalancedCandidates(candidates);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(selected, null, 2)}\n`);

const counts = selected.reduce((acc, item) => {
  acc[item.category] = (acc[item.category] ?? 0) + 1;
  return acc;
}, {});

console.log(`Scored ${candidates.length} usable sentence pairs.`);
console.log(`Wrote ${selected.length} candidates to ${path.relative(root, outputPath)}.`);
console.log(JSON.stringify(counts, null, 2));
