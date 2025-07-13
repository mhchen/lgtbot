import { describe, expect, test, beforeEach } from 'bun:test';
import { Client } from 'discord.js';
import type { Interaction, MessageReaction } from 'discord.js';
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
  type MockInteraction,
  createMockUser,
  createMockReaction as createLgtMockReaction,
  createMockMessage,
  createMockInteraction as createLgtMockInteraction,
} from './mockDiscordClient';

function createMockInteraction() {
  return createLgtMockInteraction({
    subcommandGroup: 'bookclub',
    subcommand: 'bans',
  });
}
function createMockReaction({ userId }: { userId: string }): MessageReaction {
  const message = createMockMessage(userId);
  return createLgtMockReaction({
    message,
    emoji: 'banhammer',
  });
}

describe('Book Club Bans', () => {
  let user: ReturnType<typeof createMockUser>;
  beforeEach(() => {
    resetMockDiscordClient();
    db.delete(bookClubBans).run();
    user = createMockUser('356482549549236225');

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
      userId: '123456789',
    });
    await mockDiscordClient.emit('messageReactionAdd', reaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe(reaction.message.id);

    expect(mockDiscordChannel.send).toHaveBeenCalledTimes(1);
    expect(mockDiscordChannel.send).toHaveBeenCalledWith(
      expect.stringMatching(/^<@123456789> has been banned/)
    );
  });

  test('increments ban count when Mike adds another banhammer reaction', async () => {
    const firstReaction = createMockReaction({
      userId: '123456789',
    });
    const secondReaction = createMockReaction({
      userId: '123456789',
    });

    await mockDiscordClient.emit('messageReactionAdd', firstReaction, user);
    await mockDiscordClient.emit('messageReactionAdd', secondReaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe(
      `${firstReaction.message.id},${secondReaction.message.id}`
    );

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
      userId: '123456789',
    });
    const secondReaction = createMockReaction({
      userId: '123456789',
    });

    await mockDiscordClient.emit('messageReactionAdd', reaction, user);
    await mockDiscordClient.emit('messageReactionAdd', secondReaction, user);
    await mockDiscordClient.emit('messageReactionRemove', reaction, user);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe(secondReaction.message.id);

    expect(mockDiscordChannel.send).toHaveBeenCalledTimes(3);
    expect(mockDiscordChannel.send).toHaveBeenLastCalledWith(
      expect.stringMatching(/<@123456789> .*\b1 strike remaining\./)
    );
  });

  test('unlocks achievement at 10 bans', async () => {
    for (let i = 0; i < 10; i++) {
      const newReaction = createMockReaction({
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

  test('bans a user when Ryan (assistant) adds banhammer reaction', async () => {
    const assistantUser = createMockUser('219283881390637056'); // Ryan's ID
    const reaction = createMockReaction({
      userId: '123456789',
    });
    await mockDiscordClient.emit('messageReactionAdd', reaction, assistantUser);

    const bans = db.select().from(bookClubBans).all();
    expect(bans).toHaveLength(1);
    expect(bans[0].discordUserId).toBe('123456789');
    expect(bans[0].discordMessageIds).toBe(reaction.message.id);

    expect(mockDiscordChannel.send).toHaveBeenCalledTimes(1);
    expect(mockDiscordChannel.send).toHaveBeenCalledWith(
      expect.stringMatching(
        /^<@123456789> has been banned.*Assistant to the.*Ryan/
      )
    );
  });

  test('assistant titles are properly formatted with "Assistant to the" prefix', async () => {
    const assistantUser = createMockUser('219283881390637056'); // Ryan's ID
    const reaction = createMockReaction({
      userId: '123456789',
    });
    await mockDiscordClient.emit('messageReactionAdd', reaction, assistantUser);

    expect(mockDiscordChannel.send).toHaveBeenCalledWith(
      expect.stringMatching(
        /Assistant to the (Supreme Ruler|Grand Overlord|Executive Bookmaster|Literary Sovereign|Chief Reading Officer|Book Emperor|Distinguished Leader) Ryan/
      )
    );
  });
});
