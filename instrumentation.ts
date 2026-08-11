/**
 * Next.js Instrumentation
 * NOTE: node-cron is NOT used on Vercel (serverless).
 * Scheduled backups run via Vercel Cron Jobs → /api/cron/backup
 */
export async function register() {
    // Cron engine disabled for serverless environments (Vercel).
    // Use vercel.json cron configuration instead.
}
