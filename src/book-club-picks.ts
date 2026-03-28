import {
  SlashCommandSubcommandBuilder,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
  EmbedBuilder,
  Client,
  TextChannel,
  type Interaction,
} from 'discord.js';
import cron from 'node-cron';
import {
  createSubmission,
  findActiveByUrl,
  findDiscussedByUrl,
  trackVoteMessage,
  getActivePool,
  getUserVoteForWeek,
  getSubmissionById,
  upsertVote,
  getVoteCountsForWeek,
  getRecentlyDiscussed,
  markAsDiscussed,
  getVoteMessagesForSubmission,
} from './db/book-club-picks';
import { getCurrentWeek } from './utils/week';
import { logger } from './logger';

export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.search = '';
  url.hash = '';

  // Lowercase hostname only, preserve path case
  const normalized = `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`;

  // Strip trailing slash (but keep root "/")
  if (normalized.endsWith('/') && url.pathname !== '/') {
    return normalized.slice(0, -1);
  }

  return normalized;
}

export function selectWinner(
  pool: ReturnType<typeof getActivePool>,
  voteCounts: { submissionId: number; voteCount: number }[]
): { winner: (typeof pool)[number]; tiebreak: boolean; noVotes: boolean } {
  if (voteCounts.length === 0) {
    return {
      winner: pool[Math.floor(Math.random() * pool.length)],
      tiebreak: false,
      noVotes: true,
    };
  }

  const voteMap = new Map(voteCounts.map((v) => [v.submissionId, v.voteCount]));
  const maxVotes = Math.max(...voteCounts.map((v) => v.voteCount));
  const tied = pool.filter((sub) => (voteMap.get(sub.id) ?? 0) === maxVotes);

  if (tied.length > 1) {
    return {
      winner: tied[Math.floor(Math.random() * tied.length)],
      tiebreak: true,
      noVotes: false,
    };
  }

  return { winner: tied[0], tiebreak: false, noVotes: false };
}

/* eslint-disable no-undef */
export async function fetchTitle(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const html = await response.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
/* eslint-enable no-undef */

function fallbackTitle(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}${parsed.pathname}`;
}

async function handleSubmitCommand(interaction: ChatInputCommandInteraction) {
  const rawUrl = interaction.options.getString('url', true);
  const userTitle = interaction.options.getString('title');

  try {
    new URL(rawUrl);
  } catch {
    await interaction.reply({
      content: "That doesn't look like a valid URL.",
      ephemeral: true,
    });
    return;
  }

  const cleanUrl = normalizeUrl(rawUrl);

  const activeMatch = findActiveByUrl(cleanUrl);
  if (activeMatch) {
    await interaction.reply({
      content: `This article is already in the pool, submitted by <@${activeMatch.submittedBy}>.`,
      ephemeral: true,
    });
    return;
  }

  const discussedMatch = findDiscussedByUrl(cleanUrl);
  if (discussedMatch) {
    const discussedDate = new Date(
      discussedMatch.discussedAt!
    ).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const confirmButton = new ButtonBuilder()
      .setCustomId(`bookclub-resubmit-confirm-${discussedMatch.id}`)
      .setLabel('Submit anyway')
      .setStyle(ButtonStyle.Primary);

    const cancelButton = new ButtonBuilder()
      .setCustomId('bookclub-resubmit-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    await interaction.reply({
      content: `This article was discussed on ${discussedDate}. Submit anyway?`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmButton,
          cancelButton
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();
  const title =
    userTitle || (await fetchTitle(rawUrl)) || fallbackTitle(rawUrl);

  const submission = createSubmission({
    url: cleanUrl,
    title,
    submittedBy: interaction.user.id,
  });

  const voteButton = new ButtonBuilder()
    .setCustomId(`bookclub-vote-btn-${submission.id}`)
    .setLabel('Vote for this')
    .setStyle(ButtonStyle.Primary);

  const message = await interaction.editReply({
    content: `<@${interaction.user.id}> submitted: **${title}** - ${cleanUrl}`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton),
    ],
  });

  trackVoteMessage({
    submissionId: submission.id,
    messageId: message.id,
    channelId: interaction.channelId,
  });
}

async function handleVoteCommand(interaction: ChatInputCommandInteraction) {
  const pool = getActivePool();
  if (pool.length === 0) {
    await interaction.reply({
      content:
        'The pool is empty. Use `/lgt bookclub submit` to add an article!',
      ephemeral: true,
    });
    return;
  }

  const weekIdentifier = getCurrentWeek();
  const existingVote = getUserVoteForWeek(interaction.user.id, weekIdentifier);

  // Sort so current vote appears first in the list
  const sorted = existingVote
    ? [...pool].sort((a, b) => {
        if (a.id === existingVote.submissionId) return -1;
        if (b.id === existingVote.submissionId) return 1;
        return 0;
      })
    : pool;

  const displayPool = sorted.slice(0, 25);
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`bookclub-vote-select-${interaction.user.id}`)
    .setPlaceholder('Pick an article to vote for')
    .addOptions(
      displayPool.map((sub) => ({
        label:
          sub.title.length > 100
            ? sub.title.substring(0, 97) + '...'
            : sub.title,
        description:
          sub.url.length > 100 ? sub.url.substring(0, 97) + '...' : sub.url,
        value: sub.id.toString(),
        default: existingVote?.submissionId === sub.id,
      }))
    );

  const currentVoteSub = existingVote
    ? getSubmissionById(existingVote.submissionId)
    : null;
  const currentVoteText = currentVoteSub
    ? `Your current vote: **${currentVoteSub.title}**\n`
    : '';
  const note =
    pool.length > 25
      ? `\nShowing 25 of ${pool.length} articles. Use \`/lgt bookclub pool\` to see all.`
      : '';

  await interaction.reply({
    content: `${currentVoteText}Vote for an article to discuss this week:${note}`,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    ],
    ephemeral: true,
  });
}

