// src/env-state.ts

/**
 * Manages environment state - captures base env before loading .env files
 * and can restore it to allow fresh reloads
 */
export class EnvStateManager {
	private baseEnv: Record<string, string | undefined> = {};
	private loadedKeys: Set<string> = new Set();

	/**
	 * Capture the current process.env as the "base" state
	 * Call this BEFORE loading any .env files
	 */
	captureBaseEnv(): void {
		this.baseEnv = {};
		for (const key of Object.keys(process.env)) {
			this.baseEnv[key] = process.env[key];
		}
	}

	/**
	 * Restore process.env to the captured base state
	 * Removes any keys that were added by .env loading
	 * Restores original values for keys that were overwritten
	 */
	restoreBaseEnv(): void {
		// Remove keys that were added after base capture
		for (const key of this.loadedKeys) {
			if (!(key in this.baseEnv)) {
				delete process.env[key];
			}
		}

		// Restore original values
		for (const [key, value] of Object.entries(this.baseEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}

		this.loadedKeys.clear();
	}

	/**
	 * Apply new environment variables and track which keys were added/modified
	 */
	applyEnv(env: Record<string, string>): void {
		for (const [key, value] of Object.entries(env)) {
			this.loadedKeys.add(key);
			process.env[key] = value;
		}
	}

	/**
	 * Get the captured base environment (for debugging/testing)
	 */
	getBaseEnv(): Record<string, string | undefined> {
		return {...this.baseEnv};
	}
}
