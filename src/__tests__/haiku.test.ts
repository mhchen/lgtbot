import { describe, expect, test, beforeEach, mock } from 'bun:test';
import type { Client, Message } from 'discord.js';
import { maybeParseHaiku, registerHaikuListeners } from '../haiku';
import { db } from '../db/index';
import { haikus } from '../db/schema';
import { mockDiscordClient, resetMockDiscordClient } from './mockDiscordClient';

const HAIKU_TEXT =
  'an old silent pond a frog jumps into the pond splash silence again';

function createHaikuMessage({
  authorId = 'author123',
  content,
  replyId = 'reply123',
}: {
  authorId?: string;
  content: string;
  replyId?: string;
}): { message: Message; reply: ReturnType<typeof mock> } {
  const reply = mock(() => Promise.resolve({ id: replyId } as Message));
  const message = {
    id: 'orig123',
    channelId: 'channel456',
    content,
    author: { id: authorId, bot: false, displayName: 'Bashō' },
    member: { displayName: 'Bashō' },
    reply,
  } as unknown as Message;
  return { message, reply };
}

describe('maybeParseHaiku', () => {
  test('parses a valid 5-7-5 message into three lines', () => {
    expect(maybeParseHaiku(HAIKU_TEXT)).toEqual([
      'an old silent pond',
      'a frog jumps into the pond',
      'splash silence again',
    ]);
  });

  test('returns null for non-haiku text', () => {
    expect(maybeParseHaiku('just a normal sentence here')).toBeNull();
  });

  test('returns null for empty text', () => {
    expect(maybeParseHaiku('   ')).toBeNull();
  });
});

describe('haiku listener', () => {
  beforeEach(async () => {
    resetMockDiscordClient();
    await db.delete(haikus);
    registerHaikuListeners(mockDiscordClient as unknown as Client);
  });

  test('stores a haiku row when a message is a valid haiku', async () => {
    const { message, reply } = createHaikuMessage({ content: HAIKU_TEXT });

    await mockDiscordClient.emit('messageCreate', message);

    expect(reply).toHaveBeenCalledTimes(1);

    const rows = await db.select().from(haikus);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      originalMessageId: 'orig123',
      haikuMessageId: 'reply123',
      channelId: 'channel456',
      originalText: HAIKU_TEXT,
      haikuText: 'an old silent pond\na frog jumps into the pond\nsplash silence again',
      authorUserId: 'author123',
    });
    expect(rows[0]!.createdAt).toBeInstanceOf(Date);
  });

  test('does not store anything when the message is not a haiku', async () => {
    const { message, reply } = createHaikuMessage({
      content: 'just a normal sentence here',
    });

    await mockDiscordClient.emit('messageCreate', message);

    expect(reply).not.toHaveBeenCalled();
    const rows = await db.select().from(haikus);
    expect(rows).toHaveLength(0);
  });

  test('ignores messages authored by bots', async () => {
    const { message, reply } = createHaikuMessage({ content: HAIKU_TEXT });
    (message.author as { bot: boolean }).bot = true;

    await mockDiscordClient.emit('messageCreate', message);

    expect(reply).not.toHaveBeenCalled();
    const rows = await db.select().from(haikus);
    expect(rows).toHaveLength(0);
  });
});
