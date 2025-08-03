import { Client, TextChannel } from 'discord.js';
import { logger } from './logger';

const WATERCOOLER_CHANNEL_ID = '964903664265359433';
const RYAN_USER_ID = '219283881390637056';

export async function registerRyanAstroShillListeners(client: Client) {
  client.on('messagesCreate', async (message) => {
    if (message.author.bot || message.author.id === RYAN_USER_ID) {
      return;
    }

    if (message.content.toLowerCase().includes('astro')) {
      const targetChannel = client.channels.cache.get(
        WATERCOOLER_CHANNEL_ID
      ) as TextChannel;

      if (!targetChannel) {
        console.error('Target channel not found');
        return;
      }
      const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

      await targetChannel.send(
        `<@${RYAN_USER_ID}, your sevices as Astro Shill are required here: ${messageLink}.`
      );
    }
  });

  logger.info('Astro Shill replies listeners registered');
}
