'use client';

import { useMemo, useState } from 'react';
import { BookMarked } from 'lucide-react';
import { getBookPracticeCards, getBookSections, type BookWordCard } from '@/lib/book/flashcards';
import { TTSIconButton } from '@/components/ui/TTSButton';
import { TTSControls } from '@/components/ui/TTSControls';
import { Badge, Card, PageHeader, Select } from '@/components/ui/primitives';

export default function VocabularyPage() {
  const [partOfSpeechFilter, setPartOfSpeechFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const sections = useMemo(() => getBookSections(), []);
  const vocabItems = useMemo(() => {
    const words = getBookPracticeCards({ cardType: 'word', includeGenerated: true }).filter(
      (card): card is BookWordCard => card.type === 'word'
    );

    const byPolish = new Map<string, BookWordCard>();
    for (const item of words) {
      if (!byPolish.has(item.polish.toLowerCase())) {
        byPolish.set(item.polish.toLowerCase(), item);
      }
    }

    return [...byPolish.values()];
  }, []);

  const partOfSpeechOptions = useMemo(
    () => ['all', ...new Set(vocabItems.map((item) => item.partOfSpeech))],
    [vocabItems]
  );

  const filteredVocab = useMemo(
    () =>
      vocabItems.filter((item) => {
        const partOk = partOfSpeechFilter === 'all' || item.partOfSpeech === partOfSpeechFilter;
        const sectionOk = sectionFilter === 'all' || item.sectionId === sectionFilter;
        return partOk && sectionOk;
      }),
    [partOfSpeechFilter, sectionFilter, vocabItems]
  );

  return (
    <div>
      <PageHeader
        title="Vocabulary"
        description="Book-driven vocabulary with section and part-of-speech filtering."
        actions={<Badge tone="success">{vocabItems.length} unique terms</Badge>}
      />

      <Card className="mb-8">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary-100 p-3 dark:bg-primary-900/30">
            <BookMarked className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{filteredVocab.length}</p>
            <p className="text-gray-600 dark:text-gray-400">matching words and expressions</p>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by part of speech:</label>
          <Select
            value={partOfSpeechFilter}
            onChange={(e) => setPartOfSpeechFilter(e.target.value)}
            className="min-w-44 px-4 py-2"
          >
            {partOfSpeechOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All types' : option}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by section:</label>
          <Select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="min-w-44 px-4 py-2">
            <option value="all">All sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </Select>
        </div>

        {filteredVocab.length > 0 && (
          <div className="flex items-end">
            <TTSControls
              text={filteredVocab.map((v) => v.polish).join('. ')}
              showSlowToggle={true}
              showReplayButton={false}
              showLoopToggle={true}
            />
          </div>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Polish</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">English</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Section</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Audio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {filteredVocab.map((item, idx) => {
              const isPlaying = playingIndex === idx;
              return (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    isPlaying ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{item.polish}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{item.english.join(', ')}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="rounded bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                      {item.partOfSpeech}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.topicEn}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <TTSIconButton
                      text={item.polish}
                      onStart={() => setPlayingIndex(idx)}
                      onEnd={() => setPlayingIndex(null)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
