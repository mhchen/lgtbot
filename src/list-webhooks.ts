import { listEventSubSubscriptions } from './twitch';

async function listWebhooks() {
  try {
    const subscriptions = await listEventSubSubscriptions();

    if (subscriptions.length === 0) {
      console.log('No active webhook subscriptions found');
      return;
    }

    console.log('Active webhook subscriptions:');
    subscriptions.forEach((sub) => {
      console.log(`- Type: ${sub.type}`);
      console.log(`  Status: ${sub.status}`);
      console.log(`  Condition: ${JSON.stringify(sub.condition)}`);
      console.log('  ---');
    });
  } catch (error) {
    console.error('Error listing webhooks:', error);
  }
}

listWebhooks();
