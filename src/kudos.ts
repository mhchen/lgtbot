import {
  EmbedBuilder,
  MessageReaction,
  User,
  Client,
  Events,
  ChatInputCommandInteraction,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import {
  addKudosReaction,
  // getDailyReactionCount,
  getTopKudosUsers,
  getTopMessages,
  getUserKudosStats,
  removeKudosReaction,
} from './db/kudos';

const LGT_EMOJI_NAME = 'lgt';

export function getKudosCommands() {
  return (group: SlashCommandSubcommandGroupBuilder) =>
    group
      .setName('kudos')
      .setDescription('Kudos system commands')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('rank')
          .setDescription('Display your current rank, level, and points')
          .addUserOption((option) =>
            option
              .setName('user')
              .setDescription('User to check rank for (defaults to you)')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('leaderboard')
          .setDescription('Show top 10 helpful members')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('top')
          .setDescription('Show most helpful messages')
          .addStringOption((option) =>
            option
              .setName('timeframe')
              .setDescription('Time period (defaults to 7 days)')
              .setRequired(false)
              .addChoices(
                { name: 'Today', value: '1 day' },
                { name: 'This week', value: '7 days' },
                { name: 'This month', value: '30 days' }
              )
          )
      );
}

export async function handleCommand(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case 'rank': {
      const targetUser = interaction.options.getUser('user');
      const response = await handleRankCommand({
        userId: interaction.user.id,
        targetUserId: targetUser?.id,
      });
      await interaction.reply(response);
      break;
    }
    case 'leaderboard': {
      const response = await handleLeaderboardCommand();
      await interaction.reply(response);
      break;
    }
    case 'top': {
      const timeframe = interaction.options.getString('timeframe');
      const response = await handleTopCommand({
        timeframe: timeframe ?? undefined,
        guildId: interaction.guildId,
      });
      await interaction.reply(response);
      break;
    }
  }
}

export async function handleRankCommand({
  userId,
  targetUserId,
}: {
  userId: string;
  targetUserId?: string;
}) {
  const stats = await getUserKudosStats({ userId: targetUserId ?? userId });
  const embed = new EmbedBuilder()
    .setTitle(`Kudos stats`)
    .setColor(0x00ff00)
    .addFields(
      {
        name: 'User',
        value: `<@${stats.userId}>`,
        inline: true,
      },
      {
        name: 'Level',
        value: `${stats.level.level} (${stats.level.name})`,
        inline: true,
      },
      {
        name: 'Total Points',
        value: stats.totalPoints.toString(),
        inline: true,
      },
      {
        name: 'Reactions Received',
        value: stats.reactionsReceived.toString(),
        inline: true,
      },
      {
        name: 'Reactions Given',
        value: stats.reactionsGiven.toString(),
        inline: true,
      }
    );

  if (stats.pointsToNextLevel !== null) {
    embed.addFields({
      name: 'Next Level',
      value: `${stats.pointsToNextLevel} points needed for Level ${stats.level.level + 1}`,
    });
  }

  return { embeds: [embed] };
}

export async function handleLeaderboardCommand() {
  const topUsers = await getTopKudosUsers();
  const embed = new EmbedBuilder()
    .setTitle('LGT Kudos Leaderboard')
    .setColor(0x00ff00)
    .setDescription(
      topUsers
        .map(
          (user, index) =>
            `${index + 1}. <@${user.userId}> - Level ${user.level.level} (${
              user.level.name
            }) - ${user.totalPoints} points`
        )
        .join('\n')
    );

  return { embeds: [embed] };
}

export async function handleTopCommand({
  timeframe = '7 days',
  guildId,
}: {
  timeframe?: string;
  guildId: string | null;
}) {
  const topMessages = await getTopMessages({ timeframe });
  const embed = new EmbedBuilder()
    .setTitle(`Top Helpful Messages (${timeframe})`)
    .setColor(0x00ff00)
    .setDescription(
      topMessages
        .map((msg, index) => {
          const messageLink = `https://discord.com/channels/${guildId}/${msg.messageChannelId}/${msg.messageId}`;
          return `${index + 1}. <@${msg.messageAuthorId}> - ${
            msg.reactionCount
          } reactions - [Jump to message](${messageLink})`;
        })
        .join('\n')
    );

  return { embeds: [embed] };
}

