import {beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Store original env to restore after each test
let originalEnv: NodeJS.ProcessEnv;
let originalCwd: string;

export function setupTestEnv() {
  beforeEach(() => {
    originalEnv = {...process.env};
    originalCwd = process.cwd();
    // Clear MODE and related vars that might interfere with tests
    delete process.env.MODE;
    delete process.env.MODE_ENV;
    delete process.env.ENV_ROOT_FOLDER;
  });

  afterEach(() => {
    // Restore original environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
    process.chdir(originalCwd);
  });
}

// Helper to create temporary .env files
export function createEnvFile(dir: string, filename: string, content: string): string {
  const filepath = path.join(dir, filename);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(filepath, content);
  return filepath;
}

// Helper to run CLI and capture output
export function runCli(
  args: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
  }
): Promise<{stdout: string; stderr: string; exitCode: number}> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(__dirname, '../dist/cli.cjs');
    const proc = spawn('node', [cliPath, ...args], {
      cwd: options?.cwd || process.cwd(),
      env: {...process.env, ...options?.env},
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({stdout, stderr, exitCode: code ?? 0});
    });
  });
}

// Helper to create a temp directory for test fixtures
export function createTempDir(): string {
  const tmpDir = path.join(
    __dirname,
    '.tmp',
    `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  fs.mkdirSync(tmpDir, {recursive: true});
  return tmpDir;
}

// Helper to clean up temp directories
export function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, {recursive: true, force: true});
}

// Helper to get fixture path
export function getFixturePath(fixtureName: string): string {
  return path.join(__dirname, 'fixtures', fixtureName);
}
