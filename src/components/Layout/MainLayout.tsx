import React, { useState, useRef } from 'react';
import Editor from '../Editor/Editor';
import Preview from '../Preview/Preview';
import Chat, { ChatRef } from '../Chat/Chat';
import AssetManager from '../Assets/AssetManager';
import DeployGame from '../DeployGame/DeployGame';
import { ResizablePanelGroup, ResizablePanel } from '../ResizablePanels';
import styles from './MainLayout.module.css';
import { getGameAnalysis } from '../../utils/analysisTemplates';

// Update the component props
interface MainLayoutProps {
    initialCode?: string;
}

interface Asset {
    id: string;
    name: string;
    type: 'image' | 'audio' | 'spritesheet' | 'other';
    path: string;
    uploadedAt: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ initialCode = '' }) => {
    const [code, setCode] = React.useState(initialCode);
    const [gameErrors, setGameErrors] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'code' | 'assets' | 'preview' | 'deploy'>('code');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [preventFocusChange, setPreventFocusChange] = useState(false);
    const chatRef = useRef<ChatRef>(null);

    const handleCodeChange = (newCode: string) => {
        setCode(newCode);
        // Clear errors when code changes
        setGameErrors([]);
    };

    const handleGameError = (error: any) => {
        // Don't add duplicate errors
        setGameErrors(prev => {
            // If this exact error is already in the array, don't add it again
            if (prev.some(e => JSON.stringify(e) === JSON.stringify(error))) {
                return prev;
            }
            return [...prev, error];
        });
    };

    const handleAssetSelect = (asset: Asset) => {
        // Insert asset reference into code
        const assetRef = `// Using asset: ${asset.name} (${asset.path})
this.load.${asset.type === 'image' ? 'image' : asset.type === 'audio' ? 'audio' : 'file'}('${asset.name.split('.')[0]}', '${asset.path}');`;

        // Insert at cursor position or append to end of preload function
        // For simplicity, we'll just append it to the current code for now
        setCode(prevCode => prevCode + '\n' + assetRef);
    };

    const handleGameplayAnalysisRequested = async (recording: Blob) => {
        setIsAnalyzing(true);

        try {
            // Create form data and include the game code
            const formData = new FormData();
            formData.append('video', recording, 'gameplay.webm');
            formData.append('gameCode', code); // Add the game code

            // Try to determine game type from code
            let gameType = 'unknown';
            if (code.includes('platformer') || code.includes('jump')) {
                gameType = 'platformer';
            } else if (code.includes('shoot') || code.includes('bullet')) {
                gameType = 'shooter';
            } else if (code.includes('puzzle') || code.includes('match')) {
                gameType = 'puzzle';
            }
            formData.append('gameType', gameType);

            // Send to the API
            const response = await fetch('/api/analyze-gameplay', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const data = await response.json();

            // Create a richer analysis display that shows all available data
            let analysisContent = `# Game Analysis Results\n\n`;

            // Add full analysis if available
            if (data.analysis.fullAnalysis) {
                analysisContent = data.analysis.fullAnalysis;
            } else {
                // Otherwise use our structured format as fallback
                // Visual quality section
                analysisContent += `## Visual Quality\n`;
                analysisContent += `- **Quality**: ${data.analysis.estimatedQuality}\n`;
                analysisContent += `- **Frame Rate**: ${data.analysis.estimatedFrameRate}\n`;

                // Add visual dynamics if available
                if (data.analysis.visualDynamics) {
                    analysisContent += `- **Motion Rating**: ${data.analysis.visualDynamics.motion}/10\n`;
                    analysisContent += `- **Visual Variety**: ${data.analysis.visualDynamics.colorfulness}/10\n`;
                }

                // Add insights if available
                if (data.analysis.codeInsights && data.analysis.codeInsights.length > 0) {
                    analysisContent += `\n## Game Insights\n`;
                    data.analysis.codeInsights.forEach(insight => {
                        analysisContent += `- ${insight}\n`;
                    });
                }

                // Improvements section
                analysisContent += `\n## Suggested Improvements\n`;
                data.analysis.suggestedImprovements.forEach(item => {
                    analysisContent += `- ${item}\n`;
                });
            }

            // Add helpful closing if not present in the full analysis
            if (!analysisContent.includes("Would you like me to help")) {
                analysisContent += `\n\nWould you like me to help implement any of these improvements?`;
            }

            // Add the analysis as a message to the chat
            if (chatRef.current) {
                chatRef.current.addMessages([
                    {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: analysisContent
                    }
                ]);
            }
        } catch (error) {
            console.error('Error analyzing gameplay:', error);

            // Show error in chat
            if (chatRef.current) {
                chatRef.current.addMessages([
                    {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: `I encountered an error while analyzing your gameplay: ${error instanceof Error ? error.message : String(error)}`
                    }
                ]);
            }
        } finally {
            setIsAnalyzing(false);
            setPreventFocusChange(false);
        }
    };

    return (
        <div className={styles.mainLayout}>
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={50} minSize={30}>
                    <div className={styles.tabContainer}>
                        <div className={styles.tabs}>
                            <button
                                className={`${styles.tab} ${activeTab === 'code' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('code')}
                            >
                                Code
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'assets' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('assets')}
                            >
                                Assets
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'preview' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('preview')}
                            >
                                Preview
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'deploy' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('deploy')}
                            >
                                Deploy
                            </button>
                        </div>
                        <div className={styles.tabContent}>
                            {activeTab === 'code' && (
                                <Editor code={code} onChange={handleCodeChange} />
                            )}
                            {activeTab === 'assets' && (
                                <AssetManager onAssetSelect={handleAssetSelect} />
                            )}
                            {activeTab === 'preview' && (
                                <Preview
                                    code={code}
                                    onError={handleGameError}
                                    onGameplayAnalysisRequested={handleGameplayAnalysisRequested}
                                />
                            )}
                            {activeTab === 'deploy' && (
                                <DeployGame
                                    gameCode={code}
                                    projectName="My Game"
                                />
                            )}
                        </div>
                    </div>
                </ResizablePanel>

                <ResizablePanel defaultSize={50} minSize={30}>
                    <Chat
                        ref={chatRef}
                        onCodeGenerated={handleCodeChange}
                        currentCode={code}
                        gameErrors={gameErrors}
                        clearErrors={() => setGameErrors([])}
                        isAnalyzing={isAnalyzing}
                        preventFocusChange={preventFocusChange}
                        data-testid="chat-component"
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};

export default MainLayout; 