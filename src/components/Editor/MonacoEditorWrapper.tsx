import React from 'react';
import MonacoEditor, { OnChange } from '@monaco-editor/react';

interface MonacoEditorWrapperProps {
    value: string;
    onChange: (value: string) => void;
    language?: string;
    theme?: string;
    options?: Record<string, any>;
    height?: string | number;
}

const MonacoEditorWrapper: React.FC<MonacoEditorWrapperProps> = ({
    value,
    onChange,
    language = 'javascript',
    theme = 'vs-dark',
    options = {},
    height = '100%'
}) => {
    // Ensure value is always a string
    const safeValue = typeof value === 'string' ? value : String(value || '');

    // Create a safe onChange handler that always passes a string
    const handleChange = (newValue: string | undefined) => {
        // Always provide a string to the parent component
        onChange(newValue || '');
    };

    console.log("Monaco editor receiving value type:", typeof value);

    return (
        <MonacoEditor
            height={height}
            language={language}
            theme={theme}
            value={safeValue}
            onChange={handleChange as OnChange}
            options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                automaticLayout: true,
                ...options
            }}
        />
    );
};

export default MonacoEditorWrapper; 