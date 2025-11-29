/**
 * Guild Member Add Event Handler
 *
 * Sends a welcome DM to new members when they join the server.
 */

import { GuildMember } from 'discord.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('GuildMemberAdd');

// Bot FAQ channel ID
const BOT_FAQ_CHANNEL_ID = '1442684107493478511';

/**
 * Handle new member joining the server
 * Sends a welcome DM with bot instructions
 */
export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  try {
    // Don't DM bots
    if (member.user.bot) {
      return;
    }

    logger.info(`New member joined: ${member.user.username} (${member.id})`);

    const welcomeMessage = `🎓 **Welcome to UW Study Together!**

This server helps you stay consistent with studying through:
📊 Tracking your study sessions
🏆 Friendly competition with other students
📈 Seeing your progress over time

Ready to get started?

**Try your first study session right now:**
Type \`/start\` in any channel

**Commands:**
- \`/start\` - Begin tracking a session
- \`/stop\` - End your session
- \`/stats\` - See your progress
- \`/leaderboard\` - Compare with others

Need help? Check out <#${BOT_FAQ_CHANNEL_ID}>

Let's make this your most productive quarter! 🚀`;

    await member.send(welcomeMessage);
    logger.info(`Sent welcome DM to ${member.user.username}`);
  } catch (error) {
    // User may have DMs disabled - this is fine, just log it
    if ((error as any).code === 50007) {
      logger.warn(`Cannot send DM to ${member.user.username} - DMs disabled`);
    } else {
      logger.error(`Failed to send welcome DM to ${member.user.username}`, error);
    }
  }
}
