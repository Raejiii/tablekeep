'use client'

import { useActionState } from 'react'
import { createCampaign, joinCampaign, type FormState } from './actions'

const initial: FormState = { error: null }

function ErrorNote({ error }: { error: string | null }) {
    if (!error) return null
    return (
        <p role="alert" className="border-l-4 border-blood bg-blood/10 px-3 py-2 font-ui text-sm">
            {error}
        </p>
    )
}

export function CreateCampaignForm() {
    const [state, action, pending] = useActionState(createCampaign, initial)
    return (
        <form action={action} className="panel flex flex-col gap-3 p-5">
            <h2 className="panel-title">Start a campaign</h2>
            <p className="font-ui text-sm text-dust">You&apos;ll be the dungeon master and get an invite code for your players.</p>
            <div>
                <label htmlFor="name" className="label">
                    Campaign name
                </label>
                <input id="name" name="name" required maxLength={80} className="input" placeholder="Curse of Strahd" />
            </div>
            <div>
                <label htmlFor="description" className="label">
                    Description (optional)
                </label>
                <textarea id="description" name="description" maxLength={500} rows={2} className="input resize-y" />
            </div>
            <ErrorNote error={state.error} />
            <button className="btn btn-primary" disabled={pending}>
                {pending ? 'Creating…' : 'Create campaign'}
            </button>
        </form>
    )
}

export function JoinCampaignForm() {
    const [state, action, pending] = useActionState(joinCampaign, initial)
    return (
        <form action={action} className="panel flex flex-col gap-3 p-5">
            <h2 className="panel-title">Join with a code</h2>
            <div className="grid grid-cols-[1fr_1.4fr] gap-3">
                <div>
                    <label htmlFor="code" className="label">
                        Invite code
                    </label>
                    <input
                        id="code"
                        name="code"
                        required
                        maxLength={6}
                        className="input uppercase tracking-[0.3em]"
                        placeholder="AB12CD"
                        autoComplete="off"
                    />
                </div>
                <div>
                    <label htmlFor="characterName" className="label">
                        Your character
                    </label>
                    <input id="characterName" name="characterName" maxLength={60} className="input" placeholder="Thalia the Bard" />
                </div>
            </div>
            <ErrorNote error={state.error} />
            <button className="btn btn-outline" disabled={pending}>
                {pending ? 'Joining…' : 'Join campaign'}
            </button>
        </form>
    )
}
