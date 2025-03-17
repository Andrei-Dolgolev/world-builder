// Create a debugging module

export const debugCaptureStatus = (targetRef: React.RefObject<HTMLIFrameElement>, canvasRef: React.RefObject<HTMLCanvasElement>) => {
    console.group('Game Analysis Debug Info');

    // Check if refs exist
    console.log('Target iframe ref exists:', !!targetRef.current);
    console.log('Canvas ref exists:', !!canvasRef.current);

    if (targetRef.current && canvasRef.current) {
        const iframe = targetRef.current;
        const canvas = canvasRef.current;

        // Check iframe dimensions
        const { width, height } = iframe.getBoundingClientRect();
        console.log('Iframe dimensions:', { width, height });

        // Check iframe content
        console.log('Iframe src:', iframe.src);
        console.log('Iframe sandbox attributes:', iframe.sandbox);

        // Check canvas dimensions
        console.log('Canvas dimensions:', { width: canvas.width, height: canvas.height });

        // Try to draw and report result
        try {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(iframe, 0, 0, canvas.width, canvas.height);
                console.log('Canvas drawing succeeded');

                // Check if canvas has valid content
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const hasContent = imageData.data.some(pixel => pixel !== 0);
                console.log('Canvas has visible content:', hasContent);
            } else {
                console.log('Failed to get canvas context');
            }
        } catch (error) {
            console.log('Canvas drawing failed:', error);
        }
    }

    console.groupEnd();
}; 