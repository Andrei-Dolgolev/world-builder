import React, { useState } from 'react';
import styles from './GameDesignForm.module.css';
import { Button } from '@/components/ui';

interface GameDesignFormProps {
    onGDDGenerated: (gdd: string, thinking?: string) => void;
    isGenerating: boolean;
}

const GameDesignForm: React.FC<GameDesignFormProps> = ({
    onGDDGenerated,
    isGenerating
}) => {
    const [gameIdea, setGameIdea] = useState('');
    const [gameName, setGameName] = useState('');
    const [genre, setGenre] = useState('');
    const [targetAudience, setTargetAudience] = useState('');

    const genreOptions = [
        "Platformer",
        "Action",
        "Puzzle",
        "Adventure",
        "RPG",
        "Strategy",
        "Simulation",
        "Sports",
        "Racing",
        "Educational",
        "Other"
    ];

    const audienceOptions = [
        "Kids (7-12)",
        "Teenagers (13-17)",
        "Young adults (18-24)",
        "Adults (25-40)",
        "Everyone",
        "Casual gamers",
        "Hardcore gamers"
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!gameIdea.trim()) {
            alert("Please enter a game idea");
            return;
        }

        try {
            const response = await fetch('/api/generate-gdd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gameIdea,
                    gameName,
                    genre,
                    targetAudience
                }),
            });

            const data = await response.json();

            if (response.ok) {
                onGDDGenerated(data.gdd, data.thinking);
            } else {
                throw new Error(data.message || 'Failed to generate GDD');
            }
        } catch (error) {
            console.error('Error generating GDD:', error);
            alert('Failed to generate game design document. Please try again.');
        }
    };

    return (
        <div className={styles.formContainer}>
            <h2 className={styles.formTitle}>Create Game Design Document</h2>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                    <label htmlFor="gameName">Game Name</label>
                    <input
                        type="text"
                        id="gameName"
                        value={gameName}
                        onChange={(e) => setGameName(e.target.value)}
                        placeholder="Enter game name"
                        className={styles.input}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="genre">Genre</label>
                    <select
                        id="genre"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className={styles.select}
                    >
                        <option value="">Select genre</option>
                        {genreOptions.map((g) => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="targetAudience">Target Audience</label>
                    <select
                        id="targetAudience"
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        className={styles.select}
                    >
                        <option value="">Select target audience</option>
                        {audienceOptions.map((a) => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="gameIdea">Game Idea</label>
                    <textarea
                        id="gameIdea"
                        value={gameIdea}
                        onChange={(e) => setGameIdea(e.target.value)}
                        placeholder="Describe your game idea in detail..."
                        className={styles.textarea}
                        rows={6}
                        required
                    />
                </div>

                <Button
                    type="submit"
                    className={styles.submitButton}
                    disabled={isGenerating || !gameIdea.trim()}
                >
                    {isGenerating ? 'Generating GDD...' : 'Generate Game Design Document'}
                </Button>
            </form>
        </div>
    );
};

export default GameDesignForm;