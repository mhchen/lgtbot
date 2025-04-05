import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { Client } from 'discord.js';
import { registerBookClubBansListeners } from '../book-club-bans';
import { db } from '../db/index';
import { bookClubBans } from '../db/schema';

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
  };
  reply: ReturnType<typeof mock>;
  guild: {
    members: {
      fetch: ReturnType<typeof mock>;
      cache: Map<string, { user: { displayName: string } }>;
    };
  };
};

type EventMap = {
  messageReactionAdd: [MockReaction, MockUser];
  messageReactionRemove: [MockReaction, MockUser];
  interactionCreate: [MockInteraction];
};

type MockClient = {
  on: <K extends keyof EventMap>(
    event: K,
    handler: (...args: EventMap[K]) => void | Promise<void>
  ) => void;
  emit: <K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K]
  ) => Promise<boolean>;
  channels: {
    fetch: ReturnType<typeof mock>;
  };
  application?: {
    commands: {
      create: ReturnType<typeof mock>;
    };
  };
};

describe('Book Club Bans', () => {
  let client: MockClient;
  let mockChannel: { send: ReturnType<typeof mock> };
  let user: MockUser;
  let eventHandlers: {
    [K in keyof EventMap]?: ((...args: EventMap[K]) => void | Promise<void>)[];
  };

  beforeEach(() => {
    db.delete(bookClubBans).run();
    eventHandlers = {};

    mockChannel = { send: mock() };
    client = {
      on: (event, handler) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event]!.push(handler);
      },
      emit: async (event, ...args) => {
        const handlers = eventHandlers[event] || [];
        for (const handler of handlers) {
          await handler(...args);
        }
        return handlers.length > 0;
      },
      channels: {
        fetch: mock(() => Promise.resolve(mockChannel)),
      },
      application: {
        commands: {
          create: mock(),
        },
      },
    };

    user = {
      id: '356482549549236225',
      toString: () => `<@356482549549236225>`,
    };

    registerBookClubBansListeners(client as unknown as Client);
  });

  test('bans a user when Mike adds banhammer reaction', async () => {
    const reaction = createMockReaction({
      messageId: '987654321',
      userId: '123456789',
    });
    await client.emit('messageReactionAdd', reaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe('987654321');

    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    expect(mockChannel.send).toHaveBeenCalledWith(
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

    await client.emit('messageReactionAdd', firstReaction, user);
    await client.emit('messageReactionAdd', secondReaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe('987654321,111111111');

    expect(mockChannel.send).toHaveBeenCalledTimes(2);
    expect(mockChannel.send).toHaveBeenLastCalledWith({
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

    await client.emit('messageReactionAdd', reaction, user);
    await client.emit('messageReactionRemove', reaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(0);

    expect(mockChannel.send).toHaveBeenCalledTimes(2);
    expect(mockChannel.send).toHaveBeenLastCalledWith(
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

    await client.emit('messageReactionAdd', reaction, user);
    await client.emit('messageReactionAdd', secondReaction, user);
    await client.emit('messageReactionRemove', reaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe('111111111');

    expect(mockChannel.send).toHaveBeenCalledTimes(3);
    expect(mockChannel.send).toHaveBeenLastCalledWith(
      expect.stringMatching(/<@123456789> .*\b1 strike remaining\./)
    );
  });

  test('unlocks achievement at 10 bans', async () => {
    for (let i = 0; i < 10; i++) {
      const newReaction = createMockReaction({
        messageId: `message${i}`,
        userId: '123456789',
      });
      await client.emit('messageReactionAdd', newReaction, user);
    }

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordMessageIds.split(',').length).toBe(10);

    expect(mockChannel.send).toHaveBeenCalledTimes(10);
    expect(mockChannel.send).toHaveBeenLastCalledWith({
      content: expect.stringMatching(/Achievement unlocked:/),
      files: expect.any(Array),
    });
  });

  test('displays ban leaderboard when /bookclub bans command is used', async () => {
    const reaction = createMockReaction({
      messageId: '987654321',
      userId: '123456789',
    });
    await client.emit('messageReactionAdd', reaction, user);

    const interaction = createMockInteraction();
    await client.emit('interactionCreate', interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith(
      '# Book club ban leaderboard\n1. TestUser — 1 ban'
    );
  });

  test('handles empty leaderboard', async () => {
    const interaction = createMockInteraction();
    await client.emit('interactionCreate', interaction);

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
    commandName: 'bookclub',
    options: {
      getSubcommand: () => 'bans',
    },
    reply: mock(),
    guild: {
      members: {
        fetch: mock(() => Promise.resolve(undefined)),
        cache: new Map([
          ['123456789', { id: '123456789', user: { displayName: 'TestUser' } }],
        ]),
      },
    },
    ...overrides,
  };
}
