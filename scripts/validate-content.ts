#!/usr/bin/env ts-node

// Content validation script

import { readFileSync } from 'fs';
import { join } from 'path';
import { validateCurriculum } from '../lib/validation/schemas';
import { Unit, Exercise } from '../types/curriculum';

function lintContent(filePath: string): void {
  console.log(`\n🔍 Validating content: ${filePath}\n`);
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Read and parse JSON
    const content = readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    
    // Schema validation
    try {
      const curriculum = validateCurriculum(json);
      console.log('✅ Schema validation passed');
      
      // Custom validation rules
      const allIds = new Set<string>();
      const allExerciseIds = new Set<string>();
      
      for (const unit of curriculum) {
        // Check unit ID format
        if (allIds.has(unit.id)) {
          errors.push(`Duplicate unit ID: ${unit.id}`);
        }
        allIds.add(unit.id);
        
        for (const lesson of unit.lessons) {
          // Check lesson ID format
          if (allIds.has(lesson.id)) {
            errors.push(`Duplicate lesson ID: ${lesson.id}`);
          }
          allIds.add(lesson.id);
          
          // Check lesson belongs to correct unit
          if (lesson.unitId !== unit.id) {
            errors.push(`Lesson ${lesson.id} has wrong unitId: ${lesson.unitId} (should be ${unit.id})`);
          }
          
          for (const exercise of lesson.exercises) {
            // Check for duplicate exercise IDs
            if (allExerciseIds.has(exercise.id)) {
              errors.push(`Duplicate exercise ID: ${exercise.id}`);
            }
            allExerciseIds.add(exercise.id);
            
            // Type-specific validation
            validateExerciseData(exercise as any, errors, warnings);
            
            // Check tags
            const hasDifficultyTag = exercise.tags.some(t => t.type === 'difficulty');
            if (!hasDifficultyTag) {
              errors.push(`${exercise.id}: Missing difficulty tag`);
            }
            
            const hasTopicOrGrammarTag = exercise.tags.some(t => 
              t.type === 'topic' || t.type === 'grammar'
            );
            if (!hasTopicOrGrammarTag) {
              warnings.push(`${exercise.id}: No topic or grammar tag`);
            }
          }
          
          // Check lesson has exercises
          if (lesson.exercises.length === 0) {
            warnings.push(`Lesson ${lesson.id} has no exercises`);
          }
        }
        
        // Check unit has lessons
        if (unit.lessons.length === 0) {
          warnings.push(`Unit ${unit.id} has no lessons`);
        }
      }
      
      console.log(`✅ Custom validation passed`);
      console.log(`\n📊 Statistics:`);
      console.log(`   Units: ${curriculum.length}`);
      console.log(`   Lessons: ${allIds.size - curriculum.length}`);
      console.log(`   Exercises: ${allExerciseIds.size}`);
      
    } catch (e: unknown) {
      const error = e as Error;
      errors.push(`Schema validation failed: ${error.message}`);
    }
    
  } catch (e: unknown) {
    const error = e as Error;
    errors.push(`Failed to read/parse JSON: ${error.message}`);
  }
  
  // Print results
  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach(e => console.log(`   - ${e}`));
    console.log('\n❌ Content validation FAILED\n');
    process.exit(1);
  } else {
    console.log('\n✅ Content validation PASSED\n');
  }
}

function validateExerciseData(
  exercise: Exercise,
  errors: string[],
  warnings: string[]
): void {
  switch (exercise.type) {
    case 'mcq':
      // Check MCQ has 3-6 options
      const mcqData = exercise.data as any;
      if (mcqData.options && (mcqData.options.length < 3 || mcqData.options.length > 6)) {
        errors.push(`${exercise.id}: MCQ must have 3-6 options (has ${mcqData.options.length})`);
      }
      // Check correctOptionId exists in options
      if (mcqData.options && mcqData.correctOptionId) {
        const optionIds = mcqData.options.map((o: any) => o.id);
        if (!optionIds.includes(mcqData.correctOptionId)) {
          errors.push(`${exercise.id}: correctOptionId '${mcqData.correctOptionId}' not found in options`);
        }
      }
      break;
      
    case 'typed-answer':
      // Check has at least one accepted answer
      const typedData = exercise.data as any;
      if (!typedData.acceptedAnswers || typedData.acceptedAnswers.length === 0) {
        errors.push(`${exercise.id}: Typed-answer must have at least 1 accepted answer`);
      }
      break;
      
    case 'match':
      // Check has at least 3 pairs
      const matchData = exercise.data as any;
      if (matchData.pairs && matchData.pairs.length < 3) {
        errors.push(`${exercise.id}: Match exercise must have at least 3 pairs`);
      }
      break;
      
    case 'connect':
      // Check left and right items match
      const connectData = exercise.data as any;
      if (connectData.leftItems && connectData.rightItems && connectData.correctPairs) {
        const leftIds = connectData.leftItems.map((i: any) => i.id);
        const rightIds = connectData.rightItems.map((i: any) => i.id);
        
        for (const pair of connectData.correctPairs) {
          if (!leftIds.includes(pair.leftId)) {
            errors.push(`${exercise.id}: Pair references unknown leftId '${pair.leftId}'`);
          }
          if (!rightIds.includes(pair.rightId)) {
            errors.push(`${exercise.id}: Pair references unknown rightId '${pair.rightId}'`);
          }
        }
      }
      break;
      
    case 'ordering':
      // Check has at least 3 items
      const orderData = exercise.data as any;
      if (orderData.items && orderData.items.length < 3) {
        errors.push(`${exercise.id}: Ordering exercise must have at least 3 items`);
      }
      break;
      
    case 'fill-blank':
      // Check blanks array not empty
      const fillData = exercise.data as any;
      if (!fillData.blanks || fillData.blanks.length === 0) {
        errors.push(`${exercise.id}: Fill-blank must have at least 1 blank`);
      }
      break;
  }
  
  // Check explanation exists
  if (!exercise.explanation) {
    warnings.push(`${exercise.id}: No explanation provided`);
  }
}

// Main execution
const contentPath = join(__dirname, '..', 'content', 'curriculum.json');
lintContent(contentPath);
