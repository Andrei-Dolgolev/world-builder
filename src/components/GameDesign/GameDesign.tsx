import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import styles from './GameDesign.module.css';
import { extractCodeBlocks, CodeBlock } from '@/utils/codeExtraction';
import { Button } from '@/components/ui';

interface GameDesignProps {
    gdd: string;
    thinking?: string;
    onCodeApplied?: (code: string) => void;
    onCreateNew?: () => void;
    currentCode?: string; // Added to know what code is currently in the editor
}

const GameDesign: React.FC<GameDesignProps> = ({
    gdd,
    thinking,
    onCodeApplied,
    onCreateNew,
    currentCode = ''
}) => {
    const [activeTab, setActiveTab] = useState('gdd');
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [mergeStrategy, setMergeStrategy] = useState<'replace' | 'append' | 'merge'>('replace');
    const [selectedCodeBlock, setSelectedCodeBlock] = useState<number | null>(null);

    // Extract code blocks for direct use
    const codeBlocks: CodeBlock[] = extractCodeBlocks(gdd);
    const jsCodeBlocks = codeBlocks.filter(block =>
        block.language === 'javascript' || block.language === 'js'
    );

    const toggleSection = (sectionId: string) => {
        if (expandedSection === sectionId) {
            setExpandedSection(null);
        } else {
            setExpandedSection(sectionId);
        }
    };

    const handleApplyCode = (code: string) => {
        if (!onCodeApplied) return;

        let finalCode = code;

        // Apply the appropriate merge strategy
        if (mergeStrategy === 'append') {
            finalCode = `${currentCode}\n\n// ---- Code added from GDD ----\n${code}`;
        } else if (mergeStrategy === 'merge') {
            // Simple merge strategy - this could be more sophisticated based on your needs
            try {
                // Try to identify functions/classes in current code and new code
                // This is a simple approach and might need refinement
                const currentFunctions = extractFunctionNames(currentCode);
                const newCode = code.split('\n').map(line => {
                    // Add a comment before new functions being added
                    const functionMatch = line.match(/function\s+(\w+)/);
                    if (functionMatch && currentFunctions.includes(functionMatch[1])) {
                        return `// REPLACED: ${line}`;
                    }
                    return line;
                }).join('\n');

                finalCode = `// Original code with modifications from GDD\n${currentCode}\n\n// ---- New code from GDD ----\n${newCode}`;
            } catch (error) {
                console.error('Error merging code:', error);
                // Fallback to simple append if merge fails
                finalCode = `${currentCode}\n\n// ---- Code added from GDD ----\n${code}`;
            }
        }

        onCodeApplied(finalCode);
    };

    // Helper function to extract function names from code
    const extractFunctionNames = (code: string): string[] => {
        const functionRegex = /function\s+(\w+)/g;
        const names: string[] = [];
        let match;
        while ((match = functionRegex.exec(code)) !== null) {
            names.push(match[1]);
        }
        return names;
    };

    const handleExportGDD = () => {
        // Create blob and download link
        const blob = new Blob([gdd], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'game-design-document.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={styles.gddContainer}>
            <div className={styles.tabContainer}>
                <button
                    className={`${styles.tab} ${activeTab === 'gdd' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('gdd')}
                >
                    Game Design Document
                </button>
                {jsCodeBlocks.length > 0 && (
                    <button
                        className={`${styles.tab} ${activeTab === 'code' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('code')}
                    >
                        Code Examples ({jsCodeBlocks.length})
                    </button>
                )}
                {thinking && (
                    <button
                        className={`${styles.tab} ${activeTab === 'thinking' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('thinking')}
                    >
                        AI Reasoning
                    </button>
                )}
            </div>

            <div className={styles.tabContent}>
                {activeTab === 'gdd' && (
                    <div className={styles.gddContent}>
                        <div className={styles.gddActions}>
                            <Button onClick={handleExportGDD} size="sm">
                                Export GDD
                            </Button>
                            {onCreateNew && (
                                <Button onClick={onCreateNew} size="sm" variant="outline">
                                    Create New GDD
                                </Button>
                            )}
                        </div>
                        <ReactMarkdown
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                                h1: ({ node, ...props }) => (
                                    <h1 className={styles.gddTitle} {...props} />
                                ),
                                h2: ({ node, ...props }) => {
                                    const text = props.children?.toString() || '';
                                    const sectionId = text.toLowerCase().replace(/\s+/g, '-');
                                    return (
                                        <h2
                                            className={styles.gddSection}
                                            onClick={() => toggleSection(sectionId)}
                                            {...props}
                                        >
                                            {props.children}
                                            <span className={styles.expandIcon}>
                                                {expandedSection === sectionId ? '▼' : '▶'}
                                            </span>
                                        </h2>
                                    );
                                },
                                // Hide code blocks in the GDD view
                                code: ({ node, inline, className, children, ...props }) => {
                                    if (inline) {
                                        return <code className={styles.inlineCode} {...props}>{children}</code>;
                                    }
                                    return null;
                                }
                            }}
                        >
                            {gdd}
                        </ReactMarkdown>
                    </div>
                )}

                {activeTab === 'code' && (
                    <div className={styles.codeContent}>
                        <h3>Code Examples from Game Design</h3>

                        <div className={styles.codeIntegrationOptions}>
                            <div className={styles.mergeStrategySelector}>
                                <label>Integration Strategy:</label>
                                <select
                                    value={mergeStrategy}
                                    onChange={(e) => setMergeStrategy(e.target.value as any)}
                                    className={styles.mergeSelect}
                                >
                                    <option value="replace">Replace Current Code</option>
                                    <option value="append">Append to Current Code</option>
                                    <option value="merge">Attempt Smart Merge</option>
                                </select>
                            </div>
                        </div>

                        {jsCodeBlocks.map((block, index) => (
                            <div
                                key={index}
                                className={`${styles.codeBlock} ${selectedCodeBlock === index ? styles.selectedCodeBlock : ''}`}
                                onClick={() => setSelectedCodeBlock(index)}
                            >
                                <h4>Code Block {index + 1}</h4>
                                <pre className={styles.pre}>
                                    <code className={styles.code}>
                                        {block.code}
                                    </code>
                                </pre>
                                <div className={styles.codeBlockActions}>
                                    <Button
                                        onClick={() => handleApplyCode(block.code)}
                                        size="sm"
                                        className={styles.applyButton}
                                    >
                                        Apply This Code
                                    </Button>
                                    <div className={styles.codeMeta}>
                                        {block.language && <span className={styles.codeLanguage}>{block.language}</span>}
                                        <span className={styles.codeLines}>{block.code.split('\n').length} lines</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {jsCodeBlocks.length > 1 && (
                            <div className={styles.applyAllContainer}>
                                <Button
                                    onClick={() => handleApplyCode(
                                        jsCodeBlocks.map(b => b.code).join('\n\n// Next code block\n\n')
                                    )}
                                    className={styles.applyAllButton}
                                >
                                    Apply All Code Blocks
                                </Button>
                                <p className={styles.applyAllNote}>
                                    This will {mergeStrategy === 'replace' ? 'replace' : mergeStrategy === 'append' ? 'append to' : 'merge with'} your current code.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'thinking' && thinking && (
                    <div className={styles.thinkingContent}>
                        <h3>AI Reasoning Process</h3>
                        <pre className={styles.thinking}>
                            {thinking}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameDesign;