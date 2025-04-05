import {
  AttachmentBuilder,
  Client,
  Events,
  SlashCommandBuilder,
  TextChannel,
  type Interaction,
} from 'discord.js';
import { db } from './db/index';
import path from 'path';
import { bookClubBans } from './db/schema';
import { eq, sql } from 'drizzle-orm';

const BOOK_CLUB_CHANNEL_ID =
  process.env.LGT_BOOK_CLUB_CHANNEL_ID || '1320549426007375994';
const MIKE_USER_ID = '356482549549236225';
const BANHAMMER_EMOJI = 'banhammer';

const achievementsMap = new Map<number, { title: string; subtitle: string }>([
  [
    10,
    {
      title: 'The Grasshopper',
      subtitle:
        'Still mastering the ancient art of getting ejected from LGT Book Club',
    },
  ],
  [
    20,
    {
      title: 'The Enthusiast',
      subtitle: 'Collects bans like others collect server emotes',
    },
  ],
  [
    30,
    {
      title: 'The Connoisseur',
      subtitle: 'Has sampled every possible reason for being banned',
    },
  ],
  [
    40,
    {
      title: 'The Inevitable',
      subtitle: 'Like death and taxes, their bans are a certainty',
    },
  ],
  [
    50,
    {
      title: 'The Legend',
      subtitle: 'Their ban history is now required reading for new members',
    },
  ],
  [
    69,
    {
      title: 'Nice',
      subtitle: 'Nice',
    },
  ],
  [
    100,
    {
      title: 'The Immortal',
      subtitle:
        'Somehow still part of the server despite breaking every rule in existence',
    },
  ],
]);

const MIKE_TITLES = [
  'Supreme Ruler',
  'Grand Overlord',
  'Executive Bookmaster',
  'Literary Sovereign',
  'Chief Reading Officer',
  'Book Emperor',
  'Distinguished Leader',
];

function getRandomMikeTitle(): string {
  return MIKE_TITLES[Math.floor(Math.random() * MIKE_TITLES.length)];
}

const bookclubCommand = new SlashCommandBuilder()
  .setName('bookclub')
  .setDescription('Book club management commands')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('bans')
      .setDescription('Display the book club ban leaderboard')
  );

export async function handleBookclubCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'bookclub') return;

  if (interaction.options.getSubcommand() === 'bans') {
    const bans = db
      .select()
      .from(bookClubBans)
      .orderBy(
        sql`length(${bookClubBans.discordMessageIds}) - length(replace(${bookClubBans.discordMessageIds}, ',', '')) + 1 DESC`
      )
      .all();

    if (bans.length === 0) {
      await interaction.reply('No one has been banned from book club yet! 📚');
      return;
    }

    if (interaction.guild === null) {
      await interaction.reply('Guild is null :s!');
      return;
    }

    await interaction.guild.members.fetch();

    const guildMembers = interaction.guild.members.cache;
    const membersMap = new Map<string, string>();

    guildMembers.forEach((member) =>
      membersMap.set(member.id, member.user.displayName)
    );

    const leaderboard = bans
      .filter((ban) => membersMap.has(ban.discordUserId))
      .map((ban, index) => {
        const banCount = ban.discordMessageIds.split(',').length;
        const userDisplayName = membersMap.get(ban.discordUserId);

        return `${index + 1}. ${userDisplayName} — ${banCount} ban${
          banCount !== 1 ? 's' : ''
        }`;
      });

    const message = `# Book club ban leaderboard\n${leaderboard.join('\n')}`;
    await interaction.reply(message);
  }
}

