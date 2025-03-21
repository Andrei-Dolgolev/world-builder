import { getTemplateCode } from '@/utils/templates';

export interface CodeState {
    code: string;
    isModified: boolean;
    currentTemplate: string | null;
    previewKey: number;
    errors: AppError[];
}

export type CodeAction =
    | { type: 'SET_CODE'; payload: string }
    | { type: 'LOAD_TEMPLATE'; payload: string }
    | { type: 'RESET_CODE' }
    | { type: 'REFRESH_PREVIEW' }
    | { type: 'ADD_ERROR'; payload: Omit<AppError, 'id' | 'timestamp'> }
    | { type: 'REMOVE_ERROR'; payload: string }
    | { type: 'CLEAR_ERRORS' };

export const initialCodeState: CodeState = {
    code: '',
    isModified: false,
    currentTemplate: null,
    previewKey: 0,
    errors: []
};

export function codeReducer(state: CodeState, action: CodeAction): CodeState {
    switch (action.type) {
        case 'SET_CODE':
            return {
                ...state,
                code: typeof action.payload === 'string'
                    ? action.payload
                    : String(action.payload),
                isModified: true
            };

        case 'LOAD_TEMPLATE':
            try {
                const templateCode = getTemplateCode(action.payload);
                const safeTemplateCode = typeof templateCode === 'string'
                    ? templateCode
                    : JSON.stringify(templateCode);

                return {
                    ...state,
                    code: safeTemplateCode,
                    currentTemplate: action.payload,
                    isModified: false,
                    previewKey: state.previewKey + 1
                };
            } catch (error) {
                console.error("Error loading template:", error);
                return {
                    ...state,
                    code: '// Error loading template',
                    isModified: true,
                    // Add error to errors array
                    errors: [...state.errors, {
                        id: Date.now().toString(),
                        message: `Failed to load template: ${action.payload}`,
                        source: 'editor',
                        severity: 'error',
                        timestamp: Date.now()
                    }]
                };
            }

        case 'RESET_CODE':
            if (state.currentTemplate) {
                try {
                    const templateCode = getTemplateCode(state.currentTemplate);
                    // Ensure template code is a string
                    const safeTemplateCode = typeof templateCode === 'string'
                        ? templateCode
                        : String(templateCode || '');

                    return {
                        ...state,
                        code: safeTemplateCode,
                        isModified: false,
                        previewKey: state.previewKey + 1
                    };
                } catch (error) {
                    console.error("Error resetting to template:", error);
                    return state;
                }
            }
            return {
                ...state,
                code: '',
                isModified: false
            };

        case 'REFRESH_PREVIEW':
            return {
                ...state,
                previewKey: state.previewKey + 1
            };

        case 'ADD_ERROR':
            return {
                ...state,
                errors: [...state.errors, {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    ...action.payload
                }]
            };

        case 'REMOVE_ERROR':
            return {
                ...state,
                errors: state.errors.filter(error => error.id !== action.payload)
            };

        case 'CLEAR_ERRORS':
            return {
                ...state,
                errors: []
            };

        default:
            return state;
    }
} 