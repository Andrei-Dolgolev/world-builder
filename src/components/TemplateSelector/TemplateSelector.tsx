import React from 'react';
import { templates, GameTemplate } from '@/data/templates';
import { getTemplateCode } from '@/utils/templates';
import styles from './TemplateSelector.module.css';

interface TemplateSelectorProps {
    onSelectTemplate: (template: string, code: string) => void;
    currentTemplate: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
    onSelectTemplate,
    currentTemplate
}) => {
    const handleTemplateSelect = (templateId: string) => {
        try {
            const code = getTemplateCode(templateId);
            onSelectTemplate(templateId, code);
        } catch (error) {
            console.error("Error loading template:", error);
        }
    };

    return (
        <div className={styles.templateSelector}>
            <h3 className={styles.title}>Choose a Template</h3>
            <div className={styles.templateGrid}>
                {templates.map((template) => (
                    <div
                        key={template.id}
                        className={`${styles.templateCard} ${currentTemplate === template.id ? styles.selected : ''
                            }`}
                        onClick={() => handleTemplateSelect(template.id)}
                    >
                        <div className={styles.templatePreview}>
                            {template.imageUrl ? (
                                <img src={template.imageUrl} alt={template.name} />
                            ) : (
                                <div className={styles.placeholderImage}>
                                    <span>{template.name[0]}</span>
                                </div>
                            )}
                        </div>
                        <div className={styles.templateInfo}>
                            <h4>{template.name}</h4>
                            <span className={styles.difficulty}>{template.difficulty}</span>
                            <p>{template.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TemplateSelector; 