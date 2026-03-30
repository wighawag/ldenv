// src/watcher.ts
import watcher, {AsyncSubscription} from '@parcel/watcher';
import path from 'node:path';
import fs from 'node:fs';
import {debounce} from 'lodash-es';

export interface WatcherOptions {
	debounceMs?: number;
}

/**
 * Watches .env files and triggers callback on changes
 */
export class EnvFileWatcher {
	private subscriptions: AsyncSubscription[] = [];
	private debouncedCallback: (() => void) | null = null;

	/**
	 * Start watching the specified files
	 * @param filePaths - Absolute paths to .env files to watch
	 * @param onChange - Callback to invoke when any file changes
	 * @param options - Watcher options
	 */
	async watch(
		filePaths: string[],
		onChange: () => void,
		options: WatcherOptions = {},
	): Promise<void> {
		const debounceMs = options.debounceMs ?? 200;
		this.debouncedCallback = debounce(onChange, debounceMs);

		// Get unique directories containing the files
		const directories = new Set<string>();
		for (const filePath of filePaths) {
			directories.add(path.dirname(filePath));
		}

		// Also watch for .env files that might be created later
		// (e.g., .env.local might not exist initially)
		const cwd = process.cwd();
		directories.add(cwd);

		// Create a set of file basenames we care about for quick lookup
		const watchedBasenames = new Set(filePaths.map((f) => path.basename(f)));
		// Add common .env patterns that might be created
		watchedBasenames.add('.env');
		watchedBasenames.add('.env.local');

		for (const dir of directories) {
			await this.subscribeToDirectory(dir, watchedBasenames);
		}
	}

	private async subscribeToDirectory(
		directory: string,
		watchedBasenames: Set<string>,
	): Promise<void> {
		if (!fs.existsSync(directory)) {
			return;
		}

		const subscription = await watcher.subscribe(directory, (err, events) => {
			if (err) {
				console.error('Watcher error:', err);
				return;
			}

			for (const event of events) {
				const basename = path.basename(event.path);
				// Check if this is an .env file we care about
				if (watchedBasenames.has(basename) || basename.startsWith('.env')) {
					console.log(`[ldenv] ${basename} changed, reloading...`);
					this.debouncedCallback?.();
					break; // Only trigger once per batch of events
				}
			}
		});

		this.subscriptions.push(subscription);
	}

	/**
	 * Stop all file watchers
	 */
	async unsubscribe(): Promise<void> {
		for (const subscription of this.subscriptions) {
			await subscription.unsubscribe();
		}
		this.subscriptions = [];
	}
}
