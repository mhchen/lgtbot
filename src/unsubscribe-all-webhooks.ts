import {
  listEventSubSubscriptions,
  deleteEventSubSubscription,
} from './twitch';

async function unsubscribeAllWebhooks() {
  try {
    const subscriptions = await listEventSubSubscriptions();

    if (subscriptions.length === 0) {
      console.log('No active webhook subscriptions found');
      return;
    }

    console.log(
      `Found ${subscriptions.length} active webhook subscriptions. Unsubscribing...`
    );

    for (const subscription of subscriptions) {
      try {
        await deleteEventSubSubscription(subscription.id);
        console.log(`✓ Unsubscribed from ${subscription.type} webhook`);
      } catch (error) {
        console.error(
          `Failed to unsubscribe from ${subscription.type} webhook:`,
          error
        );
      }
    }

    console.log('Finished unsubscribing from all webhooks');
  } catch (error) {
    console.error('Error unsubscribing from webhooks:', error);
  }
}

unsubscribeAllWebhooks();
