import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../../styles/Auth.module.css';

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // In a real app, we would make an API call to authenticate
            // For now, let's simulate success and redirect
            setTimeout(() => {
                // Mock authentication success
                // Normally we would validate credentials here
                router.push('/dashboard');
            }, 1000);
        } catch (err) {
            setError('Invalid email or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Sign In | WorldBuilder</title>
            </Head>
            <div className={styles.container}>
                <div className={styles.formContainer}>
                    <h1>Sign In</h1>

                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className={styles.links}>
                        <a href="#">Forgot password?</a>
                        <a href="/api/auth/signup">Don't have an account? Sign up</a>
                    </div>
                </div>
            </div>
        </>
    );
} 