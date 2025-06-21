import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { getKudosCommands } from './kudos';
import { getBookClubCommands } from './book-club-bans';
import { getTwitchCommands } from './twitch';
import { getGoalsCommands } from './goals';

const lgtCommand = new SlashCommandBuilder()
  .setName('lgt')
  .setDescription('LGT Bot commands');

const commands = [
  lgtCommand
    .addSubcommandGroup(getKudosCommands())
    .addSubcommandGroup(getBookClubCommands())
    .addSubcommandGroup(getTwitchCommands())
    .addSubcommandGroup(getGoalsCommands()),
];

export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commands,
    });
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}
