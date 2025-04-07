import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { deleteEventSubSubscription, subscribeToStream } from './twitch';
import { db } from './db/index';
import { twitchSubscriptions } from './db/schema';
import { eq } from 'drizzle-orm';
import { kudosCommands } from './kudos';

export enum SubscriptionCommand {
  TwitchSubscribe = 'twitch-subscribe',
  TwitchUnsubscribe = 'twitch-unsubscribe',
  TwitchListSubscriptions = 'twitch-list-subscriptions',
}

export function loadSubscriptions() {
  return db.select().from(twitchSubscriptions).all();
}

export function loadSubscription({ username }: { username: string }) {
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

export async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName(SubscriptionCommand.TwitchSubscribe)
      .setDescription('Subscribe to a Twitch channel')
      .addStringOption((option) =>
        option
          .setName('username')
          .setDescription('Twitch username to subscribe to')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName(SubscriptionCommand.TwitchUnsubscribe)
      .setDescription('Unsubscribe from a Twitch channel')
      .addStringOption((option) =>
        option
          .setName('username')
          .setDescription('Twitch username to unsubscribe from')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName(SubscriptionCommand.TwitchListSubscriptions)
      .setDescription('List all Twitch channel subscriptions'),
    ...kudosCommands,
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commands,
    });
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

export async function handleSubscribe({ username }: { username: string }) {
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
