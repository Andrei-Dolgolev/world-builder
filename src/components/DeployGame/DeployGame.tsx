import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button, Input, Label, Spinner, Alert, AlertTitle, AlertDescription } from "@/components/ui";
import { CheckCircle, XCircle, Copy, ExternalLink } from 'lucide-react';
import styles from './DeployGame.module.css';
import ProjectSettings from '../ProjectSettings/ProjectSettings';

interface DeployGameProps {
    gameCode: string;
    projectName: string;
    projectId: string;
    username?: string;
    assets?: Record<string, string>;
}

type DeploymentResult = {
    success: boolean;
    deploymentUrl: string;
    message: string;
};

const DeployGame: React.FC<DeployGameProps> = ({ gameCode, projectName, projectId, username, assets }) => {
    const [customSubdomain, setCustomSubdomain] = useState('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
    const [validationError, setValidationError] = useState('');
    const [copiedUrl, setCopiedUrl] = useState(false);
    const router = useRouter();

    // Effective project name for subdomain generation
    const effectiveProjectName = customSubdomain || sanitizeForSubdomain(projectName);

    // Generate preview URL
    const previewUrl = `https://${effectiveProjectName}.app.worldbuilder.space`;

    // Reset state when project changes
    useEffect(() => {
        setCustomSubdomain('');
        setDeploymentResult(null);
        setValidationError('');
    }, [projectId]);

    // After successful deployment, add verification
    useEffect(() => {
        if (deploymentResult?.success && deploymentResult.deploymentUrl) {
            verifyDeployment(deploymentResult.deploymentUrl);
        }
    }, [deploymentResult]);

    // Sanitize project name for use as subdomain
    function sanitizeForSubdomain(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 63);
    }

    // Validate subdomain format
    const validateSubdomain = (value: string) => {
        if (!value) return true;

        if (!/^[a-z0-9-]{3,63}$/.test(value)) {
            setValidationError(
                'Subdomain can only contain lowercase letters, numbers, and hyphens, and must be between 3-63 characters.'
            );
            return false;
        }

        setValidationError('');
        return true;
    };

    const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setCustomSubdomain(value);
        validateSubdomain(value);
    };

    const checkSubdomainAvailability = async () => {
        if (!customSubdomain) return true;

        setIsChecking(true);
        try {
            // Call the proxy endpoint instead of Lambda directly
            const response = await fetch(`/api/proxy/check-subdomain`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subdomain: customSubdomain,
                }),
            });

            const data = await response.json();

            if (!data.available) {
                setValidationError('This subdomain is already taken. Please choose another.');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking subdomain availability:', error);
            // Continue anyway - we'll handle this during deployment
            return true;
        } finally {
            setIsChecking(false);
        }
    };

    const handleCopyUrl = () => {
        if (deploymentResult?.deploymentUrl) {
            navigator.clipboard.writeText(deploymentResult.deploymentUrl);
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
        }
    };

    const handleDeploy = async () => {
        if (customSubdomain && !validateSubdomain(customSubdomain)) {
            return;
        }

        // Check availability if custom subdomain is provided
        if (customSubdomain) {
            const isAvailable = await checkSubdomainAvailability();
            if (!isAvailable) return;
        }

        setIsDeploying(true);
        setDeploymentResult(null);

        try {
            // Use the proxy endpoint instead of calling Lambda directly
            const response = await fetch('/api/proxy/deploy-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gameCode,
                    assets,
                    projectName,
                    username,
                    customSubdomain,
                }),
            });

            const result = await response.json();

            // Update project in database with deployment URL if successful
            if (result.success) {
                try {
                    await fetch(`/api/projects/${projectId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'published',
                            lastDeployedAt: new Date().toISOString(),
                            deploymentUrl: result.deploymentUrl
                        }),
                    });
                } catch (error) {
                    console.error('Error updating project status:', error);
                    // Continue anyway - deployment was successful
                }
            }

            setDeploymentResult(result);
        } catch (error) {
            setDeploymentResult({
                success: false,
                deploymentUrl: '',
                message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        } finally {
            setIsDeploying(false);
        }
    };

    const verifyDeployment = async (url: string) => {
        setIsVerifying(true);

        // Try verification a few times with delay between attempts
        for (let i = 0; i < 3; i++) {
            try {
                const response = await fetch('/api/proxy/verify-deployment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deploymentUrl: url }),
                });

                const data = await response.json();

                if (data.status === 'success') {
                    setIsVerifying(false);
                    return;
                }

                // Wait 2 seconds between retries
                if (i < 2) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                console.error('Verification attempt failed:', error);
            }
        }

        setIsVerifying(false);
    };

    return (
        <div className={styles.deployContainer}>
            <div className={styles.header}>
                <h2 className={styles.title}>Deploy Your Game</h2>
                <p className={styles.description}>
                    Deploy your game to make it available online with a custom URL.
                </p>
            </div>

            <div className={styles.formGroup}>
                <Label htmlFor="subdomain" className={styles.label}>
                    Subdomain (optional):
                </Label>
                <div className={styles.subdomainInputWrapper}>
                    <Input
                        type="text"
                        id="subdomain"
                        value={customSubdomain}
                        onChange={handleSubdomainChange}
                        placeholder={sanitizeForSubdomain(projectName)}
                        disabled={isDeploying}
                        className={styles.subdomainInput}
                    />
                    <span className={styles.domainSuffix}>.app.worldbuilder.space</span>
                </div>
                {validationError && (
                    <p className={styles.error}>{validationError}</p>
                )}
                <p className={styles.hint}>
                    Leave blank to generate a subdomain based on your project name.
                </p>

                <div className={styles.previewUrl}>
                    <span>Preview URL:</span>
                    <code>{previewUrl}</code>
                    <p className={styles.hint}>
                        Note: Your game will be publicly accessible at this URL.
                        The deployed game will include the necessary game libraries.
                    </p>
                </div>
            </div>

            <Button
                onClick={handleDeploy}
                disabled={isDeploying || !!validationError || isChecking || isVerifying}
                className={styles.deployButton}
            >
                {isDeploying || isVerifying ? (
                    <>
                        <Spinner size="sm" /> {isVerifying ? 'Verifying...' : 'Deploying...'}
                    </>
                ) : (
                    'Deploy Game'
                )}
            </Button>

            {deploymentResult && (
                <div className={`${styles.deploymentResult} ${deploymentResult.success ? styles.success : styles.error}`}>
                    {deploymentResult.success ? (
                        <Alert variant="success">
                            <CheckCircle className={styles.resultIcon} />
                            <AlertTitle>Deployment Successful!</AlertTitle>
                            <AlertDescription>
                                {deploymentResult.message}
                                {isVerifying && (
                                    <div className={styles.verifying}>
                                        <Spinner size="sm" /> Verifying your deployment is accessible...
                                    </div>
                                )}
                            </AlertDescription>

                            <div className={styles.deploymentUrl}>
                                <span>Your game is live at:</span>
                                <a
                                    href={deploymentResult.deploymentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.deploymentLink}
                                >
                                    {deploymentResult.deploymentUrl} <ExternalLink size={16} />
                                </a>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyUrl}
                                    className={styles.copyButton}
                                >
                                    {copiedUrl ? 'Copied!' : 'Copy URL'} <Copy size={16} />
                                </Button>
                            </div>
                        </Alert>
                    ) : (
                        <Alert variant="destructive">
                            <XCircle className={styles.resultIcon} />
                            <AlertTitle>Deployment Failed</AlertTitle>
                            <AlertDescription>{deploymentResult.message}</AlertDescription>
                        </Alert>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeployGame; 