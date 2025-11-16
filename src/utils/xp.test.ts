/**
 * Unit tests for XP utility functions
 * Run with: npx ts-node src/utils/xp.test.ts
 */

import {
  calculateLevel,
  xpForLevel,
  xpToNextLevel,
  levelProgress,
  awardXP,
} from './xp';

// Simple test helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string) {
  const withinRange = Math.abs(actual - expected) <= tolerance;
  if (!withinRange) {
    console.error(`❌ FAILED: ${message} (expected ~${expected}, got ${actual})`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('🧪 Running XP Utility Tests...\n');

// ===== calculateLevel Tests =====
console.log('Testing calculateLevel()...');
assert(calculateLevel(0) === 1, 'Level 1 at 0 XP');
assert(calculateLevel(50) === 1, 'Level 1 at 50 XP');
assert(calculateLevel(283) === 2, 'Level 2 at 283 XP');
assertApprox(calculateLevel(1118), 5, 1, 'Level ~5 at ~1118 XP');
assertApprox(calculateLevel(3162), 10, 1, 'Level ~10 at ~3162 XP');
assertApprox(calculateLevel(8944), 20, 1, 'Level ~20 at ~8944 XP');
assert(calculateLevel(100000) === 100, 'Level 100 at 100,000 XP');
assert(calculateLevel(999999) === 100, 'Level capped at 100');
console.log('');

// ===== xpForLevel Tests =====
console.log('Testing xpForLevel()...');
assert(xpForLevel(1) === 0, 'Level 1 requires 0 XP');
assertApprox(xpForLevel(2), 283, 1, 'Level 2 requires ~283 XP');
assertApprox(xpForLevel(5), 1118, 10, 'Level 5 requires ~1118 XP');
assertApprox(xpForLevel(10), 3162, 10, 'Level 10 requires ~3162 XP');
assertApprox(xpForLevel(20), 8944, 10, 'Level 20 requires ~8944 XP');
assertApprox(xpForLevel(50), 35355, 50, 'Level 50 requires ~35355 XP');
assert(xpForLevel(100) === 100000, 'Level 100 requires 100,000 XP');
console.log('');

// ===== xpToNextLevel Tests =====
console.log('Testing xpToNextLevel()...');
assertApprox(xpToNextLevel(0), 283, 1, '~283 XP needed to reach level 2 from 0 XP');
assertApprox(xpToNextLevel(50), 233, 1, '~233 XP needed to reach level 2 from 50 XP');
assert(xpToNextLevel(283) > 0, 'Positive XP needed after reaching level 2');
console.log('');

// ===== levelProgress Tests =====
console.log('Testing levelProgress()...');
assert(levelProgress(0) === 0, '0% progress at 0 XP');
assertApprox(levelProgress(141), 50, 2, '~50% progress at ~141 XP (halfway to level 2)');
assertApprox(levelProgress(283), 0, 1, '0% progress at 283 XP (just reached level 2)');
assert(levelProgress(200) < 100, 'Progress less than 100% before level up');
assert(levelProgress(50) >= 0 && levelProgress(50) <= 100, 'Progress within 0-100%');
console.log('');

// ===== awardXP Tests =====
console.log('Testing awardXP()...');

// No level up
const result1 = awardXP(0, 50);
assert(result1.newXp === 50, 'Award 50 XP: newXp is 50');
assert(result1.oldLevel === 1, 'Award 50 XP: oldLevel is 1');
assert(result1.newLevel === 1, 'Award 50 XP: newLevel is 1');
assert(result1.leveledUp === false, 'Award 50 XP: no level up');
assert(result1.levelsGained === 0, 'Award 50 XP: 0 levels gained');

// Single level up
const result2 = awardXP(250, 50);
assert(result2.newXp === 300, 'Award 50 XP from 250: newXp is 300');
assert(result2.oldLevel === 1, 'Award 50 XP from 250: oldLevel is 1');
assert(result2.newLevel === 2, 'Award 50 XP from 250: newLevel is 2');
assert(result2.leveledUp === true, 'Award 50 XP from 250: leveled up');
assert(result2.levelsGained === 1, 'Award 50 XP from 250: gained 1 level');

// Multiple level ups
const result3 = awardXP(0, 3500);
assert(result3.newXp === 3500, 'Award 3500 XP: newXp is 3500');
assert(result3.oldLevel === 1, 'Award 3500 XP: oldLevel is 1');
assert(result3.newLevel >= 10, 'Award 3500 XP: newLevel is 10+');
assert(result3.leveledUp === true, 'Award 3500 XP: leveled up');
assert(result3.levelsGained > 1, 'Award 3500 XP: gained multiple levels');

// Edge case: 0 XP award
const result4 = awardXP(300, 0);
assert(result4.newXp === 300, 'Award 0 XP: newXp unchanged');
assert(result4.leveledUp === false, 'Award 0 XP: no level up');
assert(result4.levelsGained === 0, 'Award 0 XP: 0 levels gained');

console.log('');
console.log('🎉 All tests passed!');
console.log('');

// Print example XP progression table
console.log('📊 Example XP Progression:');
console.log('Level | XP Required | XP to Next');
console.log('------|-------------|------------');
for (const level of [1, 2, 5, 10, 20, 30, 50, 75, 100]) {
  const xp = xpForLevel(level);
  const toNext = level < 100 ? xpForLevel(level + 1) - xp : 0;
  console.log(`${level.toString().padStart(5)} | ${xp.toString().padStart(11)} | ${toNext.toString().padStart(10)}`);
}
