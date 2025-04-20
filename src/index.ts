import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
} from 'discord.js';
import { registerCommands } from './commands';
import { startWebhookServer } from './monitor';
import {
  registerBookClubBansListeners,
  handleBookclubCommand,
} from './book-club-bans';
import { registerNoelRepliesListeners } from './noel-replies';
import {
  registerKudosListeners,
  handleCommand as handleKudosCommand,
} from './kudos';
import { handleCommand as handleTwitchCommand } from './twitch';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', async () => {
  console.log('Bot is ready!');
  await registerCommands();
  registerBookClubBansListeners(client);
  registerNoelRepliesListeners(client);
  registerKudosListeners(client);
  startWebhookServer({
    client,
    channelId: process.env.NOTIFICATION_CHANNEL_ID!,
  });
});

client.on('interactionCreate', (interaction) =>
  (async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    if (commandName !== 'lgt') return;

    const group = interaction.options.getSubcommandGroup();

    if (
      group === 'twitch' &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
    ) {
      await interaction.reply({
        content: 'You need moderator permissions to use this command.',
        ephemeral: true,
      });
      return;
    }

    switch (group) {
      case 'kudos':
        await handleKudosCommand(interaction);
        break;

      case 'bookclub':
        await handleBookclubCommand(interaction);
        break;

      case 'twitch':
        await handleTwitchCommand(interaction);
        break;
    }
  })(interaction).catch(console.error)
);

client.login(process.env.DISCORD_TOKEN);
