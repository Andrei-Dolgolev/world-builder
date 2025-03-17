import React, { useState, useRef } from 'react';
import styles from './AssetUploader.module.css';

interface Asset {
    id: string;
    name: string;
    type: 'image' | 'audio' | 'spritesheet' | 'other';
    path: string;
    uploadedAt: string;
}

interface AssetUploaderProps {
    onAssetUpload: (asset: Asset) => void;
}

const AssetUploader: React.FC<AssetUploaderProps> = ({ onAssetUpload }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadFiles(e.target.files);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const uploadFiles = async (files: FileList) => {
        setIsUploading(true);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/assets/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const asset = await response.json();
                    onAssetUpload(asset);
                } else {
                    console.error('Upload failed');
                }
            } catch (error) {
                console.error('Error uploading file:', error);
            }
        }

        setIsUploading(false);
    };

    return (
        <div
            className={`${styles.uploader} ${isDragging ? styles.dragging : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                multiple
            />

            {isUploading ? (
                <div className={styles.uploading}>
                    <span>Uploading...</span>
                </div>
            ) : (
                <div className={styles.uploadPrompt}>
                    <p>Drag and drop assets here</p>
                    <p>or</p>
                    <button onClick={handleButtonClick} className={styles.uploadButton}>
                        Browse Files
                    </button>
                    <p className={styles.supportedFormats}>
                        Supported formats: PNG, JPG, GIF, MP3, WAV, JSON
                    </p>
                </div>
            )}
        </div>
    );
};

export default AssetUploader; 