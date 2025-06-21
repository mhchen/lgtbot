import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandGroupBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  type Interaction,
} from 'discord.js';
import {
  createGoal,
  getUserGoals,
  getUserIncompleteGoals,
  incrementGoalProgress,
  getAllActiveGoals,
  getGoalById,
  softDeleteGoal,
} from './db/goals';
import { getCurrentWeek } from './utils/week';

export function getGoalsCommands() {
  return (group: SlashCommandSubcommandGroupBuilder) =>
    group
      .setName('goals')
      .setDescription('Weekly goal tracking commands')
      .addSubcommand((subcommand) =>
        subcommand.setName('set').setDescription('Create a new weekly goal')
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('checkin').setDescription('Mark progress on a goal')
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('me').setDescription('View your goals for this week')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('team')
          .setDescription('View all team goals for this week')
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('delete').setDescription('Remove a goal')
      );
}

export async function handleGoalsCommand(
  interaction: ChatInputCommandInteraction
) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'set':
      await handleSetGoal(interaction);
      break;
    case 'checkin':
      await handleCheckIn(interaction);
      break;
    case 'me':
      await handleListOwnGoals(interaction);
      break;
    case 'team':
      await handleTeamGoals(interaction);
      break;
    case 'delete':
      await handleDeleteGoal(interaction);
      break;
  }
}

async function handleSetGoal(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`goal-create-modal-${interaction.user.id}`)
    .setTitle('Create a Weekly Goal')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('goal-title')
          .setLabel('What do you want to achieve?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Exercise, Read 30 minutes, Code review')
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('goal-target')
          .setLabel('How many times this week? (1-10)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('5')
          .setRequired(true)
          .setMaxLength(2)
      )
    );

  await interaction.showModal(modal);
}

