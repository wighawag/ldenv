import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {runCli, createTempDir, createEnvFile, cleanupTempDir, getFixturePath} from '../setup';

describe('CLI Integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe('basic arguments', () => {
    it('CLI-001: should parse command and run it', async () => {
      createEnvFile(tmpDir, '.env', 'GREETING=Hello');

      const result = await runCli(['echo', 'hello'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('hello');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-002: should parse -m mode flag', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=base');
      createEnvFile(tmpDir, '.env.production', 'KEY=prod');

      const result = await runCli(['-m', 'production', 'printenv', 'KEY'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('prod');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-003: should parse -d default mode flag', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=base');
      createEnvFile(tmpDir, '.env.staging', 'KEY=staging');

      // Clear MODE from env to ensure defaultMode is used
      const result = await runCli(['-d', 'staging', 'printenv', 'KEY'], {
        cwd: tmpDir,
        env: {MODE: ''},
      });

      expect(result.stdout.trim()).toBe('staging');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-004: should parse -n mode env name', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=base');
      createEnvFile(tmpDir, '.env.production', 'KEY=prod');

      const result = await runCli(['-n', 'MY_MODE', 'printenv', 'KEY'], {
        cwd: tmpDir,
        env: {MY_MODE: 'production'},
      });

      expect(result.stdout.trim()).toBe('prod');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-005: should parse -P no parsing flag', async () => {
      createEnvFile(tmpDir, '.env', 'VAR=test');

      const result = await runCli(['-P', 'echo', '@@VAR'], {cwd: tmpDir});

      // With -P, @@VAR should be passed literally
      expect(result.stdout.trim()).toBe('@@VAR');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-006: should parse --verbose flag', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['--verbose', 'echo', 'test'], {cwd: tmpDir});

      // Verbose output goes to stdout/stderr
      expect(result.stdout).toContain('test');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-008: should handle multiple flags', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=base');
      createEnvFile(tmpDir, '.env.production', 'KEY=prod');

      const result = await runCli(['-m', 'production', '--verbose', 'printenv', 'KEY'], {cwd: tmpDir});

      expect(result.stdout).toContain('prod');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('error cases', () => {
    it('CLI-010: should error on -m without value', async () => {
      const result = await runCli(['-m'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('-m');
    });

    it('CLI-011: should error on -d without value', async () => {
      const result = await runCli(['-d'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('-d');
    });

    it('CLI-012: should error on -n without value', async () => {
      const result = await runCli(['-n'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('-n');
    });

    it('CLI-013: should error on unknown flag', async () => {
      const result = await runCli(['--unknown', 'echo'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not recognized');
    });

    it('CLI-014: should error when no command specified', async () => {
      const result = await runCli(['-m', 'production'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('no command');
    });
  });

  describe('@@ mode in args', () => {
    it('CLI-020: @@ sets mode', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=base');
      createEnvFile(tmpDir, '.env.production', 'KEY=prod');

      const result = await runCli(['printenv', 'KEY', '@@', 'production'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('prod');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-021: @@ is removed from args', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=value');

      const result = await runCli(['echo', 'hello', '@@', 'local'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('hello');
      expect(result.stdout).not.toContain('@@');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-022: @@ with -- uses defaultMode', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=base');
      createEnvFile(tmpDir, '.env.staging', 'KEY=staging');

      const result = await runCli(['-d', 'staging', 'printenv', 'KEY', '@@', '--'], {
        cwd: tmpDir,
        env: {MODE: ''},
      });

      expect(result.stdout.trim()).toBe('staging');
      expect(result.exitCode).toBe(0);
    });

    it('CLI-023: @@ requires mode or default', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=value');

      const result = await runCli(['echo', 'test', '@@'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('mode');
    });
  });

  describe('@@ variable substitution', () => {
    it('VAR-001: should substitute simple variable', async () => {
      createEnvFile(tmpDir, '.env', 'GREET=Hello');

      const result = await runCli(['echo', '@@GREET'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('Hello');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-002: should substitute var with prefix', async () => {
      createEnvFile(tmpDir, '.env', 'GREET=Hello');

      const result = await runCli(['echo', 'pre-@@GREET'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('pre-Hello');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-003: should substitute multiple vars', async () => {
      createEnvFile(tmpDir, '.env', 'A=1\nB=2');

      const result = await runCli(['echo', '@@A', '@@B'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('1 2');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-004: should error on missing variable', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@@MISSING'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('MISSING');
    });
  });

  describe('default values', () => {
    it('VAR-010: should use default when missing', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@@MISSING@:default@:'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('default');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-011: should use empty default', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', 'prefix@@MISSING@:@:suffix'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('prefixsuffix');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-012: should not use default if var exists', async () => {
      createEnvFile(tmpDir, '.env', 'GREET=Hello');

      const result = await runCli(['echo', '@@GREET@:fallback@:'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('Hello');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-013: should use default with suffix', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@@MISSING@:val@:_suffix'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('val_suffix');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('fallback variables', () => {
    it('VAR-020: should fallback to second variable', async () => {
      createEnvFile(tmpDir, '.env', 'B=two');

      const result = await runCli(['echo', '@@A,B'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('two');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-021: first match wins', async () => {
      createEnvFile(tmpDir, '.env', 'A=one\nB=two');

      const result = await runCli(['echo', '@@A,B'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('one');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-022: all missing = error', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@@A,B,C'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
    });

    it('VAR-023: fallback with default', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@@A,B@:default@:'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('default');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('dynamic variable names', () => {
    it('VAR-030: var name from var', async () => {
      // Use a different var name than MODE to avoid conflicts
      createEnvFile(tmpDir, '.env', 'MY_ENV=prod\nVAL_prod=x');

      const result = await runCli(['echo', '@@VAL_:MY_ENV:'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('x');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-031: nested lookup', async () => {
      createEnvFile(tmpDir, '.env', 'A=test\nB_test=result');

      const result = await runCli(['echo', '@@B_:A:'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('result');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('@= definition syntax', () => {
    it('VAR-040: should define var inline', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@=MY_VAR=value', '@@MY_VAR'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('value');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-041: definition removed from args', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@=A=1', 'hello'], {cwd: tmpDir});

      expect(result.stdout.trim()).toBe('hello');
      expect(result.stdout).not.toContain('@=');
      expect(result.exitCode).toBe(0);
    });

    it('VAR-042: invalid definition should error', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@=INVALID'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
    });
  });

  describe('multiple commands (~~ syntax)', () => {
    it('SEQ-001: should run two commands sequentially', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', 'first', '~~', 'echo', 'second', '~~'], {cwd: tmpDir});

      expect(result.stdout).toContain('first');
      expect(result.stdout).toContain('second');
      expect(result.exitCode).toBe(0);
    });

    it('SEQ-002: should run three commands', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '1', '~~', 'echo', '2', '~~', 'echo', '3', '~~'], {cwd: tmpDir});

      expect(result.stdout).toContain('1');
      expect(result.stdout).toContain('2');
      expect(result.stdout).toContain('3');
      expect(result.exitCode).toBe(0);
    });

    it('SEQ-003: trailing ~~ is optional', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', 'first', '~~', 'echo', 'second'], {cwd: tmpDir});

      expect(result.stdout).toContain('first');
      // Without trailing ~~, second command args go to first
      expect(result.exitCode).toBe(0);
    });

    it('SEQ-010: first failure stops chain', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['false', '~~', 'echo', 'never', '~~'], {cwd: tmpDir});

      expect(result.stdout).not.toContain('never');
      expect(result.exitCode).toBe(1);
    });

    it('SEQ-011: success continues', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['true', '~~', 'echo', 'yes', '~~'], {cwd: tmpDir});

      expect(result.stdout).toContain('yes');
      expect(result.exitCode).toBe(0);
    });

    it('SEQ-012: exit code from last command', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', 'a', '~~', 'false', '~~'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
    });

    it('SEQ-020: vars substituted in both commands', async () => {
      createEnvFile(tmpDir, '.env', 'A=one\nB=two');

      const result = await runCli(['echo', '@@A', '~~', 'echo', '@@B', '~~'], {cwd: tmpDir});

      expect(result.stdout).toContain('one');
      expect(result.stdout).toContain('two');
      expect(result.exitCode).toBe(0);
    });

    it('SEQ-021: definition used in second command', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@=X=1', 'a', '~~', 'echo', '@@X', '~~'], {cwd: tmpDir});

      expect(result.stdout).toContain('a');
      expect(result.stdout).toContain('1');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('exit codes', () => {
    it('EXIT-001: success should exit 0', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['true'], {cwd: tmpDir});

      expect(result.exitCode).toBe(0);
    });

    it('EXIT-002: command failure should exit 1', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['false'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
    });

    it('EXIT-003: command not found should exit 1', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['nonexistent-command-xyz'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
    });

    it('EXIT-004: missing env var should exit 1', async () => {
      createEnvFile(tmpDir, '.env', '');

      const result = await runCli(['echo', '@@MISSING'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
    });

    it('EXIT-005: invalid args should exit 1', async () => {
      const result = await runCli(['-m'], {cwd: tmpDir});

      expect(result.exitCode).toBe(1);
    });
  });

  describe('--git flag', () => {
    it('GIT-003: should use VERCEL_GIT_COMMIT_REF', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=base');
      createEnvFile(tmpDir, '.env.feature', 'KEY=feature');

      const result = await runCli(['--git', 'printenv', 'KEY'], {
        cwd: tmpDir,
        env: {VERCEL_GIT_COMMIT_REF: 'feature', MODE: ''},
      });

      expect(result.stdout.trim()).toBe('feature');
      expect(result.exitCode).toBe(0);
    });

    it('GIT-004: should use BRANCH (Netlify)', async () => {
      createEnvFile(tmpDir, '.env', 'KEY=base');
      createEnvFile(tmpDir, '.env.deploy', 'KEY=deploy');

      const result = await runCli(['--git', 'printenv', 'KEY'], {
        cwd: tmpDir,
        env: {BRANCH: 'deploy', MODE: ''},
      });

      expect(result.stdout.trim()).toBe('deploy');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('fixture-based CLI tests', () => {
    it('should work with basic fixture', async () => {
      const fixturePath = getFixturePath('basic');

      const result = await runCli(['printenv', 'KEY'], {cwd: fixturePath});

      expect(result.stdout.trim()).toBe('local_value');
      expect(result.exitCode).toBe(0);
    });

    it('should work with modes fixture in production', async () => {
      const fixturePath = getFixturePath('modes');

      const result = await runCli(['-m', 'production', 'printenv', 'LOG_LEVEL'], {cwd: fixturePath});

      expect(result.stdout.trim()).toBe('error');
      expect(result.exitCode).toBe(0);
    });

    it('should work with modes fixture in development', async () => {
      const fixturePath = getFixturePath('modes');

      const result = await runCli(['-m', 'development', 'printenv', 'API_URL'], {cwd: fixturePath});

      expect(result.stdout.trim()).toBe('http://localhost:3000');
      expect(result.exitCode).toBe(0);
    });
  });
});
