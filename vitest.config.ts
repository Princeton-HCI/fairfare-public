import { defineConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared';

/**
 * The projects are defined in vitest.workspace.ts, which is what the CLI and the
 * editor integrations load. This file exists so that tooling reading a plain
 * vitest config still resolves the aliases and the jsdom environment.
 */
export default defineConfig(sharedConfig);
