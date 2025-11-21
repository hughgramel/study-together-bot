import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  CommandInteraction,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  AttachmentBuilder,
} from 'discord.js';
import * as admin from 'firebase-admin';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SessionService } from './services/sessions';
import { StatsService } from './services/stats';
import { AchievementService } from './services/achievements';
import { PostService } from './services/posts';
import { DailyGoalService } from './services/dailyGoal';
import { XPService } from './services/xp';
import { EventService } from './services/events';
import { ProfileImageService } from './services/profileImage';
import { StatsImageService } from './services/statsImage';
import { StatsOverviewImageService } from './services/statsOverviewImage';
import { PostImageService } from './services/postImage';
import { levelUpImageService } from './services/levelUpImage';
import { liveNotificationImageService } from './services/liveNotificationImage';
import { sessionStartImageService } from './services/sessionStartImage';
import { streakImageService } from './services/streakImage';
import { achievementUnlockImageService } from './services/achievementUnlockImage';
import { getAchievement, getAllAchievements } from './data/achievements';
import { ServerConfig } from './types';
import {
  formatDuration,
  calculateDuration,
  isSameDay,
  isYesterday,
} from './utils/formatters';
import { calculateLevel, xpToNextLevel, levelProgress, xpForLevel } from './utils/xp';

// Extend Discord.js Client type to include statsSelections
declare module 'discord.js' {
  interface Client {
    statsSelections?: Map<string, { metric: 'hours' | 'xp' | 'sessions' | 'totalHours'; timeframe: 'week' | 'month' | 'year' }>;
  }
}

// Load environment variables
dotenv.config();

// Initialize Firebase
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

const db: Firestore = admin.firestore();
const sessionService = new SessionService(db);
const statsService = new StatsService(db);
const achievementService = new AchievementService(db);
const postService = new PostService(db);
const dailyGoalService = new DailyGoalService(db);
const xpService = new XPService(db);
const eventService = new EventService(db);
const profileImageService = new ProfileImageService();
const statsImageService = new StatsImageService();
const statsOverviewImageService = new StatsOverviewImageService();
const postImageService = new PostImageService();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
});

// Store auto-end timers for paused sessions (userId -> NodeJS.Timeout)
const autoEndTimers = new Map<string, NodeJS.Timeout>();

// Store event builder state (builderId -> event data)
interface EventBuilderState {
  userId: string;
  title?: string;
  location?: string;
  startTime?: Date;
  duration?: number;
  studyType?: 'silent' | 'conversation' | 'pomodoro' | 'custom';
  customType?: string;
  maxAttendees?: number;
  description?: string;
  timezone?: string; // Server timezone for date parsing
}
const eventBuilders = new Map<string, EventBuilderState>();

// Define slash commands
const commands = [
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
    .setName('stop')
    .setDescription('Stop your session! Add a title, description of what you did, and post it to the feed'),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause your active session'),

  new SlashCommandBuilder()
    .setName('unpause')
    .setDescription('Unpause your paused session'),

  new SlashCommandBuilder()
    .setName('time')
    .setDescription('Check your current session status'),

  new SlashCommandBuilder()
    .setName('cancel')
    .setDescription('Cancel your active session without saving'),

  new SlashCommandBuilder()
    .setName('stats')
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
    .setName('achievements')
    .setDescription('View all your unlocked achievements'),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a user\'s profile with all stats and achievements')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to view (defaults to yourself)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server leaderboards with timeframe selector')
    .addStringOption(option =>
      option
        .setName('timeframe')
        .setDescription('Leaderboard timeframe')
        .setRequired(false)
        .addChoices(
          { name: 'Daily', value: 'daily' },
          { name: 'Weekly', value: 'weekly' },
          { name: 'Monthly', value: 'monthly' },
          { name: 'All-Time', value: 'all-time' }
        )
    ),

  new SlashCommandBuilder()
    .setName('live')
    .setDescription('See who is currently studying in this server'),

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

  new SlashCommandBuilder()
    .setName('set-welcome-channel')
    .setDescription('Configure the welcome channel for new members (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send welcome messages')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setup-events-channel')
    .setDescription('Configure the events channel for study events (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to post study events')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setup-timezone')
    .setDescription('Configure the server timezone for events (Admin only)')
    .addStringOption((option) =>
      option
        .setName('timezone')
        .setDescription('IANA timezone (e.g., America/New_York, America/Los_Angeles, America/Chicago)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('manual')
    .setDescription('Log a manual session with custom duration'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands and how to use them'),

  new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Manage your goals')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new goal')
        .addStringOption(option =>
          option
            .setName('goal')
            .setDescription('Your goal (e.g., "Finish homework")')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('difficulty')
            .setDescription('Goal difficulty')
            .setRequired(true)
            .addChoices(
              { name: 'Easy (50 XP)', value: 'easy' },
              { name: 'Medium (100 XP)', value: 'medium' },
              { name: 'Hard (200 XP)', value: 'hard' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('complete')
        .setDescription('Mark a goal as complete')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('View all your goals')
    ),

  new SlashCommandBuilder()
    .setName('createevent')
    .setDescription('Create a new study event'),

  new SlashCommandBuilder()
    .setName('events')
    .setDescription('View all upcoming study events'),

  new SlashCommandBuilder()
    .setName('myevents')
    .setDescription('View events you have RSVP\'d to'),

  new SlashCommandBuilder()
    .setName('cancelevent')
    .setDescription('Cancel one of your events')
    .addStringOption(option =>
      option
        .setName('event')
        .setDescription('The event to cancel')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('me')
    .setDescription('View your profile overview'),

  new SlashCommandBuilder()
    .setName('graph')
    .setDescription('View your stats as a graph'),

  new SlashCommandBuilder()
    .setName('post')
    .setDescription('Preview what your session completion post will look like in the feed'),

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

// Helper function to get start of day in Pacific Time
function getStartOfDayPacific(): Date {
  const now = new Date();

  // Convert current time to Pacific Time
  const pacificTimeStr = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Parse the Pacific time string (MM/DD/YYYY, HH:mm:ss)
  const [datePart] = pacificTimeStr.split(', ');
  const [month, day, year] = datePart.split('/');

  // Create a date string for midnight Pacific Time
  // Use PST offset (-08:00) for winter, PDT (-07:00) for summer
  // JavaScript will handle the conversion automatically
  const pacificDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  // Determine if we're in PST or PDT by checking if DST is active
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdTimezoneOffset;

  // Create midnight Pacific Time (use -07:00 for PDT, -08:00 for PST)
  const offset = isDST ? '-07:00' : '-08:00';
  const midnightPacific = new Date(`${pacificDateStr}T00:00:00${offset}`);

  return midnightPacific;
}

// Helper function to get start of week (Sunday) in Pacific Time
function getStartOfWeekPacific(): Date {
  const now = new Date();

  // Convert current time to Pacific Time
  const pacificTimeStr = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Parse the Pacific time string
  const [datePart] = pacificTimeStr.split(', ');
  const [month, day, year] = datePart.split('/');

  // Create a date object for today in Pacific Time
  const pacificDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);

  // Get day of week (0 = Sunday, 6 = Saturday)
  const pacificDayOfWeek = new Date(pacificTimeStr).getDay();

  // Calculate days to subtract to get to Sunday
  const daysToSubtract = pacificDayOfWeek;

  // Subtract days to get to Sunday
  pacificDate.setDate(pacificDate.getDate() - daysToSubtract);

  // Determine if we're in PST or PDT
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdTimezoneOffset;

  // Create midnight Pacific Time for that Sunday
  const offset = isDST ? '-07:00' : '-08:00';
  const sundayMidnight = new Date(`${pacificDate.toISOString().split('T')[0]}T00:00:00${offset}`);

  return sundayMidnight;
}

// Helper function to get start of month in Pacific Time
function getStartOfMonthPacific(): Date {
  const now = new Date();

  // Convert current time to Pacific Time
  const pacificTimeStr = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Parse the Pacific time string
  const [datePart] = pacificTimeStr.split(', ');
  const [month, day, year] = datePart.split('/');

  // Create date string for 1st of the month
  const firstOfMonth = `${year}-${month.padStart(2, '0')}-01`;

  // Determine if we're in PST or PDT
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdTimezoneOffset;

  // Create midnight Pacific Time for the 1st of the month
  const offset = isDST ? '-07:00' : '-08:00';
  const monthStart = new Date(`${firstOfMonth}T00:00:00${offset}`);

  return monthStart;
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
  interaction: CommandInteraction | ModalSubmitInteraction,
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

    const textChannel = channel as TextChannel;

    // Check bot permissions in the channel
    const botMember = await interaction.guild?.members.fetch(client.user!.id);
    const permissions = textChannel.permissionsFor(botMember!);

    if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
      console.error(`Bot lacks 'View Channel' permission in feed channel ${config.feedChannelId}`);
      return;
    }

    if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
      console.error(`Bot lacks 'Send Messages' permission in feed channel ${config.feedChannelId}`);
      return;
    }

    // Generate the session start image
    const imageBuffer = await sessionStartImageService.generateSessionStartImage(
      username,
      avatarUrl,
      activity
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `live-${userId}.png`,
      description: `${username} is live now!`
    });

    await textChannel.send({
      files: [attachment]
    });
  } catch (error: any) {
    // Log detailed error for debugging
    if (error.code === 50001) {
      console.error(`Bot lacks access to feed channel. Please ensure the bot has 'View Channel' permission.`);
    } else if (error.code === 50013) {
      console.error(`Bot lacks permissions in feed channel. Please ensure the bot has 'Send Messages' and 'Embed Links' permissions.`);
    } else {
      console.error('Error posting session start to feed:', error);
    }
    // Don't throw - we don't want to fail the session start
  }
}

// Helper function to post to feed channel
async function postToFeed(
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  userId: string,
  avatarUrl: string,
  activity: string,
  title: string,
  description: string,
  duration: number,
  endTime: Timestamp,
  sessionId: string,
  xpGained: number,
  newLevel?: number,
  achievementsUnlocked?: string[],
  intensity?: number
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

    const textChannel = channel as TextChannel;

    // Check bot permissions in the channel
    const botMember = await interaction.guild?.members.fetch(client.user!.id);
    const permissions = textChannel.permissionsFor(botMember!);

    if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
      console.error(`Bot lacks 'View Channel' permission in feed channel ${config.feedChannelId}`);
      return;
    }

    if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
      console.error(`Bot lacks 'Send Messages' permission in feed channel ${config.feedChannelId}`);
      return;
    }

    if (!permissions?.has(PermissionFlagsBits.AddReactions)) {
      console.error(`Bot lacks 'Add Reactions' permission in feed channel ${config.feedChannelId}`);
    }

    const durationStr = formatDuration(duration);

    // Default intensity to 3 (moderate) if not specified
    const sessionIntensity = intensity || 3;

    // Format the date as "Month Day at HH:MM AM/PM"
    const sessionDate = endTime.toDate();
    const dateStr = sessionDate.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Generate the session post image
    const imageBuffer = await postImageService.generateSessionPostImage(
      username,
      durationStr,
      xpGained,
      activity,
      sessionIntensity,
      avatarUrl,
      title,
      description,
      dateStr
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `session-${sessionId}.png`,
      description: `${username} completed a ${durationStr} session`
    });

    const message = await textChannel.send({
      files: [attachment]
    });

    // Track session post for social features
    await postService.createSessionPost(
      message.id,
      userId,
      username,
      interaction.guildId!,
      config.feedChannelId,
      sessionId,
      duration,
      xpGained,
      newLevel,
      achievementsUnlocked
    );

    // React with a heart if bot has permission
    if (permissions?.has(PermissionFlagsBits.AddReactions)) {
      await message.react('❤️');
    }
  } catch (error: any) {
    // Log detailed error for debugging
    if (error.code === 50001) {
      console.error(`Bot lacks access to feed channel. Please ensure the bot has 'View Channel' permission.`);
    } else if (error.code === 50013) {
      console.error(`Bot lacks permissions in feed channel. Please ensure the bot has 'Send Messages', 'Attach Files', and 'Add Reactions' permissions.`);
    } else {
      console.error('Error posting to feed:', error);
    }
    // Don't throw - we don't want to fail the session completion
  }
}

// Helper function to post streak milestone celebrations to feed
async function postStreakMilestone(
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  avatarUrl: string,
  streak: number,
  totalSessions: number
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

    const textChannel = channel as TextChannel;

    // Check bot permissions in the channel
    const botMember = await interaction.guild?.members.fetch(client.user!.id);
    const permissions = textChannel.permissionsFor(botMember!);

    if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions?.has(PermissionFlagsBits.SendMessages)) {
      console.error(`Bot lacks necessary permissions in feed channel ${config.feedChannelId}`);
      return;
    }

    // Determine message based on milestones
    let message = '';
    let shouldCelebrate = false;

    if (totalSessions === 1) {
      // First session ever - only triggers once
      message = `just completed their first session!`;
      shouldCelebrate = true;
    } else if (streak === 7) {
      message = `hit a 7-day streak! A full week of grinding!`;
      shouldCelebrate = true;
    } else if (streak === 30) {
      message = `reached a 30-day streak! Unstoppable!`;
      shouldCelebrate = true;
    }

    // Only post if this is a milestone worth celebrating
    if (!shouldCelebrate) {
      return;
    }

    // Generate the streak image
    const imageBuffer = await streakImageService.generateStreakImage(
      username,
      avatarUrl,
      streak,
      message
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `streak-${streak}.png`,
      description: `${username} streak milestone!`
    });

    const milestoneMessage = await textChannel.send({
      files: [attachment]
    });

    // React with appropriate emoji if bot has permission
    if (permissions?.has(PermissionFlagsBits.AddReactions)) {
      await milestoneMessage.react('🔥');

      // Add additional reactions for streaks
      if (streak === 7) {
        await milestoneMessage.react('💪');
      } else if (streak === 30) {
        await milestoneMessage.react('👑');
        await milestoneMessage.react('💪');
      }
    }
  } catch (error) {
    console.error('Error posting streak milestone:', error);
    // Don't throw - we don't want to fail the session completion
  }
}

// Helper function to post achievement unlock celebrations to feed
async function postAchievementUnlock(
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  avatarUrl: string,
  achievementIds: string[]
) {
  try {
    if (!achievementIds || achievementIds.length === 0) {
      return;
    }

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

    const textChannel = channel as TextChannel;

    // Check bot permissions in the channel
    const botMember = await interaction.guild?.members.fetch(client.user!.id);
    const permissions = textChannel.permissionsFor(botMember!);

    if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions?.has(PermissionFlagsBits.SendMessages)) {
      console.error(`Bot lacks necessary permissions in feed channel ${config.feedChannelId}`);
      return;
    }

    // Get achievement details
    const achievements = achievementIds.map(id => getAchievement(id)).filter(b => b !== undefined);
    if (achievements.length === 0) {
      return;
    }

    // Generate achievement unlock image
    const imageBuffer = await achievementUnlockImageService.generateAchievementUnlockImage(
      username,
      avatarUrl,
      achievements as Array<{ emoji: string; name: string; description: string; xpReward: number }>
    );

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: 'achievement-unlock.png'
    });

    const achievementMessage = await textChannel.send({
      files: [attachment]
    });

    // React with confetti if bot has permission
    if (permissions?.has(PermissionFlagsBits.AddReactions)) {
      await achievementMessage.react('🎉');
    }
  } catch (error) {
    console.error('Error posting achievement unlock:', error);
    // Don't throw - we don't want to fail the session completion
  }
}

