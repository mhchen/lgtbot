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

## Database management

This project uses [Drizzle ORM](https://orm.drizzle.team) with SQLite for database management. The database schema is defined in `src/db/schema.ts`.

### Available commands

- `bun run db:generate` - Generate migrations from your schema changes
- `bun run db:push` - Push schema changes directly to the database (use in development only)
- `bun run db:up` - Apply pending migrations to the database
- `bun run db:check` - Check for schema drift between your migrations and database
- `bun run db:studio` - Open Drizzle Studio to view and edit data

### Making schema changes

1. Edit the schema in `src/db/schema.ts`
2. Generate a new migration:
   ```bash
   bun run db:generate
   ```
3. The new migration will be created in the `drizzle` directory
4. Apply the migration:
   ```bash
   bun run db:up
   ```

### Development workflow

During development, you can use `db:push` to quickly test schema changes without creating migrations:

```bash
bun run db:push
```

However, always create proper migrations before committing changes or deploying to production.

## Functionality

### Twitch bot

Allows users to subscribe to streamers, list active subscriptions, and unsubscribe from streamers. Subscriptions notify a channel in the LGT Discord that a stream has started.

### Book club moderation

Provides a moderation system where a specific moderator can ban users with emoji reactions, featuring automatic role assignments, achievements, and a leaderboard for ban counts.

### Noel reply system

Randomly responds to messages from a specific user in the watercooler channel with the time.
