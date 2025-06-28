import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
} from 'discord.js';
import { logger } from './logger';
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
import { registerWeeklyWinsListeners } from './weekly-wins';
import { handleGoalsCommand, handleGoalInteraction } from './goals';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
  ],
});

client.once('ready', async () => {
  logger.info('Bot is ready!');
  await registerCommands();
  registerBookClubBansListeners(client);
  registerNoelRepliesListeners(client);
  registerKudosListeners(client);
  registerWeeklyWinsListeners(client);
  startWebhookServer({
    client,
    channelId: process.env.NOTIFICATION_CHANNEL_ID!,
  });
});

client.on('interactionCreate', (interaction) =>
  (async (interaction) => {
    if (interaction.isChatInputCommand()) {
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

        case 'goals':
          await handleGoalsCommand(interaction);
          break;
      }
    } else {
      await handleGoalInteraction(interaction);
    }
  })(interaction).catch((error) =>
    logger.error(error, 'Error handling interaction')
  )
);

client.login(process.env.DISCORD_TOKEN);
