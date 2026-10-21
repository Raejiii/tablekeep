import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const FEATURES = [
    {
        title: 'Live dice',
        body: 'Roll anything from d20 to 4d6kh3. Every roll appears instantly for the whole party, so nobody fudges a saving throw.',
    },
    {
        title: 'Initiative tracker',
        body: 'Add the party and the monsters, track HP, and step through turns. Everyone at the table sees the same order in real time.',
    },
    {
        title: 'Session recaps',
        body: 'Jot notes during the session and turn them into a "previously on…" recap, ready to read out next week.',
    },
]

export default async function Home() {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    if (data?.claims?.sub) redirect('/campaigns')

    return (
        <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
            <p className="eyebrow">D&amp;D campaign companion</p>
            <h1 className="mt-3 max-w-3xl font-heading text-5xl font-bold leading-none text-white sm:text-7xl">
                Keep your whole table in sync.
            </h1>
            <div className="taper my-6 w-72" />
            <p className="max-w-2xl text-xl italic text-dust">
                Tablekeep gives your group shared dice, a live initiative tracker and session notes that turn
                themselves into recaps. Open it on a laptop at the table or on your phone over Discord.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login?mode=signup" className="btn btn-primary">
                    Start a campaign
                </Link>
                <Link href="/login" className="btn btn-outline">
                    Sign in
                </Link>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-3">
                {FEATURES.map((feature) => (
                    <article key={feature.title} className="panel p-5">
                        <h2 className="panel-title">{feature.title}</h2>
                        <div className="taper my-3" />
                        <p className="text-dust">{feature.body}</p>
                    </article>
                ))}
            </div>
        </main>
    )
}
