import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/Layout/MainLayout';
import { getTemplateCode } from '../../components/Templates/phaserTemplates';

export default function NewProject() {
    const router = useRouter();
    const { template } = router.query;
    const [code, setCode] = useState('');

    useEffect(() => {
        if (template && typeof template === 'string') {
            // Load template code
            const templateCode = getTemplateCode(template);
            setCode(templateCode);
        }
    }, [template]);

    return (
        <MainLayout initialCode={code} />
    );
} 