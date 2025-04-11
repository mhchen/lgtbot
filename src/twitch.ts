import axios from 'axios';
import {
  SlashCommandSubcommandGroupBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { db } from './db/index';
import { twitchSubscriptions } from './db/schema';
import { eq } from 'drizzle-orm';
import pc from 'picocolors';

interface TwitchStreamInfo {
  game_name: string;
  title: string;
  thumbnail_url: string;
}

interface TwitchUserInfo {
  profile_image_url: string;
}

let accessToken: string | null = null;
const clientId = process.env.TWITCH_CLIENT_ID!;
const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

async function getAccessToken() {
  if (accessToken) return accessToken;

  const response = await axios.post(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
  );

  accessToken = response.data.access_token;
  return accessToken;
}

async function getUserId({ username }: { username: string }): Promise<string> {
  const token = await getAccessToken();

  const response = await axios.get(
    `https://api.twitch.tv/helix/users?login=${username}`,
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.data.data.length) {
    throw new Error(`User ${username} not found`);
  }

  return response.data.data[0].id;
}

async function subscribeToStream({
  username,
}: {
  username: string;
}): Promise<string> {
  const token = await getAccessToken();
  const userId = await getUserId({ username });

  const response = await axios.post(
    'https://api.twitch.tv/helix/eventsub/subscriptions',
    {
      type: 'stream.online',
      version: '1',
      condition: {
        broadcaster_user_id: userId,
      },
      transport: {
        method: 'webhook',
        callback: `${process.env.TWITCH_WEBHOOK_URL!}/webhooks/twitch`,
        secret: process.env.TWITCH_WEBHOOK_SECRET!,
      },
    },
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.data[0].id;
}

// API functions
export async function getStreamInfo({
  userId,
}: {
  userId: string;
}): Promise<TwitchStreamInfo> {
  const token = await getAccessToken();

  const response = await axios.get(
    `https://api.twitch.tv/helix/streams?user_id=${userId}`,
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const stream = response.data.data[0];
  return {
    game_name: stream?.game_name ?? '',
    title: stream?.title ?? '',
    thumbnail_url: stream?.thumbnail_url ?? '',
  };
}

export async function getUserInfo({
  userId,
}: {
  userId: string;
}): Promise<TwitchUserInfo> {
  const token = await getAccessToken();

  const response = await axios.get(
    `https://api.twitch.tv/helix/users?id=${userId}`,
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const user = response.data.data[0];
  return {
    profile_image_url: user?.profile_image_url ?? '',
  };
}

async function deleteEventSubSubscription(subscriptionId: string) {
  const token = await getAccessToken();

  await axios.delete(
    `https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`,
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

export function getTwitchCommands() {
  return (group: SlashCommandSubcommandGroupBuilder) =>
    group
      .setName('twitch')
      .setDescription('Twitch integration commands')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('subscribe')
          .setDescription('Subscribe to a Twitch channel')
          .addStringOption((option) =>
            option
              .setName('username')
              .setDescription('Twitch username to subscribe to')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('unsubscribe')
          .setDescription('Unsubscribe from a Twitch channel')
          .addStringOption((option) =>
            option
              .setName('username')
              .setDescription('Twitch username to unsubscribe from')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('List all Twitch channel subscriptions')
      );
}

// Database operations
function loadSubscriptions() {
  return db.select().from(twitchSubscriptions).all();
}

function loadSubscription({ username }: { username: string }) {
  return db
    .select()
    .from(twitchSubscriptions)
    .where(eq(twitchSubscriptions.username, username))
    .get();
}

function saveSubscription({
  username,
  twitchSubscriptionId,
}: {
  username: string;
  twitchSubscriptionId: string;
}) {
  db.insert(twitchSubscriptions)
    .values({
      username,
      twitchSubscriptionId,
    })
    .run();
}

function deleteSubscription({ username }: { username: string }) {
  db.delete(twitchSubscriptions)
    .where(eq(twitchSubscriptions.username, username))
    .run();
}

// Command handlers
export async function handleCommand(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

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
}

// Internal command handlers
async function handleSubscribe({ username }: { username: string }) {
  const subscriptions = loadSubscriptions();

  if (subscriptions.some((sub) => sub.username === username)) {
    return `Already subscribed to **${username}**`;
  }

  const subscriptionId = await subscribeToStream({ username });

  saveSubscription({ username, twitchSubscriptionId: subscriptionId });
  return `Successfully subscribed to https://www.twitch.tv/${username}`;
}

export async function handleUnsubscribe({ username }: { username: string }) {
  const subscription = loadSubscription({ username });

  if (!subscription) {
    return `Not subscribed to **${username}**`;
  }

  await deleteEventSubSubscription(subscription.twitchSubscriptionId);
  deleteSubscription({ username });
  return `Successfully unsubscribed from **${username}**`;
}

export async function handleListSubscriptions() {
  const subscriptions = loadSubscriptions();

  if (subscriptions.length === 0) {
    return 'No active subscriptions';
  }

  return [
    'LGTBot is currently subscribed to the following Twitch channels:',
    ...subscriptions.map((sub) => `* https://www.twitch.tv/${sub.username}`),
  ].join('\n');
}
