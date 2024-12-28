import {
  getUserId,
  listEventSubSubscriptions,
  subscribeToStream,
} from './twitch';
import { loadSubscriptions } from './commands';

async function syncWebhooks() {
  try {
    const subscriptions = loadSubscriptions();

    console.log('Starting webhook sync...');

    const currentWebhooks = await listEventSubSubscriptions();
    const subscribedUserIds = new Set(
      currentWebhooks
        .filter((hook) => hook.type === 'stream.online')
        .map((hook) => hook.condition.broadcaster_user_id)
    );

    for (const sub of subscriptions) {
      try {
        const userId = await getUserId({ username: sub.username });

        if (!subscribedUserIds.has(userId)) {
          console.log(`Setting up webhook for ${sub.username}...`);
          await subscribeToStream({ username: sub.username });
          console.log(`Successfully subscribed to ${sub.username}`);
        } else {
          console.log(`Webhook already exists for ${sub.username}`);
        }
      } catch (error) {
        console.error(`Failed to sync webhook for ${sub.username}:`, error);
      }

      await Bun.sleep(100);
    }

    console.log('Webhook sync completed!');
  } catch (error) {
    console.error('Error syncing webhooks:', error);
  }
}

syncWebhooks();
