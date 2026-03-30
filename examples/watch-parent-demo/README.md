# ldenv Watch Mode with Parent Folder (ENV_ROOT_FOLDER) Demo

This example demonstrates the watch mode feature with `ENV_ROOT_FOLDER`, testing whether ldenv watches for changes in parent folder `.env` files when running from a subfolder.

## Directory Structure

```
watch-parent-demo/
├── .env                    # Parent env file (APP_NAME, API_URL, PARENT_VAR)
├── .env.development        # Parent development overrides (DEBUG, LOG_LEVEL)
├── README.md
└── sub/
    ├── .env                # Subfolder env with ENV_ROOT_FOLDER=..
    └── server.js           # Demo server script
```

## How It Works

1. The `sub/.env` file contains `ENV_ROOT_FOLDER=..` which tells ldenv to look for `.env` files in the parent directory
2. ldenv loads files from BOTH directories (parent takes lower priority, child overrides)
3. Watch mode should watch ALL loaded files, including parent folder files

## Quick Start

```bash
# From the project root
cd examples/watch-parent-demo/sub
npx ldenv -m development -w --verbose node server.js
```

## What to Test

### 1. Start the Server

```bash
cd examples/watch-parent-demo/sub
npx ldenv -m development -w --verbose node server.js
```

The server will show which variables came from which source.

### 2. Edit Parent .env File

In another terminal, edit the parent folder's `.env`:

```bash
# From project root
echo "PARENT_VAR=PARENT_WAS_CHANGED" >> examples/watch-parent-demo/.env
```

**Expected:** Server should restart and show the new `PARENT_VAR` value.

### 3. Edit Parent .env.development File

```bash
echo "LOG_LEVEL=trace" >> examples/watch-parent-demo/.env.development
```

**Expected:** Server should restart and show `LOG_LEVEL=trace`.

### 4. Edit Local .env File

```bash
echo "SUB_VAR=SUB_WAS_CHANGED" >> examples/watch-parent-demo/sub/.env
```

**Expected:** Server should restart and show the new `SUB_VAR` value.

## Success Criteria

✅ Changing `../..env` triggers a reload
✅ Changing `../.env.development` triggers a reload  
✅ Changing `./.env` triggers a reload
✅ The `--verbose` flag shows which files are being watched

## Files

| File | Description |
|------|-------------|
| `.env` | Parent base configuration |
| `.env.development` | Parent development overrides |
| `sub/.env` | Subfolder config with `ENV_ROOT_FOLDER=..` |
| `sub/server.js` | Demo server that shows variable sources |

## What This Tests

This demo specifically tests that when `ENV_ROOT_FOLDER` is used:

1. Parent folder `.env` files are correctly loaded
2. Parent folder `.env` files are included in the watch list
3. Changes to parent folder files trigger application restart
4. The loading order (parent first, child overrides) is maintained
