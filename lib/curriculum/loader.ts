// Curriculum loader and accessor functions

import curriculumData from '@/content/curriculum.json';
import { Unit, Lesson, Exercise } from '@/types/curriculum';

// Cache the loaded curriculum
let curriculum: Unit[] | null = null;

/**
 * Load the curriculum (from JSON)
 */
export function loadCurriculum(): Unit[] {
  if (!curriculum) {
    curriculum = curriculumData as Unit[];
  }
  return curriculum;
}

/**
 * Get all units
 */
export function getAllUnits(): Unit[] {
  return loadCurriculum();
}

/**
 * Get a unit by ID
 */
export function getUnit(unitId: string): Unit | undefined {
  const units = loadCurriculum();
  return units.find(u => u.id === unitId);
}

/**
 * Get a lesson by ID
 */
export function getLesson(lessonId: string): Lesson | undefined {
  const units = loadCurriculum();
  for (const unit of units) {
    const lesson = unit.lessons.find(l => l.id === lessonId);
    if (lesson) return lesson;
  }
  return undefined;
}

/**
 * Get an exercise by ID
 */
export function getExercise(exerciseId: string): Exercise | undefined {
  const units = loadCurriculum();
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      const exercise = lesson.exercises.find(e => e.id === exerciseId);
      if (exercise) return exercise;
    }
  }
  return undefined;
}

/**
 * Get all lessons from all units
 */
export function getAllLessons(): Lesson[] {
  const units = loadCurriculum();
  return units.flatMap(u => u.lessons);
}

/**
 * Get all exercises from all lessons
 */
export function getAllExercises(): Exercise[] {
  const lessons = getAllLessons();
  return lessons.flatMap(l => l.exercises);
}

/**
 * Get the next lesson after a given lesson
 */
export function getNextLesson(currentLessonId: string): Lesson | null {
  const lessons = getAllLessons();
  const currentIndex = lessons.findIndex(l => l.id === currentLessonId);
  
  if (currentIndex === -1 || currentIndex === lessons.length - 1) {
    return null;
  }
  
  return lessons[currentIndex + 1];
}

/**
 * Get the previous lesson before a given lesson
 */
export function getPreviousLesson(currentLessonId: string): Lesson | null {
  const lessons = getAllLessons();
  const currentIndex = lessons.findIndex(l => l.id === currentLessonId);
  
  if (currentIndex <= 0) {
    return null;
  }
  
  return lessons[currentIndex - 1];
}

/**
 * Get curriculum statistics
 */
export function getCurriculumStats() {
  const units = loadCurriculum();
  const lessons = getAllLessons();
  const exercises = getAllExercises();
  
  return {
    totalUnits: units.length,
    totalLessons: lessons.length,
    totalExercises: exercises.length,
    exercisesByType: exercises.reduce((acc, ex) => {
      acc[ex.type] = (acc[ex.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}
