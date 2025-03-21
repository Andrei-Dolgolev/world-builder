import templateStrings from '@/data/templateStrings.json';
import { debugLog } from './debugLogger';

// Define the templates object (it was missing)
const templates: Record<string, string> = {
    ...templateStrings,
    'custom': '// Write your custom game code here',
    'empty': '// No template selected'
};

export const getTemplateCode = (templateId: string): string => {
    const template = templates[templateId];

    if (!template) {
        console.error(`Template not found: ${templateId}, using empty template`);
        return templates['empty'];
    }

    debugLog('TemplateLoading', {
        templateId,
        templateType: typeof template,
        preview: typeof template === 'string' ? template.substring(0, 30) : String(template).substring(0, 30)
    });

    return typeof template === 'string' ? template : String(template);
}; 