// Helper function to post level-up celebrations to feed
async function postLevelUp(
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  avatarUrl: string,
  newLevel: number,
  oldLevel: number
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

    const textChannel = channel as TextChannel;

    // Check bot permissions in the channel
    const botMember = await interaction.guild?.members.fetch(client.user!.id);
    const permissions = textChannel.permissionsFor(botMember!);

    if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions?.has(PermissionFlagsBits.SendMessages)) {
      console.error(`Bot lacks necessary permissions in feed channel ${config.feedChannelId}`);
      return;
    }

    // Calculate next level XP requirement and hours needed
    const currentXP = xpForLevel(newLevel);
    const nextLevelXP = xpForLevel(newLevel + 1);
    const xpNeeded = nextLevelXP - currentXP;
    const hoursNeeded = Math.ceil(xpNeeded / 100); // 100 XP per hour

    // Generate the level-up image
    const imageBuffer = await levelUpImageService.generateLevelUpImage(
      username,
      avatarUrl,
      newLevel,
      hoursNeeded
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `levelup-${newLevel}.png`,
      description: `${username} leveled up to ${newLevel}!`
    });

    const levelUpMessage = await textChannel.send({
      files: [attachment]
    });

    // React with celebration emojis if bot has permission
    if (permissions?.has(PermissionFlagsBits.AddReactions)) {
      await levelUpMessage.react('🎉');
      await levelUpMessage.react('✨');
    }
  } catch (error) {
    console.error('Error posting level-up:', error);
    // Don't throw - we don't want to fail the session completion
  }
}

