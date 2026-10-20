import type { Metadata } from 'next'
import { AuthForm } from './auth-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string }> }) {
    const { mode, next } = await searchParams
    return (
        <main className="mx-auto flex max-w-md flex-col px-4 py-16">
            <AuthForm initialMode={mode === 'signup' ? 'signup' : 'signin'} next={next ?? '/campaigns'} />
        </main>
    )
}
