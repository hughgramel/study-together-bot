import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  CommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  EmbedBuilder,
} from 'discord.js';
import * as admin from 'firebase-admin';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SessionService } from './services/sessions';
import { StatsService } from './services/stats';
import { ServerConfig } from './types';
import {
  formatDuration,
  calculateDuration,
  isSameDay,
  isYesterday,
} from './utils/formatters';

// Load environment variables
dotenv.config();

// Initialize Firebase
let serviceAccount: admin.ServiceAccount;

// Check if running in production with environment variable
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Local development - load from file
  const serviceAccountPath = path.join(
    __dirname,
    '../firebase-service-account.json'
  );
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db: Firestore = admin.firestore();
const sessionService = new SessionService(db);
const statsService = new StatsService(db);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Test if bot is responsive'),

  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start a new productivity session')
    .addStringOption((option) =>
      option
        .setName('activity')
        .setDescription('What you are working on')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('end')
    .setDescription('Complete your active session')
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Session title')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('What you accomplished')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause your active session'),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume your paused session'),

  new SlashCommandBuilder()
    .setName('time')
    .setDescription('Check your current session status'),

  new SlashCommandBuilder()
    .setName('cancel')
    .setDescription('Cancel your active session without saving'),

  new SlashCommandBuilder()
    .setName('mystats')
    .setDescription('View your productivity statistics')
    .addStringOption((option) =>
      option
        .setName('timeframe')
        .setDescription('Time period to view')
        .setRequired(false)
        .addChoices(
          { name: 'Today', value: 'today' },
          { name: 'This Week', value: 'week' },
          { name: 'This Month', value: 'month' },
          { name: 'All Time', value: 'all-time' }
        )
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View your position across different timeframes'),

  new SlashCommandBuilder()
    .setName('d')
    .setDescription('View daily leaderboard (top 10)'),

  new SlashCommandBuilder()
    .setName('w')
    .setDescription('View weekly leaderboard (top 10)'),

  new SlashCommandBuilder()
    .setName('m')
    .setDescription('View monthly leaderboard (top 10)'),

  new SlashCommandBuilder()
    .setName('setup-feed')
    .setDescription('Configure the feed channel for completed sessions (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to post completed sessions')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((command) => command.toJSON());

// Register commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(
    process.env.DISCORD_BOT_TOKEN!
  );

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commands,
    });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Helper function to format timestamp for display
function formatTimestamp(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const month = months[date.getMonth()];
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  // Check if today
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${displayHours}:${minutes} ${ampm}`;
  }

  // Check if yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${displayHours}:${minutes} ${ampm}`;
  }

  // Otherwise show full date
  return `${month} ${day} at ${displayHours}:${minutes} ${ampm}`;
}

