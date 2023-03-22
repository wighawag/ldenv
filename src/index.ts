import {parse} from 'dotenv';
import {expand} from 'dotenv-expand';
import fs from 'node:fs';
import {lookupFile} from './utils';

export function loadEnv(mode?: string, envDir: string = ''): Record<string, string> {
	if (!mode) {
		mode = process.env.MODE;
	}
	const env: Record<string, string> = {};
	const envFiles = [/** default file */ `.env`, /** local file */ `.env.local`];
	if (mode && mode !== 'local') {
		envFiles.push(/** mode file */ `.env.${mode}`, /** mode local file */ `.env.${mode}.local`);
	}

	const parsed = Object.fromEntries(
		envFiles.flatMap((file) => {
			const path = lookupFile(envDir, [file], {
				pathOnly: true,
				rootDir: envDir,
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
