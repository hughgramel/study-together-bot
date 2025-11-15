import {
  Client,
  GatewayIntentBits,
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

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
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
    .setDescription('End your session! Add a title, description of what you did, and post it to the feed'),

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
    .setName('setup-focus-room')
    .setDescription('Configure voice channels for auto-tracking (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The voice channel to enable auto-tracking')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('manual')
    .setDescription('Log a manual session with custom duration'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands and how to use them'),
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

    // Create embed for session start
    const embed = new EmbedBuilder()
      .setColor(0x00FF00) // Green for "live"
      .setAuthor({
        name: `${username} 🟢`,
        iconURL: avatarUrl
      })
      .setDescription(`**@${username}** is live now working on **${activity}**!`);

    await textChannel.send({
      embeds: [embed]
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

// Helper function to post VC session start to feed channel
async function postVCSessionStartToFeed(
  guildId: string,
  username: string,
  userId: string,
  avatarUrl: string,
  vcChannelId: string
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

    // Create embed for VC session start with link
    const embed = new EmbedBuilder()
      .setColor(0x00FF00) // Green for "live"
      .setAuthor({
        name: `${username} 🟢`,
        iconURL: avatarUrl
      })
      .setDescription(`🎧 **${username}** started studying in <#${vcChannelId}>`);

    await textChannel.send({
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error posting VC session start to feed:', error);
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

    // Create the Strava-like embed
    const embed = new EmbedBuilder()
      .setColor(0x0080FF) // Electric blue
      .setAuthor({
        name: `${username} completed a session!`,
        iconURL: avatarUrl
      })
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: '⏱️ Time', value: durationStr, inline: true },
        { name: '🎯 Activity', value: activity, inline: true }
      );

    const message = await textChannel.send({
      embeds: [embed]
    });

    // React with a heart if bot has permission
    if (permissions?.has(PermissionFlagsBits.AddReactions)) {
      await message.react('❤️');
    }
  } catch (error: any) {
    // Log detailed error for debugging
    if (error.code === 50001) {
      console.error(`Bot lacks access to feed channel. Please ensure the bot has 'View Channel' permission.`);
    } else if (error.code === 50013) {
      console.error(`Bot lacks permissions in feed channel. Please ensure the bot has 'Send Messages', 'Embed Links', and 'Add Reactions' permissions.`);
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

    // Determine message and emoji based on milestones
    let message = '';
    let emoji = '';
    let color = 0x00FF00; // Green
    let shouldCelebrate = false;

    if (totalSessions === 1) {
      // First session ever - only triggers once
      message = `**@${username}** just completed their first session! 🎉`;
      emoji = '🎉';
      color = 0x00FF00; // Green
      shouldCelebrate = true;
    } else if (streak === 7) {
      message = `**@${username}** hit a 7-day streak! 🔥🔥 A full week of grinding!`;
      emoji = '🔥';
      color = 0xFF6B00; // Orange
      shouldCelebrate = true;
    } else if (streak === 30) {
      message = `**@${username}** reached a 30-day streak! 🔥🔥🔥 Unstoppable! 🚀`;
      emoji = '🔥';
      color = 0xFF0000; // Red
      shouldCelebrate = true;
    }

    // Only post if this is a milestone worth celebrating
    if (!shouldCelebrate) {
      return;
    }

    // Create milestone embed
    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${username} ${emoji}`,
        iconURL: avatarUrl
      })
      .setDescription(message);

    const milestoneMessage = await textChannel.send({
      embeds: [embed]
    });

    // React with appropriate emoji if bot has permission
    if (permissions?.has(PermissionFlagsBits.AddReactions)) {
      await milestoneMessage.react(emoji);

      // Add fire reactions for streaks
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

// Helper function to post basic session completion to feed (for auto-posted VC sessions)
async function postBasicSessionToFeed(
  guildId: string,
  username: string,
  avatarUrl: string,
  duration: number,
  vcChannelId: string
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
    const durationStr = formatDuration(duration);

    // Create basic completion embed
    const embed = new EmbedBuilder()
      .setColor(0x0080FF) // Electric blue
      .setAuthor({
        name: `${username} completed a session!`,
        iconURL: avatarUrl
      })
      .setDescription(`Focused for **${durationStr}** in <#${vcChannelId}>`);

    const message = await textChannel.send({
      embeds: [embed]
    });

    // React with a heart
    await message.react('❤️').catch(() => {});
  } catch (error) {
    console.error('Error posting basic session to feed:', error);
  }
}

// Map to track auto-post timers
const autoPostTimers = new Map<string, NodeJS.Timeout>();

// Helper function to schedule auto-post after 1 hour
function scheduleAutoPost(userId: string, guildId: string) {
  // Clear existing timer if any
  if (autoPostTimers.has(userId)) {
    clearTimeout(autoPostTimers.get(userId)!);
  }

  // Schedule new timer for 10 minutes
  const timer = setTimeout(async () => {
    try {
      const session = await sessionService.getActiveSession(userId);

      if (!session || !session.pendingCompletion || !session.isVCSession) {
        return;
      }

      // Calculate final duration
      const duration = calculateDuration(
        session.startTime,
        session.pausedDuration,
        session.isPaused ? session.pausedAt : undefined
      );

      const endTime = Timestamp.now();

      // DELETE ACTIVE SESSION FIRST to prevent race condition/duplicate posts
      await sessionService.deleteActiveSession(session.userId);

      // Create completed session
      await sessionService.createCompletedSession({
        userId: session.userId,
        username: session.username,
        serverId: session.serverId,
        activity: 'VC Session',
        title: `Focus session in voice channel`,
        description: `Completed ${formatDuration(duration)} of focused work`,
        duration,
        startTime: session.startTime,
        endTime,
      });

      // Update stats
      await statsService.updateUserStats(session.userId, session.username, duration);

      // Fetch user for avatar
      const user = await client.users.fetch(userId);
      const avatarUrl = user.displayAvatarURL({ size: 128 });

      // Post basic session to feed
      await postBasicSessionToFeed(
        guildId,
        session.username,
        avatarUrl,
        duration,
        session.vcChannelId!
      );

      // Clean up timer
      autoPostTimers.delete(userId);
    } catch (error) {
      console.error('Error in auto-post timer:', error);
    }
  }, 10 * 60 * 1000); // 10 minutes

  autoPostTimers.set(userId, timer);
}

// Helper function to cancel auto-post timer
function cancelAutoPost(userId: string) {
  if (autoPostTimers.has(userId)) {
    clearTimeout(autoPostTimers.get(userId)!);
    autoPostTimers.delete(userId);
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
        const hoursStr = interaction.fields.getTextInputValue('hours');
        const minutesStr = interaction.fields.getTextInputValue('minutes');

        // Parse and validate hours and minutes
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (isNaN(hours) || isNaN(minutes)) {
          await interaction.editReply({
            content: '❌ Invalid input. Hours and minutes must be numbers.',
          });
          return;
        }

        if (hours < 0 || minutes < 0) {
          await interaction.editReply({
            content: '❌ Hours and minutes must be positive numbers.',
          });
          return;
        }

        if (hours === 0 && minutes === 0) {
          await interaction.editReply({
            content: '❌ Duration must be greater than 0.',
          });
          return;
        }

        // Calculate duration in seconds
        const duration = (hours * 3600) + (minutes * 60);

        // Create timestamps
        const endTime = Timestamp.now();
        const startTime = Timestamp.fromMillis(endTime.toMillis() - (duration * 1000));

        // Create completed session
        await sessionService.createCompletedSession({
          userId: user.id,
          username: user.username,
          serverId: guildId!,
          activity,
          title,
          description,
          duration,
          startTime,
          endTime,
        });

        // Update stats
        await statsService.updateUserStats(user.id, user.username, duration);

        const durationStr = formatDuration(duration);

        await interaction.editReply({
          content: `✅ Manual session logged! (${durationStr})\n\nYour session has been saved and posted to the feed.`,
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
          endTime
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

        // Get active session
        const session = await sessionService.getActiveSession(user.id);

        if (!session) {
          await interaction.reply({
            content: 'No active session found! It may have been cancelled or already ended.',
            ephemeral: false,
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

        const durationStr = formatDuration(duration);

        await interaction.reply({
          content: `✅ Session completed! (${durationStr})\n\nYour session has been saved and posted to the feed.`,
          ephemeral: false,
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
      } catch (error) {
        console.error('Error handling end session modal:', error);

        const errorMessage = 'An error occurred while completing your session. Please try again.';

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
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, guildId } = interaction;

  // Log command usage
  console.log(`[${new Date().toISOString()}] ${user.username} (${user.id}) used /${commandName} in guild ${guildId}`);

  try {
    // /ping command
    if (commandName === 'ping') {
      await interaction.reply({ content: 'Pong! 🏓', ephemeral: true });
      return;
    }

    // /help command
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x0080FF)
        .setTitle('📚 Study Together Bot - Commands')
        .setDescription('Track your productivity and compete with friends!')
        .addFields(
          {
            name: '🎯 Session Management',
            value:
              '`/start {activity}` - Start a new session\n' +
              '`/time` - Check your current session status\n' +
              '`/pause` - Pause your active session\n' +
              '`/resume` - Resume your paused session\n' +
              '`/end` - Complete and share your session\n' +
              '`/cancel` - Cancel session without saving\n' +
              '`/manual` - Log a past session manually',
            inline: false
          },
          {
            name: '📊 Statistics & Leaderboards',
            value:
              '`/mystats` - View your personal statistics\n' +
              '`/leaderboard` - Quick overview (top 3 + your rank)\n' +
              '`/d` - Daily leaderboard (top 10)\n' +
              '`/w` - Weekly leaderboard (top 10)\n' +
              '`/m` - Monthly leaderboard (top 10)',
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
              '`/setup-focus-room {voice-channel}` - Enable auto-tracking in voice channel',
            inline: false
          },
          {
            name: '💡 Tips',
            value:
              '• Voice channel sessions auto-track when you join a focus room\n' +
              '• Build streaks by completing sessions daily\n' +
              '• Share your accomplishments in the feed to inspire others!',
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

    // /start command
    if (commandName === 'start') {
      const activity = interaction.options.getString('activity', true);

      // Check if user already has an active session
      const existingSession = await sessionService.getActiveSession(user.id);

      if (existingSession) {
        await interaction.reply({
          content:
            'You already have an active session! Use /end to complete it first.',
          ephemeral: false,
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
        ephemeral: false,
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
        content: '⏸️ Session paused. Use /resume when ready to continue.',
        ephemeral: false,
      });
      return;
    }

    // /resume command
    if (commandName === 'resume') {
      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        await interaction.reply({
          content: 'No active session to resume.',
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
        content: `▶️ Session resumed!\n\n**Elapsed Time:** ${elapsedStr}`,
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

      // Cancel auto-post timer if it's a VC session
      if (session.isVCSession && session.pendingCompletion) {
        cancelAutoPost(user.id);
      }

      await sessionService.deleteActiveSession(user.id);

      await interaction.reply({
        content:
          '❌ Session cancelled. No stats were updated and nothing was posted to the feed.',
        ephemeral: false,
      });
      return;
    }

    // /end command
    if (commandName === 'end') {
      // Check if command is used in a server (not DMs)
      if (!guildId) {
        await interaction.reply({
          content: '❌ Please use `/end` in your server to post your session to the feed!',
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

      // If this is a VC session with pending completion, cancel auto-post timer
      if (session.isVCSession && session.pendingCompletion) {
        cancelAutoPost(user.id);
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

      // Add inputs to action rows
      const titleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
      const descriptionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

      modal.addComponents(titleRow, descriptionRow);

      await interaction.showModal(modal);
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

      const monthStart = getStartOfMonthPacific();
      const monthlySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(monthStart)
      );

      const allSessions = await sessionService.getCompletedSessions(user.id);

      // Calculate durations in hours
      const dailyHours = todaySessions.reduce((sum, s) => sum + s.duration, 0) / 3600;
      const weeklyHours = weeklySessions.reduce((sum, s) => sum + s.duration, 0) / 3600;
      const monthlyHours = monthlySessions.reduce((sum, s) => sum + s.duration, 0) / 3600;
      const allTimeHours = allSessions.reduce((sum, s) => sum + s.duration, 0) / 3600;

      // Get guild to check membership
      const guild = interaction.guild;

      // Get user rankings for each timeframe (server-specific)
      const [dailyUsers, weeklyUsers, monthlyUsers] = await Promise.all([
        sessionService.getTopUsers(Timestamp.fromDate(today), 100, guild!),
        sessionService.getTopUsers(Timestamp.fromDate(weekStart), 100, guild!),
        sessionService.getTopUsers(Timestamp.fromDate(monthStart), 100, guild!),
      ]);

      const dailyRank = dailyUsers.findIndex(u => u.userId === user.id);
      const weeklyRank = weeklyUsers.findIndex(u => u.userId === user.id);
      const monthlyRank = monthlyUsers.findIndex(u => u.userId === user.id);
      const allTimeRanking = await statsService.getUserRanking(user.id);

      const dailyRankText = dailyRank >= 0 ? `#${dailyRank + 1}` : '#-';
      const weeklyRankText = weeklyRank >= 0 ? `#${weeklyRank + 1}` : '#-';
      const monthlyRankText = monthlyRank >= 0 ? `#${monthlyRank + 1}` : '#-';
      const allTimeRankText = allTimeRanking ? `#${allTimeRanking.rank}` : '#-';

      // Calculate average per day for current month (using Pacific Time)
      const pacificNow = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      const pacificDate = new Date(pacificNow);
      const monthName = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'][pacificDate.getMonth()];
      const currentDay = pacificDate.getDate();
      const avgPerDay = currentDay > 0 ? (monthlyHours / currentDay) : 0;

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
          { name: '🏆 Place', value: `${dailyRankText}\n${weeklyRankText}\n${monthlyRankText}\n${allTimeRankText}`, inline: true },
          { name: '📚 Total Sessions', value: `**${stats.totalSessions}**`, inline: true },
          { name: '📈 Hours/day (' + monthName + ')', value: `**${avgPerDay.toFixed(1)} h**`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '🔥 Current Streak', value: `**${stats.currentStreak}** days ${currentStreakEmojis}`, inline: true },
          { name: '💪 Longest Streak', value: `**${stats.longestStreak}** days ${longestStreakEmojis}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true }
        )
        .setFooter({
          text: user.username,
          iconURL: avatarUrl
        });

      await interaction.reply({
        embeds: [embed],
        ephemeral: false,
      });
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

      // Sort by start time (earliest first)
      activeSessions.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());

      // Limit to 10 users max to avoid spam
      const displaySessions = activeSessions.slice(0, 10);

      // Build description with list of active users
      let description = '';

      for (const session of displaySessions) {
        const elapsed = calculateDuration(
          session.startTime,
          session.pausedDuration,
          session.isPaused ? session.pausedAt : undefined
        );
        const elapsedStr = formatDuration(elapsed);
        const statusEmoji = session.isPaused ? '⏸️' : '🟢';

        // Format: 🟢 **username** working on **activity** for 1h 23m
        description += `${statusEmoji} **${session.username}** working on **${session.activity}** for ${elapsedStr}\n`;
      }

      // Create single embed with list
      const embed = new EmbedBuilder()
        .setColor(0x00FF00) // Green for live
        .setTitle(`🟢 ${totalLive} ${totalLive === 1 ? 'person is' : 'people are'} studying right now`)
        .setDescription(description.trim())
        .setTimestamp();

      if (totalLive > 10) {
        embed.setFooter({ text: 'Showing first 10 users' });
      }

      await interaction.editReply({
        embeds: [embed],
      });
      return;
    }

    // /d command - Daily leaderboard with columns
    if (commandName === 'd') {
      await interaction.deferReply({ ephemeral: false });

      // Get guild to check membership
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'This command must be used in a server!' });
        return;
      }

      // Get today's start time (midnight Pacific Time)
      const today = getStartOfDayPacific();
      const dailyUsers = await sessionService.getTopUsers(Timestamp.fromDate(today), 20, guild);

      if (dailyUsers.length === 0) {
        await interaction.editReply({
          content: 'No sessions completed today yet! Be the first! 🚀',
        });
        return;
      }

      const dailyTop = dailyUsers.slice(0, 10);
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
      const userPosition = dailyUsers.findIndex(u => u.userId === user.id);
      if (userPosition >= 10) {
        const currentUser = dailyUsers[userPosition];
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
      await interaction.deferReply({ ephemeral: false });

      // Get guild to check membership
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'This command must be used in a server!' });
        return;
      }

      // Get start of current week (Sunday at midnight PT)
      const weekStart = getStartOfWeekPacific();
      const weeklyUsers = await sessionService.getTopUsers(Timestamp.fromDate(weekStart), 20, guild);

      if (weeklyUsers.length === 0) {
        await interaction.editReply({
          content: 'No sessions completed this week yet! Be the first! 🚀',
        });
        return;
      }

      const weeklyTop = weeklyUsers.slice(0, 10);
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
      const userPosition = weeklyUsers.findIndex(u => u.userId === user.id);
      if (userPosition >= 10) {
        const currentUser = weeklyUsers[userPosition];
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
      await interaction.deferReply({ ephemeral: false });

      // Get guild to check membership
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'This command must be used in a server!' });
        return;
      }

      // Get start of current month (1st at midnight PT)
      const monthStart = getStartOfMonthPacific();
      const monthlyUsers = await sessionService.getTopUsers(Timestamp.fromDate(monthStart), 20, guild);

      if (monthlyUsers.length === 0) {
        await interaction.editReply({
          content: 'No sessions completed this month yet! Be the first! 🚀',
        });
        return;
      }

      const monthlyTop = monthlyUsers.slice(0, 10);
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
      const userPosition = monthlyUsers.findIndex(u => u.userId === user.id);
      if (userPosition >= 10) {
        const currentUser = monthlyUsers[userPosition];
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
      console.log(`[LEADERBOARD] Command started for user ${user.username} (${user.id})`);
      await interaction.deferReply({ ephemeral: false });

      // Get data for all timeframes
      const today = getStartOfDayPacific();
      const weekStart = getStartOfWeekPacific();
      const monthStart = getStartOfMonthPacific();

      console.log(`[LEADERBOARD] Timeframes - Today: ${today.toISOString()}, Week: ${weekStart.toISOString()}, Month: ${monthStart.toISOString()}`);

      // Get guild to check membership
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'This command must be used in a server!' });
        return;
      }

      const [dailyAll, weeklyAll, monthlyAll] = await Promise.all([
        sessionService.getTopUsers(Timestamp.fromDate(today), 20, guild),
        sessionService.getTopUsers(Timestamp.fromDate(weekStart), 20, guild),
        sessionService.getTopUsers(Timestamp.fromDate(monthStart), 20, guild),
      ]);

      console.log(`[LEADERBOARD] Fetched users - Daily: ${dailyAll.length}, Weekly: ${weeklyAll.length}, Monthly: ${monthlyAll.length}`);

      // Log detailed user data
      console.log(`[LEADERBOARD] Daily top users:`, dailyAll.map(u => ({
        username: u.username,
        userId: u.userId,
        totalDuration: u.totalDuration,
        hours: (u.totalDuration / 3600).toFixed(2),
        sessionCount: u.sessionCount
      })));

      console.log(`[LEADERBOARD] Weekly top users:`, weeklyAll.map(u => ({
        username: u.username,
        userId: u.userId,
        totalDuration: u.totalDuration,
        hours: (u.totalDuration / 3600).toFixed(2),
        sessionCount: u.sessionCount
      })));

      console.log(`[LEADERBOARD] Monthly top users:`, monthlyAll.map(u => ({
        username: u.username,
        userId: u.userId,
        totalDuration: u.totalDuration,
        hours: (u.totalDuration / 3600).toFixed(2),
        sessionCount: u.sessionCount
      })));

      // Find current user position
      const dailyUserPos = dailyAll.findIndex(u => u.userId === user.id);
      const weeklyUserPos = weeklyAll.findIndex(u => u.userId === user.id);
      const monthlyUserPos = monthlyAll.findIndex(u => u.userId === user.id);

      console.log(`[LEADERBOARD] User ${user.username} positions - Daily: ${dailyUserPos >= 0 ? dailyUserPos + 1 : 'N/A'}, Weekly: ${weeklyUserPos >= 0 ? weeklyUserPos + 1 : 'N/A'}, Monthly: ${monthlyUserPos >= 0 ? monthlyUserPos + 1 : 'N/A'}`);

      if (dailyUserPos >= 0) {
        const userData = dailyAll[dailyUserPos];
        console.log(`[LEADERBOARD] User ${user.username} daily data:`, {
          totalDuration: userData.totalDuration,
          hours: (userData.totalDuration / 3600).toFixed(2),
          sessionCount: userData.sessionCount
        });
      }

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

      console.log(`[LEADERBOARD] Sending response to user ${user.username}`);
      await interaction.editReply({ embeds: [embed] });
      console.log(`[LEADERBOARD] Command completed successfully`);
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

      // Hours input
      const hoursInput = new TextInputBuilder()
        .setCustomId('hours')
        .setLabel('Hours')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(true)
        .setMaxLength(3);

      // Minutes input
      const minutesInput = new TextInputBuilder()
        .setCustomId('minutes')
        .setLabel('Minutes')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(true)
        .setMaxLength(2);

      // Add inputs to action rows
      const activityRow = new ActionRowBuilder<TextInputBuilder>().addComponents(activityInput);
      const titleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
      const descriptionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
      const hoursRow = new ActionRowBuilder<TextInputBuilder>().addComponents(hoursInput);
      const minutesRow = new ActionRowBuilder<TextInputBuilder>().addComponents(minutesInput);

      modal.addComponents(activityRow, titleRow, descriptionRow, hoursRow, minutesRow);

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

    // /setup-focus-room command
    if (commandName === 'setup-focus-room') {
      const channel = interaction.options.getChannel('channel', true);

      // Check if user has admin permission
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: 'Only server administrators can configure focus rooms.',
          ephemeral: true,
        });
        return;
      }

      // Get existing config
      const existingConfig = await getServerConfig(guildId!);
      const currentFocusRooms = existingConfig?.focusRoomIds || [];

      // Check if already configured
      if (currentFocusRooms.includes(channel.id)) {
        await interaction.reply({
          content: `<#${channel.id}> is already configured as a focus room.`,
          ephemeral: true,
        });
        return;
      }

      // Add to focus rooms
      const updatedFocusRooms = [...currentFocusRooms, channel.id];

      const config: ServerConfig = {
        ...existingConfig,
        focusRoomIds: updatedFocusRooms,
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
        content: `✅ Focus room enabled: <#${channel.id}>\n\nJoining this voice channel will now automatically start tracking your session!`,
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

// Handle voice state updates (VC joins/leaves)
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const userId = newState.member?.user.id;
    const guildId = newState.guild.id;

    console.log(`[VOICE STATE] User: ${newState.member?.user.username}, Old: ${oldState.channelId}, New: ${newState.channelId}`);

    if (!userId || !guildId) {
      console.log('[VOICE STATE] Missing userId or guildId');
      return;
    }

    // Get server config to check if this is a focus room
    const config = await getServerConfig(guildId);
    console.log(`[VOICE STATE] Config:`, config);

    if (!config || !config.focusRoomIds || config.focusRoomIds.length === 0) {
      console.log('[VOICE STATE] No focus rooms configured');
      return;
    }

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // User joined a VC
    console.log(`[VOICE STATE] Checking join: oldChannelId=${oldChannelId}, newChannelId=${newChannelId}, isFocusRoom=${config.focusRoomIds.includes(newChannelId || '')}`);

    if (!oldChannelId && newChannelId && config.focusRoomIds.includes(newChannelId)) {
      console.log('[VOICE STATE] User joined a focus room!');

      // Check if user has a pending session (left VC but hasn't ended)
      const existingSession = await sessionService.getActiveSession(userId);
      console.log('[VOICE STATE] Existing session:', existingSession);

      if (existingSession && existingSession.isVCSession && existingSession.pendingCompletion) {
        console.log('[VOICE STATE] Resuming existing session');
        // Resume existing session
        await sessionService.updateActiveSession(userId, {
          pendingCompletion: false,
          leftVCAt: null as any,
        });

        // Cancel auto-post timer
        cancelAutoPost(userId);

        console.log(`${newState.member?.user.username} resumed VC session`);
      } else if (!existingSession) {
        console.log('[VOICE STATE] Creating new VC session');
        // Create new VC session
        const username = newState.member?.user.username || 'Unknown';
        const avatarUrl = newState.member?.user.displayAvatarURL({ size: 128 }) || '';

        await sessionService.createActiveSession(
          userId,
          username,
          guildId,
          'VC Session'
        );

        // Mark as VC session
        await sessionService.updateActiveSession(userId, {
          isVCSession: true,
          vcChannelId: newChannelId,
        });

        // Post to feed
        console.log('[VOICE STATE] Posting to feed');
        await postVCSessionStartToFeed(
          guildId,
          username,
          userId,
          avatarUrl,
          newChannelId
        );

        console.log(`${username} started VC session in ${newChannelId}`);
      } else {
        console.log('[VOICE STATE] User already has a session (not VC or not pending)');
      }
    }

    // User left a VC (or switched channels)
    if (oldChannelId && config.focusRoomIds.includes(oldChannelId)) {
      const session = await sessionService.getActiveSession(userId);

      if (session && session.isVCSession && !session.pendingCompletion) {
        // If user switched to another focus room, don't mark as pending
        if (newChannelId && config.focusRoomIds.includes(newChannelId)) {
          // Update the VC channel ID
          await sessionService.updateActiveSession(userId, {
            vcChannelId: newChannelId,
          });
          return;
        }

        // Calculate current duration
        const duration = calculateDuration(
          session.startTime,
          session.pausedDuration,
          session.isPaused ? session.pausedAt : undefined
        );
        const durationStr = formatDuration(duration);

        // Mark as pending completion
        await sessionService.updateActiveSession(userId, {
          pendingCompletion: true,
          leftVCAt: Timestamp.now(),
        });

        // Schedule auto-post after 1 hour
        scheduleAutoPost(userId, guildId);

        // DM the user about leaving VC
        try {
          const user = await client.users.fetch(userId);
          await user.send(
            `You just focused in VC for **${durationStr}**. Type \`/end\` to post your session, or rejoin VC to continue!\n\n*Auto-posts in 10 minutes*`
          );
        } catch (error) {
          console.error('Error sending DM to user:', error);
          // Fallback: post in feed channel if DM fails (user has DMs disabled)
          if (config.feedChannelId) {
            try {
              const feedChannel = await client.channels.fetch(config.feedChannelId);
              if (feedChannel && feedChannel.isTextBased()) {
                const textChannel = feedChannel as TextChannel;
                await textChannel.send(
                  `<@${userId}> You just focused in VC for **${durationStr}**. Type \`/end\` to post your session, or rejoin VC to continue!\n\n*Auto-posts in 10 minutes*`
                );
              }
            } catch (fallbackError) {
              console.error('Error posting VC leave ping to feed:', fallbackError);
            }
          }
        }

        console.log(`${session.username} left VC, session pending completion`);
      }
    }
  } catch (error) {
    console.error('Error handling voice state update:', error);
  }
});

// Bot ready event
client.once('clientReady', () => {
  console.log(`✅ Bot is online as ${client.user?.tag}`);
});

// Start bot
async function start() {
  await registerCommands();
  await client.login(process.env.DISCORD_BOT_TOKEN);
}

start().catch(console.error);
