import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import { basePhaserTemplate } from '../templates/basePhaser';

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

    const selectTemplate = (templateId: string) => {
        router.push(`/projects/new?template=${templateId}`);
    };

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1 className={styles.title}>Welcome to RoseClone</h1>
                <p className={styles.description}>
                    Select a template to get started
                </p>

                <div className={styles.grid}>
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className={styles.card}
                            onClick={() => selectTemplate(template.id)}
                        >
                            <div className={styles.cardImage}>
                                {/* Comment out the img tag until you have actual images */}
                                {/* <img src={template.thumbnail} alt={template.name} /> */}
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: template.id === 'phaser-blank' ? '#2a2a2a' : '#3a3a3a'
                                }}>
                                    {template.name}
                                </div>
                            </div>
                            <h2>{template.name}</h2>
                            <p>{template.description}</p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
} 