interface KudosReactionError {
  type: 'error';
  message: string;
  ephemeral: boolean;
}

interface KudosLevelUp {
  type: 'levelup';
  embed: EmbedBuilder;
}

type KudosReactionResult = KudosReactionError | KudosLevelUp | null;

export async function handleKudosReaction(
  reaction: MessageReaction,
  user: User
): Promise<KudosReactionResult> {
  const messageId = reaction.message.id;
  const messageChannelId = reaction.message.channelId;
  const messageAuthorId = reaction.message.author?.id;
  const reactorId = user.id;
  const guildId = reaction.message.guildId;

  if (!messageAuthorId || reaction.message.author?.bot) {
    return null;
  }

  if (!guildId) {
    return {
      type: 'error',
      message: 'Cannot give kudos in DMs!',
      ephemeral: true,
    };
  }

  if (messageAuthorId === reactorId) {
    return {
      type: 'error',
      message: "You can't give kudos to yourself!",
      ephemeral: true,
    };
  }

  // Maybe enable this if the Discord grows
  // const dailyCount = await getDailyReactionCount({ reactorId });
  // if (dailyCount >= KUDOS_CONFIG.DAILY_REACTION_LIMIT) {
  //   return {
  //     type: 'error',
  //     message: `You've reached your daily limit of ${KUDOS_CONFIG.DAILY_REACTION_LIMIT} kudos reactions.`,
  //     ephemeral: true,
  //   };
  // }

  const oldStats = await getUserKudosStats({ userId: messageAuthorId });

  await addKudosReaction({
    messageId,
    messageChannelId,
    messageAuthorId,
    reactorId,
    guildId,
  });

  const newStats = await getUserKudosStats({ userId: messageAuthorId });
  if (newStats.level.level > oldStats.level.level) {
    const embed = new EmbedBuilder()
      .setTitle('🎉 Level Up!')
      .setColor(0x00ff00)
      .setDescription(
        `Congratulations <@${messageAuthorId}>! You've reached **Level ${newStats.level.level} (${newStats.level.name})**!`
      );

    return {
      type: 'levelup',
      embed,
    };
  }

  return null;
}

export async function handleKudosReactionRemove(
  reaction: MessageReaction,
  user: User
) {
  const messageId = reaction.message.id;
  const reactorId = user.id;

  await removeKudosReaction({
    messageId,
    reactorId,
  });

  return null;
}

export function registerKudosListeners(client: Client) {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name !== LGT_EMOJI_NAME) return;

    try {
      if (reaction.partial) {
        reaction = await reaction.fetch();
      }

      if (reaction.message.partial) {
        await reaction.message.fetch();
      }

      const result = await handleKudosReaction(reaction, user as User);
      if (!result) return;

      if (result.type === 'error') {
        const channel = reaction.message.channel;
        if (channel.isTextBased() && 'send' in channel) {
          await channel.send({
            content: `<@${user.id}> ${result.message}`,
          });
        }
        await reaction.users.remove(user.id);
        return;
      }

      if (result.type === 'levelup') {
        const channel = reaction.message.channel;
        if (channel.isTextBased() && 'send' in channel) {
          console.log(result.embed.data.title);
          await channel.send({
            embeds: [result.embed],
          });
        }
      }
    } catch (error) {
      console.error('Error handling kudos reaction:', error);
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name !== LGT_EMOJI_NAME) return;

    try {
      if (reaction.partial) {
        reaction = await reaction.fetch();
      }

      if (reaction.message.partial) {
        await reaction.message.fetch();
      }

      await handleKudosReactionRemove(reaction, user as User);
    } catch (error) {
      console.error('Error handling kudos reaction removal:', error);
    }
  });

  console.log('Kudos listeners registered');
}
