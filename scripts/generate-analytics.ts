import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let serviceAccount: admin.ServiceAccount;

// Check if running in production with environment variable
if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 0) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Loaded Firebase credentials from environment variable');
  } catch (error) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', error);
    process.exit(1);
  }
} else {
  // Local development - load from file
  const serviceAccountPath = path.join(
    __dirname,
    '../firebase-service-account.json'
  );

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Firebase service account file not found and FIREBASE_SERVICE_ACCOUNT env var not set');
    console.error('Please set FIREBASE_SERVICE_ACCOUNT environment variable or provide firebase-service-account.json');
    process.exit(1);
  }

  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log('✅ Loaded Firebase credentials from local file');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

interface SessionData {
  userId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  duration: number;
}

interface DailyData {
  date: string;
  newUsers: number;
  cumulativeUsers: number;
  sessions: number;
  hours: number;
  uniquePosters: number;
  posts: number;
}

// Convert UTC timestamp to Pacific Time date string (YYYY-MM-DD)
function toPacificDateString(date: Date): string {
  // Convert to Pacific Time (UTC-8 or UTC-7 depending on DST)
  const pacificDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const year = pacificDate.getFullYear();
  const month = String(pacificDate.getMonth() + 1).padStart(2, '0');
  const day = String(pacificDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function generateAnalytics() {
  console.log('📊 Generating analytics...\n');

  // Fetch all completed sessions
  const sessionsSnapshot = await db
    .collection('discord-data')
    .doc('sessions')
    .collection('completed')
    .orderBy('startTime', 'asc')
    .get();

  // Fetch all posts
  const postsSnapshot = await db
    .collection('discord-data')
    .doc('sessionPosts')
    .collection('posts')
    .orderBy('postedAt', 'asc')
    .get();

  console.log(`Fetched ${sessionsSnapshot.size} sessions and ${postsSnapshot.size} posts`);

  // Process sessions by day
  const dailyUsersSet = new Map<string, Set<string>>();
  const dailyMetrics = new Map<string, { sessions: number; hours: number }>();

  sessionsSnapshot.forEach((doc) => {
    const session = doc.data() as SessionData;
    const date = session.startTime.toDate();
    const dateKey = toPacificDateString(date);

    if (!dailyUsersSet.has(dateKey)) {
      dailyUsersSet.set(dateKey, new Set());
      dailyMetrics.set(dateKey, { sessions: 0, hours: 0 });
    }

    dailyUsersSet.get(dateKey)!.add(session.userId);
    const metrics = dailyMetrics.get(dateKey)!;
    metrics.sessions++;
    metrics.hours += session.duration / 3600;
  });

  // Process posts by day
  const dailyPosters = new Map<string, Set<string>>();
  const dailyPostCounts = new Map<string, number>();

  postsSnapshot.forEach((doc) => {
    const post = doc.data();
    const date = post.postedAt.toDate();
    const dateKey = toPacificDateString(date);

    if (!dailyPosters.has(dateKey)) {
      dailyPosters.set(dateKey, new Set());
      dailyPostCounts.set(dateKey, 0);
    }

    dailyPosters.get(dateKey)!.add(post.userId);
    dailyPostCounts.set(dateKey, (dailyPostCounts.get(dateKey) || 0) + 1);
  });

  // Build daily data array
  const allDates = new Set([...dailyUsersSet.keys(), ...dailyPosters.keys()]);
  const sortedDates = Array.from(allDates).sort();

  const dailyData: DailyData[] = [];
  let cumulativeUsers = new Set<string>();

  sortedDates.forEach((date) => {
    const previousCount = cumulativeUsers.size;
    const dayUsers = dailyUsersSet.get(date) || new Set();
    dayUsers.forEach(user => cumulativeUsers.add(user));
    const newUsers = cumulativeUsers.size - previousCount;

    const metrics = dailyMetrics.get(date) || { sessions: 0, hours: 0 };
    const posters = dailyPosters.get(date) || new Set();
    const posts = dailyPostCounts.get(date) || 0;

    dailyData.push({
      date,
      newUsers,
      cumulativeUsers: cumulativeUsers.size,
      sessions: metrics.sessions,
      hours: parseFloat(metrics.hours.toFixed(1)),
      uniquePosters: posters.size,
      posts,
    });
  });

  // Generate Markdown Report
  await generateMarkdownReport(dailyData);

  // Generate ASCII charts
  await generateAsciiCharts(dailyData);

  console.log('\n✅ Analytics generated successfully!');
  console.log('📁 Files created in /analytics folder:');
  console.log('   - growth-report.md (markdown table and summary)');
  console.log('   - charts.md (ASCII charts)');
}

async function generateMarkdownReport(dailyData: DailyData[]) {
  const analyticsDir = path.join(__dirname, '../analytics');

  if (!fs.existsSync(analyticsDir)) {
    fs.mkdirSync(analyticsDir, { recursive: true });
  }

  const now = new Date().toISOString().split('T')[0];
  const reportPath = path.join(analyticsDir, 'growth-report.md');

  let markdown = `# Discord Bot Growth Analytics\n\n`;
  markdown += `**Report Generated:** ${now} (Pacific Time)\n\n`;
  markdown += `_All dates and times are in Pacific Time (America/Los_Angeles)_\n\n`;

  // Summary Statistics
  const totalUsers = dailyData[dailyData.length - 1]?.cumulativeUsers || 0;
  const totalSessions = dailyData.reduce((sum, d) => sum + d.sessions, 0);
  const totalHours = dailyData.reduce((sum, d) => sum + d.hours, 0);
  const totalPosts = dailyData.reduce((sum, d) => sum + d.posts, 0);

  markdown += `## Summary\n\n`;
  markdown += `- **Total Unique Users:** ${totalUsers}\n`;
  markdown += `- **Total Sessions:** ${totalSessions}\n`;
  markdown += `- **Total Hours Logged:** ${totalHours.toFixed(1)}\n`;
  markdown += `- **Total Posts:** ${totalPosts}\n`;
  markdown += `- **Avg Sessions per User:** ${(totalSessions / totalUsers).toFixed(1)}\n`;
  markdown += `- **Avg Hours per User:** ${(totalHours / totalUsers).toFixed(1)}\n\n`;

  // Daily Data Table
  markdown += `## Daily Metrics\n\n`;
  markdown += `| Date | New Users | Cumulative Users | Sessions | Hours | Unique Posters | Posts |\n`;
  markdown += `|------|-----------|------------------|----------|-------|----------------|-------|\n`;

  dailyData.forEach((day) => {
    markdown += `| ${day.date} | ${day.newUsers} | ${day.cumulativeUsers} | ${day.sessions} | ${day.hours} | ${day.uniquePosters} | ${day.posts} |\n`;
  });

  markdown += `\n`;

  // Growth Trends
  markdown += `## Growth Trends\n\n`;

  if (dailyData.length >= 2) {
    const firstDay = dailyData[0];
    const lastDay = dailyData[dailyData.length - 1];
    const daysDiff = dailyData.length;

    markdown += `- **Date Range:** ${firstDay.date} to ${lastDay.date} (${daysDiff} days)\n`;
    markdown += `- **User Growth Rate:** ${((lastDay.cumulativeUsers / daysDiff)).toFixed(1)} users/day\n`;
    markdown += `- **Avg Sessions/Day:** ${(totalSessions / daysDiff).toFixed(1)}\n`;
    markdown += `- **Avg Hours/Day:** ${(totalHours / daysDiff).toFixed(1)}\n`;

    // Peak day for sessions
    const peakSessionDay = dailyData.reduce((max, day) => day.sessions > max.sessions ? day : max);
    markdown += `- **Peak Activity Day:** ${peakSessionDay.date} (${peakSessionDay.sessions} sessions, ${peakSessionDay.hours} hours)\n`;
  }

  fs.writeFileSync(reportPath, markdown);
  console.log(`✅ Generated: ${reportPath}`);
}

async function generateAsciiCharts(dailyData: DailyData[]) {
  const analyticsDir = path.join(__dirname, '../analytics');
  const chartsPath = path.join(analyticsDir, 'charts.md');

  let markdown = `# Growth Charts\n\n`;
  markdown += `**Generated:** ${new Date().toISOString().split('T')[0]} (Pacific Time)\n\n`;
  markdown += `_All dates are in Pacific Time (America/Los_Angeles)_\n\n`;

  // Chart 1: Cumulative Users
  markdown += `## Cumulative Users Over Time\n\n\`\`\`\n`;
  markdown += generateBarChart(
    dailyData.map(d => d.date.slice(5)), // MM-DD format
    dailyData.map(d => d.cumulativeUsers),
    'Users',
    40
  );
  markdown += `\n\`\`\`\n\n`;

  // Chart 2: Daily Sessions
  markdown += `## Daily Sessions\n\n\`\`\`\n`;
  markdown += generateBarChart(
    dailyData.map(d => d.date.slice(5)),
    dailyData.map(d => d.sessions),
    'Sessions',
    40
  );
  markdown += `\n\`\`\`\n\n`;

  // Chart 3: Daily Hours
  markdown += `## Daily Hours Logged\n\n\`\`\`\n`;
  markdown += generateBarChart(
    dailyData.map(d => d.date.slice(5)),
    dailyData.map(d => d.hours),
    'Hours',
    40,
    1
  );
  markdown += `\n\`\`\`\n\n`;

  // Chart 4: New Users Per Day
  markdown += `## New Users Per Day\n\n\`\`\`\n`;
  markdown += generateBarChart(
    dailyData.map(d => d.date.slice(5)),
    dailyData.map(d => d.newUsers),
    'New Users',
    40
  );
  markdown += `\n\`\`\`\n\n`;

  fs.writeFileSync(chartsPath, markdown);
  console.log(`✅ Generated: ${chartsPath}`);
}

function generateBarChart(
  labels: string[],
  values: number[],
  unit: string,
  maxWidth: number = 40,
  decimals: number = 0
): string {
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  let chart = '';

  labels.forEach((label, i) => {
    const value = values[i];
    const barLength = maxValue > 0 ? Math.round((value / maxValue) * maxWidth) : 0;
    const bar = '█'.repeat(barLength);
    const valueStr = decimals > 0 ? value.toFixed(decimals) : value.toString();
    chart += `${label.padEnd(6)} │ ${bar} ${valueStr}\n`;
  });

  return chart;
}

// Run the script
generateAnalytics()
  .then(() => {
    console.log('\n👋 Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
