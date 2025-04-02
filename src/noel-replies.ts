import { Client, TextChannel } from 'discord.js';

const WATERCOOLER_CHANNEL_ID = '964903664265359433';
const NOEL_USER_ID = '204799401699442689';

function getEasternTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZoneName: 'short',
  });
}

export async function registerNoelRepliesListeners(client: Client) {
  client.on('messageCreate', async (message) => {
    if (
      message.channelId === WATERCOOLER_CHANNEL_ID &&
      message.author.id === NOEL_USER_ID
    ) {
      if (Math.random() >= 0.004) {
        return;
      }

      const watercoolerChannel = (await client.channels.fetch(
        WATERCOOLER_CHANNEL_ID
      )) as TextChannel;

      await watercoolerChannel.send(`<@${NOEL_USER_ID}> ${getEasternTime()}`);
    }
  });

  console.log('Noel replies listeners registered');
}
