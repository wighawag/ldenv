#!/usr/bin/env node
import { loadEnv } from '.';
import { parse as dotenvParse } from 'dotenv';
import fs from 'fs';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);

function error(msg: string) {
  console.error(msg);
  process.exit(1);
}

// we first get the ENV_MODE name
// we get from the environment if there else we get from the .env and .env.local
let env_mode_name = process.env["ENV_MODE"];
if (!env_mode_name) {
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

}
// we fallback on MODE
env_mode_name = env_mode_name || 'MODE';


let mode = process.env[env_mode_name];
let parse = true;
let commandArgs: string[] = [];
let command: string | undefined;
// basic arg parsing (no long form)
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

// now we process each arg in turn to find the lone @@
// this allow executor to specify the mode via a simple arg at any position
for (let i = 0; i < commandArgs.length; i++) {
  const arg = commandArgs[i];
  if (arg === '@@') {
    const nextArg = commandArgs[i + 1];
    if (!mode && typeof nextArg === "undefined") {
      error(`error: expect to be provided a mode (which set the ${env_mode_name} env variable) as last argument`);
    }
    mode = nextArg;
    commandArgs.splice(i, 2);
    i--;
  }
}

if (mode?.length === 0) {
  error(`error: mode has been specified as argument, but it is empty`);
}


// we are now ready to load the environment
loadEnv({
  mode
});

// we set env_mode_name to get the mode
process.env[env_mode_name] = mode;


const newArgs = commandArgs.map((arg) => {
  const [prefix, ...list_to_parse] = arg.split('@@');
  if (list_to_parse.length > 0) {
    // if there are ny @@ we process them in turn
    // we also ensure we save the prefix (could be "")
    // Note that ldenv will not allow you to use @@
    // TODO allow to escape  @@
    const combined = list_to_parse.map((to_parse) => {
      // we get the var_name as first value by splitting via '@:'
      // the rest is the default value / suffix pair
      const [var_name, potential_default_value, potential_suffix] = to_parse.split('@:');

      if (var_name.length === 0) {
        error(`error: this is not valid : '@@${to_parse}' please specify an ENV var name after '@@'`);
      }


      const hasSuffix = typeof potential_suffix !== "undefined";
      const suffix = hasSuffix ? potential_suffix : potential_default_value;
      const default_value = hasSuffix ? potential_default_value : undefined;

      // fallback var_name is allowed, they are separated by ","
      const var_names = var_name.split(",");

      let value;
      for (const name of var_names) {
        // each of these var_name can be composed of other env value (no recursion, just one level)
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
          // if we find one of the comma separated list matching, we exit
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
