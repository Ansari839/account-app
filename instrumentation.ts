/**
 * Next.js Instrumentation
 * Runs once when the server starts (Node.js runtime only).
 * Used to boot the cron backup engine.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startCronBackups } = await import('./lib/cron-backup');
        await startCronBackups();
    }
}
