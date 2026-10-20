import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

// Browser client for client components (realtime subscriptions, live updates).
export function createClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    )
}
