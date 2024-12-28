import axios from 'axios';

interface EventSubSubscription {
  id: string;
  status: string;
  type: string;
  condition: Record<string, string>;
  created_at: string;
  transport: {
    method: string;
    callback: string;
  };
}

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

export async function getUserId({
  username,
}: {
  username: string;
}): Promise<string> {
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

export async function subscribeToStream({
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
        callback: process.env.WEBHOOK_URL!,
        secret: process.env.WEBHOOK_SECRET!,
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

export async function listEventSubSubscriptions(): Promise<
  EventSubSubscription[]
> {
  const token = await getAccessToken();

  const response = await axios.get(
    'https://api.twitch.tv/helix/eventsub/subscriptions',
    {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.data;
}

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

export async function deleteEventSubSubscription(subscriptionId: string) {
  const url = `https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`;
  const token = await getAccessToken();

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete subscription: ${response.statusText}`);
  }
}
