import React, { useState } from 'react';
import styles from './AssetItem.module.css';

interface Asset {
    id: string;
    name: string;
    type: 'image' | 'audio' | 'spritesheet' | 'other';
    path: string;
    uploadedAt: string;
}

interface AssetItemProps {
    asset: Asset;
    onSelect: () => void;
    onDelete: () => void;
}

const AssetItem: React.FC<AssetItemProps> = ({ asset, onSelect, onDelete }) => {
    const [showOptions, setShowOptions] = useState(false);

    const getAssetPreview = () => {
        if (asset.type === 'image') {
            return <img src={asset.path} alt={asset.name} className={styles.preview} />;
        } else if (asset.type === 'audio') {
            return (
                <div className={styles.audioPreview}>
                    <audio src={asset.path} controls />
                </div>
            );
        } else {
            return <div className={styles.genericPreview}>{asset.name.split('.').pop()?.toUpperCase()}</div>;
        }
    };

    const handleOptionsToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowOptions(!showOptions);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setShowOptions(false);
    };

    return (
        <div className={styles.assetItem} onClick={onSelect}>
            <div className={styles.previewContainer}>{getAssetPreview()}</div>
            <div className={styles.info}>
                <div className={styles.name}>{asset.name}</div>
                <div className={styles.type}>{asset.type}</div>
            </div>
            <button className={styles.options} onClick={handleOptionsToggle}>
                ⋮
            </button>
            {showOptions && (
                <div className={styles.optionsMenu}>
                    <button onClick={handleDelete} className={styles.deleteButton}>Delete</button>
                </div>
            )}
        </div>
    );
};

export default AssetItem; 