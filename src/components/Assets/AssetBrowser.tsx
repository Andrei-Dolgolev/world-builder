import React from 'react';
import AssetItem from './AssetItem';
import styles from './AssetBrowser.module.css';

interface Asset {
    id: string;
    name: string;
    type: 'image' | 'audio' | 'spritesheet' | 'other';
    path: string;
    uploadedAt: string;
}

interface AssetBrowserProps {
    assets: Asset[];
    isLoading: boolean;
    onAssetSelect: (asset: Asset) => void;
    onAssetDelete: (id: string) => void;
}

const AssetBrowser: React.FC<AssetBrowserProps> = ({
    assets,
    isLoading,
    onAssetSelect,
    onAssetDelete
}) => {
    if (isLoading) {
        return <div className={styles.loading}>Loading assets...</div>;
    }

    if (assets.length === 0) {
        return <div className={styles.empty}>No assets found. Upload some assets to get started.</div>;
    }

    return (
        <div className={styles.browser}>
            <div className={styles.grid}>
                {assets.map((asset) => (
                    <AssetItem
                        key={asset.id}
                        asset={asset}
                        onSelect={() => onAssetSelect(asset)}
                        onDelete={() => onAssetDelete(asset.id)}
                    />
                ))}
            </div>
        </div>
    );
};

export default AssetBrowser; 