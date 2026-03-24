import {
  deleteCustomFlashcardSet,
  getAllCustomFlashcardSets,
  getCustomFlashcardSet,
  saveCustomFlashcardSet,
} from '@/lib/db';
import { getFlashcardTemplateById, resolveFlashcardTemplateCards } from '@/lib/flashcards/templates';
import { generateId, removeDiacritics } from '@/lib/utils/string';
import type {
  CustomFlashcardCard,
  CustomFlashcardSet,
  FlashcardTemplateCard,
} from '@/types/flashcards';

export interface CustomSetCardInput {
  id?: string;
  prompt: string;
  answer: string;
  createdAt?: number;
}

export interface CreateCustomFlashcardSetInput {
  name: string;
  description?: string;
  cards?: CustomSetCardInput[];
  sourceType?: CustomFlashcardSet['sourceType'];
  templateId?: string;
  icon?: string;
}

export interface UpdateCustomFlashcardSetInput {
  id: string;
  name: string;
  description?: string;
  cards: CustomSetCardInput[];
  sourceType?: CustomFlashcardSet['sourceType'];
  templateId?: string;
  icon?: string;
}

export interface AddCardToCustomSetInput {
  setId?: string;
  createSet?: {
    name: string;
    description?: string;
    sourceType?: CustomFlashcardSet['sourceType'];
    templateId?: string;
    icon?: string;
  };
  card: CustomSetCardInput;
}

export interface AddCardToCustomSetResult {
  set: CustomFlashcardSet;
  duplicate: boolean;
  createdSet: boolean;
  savedCard: CustomFlashcardCard | null;
}

export async function createCustomFlashcardSet(input: CreateCustomFlashcardSetInput): Promise<CustomFlashcardSet> {
  const now = Date.now();
  const set: CustomFlashcardSet = {
    id: generateId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    cards: sanitizeCards(input.cards ?? []),
    sourceType: input.sourceType ?? 'user',
    templateId: input.templateId,
    icon: input.icon,
    createdAt: now,
    updatedAt: now,
  };

  await saveCustomFlashcardSet(set);
  return set;
}

export async function updateCustomFlashcardSet(input: UpdateCustomFlashcardSetInput): Promise<CustomFlashcardSet> {
  const existing = await getCustomFlashcardSet(input.id);
  if (!existing) {
    throw new Error('Custom flashcard set not found.');
  }

  const updated: CustomFlashcardSet = {
    ...existing,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    cards: sanitizeCards(input.cards),
    sourceType: input.sourceType ?? existing.sourceType ?? 'user',
    templateId: input.templateId ?? existing.templateId,
    icon: input.icon ?? existing.icon,
    updatedAt: Date.now(),
  };

  await saveCustomFlashcardSet(updated);
  return updated;
}

export async function importFlashcardTemplate(templateId: string): Promise<CustomFlashcardSet> {
  const template = getFlashcardTemplateById(templateId);
  if (!template) {
    throw new Error('Flashcard template not found.');
  }

  const existingSets = await getAllCustomFlashcardSets();
  const uniqueName = buildUniqueSetName(
    template.name,
    existingSets.map((set) => set.name)
  );
  const cards = resolveFlashcardTemplateCards(template);

  return createCustomFlashcardSet({
    name: uniqueName,
    description: template.description,
    cards,
    sourceType: 'template-import',
    templateId: template.id,
    icon: template.icon,
  });
}

export async function addCardToCustomSet(input: AddCardToCustomSetInput): Promise<AddCardToCustomSetResult> {
  let targetSet: CustomFlashcardSet | undefined;
  let createdSet = false;

  if (input.setId) {
    targetSet = await getCustomFlashcardSet(input.setId);
  }

  if (!targetSet && input.createSet) {
    targetSet = await createCustomFlashcardSet({
      name: input.createSet.name,
      description: input.createSet.description,
      sourceType: input.createSet.sourceType ?? 'user',
      templateId: input.createSet.templateId,
      icon: input.createSet.icon,
    });
    createdSet = true;
  }

  if (!targetSet) {
    throw new Error('Choose a flashcard set first.');
  }

  const sanitizedCard = sanitizeCard(input.card);
  const duplicate = targetSet.cards.some((card) => normalizeAnswer(card.answer) === normalizeAnswer(sanitizedCard.answer));

  if (duplicate) {
    return {
      set: targetSet,
      duplicate: true,
      createdSet,
      savedCard: null,
    };
  }

  const updatedSet: CustomFlashcardSet = {
    ...targetSet,
    cards: [...targetSet.cards, sanitizedCard],
    updatedAt: Date.now(),
  };

  await saveCustomFlashcardSet(updatedSet);

  return {
    set: updatedSet,
    duplicate: false,
    createdSet,
    savedCard: sanitizedCard,
  };
}

export async function removeCustomFlashcardSet(id: string): Promise<void> {
  await deleteCustomFlashcardSet(id);
}

export async function getCustomFlashcardSets(): Promise<CustomFlashcardSet[]> {
  return getAllCustomFlashcardSets();
}

export function buildUniqueSetName(baseName: string, existingNames: string[]): string {
  const trimmedBase = baseName.trim();
  const normalizedExisting = new Set(existingNames.map((name) => normalizeName(name)));

  if (!normalizedExisting.has(normalizeName(trimmedBase))) {
    return trimmedBase;
  }

  let suffix = 2;
  while (normalizedExisting.has(normalizeName(`${trimmedBase} ${suffix}`))) {
    suffix += 1;
  }

  return `${trimmedBase} ${suffix}`;
}

function sanitizeCards(cards: CustomSetCardInput[]): CustomFlashcardCard[] {
  return cards
    .map(sanitizeCard)
    .filter((card) => card.prompt && card.answer);
}

function sanitizeCard(card: CustomSetCardInput | FlashcardTemplateCard): CustomFlashcardCard {
  return {
    id: card.id ?? generateId(),
    prompt: card.prompt.trim(),
    answer: card.answer.trim(),
    createdAt: 'createdAt' in card && typeof card.createdAt === 'number' ? card.createdAt : Date.now(),
  };
}

function normalizeAnswer(value: string): string {
  return removeDiacritics(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
