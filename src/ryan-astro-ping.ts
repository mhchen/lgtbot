import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = '';
const USER_ID = '219283881390637056';
const WATERCOOLER_CHANNEL_ID = '964903664265359433';

client.on('messageCreate', async (message) => {
  if (message.author.bot || message.author.id === USER_ID) return;

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
      `<@${USER_ID}>, your services as Astro Shill are required [here](${messageLink}).`
    );
  }
});

client.login(TOKEN);
