import { groupOverviewImageService } from './src/services/groupOverviewImage';
import fs from 'fs';
import path from 'path';

async function testGroupLeaderboard() {
  console.log('Generating group leaderboard image...');

  // Sample data for testing
  const sampleGroups = [
    {
      rank: 1,
      groupName: 'Study Warriors',
      groupId: 'STUDY001',
      currentMembers: 6,
      maxMembers: 6,
      groupLevel: 42,
    },
    {
      rank: 2,
      groupName: 'Code Crushers',
      groupId: 'CODE789',
      currentMembers: 5,
      maxMembers: 6,
      groupLevel: 38,
    },
    {
      rank: 3,
      groupName: 'Math Masters',
      groupId: 'MATH456',
      currentMembers: 4,
      maxMembers: 6,
      groupLevel: 35,
    },
    {
      rank: 4,
      groupName: 'Focus Squad',
      groupId: 'FOCUS123',
      currentMembers: 6,
      maxMembers: 6,
      groupLevel: 28,
    },
    {
      rank: 5,
      groupName: 'Deep Work Crew',
      groupId: 'DEEP999',
      currentMembers: 3,
      maxMembers: 6,
      groupLevel: 22,
    },
  ];

  try {
    const imageBuffer = await groupOverviewImageService.generateGroupLeaderboardImage(sampleGroups);

    // Save the image
    const outputPath = path.join(__dirname, 'test-group-leaderboard.png');
    fs.writeFileSync(outputPath, imageBuffer);

    console.log(`✅ Group leaderboard image saved to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error generating image:', error);
  } finally {
    await groupOverviewImageService.cleanup();
  }
}

testGroupLeaderboard();
