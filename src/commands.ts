import {
  ApplicationIntegrationType,
  InteractionContextType,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { logger } from './logger';
import { getKudosCommands } from './kudos';
import { getBookClubPicksCommands } from './book-club-picks';
import { getTwitchCommands } from './twitch';
import { getGoalsCommands } from './goals';
import { getExpiringMessageCommand } from './expiring-messages';

export const lgtCommand = new SlashCommandBuilder()
  .setName('lgt')
  .setDescription('LGT Bot commands')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild);

const commands = [
  lgtCommand
    .addSubcommandGroup(getKudosCommands())
    .addSubcommandGroup((group) => {
      group
        .setName('bookclub')
        .setDescription('Book club commands')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('bans')
            .setDescription('Display the book club ban leaderboard')
        );
      for (const subcommand of getBookClubPicksCommands()) {
        group.addSubcommand(subcommand);
      }
      return group;
    })
    .addSubcommandGroup(getTwitchCommands())
    .addSubcommandGroup(getGoalsCommands())
    .addSubcommandGroup((group) =>
      group
        .setName('message')
        .setDescription('Messages that disappear later')
        .addSubcommand(getExpiringMessageCommand())
    ),
];

export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commands,
    });
  } catch (error) {
    logger.error(error, 'Error registering commands');
  }
}
