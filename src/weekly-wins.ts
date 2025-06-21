import { Client, Events, GuildMember, TextChannel } from 'discord.js';
import { WEEKLY_WINS_CHAT_CHANNEL_ID } from './constants';

const WEEKLY_WINS_ROLE_ID = '1364069953459720192';
const WEEKLY_WINS_POSTS_CHANNEL_ID = '1384556401761714236';

export async function registerWeeklyWinsListeners(client: Client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;

      const gainedWeeklyWinsRole =
        !oldRoles.has(WEEKLY_WINS_ROLE_ID) && newRoles.has(WEEKLY_WINS_ROLE_ID);

      if (gainedWeeklyWinsRole) {
        await sendWeeklyWinsWelcome(client, newMember);
      }
    } catch (error) {
      console.error('Error handling Weekly Wins role update:', error);
    }
  });

  console.log('Weekly Wins listeners registered');
}

async function sendWeeklyWinsWelcome(client: Client, member: GuildMember) {
  try {
    const chatChannel = (await client.channels.fetch(
      WEEKLY_WINS_CHAT_CHANNEL_ID
    )) as TextChannel;

    if (!chatChannel) {
      console.error('Weekly Wins chat channel not found');
      return;
    }

    const message = `Hi ${member.user}, welcome to the Weekly Wins Club!

Please post your updates in <#${WEEKLY_WINS_POSTS_CHANNEL_ID}>. Feel free to post your updates at any time, but it's recommended that you try to post between Friday-Monday every week.`;

    await chatChannel.send(message);

    console.log(
      `Weekly Wins welcome message sent for user ${member.user.username} (${member.id})`
    );
  } catch (error) {
    console.error('Error sending Weekly Wins welcome message:', error);
  }
}
