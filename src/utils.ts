// taken from https://github.com/vitejs/vite/blob/63524bac878e8d3771d34ad7ad2e10cd16870ff4/packages/vite/src/node/utils.ts#L371-L400
import fs from 'node:fs';
import path from 'node:path';

interface LookupFileOptions {
	pathOnly?: boolean;
	rootDir?: string;
	predicate?: (file: string) => boolean;
}

export function lookupFile(dir: string, formats: string[], options?: LookupFileOptions): string | undefined {
	const dirFullPath = path.resolve(dir);
	for (const format of formats) {
		const fullPath = path.join(dir, format);
		if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
			const result = options?.pathOnly ? fullPath : fs.readFileSync(fullPath, 'utf-8');
			if (!options?.predicate || options.predicate(result)) {
				return result;
			}
		}
	}
	const parentDir = path.dirname(dirFullPath);
	if (parentDir !== dir && (!options?.rootDir || parentDir.startsWith(options?.rootDir))) {
		return lookupFile(parentDir, formats, options);
	}
}

function _lookupMultipleFiles(dir: string, formats: string[], files: string[], options?: LookupFileOptions): void {
	const dirFullPath = path.resolve(dir);
	for (const format of formats) {
		const fullPath = path.join(dir, format);
		if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
			const result = options?.pathOnly ? fullPath : fs.readFileSync(fullPath, 'utf-8');
			if (!options?.predicate || options.predicate(result)) {
				files.push(result);
			}
		}
	}
	const parentDir = path.dirname(dirFullPath);
	if (parentDir !== dir && (!options?.rootDir || parentDir.startsWith(options?.rootDir))) {
		_lookupMultipleFiles(parentDir, formats, files, options);
	}
}

export function lookupMultipleFiles(dir: string, formats: string[], options?: LookupFileOptions): string[] {
	const files: string[] = [];
	_lookupMultipleFiles(dir, formats, files, options);
	return files;
}
