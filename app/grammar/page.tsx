'use client';

import { FileText } from 'lucide-react';

const grammarTopics = [
  {
    id: 'alphabet',
    title: 'Polish Alphabet & Pronunciation',
    description: 'Learn the Polish alphabet and how to pronounce special characters',
    level: 'A1',
  },
  {
    id: 'noun-gender',
    title: 'Noun Gender',
    description: 'Understanding masculine, feminine, and neuter nouns',
    level: 'A1',
  },
  {
    id: 'verb-byc',
    title: 'The Verb "być" (to be)',
    description: 'Conjugation and usage of the most important Polish verb',
    level: 'A1',
  },
  {
    id: 'cases-intro',
    title: 'Introduction to Cases',
    description: 'Overview of the 7 Polish cases and their functions',
    level: 'A1',
  },
  {
    id: 'nominative',
    title: 'Nominative Case',
    description: 'The basic form of nouns - subject of the sentence',
    level: 'A1',
  },
  {
    id: 'accusative',
    title: 'Accusative Case',
    description: 'Direct objects and certain prepositions',
    level: 'A2',
  },
  {
    id: 'numbers',
    title: 'Numbers 1-100',
    description: 'Counting in Polish and number agreement',
    level: 'A1',
  },
  {
    id: 'pronouns',
    title: 'Personal Pronouns',
    description: 'I, you, he, she, it, we, they in Polish',
    level: 'A1',
  },
];

export default function GrammarPage() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Grammar Reference
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Comprehensive guides to Polish grammar
        </p>
      </div>

      {/* Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
        <p className="text-blue-800 dark:text-blue-300">
          📚 <strong>Coming Soon:</strong> Full grammar explanations with examples and exercises.
          For now, these topics are referenced in lessons.
        </p>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {grammarTopics.map((topic) => (
          <div
            key={topic.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {topic.title}
                  </h3>
                  <span className="px-2 py-1 text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                    {topic.level}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {topic.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Reference */}
      <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Quick Reference
        </h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Polish Special Characters
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
              {['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'].map(char => (
                <div key={char} className="p-3 bg-gray-100 dark:bg-gray-700 rounded text-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {char}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              The 7 Polish Cases
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>Nominative (Mianownik) - subject</li>
              <li>Genitive (Dopełniacz) - possession, negation</li>
              <li>Dative (Celownik) - indirect object</li>
              <li>Accusative (Biernik) - direct object</li>
              <li>Instrumental (Narzędnik) - means, accompaniment</li>
              <li>Locative (Miejscownik) - location</li>
              <li>Vocative (Wołacz) - direct address</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
