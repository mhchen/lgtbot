import { Client, Message } from 'discord.js';
import converter from 'number-to-words';
import { syllable } from 'syllable';
import { logger } from './logger';

// Overrides for words the syllable library miscounts
const SYLLABLE_OVERRIDES: Record<string, number> = {
  noel: 2,
  noels: 2,
};

function getSyllables(word: string): number {
  const lower = word.toLowerCase();
  if (SYLLABLE_OVERRIDES[lower] !== undefined) return SYLLABLE_OVERRIDES[lower];
  if (/^\d+$/.test(word)) {
    const asWords = converter.toWords(Number(word));
    if (asWords) return syllable(asWords);
  }
  return syllable(word);
}

const DISCORD_TOKEN_REGEX = /<(?:@[!&]?|#|a?:[a-zA-Z0-9_]+:)\d+>/g;
const URL_REGEX = /https?:\/\/\S+/gi;

function stripDiscordNoise(text: string): string {
  return text.replace(DISCORD_TOKEN_REGEX, ' ').replace(URL_REGEX, ' ');
}

export function maybeParseHaiku(text: string): string[] | null {
  const words = stripDiscordNoise(text)
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .reverse();

  if (words.length === 0) return null;

  const targetSyllables = [5, 7, 5];
  const lines: string[][] = [[], [], []];

  for (const [lineIndex, originalTarget] of targetSyllables.entries()) {
    let target = originalTarget;

    while (target > 0) {
      const word = words.pop();
      if (!word) return null;

      const syllables = getSyllables(word);
      if (syllables > target) return null;

      lines[lineIndex].push(word);
      target -= syllables;
    }
  }

  while (words.length > 0) {
    const word = words.pop();
    if (!word) break;
    if (getSyllables(word) > 0) return null;
    lines[lines.length - 1].push(word);
  }

  return lines.map((lineWords) => lineWords.join(' '));
}

export function registerHaikuListeners(client: Client): void {
  client.on('messageCreate', async (message: Message) => {
    try {
      if (message.author.bot) return;
      if (!message.content) return;

      const haikuLines = maybeParseHaiku(message.content);
      if (!haikuLines) return;

      const displayName =
        message.member?.displayName ?? message.author.displayName;

      const formatted = [
        `> _${haikuLines[0]}_`,
        `> `,
        `> _${haikuLines[1]}_`,
        `> `,
        `> _${haikuLines[2]}_`,
        `— ${displayName}`,
      ].join('\n');

      await message.reply({
        content: formatted,
        allowedMentions: { parse: [] },
      });

      logger.info({
        event: 'haiku_detected',
        userId: message.author.id,
        channelId: message.channelId,
      });
    } catch (error) {
      logger.error({
        event: 'haiku_detection_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: message.id,
      });
    }
  });

  logger.info('Haiku listeners registered');
}
