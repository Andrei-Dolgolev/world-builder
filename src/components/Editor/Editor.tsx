import React, { useEffect, useState, useCallback } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui';
import styles from './Editor.module.css';
import { useCode } from '@/contexts/CodeContext';
import eventBus from '@/utils/eventBus';
import { useEventListener } from '@/hooks/useEventListener';
import MonacoEditorWrapper from './MonacoEditorWrapper';
import { debugLog } from '@/utils/debugLogger';

interface EditorProps { }

const Editor: React.FC<EditorProps> = () => {
    const { code, setCode } = useCode();

    debugLog('Editor-Initial', code);

    // Make sure we have a string
    const initialCode = typeof code === 'string' ? code : String(code || '');
    const [codeState, setCodeState] = useState(initialCode);
    const [isLocalEdit, setIsLocalEdit] = useState(false);

    // Sync code changes from context
    useEffect(() => {
        if (!isLocalEdit) {
            debugLog('Editor-ContextUpdate', code);
            const safeCode = typeof code === 'string' ? code : String(code || '');
            setCodeState(safeCode);
        }
    }, [code, isLocalEdit]);

    const handleCodeChange = (value: string) => {
        debugLog('Editor-HandleChange', value);
        setCodeState(value);
        setIsLocalEdit(true);
    };

    const handleSaveChanges = () => {
        debugLog('Editor-SaveChanges', codeState);
        setCode(codeState);
        setIsLocalEdit(false);
        eventBus.emit('code:updated', { source: 'editor', manual: true, timestamp: Date.now() });
    };

    // Auto-save code changes after a delay
    useEffect(() => {
        if (isLocalEdit) {
            const timer = setTimeout(() => {
                handleSaveChanges();
            }, 1000); // 1 second delay for auto-save

            return () => clearTimeout(timer);
        }
    }, [codeState, isLocalEdit]);

    // Listen for template loaded events
    useEventListener('template:loaded', (data) => {
        if (data && data.code) {
            setIsLocalEdit(false);
        }
    });

    return (
        <div className={styles.editorContainer}>
            <div className={styles.editorControls}>
                {isLocalEdit && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveChanges}
                        className={styles.saveButton}
                    >
                        <Save size={16} className={styles.buttonIcon} />
                        Save Changes
                    </Button>
                )}
            </div>
            <MonacoEditorWrapper
                value={codeState}
                onChange={handleCodeChange}
                language="javascript"
                theme="vs-dark"
            />
        </div>
    );
};

export default Editor; 