// src/executor.ts
import spawn from 'cross-spawn';
import {ChildProcess} from 'child_process';
import {parseArguments, parseMultipleCommands, ParsedCommands} from './args';

export interface ExecutorOptions {
	verbose: boolean;
	parse: boolean;
}

export interface CommandDef {
	command: string;
	args: string[];
}

/**
 * Handles command execution with process management for watch mode
 */
export class CommandExecutor {
	private currentProcess: ChildProcess | null = null;
	private isKilling = false;

	/**
	 * Execute a single command
	 * Returns exit code (0 = success)
	 */
	async execute(command: string, args: string[], options: ExecutorOptions): Promise<number> {
		const finalArgs = options.parse ? parseArguments(args) : args;

		if (options.verbose) {
			console.log(
				`executing${options.parse ? ' (parsed)' : ''}: ${command} ${finalArgs.join(' ')}`,
			);
		}

		return new Promise((resolve) => {
			this.currentProcess = spawn(command, finalArgs, {stdio: 'inherit'});

			this.currentProcess.on('error', (err) => {
				if (options.verbose) {
					console.error(err.message);
				}
				this.currentProcess = null;
				resolve(1);
			});

			this.currentProcess.on('close', (code) => {
				this.currentProcess = null;
				resolve(code ?? 0);
			});
		});
	}

	/**
	 * Execute multiple commands sequentially (for ~~ syntax)
	 * Stops on first failure
	 */
	async executeAll(
		mainCommand: string,
		commandArgs: string[],
		options: ExecutorOptions,
	): Promise<number> {
		const commands = parseMultipleCommands(commandArgs);
		const numExtraCommands = commands.extraCommands.length;
		const numCommands = numExtraCommands + 1;

		// Execute first command
		const label = numExtraCommands > 0 ? `:1/${numCommands}` : '';
		if (options.verbose && numExtraCommands > 0) {
			console.log(`executing${label}...`);
		}

		const firstResult = await this.execute(mainCommand, commands.firstCommandArgs, options);
		if (firstResult !== 0) {
			return firstResult;
		}

		// Execute extra commands
		for (let i = 0; i < commands.extraCommands.length; i++) {
			const cmd = commands.extraCommands[i];
			if (options.verbose) {
				console.log(`executing:${i + 2}/${numCommands}...`);
			}
			const result = await this.execute(cmd.command, cmd.args, options);
			if (result !== 0) {
				return result;
			}
		}

		return 0;
	}

	/**
	 * Kill the currently running process with SIGTERM
	 * Waits for graceful shutdown, then SIGKILL if needed
	 */
	async kill(): Promise<void> {
		if (!this.currentProcess || this.isKilling) {
			return;
		}

		this.isKilling = true;
		const proc = this.currentProcess;

		return new Promise((resolve) => {
			const killTimeout = setTimeout(() => {
				// Force kill if still running after 5 seconds
				if (this.currentProcess === proc) {
					proc.kill('SIGKILL');
				}
			}, 5000);

			proc.on('close', () => {
				clearTimeout(killTimeout);
				this.isKilling = false;
				resolve();
			});

			// Send SIGTERM for graceful shutdown
			proc.kill('SIGTERM');
		});
	}

	/**
	 * Check if a process is currently running
	 */
	isRunning(): boolean {
		return this.currentProcess !== null && !this.isKilling;
	}
}

/**
 * Synchronous execution for non-watch mode (backward compatible behavior)
 */
export function executeSync(command: string, args: string[], options: ExecutorOptions): number {
	const finalArgs = options.parse ? parseArguments(args) : args;

	if (options.verbose) {
		console.log(`executing${options.parse ? ' (parsed)' : ''}: ${command} ${finalArgs.join(' ')}`);
	}

	const result = spawn.sync(command, finalArgs, {stdio: 'inherit'});

	if (result.error) {
		if (options.verbose) {
			console.error(result.error.message);
		}
		return 1;
	}

	return result.status ?? 0;
}

/**
 * Synchronous execution of multiple commands (backward compatible)
 */
export function executeAllSync(
	mainCommand: string,
	commandArgs: string[],
	options: ExecutorOptions,
): number {
	const commands = parseMultipleCommands(commandArgs);
	const numExtraCommands = commands.extraCommands.length;
	const numCommands = numExtraCommands + 1;

	// Execute first command
	const firstArgs = options.parse
		? parseArguments(commands.firstCommandArgs)
		: commands.firstCommandArgs;
	if (options.verbose) {
		console.log(
			`executing${numExtraCommands > 0 ? `:1/${numCommands}` : ''}${options.parse ? ' (parsed)' : ''}: ${mainCommand} ${firstArgs.join(' ')}`,
		);
	}

	const firstResult = spawn.sync(mainCommand, firstArgs, {stdio: 'inherit'});
	if (firstResult.error) {
		if (options.verbose) {
			console.error(firstResult.error.message);
		}
		return 1;
	}
	if (firstResult.status !== 0) {
		return firstResult.status ?? 1;
	}

	// Execute extra commands
	for (let i = 0; i < commands.extraCommands.length; i++) {
		const cmd = commands.extraCommands[i];
		const parsedArgs = options.parse ? parseArguments(cmd.args) : cmd.args;
		if (options.verbose) {
			console.log(
				`executing:${i + 2}/${numCommands}${options.parse ? ' (parsed)' : ''}: ${cmd.command} ${parsedArgs.join(' ')}`,
			);
		}
		const result = spawn.sync(cmd.command, parsedArgs, {stdio: 'inherit'});
		if (result.error) {
			if (options.verbose) {
				console.error(result.error.message);
			}
			return 1;
		}
		if (result.status !== 0) {
			return result.status ?? 1;
		}
	}

	return 0;
}
