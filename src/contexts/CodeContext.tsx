import React, { createContext, useContext, useReducer, useMemo, ReactNode } from 'react';
import { codeReducer, initialCodeState, CodeState, CodeAction } from './codeReducer';
import { AppError } from '@/utils/errorHandler';

interface CodeContextValue extends CodeState {
    setCode: (code: string) => void;
    loadTemplate: (templateId: string) => void;
    resetCode: () => void;
    refreshPreview: () => void;
    addError: (error: Omit<AppError, 'id' | 'timestamp'>) => void;
    clearErrors: () => void;
    removeError: (id: string) => void;
}

const CodeContext = createContext<CodeContextValue | undefined>(undefined);

interface CodeProviderProps {
    children: ReactNode;
    initialCode?: string;
    initialTemplate?: string;
}

export const CodeProvider: React.FC<CodeProviderProps> = ({
    children,
    initialCode = '',
    initialTemplate = null
}) => {
    // Initialize state with custom initial values if provided
    const customInitialState = {
        ...initialCodeState,
        code: initialCode || initialCodeState.code,
        currentTemplate: initialTemplate || initialCodeState.currentTemplate
    };

    const [state, dispatch] = useReducer(codeReducer, customInitialState);

    // Memoize context value to prevent unnecessary rerenders
    const contextValue = useMemo(() => ({
        ...state,
        setCode: (newCode: string) => {
            if (typeof newCode !== 'string') {
                console.error('setCode received non-string value:', newCode);
                // Convert to string or use empty string
                newCode = String(newCode) || '';
            }
            dispatch({ type: 'SET_CODE', payload: newCode });
        },
        loadTemplate: (templateId: string) => dispatch({ type: 'LOAD_TEMPLATE', payload: templateId }),
        resetCode: () => dispatch({ type: 'RESET_CODE' }),
        refreshPreview: () => dispatch({ type: 'REFRESH_PREVIEW' }),
        addError: (error: Omit<AppError, 'id' | 'timestamp'>) => dispatch({ type: 'ADD_ERROR', payload: error }),
        clearErrors: () => dispatch({ type: 'CLEAR_ERRORS' }),
        removeError: (id: string) => dispatch({ type: 'REMOVE_ERROR', payload: id })
    }), [state]);

    // Load initial template once on mount
    React.useEffect(() => {
        if (initialTemplate && !state.isModified) {
            dispatch({ type: 'LOAD_TEMPLATE', payload: initialTemplate });
        }
    }, []);

    return (
        <CodeContext.Provider value={contextValue}>
            {children}
        </CodeContext.Provider>
    );
};

export const useCode = (): CodeContextValue => {
    const context = useContext(CodeContext);
    if (context === undefined) {
        throw new Error('useCode must be used within a CodeProvider');
    }
    return context;
}; 