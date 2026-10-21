import type { Metadata } from 'next'
import { Cormorant_SC, Crimson_Pro, Roboto_Condensed } from 'next/font/google'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from './login/actions'
import './globals.css'

const cormorant = Cormorant_SC({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cormorant' })
const crimson = Crimson_Pro({
    subsets: ['latin'],
    weight: ['400', '600'],
    style: ['normal', 'italic'],
    variable: '--font-crimson',
})
const robotoCondensed = Roboto_Condensed({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    variable: '--font-roboto-condensed',
})

export const metadata: Metadata = {
    title: { default: 'Tablekeep | D&D campaign companion', template: '%s | Tablekeep' },
    description: 'Live dice, initiative tracking and session recaps for your D&D table.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    const signedIn = Boolean(data?.claims?.sub)

    return (
        <html lang="en" className={`${cormorant.variable} ${crimson.variable} ${robotoCondensed.variable}`}>
            <body>
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-[3px] border-blood bg-[#08090b] px-4 sm:px-8">
                    <Link
                        href={signedIn ? '/campaigns' : '/'}
                        className="flex items-center gap-2.5 font-ui text-base font-bold uppercase tracking-wider text-white"
                    >
                        <span
                            aria-hidden
                            className="grid size-8 place-items-center bg-blood font-heading text-xl [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
                        >
                            T
                        </span>
                        Tablekeep
                    </Link>
                    <nav className="flex items-center gap-4 font-ui text-sm uppercase tracking-wider text-dust">
                        {signedIn ? (
                            <>
                                <Link href="/campaigns" className="hover:text-white">
                                    Campaigns
                                </Link>
                                <form action={signOut}>
                                    <button className="cursor-pointer uppercase tracking-wider hover:text-white">
                                        Sign out
                                    </button>
                                </form>
                            </>
                        ) : (
                            <Link href="/login" className="btn btn-primary">
                                Sign in
                            </Link>
                        )}
                    </nav>
                </header>
                {children}
            </body>
        </html>
    )
}
