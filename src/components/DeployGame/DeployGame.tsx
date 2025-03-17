import React, { useState } from 'react';
import styles from './DeployGame.module.css';

interface DeployGameProps {
    gameCode: string;
    projectName: string;
    assets?: Record<string, string>;
}

const DeployGame: React.FC<DeployGameProps> = ({ gameCode, projectName, assets }) => {
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentResult, setDeploymentResult] = useState<{
        success: boolean;
        deploymentUrl: string;
        message: string;
    } | null>(null);
    const [customSubdomain, setCustomSubdomain] = useState('');
    const [username, setUsername] = useState('');

    const handleDeploy = async () => {
        setIsDeploying(true);

        try {
            const response = await fetch('/api/deploy-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gameCode,
                    assets,
                    projectName,
                    username: username || undefined,
                    customSubdomain: customSubdomain || undefined,
                }),
            });

            const result = await response.json();
            setDeploymentResult(result);
        } catch (error) {
            setDeploymentResult({
                success: false,
                deploymentUrl: '',
                message: `Deployment failed: ${(error as Error).message}`,
            });
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className={styles.deployContainer}>
            <h2>Deploy Your Game</h2>

            <div className={styles.deploymentOptions}>
                <div className={styles.inputGroup}>
                    <label htmlFor="username">Username (optional):</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="your-username"
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label htmlFor="customSubdomain">Custom Subdomain (optional):</label>
                    <input
                        type="text"
                        id="customSubdomain"
                        value={customSubdomain}
                        onChange={(e) => setCustomSubdomain(e.target.value)}
                        placeholder="my-awesome-game"
                    />
                </div>
            </div>

            <div className={styles.deployButtonContainer}>
                <button
                    className={styles.deployButton}
                    onClick={handleDeploy}
                    disabled={isDeploying}
                >
                    {isDeploying ? 'Deploying...' : 'Deploy Game'}
                </button>
            </div>

            {deploymentResult && (
                <div className={`${styles.deploymentResult} ${deploymentResult.success ? styles.success : styles.error}`}>
                    <h3>{deploymentResult.success ? 'Deployment Successful!' : 'Deployment Failed'}</h3>
                    <p>{deploymentResult.message}</p>

                    {deploymentResult.success && (
                        <div className={styles.deploymentUrl}>
                            <p>Your game is live at:</p>
                            <a href={deploymentResult.deploymentUrl} target="_blank" rel="noopener noreferrer">
                                {deploymentResult.deploymentUrl}
                            </a>

                            <div className={styles.embedCode}>
                                <p>Embed code for your website:</p>
                                <pre>
                                    {`<iframe 
  src="${deploymentResult.deploymentUrl}" 
  width="800" 
  height="600" 
  allowfullscreen>
</iframe>`}
                                </pre>
                                <button
                                    className={styles.copyButton}
                                    onClick={() => navigator.clipboard.writeText(`<iframe 
  src="${deploymentResult.deploymentUrl}" 
  width="800" 
  height="600" 
  allowfullscreen>
</iframe>`)}
                                >
                                    Copy Embed Code
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeployGame; 