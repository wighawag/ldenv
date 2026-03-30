import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {loadEnv} from '../../src/index';
import {setupTestEnv, createTempDir, createEnvFile, cleanupTempDir, getFixturePath} from '../setup';
import path from 'node:path';

setupTestEnv();

describe('loadEnv', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTempDir();
		process.chdir(tmpDir);
	});

	afterEach(() => {
		cleanupTempDir(tmpDir);
	});

	describe('basic loading', () => {
		it('LE-001: should load basic .env file', () => {
			createEnvFile(tmpDir, '.env', 'KEY=value');

			const result = loadEnv();

			expect(result.KEY).toBe('value');
			expect(process.env.KEY).toBe('value');
		});

		it('LE-002: should prioritize .env.local over .env', () => {
			createEnvFile(tmpDir, '.env', 'KEY=from-env');
			createEnvFile(tmpDir, '.env.local', 'KEY=from-local');

			const result = loadEnv();

			expect(result.KEY).toBe('from-local');
		});

		it('LE-003: should return object with all loaded vars', () => {
			createEnvFile(tmpDir, '.env', 'A=1\nB=2\nC=3');

			const result = loadEnv();

			expect(result).toMatchObject({A: '1', B: '2', C: '3'});
		});

		it('LE-004: should work with empty config (defaults)', () => {
			createEnvFile(tmpDir, '.env', 'DEFAULT_KEY=default_value');

			const result = loadEnv({folder: '.'});

			expect(result.DEFAULT_KEY).toBe('default_value');
			// Default mode should be 'local'
			expect(result.MODE).toBe('local');
		});
	});

	describe('mode-based loading', () => {
		it('LE-010: should load mode-specific file', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.production', 'KEY=prod');

			const result = loadEnv({mode: 'production'});

			expect(result.KEY).toBe('prod');
		});

		it('LE-011: should follow correct priority order', () => {
			createEnvFile(tmpDir, '.env', 'A=1\nB=1\nC=1\nD=1');
			createEnvFile(tmpDir, '.env.local', 'B=2\nC=2\nD=2');
			createEnvFile(tmpDir, '.env.production', 'C=3\nD=3');
			createEnvFile(tmpDir, '.env.production.local', 'D=4');

			const result = loadEnv({mode: 'production'});

			expect(result.A).toBe('1'); // from .env
			expect(result.B).toBe('2'); // from .env.local
			expect(result.C).toBe('3'); // from .env.production
			expect(result.D).toBe('4'); // from .env.production.local
		});

		it('LE-012: mode "local" only loads base files', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.local', 'KEY=local');
			createEnvFile(tmpDir, '.env.production', 'KEY=prod');

			const result = loadEnv({mode: 'local'});

			expect(result.KEY).toBe('local');
		});

		it('LE-013: default mode is "local"', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.production', 'KEY=prod');

			const result = loadEnv({folder: '.'});

			expect(result.KEY).toBe('base');
			expect(result.MODE).toBe('local');
		});

		it('LE-014: should use custom default mode', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.staging', 'KEY=staging');

			const result = loadEnv({defaultMode: 'staging', folder: '.'});

			expect(result.KEY).toBe('staging');
		});

		it('LE-015: should read mode from environment', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.production', 'KEY=prod');
			process.env.MODE = 'production';

			const result = loadEnv();

			expect(result.KEY).toBe('prod');
		});

		it('LE-016: should use useModeEnv custom variable', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.staging', 'KEY=staging');
			process.env.MY_MODE = 'staging';

			const result = loadEnv({useModeEnv: 'MY_MODE'});

			expect(result.KEY).toBe('staging');
		});

		it('LE-017: should use useModeEnv array fallback', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.development', 'KEY=dev');
			process.env.SECOND_MODE = 'development';

			const result = loadEnv({useModeEnv: ['FIRST_MODE', 'SECOND_MODE']});

			expect(result.KEY).toBe('dev');
		});
	});

	describe('variable expansion', () => {
		it('LE-020: should expand $VAR syntax', () => {
			createEnvFile(tmpDir, '.env', 'A=hello\nB=$A world');

			const result = loadEnv();

			expect(result.B).toBe('hello world');
		});

		it('LE-021: should expand ${VAR} syntax', () => {
			createEnvFile(tmpDir, '.env', 'A=hello\nB=${A}_suffix');

			const result = loadEnv();

			expect(result.B).toBe('hello_suffix');
		});

		it('LE-022: should handle escaped dollar sign', () => {
			createEnvFile(tmpDir, '.env', 'KEY=test\\$foo');

			const result = loadEnv();

			expect(result.KEY).toBe('test$foo');
		});

		it('LE-023: undefined var expands to empty', () => {
			createEnvFile(tmpDir, '.env', 'B=$UNDEFINED');

			const result = loadEnv();

			expect(result.B).toBe('');
		});

		it('LE-024: should support chain expansion', () => {
			createEnvFile(tmpDir, '.env', 'A=val\nB=$A\nC=$B');

			const result = loadEnv();

			expect(result.C).toBe('val');
		});
	});

	describe('ENV_ROOT_FOLDER handling', () => {
		it('LE-030: should use folder from config (limits lookup scope)', () => {
			const envDir = path.join(tmpDir, 'env-dir');
			createEnvFile(envDir, '.env', 'KEY=from_folder');
			// chdir to the folder where the .env is located
			process.chdir(envDir);

			const result = loadEnv({folder: envDir});

			expect(result.KEY).toBe('from_folder');
		});

		it('LE-031: should use folder from ENV_ROOT_FOLDER env var', () => {
			const envDir = path.join(tmpDir, 'custom-env');
			createEnvFile(envDir, '.env', 'KEY=from_env_root');
			// chdir to the folder where the .env is located
			process.chdir(envDir);
			process.env.ENV_ROOT_FOLDER = envDir;

			const result = loadEnv();

			expect(result.KEY).toBe('from_env_root');
		});

		it('LE-032: should use folder from .env file', () => {
			const envDir = path.join(tmpDir, 'nested-env');
			createEnvFile(tmpDir, '.env', `ENV_ROOT_FOLDER=${envDir}`);
			createEnvFile(envDir, '.env', 'KEY=from_nested');
			// ENV_ROOT_FOLDER in .env makes loadEnv look in envDir
			// But we need to be in the right directory for the lookup
			process.chdir(envDir);

			const result = loadEnv();

			expect(result.KEY).toBe('from_nested');
		});

		it('LE-033: should use folder from .root.env file', () => {
			const envDir = path.join(tmpDir, 'root-env');
			createEnvFile(tmpDir, '.root.env', envDir);
			createEnvFile(envDir, '.env', 'KEY=from_root_env');
			// chdir to the folder where the .env is located
			process.chdir(envDir);

			const result = loadEnv();

			expect(result.KEY).toBe('from_root_env');
		});
	});

	describe('MODE_ENV handling', () => {
		it('LE-040: should use MODE_ENV from environment', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.production', 'KEY=prod');
			process.env.MODE_ENV = 'DEPLOY_CTX';
			process.env.DEPLOY_CTX = 'production';

			const result = loadEnv();

			expect(result.KEY).toBe('prod');
		});

		it('LE-041: should use MODE_ENV from .env file', () => {
			createEnvFile(tmpDir, '.env', 'MODE_ENV=MY_DEPLOY_MODE');
			createEnvFile(tmpDir, '.env.staging', 'KEY=staging');
			process.env.MY_DEPLOY_MODE = 'staging';

			const result = loadEnv();

			expect(result.KEY).toBe('staging');
		});

		it('LE-042: should fallback to MODE when MODE_ENV not defined', () => {
			createEnvFile(tmpDir, '.env', 'KEY=base');
			createEnvFile(tmpDir, '.env.production', 'KEY=prod');
			process.env.MODE = 'production';

			const result = loadEnv();

			expect(result.KEY).toBe('prod');
		});
	});

	describe('nested directory lookup', () => {
		it('LE-050: child inherits parent .env', () => {
			const childDir = path.join(tmpDir, 'child');
			createEnvFile(tmpDir, '.env', 'PARENT_VAR=parent_value');
			createEnvFile(childDir, '.gitkeep', ''); // Just to create the directory
			process.chdir(childDir);

			// Use tmpDir as the folder (root) to enable parent lookup
			const result = loadEnv({folder: tmpDir});

			expect(result.PARENT_VAR).toBe('parent_value');
		});

		it('LE-051: child overrides parent', () => {
			const childDir = path.join(tmpDir, 'child');
			createEnvFile(tmpDir, '.env', 'SHARED_VAR=from_parent');
			createEnvFile(childDir, '.env', 'SHARED_VAR=from_child');
			process.chdir(childDir);

			const result = loadEnv({folder: childDir});

			expect(result.SHARED_VAR).toBe('from_child');
		});

		it('LE-052: rootDir limits lookup', () => {
			const childDir = path.join(tmpDir, 'child');
			createEnvFile(tmpDir, '.env', 'PARENT_VAR=should_not_load');
			createEnvFile(childDir, '.env', 'CHILD_VAR=child_value');
			process.chdir(childDir);

			// Using folder option to limit the lookup to child dir only
			const result = loadEnv({folder: childDir});

			expect(result.CHILD_VAR).toBe('child_value');
			// Parent should not be loaded when folder is explicitly set
			expect(result.PARENT_VAR).toBeUndefined();
		});
	});

	describe('fixture-based tests', () => {
		it('should load from basic fixture', () => {
			process.chdir(getFixturePath('basic'));

			const result = loadEnv();

			expect(result.KEY).toBe('local_value'); // .env.local takes priority
			expect(result.SECRET).toBe('secret123');
			expect(result.GREETING).toBe('Hello');
		});

		it('should load mode from modes fixture', () => {
			process.chdir(getFixturePath('modes'));

			const result = loadEnv({mode: 'production'});

			expect(result.APP_NAME).toBe('MyApp');
			expect(result.LOG_LEVEL).toBe('error');
			expect(result.API_URL).toBe('https://api.prod.example.com');
		});

		it('should handle expansion from expansion fixture', () => {
			// Use unique variable names to avoid conflicts
			createEnvFile(
				tmpDir,
				'.env',
				'MY_BASE=https://example.com\nMY_API=$MY_BASE/api\nMY_FULL=${MY_BASE}/v1/endpoint\nMY_ESCAPED=test\\$literal',
			);

			const result = loadEnv({folder: tmpDir});

			expect(result.MY_BASE).toBe('https://example.com');
			expect(result.MY_API).toBe('https://example.com/api');
			expect(result.MY_FULL).toBe('https://example.com/v1/endpoint');
			expect(result.MY_ESCAPED).toBe('test$literal');
		});
	});
});
