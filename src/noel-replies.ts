import { Client, TextChannel } from 'discord.js';
import { logger } from './logger';

const WATERCOOLER_CHANNEL_ID = '964903664265359433';
const INFERIOR_WATERCOOLER_CHANNEL_ID = '1384278987597025340';
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
      (message.channelId === WATERCOOLER_CHANNEL_ID ||
        message.channelId === INFERIOR_WATERCOOLER_CHANNEL_ID) &&
      message.author.id === NOEL_USER_ID
    ) {
      if (
        message.channelId === WATERCOOLER_CHANNEL_ID &&
        Math.random() >= 0.005
      ) {
        return;
      }

      const channel = (await client.channels.fetch(
        message.channelId
      )) as TextChannel;

      await channel.send(`<@${NOEL_USER_ID}> ${getEasternTime()}`);
    }
  });

  logger.info('Noel replies listeners registered');
}