async function handleVoteSelectMenu(interaction: StringSelectMenuInteraction) {
  const submissionId = parseInt(interaction.values[0]);
  const weekIdentifier = getCurrentWeek();
  const existingVote = getUserVoteForWeek(interaction.user.id, weekIdentifier);
  const submission = getSubmissionById(submissionId);

  if (!submission) {
    await interaction.reply({
      content: 'That article no longer exists.',
      ephemeral: true,
    });
    return;
  }

  upsertVote({ submissionId, userId: interaction.user.id, weekIdentifier });

  if (existingVote && existingVote.submissionId !== submissionId) {
    const oldSubmission = getSubmissionById(existingVote.submissionId);
    await interaction.reply({
      content: `Vote changed!\nPrevious: **${oldSubmission?.title ?? 'unknown'}**\nCurrent: **${submission.title}**`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `Vote registered for **${submission.title}**!`,
      ephemeral: true,
    });
  }
}

async function handleVoteButton(interaction: ButtonInteraction) {
  const submissionId = parseInt(
    interaction.customId.replace('bookclub-vote-btn-', '')
  );
  const weekIdentifier = getCurrentWeek();
  const submission = getSubmissionById(submissionId);

  if (!submission) {
    await interaction.reply({
      content: 'That article no longer exists.',
      ephemeral: true,
    });
    return;
  }

  const existingVote = getUserVoteForWeek(interaction.user.id, weekIdentifier);
  upsertVote({ submissionId, userId: interaction.user.id, weekIdentifier });

  if (existingVote && existingVote.submissionId !== submissionId) {
    const oldSubmission = getSubmissionById(existingVote.submissionId);
    await interaction.reply({
      content: `Vote changed!\nPrevious: **${oldSubmission?.title ?? 'unknown'}**\nCurrent: **${submission.title}**`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `Vote registered for **${submission.title}**!`,
      ephemeral: true,
    });
  }
}

