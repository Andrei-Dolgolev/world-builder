import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../styles/Dashboard.module.css';
import Head from 'next/head';

interface Project {
    id: string;
    name: string;
    lastModified: string;
    thumbnail?: string;
}

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // In a real app, we would fetch projects from an API
        // For now, we'll use mock data
        const mockProjects: Project[] = [
            {
                id: '1',
                name: 'Platform Game',
                lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                id: '2',
                name: 'Space Shooter',
                lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            },
        ];

        setTimeout(() => {
            setProjects(mockProjects);
            setIsLoading(false);
        }, 500); // Simulate loading
    }, []);

    return (
        <>
            <Head>
                <title>Dashboard | WorldBuilder</title>
            </Head>
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1>My Projects</h1>
                    <Link href="/projects/new?template=phaser-blank" className={styles.newButton}>
                        New Project
                    </Link>
                </header>

                <main className={styles.main}>
                    {isLoading ? (
                        <div className={styles.loading}>Loading projects...</div>
                    ) : projects.length > 0 ? (
                        <div className={styles.projectGrid}>
                            {projects.map((project) => (
                                <div key={project.id} className={styles.projectCard}>
                                    <div className={styles.thumbnail}>
                                        {project.thumbnail ? (
                                            <img src={project.thumbnail} alt={project.name} />
                                        ) : (
                                            <div className={styles.placeholderThumbnail}>
                                                <span>{project.name.charAt(0)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.projectInfo}>
                                        <h3>{project.name}</h3>
                                        <p>Last modified: {new Date(project.lastModified).toLocaleDateString()}</p>
                                    </div>
                                    <div className={styles.projectActions}>
                                        <Link href={`/projects/${project.id}`} className={styles.editButton}>
                                            Open
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            <p>You don't have any projects yet.</p>
                            <Link href="/projects/new?template=phaser-blank" className={styles.createButton}>
                                Create your first project
                            </Link>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
} 