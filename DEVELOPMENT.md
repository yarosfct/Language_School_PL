# PolskiOdZera - Development Guide

## 🎉 MVP Implementation Status

### ✅ COMPLETED (Week 1-2 Features)

#### Foundation & Infrastructure
- ✅ Next.js 15 + TypeScript + Tailwind CSS setup
- ✅ Core TypeScript interfaces (Unit, Lesson, Exercise, ReviewCard, Mistake, Progress)
- ✅ Zod schemas for content validation
- ✅ Dexie.js IndexedDB wrapper
- ✅ Zustand global state management
- ✅ Responsive layout with Sidebar and Header
- ✅ Sample curriculum (1 unit, 3 lessons, 15 exercises)
- ✅ Content validation script

#### Exercise Renderers (All 6 Core Types)
- ✅ MCQ (Multiple Choice Questions)
- ✅ Match (Pair matching)
- ✅ Fill-in-the-Blank
- ✅ Typed Answer (with diacritics tolerance)
- ✅ Ordering (sequence arrangement)
- ✅ Connect (connection pairing)

#### Lesson Player
- ✅ Exercise flow with progress bar
- ✅ Submit and immediate feedback
- ✅ Answer evaluation logic
- ✅ Attempts tracking to IndexedDB
- ✅ Auto-advance to next exercise
- ✅ Lesson completion tracking

#### Spaced Repetition (SM-2)
- ✅ SM-2 algorithm implementation
- ✅ ReviewCard management
- ✅ Review scheduling after each attempt
- ✅ Review session page with due cards

#### Mistakes Notebook
- ✅ Mistake logging with tags
- ✅ Error rate calculation by tag
- ✅ Weak skills identification (>40% error rate)
- ✅ Analytics dashboard
- ✅ Recent mistakes list

#### Additional Pages
- ✅ Dashboard (home page with stats)
- ✅ Learn page (curriculum browser)
- ✅ Vocabulary page (auto-generated from lessons)
- ✅ Grammar reference page (placeholder with topics)
- ✅ Settings page

#### Utilities & Helpers
- ✅ Levenshtein distance for typo tolerance
- ✅ Polish diacritics removal
- ✅ Array shuffling
- ✅ Exercise evaluation functions
- ✅ Curriculum loader
- ✅ Mistake analytics

## 📁 Project Structure

```
/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx             # Root layout with sidebar
│   ├── page.tsx               # Dashboard (home)
│   ├── learn/                 # Curriculum browser
│   ├── lesson/[id]/           # Lesson player (dynamic)
│   ├── review/                # Review session
│   ├── mistakes/              # Mistakes notebook
│   ├── vocabulary/            # Vocabulary list
│   ├── grammar/               # Grammar reference
│   └── settings/              # Settings page
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   └── Header.tsx         # Top header bar
│   └── exercises/             # Exercise components
│       ├── ExerciseRenderer.tsx
│       ├── MCQExercise.tsx
│       ├── MatchExercise.tsx
│       ├── FillBlankExercise.tsx
│       ├── TypedAnswerExercise.tsx
│       ├── OrderingExercise.tsx
│       └── ConnectExercise.tsx
│
├── lib/
│   ├── db/                    # IndexedDB layer
│   │   └── index.ts           # Dexie setup & helpers
│   ├── store/                 # Global state
│   │   └── useStore.ts        # Zustand store
│   ├── validation/            # Content validation
│   │   └── schemas.ts         # Zod schemas
│   ├── curriculum/            # Curriculum management
│   │   └── loader.ts          # Load & access curriculum
│   ├── exercises/             # Exercise logic
│   │   └── evaluators.ts      # Answer evaluation
│   ├── review/                # Spaced repetition
│   │   └── sm2.ts             # SM-2 algorithm
│   ├── mistakes/              # Mistake analytics
│   │   └── analytics.ts       # Error rate calculation
│   └── utils/
│       └── string.ts          # String utilities
│
├── types/
│   ├── curriculum.ts          # Curriculum types
│   └── progress.ts            # Progress & review types
│
├── content/
│   └── curriculum.json        # Lesson content
│
├── scripts/
│   └── validate-content.ts    # Content validator
│
├── public/
│   └── manifest.json          # PWA manifest
│
└── Configuration files
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.ts
    └── .eslintrc.json
```

## 🚀 Running the Application

### Development
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Production Build
```bash
npm run build
npm start
```

### Content Validation
```bash
npm run validate-content
```

## 🎯 How It Works

### Learning Flow
1. User opens **Learn** page → sees units and lessons
2. Clicks on a lesson → navigates to **Lesson Player**
3. Completes exercises one by one with immediate feedback
4. Each attempt is:
   - Saved to IndexedDB
   - Evaluated for correctness
   - Scheduled for review (SM-2)
   - Logged as mistake if incorrect
5. After completing all exercises → lesson marked complete
6. Returns to Learn page or advances to next lesson

