/* eslint-disable @typescript-eslint/no-explicit-any */

import { mock } from 'bun:test';

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
