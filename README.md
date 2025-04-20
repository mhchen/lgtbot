# Let's Get Technical (LGT) Bot

A Discord bot for the Let's Get Technical community that provides community engagement features, Twitch integration, and fun interaction systems.

## Core Features

### 1. Kudos System

- Members can give and receive kudos through reactions with the 'lgt' emoji
- Tracks user levels and points
- Features:
  - `/lgt kudos rank` - Check your or another user's rank, level, and points
  - `/lgt kudos leaderboard` - View top 10 helpful members
  - `/lgt kudos top` - Show most helpful messages (filterable by timeframe)

### 2. Book Club Management

- Unique moderation system where a specific moderator can "ban" users using the 'banhammer' emoji
- Achievement system with titles and custom images for ban milestones
- Features:
  - `/lgt bookclub bans` - Display the book club ban leaderboard
  - Fun titles for the moderator (e.g., "Supreme Ruler", "Grand Overlord")
  - Achievement unlocks at specific ban counts (10, 20, 30, 40, 50, 69, 100)

### 3. Twitch Integration

- Webhook server for stream notifications
- Requires moderator permissions to manage
- Features:
  - Stream start notifications in a designated Discord channel
  - Subscription management commands (moderators only):
    - `/lgt twitch subscribe <username>` - Subscribe to a Twitch channel
    - `/lgt twitch unsubscribe <username>` - Unsubscribe from a Twitch channel
    - `/lgt twitch list` - List all active Twitch subscriptions

### 4. Special Interactions

- Custom reply system for specific users in the watercooler channel

## Technical Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: TypeScript
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team)
- **Key Dependencies**:
  - discord.js v14 - Discord bot functionality
  - express - Webhook server
  - drizzle-orm - Database ORM
  - libsql - SQLite client

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- Discord bot token and application credentials
- Twitch developer account (for stream notifications)

### Environment Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Configure the following environment variables:

```
DISCORD_TOKEN=         # Your Discord bot token
DISCORD_CLIENT_ID=     # Your Discord application client ID
TWITCH_CLIENT_ID=      # Your Twitch application client ID
TWITCH_CLIENT_SECRET=  # Your Twitch application client secret
NOTIFICATION_CHANNEL_ID= # Discord channel for stream notifications
WEBHOOK_URL=          # Public URL for Twitch webhooks
WEBHOOK_SECRET=       # Secret for Twitch webhook verification
PORT=3000            # Port for the webhook server
```

### Installation & Development

```bash
# Install dependencies
bun install

# Start the development server
bun run dev
```

### Available Scripts

```bash
# Development
bun run dev         # Start the development server

# Database
bun run db:generate # Generate migrations
bun run db:push    # Push schema changes (dev only)
bun run db:up      # Apply migrations
bun run db:check   # Check schema drift
bun run db:studio  # Open Drizzle Studio

# Code Quality
bun run lint       # Run ESLint and Prettier checks
bun run lint:fix   # Fix linting and formatting issues
bun run typecheck  # Run TypeScript type checking
```

## Production Deployment

The application uses PM2 for process management in production:

```bash
pm2 start pm2.config.cjs --watch
```

## Contributing

1. Fork and clone the repository
2. Create a feature branch
3. Install dependencies with `bun install`
4. Make your changes
5. Ensure all tests pass:
   ```bash
   bun run lint
   bun run typecheck
   ```
6. Submit a pull request

### Code Style Guidelines

- Use TypeScript strict mode
- Regular functions for top-level declarations
- Arrow functions within other functions
- Prefer object parameters for complex functions
- Follow existing patterns in the codebase

## Bot Commands

All commands are under the `/lgt` prefix with the following structure:

```
/lgt
├── kudos
│   ├── rank [user]       # Display user's rank and level
│   ├── leaderboard      # Show top 10 helpful members
│   └── top [timeframe]  # Show most helpful messages
├── bookclub
│   └── bans            # Display the ban leaderboard
└── twitch (mod only)
    ├── subscribe <username>   # Subscribe to Twitch channel
    ├── unsubscribe <username> # Unsubscribe from channel
    └── list                   # List all subscriptions
```

## License

See [LICENSE](LICENSE) file for details.