### Review System (SM-2)
- After each exercise attempt, a **ReviewCard** is created/updated
- SM-2 algorithm calculates next review date based on:
  - **Interval**: Days until next review
  - **Ease Factor**: Difficulty multiplier (1.3 - 2.5)
  - **Repetitions**: Consecutive correct answers
- Formula:
  - Correct answer → increase interval
  - Incorrect answer → reset to 1 day
  - First repetition: 1 day
  - Second repetition: 6 days
  - Subsequent: interval × easeFactor

### Mistakes Notebook
- Every incorrect answer logged with:
  - Timestamp
  - User answer
  - Correct answer
  - Exercise tags
- Analytics calculates:
  - Error rate per tag
  - Weak skills (>40% error rate)
  - Recent mistakes (last 20)

### Exercise Evaluation
- **MCQ**: Direct ID comparison
- **Match**: All pairs must match correctly
- **Fill-blank**: Accepts multiple valid answers (case-insensitive)
- **Typed Answer**: 
  - Exact match
  - Diacritics tolerance (ą→a, ę→e, etc.)
  - Typo tolerance (Levenshtein distance ≤ 1)
- **Ordering**: Exact sequence match
- **Connect**: All connections must be correct

### Data Storage (IndexedDB)
Four tables:
1. **attempts**: Exercise attempts history
2. **mistakes**: Incorrect attempts with tags
3. **reviewCards**: Spaced repetition scheduling
4. **progress**: User progress (singleton)

All data stored locally - no backend required for MVP.

## 📝 Content Format

### Exercise Schema Example (MCQ)
```json
{
  "id": "ex-01-01-01",
  "type": "mcq",
  "question": "How do you say 'Good morning' in Polish?",
  "tags": [
    { "type": "difficulty", "value": "A1" },
    { "type": "topic", "value": "greetings" },
    { "type": "grammar", "value": "basic-phrases" }
  ],
  "data": {
    "options": [
      { "id": "a", "text": "Dzień dobry" },
      { "id": "b", "text": "Dobranoc" }
    ],
    "correctOptionId": "a"
  },
  "solution": "a",
  "explanation": "Explanation text here"
}
```

### Tag System
- **Difficulty**: A1, A2, B1, B2, C1, C2
- **Grammar**: verb:być, case:accusative, conjugation:present, etc.
- **Topic**: greetings, food, travel, numbers, etc.

## 🔧 Development Tips

### Adding New Exercises
1. Add to `content/curriculum.json`
2. Run `npm run validate-content`
3. Reload the app

### Creating New Exercise Types
1. Add type to `ExerciseType` in `types/curriculum.ts`
2. Create data interface (e.g., `DictationData`)
3. Add evaluator to `lib/exercises/evaluators.ts`
4. Create component in `components/exercises/`
5. Add case to `ExerciseRenderer.tsx`

### Debugging IndexedDB
- Open DevTools → Application → IndexedDB → PolskiOdZeraDB
- Inspect tables: attempts, mistakes, reviewCards, progress

### Testing Spaced Repetition
- Complete a lesson
- Go to Review page
- Initially, cards are due immediately
- After reviewing, check `reviewCards` table to see updated `due` timestamp

## 🎨 Styling

- **Framework**: Tailwind CSS
- **Color Palette**:
  - Primary: Blue (#0ea5e9)
  - Success: Green
  - Error: Red
  - Warning: Orange
- **Dark Mode**: Fully supported with `dark:` variants

## ⚡ Performance

- Static generation where possible
- Client-side routing (instant navigation)
- IndexedDB for fast local storage
- No external API calls (MVP)
- Bundle size: ~139 KB First Load JS

## 🐛 Known Limitations (MVP)

- No audio yet (Web Speech API pending)
- No service worker (offline mode pending)
- Grammar pages are placeholders
- No user authentication
- No data export/import
- Settings are not persisted
- No search functionality
- No pronunciation grading

## 📋 Next Steps (Post-MVP)

### Week 3-4
- [ ] Add audio (Web Speech API for Polish TTS)
- [ ] Service worker for offline caching
- [ ] Expand content (Units 2-3, A1 complete)
- [ ] Grammar reference content

### V1 (Weeks 5-8)
- [ ] A2 content
- [ ] Authentication (Supabase/Firebase)
- [ ] Cloud sync
- [ ] Analytics dashboard
- [ ] Admin mode for content import

### V2 (Weeks 9-12)
- [ ] B1 content
- [ ] Pronunciation scoring
- [ ] Community features
- [ ] Internationalization
- [ ] Mobile apps (Capacitor)

## 🤝 Contributing

1. Validate content before submitting: `npm run validate-content`
2. Follow TypeScript best practices
3. Test all exercise types
4. Include explanations for exercises
5. Use proper Polish diacritics

## 📄 License

MIT - See LICENSE file

---

Built with ❤️ for Polish language learners worldwide! 🇵🇱
