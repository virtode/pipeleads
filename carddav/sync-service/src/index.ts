import 'dotenv/config'
import { initialSync } from './provision'
import { startSupabaseWatcher, startFileWatcher } from './sync'
import { createServer } from './server'

const PORT = parseInt(process.env.PORT ?? '3001', 10)

async function main(): Promise<void> {
  console.log('[carddav-sync] Starting...')

  // 1. Initial sync: write all existing contacts to Radicale filesystem
  await initialSync()

  // 2. Watch Radicale filesystem → push changes to Supabase
  startFileWatcher()

  // 3. Watch Supabase Realtime → write changes to Radicale filesystem
  startSupabaseWatcher()

  // 4. Start HTTP provisioning API
  const app = createServer()
  app.listen(PORT, () => {
    console.log(`[carddav-sync] Provisioning server listening on port ${PORT}`)
  })
}

main().catch((err) => {
  console.error('[carddav-sync] Fatal error:', err)
  process.exit(1)
})
