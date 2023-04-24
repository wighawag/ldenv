#!/usr/bin/sh
import { loadEnv } from '.';
import { parse as dotenvParse } from 'dotenv';
import fs from 'fs';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);

function error(msg: string) {
  console.error(msg);
  process.exit(1);
}

let env_mode_name: string | undefined;
try {
  const parsed = dotenvParse(fs.readFileSync(".env", { encoding: 'utf-8' }));
  Object.entries(parsed).forEach(function ([key, value]) {
    if (key === 'ENV_MODE') {
      env_mode_name = value;
    }
  });

} catch { }
try {
  const parsed2 = dotenvParse(fs.readFileSync(".env.local", { encoding: 'utf-8' }));
  Object.entries(parsed2).forEach(function ([key, value]) {
    if (key === 'ENV_MODE') {
      env_mode_name = value;
    }
  });
} catch { }

let parse = true;
let mode: string | undefined;
env_mode_name = process.env["ENV_MODE"] || env_mode_name || 'MODE';
let commandArgs: string[] = [];
let command: string | undefined;
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


const newArgs = commandArgs.map((arg) => {
  const [prefix, ...list_to_parse] = arg.split('@@');
  if (list_to_parse.length > 0) {
    const combined = list_to_parse.map((to_parse) => {
      const [var_name, potential_default_value, potential_suffix] = to_parse.split('@:');

      const hasSuffix = typeof potential_suffix !== "undefined";
      const suffix = hasSuffix ? potential_suffix : potential_default_value;
      const default_value = hasSuffix ? potential_default_value : undefined;

      const var_names = var_name.split(",");

      let value;
      for (const name of var_names) {
        const splitted_by_colon = name.split(":");
        // console.log({ splitted_by_colon })
        const actual_name = splitted_by_colon.map((v, index) => {
          if (index % 2 == 0) {
            return v;
          } else {
            return process.env[v];
          }
        }).join("");
        // console.log({ actual_name })
        value = process.env[actual_name];
        if (value) {
          break;
        }
      }
      value = value || default_value;
      if (!value) {
        error(`
        error: @@${to_parse} was specified in the command but there is no env variable named ${var_name}.
        To prevent this error you can provide a default value with '@@${var_name}@:<default value>@:'
        An empty default can be specified with '@@${var_name}@:@:'
        `);
      }
      // console.log({ prefix, var_name, default_value, suffix, value })
      return value + (suffix || "");
    }).join("");
    return prefix + combined;
  } else {
    return arg;
  }
});


execFileSync(command!, newArgs, { stdio: ['inherit', 'inherit', 'inherit'] });
