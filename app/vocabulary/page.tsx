'use client';

import { useState, useEffect } from 'react';
import { getAllLessons } from '@/lib/curriculum/loader';
import { VocabItem } from '@/types/curriculum';
import { BookMarked } from 'lucide-react';
import { TTSIconButton } from '@/components/ui/TTSButton';
import { TTSControls } from '@/components/ui/TTSControls';
import { Badge, Card, PageHeader, Select } from '@/components/ui/primitives';

export default function VocabularyPage() {
  const [vocabItems, setVocabItems] = useState<VocabItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  useEffect(() => {
    const lessons = getAllLessons();
    const allVocab = lessons.flatMap(lesson => lesson.vocabularyIntroduced);
    
    // Remove duplicates by polish word
    const uniqueVocab = allVocab.filter((item, index, self) =>
      index === self.findIndex(v => v.polish === item.polish)
    );
    
    setVocabItems(uniqueVocab);
  }, []);

  const filteredVocab = filter === 'all'
    ? vocabItems
    : vocabItems.filter(item => item.partOfSpeech === filter);

  const partOfSpeechOptions = ['all', ...new Set(vocabItems.map(v => v.partOfSpeech))];

  return (
    <div>
      <PageHeader
        title="Vocabulary"
        description="All words and phrases you've encountered."
        actions={<Badge tone="success">{vocabItems.length} learned</Badge>}
      />

      {/* Stats */}
      <Card className="mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <BookMarked className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">
              {vocabItems.length}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              words learned
            </p>
          </div>
        </div>
      </Card>

      {/* Filter and Play All */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by part of speech:
          </label>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 min-w-44"
          >
            {partOfSpeechOptions.map(option => (
              <option key={option} value={option}>
                {option === 'all' ? 'All' : option}
              </option>
            ))}
          </Select>
        </div>
        
        {filteredVocab.length > 0 && (
          <div>
            <TTSControls 
              text={filteredVocab.map(v => v.polish).join('. ')}
              showSlowToggle={true}
              showReplayButton={false}
              showLoopToggle={true}
            />
          </div>
        )}
      </div>

      {/* Vocabulary list */}
      <Card className="overflow-hidden p-0">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Polish
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                English
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Gender
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Audio
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredVocab.map((item, idx) => {
              const isPlaying = playingIndex === idx;
              return (
                <tr 
                  key={idx} 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    isPlaying ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.polish}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {item.english}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                      {item.partOfSpeech}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {item.gender || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
