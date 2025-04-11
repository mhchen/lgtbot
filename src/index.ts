import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
} from 'discord.js';
import pc from 'picocolors';
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
import {
  handleListSubscriptions,
  handleSubscribe,
  handleUnsubscribe,
} from './twitch';

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
    const subcommand = interaction.options.getSubcommand();

    // Check permissions for twitch commands
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

      case 'twitch': {
        console.log(
          'Twitch command received:',
          pc.yellowBright(subcommand),
          'with username:',
          pc.cyanBright(interaction.options.getString('username')!)
        );

        switch (subcommand) {
          case 'subscribe': {
            const message = await handleSubscribe({
              username: interaction.options.getString('username')!,
            });
            await interaction.reply({ content: message });
            break;
          }
          case 'unsubscribe': {
            const message = await handleUnsubscribe({
              username: interaction.options.getString('username')!,
            });
            await interaction.reply({ content: message });
            break;
          }
          case 'list': {
            const message = await handleListSubscriptions();
            await interaction.reply({ content: message });
            break;
          }
        }
        break;
      }
    }
  })(interaction).catch(console.error)
);

client.login(process.env.DISCORD_TOKEN);
