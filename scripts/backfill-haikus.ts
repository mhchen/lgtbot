/**
 * Backfill the `haikus` table from the bot's historical haiku replies.
 *
 * The live bot records every haiku it posts going forward. This script walks
 * the bot's existing haiku replies, resolves the original message each one was
 * a reply to, and inserts a row for it. Re-running is safe: rows are keyed on
 * original_message_id and existing ones are left untouched.
 *
 * Usage:
 *   bun run scripts/backfill-haikus.ts --dry-run       # report, write nothing
 *   bun run scripts/backfill-haikus.ts                 # write to the database
 *   bun run scripts/backfill-haikus.ts --since 2026-01-01
 *   bun run scripts/backfill-haikus.ts --include-archived
 *   bun run scripts/backfill-haikus.ts --limit 2000    # cap scan per channel
 *
 * Requires DISCORD_TOKEN in .env (the token the bot runs with) and writes to
 * the same SQLite database the bot uses (data/lgtbot.db).
 */
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  type Message,
  type TextBasedChannel,
  type GuildBasedChannel,
} from 'discord.js';
import { db } from '../src/db/index';
import { haikus } from '../src/db/schema';

type Options = {
  dryRun: boolean;
  since?: Date;
  perChannelLimit: number;
  includeArchived: boolean;
};

type HaikuRow = typeof haikus.$inferInsert;

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dryRun: false,
    perChannelLimit: Infinity,
    includeArchived: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--include-archived':
        options.includeArchived = true;
        break;
      case '--limit':
        options.perChannelLimit = Number(argv[++index]);
        break;
      case '--since':
        options.since = new Date(argv[++index]);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  return options;
}

/**
 * A haiku reply is three blockquote-italic lines (`> _…_`) followed by an
 * `— name` attribution. See src/haiku.ts.
 */
function isHaiku(content: string): boolean {
  const italicQuoteLines = content.match(/^> _.+_$/gm)?.length ?? 0;
  return italicQuoteLines >= 3 && /^— /m.test(content);
}

/** Reconstruct the stored haiku text (three lines) from a reply's content. */
function extractHaikuText(content: string): string | null {
  const lines = [...content.matchAll(/^> _(.+)_$/gm)].map((match) => match[1]);
  if (lines.length < 3) return null;
  return lines.slice(0, 3).join('\n');
}

function isCrawlable(
  channel: GuildBasedChannel | null
): channel is GuildBasedChannel {
  if (!channel) return false;
  return (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.isThread()
  );
}

type Stats = {
  scanned: number;
  candidates: number;
  inserted: number;
  alreadyPresent: number;
  noReference: number;
  originalMissing: number;
  unparseable: number;
};

async function backfillChannel(
  channel: TextBasedChannel,
  botId: string,
  options: Options,
  stats: Stats
): Promise<void> {
  let before: string | undefined;
  let reachedCutoff = false;

  while (stats.scanned < options.perChannelLimit && !reachedCutoff) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;

    for (const message of batch.values()) {
      if (options.since && message.createdAt < options.since) {
        reachedCutoff = true;
        break;
      }
      stats.scanned++;
      if (message.author.id !== botId) continue;
      if (!isHaiku(message.content)) continue;

      stats.candidates++;

      const originalMessageId = message.reference?.messageId;
      if (!originalMessageId) {
        stats.noReference++;
        continue;
      }

      const haikuText = extractHaikuText(message.content);
      if (!haikuText) {
        stats.unparseable++;
        continue;
      }

      let original: Message;
      try {
        original = await channel.messages.fetch(originalMessageId);
      } catch {
        // Original was deleted or is otherwise unreachable.
        stats.originalMissing++;
        continue;
      }

      const row: HaikuRow = {
        originalMessageId,
        haikuMessageId: message.id,
        channelId: channel.id,
        originalText: original.content,
        haikuText,
        authorUserId: original.author.id,
        createdAt: message.createdAt,
      };

      if (options.dryRun) {
        stats.inserted++;
        console.error(
          `  would insert ${message.url} — @${original.author.id}: ${haikuText.replace(/\n/g, ' / ')}`
        );
        continue;
      }

      const result = await db
        .insert(haikus)
        .values(row)
        .onConflictDoNothing({ target: haikus.originalMessageId })
        .returning();

      if (result.length > 0) stats.inserted++;
      else stats.alreadyPresent++;
    }

    before = batch.last()?.id;
    if (!before || batch.size < 100) break;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('DISCORD_TOKEN is not set. Add it to .env.');
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
  });

  await client.login(token);
  await new Promise<void>((resolve) => client.once('ready', () => resolve()));

  const botId = client.user!.id;
  console.error(
    `Logged in as ${client.user!.tag} (${botId})${options.dryRun ? ' [dry run]' : ''}`
  );

  const stats: Stats = {
    scanned: 0,
    candidates: 0,
    inserted: 0,
    alreadyPresent: 0,
    noReference: 0,
    originalMissing: 0,
    unparseable: 0,
  };

  const guilds = await client.guilds.fetch();
  for (const guildPreview of guilds.values()) {
    const guild = await guildPreview.fetch();
    console.error(`\nGuild: ${guild.name}`);

    const channels = await guild.channels.fetch();
    const targets: TextBasedChannel[] = [];

    for (const channel of channels.values()) {
      if (!isCrawlable(channel)) continue;
      targets.push(channel as TextBasedChannel);

      if ('threads' in channel) {
        const active = await channel.threads.fetchActive().catch(() => null);
        if (active) targets.push(...active.threads.values());
        if (options.includeArchived) {
          const archived = await channel.threads
            .fetchArchived({ type: 'public' })
            .catch(() => null);
          if (archived) targets.push(...archived.threads.values());
        }
      }
    }

    for (const channel of targets) {
      const label = 'name' in channel ? channel.name : channel.id;
      try {
        await backfillChannel(channel, botId, options, stats);
      } catch (error) {
        const code = (error as { code?: number }).code;
        if (code === 50001 || code === 50013) {
          console.error(`  #${label}: skipped (no access)`);
        } else {
          console.error(`  #${label}: error — ${(error as Error).message}`);
        }
      }
    }
  }

  console.error(
    `\n${options.dryRun ? 'Would insert' : 'Inserted'}: ${stats.inserted}` +
      `\nAlready present: ${stats.alreadyPresent}` +
      `\nSkipped (no reply reference): ${stats.noReference}` +
      `\nSkipped (original message gone): ${stats.originalMissing}` +
      `\nSkipped (could not parse haiku): ${stats.unparseable}` +
      `\nHaiku replies seen: ${stats.candidates} (of ${stats.scanned} messages scanned)`
  );

  await client.destroy();
  process.exit(0);
}

main();