// Helper function to post level-up celebrations to feed (for auto-posted VC sessions)
async function postLevelUpBasic(
  guildId: string,
  username: string,
  avatarUrl: string,
  newLevel: number,
  oldLevel: number
) {
  try {
    const config = await getServerConfig(guildId);

    if (!config || !config.feedChannelId) {
      return;
    }

    const channel = await client.channels.fetch(config.feedChannelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const textChannel = channel as TextChannel;

    // Calculate next level XP requirement and hours needed
    const currentXP = xpForLevel(newLevel);
    const nextLevelXP = xpForLevel(newLevel + 1);
    const xpNeeded = nextLevelXP - currentXP;
    const hoursNeeded = Math.ceil(xpNeeded / 100); // 100 XP per hour

    // Generate the level-up image
    const imageBuffer = await levelUpImageService.generateLevelUpImage(
      username,
      avatarUrl,
      newLevel,
      hoursNeeded
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `levelup-${newLevel}.png`,
      description: `${username} leveled up to ${newLevel}!`
    });

    const levelUpMessage = await textChannel.send({
      files: [attachment]
    });

    // React with celebration emojis
    await levelUpMessage.react('🎉').catch(() => {});
    await levelUpMessage.react('✨').catch(() => {});
  } catch (error) {
    console.error('Error posting level-up:', error);
  }
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'manualSessionModal') {
      try {
        // Defer reply immediately to prevent double-submission
        await interaction.deferReply({ ephemeral: false });

        const user = interaction.user;
        const guildId = interaction.guildId;

        // Get modal inputs
        const activity = interaction.fields.getTextInputValue('activity');
        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const durationInput = interaction.fields.getTextInputValue('duration');
        const intensityStr = interaction.fields.getTextInputValue('intensity');

        // Validate and parse intensity (1-5 scale)
        const intensity = parseInt(intensityStr, 10);
        if (isNaN(intensity) || intensity < 1 || intensity > 5) {
          await interaction.editReply({
            content: '❌ Invalid intensity value. Please enter a number between 1 and 5.',
          });
          return;
        }

        // Parse duration string (supports formats like "2h 30m", "1h", "45m", "90m")
        const parseDuration = (input: string): number | null => {
          const trimmed = input.trim().toLowerCase();

          // Try to match "Xh Ym" or "Xh" or "Ym" format
          const hourMinuteMatch = trimmed.match(/(\d+)\s*h(?:\s+(\d+)\s*m)?/);
          if (hourMinuteMatch) {
            const hours = parseInt(hourMinuteMatch[1], 10);
            const minutes = hourMinuteMatch[2] ? parseInt(hourMinuteMatch[2], 10) : 0;
            return (hours * 3600) + (minutes * 60);
          }

          // Try to match "Ym" format only
          const minuteMatch = trimmed.match(/^(\d+)\s*m$/);
          if (minuteMatch) {
            const minutes = parseInt(minuteMatch[1], 10);
            return minutes * 60;
          }

          return null;
        };

        const duration = parseDuration(durationInput);

        if (duration === null) {
          await interaction.editReply({
            content: '❌ Invalid duration format. Please use formats like "2h 30m", "1h", or "45m".',
          });
          return;
        }

        if (duration <= 0) {
          await interaction.editReply({
            content: '❌ Duration must be greater than 0.',
          });
          return;
        }

        // Create timestamps
        const endTime = Timestamp.now();
        const startTime = Timestamp.fromMillis(endTime.toMillis() - (duration * 1000));

        // Create completed session
        const sessionId = await sessionService.createCompletedSession({
          userId: user.id,
          username: user.username,
          serverId: guildId!,
          activity,
          title,
          description,
          duration,
          startTime,
          endTime,
          intensity,
        });

        // Update stats and award XP
        const statsUpdate = await statsService.updateUserStats(
          user.id,
          user.username,
          duration,
          activity,
          intensity
        );

        // Update completed session with XP gained (for leaderboards)
        await sessionService.updateCompletedSessionXP(sessionId, statsUpdate.xpGained);

        // Check for new achievements
        const newAchievements = await achievementService.checkAndAwardAchievements(user.id);

        const durationStr = formatDuration(duration);

        // Build XP message with intensity multiplier display
        const intensityLabels = ['Light', 'Easy', 'Normal', 'Hard', 'Max'];
        const intensityLabel = intensityLabels[intensity - 1];
        const multiplierText = `(${statsUpdate.xpMultiplier}x ${intensityLabel} intensity)`;

        let xpMessage = '';
        if (statsUpdate.leveledUp) {
          xpMessage = `\n\n🎉 **LEVEL UP!** You're now Level ${statsUpdate.newLevel}!\n✨ +${statsUpdate.xpGained} XP earned ${multiplierText}`;
        } else {
          xpMessage = `\n\n✨ +${statsUpdate.xpGained} XP earned ${multiplierText}`;
        }

        await interaction.editReply({
          content: `✅ Manual session logged! (${durationStr})${xpMessage}\n\nYour session has been saved and posted to the feed.`,
        });

        // Get user's avatar URL
        const avatarUrl = user.displayAvatarURL({ size: 128 });

        // Post to feed channel
        await postToFeed(
          interaction,
          user.username,
          user.id,
          avatarUrl,
          activity,
          title,
          description,
          duration,
          endTime,
          sessionId,
          statsUpdate.xpGained,
          statsUpdate.leveledUp ? statsUpdate.newLevel : undefined,
          newAchievements.length > 0 ? newAchievements : undefined,
          intensity
        );

        // Get updated stats to check for streak milestones
        const updatedStats = await statsService.getUserStats(user.id);
        if (updatedStats) {
          // Post streak milestone celebration if applicable
          await postStreakMilestone(
            interaction,
            user.username,
            avatarUrl,
            updatedStats.currentStreak,
            updatedStats.totalSessions
          );
        }

        // Post achievement unlock celebration if applicable
        if (newAchievements.length > 0) {
          await postAchievementUnlock(
            interaction,
            user.username,
            avatarUrl,
            newAchievements
          );
        }

        // Post level-up celebration if applicable
        if (statsUpdate.leveledUp && statsUpdate.newLevel) {
          // Calculate old level from XP
          const currentXP = statsUpdate.stats.xp || 0;
          const oldXP = currentXP - statsUpdate.xpGained;
          const oldLevel = calculateLevel(oldXP);

          await postLevelUp(
            interaction,
            user.username,
            avatarUrl,
            statsUpdate.newLevel,
            oldLevel
          );
        }
      } catch (error) {
        console.error('Error handling manual session modal:', error);

        const errorMessage = 'An error occurred while logging your manual session. Please try again.';

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        } catch (replyError) {
          console.error('Could not send error message to user:', replyError);
        }
      }
    } else if (interaction.customId === 'endSessionModal') {
      try {
        const user = interaction.user;
        const guildId = interaction.guildId;

        // Get modal inputs
        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');
        const intensityStr = interaction.fields.getTextInputValue('intensity');

        // Validate and parse intensity (1-5 scale)
        const intensity = parseInt(intensityStr, 10);
        if (isNaN(intensity) || intensity < 1 || intensity > 5) {
          await interaction.reply({
            content: '❌ Invalid intensity value. Please enter a number between 1 and 5.',
            ephemeral: true,
          });
          return;
        }

        // Defer reply immediately to prevent timeout (we have complex processing ahead)
        await interaction.deferReply({ ephemeral: false });

        // Get active session
        const session = await sessionService.getActiveSession(user.id);

        if (!session) {
          await interaction.editReply({
            content: 'No active session found! It may have been cancelled or already ended.',
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

        // DELETE ACTIVE SESSION FIRST to prevent race condition/duplicate submissions
        await sessionService.deleteActiveSession(user.id);

        // Create completed session
        const sessionId = await sessionService.createCompletedSession({
          userId: user.id,
          username: user.username,
          serverId: guildId!,
          activity: session.activity,
          title,
          description,
          duration,
          startTime: session.startTime,
          endTime,
          intensity,
        });

        // Update stats and award XP
        const statsUpdate = await statsService.updateUserStats(
          user.id,
          user.username,
          duration,
          session.activity,
          intensity
        );

        // Update completed session with XP gained (for leaderboards)
        await sessionService.updateCompletedSessionXP(sessionId, statsUpdate.xpGained);

        // Check for new achievements
        const newAchievements = await achievementService.checkAndAwardAchievements(user.id);

        const durationStr = formatDuration(duration);

        // Build XP message with intensity multiplier display
        const intensityLabels = ['Light', 'Easy', 'Normal', 'Hard', 'Max'];
        const intensityLabel = intensityLabels[intensity - 1];
        const multiplierText = `(${statsUpdate.xpMultiplier}x ${intensityLabel} intensity)`;

        let xpMessage = '';
        if (statsUpdate.leveledUp) {
          xpMessage = `\n\n🎉 **LEVEL UP!** You're now Level ${statsUpdate.newLevel}!\n✨ +${statsUpdate.xpGained} XP earned ${multiplierText}`;
        } else {
          xpMessage = `\n\n✨ +${statsUpdate.xpGained} XP earned ${multiplierText}`;
        }

        await interaction.editReply({
          content: `✅ Session completed! (${durationStr})${xpMessage}\n\nYour session has been saved and posted to the feed.`,
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
          endTime,
          sessionId,
          statsUpdate.xpGained,
          statsUpdate.leveledUp ? statsUpdate.newLevel : undefined,
          newAchievements.length > 0 ? newAchievements : undefined,
          intensity
        );

        // Get updated stats to check for streak milestones
        const updatedStats = await statsService.getUserStats(user.id);
        if (updatedStats) {
          // Post streak milestone celebration if applicable
          await postStreakMilestone(
            interaction,
            user.username,
            avatarUrl,
            updatedStats.currentStreak,
            updatedStats.totalSessions
          );
        }

        // Post achievement unlock celebration if applicable
        if (newAchievements.length > 0) {
          await postAchievementUnlock(
            interaction,
            user.username,
            avatarUrl,
            newAchievements
          );
        }

        // Post level-up celebration if applicable
        if (statsUpdate.leveledUp && statsUpdate.newLevel) {
          // Calculate old level from XP
          const currentXP = statsUpdate.stats.xp || 0;
          const oldXP = currentXP - statsUpdate.xpGained;
          const oldLevel = calculateLevel(oldXP);

          await postLevelUp(
            interaction,
            user.username,
            avatarUrl,
            statsUpdate.newLevel,
            oldLevel
          );
        }
      } catch (error) {
        console.error('Error handling end session modal:', error);

        const errorMessage = 'An error occurred while completing your session. Please try again.';

        try {
          // We always defer at the start, so use editReply
          await interaction.editReply({ content: errorMessage });
        } catch (replyError) {
          console.error('Could not send error message to user:', replyError);
        }
      }
    } else if (interaction.customId.includes('event_builder:') && interaction.customId.includes(':modal_')) {
      // Event builder field modal submissions
      const parts = interaction.customId.split(':');
      const builderId = `${parts[0]}:${parts[1]}:${parts[2]}`;
      const modalType = parts[3].replace('modal_', '');

      const builderState = eventBuilders.get(builderId);

      if (!builderState || builderState.userId !== interaction.user.id) {
        await interaction.reply({
          content: '❌ This event builder has expired or does not belong to you.',
          ephemeral: true
        });
        return;
      }

      try {
        await interaction.deferUpdate();

        // Update helper function
        const updateBuilderEmbed = (state: EventBuilderState): EmbedBuilder => {
          const embed = new EmbedBuilder()
            .setColor(0x1CB0F6) // Blue
            .setTitle('📅 Create Study Event')
            .setDescription('Use the buttons and dropdown below to configure your event.')
            .addFields(
              { name: '📝 Title', value: state.title || '*Not set*', inline: false },
              { name: '📍 Location', value: state.location || '*Not set*', inline: false },
              {
                name: '⏰ Start Time',
                value: state.startTime ? `<t:${Math.floor(state.startTime.getTime() / 1000)}:F>` : '*Not set*',
                inline: true
              },
              { name: '⏱️ Duration', value: state.duration ? `${state.duration} minutes` : 'No limit', inline: true },
              {
                name: '🎯 Study Type',
                value: state.studyType
                  ? (state.studyType === 'custom' && state.customType
                    ? `Custom: ${state.customType}`
                    : state.studyType === 'silent' ? 'Silent Study'
                    : state.studyType === 'conversation' ? 'Conversation Allowed'
                    : state.studyType === 'pomodoro' ? 'Pomodoro Session'
                    : state.studyType)
                  : '*Not set*',
                inline: false
              },
              { name: '👥 Max Attendees', value: state.maxAttendees ? state.maxAttendees.toString() : 'Unlimited', inline: true },
              { name: '📝 More Info', value: state.description || '*None*', inline: false }
            )
            .setFooter({ text: 'Configure all required fields (*) then click Create Event' });

          return embed;
        };

        // Process different modal types
        if (modalType === 'title') {
          builderState.title = interaction.fields.getTextInputValue('title');
        } else if (modalType === 'location') {
          builderState.location = interaction.fields.getTextInputValue('location');
        } else if (modalType === 'time') {
          const dateTimeStr = interaction.fields.getTextInputValue('time');

          // Parse date/time (timezone-aware parser)
          const parseDateTime = (input: string, timezone: string): Date | null => {
            const trimmed = input.trim().toLowerCase();

            // Get current time in user's timezone
            const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
            const year = nowInTz.getFullYear();
            const month = nowInTz.getMonth();
            const day = nowInTz.getDate();

            // Helper to convert local time to UTC Date object
            const createDateInTimezone = (yr: number, mo: number, dy: number, hr: number, min: number): Date => {
              // Create a date string in the target timezone
              const dateStr = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}T${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
              // Parse as if it's in the target timezone
              const localDate = new Date(dateStr);
              const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
              const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
              const offset = utcDate.getTime() - tzDate.getTime();
              return new Date(localDate.getTime() + offset);
            };

            // Try ISO format first (YYYY-MM-DD HH:MM)
            const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
            if (isoMatch) {
              const [, yr, mo, dy, hr, min] = isoMatch;
              return createDateInTimezone(
                parseInt(yr),
                parseInt(mo) - 1,
                parseInt(dy),
                parseInt(hr),
                parseInt(min)
              );
            }

            // Try "tomorrow HH:MM" or "tomorrow H pm/am"
            if (trimmed.includes('tomorrow')) {
              const timeMatch = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
              if (timeMatch) {
                const [, hourStr, minuteStr, meridiem] = timeMatch;
                let hour = parseInt(hourStr);
                const minute = minuteStr ? parseInt(minuteStr) : 0;

                if (meridiem === 'pm' && hour !== 12) hour += 12;
                if (meridiem === 'am' && hour === 12) hour = 0;

                const tomorrow = new Date(nowInTz);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return createDateInTimezone(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), hour, minute);
              }
            }

            // Try "today HH:MM" or "today H pm/am"
            if (trimmed.includes('today')) {
              const timeMatch = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
              if (timeMatch) {
                const [, hourStr, minuteStr, meridiem] = timeMatch;
                let hour = parseInt(hourStr);
                const minute = minuteStr ? parseInt(minuteStr) : 0;

                if (meridiem === 'pm' && hour !== 12) hour += 12;
                if (meridiem === 'am' && hour === 12) hour = 0;

                return createDateInTimezone(year, month, day, hour, minute);
              }
            }

            return null;
        };

          const timezone = builderState.timezone || 'America/Los_Angeles';
          const startTime = parseDateTime(dateTimeStr, timezone);
          if (!startTime) {
            await interaction.followUp({
              content: '❌ Invalid date/time format. Please use formats like:\n- `2025-01-20 18:00`\n- `tomorrow 6pm`\n- `today 14:30`',
              ephemeral: true
            });
            return;
          }

          // Allow past events - no validation check
          builderState.startTime = startTime;
        } else if (modalType === 'duration') {
          const durationStr = interaction.fields.getTextInputValue('duration');
          const duration = parseInt(durationStr, 10);

          if (isNaN(duration) || duration <= 0) {
            await interaction.followUp({
              content: '❌ Invalid duration. Please enter a positive number (in minutes).',
              ephemeral: true
            });
            return;
          }

          builderState.duration = duration;
        } else if (modalType === 'max') {
          const maxStr = interaction.fields.getTextInputValue('max').trim();

          if (maxStr) {
            const max = parseInt(maxStr, 10);
            if (isNaN(max) || max <= 0) {
              await interaction.followUp({
                content: '❌ Invalid max attendees. Please enter a positive number or leave blank for unlimited.',
                ephemeral: true
              });
              return;
            }
            builderState.maxAttendees = max;
          } else {
            builderState.maxAttendees = undefined;
          }
        } else if (modalType === 'description') {
          const desc = interaction.fields.getTextInputValue('description').trim();
          builderState.description = desc || undefined;
        } else if (modalType === 'custom_type') {
          const customType = interaction.fields.getTextInputValue('custom_type').trim();
          builderState.customType = customType;
          builderState.studyType = 'custom';
        }

        // Update the builder embed
        const updatedEmbed = updateBuilderEmbed(builderState);

        // Recreate components
        const studyTypeSelect = new StringSelectMenuBuilder()
          .setCustomId(`${builderId}:study_type`)
          .setPlaceholder('Select study type')
          .addOptions([
            { label: 'Silent Study', description: 'Quiet, focused work session', value: 'silent', emoji: '🤫' },
            { label: 'Conversation Allowed', description: 'Talking and discussion permitted', value: 'conversation', emoji: '💬' },
            { label: 'Pomodoro Session', description: 'Structured breaks (25min work, 5min break)', value: 'pomodoro', emoji: '🍅' },
            { label: 'Custom', description: 'Define your own study style', value: 'custom', emoji: '✨' }
          ]);

        const setTitleBtn = new ButtonBuilder().setCustomId(`${builderId}:set_title`).setLabel('Set Title').setStyle(ButtonStyle.Secondary).setEmoji('📝');
        const setLocationBtn = new ButtonBuilder().setCustomId(`${builderId}:set_location`).setLabel('Set Location').setStyle(ButtonStyle.Secondary).setEmoji('📍');
        const setTimeBtn = new ButtonBuilder().setCustomId(`${builderId}:set_time`).setLabel('Set Time').setStyle(ButtonStyle.Secondary).setEmoji('⏰');
        const setDurationBtn = new ButtonBuilder().setCustomId(`${builderId}:set_duration`).setLabel('Set Duration').setStyle(ButtonStyle.Secondary).setEmoji('⏱️');
        const setMaxBtn = new ButtonBuilder().setCustomId(`${builderId}:set_max`).setLabel('Set Max').setStyle(ButtonStyle.Secondary).setEmoji('👥');
        const setDescBtn = new ButtonBuilder().setCustomId(`${builderId}:set_description`).setLabel('Set Description').setStyle(ButtonStyle.Secondary).setEmoji('📄');
        const createBtn = new ButtonBuilder().setCustomId(`${builderId}:create`).setLabel('Create Event').setStyle(ButtonStyle.Success).setEmoji('✅');
        const cancelBtn = new ButtonBuilder().setCustomId(`${builderId}:cancel`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌');

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(studyTypeSelect);
        const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(setTitleBtn, setLocationBtn, setTimeBtn, setDurationBtn);
        const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(setMaxBtn, setDescBtn);
        const buttonRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, cancelBtn);

        await interaction.editReply({
          embeds: [updatedEmbed],
          components: [selectRow, buttonRow1, buttonRow2, buttonRow3]
        });
      } catch (error) {
        console.error('Error updating event builder:', error);
        await interaction.followUp({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true
        });
      }
    }
    return;
  }

  // Handle button interactions
  if (interaction.isButton()) {
    const user = interaction.user;

    // Event builder buttons
    if (interaction.customId.includes('event_builder:')) {
      const parts = interaction.customId.split(':');
      const builderId = `${parts[0]}:${parts[1]}:${parts[2]}`;
      const action = parts[3];

      const builderState = eventBuilders.get(builderId);

      if (!builderState || builderState.userId !== user.id) {
        await interaction.reply({
          content: '❌ This event builder has expired or does not belong to you.',
          ephemeral: true
        });
        return;
      }

      // Cancel button
      if (action === 'cancel') {
        eventBuilders.delete(builderId);
        await interaction.update({
          content: '❌ Event creation cancelled.',
          embeds: [],
          components: []
        });
        return;
      }

      // Create button
      if (action === 'create') {
        // Validate required fields
        if (!builderState.title || !builderState.location || !builderState.startTime) {
          await interaction.reply({
            content: '❌ Please fill in all required fields (Title, Location, Time).',
            ephemeral: true
          });
          return;
        }

        await interaction.deferUpdate();

        try {
          const guildId = interaction.guildId!;

          // Create the event
          const event = await eventService.createEvent(
            guildId,
            user.id,
            user.username,
            builderState.title,
            builderState.location,
            builderState.startTime,
            builderState.duration,
            builderState.studyType || 'conversation',
            {
              description: builderState.description,
              maxAttendees: builderState.maxAttendees,
              customType: builderState.customType,
            }
          );

          // Post event to events channel
          const config = await getServerConfig(guildId);
          if (config && config.eventsChannelId) {
            try {
              const eventsChannel = (await client.channels.fetch(config.eventsChannelId)) as TextChannel;

              const studyTypeEmoji = {
                silent: '🤫',
                conversation: '💬',
                pomodoro: '🍅',
                custom: '✨'
              };

              const studyTypeNames = {
                silent: 'Silent Study',
                conversation: 'Conversation Allowed',
                pomodoro: 'Pomodoro Session',
                custom: builderState.customType || 'Custom'
              };

              const studyType = builderState.studyType || 'conversation';

              const eventEmbed = new EmbedBuilder()
                .setColor(0x1CB0F6) // Blue
                .setAuthor({
                  name: user.username,
                  iconURL: user.displayAvatarURL({ size: 128 }),
                })
                .setTitle(`${studyTypeEmoji[studyType]} ${builderState.title}`);

              // Add fields
              const fields = [
                { name: '📍 Location', value: builderState.location, inline: false },
                { name: '⏰ Start Time', value: `<t:${Math.floor(builderState.startTime.getTime() / 1000)}:F>\n<t:${Math.floor(builderState.startTime.getTime() / 1000)}:R>`, inline: true },
                { name: '⏱️ Duration', value: builderState.duration ? `${builderState.duration} minutes` : 'No limit', inline: true },
                { name: '🎯 Type', value: studyTypeNames[studyType], inline: true },
                {
                  name: '👥 Attendees',
                  value: builderState.maxAttendees
                    ? `<@${user.id}> (Host) (1/${builderState.maxAttendees} - ${builderState.maxAttendees - 1} spots left)`
                    : `<@${user.id}> (Host)`,
                  inline: false
                }
              ];

              // Only add More Info if there's a description
              if (builderState.description) {
                fields.push({ name: '📝 More Info', value: builderState.description, inline: false });
              }

              fields.push({ name: '📞 Contact', value: `DM <@${user.id}> for more info!`, inline: false });

              eventEmbed
                .addFields(fields)
                .setFooter({ text: `Event ID: ${event.eventId}` })
                .setTimestamp();

              const joinButton = new ButtonBuilder()
                .setCustomId(`event_join:${event.eventId}`)
                .setLabel('Join Event')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

              const leaveButton = new ButtonBuilder()
                .setCustomId(`event_leave:${event.eventId}`)
                .setLabel('Leave Event')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

              const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, leaveButton);

              const message = await eventsChannel.send({
                embeds: [eventEmbed],
                components: [buttonRow],
              });

              await eventService.updateEventMessage(event.eventId, message.id, eventsChannel.id);
            } catch (error) {
              console.error('Error posting event to events channel:', error);
            }
          }

          // Clean up builder state
          eventBuilders.delete(builderId);

          await interaction.editReply({
            content: `✅ Event created successfully!\n\n**${builderState.title}**\n📍 ${builderState.location}\n⏰ <t:${Math.floor(builderState.startTime.getTime() / 1000)}:F>`,
            embeds: [],
            components: []
          });
        } catch (error) {
          console.error('Error creating event:', error);
          await interaction.followUp({
            content: '❌ An error occurred while creating the event. Please try again.',
            ephemeral: true
          });
        }
        return;
      }

      // Set field buttons - show modals
      if (action === 'set_title') {
        const modal = new ModalBuilder()
          .setCustomId(`${builderId}:modal_title`)
          .setTitle('Set Event Title');

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Event Title')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Late Night Study Session')
          .setRequired(true)
          .setMaxLength(100);

        if (builderState.title) {
          titleInput.setValue(builderState.title);
        }

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      if (action === 'set_location') {
        const modal = new ModalBuilder()
          .setCustomId(`${builderId}:modal_location`)
          .setTitle('Set Event Location');

        const locationInput = new TextInputBuilder()
          .setCustomId('location')
          .setLabel('Location')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Library - 3rd floor, table near windows')
          .setRequired(true)
          .setMaxLength(200);

        if (builderState.location) {
          locationInput.setValue(builderState.location);
        }

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(locationInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      if (action === 'set_time') {
        const modal = new ModalBuilder()
          .setCustomId(`${builderId}:modal_time`)
          .setTitle('Set Event Time');

        const timeInput = new TextInputBuilder()
          .setCustomId('time')
          .setLabel('Start Date & Time')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 2025-01-20 18:00 or tomorrow 6pm')
          .setRequired(true);

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      if (action === 'set_duration') {
        const modal = new ModalBuilder()
          .setCustomId(`${builderId}:modal_duration`)
          .setTitle('Set Event Duration');

        const durationInput = new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duration (in minutes)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 120')
          .setRequired(true);

        if (builderState.duration) {
          durationInput.setValue(builderState.duration.toString());
        }

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      if (action === 'set_max') {
        const modal = new ModalBuilder()
          .setCustomId(`${builderId}:modal_max`)
          .setTitle('Set Max Attendees');

        const maxInput = new TextInputBuilder()
          .setCustomId('max')
          .setLabel('Max Attendees (leave blank for unlimited)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 10')
          .setRequired(false);

        if (builderState.maxAttendees) {
          maxInput.setValue(builderState.maxAttendees.toString());
        }

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(maxInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      if (action === 'set_description') {
        const modal = new ModalBuilder()
          .setCustomId(`${builderId}:modal_description`)
          .setTitle('Set Event Description');

        const descInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Add any additional details about the event...')
          .setRequired(false)
          .setMaxLength(500);

        if (builderState.description) {
          descInput.setValue(builderState.description);
        }

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }
    }

    // Event join button
    if (interaction.customId.startsWith('event_join:')) {
      const eventId = interaction.customId.split(':')[1];

      await interaction.deferReply({ ephemeral: true });

      try {
        const result = await eventService.joinEvent(eventId, user.id, user.username);

        await interaction.editReply({
          content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
        });

        // Update the event embed if successful
        if (result.success && interaction.message) {
          const event = await eventService.getEvent(eventId);
          if (event) {
            const embed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(embed);

            // Build attendees list with @ mentions, marking host
            const attendeesList = event.attendees.map(a =>
              a.userId === event.creatorId ? `<@${a.userId}> (Host)` : `<@${a.userId}>`
            ).join(', ');
            const spotsText = event.maxAttendees
              ? `${attendeesList} (${event.attendees.length}/${event.maxAttendees} - ${event.maxAttendees - event.attendees.length} spots left)`
              : attendeesList;

            // Find and update the attendees field
            const fields = newEmbed.data.fields || [];
            const attendeesFieldIndex = fields.findIndex(f => f.name === '👥 Attendees');
            if (attendeesFieldIndex !== -1) {
              fields[attendeesFieldIndex].value = spotsText;
              newEmbed.setFields(fields);
            }

            await interaction.message.edit({ embeds: [newEmbed] });
          }
        }
      } catch (error) {
        console.error('Error joining event:', error);
        await interaction.editReply({
          content: '❌ An error occurred while joining the event. Please try again.',
        });
      }
      return;
    }

    // Event leave button
    if (interaction.customId.startsWith('event_leave:')) {
      const eventId = interaction.customId.split(':')[1];

      await interaction.deferReply({ ephemeral: true });

      try {
        const result = await eventService.leaveEvent(eventId, user.id);

        await interaction.editReply({
          content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
        });

        // Update the event embed if successful
        if (result.success && interaction.message) {
          const event = await eventService.getEvent(eventId);
          if (event) {
            const embed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(embed);

            // Build attendees list with @ mentions, marking host
            const attendeesList = event.attendees.map(a =>
              a.userId === event.creatorId ? `<@${a.userId}> (Host)` : `<@${a.userId}>`
            ).join(', ');
            const spotsText = event.maxAttendees
              ? `${attendeesList} (${event.attendees.length}/${event.maxAttendees} - ${event.maxAttendees - event.attendees.length} spots left)`
              : attendeesList;

            // Find and update the attendees field
            const fields = newEmbed.data.fields || [];
            const attendeesFieldIndex = fields.findIndex(f => f.name === '👥 Attendees');
            if (attendeesFieldIndex !== -1) {
              fields[attendeesFieldIndex].value = spotsText;
              newEmbed.setFields(fields);
            }

            await interaction.message.edit({ embeds: [newEmbed] });
          }
        }
      } catch (error) {
        console.error('Error leaving event:', error);
        await interaction.editReply({
          content: '❌ An error occurred while leaving the event. Please try again.',
        });
      }
      return;
    }

    // Event join from list button
    if (interaction.customId === 'event_list_join') {
      await interaction.reply({
        content: 'Please copy the **Event ID** from the event list above and use this command:\n`/events` then click the Join button on the specific event, or join via the event post in the feed channel.',
        ephemeral: true,
      });
      return;
    }

    // Event leave from list button
    if (interaction.customId === 'event_list_leave') {
      await interaction.reply({
        content: 'Please copy the **Event ID** from the event list above and use the Leave button on the specific event post in the feed channel, or use `/cancelevent <event-id>` if you created it.',
        ephemeral: true,
      });
      return;
    }

    // View Graph button (from /me or /stats)
    if (interaction.customId.startsWith('view_graph_')) {
      const targetUserId = interaction.customId.replace('view_graph_', '');

      if (user.id !== targetUserId) {
        await interaction.reply({
          content: '❌ You can only view your own graphs.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: false });

      try {
        // Default: Hours over the past week
        const defaultMetric = 'hours';
        const defaultTimeframe = 'week';

        // Get historical data
        const chartData = await statsService.getHistoricalChartData(
          user.id,
          defaultMetric,
          defaultTimeframe
        );

        // Get user avatar
        const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

        // Generate chart image
        const imageBuffer = await statsImageService.generateStatsImage(
          user.username,
          defaultMetric,
          defaultTimeframe,
          chartData.data,
          chartData.currentValue,
          chartData.previousValue,
          avatarUrl
        );

        const attachment = new AttachmentBuilder(imageBuffer, { name: 'stats-chart.png' });

        // Create dropdown menus for switching metrics and timeframes
        const metricSelect = new StringSelectMenuBuilder()
          .setCustomId(`graph_metric_${user.id}`)
          .setPlaceholder('Change metric')
          .addOptions([
            { label: '⏱️ Hours', value: 'hours', default: true },
            { label: '📚 Sessions', value: 'sessions' },
            { label: '⚡ XP Earned', value: 'xp' },
          ]);

        const timeframeSelect = new StringSelectMenuBuilder()
          .setCustomId(`graph_timeframe_${user.id}`)
          .setPlaceholder('Change timeframe')
          .addOptions([
            { label: '📆 Past Week', value: 'week', default: true },
            { label: '📅 Past Month', value: 'month' },
            { label: '📊 Past Year', value: 'year' },
          ]);

        const metricRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(metricSelect);
        const timeframeRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeframeSelect);

        await interaction.editReply({
          files: [attachment],
          components: [metricRow, timeframeRow],
        });
      } catch (error) {
        console.error('Error generating graph:', error);
        await interaction.editReply({
          content: '❌ Failed to generate graph. Please try again later.',
        });
      }
      return;
    }

    // View Statistics button (from /me)
    if (interaction.customId.startsWith('view_stats_')) {
      const targetUserId = interaction.customId.replace('view_stats_', '');

      if (user.id !== targetUserId) {
        await interaction.reply({
          content: '❌ You can only view your own statistics.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: false });

      try {
        const stats = await statsService.getUserStats(user.id);

        if (!stats) {
          await interaction.editReply({
            content: 'No stats yet! Complete your first session with /start and /stop.',
          });
          return;
        }

        // Default to weekly hours
        const defaultMetric = 'hours';
        const defaultTimeframe = 'week';

        // Calculate stats
        const today = getStartOfDayPacific();
        const todaySessions = await sessionService.getCompletedSessions(
          user.id,
          Timestamp.fromDate(today)
        );

        const weekStart = getStartOfWeekPacific();
        const weeklySessions = await sessionService.getCompletedSessions(
          user.id,
          Timestamp.fromDate(weekStart)
        );

        const twoWeeksAgo = new Date(weekStart);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
        const allPreviousWeekSessions = await sessionService.getCompletedSessions(
          user.id,
          Timestamp.fromDate(twoWeeksAgo)
        );
        const previousWeekSessions = allPreviousWeekSessions.filter(s =>
          s.endTime.toDate() < weekStart
        );

        const currentValue = Math.round(weeklySessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
        const previousValue = Math.round(previousWeekSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);

        // Calculate breakdown by day
        const breakdown = [];
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayStart = new Date(weekStart);

        for (let i = 0; i < 7; i++) {
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const daySessions = weeklySessions.filter(s => {
            const sessionDate = s.endTime.toDate();
            return sessionDate >= dayStart && sessionDate < dayEnd;
          });

          const dayHours = Math.round(daySessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
          breakdown.push({ label: daysOfWeek[i], value: dayHours });

          dayStart.setDate(dayStart.getDate() + 1);
        }

        const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

        const imageBuffer = await statsOverviewImageService.generateStatsOverviewImage(
          user.username,
          defaultMetric as 'hours' | 'sessions' | 'xp',
          defaultTimeframe as 'today' | 'week' | 'month' | 'all-time',
          currentValue,
          previousValue,
          breakdown,
          avatarUrl
        );

        const attachment = new AttachmentBuilder(imageBuffer, {
          name: 'stats-overview.png',
        });

        // Create dropdown and button
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`stats_select_${user.id}`)
          .setPlaceholder('Change metric or timeframe')
          .addOptions([
            { label: '⏱️ Hours - This Week', value: 'hours_week', default: true },
            { label: '⏱️ Hours - Today', value: 'hours_today' },
            { label: '⏱️ Hours - This Month', value: 'hours_month' },
            { label: '⏱️ Hours - All Time', value: 'hours_all-time' },
            { label: '📚 Sessions - This Week', value: 'sessions_week' },
            { label: '📚 Sessions - Today', value: 'sessions_today' },
            { label: '📚 Sessions - This Month', value: 'sessions_month' },
            { label: '📚 Sessions - All Time', value: 'sessions_all-time' },
            { label: '⚡ XP - This Week', value: 'xp_week' },
            { label: '⚡ XP - Today', value: 'xp_today' },
            { label: '⚡ XP - This Month', value: 'xp_month' },
            { label: '⚡ XP - All Time', value: 'xp_all-time' },
          ]);

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const graphButton = new ButtonBuilder()
          .setCustomId(`view_graph_${user.id}`)
          .setLabel('View Graph')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊');

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(graphButton);

        await interaction.editReply({
          files: [attachment],
          components: [selectRow, buttonRow],
        });
      } catch (error) {
        console.error('Error generating statistics:', error);
        await interaction.editReply({
          content: '❌ Failed to generate statistics. Please try again later.',
        });
      }
      return;
    }
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    // Stats selector handler
    if (interaction.customId.startsWith('stats_select_')) {
      const targetUserId = interaction.customId.replace('stats_select_', '');
      const user = interaction.user;

      if (user.id !== targetUserId) {
        await interaction.reply({
          content: '❌ You can only change your own statistics view.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferUpdate();

      try {
        // Parse metric and timeframe from selected value
        const [metric, timeframe] = interaction.values[0].split('_');

        // Get data based on timeframe
        let startTime: Date;
        let previousStartTime: Date;
        let previousEndTime: Date;
        let breakdown: Array<{ label: string; value: number }> = [];
        let breakdownLabels: string[];

        const today = getStartOfDayPacific();
        const monthStart = getStartOfMonthPacific();

        // Use rolling 7-day window (same as /graph)
        const now = new Date();
        const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        weekStart.setHours(0, 0, 0, 0);

        if (timeframe === 'today') {
          startTime = today;
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          previousStartTime = yesterday;
          previousEndTime = today;
          breakdownLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        } else if (timeframe === 'week') {
          startTime = weekStart;
          const twoWeeksAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
          twoWeeksAgo.setHours(0, 0, 0, 0);
          previousStartTime = twoWeeksAgo;
          previousEndTime = weekStart;
          // Generate day names for rolling 7-day window
          breakdownLabels = [];
          const tempDate = new Date(weekStart);
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          for (let i = 0; i < 7; i++) {
            breakdownLabels.push(dayNames[tempDate.getDay()]);
            tempDate.setDate(tempDate.getDate() + 1);
          }
        } else if (timeframe === 'month') {
          startTime = monthStart;
          const lastMonthStart = new Date(monthStart);
          lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
          previousStartTime = lastMonthStart;
          previousEndTime = monthStart;
          // Show 4 weeks for month
          breakdownLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        } else {
          // all-time
          startTime = new Date(0);
          previousStartTime = new Date(0);
          previousEndTime = new Date(0);
          // Show Today, This Week, This Month, All Time
          breakdownLabels = ['Today', 'This Week', 'This Month', 'All Time'];
        }

        // Fetch sessions
        const currentSessions = await sessionService.getCompletedSessions(
          user.id,
          Timestamp.fromDate(startTime)
        );

        let previousSessions: any[] = [];
        if (timeframe !== 'all-time') {
          const allPreviousSessions = await sessionService.getCompletedSessions(
            user.id,
            Timestamp.fromDate(previousStartTime)
          );
          // Filter to only include sessions before the current period
          previousSessions = allPreviousSessions.filter(s =>
            s.endTime.toDate() < startTime
          );
        }

        // Calculate values based on metric
        let currentValue: number;
        let previousValue: number;

        if (metric === 'hours') {
          currentValue = Math.round(currentSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
          previousValue = Math.round(previousSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
        } else if (metric === 'sessions') {
          currentValue = currentSessions.length;
          previousValue = previousSessions.length;
        } else {
          // xp
          currentValue = Math.round(currentSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
          previousValue = Math.round(previousSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
        }

        // Calculate breakdown and highlight index
        let highlightIndex: number | undefined = undefined;
        const currentDate = new Date();

        if (timeframe === 'today') {
          // Hourly breakdown for today
          for (let hour = 0; hour < 24; hour++) {
            const hourStart = new Date(startTime);
            hourStart.setHours(hour, 0, 0, 0);
            const hourEnd = new Date(hourStart);
            hourEnd.setHours(hour + 1, 0, 0, 0);

            const hourSessions = currentSessions.filter(s => {
              const sessionDate = s.endTime.toDate();
              return sessionDate >= hourStart && sessionDate < hourEnd;
            });

            let value = 0;
            if (metric === 'hours') {
              value = Math.round(hourSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
            } else if (metric === 'sessions') {
              value = hourSessions.length;
            } else {
              value = Math.round(hourSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
            }

            breakdown.push({ label: breakdownLabels[hour], value });

            // Highlight current hour
            if (currentDate.getHours() === hour) {
              highlightIndex = hour;
            }
          }
        } else if (timeframe === 'week') {
          // Daily breakdown for week
          const dayStart = new Date(startTime);
          for (let i = 0; i < 7; i++) {
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const daySessions = currentSessions.filter(s => {
              const sessionDate = s.endTime.toDate();
              return sessionDate >= dayStart && sessionDate < dayEnd;
            });

            let value = 0;
            if (metric === 'hours') {
              value = Math.round(daySessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
            } else if (metric === 'sessions') {
              value = daySessions.length;
            } else {
              value = Math.round(daySessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
            }

            breakdown.push({ label: breakdownLabels[i], value });

            // Highlight today
            if (dayStart.toDateString() === currentDate.toDateString()) {
              highlightIndex = i;
            }

            dayStart.setDate(dayStart.getDate() + 1);
          }
        } else if (timeframe === 'month') {
          // Weekly breakdown for month (4 weeks)
          const weekStart = new Date(startTime);

          for (let i = 0; i < 4; i++) {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const weekSessions = currentSessions.filter(s => {
              const sessionDate = s.endTime.toDate();
              return sessionDate >= weekStart && sessionDate < weekEnd;
            });

            let value = 0;
            if (metric === 'hours') {
              value = Math.round(weekSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
            } else if (metric === 'sessions') {
              value = weekSessions.length;
            } else {
              value = Math.round(weekSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
            }

            // Check if this is the current week
            const isCurrentWeek = currentDate >= weekStart && currentDate < weekEnd;
            if (isCurrentWeek) {
              highlightIndex = i;
            }

            // Use "This Week" for current week, otherwise use default label
            const weekLabel = isCurrentWeek ? 'This Week' : breakdownLabels[i];
            breakdown.push({ label: weekLabel, value });

            weekStart.setDate(weekStart.getDate() + 7);
          }
        } else {
          // all-time: show Today, This Week, This Month, All Time
          const todayValue = await sessionService.getCompletedSessions(user.id, Timestamp.fromDate(today));
          const weekValue = await sessionService.getCompletedSessions(user.id, Timestamp.fromDate(weekStart));
          const monthValue = await sessionService.getCompletedSessions(user.id, Timestamp.fromDate(monthStart));

          const calculateValue = (sessions: any[]) => {
            if (metric === 'hours') {
              return Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
            } else if (metric === 'sessions') {
              return sessions.length;
            } else {
              return Math.round(sessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
            }
          };

          breakdown = [
            { label: 'Today', value: calculateValue(todayValue) },
            { label: 'This Week', value: calculateValue(weekValue) },
            { label: 'This Month', value: calculateValue(monthValue) },
            { label: 'All Time', value: currentValue },
          ];

          // All-time: don't highlight anything (or optionally highlight "All Time" at index 3)
          highlightIndex = undefined;
        }

        // Generate new stats image
        const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });
        const imageBuffer = await statsOverviewImageService.generateStatsOverviewImage(
          user.username,
          metric as 'hours' | 'sessions' | 'xp',
          timeframe as 'today' | 'week' | 'month' | 'all-time',
          currentValue,
          previousValue,
          breakdown,
          avatarUrl,
          highlightIndex
        );

        const attachment = new AttachmentBuilder(imageBuffer, {
          name: 'stats-overview.png',
        });

        // Update select menu to reflect current selection
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`stats_select_${user.id}`)
          .setPlaceholder('Change metric or timeframe')
          .addOptions([
            { label: '⏱️ Hours - This Week', value: 'hours_week', default: metric === 'hours' && timeframe === 'week' },
            { label: '⏱️ Hours - This Month', value: 'hours_month', default: metric === 'hours' && timeframe === 'month' },
            { label: '⏱️ Hours - All Time', value: 'hours_all-time', default: metric === 'hours' && timeframe === 'all-time' },
            { label: '📚 Sessions - This Week', value: 'sessions_week', default: metric === 'sessions' && timeframe === 'week' },
            { label: '📚 Sessions - This Month', value: 'sessions_month', default: metric === 'sessions' && timeframe === 'month' },
            { label: '📚 Sessions - All Time', value: 'sessions_all-time', default: metric === 'sessions' && timeframe === 'all-time' },
            { label: '⚡ XP - This Week', value: 'xp_week', default: metric === 'xp' && timeframe === 'week' },
            { label: '⚡ XP - This Month', value: 'xp_month', default: metric === 'xp' && timeframe === 'month' },
            { label: '⚡ XP - All Time', value: 'xp_all-time', default: metric === 'xp' && timeframe === 'all-time' },
          ]);

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const graphButton = new ButtonBuilder()
          .setCustomId(`view_graph_${user.id}`)
          .setLabel('View Graph')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊');

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(graphButton);

        await interaction.editReply({
          files: [attachment],
          components: [selectRow, buttonRow],
        });
      } catch (error) {
        console.error('Error updating statistics:', error);
        await interaction.followUp({
          content: '❌ Failed to update statistics. Please try again later.',
          ephemeral: true,
        });
      }
      return;
    }

    // Event builder study type selection
    if (interaction.customId.includes('event_builder:') && interaction.customId.includes(':study_type')) {
      const parts = interaction.customId.split(':');
      const builderId = `${parts[0]}:${parts[1]}:${parts[2]}`;
      const selectedType = interaction.values[0] as 'silent' | 'conversation' | 'pomodoro' | 'custom';

      const builderState = eventBuilders.get(builderId);

      if (!builderState || builderState.userId !== interaction.user.id) {
        await interaction.reply({
          content: '❌ This event builder has expired or does not belong to you.',
          ephemeral: true
        });
        return;
      }

      // If custom type, show a modal to get custom description
      if (selectedType === 'custom') {
        const modal = new ModalBuilder()
          .setCustomId(`${builderId}:modal_custom_type`)
          .setTitle('Custom Study Type');

        const customTypeInput = new TextInputBuilder()
          .setCustomId('custom_type')
          .setLabel('Describe your study type')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Group Project Work, Code Review Session')
          .setRequired(true)
          .setMaxLength(100);

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(customTypeInput);
        modal.addComponents(row);

        await interaction.showModal(modal);

        // Store that we selected custom (will be updated when modal submitted)
        builderState.studyType = 'custom';
        return;
      }

      // Update state
      builderState.studyType = selectedType;
      builderState.customType = undefined; // Clear custom type if switching away from custom

      await interaction.deferUpdate();

      // Update embed helper
      const updateBuilderEmbed = (state: EventBuilderState): EmbedBuilder => {
        const embed = new EmbedBuilder()
          .setColor(0x1CB0F6) // Blue
          .setTitle('📅 Create Study Event')
          .setDescription('Use the buttons and dropdown below to configure your event.')
          .addFields(
            { name: '📝 Title', value: state.title || '*Not set*', inline: false },
            { name: '📍 Location', value: state.location || '*Not set*', inline: false },
            {
              name: '⏰ Start Time',
              value: state.startTime ? `<t:${Math.floor(state.startTime.getTime() / 1000)}:F>` : '*Not set*',
              inline: true
            },
            { name: '⏱️ Duration', value: state.duration ? `${state.duration} minutes` : 'No limit', inline: true },
            {
              name: '🎯 Study Type',
              value: state.studyType
                ? (state.studyType === 'custom' && state.customType
                  ? `Custom: ${state.customType}`
                  : state.studyType === 'silent' ? 'Silent Study'
                  : state.studyType === 'conversation' ? 'Conversation Allowed'
                  : state.studyType === 'pomodoro' ? 'Pomodoro Session'
                  : state.studyType)
                : '*Not set*',
              inline: false
            },
            { name: '👥 Max Attendees', value: state.maxAttendees ? state.maxAttendees.toString() : 'Unlimited', inline: true },
            { name: '📝 More Info', value: state.description || '*None*', inline: false }
          )
          .setFooter({ text: 'Configure all required fields (*) then click Create Event' });

        return embed;
      };

      const updatedEmbed = updateBuilderEmbed(builderState);

      // Recreate components
      const studyTypeSelect = new StringSelectMenuBuilder()
        .setCustomId(`${builderId}:study_type`)
        .setPlaceholder('Select study type')
        .addOptions([
          { label: 'Silent Study', description: 'Quiet, focused work session', value: 'silent', emoji: '🤫' },
          { label: 'Conversation Allowed', description: 'Talking and discussion permitted', value: 'conversation', emoji: '💬' },
          { label: 'Pomodoro Session', description: 'Structured breaks (25min work, 5min break)', value: 'pomodoro', emoji: '🍅' },
          { label: 'Custom', description: 'Define your own study style', value: 'custom', emoji: '✨' }
        ]);

      const setTitleBtn = new ButtonBuilder().setCustomId(`${builderId}:set_title`).setLabel('Set Title').setStyle(ButtonStyle.Secondary).setEmoji('📝');
      const setLocationBtn = new ButtonBuilder().setCustomId(`${builderId}:set_location`).setLabel('Set Location').setStyle(ButtonStyle.Secondary).setEmoji('📍');
      const setTimeBtn = new ButtonBuilder().setCustomId(`${builderId}:set_time`).setLabel('Set Time').setStyle(ButtonStyle.Secondary).setEmoji('⏰');
      const setDurationBtn = new ButtonBuilder().setCustomId(`${builderId}:set_duration`).setLabel('Set Duration').setStyle(ButtonStyle.Secondary).setEmoji('⏱️');
      const setMaxBtn = new ButtonBuilder().setCustomId(`${builderId}:set_max`).setLabel('Set Max').setStyle(ButtonStyle.Secondary).setEmoji('👥');
      const setDescBtn = new ButtonBuilder().setCustomId(`${builderId}:set_description`).setLabel('Set Description').setStyle(ButtonStyle.Secondary).setEmoji('📄');
      const createBtn = new ButtonBuilder().setCustomId(`${builderId}:create`).setLabel('Create Event').setStyle(ButtonStyle.Success).setEmoji('✅');
      const cancelBtn = new ButtonBuilder().setCustomId(`${builderId}:cancel`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌');

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(studyTypeSelect);
      const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(setTitleBtn, setLocationBtn, setTimeBtn, setDurationBtn);
      const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(setMaxBtn, setDescBtn);
      const buttonRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, cancelBtn);

      await interaction.editReply({
        embeds: [updatedEmbed],
        components: [selectRow, buttonRow1, buttonRow2, buttonRow3]
      });
      return;
    }

    if (interaction.customId === 'leaderboard_timeframe') {
      const selectedValue = interaction.values[0];
      const user = interaction.user;
      const guildId = interaction.guildId;

      // Defer the update to prevent timeout
      await interaction.deferUpdate();

      // Get data for all timeframes
      const today = getStartOfDayPacific();
      const weekStart = getStartOfWeekPacific();
      const monthStart = getStartOfMonthPacific();

      const [dailyAll, weeklyAll, monthlyAll] = await Promise.all([
        sessionService.getTopUsers(Timestamp.fromDate(today), 20, guildId!),
        sessionService.getTopUsers(Timestamp.fromDate(weekStart), 20, guildId!),
        sessionService.getTopUsers(Timestamp.fromDate(monthStart), 20, guildId!),
      ]);

      let embed: EmbedBuilder;

      if (selectedValue === 'overview') {
        // Overview: Top 3 from each timeframe + user position
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

        embed = new EmbedBuilder()
          .setColor(0xFFD900) // Yellow
          .setTitle('🏆 Your Leaderboard Position')
          .addFields(
            { name: '\u200B', value: formatLeaderboard(dailyAll, '📅', 'Daily'), inline: false },
            { name: '\u200B', value: formatLeaderboard(weeklyAll, '📊', 'Weekly'), inline: false },
            { name: '\u200B', value: formatLeaderboard(monthlyAll, '🌟', 'Monthly'), inline: false }
          )
          .setFooter({ text: 'Use the dropdown below to view full leaderboards' });
      } else if (selectedValue === 'xp') {
        // XP Leaderboard
        const xpUsers = await statsService.getTopUsersByXP(20);

        if (xpUsers.length === 0) {
          embed = new EmbedBuilder()
            .setColor(0xFFD900) // Yellow
            .setTitle('⚡ XP Leaderboard')
            .setDescription('No XP data yet! Complete sessions to earn XP! 🚀')
            .setFooter({ text: 'Use the dropdown below to view other timeframes' });
        } else {
          const top10 = xpUsers.slice(0, 10);
          const ranks: string[] = [];
          const names: string[] = [];
          const xpLevels: string[] = [];

          top10.forEach((u, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            ranks.push(medal);
            names.push(`**${u.username}** 🏆 ${u.achievementCount}`);
            xpLevels.push(`Lvl ${u.level} • ${u.xp.toLocaleString()} XP`);
          });

          // Add current user if not in top 10
          const userPosition = xpUsers.findIndex(u => u.userId === user.id);
          if (userPosition >= 10) {
            const currentUser = xpUsers[userPosition];
            ranks.push(`**#${userPosition + 1}**`);
            names.push(`**${currentUser.username}** 🏆 ${currentUser.achievementCount}`);
            xpLevels.push(`**Lvl ${currentUser.level} • ${currentUser.xp.toLocaleString()} XP**`);
          }

          embed = new EmbedBuilder()
            .setColor(0xFFD900) // Yellow
            .setTitle('⚡ XP Leaderboard')
            .addFields(
              { name: 'Rank', value: ranks.join('\n'), inline: true },
              { name: 'Name', value: names.join('\n'), inline: true },
              { name: 'Level • XP', value: xpLevels.join('\n'), inline: true }
            )
            .setFooter({ text: 'Complete sessions to earn XP and level up! 💪' });
        }
      } else {
        // Full leaderboard for specific time-based timeframe (sorted by hours)
        let users: Array<{ userId: string; username: string; totalDuration: number; sessionCount: number }>;
        let title: string;
        let emoji: string;

        if (selectedValue === 'daily') {
          users = dailyAll;
          title = '📅 Daily Leaderboard';
          emoji = '📅';
        } else if (selectedValue === 'weekly') {
          users = weeklyAll;
          title = '📊 Weekly Leaderboard';
          emoji = '📊';
        } else {
          users = monthlyAll;
          title = '🌟 Monthly Leaderboard';
          emoji = '🌟';
        }

        if (users.length === 0) {
          embed = new EmbedBuilder()
            .setColor(0xFFD900) // Yellow
            .setTitle(title)
            .setDescription('No sessions completed in this timeframe yet! Be the first! 🚀')
            .setFooter({ text: 'Use the dropdown below to view other timeframes' });
        } else {
          const top10 = users.slice(0, 10);
          const ranks: string[] = [];
          const names: string[] = [];
          const hours: string[] = [];

          top10.forEach((u, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            ranks.push(medal);
            names.push(`**${u.username}**`);
            hours.push(`${(u.totalDuration / 3600).toFixed(1)}h`);
          });

          // Add current user if not in top 10
          const userPosition = users.findIndex(u => u.userId === user.id);
          if (userPosition >= 10) {
            const currentUser = users[userPosition];
            ranks.push(`**#${userPosition + 1}**`);
            names.push(`**${currentUser.username}**`);
            hours.push(`**${(currentUser.totalDuration / 3600).toFixed(1)}h**`);
          }

          embed = new EmbedBuilder()
            .setColor(0xFFD900) // Yellow
            .setTitle(title)
            .addFields(
              { name: 'Rank', value: ranks.join('\n'), inline: true },
              { name: 'Name', value: names.join('\n'), inline: true },
              { name: 'Hours', value: hours.join('\n'), inline: true }
            )
            .setFooter({ text: 'Ranked by hours studied in this timeframe. Keep grinding! 💪' });
        }
      }

      // Keep the same select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('leaderboard_timeframe')
        .setPlaceholder('Select a timeframe to view')
        .addOptions([
          {
            label: 'Overview',
            description: 'Top 3 from each timeframe + your position',
            value: 'overview',
            emoji: '🏆',
          },
          {
            label: 'Daily Leaderboard',
            description: 'Full top 10 daily rankings by hours',
            value: 'daily',
            emoji: '📅',
          },
          {
            label: 'Weekly Leaderboard',
            description: 'Full top 10 weekly rankings by hours',
            value: 'weekly',
            emoji: '📊',
          },
          {
            label: 'Monthly Leaderboard',
            description: 'Full top 10 monthly rankings by hours',
            value: 'monthly',
            emoji: '🌟',
          },
          {
            label: 'XP Leaderboard',
            description: 'Top 10 by total XP and level',
            value: 'xp',
            emoji: '⚡',
          },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // Leaderboard image timeframe dropdown handler
    if (interaction.customId === 'leaderboard_image_timeframe') {
      const selectedTimeframe = interaction.values[0] as 'daily' | 'weekly' | 'monthly' | 'all-time';
      const user = interaction.user;
      const guildId = interaction.guildId;

      // Defer the update to prevent timeout
      await interaction.deferUpdate();

      try {
        // Get data based on timeframe - ALL timeframes filter by server
        let topUsers: Array<{ userId: string; username: string; totalDuration: number; xp?: number }> = [];

        if (selectedTimeframe === 'all-time') {
          // Get all-time top users by XP (from beginning of time) - filtered by server
          const allTimeStart = Timestamp.fromDate(new Date(0)); // Unix epoch
          topUsers = await sessionService.getTopUsers(allTimeStart, 20, guildId!);
        } else {
          let startTime: Date;
          if (selectedTimeframe === 'daily') {
            startTime = getStartOfDayPacific();
          } else if (selectedTimeframe === 'weekly') {
            startTime = getStartOfWeekPacific();
          } else {
            startTime = getStartOfMonthPacific();
          }

          topUsers = await sessionService.getTopUsers(Timestamp.fromDate(startTime), 20, guildId!);
        }

        // TEMPORARY: Use sample data if no real users (for testing)
        let entries: Array<{ userId: string; username: string; avatarUrl: string; xp: number; totalDuration: number; rank: number }> = [];
        let currentUserEntry = undefined;

        if (topUsers.length === 0) {
          // No real data, pass empty arrays - component will use sample data
          entries = [];
          currentUserEntry = undefined;
        } else {
          // Get top 10
          const top10 = topUsers.slice(0, 10);

          // Check if current user is in top 10
          const userPosition = topUsers.findIndex(u => u.userId === user.id);

          // Prepare leaderboard entries with avatars
          entries = await Promise.all(
            top10.map(async (u, index) => {
              try {
                const discordUser = await client.users.fetch(u.userId);
                const stats = await statsService.getUserStats(u.userId);
                const totalDuration = selectedTimeframe === 'all-time' ? (stats?.totalDuration || 0) : u.totalDuration;
                return {
                  userId: u.userId,
                  username: u.username,
                  avatarUrl: discordUser.displayAvatarURL({ size: 128, extension: 'png' }),
                  xp: stats?.xp || 0,
                  totalDuration,
                  rank: index + 1,
                };
              } catch (error) {
                console.error(`Failed to fetch user ${u.userId}:`, error);
                return {
                  userId: u.userId,
                  username: u.username,
                  avatarUrl: '',
                  xp: 0,
                  totalDuration: u.totalDuration,
                  rank: index + 1,
                };
              }
            })
          );

          // Prepare current user entry if they're not in top 10
          if (userPosition > 9) {
            const userStats = await statsService.getUserStats(user.id);
            currentUserEntry = {
              userId: user.id,
              username: user.username,
              avatarUrl: user.displayAvatarURL({ size: 128, extension: 'png' }),
              xp: userStats?.xp || 0,
              totalDuration: topUsers[userPosition].totalDuration,
              rank: userPosition + 1,
            };
          }
        }

        // Generate new leaderboard image
        const imageBuffer = await profileImageService.generateLeaderboardImage(
          selectedTimeframe,
          entries,
          currentUserEntry
        );

        const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });

        // Recreate the select menu
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('leaderboard_image_timeframe')
          .setPlaceholder('Select a timeframe')
          .addOptions([
            {
              label: 'Daily',
              description: 'Today\'s top performers',
              value: 'daily',
              emoji: '📅',
            },
            {
              label: 'Weekly',
              description: 'This week\'s leaders',
              value: 'weekly',
              emoji: '📊',
            },
            {
              label: 'Monthly',
              description: 'This month\'s champions',
              value: 'monthly',
              emoji: '🌟',
            },
            {
              label: 'All-Time',
              description: 'Lifetime XP rankings',
              value: 'all-time',
              emoji: '⚡',
            },
          ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        // Update with new image
        await interaction.editReply({
          files: [attachment],
          components: [row],
        });
      } catch (error) {
        console.error('Error updating leaderboard image:', error);
        await interaction.editReply({
          content: '❌ Failed to update leaderboard. Please try again later.',
          components: [],
        });
      }
      return;
    }

    // Goal completion dropdown handler
    if (interaction.customId.startsWith('goal_complete:')) {
      const userId = interaction.customId.split(':')[1];
      const goalId = interaction.values[0];

      // Only allow the owner to interact with their goal menu
      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: 'This goal menu belongs to someone else!',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferUpdate();

      try {
        // Complete the goal
        const result = await dailyGoalService.completeGoal(userId, goalId);
        const { goal, xpAwarded } = result;

        // Award XP to user
        let xpResult;
        try {
          xpResult = await xpService.awardXP(userId, xpAwarded, `Completed goal: ${goal.text}`);
        } catch (error) {
          console.log('User has no stats yet, skipping XP award');
        }

        // Build XP text
        const xpText = xpResult && xpResult.leveledUp
          ? `+${xpAwarded} XP • 🎉 Level ${xpResult.newLevel}!`
          : `+${xpAwarded} XP`;

        // Create completion embed
        const embed = new EmbedBuilder()
          .setColor(0x58CC02) // Green
          .setTitle('🎉 Goal Completed!')
          .setDescription(`**${goal.text}**`)
          .addFields(
            { name: 'XP Earned', value: xpText, inline: true },
            { name: 'Difficulty', value: `${goal.difficulty.charAt(0).toUpperCase() + goal.difficulty.slice(1)}`, inline: true }
          )
          .setFooter({ text: 'Great work! Keep setting and completing goals!' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      } catch (error) {
        console.error('Error completing goal:', error);
        await interaction.editReply({
          content: 'An error occurred while completing your goal. Please try again.',
          components: [],
        });
        return;
      }
    }

    // Achievement filter dropdown handler
    if (interaction.customId.startsWith('achievement_filter:')) {
      const userId = interaction.customId.split(':')[1];
      const selectedValue = interaction.values[0];

      // Only allow the owner to interact with their achievement menu
      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: 'This achievement menu belongs to someone else!',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferUpdate();

      const userAchievements = await achievementService.getUserAchievements(userId);
      const allAchievements = getAllAchievements();

      // Get unlocked achievement IDs
      const unlockedIds = new Set(userAchievements.map(b => b.id));

      // Separate unlocked and locked achievements
      const unlockedAchievements = allAchievements.filter(b => unlockedIds.has(b.id)).sort((a, b) => a.order - b.order);
      const lockedAchievements = allAchievements.filter(b => !unlockedIds.has(b.id)).sort((a, b) => a.order - b.order);

      // Create achievement list based on selection
      let achievementList: string;
      if (selectedValue === 'unlocked') {
        achievementList = unlockedAchievements.length > 0
          ? unlockedAchievements.map(b => `${b.emoji} **${b.name}** - *${b.description}*`).join('\n')
          : '*No achievements unlocked yet. Keep studying to earn your first achievement!*';
      } else {
        achievementList = lockedAchievements.length > 0
          ? lockedAchievements.map(b => `🔒 ${b.emoji} **${b.name}** - *${b.description}*`).join('\n')
          : '*You\'ve unlocked all achievements! Amazing work!*';
      }

      const user = await interaction.client.users.fetch(userId);
      const avatarUrl = user.displayAvatarURL({ size: 128 });

      const embed = new EmbedBuilder()
        .setColor(0xFFD900) // Gold
        .setTitle(`🏆 Your Achievements (${unlockedAchievements.length}/${allAchievements.length})`)
        .setDescription(achievementList)
        .setFooter({
          text: user.username,
          iconURL: avatarUrl
        });

      // Recreate dropdown menu with updated default
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`achievement_filter:${userId}`)
        .setPlaceholder('Filter achievements')
        .addOptions([
          {
            label: 'Unlocked',
            description: `View your ${unlockedAchievements.length} unlocked achievements`,
            value: 'unlocked',
            emoji: '✅',
            default: selectedValue === 'unlocked',
          },
          {
            label: 'Locked',
            description: `View ${lockedAchievements.length} achievements you haven't earned yet`,
            value: 'locked',
            emoji: '🔒',
            default: selectedValue === 'locked',
          },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // Stats graph metric/timeframe selection handler
    if (interaction.customId.startsWith('stats-metric:') || interaction.customId.startsWith('stats-timeframe:')) {
      // Extract user ID from custom ID
      const parts = interaction.customId.split(':');
      const userId = parts[1];

      // Only allow the owner to interact with their stats menu
      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: 'This stats menu belongs to someone else!',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferUpdate();

      if (!client.statsSelections) {
        client.statsSelections = new Map();
      }

      const currentSelection = client.statsSelections.get(userId) || { metric: 'hours', timeframe: 'week' };

      if (interaction.customId.startsWith('stats-metric:')) {
        currentSelection.metric = interaction.values[0] as 'hours' | 'xp' | 'sessions' | 'totalHours';
      } else {
        currentSelection.timeframe = interaction.values[0] as 'week' | 'month' | 'year';
      }

      client.statsSelections.set(userId, currentSelection);

      try {
        // Get historical data
        const chartData = await statsService.getHistoricalChartData(
          userId,
          currentSelection.metric,
          currentSelection.timeframe
        );

        // Get avatar URL
        const avatarUrl = interaction.user.displayAvatarURL({ size: 256, extension: 'png' });

        // Generate stats chart image
        const imageBuffer = await statsImageService.generateStatsImage(
          interaction.user.username,
          currentSelection.metric,
          currentSelection.timeframe,
          chartData.data,
          chartData.currentValue,
          chartData.previousValue,
          avatarUrl
        );

        // Create attachment
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'stats-chart.png' });

        // Recreate dropdown menus with updated defaults
        const metricMenu = new StringSelectMenuBuilder()
          .setCustomId(`stats-metric:${userId}`)
          .setPlaceholder('Change metric')
          .addOptions([
            {
              label: 'Hours Studied',
              description: 'View your study hours over time',
              value: 'hours',
              emoji: '⏱️',
              default: currentSelection.metric === 'hours',
            },
            {
              label: 'Total Hours',
              description: 'View cumulative hours studied',
              value: 'totalHours',
              emoji: '📈',
              default: currentSelection.metric === 'totalHours',
            },
            {
              label: 'XP Earned',
              description: 'View your XP gains over time',
              value: 'xp',
              emoji: '⚡',
              default: currentSelection.metric === 'xp',
            },
            {
              label: 'Sessions Completed',
              description: 'View your session count over time',
              value: 'sessions',
              emoji: '📚',
              default: currentSelection.metric === 'sessions',
            },
          ]);

        const timeframeMenu = new StringSelectMenuBuilder()
          .setCustomId(`stats-timeframe:${userId}`)
          .setPlaceholder('Change timeframe')
          .addOptions([
            {
              label: 'Past 7 Days',
              description: 'View last week\'s stats',
              value: 'week',
              emoji: '📅',
              default: currentSelection.timeframe === 'week',
            },
            {
              label: 'Past 30 Days',
              description: 'View last month\'s stats',
              value: 'month',
              emoji: '📆',
              default: currentSelection.timeframe === 'month',
            },
            {
              label: 'Past Year',
              description: 'View yearly stats',
              value: 'year',
              emoji: '📊',
              default: currentSelection.timeframe === 'year',
            },
          ]);

        const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeframeMenu);
        const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(metricMenu);

        // Update the message with the new chart (timeframe first, then metric)
        await interaction.editReply({
          files: [attachment],
          components: [row1, row2],
        });
      } catch (error) {
        console.error('Error generating stats chart:', error);
        await interaction.followUp({
          content: '❌ Failed to generate stats chart. Please try again later.',
          ephemeral: true,
        });
      }
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, guildId } = interaction;

  // Log command usage
  console.log(`[${new Date().toISOString()}] ${user.username} (${user.id}) used /${commandName} in guild ${guildId}`);

  try {
    // /help command
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x1CB0F6) // Blue
        .setTitle('📚 Study Together Bot - Commands')
        .setDescription('Track your productivity and compete with friends!')
        .addFields(
          {
            name: '🎯 Session Management',
            value:
              '`/start {activity}` - Start a new session\n' +
              '`/time` - Check your current session status\n' +
              '`/pause` - Pause your active session\n' +
              '`/unpause` - Unpause your paused session\n' +
              '`/stop` - Complete and share your session\n' +
              '`/cancel` - Cancel session without saving\n' +
              '`/manual` - Log a past session manually',
            inline: false
          },
          {
            name: '📊 Statistics & Leaderboards',
            value:
              '`/stats` - View your personal statistics\n' +
              '`/leaderboard` - Interactive leaderboard with daily/weekly/monthly views\n' +
              '`/achievements` - View your achievements\n' +
              '`/profile [@user]` - View detailed user profile',
            inline: false
          },
          {
            name: '🎯 Goals',
            value:
              '`/goal add {goal} {difficulty}` - Add a new goal (Easy: 50 XP, Medium: 100 XP, Hard: 200 XP)\n' +
              '`/goal complete` - Mark a goal as complete and earn XP\n' +
              '`/goal list` - View all your active goals',
            inline: false
          },
          {
            name: '👥 Social',
            value:
              '`/live` - See who\'s currently studying',
            inline: false
          },
          {
            name: '⚙️ Server Setup (Admin Only)',
            value:
              '`/setup-feed {channel}` - Set feed channel for session posts\n' +
              '`/set-welcome-channel {channel}` - Set welcome channel for new members\n' +
              '`/setup-events-channel {channel}` - Set events channel for study events',
            inline: false
          },
          {
            name: '💡 Tips',
            value:
              '• Earn XP and level up by completing sessions (10 XP/hour + bonuses)\n' +
              '• Unlock 20 achievements by hitting milestones\n' +
              '• React to others\' session posts to unlock social achievements\n' +
              '• Build streaks by completing sessions daily',
            inline: false
          }
        )
        .setFooter({ text: 'Start your journey with /start {activity}' });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
      return;
    }

    // /goal command
    if (commandName === 'goal') {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'add') {
        // /goal add
        const goalText = interaction.options.getString('goal', true);
        const difficulty = interaction.options.getString('difficulty', true) as 'easy' | 'medium' | 'hard';

        await interaction.deferReply({ ephemeral: false });

        try {
          // Add the goal
          const newGoal = await dailyGoalService.addGoal(user.id, user.username, goalText, difficulty);

          const xpAmount = difficulty === 'easy' ? 50 : difficulty === 'medium' ? 100 : 200;

          const embed = new EmbedBuilder()
            .setColor(0x58CC02) // Green
            .setTitle('✅ Goal Added!')
            .setDescription(`**${goalText}**`)
            .addFields(
              { name: 'Difficulty', value: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`, inline: true },
              { name: 'Reward', value: `${xpAmount} XP upon completion`, inline: true }
            )
            .setFooter({ text: 'Use /goal complete to mark as done!' })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        } catch (error) {
          console.error('Error adding goal:', error);
          await interaction.editReply({
            content: 'An error occurred while adding your goal. Please try again.',
          });
          return;
        }
      }

      if (subcommand === 'complete') {
        // /goal complete
        await interaction.deferReply({ ephemeral: false });

        try {
          // Get active goals
          const activeGoals = await dailyGoalService.getActiveGoals(user.id);

          if (activeGoals.length === 0) {
            await interaction.editReply({
              content: 'You have no active goals! Use `/goal add` to create one.',
            });
            return;
          }

          // Create select menu for goal selection
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`goal_complete:${user.id}`)
            .setPlaceholder('Select a goal to mark as complete')
            .addOptions(
              activeGoals.map((goal) => {
                const xpAmount = goal.difficulty === 'easy' ? 50 : goal.difficulty === 'medium' ? 100 : 200;

                return {
                  label: goal.text.substring(0, 100), // Discord limit
                  description: `${goal.difficulty.charAt(0).toUpperCase() + goal.difficulty.slice(1)} - ${xpAmount} XP`,
                  value: goal.id,
                };
              })
            );

          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

          const embed = new EmbedBuilder()
            .setColor(0x1CB0F6) // Blue
            .setTitle('🎯 Complete a Goal')
            .setDescription('Select which goal you completed:')
            .setFooter({ text: `${activeGoals.length} active ${activeGoals.length === 1 ? 'goal' : 'goals'}` });

          await interaction.editReply({ embeds: [embed], components: [row] });
          return;
        } catch (error) {
          console.error('Error showing goals for completion:', error);
          await interaction.editReply({
            content: 'An error occurred while loading your goals. Please try again.',
          });
          return;
        }
      }

      if (subcommand === 'list') {
        // /goal list
        await interaction.deferReply({ ephemeral: false });

        try {
          const allGoals = await dailyGoalService.getAllGoals(user.id);

          if (allGoals.length === 0) {
            await interaction.editReply({
              content: 'You have no goals yet! Use `/goal add` to create one.',
            });
            return;
          }

          const activeGoals = allGoals.filter(g => !g.isCompleted);
          const completedGoals = allGoals.filter(g => g.isCompleted);

          const embed = new EmbedBuilder()
            .setColor(0xFFD900) // Yellow
            .setTitle('📋 Your Goals');

          // Add active goals
          if (activeGoals.length > 0) {
            const activeList = activeGoals.map((goal) => {
              const xpAmount = goal.difficulty === 'easy' ? 50 : goal.difficulty === 'medium' ? 100 : 200;
              return `**${goal.text}** (${xpAmount} XP)`;
            }).join('\n');

            embed.addFields({ name: '🎯 Active Goals', value: activeList, inline: false });
          } else {
            embed.addFields({ name: '🎯 Active Goals', value: 'No active goals! Use `/goal add` to create one.', inline: false });
          }

          // Show completed count only
          embed.setFooter({
            text: `${activeGoals.length} active • ${completedGoals.length} completed`
          });

          await interaction.editReply({ embeds: [embed] });
          return;
        } catch (error) {
          console.error('Error listing goals:', error);
          await interaction.editReply({
            content: 'An error occurred while loading your goals. Please try again.',
          });
          return;
        }
      }
    }

    // /createevent command
    if (commandName === 'createevent') {
      await interaction.deferReply({ ephemeral: true });

      // Get server config for timezone
      const config = await getServerConfig(interaction.guildId!);
      const timezone = config?.timezone || 'America/Los_Angeles'; // Default to PT if not set

      // Create initial event builder embed
      const builderId = `event_builder:${user.id}:${Date.now()}`;

      // Initialize builder state
      eventBuilders.set(builderId, {
        userId: user.id,
        studyType: 'conversation',
        timezone
      });

      const builderEmbed = new EmbedBuilder()
        .setColor(0x1CB0F6) // Blue
        .setTitle('📅 Create Study Event')
        .setDescription('Use the buttons and dropdown below to configure your event.')
        .addFields(
          { name: '📝 Title', value: '*Not set*', inline: false },
          { name: '📍 Location', value: '*Not set*', inline: false },
          { name: '⏰ Start Time', value: '*Not set*', inline: true },
          { name: '⏱️ Duration', value: 'No limit', inline: true },
          { name: '🎯 Study Type', value: 'Conversation Allowed', inline: false },
          { name: '👥 Max Attendees', value: 'Unlimited', inline: true },
          { name: '📝 More Info', value: '*None*', inline: false }
        )
        .setFooter({ text: 'Configure all required fields (*) then click Create Event' });

      // Study type dropdown
      const studyTypeSelect = new StringSelectMenuBuilder()
        .setCustomId(`${builderId}:study_type`)
        .setPlaceholder('Select study type')
        .addOptions([
          {
            label: 'Silent Study',
            description: 'Quiet, focused work session',
            value: 'silent',
            emoji: '🤫'
          },
          {
            label: 'Conversation Allowed',
            description: 'Talking and discussion permitted',
            value: 'conversation',
            emoji: '💬'
          },
          {
            label: 'Pomodoro Session',
            description: 'Structured breaks (25min work, 5min break)',
            value: 'pomodoro',
            emoji: '🍅'
          },
          {
            label: 'Custom',
            description: 'Define your own study style',
            value: 'custom',
            emoji: '✨'
          }
        ]);

      // Action buttons
      const setTitleBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_title`)
        .setLabel('Set Title')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝');

      const setLocationBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_location`)
        .setLabel('Set Location')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📍');

      const setTimeBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_time`)
        .setLabel('Set Time')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏰');

      const setDurationBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_duration`)
        .setLabel('Set Duration')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏱️');

      const setMaxBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_max`)
        .setLabel('Set Max')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👥');

      const setDescBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_description`)
        .setLabel('Set Description')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📄');

      const createBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:create`)
        .setLabel('Create Event')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const cancelBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:cancel`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(studyTypeSelect);
      const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(setTitleBtn, setLocationBtn, setTimeBtn, setDurationBtn);
      const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(setMaxBtn, setDescBtn);
      const buttonRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, cancelBtn);

      await interaction.editReply({
        embeds: [builderEmbed],
        components: [selectRow, buttonRow1, buttonRow2, buttonRow3]
      });
      return;
    }

    // /events command
    if (commandName === 'events') {
      await interaction.deferReply({ ephemeral: false });

      try {
        const events = await eventService.getUpcomingEvents(guildId!);

        if (events.length === 0) {
          await interaction.editReply({
            content: 'No upcoming events! Use `/createevent` to create one.',
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x1CB0F6) // Blue
          .setTitle('📅 Upcoming Study Events')
          .setDescription(`${events.length} event${events.length === 1 ? '' : 's'} scheduled`)
          .setTimestamp();

        // Add each event as a field
        for (const event of events.slice(0, 10)) {
          const startTime = event.startTime.toDate();
          const discordTimestamp = `<t:${Math.floor(startTime.getTime() / 1000)}:F>`;
          const relativeTime = `<t:${Math.floor(startTime.getTime() / 1000)}:R>`;

          const studyTypeEmoji = {
            silent: '🤫',
            conversation: '💬',
            pomodoro: '🍅',
            custom: '✨'
          };

          const spotsText = event.maxAttendees
            ? `${event.attendees.length}/${event.maxAttendees} spots filled`
            : `${event.attendees.length} attending`;

          embed.addFields({
            name: `${studyTypeEmoji[event.studyType]} ${event.title}`,
            value: [
              `📍 **Location:** ${event.location}`,
              `⏰ **When:** ${discordTimestamp} (${relativeTime})`,
              `⏱️ **Duration:** ${event.duration} minutes`,
              `👥 **Attendees:** ${spotsText}`,
              `🎯 **Type:** ${event.studyType === 'custom' ? event.customType : event.studyType}`,
              event.description ? `📝 ${event.description}` : '',
              `**Event ID:** \`${event.eventId}\``
            ].filter(Boolean).join('\n'),
            inline: false
          });
        }

        if (events.length > 10) {
          embed.setFooter({ text: `Showing first 10 of ${events.length} events` });
        }

        // Add buttons for joining/leaving events
        const joinButton = new ButtonBuilder()
          .setCustomId('event_list_join')
          .setLabel('Join Event')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅');

        const leaveButton = new ButtonBuilder()
          .setCustomId('event_list_leave')
          .setLabel('Leave Event')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌');

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, leaveButton);

        await interaction.editReply({ embeds: [embed], components: [buttonRow] });
        return;
      } catch (error) {
        console.error('Error fetching events:', error);
        await interaction.editReply({
          content: 'An error occurred while fetching events. Please try again.',
        });
        return;
      }
    }

    // /myevents command
    if (commandName === 'myevents') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const events = await eventService.getUserEvents(user.id, guildId!);

        if (events.length === 0) {
          await interaction.editReply({
            content: 'You haven\'t RSVP\'d to any events yet! Use `/events` to see upcoming events.',
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0xFFD900) // Yellow
          .setTitle('📅 Your Events')
          .setDescription(`You're attending ${events.length} event${events.length === 1 ? '' : 's'}`)
          .setTimestamp();

        // Add each event as a field
        for (const event of events) {
          const startTime = event.startTime.toDate();
          const discordTimestamp = `<t:${Math.floor(startTime.getTime() / 1000)}:F>`;
          const relativeTime = `<t:${Math.floor(startTime.getTime() / 1000)}:R>`;

          const isCreator = event.creatorId === user.id;

          embed.addFields({
            name: `${isCreator ? '👑 ' : ''}${event.title}`,
            value: [
              `📍 **Location:** ${event.location}`,
              `⏰ **When:** ${discordTimestamp} (${relativeTime})`,
              `⏱️ **Duration:** ${event.duration} minutes`,
              isCreator ? '👑 You created this event' : '',
              `**Event ID:** \`${event.eventId}\``
            ].filter(Boolean).join('\n'),
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      } catch (error) {
        console.error('Error fetching user events:', error);
        await interaction.editReply({
          content: 'An error occurred while fetching your events. Please try again.',
        });
        return;
      }
    }

    // /cancelevent command
    if (commandName === 'cancelevent') {
      const eventId = interaction.options.getString('event', true);

      await interaction.deferReply({ ephemeral: true });

      try {
        const result = await eventService.cancelEvent(eventId, user.id);

        if (!result.success) {
          await interaction.editReply({
            content: result.message,
          });
          return;
        }

        // Get the event to notify attendees
        const event = await eventService.getEvent(eventId);
        if (event && event.messageId && event.channelId) {
          try {
            const channel = await client.channels.fetch(event.channelId) as TextChannel;
            if (channel) {
              const message = await channel.messages.fetch(event.messageId);
              if (message) {
                // Update the message to show it's cancelled
                const cancelledEmbed = new EmbedBuilder()
                  .setColor(0xFF6B6B) // Red (error/cancel)
                  .setTitle(`❌ CANCELLED: ${event.title}`)
                  .setDescription(`This event has been cancelled by the organizer.`)
                  .addFields(
                    { name: '📍 Location', value: event.location, inline: true },
                    { name: '⏰ Was scheduled for', value: `<t:${Math.floor(event.startTime.toDate().getTime() / 1000)}:F>`, inline: true }
                  )
                  .setTimestamp();

                await message.edit({ embeds: [cancelledEmbed], components: [] });
              }
            }
          } catch (error) {
            console.error('Error updating event message:', error);
          }
        }

        await interaction.editReply({
          content: '✅ Event cancelled successfully.',
        });
        return;
      } catch (error) {
        console.error('Error cancelling event:', error);
        await interaction.editReply({
          content: 'An error occurred while cancelling the event. Please try again.',
        });
        return;
      }
    }

    // /start command
    if (commandName === 'start') {
      const activity = interaction.options.getString('activity', true);

      // Check if user already has an active session
      const existingSession = await sessionService.getActiveSession(user.id);

      if (existingSession) {
        await interaction.reply({
          content:
            'You already have an active session! Use /stop to complete it first.',
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
        content: `🚀 You're live! Your session is now active.\n\n**Working on:** ${activity}`,
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
      await interaction.deferReply({ ephemeral: false });

      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.editReply({
          content:
            'No active session. Use /start {activity} to begin tracking!',
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

      await interaction.editReply({
        content: `**Current Session**

**Status:** ${pauseStatus}
**Activity:** ${session.activity}
**Elapsed Time:** ${elapsedStr}`,
      });
      return;
    }

    // /pause command
    if (commandName === 'pause') {
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session to pause.',
          ephemeral: false,
        });
        return;
      }

      if (session.isPaused) {
        await interaction.reply({
          content: 'Session is already paused.',
          ephemeral: false,
        });
        return;
      }

      await sessionService.updateActiveSession(user.id, {
        isPaused: true,
        pausedAt: Timestamp.now(),
      });

      await interaction.reply({
        content: '⏸️ Session paused. Use /unpause when ready to continue.',
        ephemeral: false,
      });
      return;
    }

    // /unpause command
    if (commandName === 'unpause') {
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session to unpause.',
          ephemeral: false,
        });
        return;
      }

      if (!session.isPaused) {
        await interaction.reply({
          content: 'Session is not paused.',
          ephemeral: false,
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
        content: `▶️ Session unpaused!\n\n**Elapsed Time:** ${elapsedStr}`,
        ephemeral: false,
      });
      return;
    }

    // /cancel command
    if (commandName === 'cancel') {
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session to cancel.',
          ephemeral: false,
        });
        return;
      }

      await sessionService.deleteActiveSession(user.id);

      await interaction.reply({
        content:
          '❌ Session cancelled. No stats were updated and nothing was posted to the feed.',
        ephemeral: false,
      });
      return;
    }

    // /stop command
    if (commandName === 'stop') {
      // Check if command is used in a server (not DMs)
      if (!guildId) {
        await interaction.reply({
          content: '❌ Please use `/stop` in your server to post your session to the feed!',
          ephemeral: true,
        });
        return;
      }

      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session found! Use /start first.',
          ephemeral: false,
        });
        return;
      }

      // Calculate duration to show in modal
      const duration = calculateDuration(
        session.startTime,
        session.pausedDuration,
        session.isPaused ? session.pausedAt : undefined
      );
      const durationStr = formatDuration(duration);

      // Create modal for session completion
      const modal = new ModalBuilder()
        .setCustomId('endSessionModal')
        .setTitle(`Complete Session (${durationStr})`);

      // Title input
      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Session Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Finished chapter 5, Fixed login bug')
        .setRequired(true)
        .setMaxLength(100);

      // Description input
      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('What did you accomplish?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Share what you worked on and what you achieved...')
        .setRequired(true)
        .setMaxLength(1000);

      // Intensity input (1-5 scale)
      const intensityInput = new TextInputBuilder()
        .setCustomId('intensity')
        .setLabel('Session Intensity (1-5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1=Light, 2=Easy, 3=Normal, 4=Hard, 5=Max Effort')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1);

      // Add inputs to action rows
      const titleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
      const descriptionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
      const intensityRow = new ActionRowBuilder<TextInputBuilder>().addComponents(intensityInput);

      modal.addComponents(titleRow, descriptionRow, intensityRow);

      await interaction.showModal(modal);
      return;
    }

    // /stats command - Show detailed statistics with dropdown and graph button
    if (commandName === 'stats') {
      const stats = await statsService.getUserStats(user.id);

      if (!stats) {
        await interaction.reply({
          content:
            'No stats yet! Complete your first session with /start and /stop.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: false });

      // Default to weekly hours
      const defaultMetric = 'hours';
      const defaultTimeframe = 'week';

      // Calculate stats for all timeframes
      const today = getStartOfDayPacific();
      const todaySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(today)
      );

      // Use rolling 7-day window (same as /graph)
      const now = new Date();
      const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const weeklySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(weekStart)
      );

      const monthStart = getStartOfMonthPacific();
      const monthlySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(monthStart)
      );

      const allSessions = await sessionService.getCompletedSessions(user.id);

      // Get previous week sessions for comparison (7-13 days ago)
      const twoWeeksAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
      twoWeeksAgo.setHours(0, 0, 0, 0);
      const allPreviousWeekSessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(twoWeeksAgo)
      );
      const previousWeekSessions = allPreviousWeekSessions.filter(s =>
        s.endTime.toDate() < weekStart
      );

      // Calculate current and previous values for weekly hours
      const currentValue = Math.round(weeklySessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
      const previousValue = Math.round(previousWeekSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);

      // Calculate breakdown by day (last 7 days)
      const breakdown = [];
      const dayStart = new Date(weekStart);
      let highlightIndex = -1;

      for (let i = 0; i < 7; i++) {
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const daySessions = weeklySessions.filter(s => {
          const sessionDate = s.endTime.toDate();
          return sessionDate >= dayStart && sessionDate < dayEnd;
        });

        const dayHours = Math.round(daySessions.reduce((sum, s) => sum + s.duration, 0) / 3600);

        // Check if this is today
        const isToday = dayStart.toDateString() === now.toDateString();
        if (isToday) {
          highlightIndex = i;
        }

        // Get day name - use "Today" for current day
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = isToday ? 'Today' : days[dayStart.getDay()];

        breakdown.push({ label: dayName, value: dayHours });

        dayStart.setDate(dayStart.getDate() + 1);
      }

      // Get user avatar
      const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

      // Generate stats image
      const imageBuffer = await statsOverviewImageService.generateStatsOverviewImage(
        user.username,
        defaultMetric as 'hours' | 'sessions' | 'xp',
        defaultTimeframe as 'today' | 'week' | 'month' | 'all-time',
        currentValue,
        previousValue,
        breakdown,
        avatarUrl,
        highlightIndex
      );

      const attachment = new AttachmentBuilder(imageBuffer, {
        name: 'stats-overview.png',
      });

      // Create dropdown menu for metric/timeframe selection
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`stats_select_${user.id}`)
        .setPlaceholder('Change metric or timeframe')
        .addOptions([
          {
            label: '⏱️ Hours - This Week',
            description: 'View your total hours for this week',
            value: 'hours_week',
            default: true,
          },
          {
            label: '⏱️ Hours - This Month',
            description: 'View your total hours for this month',
            value: 'hours_month',
          },
          {
            label: '⏱️ Hours - All Time',
            description: 'View your total hours all time',
            value: 'hours_all-time',
          },
          {
            label: '📚 Sessions - This Week',
            description: 'View your total sessions for this week',
            value: 'sessions_week',
          },
          {
            label: '📚 Sessions - This Month',
            description: 'View your total sessions for this month',
            value: 'sessions_month',
          },
          {
            label: '📚 Sessions - All Time',
            description: 'View your total sessions all time',
            value: 'sessions_all-time',
          },
          {
            label: '⚡ XP - This Week',
            description: 'View your total XP for this week',
            value: 'xp_week',
          },
          {
            label: '⚡ XP - This Month',
            description: 'View your total XP for this month',
            value: 'xp_month',
          },
          {
            label: '⚡ XP - All Time',
            description: 'View your total XP all time',
            value: 'xp_all-time',
          },
        ]);

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      // Create "View Graph" button
      const graphButton = new ButtonBuilder()
        .setCustomId(`view_graph_${user.id}`)
        .setLabel('View Graph')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊');

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(graphButton);

      await interaction.editReply({
        files: [attachment],
        components: [selectRow, buttonRow],
      });
      return;
    }

    if (commandName === 'achievements') {
      const stats = await statsService.getUserStats(user.id);

      if (!stats) {
        await interaction.reply({
          content: 'No stats yet! Complete sessions to unlock achievements.',
          ephemeral: true,
        });
        return;
      }

      const userAchievements = await achievementService.getUserAchievements(user.id);
      const allAchievements = getAllAchievements();

      // Get unlocked achievement IDs for quick lookup
      const unlockedIds = new Set(userAchievements.map(b => b.id));

      // Separate unlocked and locked achievements
      const unlockedAchievements = allAchievements.filter(b => unlockedIds.has(b.id)).sort((a, b) => a.order - b.order);
      const lockedAchievements = allAchievements.filter(b => !unlockedIds.has(b.id)).sort((a, b) => a.order - b.order);

      // Create achievement list (show unlocked by default)
      const achievementList = unlockedAchievements.length > 0
        ? unlockedAchievements.map(b => `${b.emoji} **${b.name}** - *${b.description}*`).join('\n')
        : '*No achievements unlocked yet. Keep studying to earn your first achievement!*';

      const avatarUrl = user.displayAvatarURL({ size: 128 });

      const embed = new EmbedBuilder()
        .setColor(0xFFD900) // Gold
        .setTitle(`🏆 Your Achievements (${unlockedAchievements.length}/${allAchievements.length})`)
        .setDescription(achievementList)
        .setFooter({
          text: user.username,
          iconURL: avatarUrl
        });

      // Create dropdown menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`achievement_filter:${user.id}`)
        .setPlaceholder('Filter achievements')
        .addOptions([
          {
            label: 'Unlocked',
            description: `View your ${unlockedAchievements.length} unlocked achievements`,
            value: 'unlocked',
            emoji: '✅',
            default: true,
          },
          {
            label: 'Locked',
            description: `View ${lockedAchievements.length} achievements you haven't earned yet`,
            value: 'locked',
            emoji: '🔒',
          },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: false,
      });
      return;
    }

    // /profile command - View user profile with comprehensive stats
    if (commandName === 'profile') {
      await interaction.deferReply({ ephemeral: false });

      try {
        const targetUser = interaction.options.getUser('user') || user;
        const stats = await statsService.getUserStats(targetUser.id);

        if (!stats) {
          await interaction.editReply({
            content: `${targetUser.id === user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} completed any sessions yet!`,
          });
          return;
        }

        // Get avatar URL
        const avatarUrl = targetUser.displayAvatarURL({ size: 256, extension: 'png' });

        // Generate profile image
        const imageBuffer = await profileImageService.generateProfileImage(
          targetUser.username,
          stats,
          avatarUrl
        );

        // Create attachment
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });

        // Send the image
        await interaction.editReply({
          files: [attachment],
        });
      } catch (error) {
        console.error('Error generating profile image:', error);
        await interaction.editReply({
          content: '❌ Failed to generate profile image. Please try again later.',
        });
      }
      return;
    }


    // /me command - Generate profile image
    if (commandName === 'me') {
      await interaction.deferReply({ ephemeral: false });

      try {
        // Get user stats
        const stats = await statsService.getUserStats(user.id);

        // Get avatar URL
        const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

        // Generate profile image
        const imageBuffer = await profileImageService.generateProfileImage(
          user.username,
          stats,
          avatarUrl
        );

        // Create attachment
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });

        // Create "View Graph" and "View Statistics" buttons
        const graphButton = new ButtonBuilder()
          .setCustomId(`view_graph_${user.id}`)
          .setLabel('View Graph')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊');

        const statsButton = new ButtonBuilder()
          .setCustomId(`view_stats_${user.id}`)
          .setLabel('View Statistics')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📈');

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(graphButton, statsButton);

        // Send the image with buttons
        await interaction.editReply({
          files: [attachment],
          components: [buttonRow],
        });
      } catch (error) {
        console.error('Error generating profile image:', error);
        await interaction.editReply({
          content: '❌ Failed to generate profile image. Please try again later.',
        });
      }
      return;
    }

    // /graph command - Auto-generate weekly hours chart with dropdown selectors below
    if (commandName === 'graph') {
      await interaction.deferReply({ ephemeral: false });

      try {
        // Default: Hours over the past week
        const defaultMetric = 'hours';
        const defaultTimeframe = 'week';

        // Get historical data
        const chartData = await statsService.getHistoricalChartData(
          user.id,
          defaultMetric,
          defaultTimeframe
        );

        console.log(`[/graph] Fetched chart data for ${user.username}:`, {
          dataPoints: chartData.data.length,
          currentValue: chartData.currentValue,
          previousValue: chartData.previousValue,
          data: chartData.data
        });

        // Get avatar URL
        const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

        // Generate stats chart image
        const imageBuffer = await statsImageService.generateStatsImage(
          user.username,
          defaultMetric,
          defaultTimeframe,
          chartData.data,
          chartData.currentValue,
          chartData.previousValue,
          avatarUrl
        );

        // Create attachment
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'stats-chart.png' });

        // Create dropdown menus for metric and timeframe selection
        const metricMenu = new StringSelectMenuBuilder()
          .setCustomId(`stats-metric:${user.id}`)
          .setPlaceholder('Change metric')
          .addOptions([
            {
              label: 'Hours Studied',
              description: 'View your study hours over time',
              value: 'hours',
              emoji: '⏱️',
              default: true,
            },
            {
              label: 'Total Hours',
              description: 'View cumulative hours studied',
              value: 'totalHours',
              emoji: '📈',
            },
            {
              label: 'XP Earned',
              description: 'View your XP gains over time',
              value: 'xp',
              emoji: '⚡',
            },
            {
              label: 'Sessions Completed',
              description: 'View your session count over time',
              value: 'sessions',
              emoji: '📚',
            },
          ]);

        const timeframeMenu = new StringSelectMenuBuilder()
          .setCustomId(`stats-timeframe:${user.id}`)
          .setPlaceholder('Change timeframe')
          .addOptions([
            {
              label: 'Past 7 Days',
              description: 'View last week\'s stats',
              value: 'week',
              emoji: '📅',
              default: true,
            },
            {
              label: 'Past 30 Days',
              description: 'View last month\'s stats',
              value: 'month',
              emoji: '📆',
            },
            {
              label: 'Past Year',
              description: 'View yearly stats',
              value: 'year',
              emoji: '📊',
            },
          ]);

        const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeframeMenu);
        const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(metricMenu);

        // Initialize the user's selection state
        if (!client.statsSelections) {
          client.statsSelections = new Map();
        }
        client.statsSelections.set(user.id, { metric: defaultMetric, timeframe: defaultTimeframe });

        // Send the chart with dropdown menus below (timeframe first, then metric)
        await interaction.editReply({
          files: [attachment],
          components: [row1, row2],
        });
      } catch (error) {
        console.error('Error generating stats chart:', error);
        await interaction.editReply({
          content: '❌ Failed to generate stats chart. Please try again later.',
        });
      }
      return;
    }

    // /post command - Preview session completion post
    if (commandName === 'post') {
      await interaction.deferReply({ ephemeral: false });

      try {
        // Get user stats for realistic sample data
        const stats = await statsService.getUserStats(user.id);
        const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

        // Create sample session data based on user's recent activity
        const sampleDuration = '2h 15m';
        const sampleXp = 135; // Sample XP value
        const sampleActivity = 'Math homework';
        const sampleIntensity = 3; // Moderate intensity
        const sampleTitle = 'Productive study session';
        const sampleDescription = 'Completed calculus problems and reviewed chapter 5';

        // Format sample date
        const now = new Date();
        const sampleDate = now.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        // Generate the session post image
        const imageBuffer = await postImageService.generateSessionPostImage(
          user.username,
          sampleDuration,
          sampleXp,
          sampleActivity,
          sampleIntensity,
          avatarUrl,
          sampleTitle,
          sampleDescription,
          sampleDate
        );

        // Create attachment
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'session-post.png' });

        // Send the preview
        await interaction.editReply({
          content: '✨ **Session Post Preview**\nThis is what your completed session posts will look like in the feed!',
          files: [attachment],
        });
      } catch (error) {
        console.error('Error generating post preview:', error);
        await interaction.editReply({
          content: '❌ Failed to generate post preview. Please try again later.',
        });
      }
      return;
    }

    // /live command - Show who's currently studying in this server
    if (commandName === 'live') {
      await interaction.deferReply({ ephemeral: false });
      const activeSessions = await sessionService.getActiveSessionsByServer(guildId!);
      const totalLive = activeSessions.length;

      if (totalLive === 0) {
        await interaction.editReply({
          content: '👻 Nobody is studying right now. Be the first! Use /start to begin.',
        });
        return;
      }

      try {
        // Build user list with avatars and durations
        const usersWithDurations = await Promise.all(
          activeSessions.map(async (session) => {
            const elapsed = calculateDuration(
              session.startTime,
              session.pausedDuration,
              session.isPaused ? session.pausedAt : undefined
            );
            const elapsedStr = formatDuration(elapsed);

            try {
              const discordUser = await client.users.fetch(session.userId);
              const avatarUrl = discordUser.displayAvatarURL({ size: 128 });

              return {
                username: session.username,
                avatarUrl,
                activity: session.activity,
                duration: elapsedStr,
                isPaused: session.isPaused,
                durationMinutes: elapsed, // Keep raw minutes for sorting
              };
            } catch (error) {
              console.error(`Error fetching user ${session.userId}:`, error);
              // Fallback with default avatar
              return {
                username: session.username,
                avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
                activity: session.activity,
                duration: elapsedStr,
                isPaused: session.isPaused,
                durationMinutes: elapsed,
              };
            }
          })
        );

        // Sort by duration (longest first)
        usersWithDurations.sort((a, b) => b.durationMinutes - a.durationMinutes);

        // Limit to 10 users max for display
        const displayUsers = usersWithDurations.slice(0, 10);

        // Remove durationMinutes property before passing to image service
        const users = displayUsers.map(({ durationMinutes, ...user }) => user);

        // Generate the live notification image
        const imageBuffer = await liveNotificationImageService.generateLiveNotificationImage(
          users,
          totalLive
        );

        // Create attachment
        const attachment = new AttachmentBuilder(imageBuffer, {
          name: 'live-sessions.png',
          description: `${totalLive} ${totalLive === 1 ? 'person is' : 'people are'} studying`,
        });

        await interaction.editReply({
          files: [attachment],
        });
      } catch (error) {
        console.error('Error generating live notification image:', error);
        await interaction.editReply({
          content: '❌ Failed to generate live sessions image.',
        });
      }
      return;
    }

    // /leaderboard command - Interactive leaderboard with timeframe selector
    if (commandName === 'leaderboard') {
      await interaction.deferReply({ ephemeral: false });

      try {
        // Get timeframe parameter (default to daily)
        const timeframe = (interaction.options.getString('timeframe') || 'daily') as 'daily' | 'weekly' | 'monthly' | 'all-time';

        // Get data based on timeframe - ALL timeframes filter by server
        let topUsers: Array<{ userId: string; username: string; totalDuration: number; xp?: number }> = [];

        if (timeframe === 'all-time') {
          // Get all-time top users by XP (from beginning of time) - filtered by server
          const allTimeStart = Timestamp.fromDate(new Date(0)); // Unix epoch
          topUsers = await sessionService.getTopUsers(allTimeStart, 20, guildId!);
        } else {
          // Get time-based leaderboard
          let startTime: Date;
          if (timeframe === 'daily') {
            startTime = getStartOfDayPacific();
          } else if (timeframe === 'weekly') {
            startTime = getStartOfWeekPacific();
          } else {
            startTime = getStartOfMonthPacific();
          }

          topUsers = await sessionService.getTopUsers(Timestamp.fromDate(startTime), 20, guildId!);
        }

        // TEMPORARY: Use sample data if no real users (for testing)
        let entries: Array<{ userId: string; username: string; avatarUrl: string; xp: number; totalDuration: number; rank: number }> = [];
        let currentUserEntry = undefined;

        if (topUsers.length === 0) {
          // No real data, pass empty arrays - component will use sample data
          entries = [];
          currentUserEntry = undefined;
        } else {
          // Get top 10
          const top10 = topUsers.slice(0, 10);

          // Check if current user is in top 10
          const userPosition = topUsers.findIndex(u => u.userId === user.id);

          // Prepare leaderboard entries with avatars
          entries = await Promise.all(
            top10.map(async (u, index) => {
              try {
                const discordUser = await client.users.fetch(u.userId);
                const stats = await statsService.getUserStats(u.userId);
                // For all-time, use stats totalDuration, otherwise use from topUsers
                const totalDuration = timeframe === 'all-time' ? (stats?.totalDuration || 0) : u.totalDuration;
                return {
                  userId: u.userId,
                  username: u.username,
                  avatarUrl: discordUser.displayAvatarURL({ size: 128, extension: 'png' }),
                  xp: stats?.xp || 0,
                  totalDuration,
                  rank: index + 1,
                };
              } catch (error) {
                console.error(`Failed to fetch user ${u.userId}:`, error);
                return {
                  userId: u.userId,
                  username: u.username,
                  avatarUrl: '', // Fallback
                  xp: 0,
                  totalDuration: u.totalDuration,
                  rank: index + 1,
                };
              }
            })
          );

          // Prepare current user entry if they're not in top 10
          if (userPosition > 9) {
            const userStats = await statsService.getUserStats(user.id);
            currentUserEntry = {
              userId: user.id,
              username: user.username,
              avatarUrl: user.displayAvatarURL({ size: 128, extension: 'png' }),
              xp: userStats?.xp || 0,
              totalDuration: topUsers[userPosition].totalDuration,
              rank: userPosition + 1,
            };
          }
        }

        // Generate leaderboard image - pass current user ID for highlighting
        const imageBuffer = await profileImageService.generateLeaderboardImage(
          timeframe,
          entries,
          currentUserEntry,
          user.id // Pass current user ID for highlighting in top 10
        );

        // Create attachment
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });

        // Create select menu for switching timeframes
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('leaderboard_image_timeframe')
          .setPlaceholder('Select a timeframe')
          .addOptions([
            {
              label: 'Daily',
              description: 'Today\'s top performers',
              value: 'daily',
              emoji: '📅',
            },
            {
              label: 'Weekly',
              description: 'This week\'s leaders',
              value: 'weekly',
              emoji: '📊',
            },
            {
              label: 'Monthly',
              description: 'This month\'s champions',
              value: 'monthly',
              emoji: '🌟',
            },
            {
              label: 'All-Time',
              description: 'Lifetime XP rankings',
              value: 'all-time',
              emoji: '⚡',
            },
          ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        // Send the image with dropdown
        await interaction.editReply({
          files: [attachment],
          components: [row],
        });
      } catch (error) {
        console.error('Error generating leaderboard image:', error);
        await interaction.editReply({
          content: '❌ Failed to generate leaderboard. Please try again later.',
        });
      }
      return;
    }

    // /manual command - Log a manual session
    if (commandName === 'manual') {
      // Create modal for manual session logging
      const modal = new ModalBuilder()
        .setCustomId('manualSessionModal')
        .setTitle('Log Manual Session');

      // Activity input
      const activityInput = new TextInputBuilder()
        .setCustomId('activity')
        .setLabel('Activity')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Studying math, Writing essay')
        .setRequired(true)
        .setMaxLength(100);

      // Title input
      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Session Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Finished chapter 5, Fixed login bug')
        .setRequired(true)
        .setMaxLength(100);

      // Description input
      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('What did you accomplish?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Share what you worked on and what you achieved...')
        .setRequired(true)
        .setMaxLength(1000);

      // Duration input (combined hours and minutes)
      const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Duration (format: "2h 30m" or "90m")')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 1h 30m, 2h, 45m')
        .setRequired(true)
        .setMaxLength(20);

      // Intensity input (1-5 scale)
      const intensityInput = new TextInputBuilder()
        .setCustomId('intensity')
        .setLabel('Session Intensity (1-5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1=Light, 2=Easy, 3=Normal, 4=Hard, 5=Max Effort')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1);

      // Add inputs to action rows
      const activityRow = new ActionRowBuilder<TextInputBuilder>().addComponents(activityInput);
      const titleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
      const descriptionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
      const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
      const intensityRow = new ActionRowBuilder<TextInputBuilder>().addComponents(intensityInput);

      modal.addComponents(activityRow, titleRow, descriptionRow, durationRow, intensityRow);

      await interaction.showModal(modal);
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

      // Get existing config
      const existingConfig = await getServerConfig(guildId!);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
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

    // /set-welcome-channel command
    if (commandName === 'set-welcome-channel') {
      const channel = interaction.options.getChannel('channel', true);

      // Check if user has admin permission
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: 'Only server administrators can set the welcome channel.',
          ephemeral: true,
        });
        return;
      }

      // Get existing config
      const existingConfig = await getServerConfig(guildId!);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
        welcomeChannelId: channel.id,
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
        content: `✅ Welcome channel set to <#${channel.id}>\n\nNew members will receive a welcome message in this channel when they join!`,
        ephemeral: true,
      });
      return;
    }

    // /setup-events-channel command
    if (commandName === 'setup-events-channel') {
      const channel = interaction.options.getChannel('channel', true);

      // Check if user has admin permission
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: 'Only server administrators can set the events channel.',
          ephemeral: true,
        });
        return;
      }

      // Get existing config
      const existingConfig = await getServerConfig(guildId!);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
        eventsChannelId: channel.id,
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
        content: `✅ Events channel set to <#${channel.id}>\n\nAll new study events will be posted in this channel!`,
        ephemeral: true,
      });
      return;
    }

    // /setup-timezone command
    if (commandName === 'setup-timezone') {
      const timezone = interaction.options.getString('timezone', true);

      // Check if user has admin permission
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: 'Only server administrators can set the timezone.',
          ephemeral: true,
        });
        return;
      }

      // Validate timezone by trying to use it
      try {
        new Date().toLocaleString('en-US', { timeZone: timezone });
      } catch (error) {
        await interaction.reply({
          content: `❌ Invalid timezone: \`${timezone}\`\n\nPlease use a valid IANA timezone like:\n- \`America/New_York\` (Eastern)\n- \`America/Chicago\` (Central)\n- \`America/Denver\` (Mountain)\n- \`America/Los_Angeles\` (Pacific)\n\nSee full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`,
          ephemeral: true,
        });
        return;
      }

      // Get existing config
      const existingConfig = await getServerConfig(guildId!);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
        timezone: timezone,
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
        content: `✅ Server timezone set to \`${timezone}\`\n\nAll event times will now be interpreted in this timezone!`,
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

