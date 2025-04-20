/* eslint-disable @typescript-eslint/no-explicit-any */

import { mock } from 'bun:test';
import type { Message, MessageReaction, User } from 'discord.js';

let eventHandlers: Record<string, ((...args: any[]) => Promise<void>)[]> = {};

export const mockDiscordChannel = { send: mock() };
export const mockDiscordClient = {
  on: (event: string, handler: (...args: any[]) => Promise<void>) => {
    if (!eventHandlers[event]) {
      eventHandlers[event] = [];
    }
    eventHandlers[event]!.push(handler);
  },
  emit: async (event: string, ...args: any[]) => {
    const handlers = eventHandlers[event] || [];
    for (const handler of handlers) {
      await handler(...args);
    }
    return handlers.length > 0;
  },
  channels: {
    fetch: mock(() => Promise.resolve(mockDiscordChannel)),
  },
  application: {
    commands: {
      create: mock(),
    },
  },
};

export function resetMockDiscordClient() {
  // Looks like the plan is to implement global mock clearing in the future
  // https://github.com/oven-sh/bun/issues/18820
  // https://github.com/oven-sh/bun/issues/5391
  // For now, we'll just clear the mocks manually
  mockDiscordClient.channels.fetch.mockClear();
  mockDiscordClient.application.commands.create.mockClear();
  mockDiscordChannel.send.mockClear();
  eventHandlers = {};
}

export type MockInteraction = {
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

export function createMockUser(id = '123'): User {
  return {
    id,
    toString: () => `<@${id}>`,
    bot: false,
  } as unknown as User;
}

export function createMockMessage(authorId: string): Message {
  return {
    id: 'msg123',
    channelId: 'channel123',
    author: createMockUser(authorId),
    guildId: 'guild123',
    partial: false,
    channel: {
      isTextBased: () => true,
      send: mock(),
    },
  } as unknown as Message;
}

export function createMockReaction(message: Message): MessageReaction {
  const reaction = {
    message,
    emoji: { name: 'lgt' },
    users: {
      remove: mock(),
    },
    partial: false,
    fetch: () => Promise.resolve(reaction),
  } as unknown as MessageReaction;
  return reaction;
}

export function createMockInteraction({
  subcommandGroup,
  subcommand,
  options = {},
  userId = '123',
}: {
  subcommandGroup: string;
  subcommand: string;
  options?: Record<string, string>;
  userId?: string;
}): MockInteraction {
  return {
    isChatInputCommand: () => true,
    commandName: 'lgt',
    options: {
      getSubcommandGroup: () => subcommandGroup,
      getSubcommand: () => subcommand,
      getUser: () => createMockUser(userId),
      getString: (key: string) => options[key],
    },
    user: createMockUser(userId),
    reply: mock(),
    guild: {
      members: {
        fetch: mock(),
        cache: new Map(),
      },
    },
  } as unknown as MockInteraction;
}
