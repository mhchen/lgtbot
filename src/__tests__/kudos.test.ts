import { describe, expect, test, beforeEach, mock } from 'bun:test';
import {
  handleTopCommand,
  handleCommand,
  registerKudosListeners,
} from '../kudos';
import { db } from '../db/index';
import { kudosReactions } from '../db/schema';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { subDays } from 'date-fns';
import {
  createMockUser,
  createMockMessage,
  createMockReaction,
  mockDiscordClient,
  createMockInteraction as createLgtMockInteraction,
  resetMockDiscordClient,
  type MockInteraction,
} from './mockDiscordClient';

function createMockInteraction({
  subcommand,
  options = {},
}: {
  subcommand: string;
  options?: Record<string, string>;
}): MockInteraction {
  return createLgtMockInteraction({
    subcommandGroup: 'kudos',
    subcommand,
    options,
  });
}

describe('kudos', () => {
  beforeEach(async () => {
    resetMockDiscordClient();
    await db.delete(kudosReactions);
    registerKudosListeners(mockDiscordClient as unknown as Client);
    mockDiscordClient.on(
      'interactionCreate',
      async (interaction: MockInteraction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'lgt') return;
        if (interaction.options.getSubcommandGroup() !== 'kudos') return;
        await handleCommand(
          interaction as unknown as ChatInputCommandInteraction
        );
      }
    );
  });
  describe('handleKudosReaction', () => {
    test('prevents self-kudos', async () => {
      const mockUser = createMockUser('user123');
      const selfKudosMessage = createMockMessage('user123');
      const selfKudosReaction = createMockReaction(selfKudosMessage);

      await mockDiscordClient.emit(
        'messageReactionAdd',
        selfKudosReaction,
        mockUser
      );
      expect((selfKudosMessage.channel as any).send).toHaveBeenCalledWith({
        content: expect.stringContaining("You can't give kudos to yourself!"),
      });

      const reactions = await db.select().from(kudosReactions);
      expect(reactions).toHaveLength(0);
    });

    // test('enforces daily reaction limit', async () => {
    //   const mockUser = createMockUser('user123');
    //   const mockMessage = createMockMessage('author123');
    //   const mockReaction = createMockReaction(mockMessage);

    //   for (let i = 0; i < 25; i++) {
    //     await db.insert(kudosReactions).values({
    //       messageId: `msg${i}`,
    //       messageChannelId: 'channel123',
    //       messageAuthorId: `author${i}`,
    //       reactorId: 'user123',
    //       createdAt: new Date(),
    //     });
    //   }

    //   const result = await handleKudosReaction(mockReaction, mockUser);

    //   expect(result).toEqual({
    //     type: 'error',
    //     message: `You've reached your daily limit of ${KUDOS_CONFIG.DAILY_REACTION_LIMIT} kudos reactions.`,
    //     ephemeral: true,
    //   });

    //   const reactions = await db.select().from(kudosReactions);
    //   expect(reactions).toHaveLength(25);
    // });

    test('handles level up', async () => {
      const mockUser = createMockUser('user123');
      const mockMessage = createMockMessage('author123');
      const mockReaction = createMockReaction(mockMessage);

      // Add enough reactions to be close to level up (level 1 -> 2)
      // Need 50 points: 5 unique messages (40 points) + 1 new reaction (10 points) = 50 points
      for (let i = 0; i < 4; i++) {
        await db.insert(kudosReactions).values({
          messageId: `msg${i}`,
          messageChannelId: 'channel123',
          messageAuthorId: 'author123',
          reactorId: `reactor${i}`,
          guildId: 'guild123',
          createdAt: subDays(new Date(), 1),
        });
      }

      await mockDiscordClient.emit(
        'messageReactionAdd',
        mockReaction,
        mockUser
      );

      expect((mockMessage.channel as any).send).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              title: expect.stringMatching(/level up!/i),
              description: expect.stringMatching(/reached.*level 2/i),
            }),
          }),
        ],
      });

      const reactions = await db.select().from(kudosReactions);
      expect(reactions).toHaveLength(5);
    });
  });

  describe('handleKudosReactionRemove', () => {
    test('removes kudos reaction', async () => {
      const mockUser = createMockUser('user123');
      const mockMessage = createMockMessage('author123');
      const mockReaction = createMockReaction(mockMessage);

      await db.insert(kudosReactions).values({
        messageId: 'msg123',
        messageChannelId: 'channel123',
        messageAuthorId: 'author123',
        reactorId: 'user123',
        guildId: 'guild123',
        createdAt: new Date(),
      });

      await mockDiscordClient.emit(
        'messageReactionRemove',
        mockReaction,
        mockUser
      );

      const reactions = await db.select().from(kudosReactions);
      expect(reactions).toHaveLength(0);
    });
  });

  describe('handleRankCommand', () => {
    beforeEach(async () => {
      await db.delete(kudosReactions);

      for (let i = 0; i < 15; i++) {
        await db.insert(kudosReactions).values({
          messageId: `msg${i}`,
          messageChannelId: 'channel123',
          messageAuthorId: 'user123',
          reactorId: `reactor${i}`,
          guildId: 'guild123',
          createdAt: new Date(),
        });
      }
    });

    test('displays user rank', async () => {
      const interaction = createMockInteraction({
        subcommand: 'rank',
      });
      await mockDiscordClient.emit('interactionCreate', interaction);
      const calls = (interaction.reply as any).mock.calls;
      expect(calls[0][0].embeds[0].data.title).toEqual('Kudos stats');
      expect(calls[0][0].embeds[0].data.fields).toHaveLength(6); // 5 stats + next level
    });

    test('displays target user rank', async () => {
      const interaction = createMockInteraction({
        subcommand: 'rank',
      });
      await mockDiscordClient.emit('interactionCreate', interaction);
      expect(interaction.reply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({ title: 'Kudos stats' }),
          }),
        ],
      });
    });
  });

  describe('handleLeaderboardCommand', () => {
    beforeEach(async () => {
      await db.delete(kudosReactions);

      // User 1: 3 unique messages (30 points) + 2 additional reactions (6 points) = 36 points
      // First add 3 unique messages
      for (let i = 0; i < 3; i++) {
        await db.insert(kudosReactions).values({
          messageId: `msg${i}`,
          messageChannelId: 'channel123',
          messageAuthorId: 'user1',
          reactorId: 'user2',
          guildId: 'guild123',
          createdAt: new Date(),
        });
      }
      // Then add 2 additional reactions to msg0 from different reactors
      for (let i = 0; i < 2; i++) {
        await db.insert(kudosReactions).values({
          messageId: 'msg0',
          messageChannelId: 'channel123',
          messageAuthorId: 'user1',
          reactorId: `user${i + 3}`, // user3 and user4 react
          guildId: 'guild123',
          createdAt: new Date(),
        });
      }

      // User 2: 2 unique messages (20 points) + 1 additional reaction (3 points) + 3 points for giving reactions = 26 points
      // First add 2 unique messages
      for (let i = 0; i < 2; i++) {
        await db.insert(kudosReactions).values({
          messageId: `msg${i + 10}`,
          messageChannelId: 'channel123',
          messageAuthorId: 'user2',
          reactorId: 'user3',
          guildId: 'guild123',
          createdAt: new Date(),
        });
      }
      // Then add 1 additional reaction to msg10 from a different reactor
      await db.insert(kudosReactions).values({
        messageId: 'msg10',
        messageChannelId: 'channel123',
        messageAuthorId: 'user2',
        reactorId: 'user4',
        guildId: 'guild123',
        createdAt: new Date(),
      });

      // Points from giving reactions:
      // - user2: 3 points (3 reactions to user1)
      // - user3: 2 points (2 reactions to user2)
      // - user4: 1 point (1 reaction to user2)
    });

    test('displays leaderboard', async () => {
      const interaction = createMockInteraction({
        subcommand: 'leaderboard',
      });
      await mockDiscordClient.emit('interactionCreate', interaction);
      const calls = (interaction.reply as any).mock.calls;
      const { title, description } = calls[0][0].embeds[0].data;

      expect(title).toEqual('LGT Kudos Leaderboard');
      expect(description).toContain('1. <@user1>'); // 36 points
      expect(description).toContain('2. <@user2>'); // 26 points
      expect(description).toContain('3. <@user3>'); // 2 points
      expect(description).toContain('4. <@user4>'); // 1 point
    });
  });

  describe('handleTopCommand', () => {
    beforeEach(async () => {
      await db.delete(kudosReactions);

      // Add reactions to create top messages
      // Message 1: 10 reactions, 8 from yesterday, 2 from today
      for (let i = 0; i < 10; i++) {
        await db.insert(kudosReactions).values({
          messageId: 'msg1',
          messageChannelId: 'channel1',
          messageAuthorId: 'user1',
          reactorId: `reactor${i}`,
          guildId: 'guild123',
          createdAt: i < 8 ? subDays(new Date(), 1) : new Date(),
        });
      }

      // Message 2: 8 reactions, 3 from yesterday, 5 from today
      for (let i = 0; i < 8; i++) {
        await db.insert(kudosReactions).values({
          messageId: 'msg2',
          messageChannelId: 'channel1',
          messageAuthorId: 'user2',
          reactorId: `reactor${i + 10}`,
          guildId: 'guild123',
          createdAt: i < 3 ? subDays(new Date(), 1) : new Date(),
        });
      }
    });

    test('displays top messages', async () => {
      const interaction = createMockInteraction({
        subcommand: 'top',
        options: {
          timeframe: '1 day',
        },
      });
      await mockDiscordClient.emit('interactionCreate', interaction);
      const calls = (interaction.reply as any).mock.calls;
      expect(calls[0][0].embeds[0].data.title).toEqual(
        'Top Helpful Messages (1 day)'
      );

      expect(calls[0][0].embeds[0].data.description).toContain(
        '1. <@user2> - 5 reactions'
      );
      expect(calls[0][0].embeds[0].data.description).toContain(
        '2. <@user1> - 2 reactions'
      );
    });

    test('uses default timeframe', async () => {
      const interaction = createMockInteraction({
        subcommand: 'top',
      });
      await mockDiscordClient.emit('interactionCreate', interaction);
      const calls = (interaction.reply as any).mock.calls;

      expect(calls[0][0].embeds[0].data.title).toBe(
        'Top Helpful Messages (7 days)'
      );
      expect(calls[0][0].embeds[0].data.description).toContain(
        '1. <@user1> - 10 reactions'
      );
      expect(calls[0][0].embeds[0].data.description).toContain(
        '2. <@user2> - 8 reactions'
      );
    });
  });
});
