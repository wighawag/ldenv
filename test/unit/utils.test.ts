import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {lookupFile, lookupMultipleFiles} from '../../src/utils';
import {setupTestEnv, createTempDir, createEnvFile, cleanupTempDir} from '../setup';
import path from 'node:path';

setupTestEnv();

describe('utils', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTempDir();
		process.chdir(tmpDir);
	});

	afterEach(() => {
		cleanupTempDir(tmpDir);
	});

	describe('lookupFile', () => {
		it('should find file in current directory', () => {
			createEnvFile(tmpDir, '.env', 'KEY=value');

			const result = lookupFile('.', ['.env'], {rootDir: tmpDir});

			expect(result).toBe('KEY=value');
		});

		it('should return undefined when file not found', () => {
			const result = lookupFile('.', ['.env'], {rootDir: tmpDir});

			expect(result).toBeUndefined();
		});

		it('should find first matching format', () => {
			createEnvFile(tmpDir, '.env.local', 'LOCAL=true');

			const result = lookupFile('.', ['.env', '.env.local'], {rootDir: tmpDir});

			expect(result).toBe('LOCAL=true');
		});

		it('should prefer first format in list when both exist', () => {
			createEnvFile(tmpDir, '.env', 'BASE=true');
			createEnvFile(tmpDir, '.env.local', 'LOCAL=true');

			const result = lookupFile('.', ['.env', '.env.local'], {rootDir: tmpDir});

			expect(result).toBe('BASE=true');
		});

		it('should return path when pathOnly option is true', () => {
			createEnvFile(tmpDir, '.env', 'KEY=value');

			const result = lookupFile('.', ['.env'], {pathOnly: true, rootDir: tmpDir});

			expect(result).toBe(path.join('.', '.env'));
		});

		it('should look up in parent directory', () => {
			const childDir = path.join(tmpDir, 'child');
			createEnvFile(tmpDir, '.env', 'PARENT=value');
			createEnvFile(childDir, '.gitkeep', '');
			process.chdir(childDir);

			const result = lookupFile('.', ['.env']);

			expect(result).toBe('PARENT=value');
		});

		it('should respect rootDir option', () => {
			const childDir = path.join(tmpDir, 'child');
			const grandchildDir = path.join(childDir, 'grandchild');
			createEnvFile(tmpDir, '.env', 'ROOT=value');
			createEnvFile(childDir, '.gitkeep', '');
			createEnvFile(grandchildDir, '.gitkeep', '');
			process.chdir(grandchildDir);

			// With rootDir set to child, it should not find .env in tmpDir
			const result = lookupFile('.', ['.env'], {rootDir: childDir});

			expect(result).toBeUndefined();
		});

		it('should use predicate to filter results', () => {
			createEnvFile(tmpDir, '.env', 'WRONG=value');

			const result = lookupFile('.', ['.env'], {
				predicate: (content) => content.includes('RIGHT'),
			});

			expect(result).toBeUndefined();
		});

		it('should return content that passes predicate', () => {
			createEnvFile(tmpDir, '.env', 'RIGHT=value');

			const result = lookupFile('.', ['.env'], {
				predicate: (content) => content.includes('RIGHT'),
			});

			expect(result).toBe('RIGHT=value');
		});
	});

	describe('lookupMultipleFiles', () => {
		it('should find file in current directory', () => {
			createEnvFile(tmpDir, '.env', 'KEY=value');

			const results = lookupMultipleFiles('.', ['.env'], {rootDir: tmpDir});

			expect(results).toHaveLength(1);
			expect(results[0]).toBe('KEY=value');
		});

		it('should return empty array when file not found', () => {
			const results = lookupMultipleFiles('.', ['.env'], {rootDir: tmpDir});

			expect(results).toEqual([]);
		});

		it('should find files in both current and parent directories', () => {
			const childDir = path.join(tmpDir, 'child');
			createEnvFile(tmpDir, '.env', 'PARENT=value');
			createEnvFile(childDir, '.env', 'CHILD=value');
			process.chdir(childDir);

			const results = lookupMultipleFiles('.', ['.env'], {rootDir: tmpDir});

			expect(results).toHaveLength(2);
			// First found is child, then parent
			expect(results[0]).toBe('CHILD=value');
			expect(results[1]).toBe('PARENT=value');
		});

		it('should return paths when pathOnly option is true', () => {
			createEnvFile(tmpDir, '.env', 'KEY=value');

			const results = lookupMultipleFiles('.', ['.env'], {pathOnly: true, rootDir: tmpDir});

			expect(results).toHaveLength(1);
			expect(results[0]).toBe(path.join('.', '.env'));
		});

		it('should respect rootDir option', () => {
			const childDir = path.join(tmpDir, 'child');
			const grandchildDir = path.join(childDir, 'grandchild');
			createEnvFile(tmpDir, '.env', 'ROOT=value');
			createEnvFile(childDir, '.env', 'CHILD=value');
			createEnvFile(grandchildDir, '.env', 'GRANDCHILD=value');
			process.chdir(grandchildDir);

			// With rootDir set to child, it should find in grandchild and child, but not root
			const results = lookupMultipleFiles('.', ['.env'], {rootDir: childDir});

			expect(results).toHaveLength(2);
			expect(results[0]).toBe('GRANDCHILD=value');
			expect(results[1]).toBe('CHILD=value');
		});

		it('should use predicate to filter results', () => {
			const childDir = path.join(tmpDir, 'child');
			createEnvFile(tmpDir, '.env', 'PARENT=value');
			createEnvFile(childDir, '.env', 'CHILD=value');
			process.chdir(childDir);

			const results = lookupMultipleFiles('.', ['.env'], {
				predicate: (content) => content.includes('PARENT'),
			});

			expect(results).toHaveLength(1);
			expect(results[0]).toBe('PARENT=value');
		});
	});
});
