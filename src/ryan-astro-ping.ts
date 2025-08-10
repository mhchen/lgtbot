import { Client } from 'discord.js';
import { logger } from './logger';

const RYAN_USER_ID = '219283881390637056';

export async function registerRyanAstroShillListeners(client: Client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || message.author.id === RYAN_USER_ID) {
      return;
    }

    if (/\bastro\b/i.test(message.content)) {
      await message.reply({
        content: `<@${RYAN_USER_ID}>, your services as Astro Shill are required.`,
      });
    }
  });

  logger.info('Astro Shill replies listeners registered');
}
