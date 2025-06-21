import { Client, Events, GuildMember, TextChannel } from 'discord.js';
import { registerWeeklyWinsListeners } from '../weekly-wins';

// Mock Discord client for testing
const mockClient = {
  on: jest.fn(),
  channels: {
    fetch: jest.fn(),
  },
} as any as Client;

const mockChannel = {
  send: jest.fn(),
} as any as TextChannel;

const mockOldMember = {
  roles: {
    cache: new Map(),
  },
} as any as GuildMember;

const mockNewMember = {
  roles: {
    cache: new Map([['1364069953459720192', {}]]),
  },
  user: {
    username: 'testuser',
  },
  id: '123456789',
} as any as GuildMember;

describe('Weekly Wins Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should register GuildMemberUpdate listener', () => {
    registerWeeklyWinsListeners(mockClient);

    expect(mockClient.on).toHaveBeenCalledWith(
      Events.GuildMemberUpdate,
      expect.any(Function)
    );
  });

  test('should send welcome message when user gains Weekly Wins role', async () => {
    // Mock the channel fetch to return our mock channel
    mockClient.channels.fetch = jest.fn().mockResolvedValue(mockChannel);

    registerWeeklyWinsListeners(mockClient);

    // Get the registered listener function
    const listener = mockClient.on.mock.calls[0][1];

    // Call the listener with old and new member
    await listener(mockOldMember, mockNewMember);

    expect(mockClient.channels.fetch).toHaveBeenCalledWith(
      '1364070715740917782'
    );
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.stringContaining('welcome to the Weekly Wins Club!')
    );
  });

  test('should not send message if user already had the role', async () => {
    const mockOldMemberWithRole = {
      roles: {
        cache: new Map([['1364069953459720192', {}]]),
      },
    } as any as GuildMember;

    registerWeeklyWinsListeners(mockClient);

    const listener = mockClient.on.mock.calls[0][1];

    await listener(mockOldMemberWithRole, mockNewMember);

    expect(mockClient.channels.fetch).not.toHaveBeenCalled();
    expect(mockChannel.send).not.toHaveBeenCalled();
  });
});
