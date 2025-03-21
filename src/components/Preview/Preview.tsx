import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, Video } from 'lucide-react';
import { Button } from '@/components/ui';
import styles from './Preview.module.css';
import { useCode } from '@/contexts/CodeContext';
import eventBus from '@/utils/eventBus';
import { useEventListener } from '@/hooks/useEventListener';

interface PreviewProps {
  onRestartGame?: () => void;
  onError?: (error: any) => void;
  onGameplayAnalysisRequested?: (recording: Blob) => void;
}

const Preview: React.FC<PreviewProps> = ({ onRestartGame, onError, onGameplayAnalysisRequested }) => {
  const { code, previewKey, refreshPreview, addError } = useCode();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('initializing');
  const [currentCode, setCurrentCode] = useState('');
  const [frameKey, setFrameKey] = useState(0);

  // Generate HTML content for the preview
  const generatePreviewHTML = useCallback((code: string) => {
    // Safety check - if no code or empty code, use a minimal working example
    const codeToExecute = code && code.trim() ? code : `
      class EmptyScene extends Phaser.Scene {
        constructor() {
          super({ key: 'EmptyScene' });
        }
        
        create() {
          this.add.text(400, 300, 'No game code provided.\\nEdit code in the Code tab.', {
            fontSize: '24px',
            color: '#ffffff',
            align: 'center'
          }).setOrigin(0.5);
        }
      }
      
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        scene: [EmptyScene]
      });`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Game Preview</title>
          <script src="https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js"></script>
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #2a2a2a;
              overflow: hidden;
            }
            canvas {
              display: block;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <script>
            // Setup messaging to parent
            window.addEventListener('load', function() {
              window.parent.postMessage({ type: 'dom-ready' }, '*');
            });
            
            // Error handling
            window.onerror = function(message, source, lineno, colno, error) {
              window.parent.postMessage({ 
                type: 'game-error', 
                error: { message, source, lineno, colno, stack: error?.stack } 
              }, '*');
              return true; // Prevent default error handling
            };
            
            // Execute the game code
            try {
              window.parent.postMessage({ type: 'executing-code' }, '*');
              ${codeToExecute}
              window.parent.postMessage({ type: 'code-executed' }, '*');
              
              // Signal when Phaser is ready
              if (typeof game !== 'undefined') {
                game.events.once('ready', function() {
                  window.parent.postMessage({ type: 'game-loaded' }, '*');
                });
              } else {
                // Fallback if game variable is not exposed
                setTimeout(function() {
                  window.parent.postMessage({ type: 'game-loaded' }, '*');
                }, 1000);
              }
            } catch (error) {
              console.error('Error in game code:', error);
              window.onerror(error.message, null, null, null, error);
            }
          </script>
        </body>
      </html>
    `;
  }, []);

  // Listen for force-refresh events
  useEventListener('preview:refresh', () => {
    setFrameKey(prev => prev + 1);
    setIsLoading(true);
    setLoadingStatus('Reloading preview...');
  });

  // Make sure we have the latest code when rendering
  useEffect(() => {
    // Ensure code is a string
    const safeCode = typeof code === 'string' ? code : String(code || '');
    setCurrentCode(safeCode);

    // Signal loading state
    setIsLoading(true);
    setLoadingStatus('Reloading preview...');
    eventBus.emit('preview:loading');

    // Force iframe refresh
    setFrameKey(prevKey => prevKey + 1);
  }, [code, previewKey]);

  // Add this effect to update the iframe content when frameKey changes
  useEffect(() => {
    // Skip if we don't have a ref or code yet
    if (!iframeRef.current) return;

    // Generate and set HTML content
    const html = generatePreviewHTML(currentCode);
    iframeRef.current.srcdoc = html;
  }, [frameKey, currentCode, generatePreviewHTML]);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || !event.data.type) return;

      console.log('Preview received message:', event.data.type);

      switch (event.data.type) {
        case 'dom-ready':
          setLoadingStatus('DOM ready');
          break;
        case 'executing-code':
          setLoadingStatus('Executing game code');
          break;
        case 'code-executed':
          setLoadingStatus('Game initialized');
          break;
        case 'game-loaded':
          setIsLoading(false);
          setLoadingStatus('Game running');
          eventBus.emit('preview:ready');
          break;
        case 'game-error':
          setLoadingStatus(`Error: ${event.data.error.message}`);
          if (onError) onError(event.data.error);
          // Add to error handling system
          addError({
            message: event.data.error.message,
            source: 'preview',
            severity: 'error'
          });
          eventBus.emit('error:occurred', event.data.error);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onError, addError]);

  const handleRefresh = () => {
    if (onRestartGame) {
      onRestartGame();
    } else {
      refreshPreview();
      eventBus.emit('preview:refresh');
    }
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      // Stop recording
    } else {
      setIsRecording(true);
      // Start recording
      // This is a placeholder for actual recording implementation
      setTimeout(() => {
        // Simulate finished recording after 3 seconds
        if (onGameplayAnalysisRequested) {
          // Create a mock Blob for this example
          const mockBlob = new Blob(["video data"], { type: 'video/webm' });
          onGameplayAnalysisRequested(mockBlob);
        }
        setIsRecording(false);
      }, 3000);
    }
  };

  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <h3>Game Preview</h3>
        <div className={styles.previewControls}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className={styles.restartButton}
          >
            <RefreshCw size={16} className={styles.buttonIcon} />
            Restart
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecordToggle}
            className={`${styles.recordButton} ${isRecording ? styles.recording : ''}`}
          >
            <Video size={16} className={styles.buttonIcon} />
            {isRecording ? 'Recording...' : 'Record'}
          </Button>
        </div>
      </div>
      {isLoading && (
        <div className={styles.previewLoading}>
          <div className={styles.spinner}></div>
          <p>Loading game preview... <span className={styles.loadingStatus}>{loadingStatus}</span></p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={frameKey}
        className={styles.previewFrame}
        title="Game Preview"
        sandbox="allow-scripts"
      />
    </div>
  );
};

export default Preview; 