# ldenv Watch Mode Demo

This example demonstrates the watch mode feature of ldenv, which automatically reloads your application when `.env` files change.

## Quick Start

From the project root, run:

```bash
# Development mode with watch
pnpm ldenv -m development -w node examples/watch-demo/server.js

# Or from this directory:
cd examples/watch-demo
npx ldenv -m development -w node server.js
```

## What to Try

### 1. Basic Watch Mode

Start the server with watch mode:

```bash
ldenv -w node server.js
```

The server will start and print configuration every 2 seconds.

### 2. Edit .env and See Reload

While the server is running, open `.env` in another terminal/editor and change:

```bash
echo "LOG_LEVEL=debug" >> .env
```

Watch the server automatically restart with the new configuration!

### 3. Switch Modes

Try different modes:

```bash
# Development mode
ldenv -m development -w node server.js

# Production mode  
ldenv -m production -w node server.js
```

### 4. Verbose Mode

See detailed information about loaded files:

```bash
ldenv -w --verbose node server.js
```

### 5. Variable Substitution

Use environment variables in commands:

```bash
ldenv -w echo "App: @@APP_NAME, API: @@API_URL"
```

### 6. Sequential Commands

Run multiple commands that restart together:

```bash
ldenv -w echo "Starting..." ~~ node server.js ~~
```

## Files

- `.env` - Base configuration
- `.env.development` - Development overrides
- `.env.production` - Production overrides  
- `server.js` - Demo server script

## How Watch Mode Works

1. ldenv captures the original environment before loading `.env` files
2. It loads the appropriate `.env` files based on mode
3. It starts your command with the loaded environment
4. It watches all loaded `.env` files for changes
5. When a file changes:
   - The running process receives SIGTERM for graceful shutdown
   - Environment is restored to original state
   - Fresh `.env` files are loaded
   - Command is re-executed with new environment

This ensures your application always has the latest configuration without manual restarts!