client.once('clientReady', async () => {
  console.log(`✅ Bot is online as ${client.user?.tag}`);

  // Pre-initialize Puppeteer browsers to avoid timeout on first command
  console.log('🔄 Warming up image generation services...');
  await Promise.all([
    profileImageService.warmup(),
    statsImageService.warmup(),
  ]);
  console.log('✅ Image services ready');
});

// Handle new member joins
client.on('guildMemberAdd', async (member) => {
  try {
    const config = await getServerConfig(member.guild.id);

    if (!config || !config.welcomeChannelId) {
      // No welcome channel configured - skip
      return;
    }

    // Send DM to new member
    try {
      await member.send(
        `Welcome to **${member.guild.name}**! 👋\n\n` +
        `This server wants to make productivity social. Start tracking your study sessions with \`/start {activity}\` and see your progress on the leaderboard!\n\n` +
        `**Quick commands:**\n` +
        `• \`/start {activity}\` - Begin a session\n` +
        `• \`/stop\` - Finish your session\n` +
        `• \`/stats\` - View your statistics\n` +
        `• \`/help\` - See all commands`
      );
    } catch (dmError) {
      console.error(`Could not send DM to ${member.user.tag}:`, dmError);
      // If DM fails (user has DMs disabled), post in welcome channel as fallback
      try {
        const channel = await client.channels.fetch(config.welcomeChannelId);
        if (channel && channel.isTextBased()) {
          const textChannel = channel as TextChannel;
          await textChannel.send(
            `Welcome <@${member.id}>! 👋\n\n` +
            `This server wants to make productivity social. Start tracking your study sessions with \`/start {activity}\` and see your progress on the leaderboard!\n\n` +
            `**Quick commands:**\n` +
            `• \`/start {activity}\` - Begin a session\n` +
            `• \`/stop\` - Finish your session\n` +
            `• \`/stats\` - View your statistics\n` +
            `• \`/help\` - See all commands`
          );
        }
      } catch (channelError) {
        console.error('Error posting to welcome channel as fallback:', channelError);
      }
    }
  } catch (error) {
    console.error('Error in guildMemberAdd handler:', error);
  }
});

// Start bot
async function start() {
  await registerCommands();
  await client.login(process.env.DISCORD_BOT_TOKEN);
}

start().catch(console.error);
