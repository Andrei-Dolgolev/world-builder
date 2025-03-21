import React, { useState, useRef, useEffect } from 'react';
import Editor from '../Editor/Editor';
import Preview from '../Preview/Preview';
import Chat, { ChatRef } from '../Chat/Chat';
import AssetManager from '../Assets/AssetManager';
import DeployGame from '../DeployGame/DeployGame';
import { ResizablePanelGroup, ResizablePanel } from '../ResizablePanels';
import styles from './MainLayout.module.css';
import { getGameAnalysis } from '../../utils/analysisTemplates';
import ProjectSettings from '../ProjectSettings/ProjectSettings';
import { getTemplateCode } from '@/utils/templates';
import { getGameContext } from '@/utils/gameContext';
import TemplateSelector from '../TemplateSelector/TemplateSelector';
import { useCode } from '@/contexts/CodeContext';
import ErrorDisplay from '../ErrorDisplay/ErrorDisplay';
import { AppError } from '@/utils/errorHandler';
import eventBus from '@/utils/eventBus';
import { useEventListener } from '@/hooks/useEventListener';
import GameDesign from '../GameDesign/GameDesign';

// Update the component props
interface MainLayoutProps {
    initialCode?: string;
    template?: string;
}

interface Asset {
    id: string;
    name: string;
    type: 'image' | 'audio' | 'spritesheet' | 'other';
    path: string;
    uploadedAt: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ initialCode = '', template = '' }) => {
    // Replace local state with context
    const {
        code,
        setCode,
        isModified,
        setIsModified,
        loadTemplate,
        refreshPreview,
        errors,
        addError,
        clearErrors,
        removeError
    } = useCode();
    const [gameErrors, setGameErrors] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'code' | 'assets' | 'preview' | 'deploy' | 'settings' | 'gdd'>('code');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [preventFocusChange, setPreventFocusChange] = useState(false);
    const chatRef = useRef<ChatRef>(null);
    const [projectAssets, setProjectAssets] = useState<Record<string, string>>({});
    const [projectName, setProjectName] = useState("My Game");
    const [previewInitialized, setPreviewInitialized] = useState(false);

    // GDD related state
    const [gddContent, setGDDContent] = useState<string | null>(null);
    const [gddThinking, setGDDThinking] = useState<string | null>(null);
    const [isGeneratingGDD, setIsGeneratingGDD] = useState(false);

    // Initialize with template if provided
    useEffect(() => {
        if (template && template.trim() !== '' && !isModified) {
            loadTemplate(template);
        } else if (initialCode && initialCode.trim() !== '' && !code) {
            setCode(initialCode);
        }
    }, []);  // Only run once on component mount

    const handleCodeChange = (newCode: string) => {
        console.log("Updating code from AI, type:", typeof newCode);
        console.log("Code preview:", newCode.substring(0, 100));

        // Ensure it's a valid string
        const safeCode = typeof newCode === 'string' ? newCode : String(newCode || '');

        // Update the code
        setCode(safeCode);
        // Clear errors when code changes
        setGameErrors([]);
    };

    const handleTabChange = (tab: 'code' | 'assets' | 'preview' | 'deploy' | 'settings' | 'gdd') => {
        setActiveTab(tab);

        // When switching to preview tab, ensure preview is initialized
        if (tab === 'preview') {
            setPreviewInitialized(true);

            // Refresh preview when switching to the tab
            refreshPreview();
        }
    };

    // Handler for GDD generation
    const handleGDDGenerated = (gdd: string, thinking?: string) => {
        setGDDContent(gdd);
        if (thinking) setGDDThinking(thinking);
        setIsGeneratingGDD(false);

        // Switch to GDD tab to show the result
        handleTabChange('gdd');
    };

    // Handler for applying code from GDD
    const handleApplyCodeFromGDD = (codeSnippet: string) => {
        handleCodeChange(codeSnippet);
        handleTabChange('code');
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

        // Also store the asset for deployment
        setProjectAssets(prev => ({
            ...prev,
            [asset.name]: asset.path
        }));
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
                    data.analysis.codeInsights.forEach((insight: string) => {
                        analysisContent += `- ${insight}\n`;
                    });
                }

                // Improvements section
                analysisContent += `\n## Suggested Improvements\n`;
                data.analysis.suggestedImprovements.forEach((item: string) => {
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

    // Error handling from events
    useEventListener('error:occurred', (error) => {
        if (error) {
            addError({
                message: error.message || 'Unknown error',
                source: error.source || 'system',
                severity: 'error',
                details: error.details
            });
        }
    });

    // Handler for creating a new GDD (clearing the current one)
    const handleCreateNewGDD = () => {
        setGDDContent(null);
        setGDDThinking(null);
    };

    return (
        <div className={styles.mainLayout}>
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={50} minSize={30}>
                    <div className={styles.tabContainer}>
                        <div className={styles.tabs}>
                            <button
                                className={`${styles.tab} ${activeTab === 'code' ? styles.activeTab : ''}`}
                                onClick={() => handleTabChange('code')}
                            >
                                Code
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'assets' ? styles.activeTab : ''}`}
                                onClick={() => handleTabChange('assets')}
                            >
                                Assets
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'preview' ? styles.activeTab : ''}`}
                                onClick={() => handleTabChange('preview')}
                            >
                                Preview
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'gdd' ? styles.activeTab : ''}`}
                                onClick={() => handleTabChange('gdd')}
                            >
                                Game Design
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'deploy' ? styles.activeTab : ''}`}
                                onClick={() => handleTabChange('deploy')}
                            >
                                Deploy
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'settings' ? styles.activeTab : ''}`}
                                onClick={() => handleTabChange('settings')}
                            >
                                Settings
                            </button>
                        </div>
                        <div className={styles.tabContent}>
                            {activeTab === 'code' && (
                                <Editor
                                    code={code}
                                    onChange={handleCodeChange}
                                    template={template}
                                />
                            )}
                            {activeTab === 'assets' && (
                                <AssetManager onAssetSelect={handleAssetSelect} />
                            )}
                            {activeTab === 'preview' && (
                                <Preview
                                    onError={handleGameError}
                                    onRestartGame={() => {
                                        // Use the context's refreshPreview instead
                                        refreshPreview();
                                    }}
                                    onGameplayAnalysisRequested={handleGameplayAnalysisRequested}
                                />
                            )}
                            {activeTab === 'gdd' && (
                                <div className={styles.gddContainer}>
                                    {!gddContent ? (
                                        <div className={styles.noGddMessage}>
                                            <h2>Game Design Document</h2>
                                            <p>No game design document has been generated yet. Use the "Game Designer" mode in the chat to create a comprehensive game design document.</p>
                                        </div>
                                    ) : (
                                        <GameDesign
                                            gdd={gddContent}
                                            thinking={gddThinking || undefined}
                                            onCodeApplied={handleApplyCodeFromGDD}
                                            onCreateNew={handleCreateNewGDD}
                                            currentCode={code} // Pass the current code
                                        />
                                    )}
                                </div>
                            )}
                            {activeTab === 'deploy' && (
                                <DeployGame
                                    gameCode={code}
                                    projectName={projectName}
                                    onProjectNameChange={setProjectName}
                                    assets={projectAssets}
                                />
                            )}
                            {activeTab === 'settings' && (
                                <div className={styles.settingsTab}>
                                    <ProjectSettings
                                        projectName={projectName}
                                        onProjectNameChange={setProjectName}
                                    />
                                    {/* You can add more settings here as needed */}
                                </div>
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
                        // Add GDD related props
                        supportGDD={true}
                        onGDDGenerated={handleGDDGenerated}
                        data-testid="chat-component"
                    />
                </ResizablePanel>
            </ResizablePanelGroup>

            {/* Add error display */}
            <ErrorDisplay
                errors={errors}
                onDismiss={removeError}
                onDismissAll={clearErrors}
            />
        </div>
    );
};

export default MainLayout;