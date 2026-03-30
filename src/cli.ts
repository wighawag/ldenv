#!/usr/bin/env node
import {loadEnvWithInfo} from './index';
import {parseCliArgs, resolveGitBranchMode, processModeFromCommandArgs} from './args';
import {EnvStateManager} from './env-state';
import {CommandExecutor, executeAllSync} from './executor';
import {EnvFileWatcher} from './watcher';

const args = parseCliArgs(process.argv.slice(2));

function error(msg: string): never {
	console.error(msg);
	process.exit(1);
}

if (!args.command) {
	error('no command specified');
}

// Resolve git branch mode if requested
let defaultMode = args.defaultMode;
if (args.useGitBranchNameAsDefaultMode) {
	const branchMode = resolveGitBranchMode();
	if (branchMode) {
		defaultMode = branchMode;
	}
}

// Process @@ mode from command args
const processed = processModeFromCommandArgs(args.commandArgs, args.mode, defaultMode);
const mode = processed.mode;
const commandArgs = processed.commandArgs;

if (args.verbose) {
	console.log(
		`using defaultMode: ${defaultMode}, mode: ${mode} and use mode env name: ${args.modeEnvName}`,
	);
}

// Main execution
if (args.watch) {
	runWatchMode();
} else {
	runOnceMode();
}

/**
 * Single execution mode (existing behavior)
 */
function runOnceMode(): void {
	loadEnvWithInfo({
		defaultMode,
		mode,
		useModeEnv: args.modeEnvName,
	});

	const exitCode = executeAllSync(args.command!, commandArgs, {
		verbose: args.verbose,
		parse: args.parse,
	});

	process.exit(exitCode);
}

/**
 * Watch mode - watches .env files and re-executes on changes
 */
async function runWatchMode(): Promise<void> {
	const envManager = new EnvStateManager();
	const executor = new CommandExecutor();
	const fileWatcher = new EnvFileWatcher();

	// Capture the base environment BEFORE loading any .env files
	envManager.captureBaseEnv();

	let loadedFiles: string[] = [];
	let resolvedMode: string = 'local';

	function loadEnvAndGetFiles(): {files: string[]; mode: string} {
		// Restore base environment (remove previous .env vars)
		envManager.restoreBaseEnv();

		// Load fresh .env files
		const result = loadEnvWithInfo({
			defaultMode,
			mode,
			useModeEnv: args.modeEnvName,
		});

		// Apply the new environment
		envManager.applyEnv(result.env);

		if (args.verbose) {
			console.log(`[ldenv] Loaded files: ${result.loadedFiles.join(', ')}`);
		}

		return {files: result.loadedFiles, mode: result.mode};
	}

	async function startCommand(): Promise<void> {
		// Execute the command(s) - don't await, let it run in background
		console.log(`[ldenv] Running: ${args.command} ${commandArgs.join(' ')}`);
		executor.executeAll(args.command!, commandArgs, {
			verbose: args.verbose,
			parse: args.parse,
		});
	}

	async function restartWithFreshEnv(): Promise<void> {
		// Kill any running process
		if (executor.isRunning()) {
			console.log('[ldenv] Stopping current process...');
			await executor.kill();
		}

		// Reload environment
		const envResult = loadEnvAndGetFiles();
		loadedFiles = envResult.files;

		// Start command (don't await)
		await startCommand();
	}

	// Handle cleanup on exit
	const cleanup = async () => {
		console.log('\n[ldenv] Shutting down...');
		await executor.kill();
		await fileWatcher.unsubscribe();
		process.exit(0);
	};

	process.on('SIGINT', cleanup);
	process.on('SIGTERM', cleanup);

	// Initial load to get file list for watching
	const initialEnv = loadEnvAndGetFiles();
	loadedFiles = initialEnv.files;
	resolvedMode = initialEnv.mode;

	// Start watching BEFORE executing the command
	// Pass the mode so watcher only reacts to relevant .env files
	await fileWatcher.watch(loadedFiles, resolvedMode, () => {
		restartWithFreshEnv();
	});

	if (args.verbose) {
		console.log(`[ldenv] Watching for changes...`);
	}

	// Start the initial command (don't await)
	await startCommand();
}
