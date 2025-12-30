# PolskiOdZera - Learn Polish from Zero

A modern, structured Polish language learning web application featuring adaptive review, spaced repetition, and weak-skill targeting through mistake analytics.

## Features

### MVP (Current Version)
- ✅ Structured curriculum (A1 level)
- ✅ 6 core exercise types (MCQ, Match, Fill-blank, Typed-answer, Ordering, Connect)
- ✅ Adaptive spaced repetition (SM-2 algorithm)
- ✅ Mistakes notebook with tag-based analytics
- ✅ Offline-first PWA architecture
- ✅ Grammar reference pages
- ✅ Auto-generated vocabulary lists
- ✅ Responsive design (desktop, tablet, mobile)

## Tech Stack

- **Framework**: Next.js 15 (React + TypeScript)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Local Storage**: IndexedDB (Dexie.js)
- **Validation**: Zod
- **Icons**: Lucide React

## Getting Started

### Prerequisites
- Node.js 18+ (or 20+ recommended)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser to http://localhost:3000
```

### Validate Content

```bash
npm run validate-content
```

## Project Structure

```
/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with sidebar
│   ├── page.tsx           # Dashboard
│   ├── learn/             # Learning pages
│   ├── review/            # Review session
│   ├── mistakes/          # Mistakes notebook
│   ├── vocabulary/        # Vocabulary list
│   └── grammar/           # Grammar reference
├── components/            # React components
│   ├── layout/           # Layout components (Sidebar, Header)
│   └── exercises/        # Exercise renderers
├── lib/                   # Core logic
│   ├── db/               # IndexedDB (Dexie)
│   ├── store/            # Zustand store
│   ├── validation/       # Zod schemas
│   ├── review/           # SM-2 algorithm
│   └── exercises/        # Exercise evaluation
├── types/                # TypeScript types
│   ├── curriculum.ts     # Curriculum types
│   └── progress.ts       # Progress & review types
├── content/              # Curriculum JSON
│   └── curriculum.json   # Main curriculum
└── scripts/              # Build & validation scripts
    └── validate-content.ts
```

## Content Structure

### Exercise Types

1. **MCQ** - Multiple choice questions
2. **Match** - Match pairs (e.g., Polish-English)
3. **Fill-blank** - Fill in the blanks
4. **Typed-answer** - Free text with tolerant checking
5. **Ordering** - Put items in correct order
6. **Connect** - Connect related items

### Tagging System

- **Difficulty**: A1, A2, B1, B2, C1, C2
- **Grammar**: verb:być, case:genitive, conjugation:present, etc.
- **Topic**: greetings, food, travel, education, etc.

## Development

### Content Validation

The content validator checks:
- ✅ Schema compliance (Zod)
- ✅ No duplicate IDs
- ✅ Correct ID formats
- ✅ Exercise type-specific rules
- ✅ Required tags present
- ✅ Reference integrity

### Adding New Content

1. Edit `content/curriculum.json`
2. Run `npm run validate-content`
3. Test in the app

## Roadmap

### V1 (Weeks 5-8)
- [ ] A2 content (expand to 6 units, 40 lessons)
- [ ] Optional authentication (Supabase/Firebase)
- [ ] Cloud sync
- [ ] Analytics dashboard
- [ ] Admin mode for content import
- [ ] Improved TTS (Azure/ElevenLabs)

### V2 (Weeks 9-12)
- [ ] B1 content
- [ ] Pronunciation scoring
- [ ] Community features
- [ ] Internationalization (EN/PT/PL UI)
- [ ] Mobile apps (Capacitor)

## License

MIT

## Contributing

Contributions welcome! Please:
1. Validate content before submitting
2. Follow TypeScript best practices
3. Test exercises thoroughly
4. Include examples in PRs

## Credits

Built with ❤️ for Polish language learners
# Language_School_PL
