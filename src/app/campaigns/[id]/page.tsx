import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/supabase/server'
import type { DiceRollRow, Member } from '@/lib/types'
import { createSession } from './actions'
import { DiceRoller } from './dice-roller'
import { InitiativeTracker } from './initiative-tracker'
import { PartyBar } from './party-bar'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { id } = await params
    const { supabase } = await requireUser()
    const { data } = await supabase.from('campaigns').select('name').eq('id', id).maybeSingle()
    return { title: data?.name ?? 'Campaign' }
}

export default async function CampaignPage({ params }: Params) {
    const { id } = await params
    const { supabase, userId } = await requireUser()

    // RLS returns nothing for campaigns you're not a member of
    const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).maybeSingle()
    if (!campaign) notFound()

    const [{ data: memberRows }, { data: rolls }, { data: combatants }, { data: sessions }] = await Promise.all([
        supabase.from('campaign_members').select('user_id, role, character_name, profiles (display_name)').eq('campaign_id', id),
        supabase.from('dice_rolls').select('*').eq('campaign_id', id).order('created_at', { ascending: false }).limit(50),
        supabase.from('combatants').select('*').eq('campaign_id', id),
        supabase.from('sessions').select('id, title, played_on, recap').eq('campaign_id', id).order('played_on', { ascending: false }),
    ])

    const members: Member[] = (memberRows ?? [])
        .map((row) => ({
            user_id: row.user_id,
            role: row.role,
            character_name: row.character_name,
            display_name: row.profiles?.display_name ?? 'Adventurer',
        }))
        .sort((a, b) => Number(b.role === 'dm') - Number(a.role === 'dm'))

    const startSession = createSession.bind(null, id)

    return (
        <main className="mx-auto max-w-7xl px-4 py-8">
            <Link href="/campaigns" className="font-ui text-sm text-dust hover:text-white">
                ← All campaigns
            </Link>
            <h1 className="mt-2 font-heading text-4xl font-bold text-white sm:text-5xl">{campaign.name}</h1>
            {campaign.description && <p className="mt-1 max-w-3xl italic text-dust">{campaign.description}</p>}
            <div className="taper my-4 w-64" />
            <PartyBar campaignId={id} inviteCode={campaign.invite_code} members={members} currentUserId={userId} />

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
                <InitiativeTracker
                    campaignId={id}
                    initialCombatants={combatants ?? []}
                    initialTurn={{ activeId: campaign.active_combatant_id, round: campaign.round }}
                />
                <DiceRoller campaignId={id} initialRolls={(rolls ?? []) as DiceRollRow[]} />
            </div>

            <section className="panel mt-6 p-5" aria-labelledby="sessions-heading">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="sessions-heading" className="panel-title">
                        Session notes
                    </h2>
                    <form action={startSession} className="flex w-full gap-2 sm:w-auto">
                        <input name="title" placeholder="Session 4: The Amber Temple" maxLength={80} className="input sm:w-64" aria-label="New session title" />
                        <button className="btn btn-primary">New session</button>
                    </form>
                </div>
                <div className="taper my-3" />
                {sessions && sessions.length > 0 ? (
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sessions.map((session) => (
                            <li key={session.id}>
                                <Link
                                    href={`/campaigns/${id}/sessions/${session.id}`}
                                    className="block border border-line bg-ink/60 p-4 transition hover:border-gold"
                                >
                                    <p className="font-ui text-xs uppercase tracking-wider text-dust">
                                        {/* played_on is a plain date, so format it in UTC to avoid shifting a day */}
                                        {new Date(session.played_on).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                                    </p>
                                    <p className="mt-1 font-heading text-xl font-bold text-gold-light">{session.title}</p>
                                    <p className="mt-1 line-clamp-2 text-sm text-dust">{session.recap || 'No recap yet.'}</p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="font-ui text-sm italic text-dust">
                        No sessions yet. Start one to take notes while you play, then turn them into a recap.
                    </p>
                )}
            </section>
        </main>
    )
}
