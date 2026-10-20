'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Member } from '@/lib/types'

type Props = {
    campaignId: string
    inviteCode: string
    members: Member[]
    currentUserId: string
}

export function PartyBar({ campaignId, inviteCode, members, currentUserId }: Props) {
    const router = useRouter()
    const [online, setOnline] = useState<Set<string>>(new Set([currentUserId]))
    const [copied, setCopied] = useState(false)

    // presence: who has the campaign open right now
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase.channel(`presence:${campaignId}`, { config: { presence: { key: currentUserId } } })
        channel
            .on('presence', { event: 'sync' }, () => {
                setOnline(new Set(Object.keys(channel.presenceState())))
            })
            // someone joined or left the campaign: reload the member list from the server
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'campaign_members', filter: `campaign_id=eq.${campaignId}` },
                () => router.refresh(),
            )
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') await channel.track({ at: new Date().toISOString() })
            })
        return () => {
            supabase.removeChannel(channel)
        }
    }, [campaignId, currentUserId, router])

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(inviteCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
        } catch {
            // clipboard can be blocked; the code is visible on screen anyway
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ul className="flex flex-wrap items-center gap-2" aria-label="Party">
                {members.map((member) => {
                    const isOnline = online.has(member.user_id)
                    return (
                        <li
                            key={member.user_id}
                            className="flex items-center gap-2 border border-line bg-ink/70 px-2.5 py-1 font-ui text-sm"
                            title={isOnline ? 'At the table now' : 'Away'}
                        >
                            <span
                                aria-hidden
                                className={`size-2 rounded-full ${isOnline ? 'bg-heal shadow-[0_0_6px] shadow-heal' : 'bg-line'}`}
                            />
                            <span className="font-bold">{member.character_name || member.display_name}</span>
                            {member.role === 'dm' && <span className="text-xs uppercase tracking-wider text-gold-light">DM</span>}
                            <span className="sr-only">{isOnline ? '(online)' : '(away)'}</span>
                        </li>
                    )
                })}
            </ul>
            <button onClick={copyCode} className="ml-auto flex items-center gap-2 font-ui text-sm text-dust hover:text-white">
                Invite code
                <span className="border border-gold/60 bg-ink px-2.5 py-1 font-bold tracking-[0.3em] text-gold-light">{inviteCode}</span>
                <span className="w-12 text-left text-xs">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
        </div>
    )
}
