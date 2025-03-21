import React from 'react';
import styles from './ProjectSettings.module.css';

interface ProjectSettingsProps {
    projectName: string;
    onProjectNameChange: (name: string) => void;
}

const ProjectSettings: React.FC<ProjectSettingsProps> = ({
    projectName,
    onProjectNameChange
}) => {
    return (
        <div className={styles.settingsContainer}>
            <h2>Project Settings</h2>

            <div className={styles.formGroup}>
                <label htmlFor="projectName">Project Name:</label>
                <input
                    id="projectName"
                    type="text"
                    value={projectName}
                    onChange={(e) => onProjectNameChange(e.target.value)}
                    placeholder="Enter project name"
                />
            </div>
        </div>
    );
};

export default ProjectSettings; 