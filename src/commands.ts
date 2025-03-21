import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { deleteEventSubSubscription, subscribeToStream } from './twitch';
import { db } from './db';

db.run(`
  CREATE TABLE IF NOT EXISTS twitch_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    twitch_subscription_id TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS book_club_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_user_id TEXT NOT NULL,
    discord_message_ids TEXT NOT NULL
  );
`);

export enum SubscriptionCommand {
  TwitchSubscribe = 'twitch-subscribe',
  TwitchUnsubscribe = 'twitch-unsubscribe',
  TwitchListSubscriptions = 'twitch-list-subscriptions',
  RoastMe = 'roastme',
}

interface Subscription {
  username: string;
  twitch_subscription_id: string;
}

export function loadSubscriptions(): Subscription[] {
  return db
    .query('SELECT username, twitch_subscription_id FROM twitch_subscriptions')
    .all() as Subscription[];
}

export function loadSubscription({ username }: { username: string }) {
  return db
    .query(
      'SELECT username, twitch_subscription_id FROM twitch_subscriptions WHERE username = ?'
    )
    .get(username) as Subscription;
}

function saveSubscription({
  username,
  twitchSubscriptionId,
}: {
  username: string;
  twitchSubscriptionId: string;
}) {
  db.run(
    'INSERT INTO twitch_subscriptions (username, twitch_subscription_id) VALUES (?, ?)',
    [username, twitchSubscriptionId]
  );
}

function deleteSubscription({ username }: { username: string }) {
  db.run('DELETE FROM twitch_subscriptions WHERE username = ?', [username]);
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
    new SlashCommandBuilder()
      .setName(SubscriptionCommand.RoastMe)
      .setDescription('Get roasted based on your recent messages'),
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

  await deleteEventSubSubscription(subscription.twitch_subscription_id);
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
