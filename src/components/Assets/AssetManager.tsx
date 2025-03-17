import React, { useState, useEffect } from 'react';
import AssetUploader from './AssetUploader';
import AssetBrowser from './AssetBrowser';
import styles from './AssetManager.module.css';

interface Asset {
    id: string;
    name: string;
    type: 'image' | 'audio' | 'spritesheet' | 'other';
    path: string;
    uploadedAt: string;
}

interface AssetManagerProps {
    onAssetSelect: (asset: Asset) => void;
}

const AssetManager: React.FC<AssetManagerProps> = ({ onAssetSelect }) => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'images' | 'audio' | 'other'>('all');

    const fetchAssets = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/assets');
            const data = await response.json();
            setAssets(data);
        } catch (error) {
            console.error('Failed to fetch assets:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, []);

    const handleAssetUpload = (newAsset: Asset) => {
        setAssets((prevAssets) => [...prevAssets, newAsset]);
    };

    const handleAssetDelete = async (id: string) => {
        try {
            await fetch(`/api/assets/${id}`, { method: 'DELETE' });
            setAssets((prevAssets) => prevAssets.filter((asset) => asset.id !== id));
        } catch (error) {
            console.error('Failed to delete asset:', error);
        }
    };

    const filteredAssets = assets.filter((asset) => {
        if (activeTab === 'all') return true;
        return asset.type === activeTab;
    });

    return (
        <div className={styles.assetManager}>
            <div className={styles.header}>
                <h2>Asset Manager</h2>
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'images' ? styles.active : ''}`}
                        onClick={() => setActiveTab('images')}
                    >
                        Images
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'audio' ? styles.active : ''}`}
                        onClick={() => setActiveTab('audio')}
                    >
                        Audio
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'other' ? styles.active : ''}`}
                        onClick={() => setActiveTab('other')}
                    >
                        Other
                    </button>
                </div>
            </div>

            <AssetUploader onAssetUpload={handleAssetUpload} />

            <AssetBrowser
                assets={filteredAssets}
                isLoading={isLoading}
                onAssetSelect={onAssetSelect}
                onAssetDelete={handleAssetDelete}
            />
        </div>
    );
};

export default AssetManager; 