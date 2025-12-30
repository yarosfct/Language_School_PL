'use client';

import { useState, useEffect } from 'react';
import { getAllLessons } from '@/lib/curriculum/loader';
import { VocabItem } from '@/types/curriculum';
import { BookMarked } from 'lucide-react';

export default function VocabularyPage() {
  const [vocabItems, setVocabItems] = useState<VocabItem[]>([]);
  const [filter, setFilter] = useState<string>('all');

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
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Vocabulary
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          All words and phrases you&apos;ve encountered
        </p>
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
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
      </div>

      {/* Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Filter by part of speech:
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {partOfSpeechOptions.map(option => (
            <option key={option} value={option}>
              {option === 'all' ? 'All' : option}
            </option>
          ))}
        </select>
      </div>

      {/* Vocabulary list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
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
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredVocab.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
