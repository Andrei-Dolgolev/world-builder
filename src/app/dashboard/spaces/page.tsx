import { Suspense } from 'react';
import SubdomainManager from '@/components/SubdomainManager';

export const metadata = {
    title: 'Manage Your Spaces | WorldBuilder',
    description: 'Create and manage your custom WorldBuilder spaces with personalized subdomains',
};

export default function SpacesPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4 py-8">
                <h1 className="sr-only">Manage Your WorldBuilder Spaces</h1>

                <Suspense fallback={<div className="text-center py-10">Loading your spaces...</div>}>
                    <SubdomainManager />
                </Suspense>
            </div>
        </div>
    );
} 