import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import { SessionEditor } from './session-editor'

type Params = { params: Promise<{ id: string; sessionId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { sessionId } = await params
    const { supabase } = await requireUser()
    const { data } = await supabase.from('sessions').select('title').eq('id', sessionId).maybeSingle()
    return { title: data?.title ?? 'Session' }
}

export default async function SessionPage({ params }: Params) {
    const { id, sessionId } = await params
    const { supabase } = await requireUser()

    const { data: session } = await supabase
        .from('sessions')
        .select('*, campaigns (name)')
        .eq('id', sessionId)
        .eq('campaign_id', id)
        .maybeSingle()
    if (!session) notFound()

    return (
        <main className="mx-auto max-w-6xl px-4 py-8">
            <Link href={`/campaigns/${id}`} className="font-ui text-sm text-dust hover:text-white">
                ← Back to {session.campaigns?.name ?? 'campaign'}
            </Link>
            <SessionEditor session={session} recapEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />
        </main>
    )
}
