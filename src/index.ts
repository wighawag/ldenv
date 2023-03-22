/**
 * This module exposes a single function as default export
 *
 * @module dotenv-set
 */

import {parse} from 'dotenv';
import {expand} from 'dotenv-expand';
import fs from 'node:fs';
import {lookupFile} from './utils';

/**
 * Configuration Options
 */
export type Config = {
	/** The mode will specify which file to load.
	 * by default it will only load `.env` and `.env.local` with `.env.local` taking priority.
	 *
	 * If a specific mode is provided, it will load them in this order (latter one override the earlier ones):
	 * - `.env`
	 * - `.env.local`
	 * - `.env.<mode>`
	 * - `.env.<mode>.local`
	 *
	 * @remarks if `mode === 'local'` then it will just load `.env` and `env.local`
	 */
	mode?: string;
	/** This let you specify a specific folder to load the .env file from.
	 * By default it use the current directory */
	folder?: string;
	/** This let you specify the env variable it uses to detect the mode, if not specified in the options.
	 * By default it take the mode from the env variable 'MODE'
	 * It can also be a list of string and it will take the first one that is defined
	 */
	useModeEnv?: string | string[];
};

type ResolvedConfig = Config & {folder: string; useModeEnv: string | string[]};

/**
 * Uses [dotenv](https://github.com/motdotla/dotenv) and [dotenv-expand](https://github.com/motdotla/dotenv-expand) to load additional environment variables from the following files in your environment directory:
 *
 * ```
 * .env                # loaded in all cases
 * .env.local          # loaded in all cases, ignored by git
 * .env.[mode]         # only loaded in specified mode
 * .env.[mode].local   # only loaded in specified mode, ignored by git
 * ```
 *
 * @example
 * ```ts
 * import loadEnv from 'dotenv-set';
 * loadEnv();
 * ```
 * @example
 * ```ts
 * import loadEnv from 'dotenv-set';
 * loadEnv({mode: 'production'});
 * ```
 *
 * @param config - The configuration optiom
 * @returns The parsed env variable
 */
export default function loadEnv(config?: Config): Record<string, string> {
	const resolvedConfig: ResolvedConfig = {folder: '', useModeEnv: 'MODE', ...config};
	let {mode, folder, useModeEnv} = resolvedConfig;
	if (!mode) {
		if (typeof useModeEnv === 'string') {
			mode = process.env[useModeEnv];
		} else {
			for (const variable of useModeEnv) {
				mode = process.env[variable];
				if (mode) {
					break;
				}
			}
		}
	}
	const env: Record<string, string> = {};
	const envFiles = [/** default file */ `.env`, /** local file */ `.env.local`];
	if (mode && mode !== 'local') {
		envFiles.push(/** mode file */ `.env.${mode}`, /** mode local file */ `.env.${mode}.local`);
	}

	const parsed = Object.fromEntries(
		envFiles.flatMap((file) => {
			const path = lookupFile(folder, [file], {
				pathOnly: true,
				rootDir: folder,
			});
			if (!path) return [];
			return Object.entries(parse(fs.readFileSync(path)));
		})
	);

	// let environment variables use each other and set them to process.env
	expand({parsed});

	for (const [key, value] of Object.entries(parsed)) {
		env[key] = value;
	}
	// return the resulting parsed env
	return env;
}
