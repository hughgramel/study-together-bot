/**
 * Analyze Leveling System
 *
 * Shows progression metrics for the current leveling formula
 */

// Current formula: XP = 100 * (level^1.5)
function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level, 1.5));
}

function calculateLevel(xp: number): number {
  if (xp < 283) return 1;
  const level = Math.round(Math.pow(xp / 100, 2 / 3));
  return Math.max(1, Math.min(100, level));
}

// XP per hour (base rate, no bonuses)
const XP_PER_HOUR = 10;

console.log('📊 LEVELING SYSTEM ANALYSIS\n');
console.log('Current Formula: XP = 100 * (level^1.5)');
console.log(`Base XP Rate: ${XP_PER_HOUR} XP/hour\n`);

console.log('=' .repeat(95));
console.log('Level | Total XP | XP Needed | Hours to Level | Cumulative Hours | Hours/Level Ratio');
console.log('=' .repeat(95));

let cumulativeHours = 0;

const levelsToShow = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

levelsToShow.forEach(level => {
  const totalXP = xpForLevel(level);
  const previousXP = xpForLevel(level - 1);
  const xpNeeded = totalXP - previousXP;
  const hoursToLevel = xpNeeded / XP_PER_HOUR;

  if (level > 1) {
    cumulativeHours += hoursToLevel;
  }

  const hoursPerLevelRatio = cumulativeHours / (level - 1);

  const levelStr = level.toString().padStart(5);
  const totalXPStr = totalXP.toLocaleString().padStart(8);
  const xpNeededStr = xpNeeded.toLocaleString().padStart(9);
  const hoursToLevelStr = hoursToLevel.toFixed(1).padStart(14);
  const cumulativeStr = cumulativeHours.toFixed(1).padStart(16);
  const ratioStr = level > 1 ? hoursPerLevelRatio.toFixed(1).padStart(17) : '    -'.padStart(17);

  console.log(`${levelStr} | ${totalXPStr} | ${xpNeededStr} | ${hoursToLevelStr} | ${cumulativeStr} | ${ratioStr}`);
});

console.log('=' .repeat(95));

console.log('\n📈 KEY METRICS:\n');

// Early game (levels 1-5)
const earlyGameHours = (xpForLevel(5) - xpForLevel(1)) / XP_PER_HOUR;
console.log(`Early Game (Level 1→5):  ${earlyGameHours.toFixed(1)} hours`);

// Mid game (levels 5-20)
const midGameHours = (xpForLevel(20) - xpForLevel(5)) / XP_PER_HOUR;
console.log(`Mid Game (Level 5→20):   ${midGameHours.toFixed(1)} hours`);

// Late game (levels 20-50)
const lateGameHours = (xpForLevel(50) - xpForLevel(20)) / XP_PER_HOUR;
console.log(`Late Game (Level 20→50): ${lateGameHours.toFixed(1)} hours`);

// Endgame (levels 50-100)
const endGameHours = (xpForLevel(100) - xpForLevel(50)) / XP_PER_HOUR;
console.log(`End Game (Level 50→100): ${endGameHours.toFixed(1)} hours`);

console.log('\n⏱️  PROGRESSION RATE (hours per level):\n');

const levels = [1, 2, 5, 10, 20, 50];
levels.forEach(level => {
  const xpNeeded = xpForLevel(level + 1) - xpForLevel(level);
  const hours = xpNeeded / XP_PER_HOUR;
  console.log(`Level ${level}→${level + 1}: ${hours.toFixed(1)} hours/level`);
});

console.log('\n🎯 WHAT LEVEL ARE CURRENT USERS?\n');

// From our leaderboard data
const users = [
  { name: 'navneethdg', hours: 20.91 },
  { name: 'stogie01', hours: 18.57 },
  { name: 'hgram', hours: 12.95 },
  { name: 'theofficialdonaldtrump', hours: 11.11 },
  { name: 'punkquant', hours: 11.94 },
];

users.forEach(user => {
  const xp = user.hours * XP_PER_HOUR;
  const level = calculateLevel(xp);
  const nextLevelXP = xpForLevel(level + 1);
  const hoursToNextLevel = (nextLevelXP - xp) / XP_PER_HOUR;
  console.log(`${user.name.padEnd(25)} Level ${level} (${hoursToNextLevel.toFixed(1)}h to Level ${level + 1})`);
});

console.log('\n💡 ANALYSIS:\n');

const level1to2 = (xpForLevel(2) - xpForLevel(1)) / XP_PER_HOUR;
const level10to11 = (xpForLevel(11) - xpForLevel(10)) / XP_PER_HOUR;
const level50to51 = (xpForLevel(51) - xpForLevel(50)) / XP_PER_HOUR;

const ratio10to1 = level10to11 / level1to2;
const ratio50to1 = level50to51 / level1to2;

console.log(`Level 1→2 takes ${level1to2.toFixed(1)} hours`);
console.log(`Level 10→11 takes ${level10to11.toFixed(1)} hours (${ratio10to1.toFixed(1)}x slower)`);
console.log(`Level 50→51 takes ${level50to51.toFixed(1)} hours (${ratio50to1.toFixed(1)}x slower)`);
console.log(`\nCurrent top user (20.9h) is only Level 2`);
console.log(`Getting to Level 10 requires ${(xpForLevel(10) / XP_PER_HOUR).toFixed(1)} hours`);
console.log(`Getting to Level 20 requires ${(xpForLevel(20) / XP_PER_HOUR).toFixed(1)} hours`);
