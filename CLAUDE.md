# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
bun run dev         # Start the development server
bun install         # Install dependencies

# Database Operations
bun run db:generate # Generate migrations from schema changes
bun run db:push     # Push schema changes (development only)
bun run db:migrate  # Apply migrations to database
bun run db:studio   # Open Drizzle Studio for database management
bun run db:check    # Check for schema drift

# Code Quality
bun run lint        # Run ESLint and Prettier checks
bun run lint:fix    # Fix linting and formatting issues
bun run typecheck   # Run TypeScript type checking

# Production
pm2 start pm2.config.cjs --watch  # Start with PM2 process manager
```

## Architecture Overview

This Discord bot follows a **modular, feature-based architecture** where each feature is self-contained:

### Core Structure

- **Entry Point**: `src/index.ts` - Bot initialization, listener registration, command routing
- **Feature Modules**: Each feature (kudos, book-club-bans, noel-replies, twitch) is self-contained
- **Database Layer**: Drizzle ORM with SQLite, centralized in `src/db/`
- **Command System**: Hierarchical slash commands under `/lgt` prefix

### Module Pattern

Each feature module follows this pattern:

1. **Event Registration**: `register*Listeners(client)` function for Discord events
2. **Command Definition**: `get*Commands()` function returning SlashCommandBuilder
3. **Command Handling**: `handleCommand(interaction)` function for slash command processing
4. **Database Access**: Feature-specific queries in `src/db/[feature].ts`

### Technology Stack

- **Runtime**: Bun (preferred over Node.js)
- **Database**: SQLite with Drizzle ORM
- **Discord**: discord.js v14 with proper intents and partials
- **Web Server**: Express for webhook endpoints (Twitch integration)

## Key Patterns

### Event Listeners

- Register via `register*Listeners(client)` functions called from main
- Each listener handles specific Discord events (reactions, messages, member updates)
- Proper error handling with try/catch blocks
- Fetch partial objects when needed

### Command Structure

```
/lgt
├── kudos/          # User appreciation system
│   ├── rank        # Show user rank and level
│   ├── leaderboard # Top 10 helpful members
│   └── top         # Most helpful messages
├── bookclub/       # Book club moderation
│   └── bans        # Ban leaderboard with achievements
└── twitch/         # Stream notifications (moderator only)
    ├── subscribe   # Subscribe to Twitch channel
    ├── unsubscribe # Unsubscribe from channel
    └── list        # List active subscriptions
```

### Database Patterns

- Schema defined in `src/db/schema.ts` with proper indexing
- Feature-specific query functions in `src/db/[feature].ts`
- Type-safe operations with Drizzle ORM
- Environment-based configuration (memory for tests, file for production)

## Development Guidelines

### Adding New Features

1. Create main feature file in `src/[feature].ts`
2. Add database queries in `src/db/[feature].ts` if needed
3. Update schema in `src/db/schema.ts` if new tables required
4. Register listeners in main `src/index.ts`
5. Add command handling to main command router
6. Add tests in `src/__tests__/[feature].test.ts`

### Database Changes

- Always generate migrations: `bun run db:generate`
- Use `db:push` only in development
- Apply migrations in production: `bun run db:migrate`

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Regular functions for top-level declarations
- Arrow functions within other functions
- Prefer object parameters for complex functions

### Environment Variables

Required in `.env` file:

- `DISCORD_TOKEN` - Bot token
- `DISCORD_CLIENT_ID` - Application client ID
- `TWITCH_CLIENT_ID` & `TWITCH_CLIENT_SECRET` - For stream notifications
- `NOTIFICATION_CHANNEL_ID` - Channel for Twitch notifications
- `WEBHOOK_URL` & `WEBHOOK_SECRET` - Twitch webhook configuration
- `PORT` - Webhook server port (default: 3000)

## Testing

- Tests use in-memory SQLite database
- Mock Discord client in `src/__tests__/mockDiscordClient.ts`
- Run tests with standard `bun test` command
- Focus on testing business logic and database operations

## Special Features

### Kudos System

- React with 'lgt' emoji to give kudos
- Tracks user levels and points
- Prevents self-kudos and duplicate reactions

### Book Club Bans

- Specific moderator can "ban" users with 'banhammer' emoji
- Achievement system with custom images
- Milestone tracking (10, 20, 30, 40, 50, 69, 100 bans)

### Twitch Integration

- Webhook server for stream notifications
- Subscription management (moderator only)
- Automatic notifications with Discord embeds

### Noel Replies

- Custom interaction system for specific user in watercooler channel
- Configurable reply percentage