export async function handleGoalModalSubmit(
  interaction: ModalSubmitInteraction
) {
  const title = interaction.fields.getTextInputValue('goal-title').trim();
  const targetStr = interaction.fields.getTextInputValue('goal-target').trim();

  const target = parseInt(targetStr, 10);
  if (isNaN(target) || target < 1 || target > 10) {
    await interaction.reply({
      content: '❌ Please enter a number between 1 and 10 for times per week.',
      ephemeral: true,
    });
    return;
  }

  if (title.length < 3) {
    await interaction.reply({
      content: '❌ Goal description must be at least 3 characters.',
      ephemeral: true,
    });
    return;
  }

  try {
    const weekIdentifier = getCurrentWeek();
    await createGoal({
      userId: interaction.user.id,
      title,
      targetCount: target,
      weekIdentifier,
    });

    await interaction.reply({
      content: `<@${interaction.user.id}> set a goal: **${title}** (${target} times this week)`,
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    await interaction.reply({
      content: '❌ Failed to create goal. Please try again.',
      ephemeral: true,
    });
  }
}

async function handleCheckIn(interaction: ChatInputCommandInteraction) {
  try {
    const weekIdentifier = getCurrentWeek();
    const incompleteGoals = await getUserIncompleteGoals(
      interaction.user.id,
      weekIdentifier
    );

    if (incompleteGoals.length === 0) {
      await interaction.reply({
        content:
          '🎉 You have no incomplete goals this week! Use `/lgt goals set` to create new ones.',
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`goal-checkin-select-${interaction.user.id}`)
      .setPlaceholder('Select a goal to check in')
      .addOptions(
        incompleteGoals.map((goal) => ({
          label:
            goal.title.length > 100
              ? goal.title.substring(0, 97) + '...'
              : goal.title,
          description: `Progress: ${goal.completionCount}/${goal.targetCount}`,
          value: goal.id.toString(),
        }))
      );

    await interaction.reply({
      content: 'Select a goal to mark progress:',
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          selectMenu
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error handling check-in:', error);
    await interaction.reply({
      content: '❌ Failed to load goals. Please try again.',
      ephemeral: true,
    });
  }
}

export async function handleGoalCheckInSelect(
  interaction: StringSelectMenuInteraction
) {
  const goalId = parseInt(interaction.values[0]);

  try {
    const [goalBefore] = await getGoalById(goalId);
    if (!goalBefore || goalBefore.userId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Goal not found or you do not have permission to check in.',
        ephemeral: true,
      });
      return;
    }

    if (goalBefore.completionCount >= goalBefore.targetCount) {
      await interaction.reply({
        content: '❌ This goal is already completed!',
        ephemeral: true,
      });
      return;
    }

    const [updatedGoal] = await incrementGoalProgress(goalId);
    const isCompleted = updatedGoal.completionCount >= updatedGoal.targetCount;

    const message = isCompleted
      ? `🎉 <@${interaction.user.id}> completed their goal: **${updatedGoal.title}**!`
      : `<@${interaction.user.id}> checked in: **${updatedGoal.title}** ${getProgressBar(updatedGoal.completionCount, updatedGoal.targetCount)}`;

    await interaction.reply({
      content: message,
    });
  } catch (error) {
    console.error('Error processing check-in:', error);
    await interaction.reply({
      content: '❌ Failed to check in. Please try again.',
      ephemeral: true,
    });
  }
}

async function handleListOwnGoals(interaction: ChatInputCommandInteraction) {
  try {
    const weekIdentifier = getCurrentWeek();
    const userGoals = await getUserGoals(interaction.user.id, weekIdentifier);

    if (userGoals.length === 0) {
      await interaction.reply({
        content:
          'You have no goals set for this week. Use `/lgt goals set` to create one!',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Your Goals This Week')
      .setColor(0x0099ff)
      .setTimestamp()
      .addFields(
        userGoals.map((goal) => ({
          name: goal.title,
          value: `${getProgressBar(goal.completionCount, goal.targetCount)} (${goal.completionCount}/${goal.targetCount})`,
          inline: false,
        }))
      );

    await interaction.reply({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Error listing goals:', error);
    await interaction.reply({
      content: '❌ Failed to load goals. Please try again.',
      ephemeral: true,
    });
  }
}

async function handleTeamGoals(interaction: ChatInputCommandInteraction) {
  try {
    const weekIdentifier = getCurrentWeek();
    const allGoals = await getAllActiveGoals(weekIdentifier);

    if (allGoals.length === 0) {
      await interaction.reply({
        content: 'No team goals set for this week yet.',
      });
      return;
    }

    const goalsByUser = new Map<string, typeof allGoals>();
    for (const goal of allGoals) {
      if (!goalsByUser.has(goal.userId)) {
        goalsByUser.set(goal.userId, []);
      }
      goalsByUser.get(goal.userId)!.push(goal);
    }

    const embed = new EmbedBuilder()
      .setTitle('Team Goals This Week')
      .setColor(0x00ff00)
      .setTimestamp();

    for (const [userId, goals] of goalsByUser) {
      const user = await interaction.client.users
        .fetch(userId)
        .catch(() => null);
      const username = user?.displayName || `User ${userId}`;

      embed.addFields({
        name: `${username}'s Goals`,
        value: goals
          .map(
            (g) =>
              `• ${g.title}: ${getProgressBar(g.completionCount, g.targetCount)}`
          )
          .join('\n'),
        inline: false,
      });
    }

    await interaction.reply({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Error loading team goals:', error);
    await interaction.reply({
      content: '❌ Failed to load team goals. Please try again.',
      ephemeral: true,
    });
  }
}

async function handleDeleteGoal(interaction: ChatInputCommandInteraction) {
  try {
    const weekIdentifier = getCurrentWeek();
    const userGoals = await getUserGoals(interaction.user.id, weekIdentifier);

    if (userGoals.length === 0) {
      await interaction.reply({
        content: 'You have no goals to delete this week.',
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`goal-delete-select-${interaction.user.id}`)
      .setPlaceholder('Select a goal to delete')
      .addOptions(
        userGoals.map((goal) => ({
          label:
            goal.title.length > 100
              ? goal.title.substring(0, 97) + '...'
              : goal.title,
          description: `Progress: ${goal.completionCount}/${goal.targetCount}`,
          value: goal.id.toString(),
        }))
      );

    await interaction.reply({
      content: 'Select a goal to delete:',
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          selectMenu
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error handling delete goal:', error);
    await interaction.reply({
      content: '❌ Failed to load goals. Please try again.',
      ephemeral: true,
    });
  }
}

export async function handleGoalDeleteSelect(
  interaction: StringSelectMenuInteraction
) {
  const goalId = parseInt(interaction.values[0]);

  try {
    const [goal] = await getGoalById(goalId);
    if (!goal || goal.userId !== interaction.user.id) {
      await interaction.reply({
        content:
          '❌ Goal not found or you do not have permission to delete it.',
        ephemeral: true,
      });
      return;
    }

    const confirmButton = new ButtonBuilder()
      .setCustomId(`goal-delete-confirm-${goalId}`)
      .setLabel(`Delete "${goal.title}"`)
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('goal-delete-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    await interaction.reply({
      content: `Are you sure you want to delete this goal?\n**${goal.title}** (${goal.completionCount}/${goal.targetCount})`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmButton,
          cancelButton
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error processing delete selection:', error);
    await interaction.reply({
      content: '❌ Failed to process deletion. Please try again.',
      ephemeral: true,
    });
  }
}

export async function handleGoalDeleteConfirm(interaction: ButtonInteraction) {
  const goalId = parseInt(
    interaction.customId.replace('goal-delete-confirm-', '')
  );

  try {
    const [goal] = await getGoalById(goalId);
    if (!goal || goal.userId !== interaction.user.id) {
      await interaction.reply({
        content:
          '❌ Goal not found or you do not have permission to delete it.',
        ephemeral: true,
      });
      return;
    }

    await softDeleteGoal(goalId);

    await interaction.reply({
      content: `<@${interaction.user.id}> removed their goal: **${goal.title}**`,
    });
  } catch (error) {
    console.error('Error confirming goal deletion:', error);
    await interaction.reply({
      content: '❌ Failed to delete goal. Please try again.',
      ephemeral: true,
    });
  }
}

export async function handleGoalDeleteCancel(interaction: ButtonInteraction) {
  await interaction.reply({
    content: 'Goal deletion cancelled.',
    ephemeral: true,
  });
}

export async function handleGoalInteraction(
  interaction: Exclude<Interaction, ChatInputCommandInteraction>
) {
  if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith('goal-create-modal-')
  ) {
    await handleGoalModalSubmit(interaction);
    return true;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('goal-checkin-select-')) {
      await handleGoalCheckInSelect(interaction);
      return true;
    }
    if (interaction.customId.startsWith('goal-delete-select-')) {
      await handleGoalDeleteSelect(interaction);
      return true;
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('goal-delete-confirm-')) {
      await handleGoalDeleteConfirm(interaction);
      return true;
    }
    if (interaction.customId === 'goal-delete-cancel') {
      await handleGoalDeleteCancel(interaction);
      return true;
    }
  }

  return false;
}

function getProgressBar(current: number, target: number): string {
  const filled = '✅';
  const empty = '⬜';
  return [...filled.repeat(current), ...empty.repeat(target - current)].join(
    ' '
  );
}
