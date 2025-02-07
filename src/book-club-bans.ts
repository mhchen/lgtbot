import {
  AttachmentBuilder,
  Client,
  SlashCommandBuilder,
  TextChannel,
  type Interaction,
} from 'discord.js';
import { db } from './db';
import { readFileSync } from 'fs';
import path from 'path';

const BOOK_CLUB_CHANNEL_ID = '1320549426007375994';
const MIKE_USER_ID = '356482549549236225';
const RYAN_USER_ID = '219283881390637056';
const BANHAMMER_EMOJI = 'banhammer';
const BANNED_FROM_BOOK_CLUB_ROLE_ID = '1330690625183551668';

const MIKE_TITLES = [
  'Supreme Ruler',
  'Grand Overlord',
  'Executive Bookmaster',
  'Literary Sovereign',
  'Chief Reading Officer',
  'Book Emperor',
  'Distinguished Leader',
];

const RYAN_TITLES = [
  'Ryan, Assistant to Supreme Ruler',
  'Ryan, Assistant to Grand Overlord',
  'Ryan, Assistant to Executive Bookmaster',
  'Ryan, Assistant to Literary Sovereign',
  'Ryan, Assistant to Chief Reading Officer',
  'Ryan, Assistant to Book Emperor',
  'Ryan, Assistant to Distinguished Leader',
];

function getRandomMikeTitle(): string {
  return MIKE_TITLES[Math.floor(Math.random() * MIKE_TITLES.length)];
}

function getRandomRyanTitle(): string {
  return RYAN_TITLES[Math.floor(Math.random() * RYAN_TITLES.length)];
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
      .query(
        `
        SELECT 
          discord_user_id,
          discord_message_ids
        FROM book_club_bans
        ORDER BY length(discord_message_ids) - length(replace(discord_message_ids, ',', '')) + 1 DESC
      `
      )
      .all() as { discord_user_id: string; discord_message_ids: string }[];

    if (bans.length === 0) {
      await interaction.reply('No one has been banned from book club yet! 📚');
      return;
    }

    const leaderboard = bans.map((ban, index) => {
      const banCount = ban.discord_message_ids.split(',').length;
      return `${index + 1}. <@${ban.discord_user_id}> — ${banCount} ban${
        banCount !== 1 ? 's' : ''
      }`;
    });

    const message = `# Book club ban leaderboard\n${leaderboard.join('\n')}`;
    await interaction.reply(message);
  }
}

export async function registerBookClubBansListeners(client: Client) {
  client.on('messageReactionAdd', async (reaction, user) => {
    if (
      reaction.message.channel.id === BOOK_CLUB_CHANNEL_ID &&
      (user.id === MIKE_USER_ID || user.id === RYAN_USER_ID) &&
      reaction.emoji.name === BANHAMMER_EMOJI
    ) {
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
        .query(
          'SELECT discord_message_ids FROM book_club_bans WHERE discord_user_id = $messageSenderId'
        )
        .get({
          messageSenderId: messageSenderId,
        }) as { discord_message_ids: string } | undefined;

      const bookClubChannel = (await client.channels.fetch(
        BOOK_CLUB_CHANNEL_ID
      )) as TextChannel;

      const { guild } = bookClubChannel;
      const member = await guild.members.fetch(messageSenderId);
      await member.roles.add(BANNED_FROM_BOOK_CLUB_ROLE_ID);

      if (existingBan) {
        const newMessageIds = [
          ...existingBan.discord_message_ids.split(','),
          messageId,
        ];
        db.query(
          'UPDATE book_club_bans SET discord_message_ids = $messageIds WHERE discord_user_id = $messageSenderId'
        ).run({
          messageIds: newMessageIds.join(','),
          messageSenderId: messageSenderId,
        });

        const banCount = newMessageIds.length;
        await bookClubChannel.send({
          content: `<@${messageSenderId}> has received their ${banCount}${getSuffix(
            banCount
          )} ban from LGT Book Club, by order of ${
            user.id === MIKE_USER_ID
              ? getRandomMikeTitle()
              : getRandomRyanTitle()
          } ${
            user.id === MIKE_USER_ID ? ', Mike' : ', Mike'
          }. Their crimes against literature continue to stack.`,
          files:
            banCount === 10
              ? [new AttachmentBuilder(path.join(__dirname, '10-bans.png'))]
              : undefined,
        });
      } else {
        db.query(
          'INSERT INTO book_club_bans (discord_user_id, discord_message_ids) VALUES ($messageSenderId, $messageIds)'
        ).run({
          messageSenderId: messageSenderId,
          messageIds: messageId,
        });

        await bookClubChannel.send(
          `<@${messageSenderId}> has been banned from LGT Book Club, by order of ${
            user.id === MIKE_USER_ID
              ? getRandomMikeTitle()
              : getRandomRyanTitle()
          } ${user.id === MIKE_USER_ID ? ', Mike' : ', Mike'}`
        );
      }

      console.log(
        `User ${messageSenderId} has been banned for message ${messageId}.`
      );
    }
  });
  client.on('messageReactionRemove', async (reaction, user) => {
    if (
      reaction.message.channel.id === BOOK_CLUB_CHANNEL_ID &&
      user.id === MIKE_USER_ID &&
      reaction.emoji.name === BANHAMMER_EMOJI
    ) {
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
        .query(
          'SELECT discord_message_ids FROM book_club_bans WHERE discord_user_id = $messageSenderId'
        )
        .get({
          messageSenderId: messageSenderId,
        }) as { discord_message_ids: string } | undefined;

      if (!existingBan) {
        return;
      }

      const messageIds = existingBan.discord_message_ids.split(',');
      if (!messageIds.includes(messageId)) {
        return;
      }

      const bookClubChannel = (await client.channels.fetch(
        BOOK_CLUB_CHANNEL_ID
      )) as TextChannel;

      const newMessageIds = messageIds.filter((id) => id !== messageId);

      if (newMessageIds.length === 0) {
        const { guild } = bookClubChannel;
        const member = await guild.members.fetch(messageSenderId);
        await member.roles.remove(BANNED_FROM_BOOK_CLUB_ROLE_ID);

        db.query(
          'DELETE FROM book_club_bans WHERE discord_user_id = $messageSenderId'
        ).run({
          messageSenderId: messageSenderId,
        });

        await bookClubChannel.send(
          `<@${messageSenderId}> has been brought back into ${
            user.id === MIKE_USER_ID
              ? getRandomMikeTitle()
              : getRandomRyanTitle()
          } ${user.id === MIKE_USER_ID ? ', Mike' : ', Mike'}'s good graces.`
        );
      } else {
        db.query(
          'UPDATE book_club_bans SET discord_message_ids = $messageIds WHERE discord_user_id = $messageSenderId'
        ).run({
          messageIds: newMessageIds.join(','),
          messageSenderId: messageSenderId,
        });

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