async function handleResubmitConfirm(interaction: ButtonInteraction) {
  const oldSubmissionId = parseInt(
    interaction.customId.replace('bookclub-resubmit-confirm-', '')
  );
  const oldSubmission = getSubmissionById(oldSubmissionId);

  if (!oldSubmission) {
    await interaction.reply({
      content:
        'Could not find the original article. Please try submitting again.',
      ephemeral: true,
    });
    return;
  }

  const activeMatch = findActiveByUrl(oldSubmission.url);
  if (activeMatch) {
    await interaction.reply({
      content: `This article was already resubmitted by <@${activeMatch.submittedBy}>.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const submission = createSubmission({
    url: oldSubmission.url,
    title: oldSubmission.title,
    submittedBy: interaction.user.id,
  });

  const voteButton = new ButtonBuilder()
    .setCustomId(`bookclub-vote-btn-${submission.id}`)
    .setLabel('Vote for this')
    .setStyle(ButtonStyle.Primary);

  const channel = interaction.channel;
  if (!channel || !('send' in channel)) {
    logger.warn('No channel available for resubmit confirmation');
    return;
  }

  const message = await channel.send({
    content: `<@${interaction.user.id}> submitted: **${oldSubmission.title}** - ${oldSubmission.url}`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton),
    ],
  });

  trackVoteMessage({
    submissionId: submission.id,
    messageId: message.id,
    channelId: channel.id,
  });
}

async function handleResubmitCancel(interaction: ButtonInteraction) {
  await interaction.update({
    content: 'Submission cancelled.',
    components: [],
  });
}

export async function handleBookClubPicksInteraction(
  interaction: Exclude<Interaction, ChatInputCommandInteraction>
): Promise<boolean> {
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith('bookclub-vote-select-')
  ) {
    await handleVoteSelectMenu(interaction);
    return true;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('bookclub-vote-btn-')) {
      await handleVoteButton(interaction);
      return true;
    }
    if (interaction.customId.startsWith('bookclub-resubmit-confirm-')) {
      await handleResubmitConfirm(interaction);
      return true;
    }
    if (interaction.customId === 'bookclub-resubmit-cancel') {
      await handleResubmitCancel(interaction);
      return true;
    }
  }

  return false;
}

async function handlePoolCommand(interaction: ChatInputCommandInteraction) {
  const pool = getActivePool();
  if (pool.length === 0) {
    await interaction.reply(
      'The pool is empty. Use `/lgt bookclub submit` to add an article!'
    );
    return;
  }

  const weekIdentifier = getCurrentWeek();
  const voteCounts = getVoteCountsForWeek(weekIdentifier);
  const voteMap = new Map(voteCounts.map((v) => [v.submissionId, v.voteCount]));

  const sorted = [...pool].sort(
    (a, b) => (voteMap.get(b.id) ?? 0) - (voteMap.get(a.id) ?? 0)
  );

  const displayPool = sorted.slice(0, 25);
  const embed = new EmbedBuilder()
    .setTitle('Book club article pool')
    .setColor(0x0099ff)
    .setTimestamp()
    .addFields(
      displayPool.map((sub) => ({
        name: `${sub.title} (${voteMap.get(sub.id) ?? 0} votes)`,
        value: `${sub.url}\nSubmitted by <@${sub.submittedBy}>`,
        inline: false,
      }))
    );

  if (sorted.length > 25) {
    embed.setFooter({ text: `Showing 25 of ${sorted.length} articles` });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleHistoryCommand(interaction: ChatInputCommandInteraction) {
  const history = getRecentlyDiscussed(10);
  if (history.length === 0) {
    await interaction.reply('No articles have been discussed yet!');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Recently discussed articles')
    .setColor(0x00ff00)
    .setTimestamp()
    .addFields(
      history.map((sub) => {
        const date = new Date(sub.discussedAt!).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        return {
          name: sub.title,
          value: `${sub.url}\nDiscussed: ${date}`,
          inline: false,
        };
      })
    );

  await interaction.reply({ embeds: [embed] });
}

export async function handleBookclubPicksCommand(
  interaction: ChatInputCommandInteraction
) {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case 'submit':
      await handleSubmitCommand(interaction);
      break;
    case 'vote':
      await handleVoteCommand(interaction);
      break;
    case 'pool':
      await handlePoolCommand(interaction);
      break;
    case 'history':
      await handleHistoryCommand(interaction);
      break;
  }
}

const BOOK_CLUB_CHANNEL_ID =
  process.env.LGT_BOOK_CLUB_CHANNEL_ID || '1320549426007375994';
const REMINDER_CRON = process.env.BOOKCLUB_REMINDER_CRON || '0 9 * * 1';
const CLOSE_CRON = process.env.BOOKCLUB_CLOSE_CRON || '0 9 * * 2';
const CRON_TIMEZONE = 'America/New_York';

export function registerBookClubPicksCron(client: Client) {
  // Monday reminder
  cron.schedule(
    REMINDER_CRON,
    async () => {
      try {
        const channel = (await client.channels.fetch(
          BOOK_CLUB_CHANNEL_ID
        )) as TextChannel;
        const pool = getActivePool();
        if (pool.length === 0) return;

        const weekIdentifier = getCurrentWeek();
        const voteCounts = getVoteCountsForWeek(weekIdentifier);
        const voteMap = new Map(
          voteCounts.map((v) => [v.submissionId, v.voteCount])
        );

        const sorted = [...pool].sort(
          (a, b) => (voteMap.get(b.id) ?? 0) - (voteMap.get(a.id) ?? 0)
        );

        const embed = new EmbedBuilder()
          .setTitle('Book club voting closes tomorrow morning!')
          .setColor(0xff9900)
          .addFields(
            sorted.map((sub) => ({
              name: `${sub.title} (${voteMap.get(sub.id) ?? 0} votes)`,
              value: sub.url,
              inline: false,
            }))
          )
          .setFooter({
            text: 'Use /lgt bookclub vote or click a vote button to cast yours!',
          });

        await channel.send({ embeds: [embed] });
        logger.info('Book club voting reminder sent');
      } catch (error) {
        logger.error(error, 'Failed to send book club voting reminder');
      }
    },
    { timezone: CRON_TIMEZONE }
  );

  // Tuesday close
  cron.schedule(
    CLOSE_CRON,
    async () => {
      try {
        const channel = (await client.channels.fetch(
          BOOK_CLUB_CHANNEL_ID
        )) as TextChannel;
        const pool = getActivePool();
        if (pool.length === 0) {
          await channel.send(
            'No articles were submitted for book club this week.'
          );
          return;
        }

        const weekIdentifier = getCurrentWeek();
        const voteCounts = getVoteCountsForWeek(weekIdentifier);
        const voteMap = new Map(
          voteCounts.map((v) => [v.submissionId, v.voteCount])
        );

        const { winner, tiebreak, noVotes } = selectWinner(pool, voteCounts);

        if (noVotes) {
          await channel.send(
            'Nobody voted this week, so the bot chose randomly.'
          );
        }

        // Fetch winner's vote messages BEFORE marking as discussed
        const voteMessages = getVoteMessagesForSubmission(winner.id);
        markAsDiscussed(winner.id);

        const embed = new EmbedBuilder()
          .setTitle("This week's book club article")
          .setColor(0x00ff00)
          .addFields(
            { name: 'Title', value: winner.title, inline: false },
            { name: 'URL', value: winner.url, inline: false },
            {
              name: 'Submitted by',
              value: `<@${winner.submittedBy}>`,
              inline: true,
            },
            {
              name: 'Votes',
              value: `${voteMap.get(winner.id) ?? 0}`,
              inline: true,
            }
          );

        if (tiebreak) {
          embed.setFooter({ text: 'Won by tiebreaker (random selection)' });
        }

        await channel.send({ embeds: [embed] });

        // Disable vote buttons on the winning submission's messages only
        for (const vm of voteMessages) {
          try {
            const msgChannel = (await client.channels.fetch(
              vm.channelId
            )) as TextChannel;
            const msg = await msgChannel.messages.fetch(vm.messageId);
            const disabledRows = msg.components.map((row) => {
              const newRow = new ActionRowBuilder<ButtonBuilder>();
              row.components.forEach((c) => {
                newRow.addComponents(
                  new ButtonBuilder(
                    c.data as ConstructorParameters<typeof ButtonBuilder>[0]
                  ).setDisabled(true)
                );
              });
              return newRow;
            });
            await msg.edit({ components: disabledRows });
          } catch (error) {
            logger.warn(
              error,
              `Failed to disable vote button on message ${vm.messageId}`
            );
          }
        }

        logger.info(
          `Book club voting closed. Winner: ${winner.title} (ID: ${winner.id})`
        );
      } catch (error) {
        logger.error(error, 'Failed to close book club voting');
      }
    },
    { timezone: CRON_TIMEZONE }
  );

  logger.info('Book club picks cron jobs registered');
}

export function getBookClubPicksCommands(): SlashCommandSubcommandBuilder[] {
  return [
    new SlashCommandSubcommandBuilder()
      .setName('submit')
      .setDescription('Submit a blog post for book club')
      .addStringOption((option) =>
        option
          .setName('url')
          .setDescription('URL of the blog post')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('title')
          .setDescription('Title of the article (auto-detected if omitted)')
          .setRequired(false)
      ),
    new SlashCommandSubcommandBuilder()
      .setName('vote')
      .setDescription('Vote for which article to discuss this week'),
    new SlashCommandSubcommandBuilder()
      .setName('pool')
      .setDescription('View all articles in the current pool'),
    new SlashCommandSubcommandBuilder()
      .setName('history')
      .setDescription('View recently discussed articles'),
  ];
}
