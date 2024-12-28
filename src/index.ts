import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import pc from 'picocolors';
import {
  handleListSubscriptions,
  handleSubscribe,
  handleUnsubscribe,
  registerCommands,
  SubscriptionCommand,
} from './commands';
import { startWebhookServer } from './monitor';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID!;

client.once('ready', async () => {
  console.log('Bot is ready!');
  await registerCommands();
  startWebhookServer({ client, channelId: NOTIFICATION_CHANNEL_ID });
});

client.on('interactionCreate', (interaction) =>
  (async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
    ) {
      await interaction.reply({
        content: 'You need moderator permissions to use this command.',
        ephemeral: true,
      });
      return;
    }
    console.log(
      'Command received:',
      pc.yellowBright(commandName),
      'with username:',
      pc.cyanBright(interaction.options.getString('username')!)
    );

    switch (commandName) {
      case SubscriptionCommand.TwitchSubscribe: {
        const message = await handleSubscribe({
          username: interaction.options.getString('username')!,
        });
        await interaction.reply({
          content: message,
        });
        break;
      }
      case SubscriptionCommand.TwitchUnsubscribe: {
        const message = await handleUnsubscribe({
          username: interaction.options.getString('username')!,
        });
        await interaction.reply({
          content: message,
        });
        break;
      }
      case SubscriptionCommand.TwitchListSubscriptions: {
        const message = await handleListSubscriptions();
        await interaction.reply({
          content: message,
        });
        break;
      }
    }
  })(interaction).catch(console.error)
);

client.login(process.env.DISCORD_TOKEN);
