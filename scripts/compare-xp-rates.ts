/**
 * Compare XP Rates
 *
 * Shows progression with different XP/hour rates
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

console.log('📊 LEVELING PROGRESSION COMPARISON\n');
console.log('Formula: XP = 100 * (level^1.5)\n');

const XP_RATES = [10, 50, 100, 150];

// Show table header
console.log('='.repeat(110));
console.log('Level | Total XP | XP Needed |   10 XP/hr  |   50 XP/hr  |  100 XP/hr  |  150 XP/hr  | Cumulative @ 100');
console.log('      |          | from Prev |             |             |             |             |');
console.log('='.repeat(110));

const levelsToShow = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40, 50];

let cumulative100 = 0;

levelsToShow.forEach(level => {
  const totalXP = xpForLevel(level);
  const previousXP = xpForLevel(level - 1);
  const xpNeeded = totalXP - previousXP;

  const hours10 = xpNeeded / 10;
  const hours50 = xpNeeded / 50;
  const hours100 = xpNeeded / 100;
  const hours150 = xpNeeded / 150;

  if (level > 1) {
    cumulative100 += hours100;
  }

  const levelStr = level.toString().padStart(5);
  const totalXPStr = totalXP.toLocaleString().padStart(8);
  const xpNeededStr = xpNeeded.toLocaleString().padStart(9);
  const hours10Str = `${hours10.toFixed(1)}h`.padStart(11);
  const hours50Str = `${hours50.toFixed(1)}h`.padStart(11);
  const hours100Str = `${hours100.toFixed(1)}h`.padStart(11);
  const hours150Str = `${hours150.toFixed(1)}h`.padStart(11);
  const cumulativeStr = level > 1 ? `${cumulative100.toFixed(1)}h`.padStart(16) : '     -'.padStart(16);

  console.log(`${levelStr} | ${totalXPStr} | ${xpNeededStr} | ${hours10Str} | ${hours50Str} | ${hours100Str} | ${hours150Str} | ${cumulativeStr}`);
});

console.log('='.repeat(110));

console.log('\n🎯 WHAT LEVEL ARE CURRENT USERS @ 100 XP/HOUR?\n');

// From our leaderboard data
const users = [
  { name: 'navneethdg', hours: 20.91 },
  { name: 'stogie01', hours: 18.57 },
  { name: 'hgram', hours: 12.95 },
  { name: 'theofficialdonaldtrump', hours: 11.11 },
  { name: 'punkquant', hours: 11.94 },
  { name: 'zorblin', hours: 9.69 },
  { name: 'noah5189', hours: 8.69 },
  { name: 'hydrachaze', hours: 8.39 },
];

users.forEach(user => {
  const xp = user.hours * 100; // 100 XP/hour
  const level = calculateLevel(xp);
  const nextLevelXP = xpForLevel(level + 1);
  const hoursToNextLevel = (nextLevelXP - xp) / 100;
  const progress = ((xp - xpForLevel(level)) / (nextLevelXP - xpForLevel(level))) * 100;
  console.log(`${user.name.padEnd(25)} Level ${level.toString().padStart(2)} (${progress.toFixed(0)}% to Level ${level + 1}, ${hoursToNextLevel.toFixed(1)}h needed)`);
});

console.log('\n📊 KEY MILESTONES @ 100 XP/HOUR:\n');

const milestones = [2, 5, 10, 20, 30, 50];
milestones.forEach(level => {
  const totalHours = xpForLevel(level) / 100;
  console.log(`Level ${level.toString().padStart(2)}: ${totalHours.toFixed(1)} hours total`);
});

console.log('\n💡 RECOMMENDATION:\n');
console.log('With 100 XP/hour:');
console.log('  ✅ Level 2 in 2.8 hours (doable in a weekend)');
console.log('  ✅ Level 5 in 11.2 hours (achievable in a week)');
console.log('  ✅ Level 10 in 31.6 hours (1 month of regular use)');
console.log('  ✅ Level 20 in 89.4 hours (committed users)');
console.log('  ✅ Top users currently at Level 7-8 (shows progression!)');