// Helper function to get server config
async function getServerConfig(serverId: string): Promise<ServerConfig | null> {
  const doc = await db
    .collection('discord-data')
    .doc('serverConfig')
    .collection('configs')
    .doc(serverId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as ServerConfig;
}

// Helper function to post session start to feed channel
async function postSessionStartToFeed(
  interaction: CommandInteraction,
  username: string,
  userId: string,
  avatarUrl: string,
  activity: string
) {
  try {
    const config = await getServerConfig(interaction.guildId!);

    if (!config || !config.feedChannelId) {
      // No feed channel configured - skip posting
      return;
    }

    const channel = await client.channels.fetch(config.feedChannelId);

    if (!channel || !channel.isTextBased()) {
      console.error('Feed channel not found or not text-based');
      return;
    }

    // Create embed for session start
    const embed = new EmbedBuilder()
      .setColor(0x00FF00) // Green for "live"
      .setAuthor({
        name: `${username} 🟢`,
        iconURL: avatarUrl
      })
      .setDescription(`**@${username}** is live now working on **${activity}**!`);

    await (channel as TextChannel).send({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error posting session start to feed:', error);
    // Don't throw - we don't want to fail the session start
  }
}

// Helper function to post to feed channel
async function postToFeed(
  interaction: CommandInteraction,
  username: string,
  userId: string,
  avatarUrl: string,
  activity: string,
  title: string,
  description: string,
  duration: number,
  endTime: Timestamp
) {
  try {
    const config = await getServerConfig(interaction.guildId!);

    if (!config || !config.feedChannelId) {
      // No feed channel configured - skip posting
      return;
    }

    const channel = await client.channels.fetch(config.feedChannelId);

    if (!channel || !channel.isTextBased()) {
      console.error('Feed channel not found or not text-based');
      return;
    }

    const durationStr = formatDuration(duration);

    // Create the Strava-like embed
    const embed = new EmbedBuilder()
      .setColor(0x0080FF) // Electric blue
      .setAuthor({
        name: username,
        iconURL: avatarUrl
      })
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: '⏱️ Time', value: durationStr, inline: true },
        { name: '🎯 Activity', value: activity, inline: true }
      );

    const message = await (channel as TextChannel).send({
      embeds: [embed]
    });

    // React with a heart
    await message.react('❤️');

    // Create a thread on the message
    const thread = await message.startThread({
      name: `Comments - ${username}`,
      autoArchiveDuration: 1440, // Archive after 24 hours of inactivity
      reason: 'Session comments thread',
    });

    // Post the initial comment message
    await thread.send('💬 Comments');
  } catch (error) {
    console.error('Error posting to feed:', error);
    // Don't throw - we don't want to fail the session completion
  }
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, guildId } = interaction;

  try {
    // /ping command
    if (commandName === 'ping') {
      await interaction.reply({ content: 'Pong! 🏓', ephemeral: true });
      return;
    }

    // /start command
    if (commandName === 'start') {
      const activity = interaction.options.getString('activity', true);

      // Check if user already has an active session
      const existingSession = await sessionService.getActiveSession(user.id);

      if (existingSession) {
        await interaction.reply({
          content:
            'You already have an active session! Use /end to complete it first.',
          ephemeral: true,
        });
        return;
      }

      // Create new session
      await sessionService.createActiveSession(
        user.id,
        user.username,
        guildId!,
        activity
      );

      await interaction.reply({
        content: `🚀 You're live! Your session is now active.\n\n**Working on:** ${activity}\n\nUse /time to check progress, /pause to take a break, or /end when done.`,
        ephemeral: true,
      });

      // Get user's avatar URL and post to feed
      const avatarUrl = user.displayAvatarURL({ size: 128 });
      await postSessionStartToFeed(
        interaction,
        user.username,
        user.id,
        avatarUrl,
        activity
      );

      return;
    }

    // /time command
    if (commandName === 'time') {
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content:
            'No active session. Use /start {activity} to begin tracking!',
          ephemeral: true,
        });
        return;
      }

      const elapsed = calculateDuration(
        session.startTime,
        session.pausedDuration,
        session.isPaused ? session.pausedAt : undefined
      );

      const elapsedStr = formatDuration(elapsed);
      const pauseStatus = session.isPaused ? '⏸️ Paused' : '▶️ Active';

      await interaction.reply({
        content: `**Current Session**

**Status:** ${pauseStatus}
**Activity:** ${session.activity}
**Elapsed Time:** ${elapsedStr}

**Available Actions:**
${session.isPaused ? '• /resume - Continue session' : '• /pause - Take a break'}
• /end - Complete and share
• /cancel - Discard session`,
        ephemeral: true,
      });
      return;
    }

    // /pause command
    if (commandName === 'pause') {
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session to pause.',
          ephemeral: true,
        });
        return;
      }

      if (session.isPaused) {
        await interaction.reply({
          content: 'Session is already paused.',
          ephemeral: true,
        });
        return;
      }

      await sessionService.updateActiveSession(user.id, {
        isPaused: true,
        pausedAt: Timestamp.now(),
      });

      await interaction.reply({
        content: '⏸️ Session paused. Use /resume when ready to continue.',
        ephemeral: true,
      });
      return;
    }

    // /resume command
    if (commandName === 'resume') {
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session to resume.',
          ephemeral: true,
        });
        return;
      }

      if (!session.isPaused) {
        await interaction.reply({
          content: 'Session is not paused.',
          ephemeral: true,
        });
        return;
      }

      // Calculate pause duration
      const pauseDuration =
        (Date.now() - session.pausedAt!.toMillis()) / 1000;
      const newPausedDuration = session.pausedDuration + pauseDuration;

      await sessionService.updateActiveSession(user.id, {
        isPaused: false,
        pausedAt: null as any, // Remove pausedAt field
        pausedDuration: newPausedDuration,
      });

      const elapsed = calculateDuration(
        session.startTime,
        newPausedDuration,
        undefined
      );
      const elapsedStr = formatDuration(elapsed);

      await interaction.reply({
        content: `▶️ Session resumed!\n\n**Elapsed Time:** ${elapsedStr}`,
        ephemeral: true,
      });
      return;
    }

    // /cancel command
    if (commandName === 'cancel') {
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session to cancel.',
          ephemeral: true,
        });
        return;
      }

      await sessionService.deleteActiveSession(user.id);

      await interaction.reply({
        content:
          '❌ Session cancelled. No stats were updated and nothing was posted to the feed.',
        ephemeral: true,
      });
      return;
    }

    // /end command
    if (commandName === 'end') {
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session found! Use /start first.',
          ephemeral: true,
        });
        return;
      }

      // Calculate final duration
      const duration = calculateDuration(
        session.startTime,
        session.pausedDuration,
        session.isPaused ? session.pausedAt : undefined
      );

      const endTime = Timestamp.now();

      // Create completed session
      await sessionService.createCompletedSession({
        userId: user.id,
        username: user.username,
        serverId: guildId!,
        activity: session.activity,
        title,
        description,
        duration,
        startTime: session.startTime,
        endTime,
      });

      // Update stats
      await statsService.updateUserStats(user.id, user.username, duration);

      // Delete active session
      await sessionService.deleteActiveSession(user.id);

      const durationStr = formatDuration(duration);

      await interaction.reply({
        content: `✅ Session completed! (${durationStr})\n\nYour session has been saved and posted to the feed.`,
        ephemeral: true,
      });

      // Get user's avatar URL
      const avatarUrl = user.displayAvatarURL({ size: 128 });

      // Post to feed channel
      await postToFeed(
        interaction,
        user.username,
        user.id,
        avatarUrl,
        session.activity,
        title,
        description,
        duration,
        endTime
      );

      return;
    }

    // /mystats command
    if (commandName === 'mystats') {
      const stats = await statsService.getUserStats(user.id);

      if (!stats) {
        await interaction.reply({
          content:
            'No stats yet! Complete your first session with /start and /end.',
          ephemeral: true,
        });
        return;
      }

      const now = new Date();

      // Calculate stats for each timeframe
      const today = new Date(now);
      today.setUTCHours(0, 0, 0, 0);
      const todaySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(today)
      );

      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(weekAgo)
      );

      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthlySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(monthAgo)
      );

      const allSessions = await sessionService.getCompletedSessions(user.id);

      // Calculate durations in hours
      const dailyHours = todaySessions.reduce((sum, s) => sum + s.duration, 0) / 3600;
      const weeklyHours = weeklySessions.reduce((sum, s) => sum + s.duration, 0) / 3600;
      const monthlyHours = monthlySessions.reduce((sum, s) => sum + s.duration, 0) / 3600;
      const allTimeHours = allSessions.reduce((sum, s) => sum + s.duration, 0) / 3600;

      // Get user ranking
      const ranking = await statsService.getUserRanking(user.id);
      const rankText = ranking ? `#${ranking.rank}` : '#-';

      // Calculate average per day for current month
      const monthName = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'][now.getMonth()];
      const currentDay = now.getDate();
      const avgPerDay = currentDay > 0 ? (monthlyHours / Math.min(currentDay, 30)) : 0;

      // Format hours with 1 decimal place
      const formatHours = (hours: number) => hours.toFixed(1) + 'h';

      // Create fire emojis based on streak length
      const getStreakEmojis = (streak: number): string => {
        if (streak >= 30) return '🔥🔥🔥';
        if (streak >= 7) return '🔥🔥';
        if (streak >= 3) return '🔥';
        return '';
      };

      const currentStreakEmojis = getStreakEmojis(stats.currentStreak);
      const longestStreakEmojis = getStreakEmojis(stats.longestStreak);

      // Create embed with separate fields for better formatting
      const avatarUrl = user.displayAvatarURL({ size: 128 });

      const embed = new EmbedBuilder()
        .setColor(0x0080FF)
        .setTitle('📊 Personal Study Statistics')
        .addFields(
          { name: '📅 Timeframe', value: '**Daily**\n**Weekly**\n**Monthly**\n**All-time**', inline: true },
          { name: '⏱️ Hours', value: `${formatHours(dailyHours)}\n${formatHours(weeklyHours)}\n${formatHours(monthlyHours)}\n${formatHours(allTimeHours)}`, inline: true },
          { name: '🏆 Place', value: `${rankText}\n${rankText}\n${rankText}\n${rankText}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '📈 Average/day (' + monthName + ')', value: `**${avgPerDay.toFixed(1)} h**`, inline: true },
          { name: '🔥 Current Streak', value: `**${stats.currentStreak}** days ${currentStreakEmojis}`, inline: true },
          { name: '💪 Longest Streak', value: `**${stats.longestStreak}** days ${longestStreakEmojis}`, inline: true }
        )
        .setFooter({
          text: user.username,
          iconURL: avatarUrl
        });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
      return;
    }

    // TEMPORARY: Generate fake data for debugging
    const generateFakeUsers = (count: number) => {
      const users = [];
      for (let i = 0; i < count; i++) {
        users.push({
          userId: i === 13 ? user.id : `fake_user_${i}`, // Put current user at position 14 (index 13)
          username: i === 13 ? user.username : `User${i + 1}`,
          totalDuration: (count - i) * 3600 + Math.random() * 1000, // Decreasing hours
          sessionCount: Math.floor(Math.random() * 20) + 1,
        });
      }
      return users;
    };

    // /d command - Daily leaderboard with columns
    if (commandName === 'd') {
      await interaction.deferReply({ ephemeral: true });

      const dailyAll = generateFakeUsers(20);
      const dailyTop = dailyAll.slice(0, 10);

      const ranks: string[] = [];
      const names: string[] = [];
      const hours: string[] = [];

      dailyTop.forEach((u, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        ranks.push(medal);
        names.push(`**${u.username}**`);
        hours.push(`${(u.totalDuration / 3600).toFixed(1)}h`);
      });

      // Add current user if not in top 10
      const userPosition = dailyAll.findIndex(u => u.userId === user.id);
      if (userPosition >= 10) {
        const currentUser = dailyAll[userPosition];
        ranks.push(`**#${userPosition + 1}**`);
        names.push(`**${currentUser.username}**`);
        hours.push(`**${(currentUser.totalDuration / 3600).toFixed(1)}h**`);
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 Daily Leaderboard')
        .addFields(
          { name: 'Rank', value: ranks.join('\n'), inline: true },
          { name: 'Name', value: names.join('\n'), inline: true },
          { name: 'Hours', value: hours.join('\n'), inline: true }
        )
        .setFooter({ text: 'Keep grinding to make it to the top! 💪' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // /w command - Weekly leaderboard with columns
    if (commandName === 'w') {
      await interaction.deferReply({ ephemeral: true });

      const weeklyAll = generateFakeUsers(20);
      const weeklyTop = weeklyAll.slice(0, 10);

      const ranks: string[] = [];
      const names: string[] = [];
      const hours: string[] = [];

      weeklyTop.forEach((u, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        ranks.push(medal);
        names.push(`**${u.username}**`);
        hours.push(`${(u.totalDuration / 3600).toFixed(1)}h`);
      });

      // Add current user if not in top 10
      const userPosition = weeklyAll.findIndex(u => u.userId === user.id);
      if (userPosition >= 10) {
        const currentUser = weeklyAll[userPosition];
        ranks.push(`**#${userPosition + 1}**`);
        names.push(`**${currentUser.username}**`);
        hours.push(`**${(currentUser.totalDuration / 3600).toFixed(1)}h**`);
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 Weekly Leaderboard')
        .addFields(
          { name: 'Rank', value: ranks.join('\n'), inline: true },
          { name: 'Name', value: names.join('\n'), inline: true },
          { name: 'Hours', value: hours.join('\n'), inline: true }
        )
        .setFooter({ text: 'Keep grinding to make it to the top! 💪' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // /m command - Monthly leaderboard with columns
    if (commandName === 'm') {
      await interaction.deferReply({ ephemeral: true });

      const monthlyAll = generateFakeUsers(20);
      const monthlyTop = monthlyAll.slice(0, 10);

      const ranks: string[] = [];
      const names: string[] = [];
      const hours: string[] = [];

      monthlyTop.forEach((u, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        ranks.push(medal);
        names.push(`**${u.username}**`);
        hours.push(`${(u.totalDuration / 3600).toFixed(1)}h`);
      });

      // Add current user if not in top 10
      const userPosition = monthlyAll.findIndex(u => u.userId === user.id);
      if (userPosition >= 10) {
        const currentUser = monthlyAll[userPosition];
        ranks.push(`**#${userPosition + 1}**`);
        names.push(`**${currentUser.username}**`);
        hours.push(`**${(currentUser.totalDuration / 3600).toFixed(1)}h**`);
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 Monthly Leaderboard')
        .addFields(
          { name: 'Rank', value: ranks.join('\n'), inline: true },
          { name: 'Name', value: names.join('\n'), inline: true },
          { name: 'Hours', value: hours.join('\n'), inline: true }
        )
        .setFooter({ text: 'Keep grinding to make it to the top! 💪' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // /leaderboard command - Show top 3 + user position
    if (commandName === 'leaderboard') {
      await interaction.deferReply({ ephemeral: true });

      const dailyAll = generateFakeUsers(20);
      const weeklyAll = generateFakeUsers(20);
      const monthlyAll = generateFakeUsers(20);

      // Helper to format top 3 + user position
      const formatLeaderboard = (allUsers: Array<{ userId: string; username: string; totalDuration: number }>, emoji: string, label: string) => {
        if (allUsers.length === 0) return `${emoji} **${label}**\nNo data yet`;

        const lines: string[] = [];
        const userPosition = allUsers.findIndex(u => u.userId === user.id);

        // Add top 3
        for (let i = 0; i < Math.min(3, allUsers.length); i++) {
          const u = allUsers[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          lines.push(`${medal} **${u.username}** - ${(u.totalDuration / 3600).toFixed(1)}h`);
        }

        // Add current user if not in top 3
        if (userPosition > 2) {
          const current = allUsers[userPosition];
          lines.push(`**${userPosition + 1}. ${current.username} - ${(current.totalDuration / 3600).toFixed(1)}h**`);
        }

        return `${emoji} **${label}**\n${lines.join('\n')}`;
      };

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 Your Leaderboard Position')
        .addFields(
          { name: '\u200B', value: formatLeaderboard(dailyAll, '📅', 'Daily'), inline: false },
          { name: '\u200B', value: formatLeaderboard(weeklyAll, '📊', 'Weekly'), inline: false },
          { name: '\u200B', value: formatLeaderboard(monthlyAll, '🌟', 'Monthly'), inline: false }
        )
        .setFooter({ text: 'Use /d, /w, or /m to see full daily, weekly, or monthly leaderboard' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // /setup-feed command
    if (commandName === 'setup-feed') {
      const channel = interaction.options.getChannel('channel', true);

      // Check if user has admin permission
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: 'Only server administrators can set up the feed channel.',
          ephemeral: true,
        });
        return;
      }

      // Save config
      const config: ServerConfig = {
        feedChannelId: channel.id,
        setupAt: Timestamp.now(),
        setupBy: user.id,
      };

      await db
        .collection('discord-data')
        .doc('serverConfig')
        .collection('configs')
        .doc(guildId!)
        .set(config);

      await interaction.reply({
        content: `✅ Feed channel set to <#${channel.id}>\n\nCompleted sessions will now be posted there automatically.`,
        ephemeral: true,
      });
      return;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);

    const errorMessage =
      'An error occurred while processing your command. Please try again.';

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (replyError) {
      // Interaction may have expired - just log the error and continue
      console.error('Could not send error message to user:', replyError);
    }
  }
});

// Bot ready event
client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user?.tag}`);
});

// Start bot
async function start() {
  await registerCommands();
  await client.login(process.env.DISCORD_BOT_TOKEN);
}

start().catch(console.error);
