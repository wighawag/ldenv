// src/args.ts
import {execSync} from 'child_process';

export interface ParsedArgs {
	mode: string | undefined;
	defaultMode: string | undefined;
	modeEnvName: string | undefined;
	parse: boolean;
	verbose: boolean;
	watch: boolean;
	useGitBranchNameAsDefaultMode: boolean;
	command: string | undefined;
	commandArgs: string[];
}

export interface ParsedCommands {
	firstCommandArgs: string[];
	extraCommands: Array<{command: string; args: string[]}>;
}

function error(msg: string): never {
	console.error(msg);
	process.exit(1);
}

/**
 * Parse CLI arguments into structured options
 * Extracts: -m (mode), -d (default mode), -n (mode env name), -P (no parse),
 *           --verbose, --git, -w/--watch, and the command with its args
 */
export function parseCliArgs(args: string[]): ParsedArgs {
	let mode: string | undefined;
	let defaultMode: string | undefined;
	let modeEnvName: string | undefined;
	let parse = true;
	let verbose = false;
	let watch = false;
	let useGitBranchNameAsDefaultMode = false;
	let command: string | undefined;
	let commandArgs: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg.startsWith('-')) {
			command = arg;
			commandArgs = args.slice(i + 1);
			break;
		} else {
			if (arg === '-m') {
				mode = args[i + 1];
				if (!mode) {
					error(`-m arg specified but no mode`);
				}
				i += 1;
			} else if (arg === '-d') {
				defaultMode = args[i + 1];
				if (!defaultMode) {
					error(`-d arg specified but no default mode`);
				}
				i += 1;
			} else if (arg === '-n') {
				modeEnvName = args[i + 1];
				if (!modeEnvName) {
					error(`-n arg specified but no env var name`);
				}
				i += 1;
			} else if (arg === '--git') {
				useGitBranchNameAsDefaultMode = true;
			} else if (arg === '-P') {
				parse = false;
			} else if (arg === '--verbose') {
				verbose = true;
			} else if (arg === '-w' || arg === '--watch') {
				watch = true;
			} else {
				error(`arg not recognized: ${arg}`);
			}
		}
	}

	return {
		mode,
		defaultMode,
		modeEnvName,
		parse,
		verbose,
		watch,
		useGitBranchNameAsDefaultMode,
		command,
		commandArgs,
	};
}

/**
 * Resolve defaultMode from git branch if --git flag is used
 */
export function resolveGitBranchMode(): string | undefined {
	// VERCEL need this:
	if (process.env.VERCEL_GIT_COMMIT_REF) {
		return process.env.VERCEL_GIT_COMMIT_REF;
	}
	// NETLIFY need this:
	if (process.env.BRANCH) {
		return process.env.BRANCH;
	}
	try {
		const branchName = execSync('git rev-parse --abbrev-ref HEAD', {encoding: 'utf8'}).trim();
		if (branchName.indexOf('/') !== -1) {
			const splitted = branchName.split('/');
			return splitted[splitted.length - 1];
		}
		return branchName;
	} catch (err: any) {
		console.error('Error getting Git branch:', err.message);
		return undefined;
	}
}

/**
 * Process @@ mode specifier in command args
 * Handles patterns like: cmd arg1 @@ production
 */
export function processModeFromCommandArgs(
	commandArgs: string[],
	currentMode: string | undefined,
	defaultMode: string | undefined,
): {mode: string | undefined; commandArgs: string[]} {
	const newArgs = [...commandArgs];
	let mode = currentMode;

	for (let i = 0; i < newArgs.length; i++) {
		const arg = newArgs[i];
		if (arg === '@@') {
			const nextArg = newArgs[i + 1];
			if (nextArg && nextArg !== '--') {
				mode = nextArg;
			}
			newArgs.splice(i, 2);
			i--;

			if (!mode && !defaultMode) {
				error(
					`error: expect to be provided a mode as last argument, or have an explicitly defined defaultMode`,
				);
			}
		}
	}

	if (typeof mode === 'string' && mode.length === 0) {
		error(`error: mode has been specified as argument, but it is empty`);
	}

	return {mode, commandArgs: newArgs};
}

/**
 * Parse command arguments with @@ variable substitution
 * Handles: @@VAR_NAME, @@VAR@:default@:, @@VAR1,VAR2 (fallback), @@VAR_:MODE: (dynamic name)
 */
export function parseArguments(commandArgs: string[]): string[] {
	const newArgs = commandArgs
		.map((arg) => {
			const [prefix, ...listToParse] = arg.split('@@');
			let newArg;
			if (listToParse.length > 0) {
				const combined = listToParse
					.map((toParse) => {
						const [varName, potentialDefaultValue, potentialSuffix] = toParse.split('@:');

						if (varName.length === 0) {
							error(
								`error: this is not valid : '@@${toParse}' please specify an ENV var name after '@@'`,
							);
						}

						const hasSuffix = typeof potentialSuffix !== 'undefined';
						const suffix = hasSuffix ? potentialSuffix : potentialDefaultValue;
						const defaultValue = hasSuffix ? potentialDefaultValue : undefined;

						// fallback var_name is allowed, they are separated by ","
						const varNames = varName.split(',');

						let value;
						for (const name of varNames) {
							// each of these var_name can be composed of other env value (no recursion, just one level)
							const splittedByColon = name.split(':');
							const actualName = splittedByColon
								.map((v, index) => {
									if (index % 2 === 0) {
										return v;
									} else {
										return process.env[v];
									}
								})
								.join('');
							value = process.env[actualName];
							if (value) {
								break;
							}
						}
						value = value || defaultValue;
						if (!hasSuffix && !value) {
							error(`
error: @@${toParse} was specified in the command but there is no env variable named ${varName}.
To prevent this error you can provide a default value with '@@${varName}@:<default value>@:'
An empty default can be specified with '@@${varName}@:@:'
              `);
						}
						return value + (suffix || '');
					})
					.join('');
				newArg = prefix + combined;
			} else {
				newArg = arg;
			}

			// Handle @= definitions like @=VAR=value
			if (newArg.startsWith('@=')) {
				const definition = newArg.slice(2).split('=');
				if (definition.length !== 2) {
					error(`
error: definitions need exactly 2 components, env variable name and value. '@=<var name>=<value>'
          `);
				}
				const envVarName = definition[0];
				const value = definition[1];
				process.env[envVarName] = value;
				return null; // skip it
			}
			return newArg;
		})
		.filter((v) => !!v) as string[];
	return newArgs;
}

/**
 * Parse multiple commands separated by ~~
 * Example: cmd1 arg1 ~~ cmd2 arg2 ~~ -> [{cmd1, [arg1]}, {cmd2, [arg2]}]
 */
export function parseMultipleCommands(args: string[]): ParsedCommands {
	let firstCommandArgs: string[] | undefined;
	let moreCommandArrays: string[][] = [];
	let buffer: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '~~') {
			if (!firstCommandArgs) {
				firstCommandArgs = buffer;
			} else {
				moreCommandArrays.push(buffer);
			}
			buffer = [];
		} else {
			buffer.push(arg);
		}
	}

	if (!firstCommandArgs) {
		firstCommandArgs = args;
	} else {
		if (buffer.length > 0) {
			for (const extraArg of buffer) {
				firstCommandArgs.push(extraArg);
			}
			buffer = [];
		}
	}

	const extraCommands: Array<{command: string; args: string[]}> = [];
	for (const arr of moreCommandArrays) {
		if (arr[0]) {
			extraCommands.push({
				command: arr[0],
				args: arr.slice(1),
			});
		}
	}

	return {firstCommandArgs, extraCommands};
}
