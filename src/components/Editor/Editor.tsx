import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import styles from './Editor.module.css';

interface EditorProps {
    code: string;
    onChange: (value: string) => void;
}

const Editor: React.FC<EditorProps> = ({ code, onChange }) => {
    return (
        <div className={styles.editorContainer}>
            <MonacoEditor
                height="100%"
                language="javascript"
                theme="vs-dark"
                value={code}
                onChange={(value) => onChange(value || '')}
                options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    automaticLayout: true,
                }}
            />
        </div>
    );
};

export default Editor; 