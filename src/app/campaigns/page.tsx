import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/supabase/server'
import { CreateCampaignForm, JoinCampaignForm } from './forms'

export const metadata: Metadata = { title: 'Campaigns' }

export default async function CampaignsPage() {
    const { supabase, userId } = await requireUser()

    const { data: memberships } = await supabase
        .from('campaign_members')
        .select('role, character_name, campaigns (id, name, description, created_at)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })

    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).single()

    return (
        <main className="mx-auto max-w-5xl px-4 py-10">
            <p className="eyebrow">Welcome, {profile?.display_name ?? 'adventurer'}</p>
            <h1 className="mt-2 font-heading text-5xl font-bold text-white">Your campaigns</h1>
            <div className="taper my-5 w-64" />

            <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
                <section aria-label="Campaign list" className="flex flex-col gap-4">
                    {memberships && memberships.length > 0 ? (
                        memberships.map(({ role, character_name, campaigns: campaign }) =>
                            campaign ? (
                                <Link
                                    key={campaign.id}
                                    href={`/campaigns/${campaign.id}`}
                                    className="panel block p-5 transition hover:-translate-y-0.5 hover:border-x-gold"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <h2 className="panel-title">{campaign.name}</h2>
                                        <span className="shrink-0 border border-line px-2 py-0.5 font-ui text-xs font-bold uppercase tracking-wider text-dust">
                                            {role === 'dm' ? 'Dungeon master' : character_name || 'Player'}
                                        </span>
                                    </div>
                                    {campaign.description && <p className="mt-2 text-dust">{campaign.description}</p>}
                                </Link>
                            ) : null,
                        )
                    ) : (
                        <div className="panel p-6 text-dust">
                            <p className="font-heading text-2xl text-gold-light">No campaigns yet</p>
                            <p className="mt-2">Start one as the DM, or join your group with the invite code they shared.</p>
                        </div>
                    )}
                </section>

                <aside className="flex flex-col gap-6">
                    <CreateCampaignForm />
                    <JoinCampaignForm />
                </aside>
            </div>
        </main>
    )
}
