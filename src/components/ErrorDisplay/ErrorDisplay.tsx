import React from 'react';
import { AlertTriangle, XCircle, X } from 'lucide-react';
import { AppError, formatError } from '@/utils/errorHandler';
import styles from './ErrorDisplay.module.css';

interface ErrorDisplayProps {
    errors: AppError[];
    onDismiss: (id: string) => void;
    onDismissAll: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ errors, onDismiss, onDismissAll }) => {
    if (errors.length === 0) return null;

    return (
        <div className={styles.errorContainer}>
            <div className={styles.errorHeader}>
                <h3>
                    <AlertTriangle size={16} />
                    {errors.length === 1 ? '1 Error' : `${errors.length} Errors`}
                </h3>
                <button onClick={onDismissAll} className={styles.dismissAllButton}>
                    Clear All
                </button>
            </div>
            <div className={styles.errorList}>
                {errors.map(error => (
                    <div
                        key={error.id}
                        className={`${styles.errorItem} ${styles[error.severity]} ${styles[error.source]}`}
                    >
                        <div className={styles.errorContent}>
                            <div className={styles.errorMessage}>
                                {error.severity === 'error' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                                <span>{formatError(error)}</span>
                            </div>
                            {error.details && (
                                <div className={styles.errorDetails}>
                                    {error.details}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => onDismiss(error.id)}
                            className={styles.dismissButton}
                            aria-label="Dismiss error"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ErrorDisplay; 