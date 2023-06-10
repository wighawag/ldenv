This module is both a module to be imported and a command line utility that load environment variables from dot env files

# Use as a command-line

ldenv is a simple yet very powerful command line tool

Its basic purpose is to load .env file and execute a command with the environment set for it

Basic usage:

```bash
ldenv <command> [...args]
```

This will provide to `command` the environment variable set in the `.env`, `.env.local`, etc... (see [#import-as-module](#import-as-module) for details.

ldenv also support resolving variable in the command and args provided.

the following will display the content of the environment variable "GREETINGS" if it is defined in one of the `.env` files

```bash
ldenv echo @@GREETINGS
```

contract with what using the shell (where GREETINGS will not be resolved unless the dotenv file was inject in the environment to begin with):

```bash
ldenv echo $GREETINGS
```

# Import As Module

This module expose a single function that uses [dotenv](https://github.com/motdotla/dotenv) and [dotenv-expand](https://github.com/motdotla/dotenv-expand) to load additional environment variables from the following files in your environment directory:

```
.env                # loaded in all cases
.env.local          # loaded in all cases, ignored by git
.env.[mode]         # only loaded in specified mode
.env.[mode].local   # only loaded in specified mode, ignored by git
```

> Env Loading Priorities
>
> An env file for a specific mode (e.g. `.env.production`) will take higher priority than a generic one (e.g. `.env`).
>
> In addition, environment variables that already exist when the function is executed have the highest priority and will not be overwritten by `.env` files.
>
> `.env` files are loaded at soon as the function is invoked.

Also, because the module also uses [dotenv-expand](https://github.com/motdotla/dotenv-expand) it expand variables out of the box. To learn more about the syntax, check out their docs.

Note that if you want to use $ inside your environment value, you have to escape it with `\.`

```
KEY=123
NEW_KEY1=test$foo   # test
NEW_KEY2=test\$foo  # test$foo
NEW_KEY3=test$KEY   # test123
```

> SECURITY NOTES
>
> `.env.*.local` files are local-only and can contain sensitive variables. You should add `*.local` to your `.gitignore` to avoid them being checked into git.
