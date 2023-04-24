#!/usr/bin/sh
import {loadEnv} from '.';
import {execSync} from 'child_process';

const args = process.argv.slice(2);

function error(msg: string) {
	console.error(msg);
	process.exit(1);
}

let parse = true;
let mode;
let env_mode_name = 'MODE';
let commandArgs: string[] = [];
let command;
for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (!arg.startsWith('-')) {
		command = arg;
		commandArgs = args.slice(i + 1);
		break;
	} else {
		if (arg === '-m') {
			mode = args[i + 1];
			if (!env_mode_name) {
				error(`-m arg specified but no mode`);
			}
			i += 1;
		} else if (arg === '-n') {
			env_mode_name = args[i + 1];
			if (!env_mode_name) {
				error(`-n arg specified but no env var name`);
			}
			i += 1;
		} else if (arg === '-P') {
			parse = false;
		} else {
			error(`arg not recognized: ${arg}`);
		}
	}
}

if (!command) {
	error(`no command specified`);
}

for (let i = 0; i < commandArgs.length; i++) {
	const arg = commandArgs[i];
	if (arg === '@@') {
		mode = commandArgs[i + 1] || mode;
		if (!mode) {
			error(`mode not defined after finding @@`);
		}
		commandArgs.splice(i, 2);
		i--;
	}
}

loadEnv({
	mode,
	useModeEnv: env_mode_name,
});

process.env[env_mode_name] = mode;

execSync(command + (commandArgs ? ` ${commandArgs.join(' ')}` : ''), {stdio: ['inherit', 'inherit', 'inherit']});
