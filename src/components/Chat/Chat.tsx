import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import styles from './Chat.module.css';
import { extractTextFromReactChildren } from '@/utils/reactHelpers';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    thinking?: string;
}

interface ChatProps {
    onCodeGenerated: (code: string) => void;
    currentCode: string;
    gameErrors: any[];
    clearErrors: () => void;
    isAnalyzing: boolean;
    preventFocusChange?: boolean;
    onGDDGenerated?: (gdd: string, thinking?: string) => void;
    supportGDD?: boolean; // Flag to enable GDD feature
}

// Define the forwarded ref type
export interface ChatRef {
    addMessages: (newMessages: Message[]) => void;
}

const Chat = forwardRef<ChatRef, ChatProps>(({
    onCodeGenerated,
    currentCode,
    gameErrors,
    clearErrors,
    isAnalyzing,
    preventFocusChange = false,
    onGDDGenerated,
    supportGDD = false
}, ref) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hello! I'm your AI assistant. Describe what you want to create or change in your game, and I'll help you build it!"
        }
    ]);
    const [gddMode, setGDDMode] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Add ref to track reported errors to prevent duplicates
    const reportedErrorsRef = useRef<Set<string>>(new Set());
    // Add debounce timeout ref
    const errorReportTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Improved error handling logic with debounce and deduplication
    useEffect(() => {
        // Only proceed if there are errors and we're not already loading
        if (gameErrors.length > 0 && !isLoading) {
            // Create a hash of the current errors to check for duplicates
            const errorHash = JSON.stringify(gameErrors);

            // Check if we've already reported these exact errors
            if (!reportedErrorsRef.current.has(errorHash)) {
                // Clear any existing timeout
                if (errorReportTimeoutRef.current) {
                    clearTimeout(errorReportTimeoutRef.current);
                }

                // Set a debounce timeout to avoid rapid fire reports
                errorReportTimeoutRef.current = setTimeout(() => {
                    handleErrorReport();
                    // Add this error hash to our set of reported errors
                    reportedErrorsRef.current.add(errorHash);
                }, 2000); // 2 second debounce
            }
        }

        // Cleanup function to clear any pending timeouts when component unmounts
        return () => {
            if (errorReportTimeoutRef.current) {
                clearTimeout(errorReportTimeoutRef.current);
            }
        };
    }, [gameErrors, isLoading]);

    const handleErrorReport = async () => {
        if (gameErrors.length === 0) return;

        setIsLoading(true);

        try {
            const errorText = `I'm seeing the following errors in my game: ${JSON.stringify(gameErrors, null, 2)}. Can you help fix them?`;

            const response = await fetch('/api/generate-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: errorText,
                    currentCode: currentCode,
                    conversation: messages.slice(-5),
                }),
            });

            const data = await response.json();

            const newErrorMessage: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: `I'm seeing errors in my game. Can you help fix them?`,
            };

            const newAIMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.message,
                thinking: data.thinking
            };

            setMessages(prev => [...prev, newErrorMessage, newAIMessage]);

            if (data.code) {
                onCodeGenerated(data.code);
            }

            clearErrors();

        } catch (error) {
            console.error('Error reporting game errors:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleSendMessage();
        }
    };

    // Helper functions to extract information from user input
    const extractGameName = (input: string): string => {
        // Simple extraction of game name (first quoted phrase or first few words)
        const nameMatch = input.match(/"([^"]+)"/);
        if (nameMatch) return nameMatch[1];

        // Otherwise just use first few words
        const words = input.split(' ').slice(0, 3).join(' ');
        return words.charAt(0).toUpperCase() + words.slice(1);
    };

    const extractGenre = (input: string): string => {
        // Look for common genre keywords
        const genres = [
            'platformer', 'puzzle', 'action', 'adventure', 'rpg',
            'shooter', 'strategy', 'simulation', 'sports', 'racing'
        ];

        const lowerInput = input.toLowerCase();
        for (const genre of genres) {
            if (lowerInput.includes(genre)) {
                return genre.charAt(0).toUpperCase() + genre.slice(1);
            }
        }

        return '';
    };

    const extractTargetAudience = (input: string): string => {
        // Look for audience keywords
        if (input.toLowerCase().includes('kids') ||
            input.toLowerCase().includes('children')) {
            return 'Kids (7-12)';
        }
        if (input.toLowerCase().includes('teen')) {
            return 'Teenagers (13-17)';
        }
        if (input.toLowerCase().includes('adult')) {
            return 'Adults (25+)';
        }

        return 'Everyone';
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        // Special handling for "test" command
        if (inputValue.trim().toLowerCase() === 'test') {
            // Create test messages for game analysis
            const userTestMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: 'Please analyze this test gameplay and provide feedback.'
            };

            const aiTestResponse = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `# Game Analysis (Test Mode)

## Game Mechanics Observed
- Platform jumping mechanics with gravity physics
- Coin collection system with score tracking
- Lives system (currently at 3)
- Simple character movement (left/right)

## Player Controls
- Character responds well to movement inputs
- Jump height seems appropriate for platform spacing
- Player movement speed is balanced

## Visual Elements
- Space-themed background with stars
- Green platforms with good contrast against background
- Collectible coins are clearly visible
- Score and lives display at the top of the screen

## Suggestions for Improvements
1. **Add More Game Elements:**
   - Enemy characters to avoid
   - Power-ups with special abilities
   - Moving platforms for additional challenge

2. **Enhanced Visual Feedback:**
   - Animation when collecting coins
   - Jump and landing animations
   - Visual effect when losing/gaining lives

3. **Game Progression:**
   - Multiple levels with increasing difficulty
   - Boss encounters at the end of levels
   - Save game progress functionality

Would you like me to implement any of these improvements?`
            };

            // Add the test messages to the chat
            setMessages(prev => [...prev, userTestMessage, aiTestResponse]);
            setInputValue('');
            return;
        }

        // Regular message handling continues below...
        const userMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
        };

        setMessages(prevMessages => [...prevMessages, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Prepare request body based on current mode
            const requestBody = {
                prompt: inputValue,
                currentCode,
                conversation: messages.map(msg => ({
                    sender: msg.role,
                    text: msg.content,
                    thinking: msg.thinking
                })),
                // Add mode parameter to determine type of generation
                mode: gddMode ? 'gdd' : 'code',
            };

            // Add GDD-specific fields if in GDD mode
            if (gddMode) {
                Object.assign(requestBody, {
                    gameIdea: inputValue,
                    gameName: extractGameName(inputValue),
                    genre: extractGenre(inputValue),
                    targetAudience: extractTargetAudience(inputValue)
                });
            }

            const response = await fetch('/api/generate-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            // Create new AI message with thinking content
            const newMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.message,
                thinking: data.thinking
            };

            setMessages(prev => [...prev, newMessage]);

            // Handle different types of responses
            if (gddMode && data.gdd && onGDDGenerated) {
                // If we're in GDD mode and have a GDD response, call the handler
                onGDDGenerated(data.gdd, data.thinking);
            } else if (data.code) {
                // Otherwise, handle code generation as usual
                onCodeGenerated(data.code);

                // Mark code as modified after AI generates code
                if (window && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('codeModified', { detail: { source: 'ai' } }));
                }
            }

        } catch (error) {
            console.error('Error sending message:', error);

            const errorMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Sorry, there was an error processing your request. Please try again.',
            };

            setMessages(prevMessages => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const autoResizeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    };

    useEffect(() => {
        const handleAddMessages = (event: CustomEvent) => {
            const { messages } = event.detail;
            if (Array.isArray(messages)) {
                setMessages(prev => [...prev, ...messages]);
            }
        };

        // Add event listener
        document.addEventListener('addMessages', handleAddMessages as EventListener);

        // Clean up
        return () => {
            document.removeEventListener('addMessages', handleAddMessages as EventListener);
        };
    }, []);

    // Expose methods to the parent component
    useImperativeHandle(ref, () => ({
        addMessages: (newMessages: Message[]) => {
            setMessages(prev => [...prev, ...newMessages]);
        }
    }));

    /**
     * Ensures the code is a valid string and properly formatted
     */
    const ensureCodeString = (input: any): string => {
        // First extract plain text if this is React children
        const extractedText = extractTextFromReactChildren(input);

        // Ensure it's a string
        const textString = typeof extractedText === 'string'
            ? extractedText
            : String(extractedText || '');

        // Clean up common issues
        return textString
            .replace(/^\s+|\s+$/g, '') // Trim whitespace
            .replace(/\\n/g, '\n');    // Replace literal \n with actual newlines
    };

    return (
        <div className={styles.chatContainer} data-testid="chat-component">
            <div className={styles.messagesContainer}>
                {messages.map(message => (
                    <div
                        key={message.id}
                        className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.aiMessage}`}
                    >
                        <div
                            className={`${styles.messageHeader} ${message.role === 'user' ? styles.userMessageHeader : styles.aiMessageHeader}`}
                        >
                            {message.role === 'user' ? 'You' : 'AI Assistant'}
                        </div>
                        <div className={styles.messageContent}>
                            {message.thinking && (
                                <div className={styles.thinkingBlock}>
                                    <details>
                                        <summary>AI Reasoning Process</summary>
                                        <pre className={styles.thinking}>{message.thinking}</pre>
                                    </details>
                                </div>
                            )}
                            <ReactMarkdown
                                rehypePlugins={[rehypeHighlight]}
                                components={{
                                    p: ({ node, ...props }) => <p className={styles.paragraph} {...props} />,
                                    pre: ({ node, ...props }) => <pre className={styles.codeBlock} {...props} />,
                                    code: ({ node, inline, className, children, ...props }) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const lang = match && match[1] ? match[1] : '';

                                        if (!inline && (lang === 'js' || lang === 'javascript')) {
                                            // Use our helper to extract the actual code text
                                            const codeText = extractTextFromReactChildren(children);

                                            console.log('Code block extracted:', {
                                                type: typeof codeText,
                                                preview: codeText.substring(0, 50)
                                            });

                                            return (
                                                <div className={styles.codeBlockContainer}>
                                                    <pre className={styles.pre}>
                                                        <code className={styles.code} {...props}>
                                                            {children}
                                                        </code>
                                                    </pre>
                                                    <div className={styles.codeActions}>
                                                        <button
                                                            className={styles.applyCodeButton}
                                                            onClick={() => {
                                                                const safeCode = ensureCodeString(children);
                                                                console.log('Applying code (safe):', safeCode.substring(0, 100));
                                                                onCodeGenerated(safeCode);
                                                            }}
                                                        >
                                                            Apply Code
                                                        </button>
                                                        <button
                                                            className={styles.viewFullCodeButton}
                                                            onClick={() => {
                                                                const safeCode = ensureCodeString(children);
                                                                // Create a temporary modal or expand the code view
                                                                const modal = document.createElement('div');
                                                                modal.className = styles.codeModal;

                                                                const modalContent = document.createElement('div');
                                                                modalContent.className = styles.codeModalContent;

                                                                const closeBtn = document.createElement('button');
                                                                closeBtn.innerText = 'Close';
                                                                closeBtn.className = styles.closeModalButton;
                                                                closeBtn.onclick = () => document.body.removeChild(modal);

                                                                const codeDisplay = document.createElement('pre');
                                                                codeDisplay.innerHTML = `<code class="${styles.code}">${safeCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;
                                                                codeDisplay.className = styles.fullCodePre;

                                                                modalContent.appendChild(closeBtn);
                                                                modalContent.appendChild(codeDisplay);
                                                                modal.appendChild(modalContent);
                                                                document.body.appendChild(modal);
                                                            }}
                                                        >
                                                            View Full Code
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return inline ? (
                                            <code className={styles.inlineCode} {...props}>
                                                {children}
                                            </code>
                                        ) : (
                                            <pre className={styles.pre}>
                                                <code className={styles.code} {...props}>
                                                    {children}
                                                </code>
                                            </pre>
                                        );
                                    }
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className={`${styles.message} ${styles.aiMessage}`}>
                        <div className={`${styles.messageHeader} ${styles.aiMessageHeader}`}>
                            AI Assistant
                        </div>
                        <div className={styles.messageContent}>
                            <p>Thinking...</p>
                        </div>
                    </div>
                )}
                {isAnalyzing && (
                    <div className={`${styles.message} ${styles.aiMessage}`}>
                        <div className={`${styles.messageHeader} ${styles.aiMessageHeader}`}>
                            AI Assistant
                        </div>
                        <div className={styles.messageContent}>
                            <p>Analyzing gameplay video... This may take a moment.</p>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {supportGDD && (
                <div className={styles.modeToggleContainer}>
                    <button
                        className={`${styles.modeToggle} ${!gddMode ? styles.activeModeToggle : ''}`}
                        onClick={() => setGDDMode(false)}
                    >
                        Code Generator
                    </button>
                    <button
                        className={`${styles.modeToggle} ${gddMode ? styles.activeModeToggle : ''}`}
                        onClick={() => setGDDMode(true)}
                    >
                        Game Designer
                    </button>
                </div>
            )}
            <div className={styles.inputContainer}>
                <textarea
                    className={styles.input}
                    value={inputValue}
                    onChange={(e) => {
                        handleInputChange(e);
                        autoResizeTextarea(e);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={gddMode ? "Describe your game idea..." : "Describe what you want to create..."}
                    rows={1}
                    onFocus={(e) => {
                        if (preventFocusChange) {
                            e.target.blur();
                        }
                    }}
                />
                <button
                    className={styles.sendButton}
                    onClick={handleSendMessage}
                    disabled={inputValue.trim() === '' || isLoading}
                >
                    {isLoading ? 'Sending...' : 'Send'}
                </button>
            </div>
        </div>
    );
});

// Display name for debugging
Chat.displayName = 'Chat';

export default Chat;