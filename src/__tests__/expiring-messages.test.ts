import { setTimeout } from 'node:timers';
import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  ApplicationIntegrationType,
  DiscordAPIError,
  InteractionContextType,
  PermissionFlagsBits,
  PermissionsBitField,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { lgtCommand } from '../commands';
import { db } from '../db/index';
import { expiringMessages } from '../db/schema';
import {
  getDueExpiringMessages,
  removeExpiringMessage,
  saveExpiringMessage,
} from '../db/expiring-messages';
import {
  deleteDueMessages,
  getExpiration,
  getExpiringMessageCommand,
  handleExpiringMessageCommand,
  scheduleSuccessConfirmationDismissal,
  sendAndSchedule,
  unconfirmedMessageReply,
} from '../expiring-messages';
import { logger } from '../logger';

const now = new Date('2026-10-02T12:00:00Z');

describe('expiring messages', () => {
  beforeEach(() => db.delete(expiringMessages).run());

  function makeInteraction({
    guildId = 'guild-1',
    channelId = 'channel-1',
    resolvedGuildId = 'guild-1',
    permissions = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ]),
    fetchFails = false,
    fetchError,
    fetchReturnsNull = false,
    cachedChannel = false,
    isThread = false,
  }: {
    guildId?: string | null;
    channelId?: string | null;
    resolvedGuildId?: string;
    permissions?: PermissionsBitField | null;
    fetchFails?: boolean;
    fetchError?: Error;
    fetchReturnsNull?: boolean;
    cachedChannel?: boolean;
    isThread?: boolean;
  } = {}) {
    const send = mock(
      async (_payload: {
        content: string;
        allowedMentions: { parse: string[] };
      }) => ({ id: 'posted-1' })
    );
    const channel = {
      guildId: resolvedGuildId,
      isTextBased: () => true,
      isSendable: () => true,
      isThread: () => isThread,
      send,
    };
    const fetch = mock(async (_channelId: string, _options?: object) => {
      if (fetchError) throw fetchError;
      if (fetchFails) throw new Error('missing access');
      return fetchReturnsNull ? null : channel;
    });
    const reply = mock(async (_payload: { content: string }) => undefined);
    const deferReply = mock(
      async (_payload: { ephemeral: boolean }) => undefined
    );
    const editReply = mock(async (_content: string) => undefined);
    const deleteReply = mock(async () => undefined);
    const interaction = {
      guildId,
      channelId,
      guild: null,
      channel: cachedChannel ? channel : null,
      appPermissions: permissions,
      client: { channels: { fetch } },
      options: {
        getString: (name: string) =>
          name === 'duration' ? 'hour' : 'A short test message',
      },
      user: { id: 'user-1' },
      reply,
      deferReply,
      editReply,
      deleteReply,
    } as unknown as ChatInputCommandInteraction;
    return {
      interaction,
      send,
      fetch,
      reply,
      deferReply,
      editReply,
      deleteReply,
    };
  }

  test('posts from an uncached guild channel and schedules deletion', async () => {
    const { interaction, send, fetch, deferReply, editReply } =
      makeInteraction();
    const dismiss = mock((_interaction: ChatInputCommandInteraction) => {});
    await handleExpiringMessageCommand(interaction, dismiss);

    expect(fetch).toHaveBeenCalledWith('channel-1', {
      allowUnknownGuild: true,
    });
    expect(deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].allowedMentions).toEqual({ parse: [] });
    expect(editReply.mock.calls[0][0]).toContain('Posted your message');
    expect(editReply.mock.calls[0][0]).not.toContain('<t:');
    expect(editReply.mock.calls[0][0]).toContain(
      'Others may still see notifications or save a copy'
    );
    expect(dismiss).toHaveBeenCalledWith(interaction);
    expect(
      getDueExpiringMessages(new Date(Date.now() + 60 * 60 * 1000))
    ).toHaveLength(1);
  });

  test('dismisses a successful confirmation after ten seconds', async () => {
    const { interaction, deleteReply } = makeInteraction();
    let runDismissal: (() => void) | undefined;
    const unref = mock(() => undefined);
    const schedule = mock((callback: () => void, _delay: number) => {
      runDismissal = callback;
      return { unref } as unknown as ReturnType<typeof setTimeout>;
    });

    scheduleSuccessConfirmationDismissal(interaction, schedule);
    expect(schedule.mock.calls[0][1]).toBe(10 * 1000);
    expect(unref).toHaveBeenCalledTimes(1);
    expect(deleteReply).not.toHaveBeenCalled();
    runDismissal?.();
    await Promise.resolve();
    expect(deleteReply).toHaveBeenCalledTimes(1);
  });

  test('uses a cached guild channel without fetching it', async () => {
    const { interaction, send, fetch } = makeInteraction({
      cachedChannel: true,
    });
    await handleExpiringMessageCommand(interaction);
    expect(fetch).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('rejects DMs without fetching a channel', async () => {
    const { interaction, fetch, reply } = makeInteraction({ guildId: null });
    await handleExpiringMessageCommand(interaction);
    expect(fetch).not.toHaveBeenCalled();
    expect(reply.mock.calls[0][0].content).toContain('server text channel');
  });

  test('does not post to inaccessible or mismatched channels', async () => {
    const dismiss = mock((_interaction: ChatInputCommandInteraction) => {});
    for (const options of [
      { fetchFails: true },
      { fetchReturnsNull: true },
      { resolvedGuildId: 'another-guild' },
    ]) {
      const { interaction, send, editReply } = makeInteraction(options);
      await handleExpiringMessageCommand(interaction, dismiss);
      expect(send).not.toHaveBeenCalled();
      expect(editReply.mock.calls[0][0]).toContain('could not access');
    }
    expect(dismiss).not.toHaveBeenCalled();
  });

  test('explains Discord Missing Access and requires a server bot install', async () => {
    const fetchError = new DiscordAPIError(
      { code: 50001, message: 'Missing Access' },
      50001,
      403,
      'GET',
      '/channels/channel-1',
      { body: undefined, files: undefined }
    );
    const { interaction, send, editReply } = makeInteraction({ fetchError });
    await handleExpiringMessageCommand(interaction);
    expect(send).not.toHaveBeenCalled();
    expect(editReply.mock.calls[0][0]).toContain('Discord error 50001');
    expect(editReply.mock.calls[0][0]).toContain('server admin');
    expect(editReply.mock.calls[0][0]).toContain('View Channel');
  });

  test('registers lgt only for server installs in servers', () => {
    const command = lgtCommand.toJSON();
    expect(command.integration_types).toEqual([
      ApplicationIntegrationType.GuildInstall,
    ]);
    expect(command.contexts).toEqual([InteractionContextType.Guild]);
  });

  test('does not post without the bot channel permissions', async () => {
    const { interaction, send, editReply } = makeInteraction({
      permissions: null,
    });
    await handleExpiringMessageCommand(interaction);
    expect(send).not.toHaveBeenCalled();
    expect(editReply.mock.calls[0][0]).toContain('permission');
  });

  test('uses thread message permission for a thread', async () => {
    const { interaction, send } = makeInteraction({
      isThread: true,
      permissions: new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessagesInThreads,
      ]),
    });
    await handleExpiringMessageCommand(interaction);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('offers only the production expiration choices', () => {
    const durationOption = getExpiringMessageCommand()
      .toJSON()
      .options?.find((option) => option.name === 'duration');
    expect(
      durationOption && 'choices' in durationOption
        ? durationOption.choices?.map((choice) => [choice.name, choice.value])
        : []
    ).toEqual([
      ['After 1 hour', 'hour'],
      ['After 1 day', 'day'],
      ['After 1 week', 'week'],
    ]);
    expect(getExpiration('30-seconds', now)).toBeNull();
  });

  test('supports the advertised durations', () => {
    expect(getExpiration('hour', now)?.getTime()).toBe(
      now.getTime() + 60 * 60 * 1000
    );
    expect(getExpiration('day', now)?.getTime()).toBe(
      now.getTime() + 24 * 60 * 60 * 1000
    );
    expect(getExpiration('week', now)?.getTime()).toBe(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    expect(getExpiration('month', now)).toBeNull();
  });

  test('schedules only after a successful post and leaves content out of storage', async () => {
    const result = await sendAndSchedule({
      send: async () => 'message-1',
      save: (messageId) =>
        saveExpiringMessage({
          messageId,
          guildId: 'guild-1',
          channelId: 'channel-1',
          authorId: 'user-1',
          expiresAt: now,
        }),
      compensate: async () => {
        throw new Error('should not be called');
      },
    });
    expect(result).toBe('scheduled');
    expect(getDueExpiringMessages(now)).toEqual([
      {
        messageId: 'message-1',
        guildId: 'guild-1',
        channelId: 'channel-1',
        authorId: 'user-1',
        expiresAt: now,
      },
    ]);
  });

  test('returns a failure when posting fails without trying to save', async () => {
    const save = mock(() => undefined);
    const result = await sendAndSchedule({
      send: async () => {
        throw new Error('Discord unavailable');
      },
      save,
      compensate: async () => undefined,
    });
    expect(result).toBe('send_failed');
    expect(save).not.toHaveBeenCalled();
  });

  test('reports failure and logs if saving and cleanup both fail', async () => {
    let attemptedDelete = false;
    const log = spyOn(logger, 'error').mockImplementation(() => logger);
    try {
      const result = await sendAndSchedule({
        send: async () => 'message-2',
        save: () => {
          throw new Error('database unavailable');
        },
        compensate: async () => {
          attemptedDelete = true;
          throw new Error('Discord unavailable');
        },
      });
      expect(result).toBe('send_failed');
      expect(attemptedDelete).toBe(true);
      expect(log.mock.calls.at(-1)?.[1]).toContain('URGENT');
      expect(log.mock.calls.at(-1)?.[0]).toMatchObject({
        messageId: 'message-2',
      });
    } finally {
      log.mockRestore();
    }
  });

  test('failure reply tells members to check for a bot message', () => {
    expect(unconfirmedMessageReply).toContain('Check this channel');
    expect(unconfirmedMessageReply).toContain('moderator or admin');
  });

  test('removes a posted message when scheduling fails', async () => {
    const deleted: string[] = [];
    const log = spyOn(logger, 'error').mockImplementation(() => logger);
    try {
      const result = await sendAndSchedule({
        send: async () => 'message-2',
        save: () => {
          throw new Error('database unavailable');
        },
        compensate: async (messageId) => {
          deleted.push(messageId);
        },
      });
      expect(result).toBe('send_failed');
      expect(deleted).toEqual(['message-2']);
    } finally {
      log.mockRestore();
    }
  });

  test('removes a due row only after deletion succeeds and retries failures', async () => {
    saveExpiringMessage({
      messageId: 'message-3',
      guildId: 'guild-1',
      channelId: 'channel-1',
      authorId: 'user-1',
      expiresAt: now,
    });
    const later = new Date(now.getTime() + 1000);
    saveExpiringMessage({
      messageId: 'message-4',
      guildId: 'guild-1',
      channelId: 'channel-1',
      authorId: 'user-1',
      expiresAt: later,
    });

    await deleteDueMessages({
      now,
      deleteMessage: async () => {
        throw new Error('temporary Discord error');
      },
    });
    expect(getDueExpiringMessages(now)).toHaveLength(1);

    const deleted: string[] = [];
    await deleteDueMessages({
      now,
      deleteMessage: async (message) => {
        deleted.push(message.messageId);
      },
    });
    expect(deleted).toEqual(['message-3']);
    expect(getDueExpiringMessages(now)).toHaveLength(0);
    expect(getDueExpiringMessages(later)).toHaveLength(1);
    removeExpiringMessage('message-4');
  });

  test('reaches newer due rows after 100 persistent failures, then wraps to retry', async () => {
    for (let index = 0; index < 150; index++) {
      saveExpiringMessage({
        messageId: `message-${String(index).padStart(3, '0')}`,
        guildId: 'guild-1',
        channelId: 'channel-1',
        authorId: 'user-1',
        expiresAt: now,
      });
    }

    const attempted: string[] = [];
    const log = spyOn(logger, 'error').mockImplementation(() => logger);
    try {
      const deleteMessage = async (message: { messageId: string }) => {
        attempted.push(message.messageId);
        if (message.messageId < 'message-100') {
          throw new Error('persistent permission failure');
        }
      };
      const firstCursor = await deleteDueMessages({ now, deleteMessage });
      expect(attempted).toHaveLength(100);
      expect(firstCursor?.messageId).toBe('message-099');

      const secondCursor = await deleteDueMessages({
        now,
        after: firstCursor,
        deleteMessage,
      });
      expect(attempted.slice(100)).toHaveLength(50);
      expect(attempted.at(-1)).toBe('message-149');
      expect(secondCursor?.messageId).toBe('message-149');
      expect(getDueExpiringMessages(now)).toHaveLength(100);

      await deleteDueMessages({
        now,
        after: secondCursor,
        deleteMessage: async (message) => {
          attempted.push(message.messageId);
        },
      });
      expect(attempted.slice(150)).toHaveLength(100);
      expect(getDueExpiringMessages(now)).toHaveLength(0);
    } finally {
      log.mockRestore();
    }
  });
});
