import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Client, GuildMember } from 'discord.js';
import {
  assignUnverifiedRole,
  registerVerificationListeners,
} from '../verification';
import {
  mockDiscordChannel,
  mockDiscordClient,
  resetMockDiscordClient,
} from './mockDiscordClient';

const VERIFIED_ROLE_ID = '1531700897623572700';
const UNVERIFIED_ROLE_ID = '1532179332460576913';
const ROLE_LOG_CHANNEL_ID = '1532182270209949758';

function createMockMember({
  isBot = false,
  hasVerifiedRole = false,
  hasUnverifiedRole = false,
  addRoleError,
  id = 'member123',
}: {
  isBot?: boolean;
  hasVerifiedRole?: boolean;
  hasUnverifiedRole?: boolean;
  addRoleError?: Error;
  id?: string;
} = {}) {
  const addRole = mock((_roleId: string) => {
    if (addRoleError) return Promise.reject(addRoleError);
    return Promise.resolve();
  });
  const member = {
    id,
    user: { bot: isBot },
    guild: {
      client: mockDiscordClient,
    },
    roles: {
      cache: {
        has: (roleId: string) =>
          (roleId === VERIFIED_ROLE_ID && hasVerifiedRole) ||
          (roleId === UNVERIFIED_ROLE_ID && hasUnverifiedRole),
      },
      add: addRole,
    },
  } as unknown as GuildMember;

  return { addRole, member };
}

describe('member role management', () => {
  beforeEach(() => {
    resetMockDiscordClient();
  });

  test('assigns the unverified role when a member joins', async () => {
    const { addRole, member } = createMockMember();

    const assigned = await assignUnverifiedRole(member);

    expect(assigned).toBe(true);
    expect(addRole).toHaveBeenCalledWith(
      UNVERIFIED_ROLE_ID,
      'Joined the server'
    );
  });

  test('does not assign the unverified role to bots', async () => {
    const { addRole, member } = createMockMember({ isBot: true });

    const assigned = await assignUnverifiedRole(member);

    expect(assigned).toBe(false);
    expect(addRole).not.toHaveBeenCalled();
  });

  test('does not assign unverified to an already verified member', async () => {
    const { addRole, member } = createMockMember({ hasVerifiedRole: true });

    const assigned = await assignUnverifiedRole(member);

    expect(assigned).toBe(false);
    expect(addRole).not.toHaveBeenCalled();
  });

  test('reports a failed unverified role assignment', async () => {
    const { member } = createMockMember({
      addRoleError: new Error('Missing Permissions'),
    });

    await expect(assignUnverifiedRole(member)).rejects.toThrow(
      'Missing Permissions'
    );

    expect(mockDiscordClient.channels.fetch).toHaveBeenCalledWith(
      ROLE_LOG_CHANNEL_ID
    );
    expect(mockDiscordChannel.send).toHaveBeenCalledWith({
      content: `❌ Failed to add <@&${UNVERIFIED_ROLE_ID}> to <@member123>: Missing Permissions`,
      allowedMentions: { parse: [] },
    });
  });

  test('registers a member-join listener', async () => {
    const { addRole, member } = createMockMember();
    registerVerificationListeners(mockDiscordClient as unknown as Client);

    const handled = await mockDiscordClient.emit('guildMemberAdd', member);

    expect(handled).toBe(true);
    expect(addRole).toHaveBeenCalledWith(
      UNVERIFIED_ROLE_ID,
      'Joined the server'
    );
  });

  test('logs when a tracked role is gained', async () => {
    const { member: oldMember } = createMockMember();
    const { member: newMember } = createMockMember({
      hasVerifiedRole: true,
    });
    registerVerificationListeners(mockDiscordClient as unknown as Client);

    await mockDiscordClient.emit('guildMemberUpdate', oldMember, newMember);

    expect(mockDiscordClient.channels.fetch).toHaveBeenCalledWith(
      ROLE_LOG_CHANNEL_ID
    );
    expect(mockDiscordChannel.send).toHaveBeenCalledWith({
      content: `<@member123> gained the <@&${VERIFIED_ROLE_ID}> role (verified).`,
      allowedMentions: { parse: [] },
    });
  });

  test('logs when a tracked role is lost', async () => {
    const { member: oldMember } = createMockMember({
      hasUnverifiedRole: true,
    });
    const { member: newMember } = createMockMember();
    registerVerificationListeners(mockDiscordClient as unknown as Client);

    await mockDiscordClient.emit('guildMemberUpdate', oldMember, newMember);

    expect(mockDiscordChannel.send).toHaveBeenCalledWith({
      content: `<@member123> lost the <@&${UNVERIFIED_ROLE_ID}> role (unverified).`,
      allowedMentions: { parse: [] },
    });
  });

  test('does not log member updates without tracked role changes', async () => {
    const { member: oldMember } = createMockMember();
    const { member: newMember } = createMockMember();
    registerVerificationListeners(mockDiscordClient as unknown as Client);

    await mockDiscordClient.emit('guildMemberUpdate', oldMember, newMember);

    expect(mockDiscordClient.channels.fetch).not.toHaveBeenCalled();
    expect(mockDiscordChannel.send).not.toHaveBeenCalled();
  });

  test('does not register thread-based verification automation', async () => {
    registerVerificationListeners(mockDiscordClient as unknown as Client);

    const handled = await mockDiscordClient.emit('threadCreate', {});

    expect(handled).toBe(false);
  });
});
