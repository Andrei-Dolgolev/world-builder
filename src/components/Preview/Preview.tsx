import React, { useEffect, useRef, useState } from 'react';
import styles from './Preview.module.css';
import GameRecorder from '../GameRecorder/GameRecorder';

interface PreviewProps {
  code: string;
  onError: (error: any) => void;
  onGameplayAnalysisRequested?: (recording: Blob) => void;
}

const Preview: React.FC<PreviewProps> = ({ code, onError, onGameplayAnalysisRequested }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const hasReportedErrorRef = useRef<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isIframeFocused, setIsIframeFocused] = useState<boolean>(false);

  // Add event handlers to manage focus state
  const handleIframeFocus = () => {
    setIsIframeFocused(true);
  };

  const handleIframeBlur = () => {
    setIsIframeFocused(false);
  };

  // Add click handler to manage focus on container click
  const handleContainerClick = (e: React.MouseEvent) => {
    // Only handle clicks directly on the container (not on iframe or other elements)
    if (e.target === e.currentTarget) {
      setIsIframeFocused(false);

      // Ensure the event doesn't propagate to prevent unwanted behaviors
      e.stopPropagation();
    }
  };

  // Reset and run the game again
  const handleRestartGame = () => {
    setError(null);
    hasReportedErrorRef.current = false;
    setIsRunning(true);

    // Re-render the iframe with current code
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      iframe.src = "about:blank";
      setTimeout(() => {
        if (iframeRef.current) {
          setupIframe(iframeRef.current, code);
        }
      }, 100);
    }
  };

  // Function to set up the iframe content
  const setupIframe = (iframe: HTMLIFrameElement, gameCode: string) => {
    try {
      // Create HTML content with better game support
      const htmlContent = `
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
              background: white; 
              overflow: hidden; 
              width: 100%; 
              height: 100vh; 
              display: flex; 
              justify-content: center; 
              align-items: center;
            }
            canvas { 
              display: block; 
              margin: 0 auto; 
            }
            #error-display {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              background: rgba(255, 0, 0, 0.8);
              color: white;
              padding: 10px;
              font-family: monospace;
              white-space: pre-wrap;
              max-height: 30%;
              overflow-y: auto;
              z-index: 1000;
            }
            .execution-paused {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: rgba(0, 0, 0, 0.7);
              color: white;
              text-align: center;
              padding: 10px;
              font-family: sans-serif;
              z-index: 1001;
            }
            #stats {
              position: fixed;
              top: 0;
              right: 0;
              background: rgba(0, 0, 0, 0.5);
              color: white;
              padding: 5px;
              font-family: monospace;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div id="game-container"></div>
          <div id="stats"></div>
          <script>
            // Error handling system
            let hasReportedError = false;
            
            window.onerror = function(message, source, lineno, colno, error) {
              if (hasReportedError) return true; // Only report the first error
              
              hasReportedError = true;
              
              // Report errors to parent window
              if (window.parent && window.parent.postMessage) {
                window.parent.postMessage({
                  type: 'error',
                  message: message,
                  source: source,
                  lineno: lineno,
                  colno: colno,
                  stack: error ? error.stack : 'No stack trace available'
                }, '*');
              }
              
              // Display error in the iframe
              const errorDisplay = document.createElement('div');
              errorDisplay.id = 'error-display';
              errorDisplay.textContent = message + (error ? '\\n\\n' + error.stack : '');
              document.body.appendChild(errorDisplay);
              
              // Add a notice that execution has been paused
              const pauseNotice = document.createElement('div');
              pauseNotice.className = 'execution-paused';
              pauseNotice.textContent = 'Game execution paused due to error. See error below.';
              document.body.appendChild(pauseNotice);
              
              // Try to gracefully stop the game
              if (window.game) {
                try {
                  window.game.destroy(true);
                } catch (e) {
                  console.error('Failed to destroy game instance:', e);
                }
              }
              
              return true; // Prevent default error handling
            };

            // Setup performance monitoring for complex games
            let frameCount = 0;
            let lastTime = performance.now();
            let fps = 0;
            
            function updateStats() {
              frameCount++;
              const now = performance.now();
              
              if (now - lastTime >= 1000) {
                fps = Math.round((frameCount * 1000) / (now - lastTime));
                frameCount = 0;
                lastTime = now;
                
                const statsEl = document.getElementById('stats');
                if (statsEl) {
                  // Get memory usage if available
                  let memoryInfo = '';
                  if (performance && performance.memory) {
                    const usedHeap = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
                    const totalHeap = Math.round(performance.memory.totalJSHeapSize / (1024 * 1024));
                    memoryInfo = \` | Memory: \${usedHeap}MB/\${totalHeap}MB\`;
                  }
                  
                  statsEl.textContent = \`FPS: \${fps}\${memoryInfo}\`;
                }
              }
              
              if (!hasReportedError) {
                requestAnimationFrame(updateStats);
              }
            }
            
            requestAnimationFrame(updateStats);
            
            // Allow parent window communication
            window.addEventListener('message', function(event) {
              if (event.data && event.data.type === 'restart') {
                location.reload();
              }
            });

            // Run the game code
            try {
              ${gameCode}
            } catch (error) {
              window.onerror(error.message, null, null, null, error);
            }
          </script>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);

      // Set the iframe src to the blob URL
      iframe.src = blobUrl;
      return blobUrl;
    } catch (err: any) {
      console.error('Error setting up preview:', err);
      setError(`Error setting up preview: ${err.message}`);

      if (!hasReportedErrorRef.current) {
        hasReportedErrorRef.current = true;
        onError({
          message: `Error setting up preview: ${err.message}`,
          stack: err.stack
        });
      }
      return null;
    }
  };

  // Initial setup when code changes
  useEffect(() => {
    if (!iframeRef.current) return;

    // Reset state
    setError(null);
    hasReportedErrorRef.current = false;
    setIsRunning(true);

    // Safety check - ensure code is a string
    const safeCode = typeof code === 'string' ? code :
      typeof code === 'object' ? JSON.stringify(code, null, 2) :
        String(code);

    const iframe = iframeRef.current;
    const blobUrl = setupIframe(iframe, safeCode);

    // Clean up blob URL when component unmounts or code changes
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [code]);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'error' && !hasReportedErrorRef.current) {
        hasReportedErrorRef.current = true;
        setIsRunning(false);

        const errorDetails = {
          message: event.data.message,
          source: event.data.source,
          lineno: event.data.lineno,
          colno: event.data.colno,
          stack: event.data.stack || ''
        };

        const errorMessage = `${errorDetails.message}\n\nLine: ${errorDetails.lineno}, Column: ${errorDetails.colno}\n\n${errorDetails.stack}`;

        setError(errorMessage);
        onError(errorDetails);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onError]);

  const handleRecordingComplete = (recording: Blob) => {
    if (onGameplayAnalysisRequested) {
      onGameplayAnalysisRequested(recording);
    }
  };

  return (
    <div className={styles.preview}>
      <div className={styles.previewHeader}>
        <h3>Game Preview</h3>
        <div className={styles.previewControls}>
          <button
            className={styles.restartButton}
            onClick={handleRestartGame}
            title="Restart Game"
          >
            ↻ Restart
          </button>
        </div>
      </div>
      <div
        className={`${styles.iframeContainer} ${isIframeFocused ? styles.focused : ''}`}
        onClick={handleContainerClick}
      >
        <iframe
          ref={iframeRef}
          className={styles.iframe}
          title="Game Preview"
          sandbox="allow-scripts allow-same-origin"
          onFocus={handleIframeFocus}
          onBlur={handleIframeBlur}
        />
        {error && (
          <div className={styles.error}>
            <div className={styles.errorHeader}>
              Game Error Detected
              <div>
                <button
                  className={styles.errorFixButton}
                  onClick={() => {
                    hasReportedErrorRef.current = false;
                    onError({
                      message: "Error reported by user action",
                      details: error
                    });
                  }}
                >
                  Fix Error
                </button>
                <button
                  className={styles.restartButton}
                  onClick={handleRestartGame}
                >
                  Restart
                </button>
              </div>
            </div>
            <pre>{error}</pre>
          </div>
        )}
      </div>

      <GameRecorder
        targetRef={iframeRef}
        onRecordingComplete={handleRecordingComplete}
        gameCode={code}
      />
    </div>
  );
};

export default Preview; 