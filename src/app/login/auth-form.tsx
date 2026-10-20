'use client'

import { useActionState, useState } from 'react'
import { signIn, signUp, type AuthState } from './actions'

const initial: AuthState = { error: null }

export function AuthForm({ initialMode, next }: { initialMode: 'signin' | 'signup'; next: string }) {
    const [mode, setMode] = useState(initialMode)
    const [signInState, signInAction, signingIn] = useActionState(signIn, initial)
    const [signUpState, signUpAction, signingUp] = useActionState(signUp, initial)

    const isSignUp = mode === 'signup'
    const error = isSignUp ? signUpState.error : signInState.error
    const pending = signingIn || signingUp

    return (
        <section className="panel p-6 sm:p-8">
            <p className="eyebrow">{isSignUp ? 'New adventurer' : 'Welcome back'}</p>
            <h1 className="panel-title mt-2 text-4xl">{isSignUp ? 'Create an account' : 'Sign in'}</h1>
            <div className="taper my-4" />

            <form action={isSignUp ? signUpAction : signInAction} className="flex flex-col gap-4">
                <input type="hidden" name="next" value={next} />
                {isSignUp && (
                    <div>
                        <label htmlFor="displayName" className="label">
                            Display name
                        </label>
                        <input id="displayName" name="displayName" required maxLength={40} className="input" placeholder="Rae" />
                    </div>
                )}
                <div>
                    <label htmlFor="email" className="label">
                        Email
                    </label>
                    <input id="email" name="email" type="email" required autoComplete="email" className="input" />
                </div>
                <div>
                    <label htmlFor="password" className="label">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        className="input"
                    />
                </div>

                {error && (
                    <p role="alert" className="border-l-4 border-blood bg-blood/10 px-3 py-2 font-ui text-sm">
                        {error}
                    </p>
                )}

                <button className="btn btn-primary mt-2" disabled={pending}>
                    {pending ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
                </button>
            </form>

            <p className="mt-6 font-ui text-sm text-dust">
                {isSignUp ? 'Already have an account?' : 'New to Tablekeep?'}{' '}
                <button
                    type="button"
                    onClick={() => setMode(isSignUp ? 'signin' : 'signup')}
                    className="cursor-pointer font-bold text-gold-light underline-offset-4 hover:underline"
                >
                    {isSignUp ? 'Sign in' : 'Create an account'}
                </button>
            </p>
        </section>
    )
}
