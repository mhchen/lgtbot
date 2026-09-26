import { Client, Events, GuildMember } from 'discord.js';
import { logger } from './logger';

const VERIFIED_ROLE_ID = '1531700897623572700';
const UNVERIFIED_ROLE_ID = '1532179332460576913';
const ROLE_LOG_CHANNEL_ID = '1532182270209949758';
const TRACKED_ROLES = [
  { id: VERIFIED_ROLE_ID, name: 'verified' },
  { id: UNVERIFIED_ROLE_ID, name: 'unverified' },
];

async function sendRoleLog(client: Client, content: string): Promise<void> {
  const channel = await client.channels.fetch(ROLE_LOG_CHANNEL_ID);

  if (!channel?.isTextBased() || !('send' in channel)) {
    throw new Error('Role log channel is not a text-based channel');
  }

  await channel.send({
    content,
    allowedMentions: { parse: [] },
  });
}

async function reportRoleAssignmentFailure({
  member,
  roleId,
  error,
}: {
  member: GuildMember;
  roleId: string;
  error: unknown;
}): Promise<void> {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown Discord API error';

  try {
    await sendRoleLog(
      member.guild.client,
      `❌ Failed to add <@&${roleId}> to <@${member.id}>: ${errorMessage.slice(0, 500)}`
    );
  } catch (logError) {
    logger.error(logError, 'Error sending role assignment failure log');
  }
}

async function addMemberRole({
  member,
  roleId,
  reason,
}: {
  member: GuildMember;
  roleId: string;
  reason: string;
}): Promise<void> {
  try {
    await member.roles.add(roleId, reason);
  } catch (error) {
    await reportRoleAssignmentFailure({ member, roleId, error });
    throw error;
  }
}

export async function assignUnverifiedRole(
  member: GuildMember
): Promise<boolean> {
  if (
    member.user.bot ||
    member.roles.cache.has(UNVERIFIED_ROLE_ID) ||
    member.roles.cache.has(VERIFIED_ROLE_ID)
  ) {
    return false;
  }

  await addMemberRole({
    member,
    roleId: UNVERIFIED_ROLE_ID,
    reason: 'Joined the server',
  });

  logger.info(
    { memberId: member.id },
    'Assigned unverified role to new member'
  );

  return true;
}

export function registerVerificationListeners(client: Client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      for (const role of TRACKED_ROLES) {
        const hadRole = oldMember.roles.cache.has(role.id);
        const hasRole = newMember.roles.cache.has(role.id);

        if (hadRole === hasRole) continue;

        const change = hasRole ? 'gained' : 'lost';
        await sendRoleLog(
          client,
          `<@${newMember.id}> ${change} the <@&${role.id}> role (${role.name}).`
        );
      }
    } catch (error) {
      logger.error(error, 'Error sending role change log');
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await assignUnverifiedRole(member);
    } catch (error) {
      logger.error(error, 'Error assigning unverified role to new member');
    }
  });

  logger.info('Verification listeners registered');
}
