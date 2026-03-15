'use client';

import { FileText } from 'lucide-react';
import { getBookPracticeCards, type BookSentenceCard } from '@/lib/book/flashcards';
import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';

function getGrammarFromBook() {
  const sentenceCards = getBookPracticeCards({ cardType: 'sentence', includeGenerated: true }).filter(
    (card): card is BookSentenceCard => card.type === 'sentence'
  );
  const counts = new Map<string, number>();

  for (const card of sentenceCards) {
    for (const tag of card.grammarTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([tag, count]) => ({
      id: tag.toLowerCase().replace(/\s+/g, '-'),
      title: tag,
      description: `Appears in ${count} sentence${count === 1 ? '' : 's'} from the imported book JSON.`,
      level: count > 10 ? 'A1-A2' : 'A1',
    }));
}

const handbookTopics = [
  {
    id: 'present-tense-verbs',
    title: 'Present tense verb patterns',
    description: 'Conjugation by person (ja/ty/on-ona/...) and dropping explicit pronouns in natural speech.',
    level: 'A1',
  },
  {
    id: 'mam-lat-pattern',
    title: 'Age expression: "mam ... lat"',
    description: 'Polish uses "to have" for age, but accepted answers can vary by context and pronoun use.',
    level: 'A1',
  },
  {
    id: 'motion-and-aspect',
    title: 'Motion verbs and aspect basics',
    description: 'Pairs like iść/chodzić and perfective vs imperfective choices in real usage.',
    level: 'A2',
  },
];

export default function GrammarPage() {
  const bookTopics = getGrammarFromBook();

  return (
    <div>
      <PageHeader title="Grammar Reference" description="Grammar topics generated from your JSON book data + practical notes." />

      <Card className="mb-8 bg-info-50 dark:bg-blue-900/20" accent="info">
        <p className="text-blue-800 dark:text-blue-300">
          This page now reflects grammar tags from the imported book dataset, then adds practical Polish usage notes for high-value patterns.
        </p>
      </Card>

      <SectionTitle title="From your JSON book data" className="mb-4" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {bookTopics.map((topic) => (
          <Card key={topic.id} className="p-6 transition-shadow duration-default ease-subtle hover:shadow-card">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary-100 p-3 dark:bg-primary-900/30">
                <FileText className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>

              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{topic.title}</h3>
                  <Badge tone="primary">{topic.level}</Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{topic.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle title="Practical usage notes" className="mb-4 mt-12" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {handbookTopics.map((topic) => (
          <Card key={topic.id} className="p-6 transition-shadow duration-default ease-subtle hover:shadow-card">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{topic.title}</h3>
              <Badge tone="success">{topic.level}</Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{topic.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
