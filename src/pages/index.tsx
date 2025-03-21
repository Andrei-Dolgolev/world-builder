import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import { basePhaserTemplate } from '../templates/basePhaser';
import Head from 'next/head';

// Define template options
const templates = [
    {
        id: 'blank',
        name: 'Blank Project',
        description: 'Start with a clean slate',
        code: '// Your Phaser code here'
    },
    {
        id: 'base-platform',
        name: 'Basic Platformer',
        description: 'A robust platformer template with player movement and physics',
        code: basePhaserTemplate
    },
    {
        id: 'phaser-blank',
        name: 'Blank Phaser Project',
        description: 'Start with a basic empty Phaser.js game canvas.',
        thumbnail: '/templates/phaser-blank.png',
    },
    {
        id: 'phaser-platformer',
        name: 'Simple Platformer',
        description: 'A basic platformer game with player movement and platforms.',
        thumbnail: '/templates/phaser-platformer.png',
    },
    // Add more templates as needed
];

export default function Home() {
    const router = useRouter();


    console.log('WORLDBUILDER_API_URL', process.env.WORLDBUILDER_API_URL);

    // Redirect to dashboard if needed
    useEffect(() => {
        // You could add authentication check here if needed
        // router.push('/dashboard');
    }, [router]);

    const selectTemplate = (templateId: string) => {
        router.push(`/projects/new?template=${templateId}`);
    };

    return (
        <>
            <Head>
                <title>WorldBuilder - Create Your Web Space</title>
                <meta name="description" content="Create and manage your own web spaces with WorldBuilder" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className={styles.container}>
                <main className={styles.main}>
                    <h1 className={styles.title}>Welcome to WorldBuilder</h1>
                    <p className={styles.description}>
                        Create your own web space in seconds.
                    </p>

                    <div className="mt-8 flex space-x-4">
                        <a
                            href="/api/auth/signin"
                            className="bg-primary text-white py-3 px-6 rounded-lg hover:bg-primary-light transition-colors"
                        >
                            Sign In
                        </a>
                        <a
                            href="/dashboard"
                            className="bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Dashboard
                        </a>
                    </div>
                </main>
            </div>
        </>
    );
} 