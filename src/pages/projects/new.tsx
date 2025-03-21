import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { templates } from '@/data/templates';
import dynamic from 'next/dynamic';
import { useCode } from '@/contexts/CodeContext';

// Dynamically import MainLayout with SSR disabled
const MainLayout = dynamic(
    () => import('../../components/Layout/MainLayout'),
    { ssr: false }
);

export default function NewProject() {
    const [projectName, setProjectName] = useState('');
    const { loadTemplate, code } = useCode();
    const router = useRouter();

    useEffect(() => {
        // Get template from URL if provided
        const templateParam = router.query.template as string;
        if (templateParam && templates.find(t => t.id === templateParam) && !code) {
            loadTemplate(templateParam);
            console.log("Loading template from URL:", templateParam);
        }
    }, [router.query, loadTemplate, code]);

    return (
        <MainLayout />
    );
} 