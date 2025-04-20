import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Client } from 'discord.js';
import type { Interaction } from 'discord.js';
import {
  registerBookClubBansListeners,
  handleBookclubCommand,
} from '../book-club-bans';
import { db } from '../db/index';
import { bookClubBans } from '../db/schema';
import {
  mockDiscordClient,
  mockDiscordChannel,
  resetMockDiscordClient,
} from './mockDiscordClient';

type MockReaction = {
  emoji: { name: string };
  message: {
    id: string;
    author: { id: string };
    partial: boolean;
  };
  partial: boolean;
};

type MockUser = {
  id: string;
  toString: () => string;
};

type MockInteraction = {
  isChatInputCommand: () => boolean;
  commandName: string;
  options: {
    getSubcommand: () => string;
    getSubcommandGroup: () => string;
  };
  reply: ReturnType<typeof mock>;
  guild: {
    members: {
      fetch: ReturnType<typeof mock>;
      cache: Map<string, { id: string; displayName: string }>;
    };
  };
};

describe('Book Club Bans', () => {
  let user: MockUser;
  beforeEach(() => {
    resetMockDiscordClient();
    db.delete(bookClubBans).run();
    user = {
      id: '356482549549236225',
      toString: () => `<@356482549549236225>`,
    };

    registerBookClubBansListeners(mockDiscordClient as unknown as Client);

    mockDiscordClient.on(
      'interactionCreate',
      async (interaction: MockInteraction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'lgt') return;
        if (interaction.options.getSubcommandGroup() !== 'bookclub') return;
        await handleBookclubCommand(interaction as unknown as Interaction);
      }
    );
  });

  test('bans a user when Mike adds banhammer reaction', async () => {
    const reaction = createMockReaction({
      messageId: '987654321',
      userId: '123456789',
    });
    await mockDiscordClient.emit('messageReactionAdd', reaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe('987654321');

    expect(mockDiscordChannel.send).toHaveBeenCalledTimes(1);
    expect(mockDiscordChannel.send).toHaveBeenCalledWith(
      expect.stringMatching(/^<@123456789> has been banned/)
    );
  });

  test('increments ban count when Mike adds another banhammer reaction', async () => {
    const firstReaction = createMockReaction({
      messageId: '987654321',
      userId: '123456789',
    });
    const secondReaction = createMockReaction({
      messageId: '111111111',
      userId: '123456789',
    });

    await mockDiscordClient.emit('messageReactionAdd', firstReaction, user);
    await mockDiscordClient.emit('messageReactionAdd', secondReaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe('987654321,111111111');

    expect(mockDiscordChannel.send).toHaveBeenCalledTimes(2);
    expect(mockDiscordChannel.send).toHaveBeenLastCalledWith({
      content: expect.stringMatching(
        /^<@123456789> has received their 2nd ban/
      ),
      files: undefined,
    });
  });

  test('unbans a user when Mike removes banhammer reaction', async () => {
    const reaction = createMockReaction({
      messageId: '987654321',
      userId: '123456789',
    });

    await mockDiscordClient.emit('messageReactionAdd', reaction, user);
    await mockDiscordClient.emit('messageReactionRemove', reaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(0);

    expect(mockDiscordChannel.send).toHaveBeenCalledTimes(2);
    expect(mockDiscordChannel.send).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^<@123456789> has been brought back into .+ Mike's good graces\.$/
      )
    );
  });

  test('partially unbans a user with multiple bans', async () => {
    const reaction = createMockReaction({
      messageId: '987654321',
      userId: '123456789',
    });
    const secondReaction = createMockReaction({
      messageId: '111111111',
      userId: '123456789',
    });

    await mockDiscordClient.emit('messageReactionAdd', reaction, user);
    await mockDiscordClient.emit('messageReactionAdd', secondReaction, user);
    await mockDiscordClient.emit('messageReactionRemove', reaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe('111111111');

    expect(mockDiscordChannel.send).toHaveBeenCalledTimes(3);
    expect(mockDiscordChannel.send).toHaveBeenLastCalledWith(
      expect.stringMatching(/<@123456789> .*\b1 strike remaining\./)
    );
  });

  test('unlocks achievement at 10 bans', async () => {
    for (let i = 0; i < 10; i++) {
      const newReaction = createMockReaction({
        messageId: `message${i}`,
        userId: '123456789',
      });
      await mockDiscordClient.emit('messageReactionAdd', newReaction, user);
    }

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordMessageIds.split(',').length).toBe(10);

    expect(mockDiscordChannel.send).toHaveBeenCalledTimes(10);
    expect(mockDiscordChannel.send).toHaveBeenLastCalledWith({
      content: expect.stringMatching(/Achievement unlocked:/),
      files: expect.any(Array),
    });
  });

  test('displays ban leaderboard when /bookclub bans command is used', async () => {
    const reaction = createMockReaction({
      messageId: '987654321',
      userId: '123456789',
    });
    await mockDiscordClient.emit('messageReactionAdd', reaction, user);

    const interaction = createMockInteraction();
    await mockDiscordClient.emit('interactionCreate', interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith(
      '# Book club ban leaderboard\n1. TestUser — 1 ban'
    );
  });

  test('handles empty leaderboard', async () => {
    const interaction = createMockInteraction();
    await mockDiscordClient.emit('interactionCreate', interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith(
      'No one has been banned from book club yet! 📚'
    );
  });
});

function createMockReaction({
  messageId,
  userId,
}: {
  messageId: string;
  userId: string;
}): MockReaction {
  return {
    emoji: { name: 'banhammer' },
    message: {
      id: messageId,
      author: { id: userId },
      partial: false,
    },
    partial: false,
  };
}

function createMockInteraction(overrides = {}) {
  return {
    isChatInputCommand: () => true,
    commandName: 'lgt',
    options: {
      getSubcommand: () => 'bans',
      getSubcommandGroup: () => 'bookclub',
    },
    reply: mock(),
    guild: {
      members: {
        fetch: mock(() => Promise.resolve()),
        cache: new Map([
          [
            '123456789',
            {
              id: '123456789',
              displayName: 'TestUser',
            },
          ],
        ]),
      },
    },
    ...overrides,
  };
}
