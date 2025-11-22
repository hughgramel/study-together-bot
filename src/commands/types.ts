/**
 * Command Types
 *
 * Defines the structure for all commands in the modular command system.
 * Each command exports a SlashCommandBuilder and an execute function.
 */

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  Client
} from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';

/**
 * Command execution context
 * Contains all dependencies needed by command handlers
 */
export interface CommandContext {
  db: Firestore;
  client: Client;
}

/**
 * Command execute function signature
 */
export type CommandExecute = (
  interaction: ChatInputCommandInteraction,
  context: CommandContext
) => Promise<void>;

/**
 * Standard command structure
 * Each command file exports this structure
 */
export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: CommandExecute;
}

/**
 * Command category for organization
 */
export type CommandCategory =
  | 'session'
  | 'stats'
  | 'groups'
  | 'goals'
  | 'events'
  | 'admin'
  | 'utility';

/**
 * Command metadata
 */
export interface CommandMetadata {
  name: string;
  category: CommandCategory;
  description: string;
  ephemeral: boolean;
  requiresActiveSession?: boolean;
  adminOnly?: boolean;
}
