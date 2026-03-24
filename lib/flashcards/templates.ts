import { getBookPracticeCards } from '@/lib/book/flashcards';
import type {
  FlashcardTemplateCard,
  FlashcardTemplateDefinition,
  ResolvedFlashcardTemplate,
} from '@/types/flashcards';

const curatedTemplates: FlashcardTemplateDefinition[] = [
  {
    id: 'numbers',
    name: 'Numbers',
    description: 'Starter number words for quick everyday recall.',
    icon: 'Hash',
    sourceType: 'curated',
    cards: [
      { id: 'numbers-1', prompt: 'one', answer: 'jeden', acceptedAnswers: ['jeden'] },
      { id: 'numbers-2', prompt: 'two', answer: 'dwa', acceptedAnswers: ['dwa'] },
      { id: 'numbers-3', prompt: 'three', answer: 'trzy', acceptedAnswers: ['trzy'] },
      { id: 'numbers-4', prompt: 'four', answer: 'cztery', acceptedAnswers: ['cztery'] },
      { id: 'numbers-5', prompt: 'five', answer: 'pięć', acceptedAnswers: ['pięć', 'piec'] },
      { id: 'numbers-6', prompt: 'six', answer: 'sześć', acceptedAnswers: ['sześć', 'szesc'] },
      { id: 'numbers-7', prompt: 'seven', answer: 'siedem', acceptedAnswers: ['siedem'] },
      { id: 'numbers-8', prompt: 'eight', answer: 'osiem', acceptedAnswers: ['osiem'] },
      { id: 'numbers-9', prompt: 'nine', answer: 'dziewięć', acceptedAnswers: ['dziewięć', 'dziewiec'] },
      { id: 'numbers-10', prompt: 'ten', answer: 'dziesięć', acceptedAnswers: ['dziesięć', 'dziesiec'] },
    ],
  },
  {
    id: 'body-parts',
    name: 'Body Parts',
    description: 'High-frequency body vocabulary for simple descriptions and health topics.',
    icon: 'HeartPulse',
    sourceType: 'curated',
    cards: [
      { id: 'body-1', prompt: 'head', answer: 'głowa', acceptedAnswers: ['głowa', 'glowa'] },
      { id: 'body-2', prompt: 'face', answer: 'twarz', acceptedAnswers: ['twarz'] },
      { id: 'body-3', prompt: 'eye', answer: 'oko', acceptedAnswers: ['oko'] },
      { id: 'body-4', prompt: 'ear', answer: 'ucho', acceptedAnswers: ['ucho'] },
      { id: 'body-5', prompt: 'nose', answer: 'nos', acceptedAnswers: ['nos'] },
      { id: 'body-6', prompt: 'mouth', answer: 'usta', acceptedAnswers: ['usta'] },
      { id: 'body-7', prompt: 'hand', answer: 'ręka', acceptedAnswers: ['ręka', 'reka'] },
      { id: 'body-8', prompt: 'leg', answer: 'noga', acceptedAnswers: ['noga'] },
      { id: 'body-9', prompt: 'foot', answer: 'stopa', acceptedAnswers: ['stopa'] },
      { id: 'body-10', prompt: 'finger', answer: 'palec', acceptedAnswers: ['palec'] },
    ],
  },
];

const bookSectionTemplates: FlashcardTemplateDefinition[] = [
  {
    id: 'room-furniture',
    name: 'Room Furniture',
    description: 'Core living room and bedroom objects from the book vocabulary.',
    icon: 'Armchair',
    sourceType: 'book-section',
    sectionId: 'in_the_livingroom_and_bedroom',
  },
  {
    id: 'house-home',
    name: 'House & Home',
    description: 'Essential home vocabulary for rooms, buildings, and everyday home talk.',
    icon: 'House',
    sourceType: 'book-section',
    sectionId: 'house_and_home',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    description: 'Common kitchen words and objects used in daily routines.',
    icon: 'UtensilsCrossed',
    sourceType: 'book-section',
    sectionId: 'in_the_kitchen',
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    description: 'Bathroom essentials and hygiene vocabulary from the book section.',
    icon: 'Bath',
    sourceType: 'book-section',
    sectionId: 'in_the_bathroom',
  },
];

const flashcardTemplateDefinitions = [...curatedTemplates, ...bookSectionTemplates];

export function getFlashcardTemplateDefinitions(): FlashcardTemplateDefinition[] {
  return flashcardTemplateDefinitions;
}

export function getFlashcardTemplateById(templateId: string): FlashcardTemplateDefinition | undefined {
  return flashcardTemplateDefinitions.find((template) => template.id === templateId);
}

export function resolveFlashcardTemplateCards(template: FlashcardTemplateDefinition): FlashcardTemplateCard[] {
  if (template.sourceType === 'curated') {
    return template.cards ?? [];
  }

  if (!template.sectionId) {
    return [];
  }

  const cards = getBookPracticeCards({
    cardType: 'word',
    sectionId: template.sectionId,
    includeGenerated: true,
  });

  return cards
    .filter((card) => card.type === 'word')
    .map((card) => ({
      id: `template-${template.id}-${card.id}`,
      prompt: card.english[0] ?? card.polish,
      answer: card.polish,
      acceptedAnswers: [card.polish],
    }));
}

export function getResolvedFlashcardTemplates(): ResolvedFlashcardTemplate[] {
  return flashcardTemplateDefinitions.map((template) => {
    const cards = resolveFlashcardTemplateCards(template);
    return {
      ...template,
      cards,
      cardCount: cards.length,
      previewCards: cards.slice(0, 4),
    };
  });
}
