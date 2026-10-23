// Convenience entry point for the current keyboard driver; old mouse evidence is historical.
process.argv.push('--return');
await import('./drive.mjs');