export async function registerBookClubBansListeners(client: Client) {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.id === MIKE_USER_ID && reaction.emoji.name === BANHAMMER_EMOJI) {
      let { message } = reaction;
      if (message.partial) {
        message = await message.fetch();
      }
      const messageSenderId = message.author?.id;
      if (!messageSenderId) {
        console.log('Message sender ID not found.');
        return;
      }

      const messageId = message.id;

      const existingBan = db
        .select()
        .from(bookClubBans)
        .where(eq(bookClubBans.discordUserId, messageSenderId))
        .get();

      const bookClubChannel = (await client.channels.fetch(
        BOOK_CLUB_CHANNEL_ID
      )) as TextChannel;

      const { guild } = bookClubChannel;
      const member = await guild.members.fetch(messageSenderId);

      if (existingBan) {
        const newMessageIds = [
          ...existingBan.discordMessageIds.split(','),
          messageId,
        ];
        db.update(bookClubBans)
          .set({
            discordMessageIds: newMessageIds.join(','),
          })
          .where(eq(bookClubBans.discordUserId, messageSenderId))
          .run();

        const banCount = newMessageIds.length;
        let messageContent = `<@${messageSenderId}> has received their ${banCount}${getSuffix(
          banCount
        )} ban from LGT Book Club, by order of ${getRandomMikeTitle()} Mike. Their crimes against literature continue to stack.`;

        const achievement = achievementsMap.get(banCount);
        if (achievement) {
          messageContent += `\n\n🏆 **Achievement unlocked:** "${achievement.title}"\n*${achievement.subtitle}*`;
        }

        await bookClubChannel.send({
          content: messageContent,
          files: achievement
            ? [
                new AttachmentBuilder(
                  path.join(__dirname, 'cheevos', `${banCount}-bans.png`)
                ),
              ]
            : undefined,
        });
      } else {
        db.insert(bookClubBans)
          .values({
            discordUserId: messageSenderId,
            discordMessageIds: messageId,
          })
          .run();

        await bookClubChannel.send(
          `<@${messageSenderId}> has been banned from LGT Book Club, by order of ${getRandomMikeTitle()} Mike`
        );
      }

      console.log(
        `User ${messageSenderId} has been banned for message ${messageId}.`
      );
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.id === MIKE_USER_ID && reaction.emoji.name === BANHAMMER_EMOJI) {
      let { message } = reaction;
      if (message.partial) {
        message = await message.fetch();
      }
      const messageSenderId = message.author?.id;
      if (!messageSenderId) {
        console.log('Message sender ID not found.');
        return;
      }
      const messageId = message.id;

      const existingBan = db
        .select()
        .from(bookClubBans)
        .where(eq(bookClubBans.discordUserId, messageSenderId))
        .get();

      if (!existingBan) {
        return;
      }

      const messageIds = existingBan.discordMessageIds.split(',');
      if (!messageIds.includes(messageId)) {
        return;
      }

      const bookClubChannel = (await client.channels.fetch(
        BOOK_CLUB_CHANNEL_ID
      )) as TextChannel;

      const newMessageIds = messageIds.filter((id: string) => id !== messageId);

      if (newMessageIds.length === 0) {
        db.delete(bookClubBans)
          .where(eq(bookClubBans.discordUserId, messageSenderId))
          .run();

        await bookClubChannel.send(
          `<@${messageSenderId}> has been brought back into ${getRandomMikeTitle()} Mike's good graces.`
        );
      } else {
        db.update(bookClubBans)
          .set({
            discordMessageIds: newMessageIds.join(','),
          })
          .where(eq(bookClubBans.discordUserId, messageSenderId))
          .run();

        const remainingBans = newMessageIds.length;
        await bookClubChannel.send(
          `<@${messageSenderId}> is making their way back to being a valued citizen of the Book Club. ${remainingBans} strike${
            remainingBans !== 1 ? 's' : ''
          } remaining.`
        );
      }

      console.log(
        `Ban removed for user ${messageSenderId}, message ${messageId}. Remaining bans: ${newMessageIds.length}`
      );
    }
  });

  client.on('interactionCreate', handleBookclubCommand);

  await client.application?.commands.create(bookclubCommand);

  console.log('Book club bans listeners registered');
}

function getSuffix(num: number): string {
  if (num >= 11 && num <= 13) {
    return 'th';
  }
  switch (num % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
