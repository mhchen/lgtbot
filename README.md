# Let's Get Technical (LGT) Bot

## Running the bot

Get a copy of the .env file, then install dependencies:

```bash
bun install
```

And run:

```bash
bun run src/index.ts
```

This will:
1. Start the bot and create the slash commands in the Discord
2. Start an `express` server that will listen for Twitch webhook events indicating that one of the subscribed streamer's streams are starting.

**In production**, this app uses PM2 to start the daemon. Start it with:

```bash
pm2 start pm2.config.cjs --watch
```

## Functionality

### Twitch bot
Allows users to subscribe to streamers, list active subscriptions, and unsubscribe from streamers. Subscriptions notify a channel in the LGT Discord that a stream has started.
