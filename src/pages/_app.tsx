import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import 'highlight.js/styles/github-dark.css';
import { CodeProvider } from '@/contexts/CodeContext';

export default function App({ Component, pageProps }: AppProps) {
    return (
        <CodeProvider>
            <Component {...pageProps} />
        </CodeProvider>
    );
} 