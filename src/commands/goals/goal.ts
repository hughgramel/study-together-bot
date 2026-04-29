/**
 * /goal Command
 *
 * Create goals with optional per-goal difficulty (1-5).
 *
 * Examples:
 *   /goal (do math, 3), (take out trash, 1)
 *   /goal do math, take out trash         (defaults difficulty to 3)
 *   /goal 1. Study 2. Exercise            (numbered list, defaults to 3)
 *   /goal Run 5k - 3⏎ Read book - 1       (one goal per line, trailing - N)
 *
 * Tuple form pairs each goal with its difficulty explicitly. The line form is
 * easier to read for many goals and accepts the trailing difficulty marker.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService, TaskDifficulty, TaskInput } from '../../services/tasks';
import { parseNumberedList } from '../../utils/taskParser';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GoalCommand');

const DEFAULT_DIFFICULTY: TaskDifficulty = 3;

function clampDifficulty(raw: string | number | undefined): TaskDifficulty {
  if (raw === undefined) return DEFAULT_DIFFICULTY;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
  if (Number.isInteger(n) && n >= 1 && n <= 5) {
    return n as TaskDifficulty;
  }
  return DEFAULT_DIFFICULTY;
}

/**
 * Parse a single tuple's inner contents into {description, difficulty}.
 * Splits on the LAST comma so descriptions can contain commas.
 */
function parseTupleBody(body: string): TaskInput | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const lastComma = trimmed.lastIndexOf(',');
  if (lastComma === -1) {
    // No difficulty provided inside the parens — treat whole thing as desc.
    return { description: trimmed, difficulty: DEFAULT_DIFFICULTY };
  }

  const descPart = trimmed.slice(0, lastComma).trim();
  const diffPart = trimmed.slice(lastComma + 1).trim();
  const diffNum = parseInt(diffPart, 10);

  // If the trailing token isn't a 1-5 integer, it was probably just part of
  // the description ("study, then exercise") — keep the full string as desc.
  if (!Number.isInteger(diffNum) || diffNum < 1 || diffNum > 5) {
    return { description: trimmed, difficulty: DEFAULT_DIFFICULTY };
  }

  if (!descPart) return null;
  return { description: descPart, difficulty: diffNum as TaskDifficulty };
}

/**
 * Try to parse the input as a series of `(goal, difficulty)` tuples.
 * Returns null if the input doesn't contain any parenthesised tuples.
 */
function parseTupleList(text: string): TaskInput[] | null {
  const tupleRegex = /\(([^()]+)\)/g;
  const inputs: TaskInput[] = [];
  let match: RegExpExecArray | null;

  while ((match = tupleRegex.exec(text)) !== null) {
    const parsed = parseTupleBody(match[1]);
    if (parsed) inputs.push(parsed);
  }

  return inputs.length > 0 ? inputs : null;
}

// Trailing " - N" where N is 1-5, anchored to end of line.
const LINE_DIFFICULTY_REGEX = /^(.+?)\s+-\s*([1-5])\s*$/;
// Leading "1.", "1)", "1:", "1 -" — same shape parseNumberedList accepts.
const NUMBERED_PREFIX_REGEX = /^\s*\d+[\.\)\:\-]\s+/;

/**
 * Parse text formatted as one goal per line, where each line is
 * `description` or `description - N` (N is 1-5). Returns null if the input
 * is single-line and lacks any difficulty marker — that case is left to the
 * other parsers so single-line comma input still works.
 */
function parseLineList(text: string): TaskInput[] | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return null;

  const inputs: TaskInput[] = [];
  let foundMarker = false;

  for (const rawLine of lines) {
    // Strip leading "1." / "1)" / "1 -" so numbered+difficulty combos work.
    const line = rawLine.replace(NUMBERED_PREFIX_REGEX, '').trim();
    if (!line) continue;

    const match = line.match(LINE_DIFFICULTY_REGEX);
    if (match) {
      foundMarker = true;
      inputs.push({
        description: match[1].trim(),
        difficulty: parseInt(match[2], 10) as TaskDifficulty,
      });
    } else {
      inputs.push({ description: line, difficulty: DEFAULT_DIFFICULTY });
    }
  }

  if (inputs.length === 0) return null;
  // Single-line input without an explicit marker is ambiguous with the
  // comma-separated fallback ("a, b") — let later parsers handle it.
  if (lines.length === 1 && !foundMarker) return null;
  return inputs;
}

/**
 * Parse goals from text. Order: tuples → line list → numbered list →
 * comma-separated. Goals without an explicit difficulty get the default.
 */
function parseGoals(text: string): TaskInput[] {
  const tuples = parseTupleList(text);
  if (tuples) return tuples;

  const lines = parseLineList(text);
  if (lines) return lines;

  const numbered = parseNumberedList(text);
  if (numbered && numbered.length > 0) {
    return numbered.map((description) => ({ description, difficulty: DEFAULT_DIFFICULTY }));
  }

  return text
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
    .map((description) => ({ description, difficulty: DEFAULT_DIFFICULTY }));
}

const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  1: 'Trivial',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Brutal',
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Add goals, optionally with per-goal difficulty (1-5)')
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription(
          'Goals: "(math, 3), (run, 2)", one-per-line "Run - 3", or "math, run" (defaults to 3)'
        )
        .setRequired(true)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      const text = interaction.options.getString('text', true);
      const goals = parseGoals(text).map((g) => ({
        description: g.description,
        difficulty: clampDifficulty(g.difficulty),
      }));

      if (goals.length === 0) {
        await interaction.editReply({
          content:
            '❌ Could not parse any goals from your text.\n\n' +
            'Try:\n' +
            '• Tuples: `/goal (do math, 3), (take out trash, 1)`\n' +
            '• One per line: `Run 5k - 3` ⏎ `Read book - 1`\n' +
            '• Comma-separated: `/goal do math, take out trash`\n' +
            '• Numbered list: `/goal 1. Study 2. Exercise`\n\n' +
            'Difficulty is 1-5 (1 = trivial, 5 = brutal). Defaults to 3.',
        });
        return;
      }

      logger.info(
        `User ${user.username} (${user.id}) adding ${goals.length} goals`
      );

      const taskService = new TaskService(db);
      await taskService.createTasks(
        user.id,
        user.username,
        goals,
        interaction.id,
        interaction.channelId
      );

      const goalList = goals
        .map((g, i) => {
          const xp = TaskService.getXpForDifficulty(g.difficulty);
          const label = DIFFICULTY_LABELS[g.difficulty];
          return `**${i + 1}.** ${g.description} — *${label} (${g.difficulty}/5, ${xp} XP)*`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x58cc02)
        .setTitle('✅ Goals Added!')
        .setDescription(goalList)
        .setFooter({
          text: `${goals.length} goal${goals.length !== 1 ? 's' : ''} created • /goals to view • /complete [numbers] to finish • /cancelgoal to remove`,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(`${goals.length} goals created for user ${user.id}`);
    } catch (error) {
      logger.error('Error creating goals', error);
      await interaction.editReply({
        content: '❌ An error occurred while creating your goals. Please try again.',
      });
    }
  },
};
