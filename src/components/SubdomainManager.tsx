import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react'; // If you're using NextAuth for auth
import { useToast } from '@/components/ui/use-toast'; // Assuming you have a toast component
import { Button } from '@/components/ui/button'; // Import your UI components
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Types
interface Subdomain {
    subdomain: string;
    url: string;
    created_at: number;
}

interface StatusMessage {
    message: string;
    isError: boolean;
    url?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://0bovsw927k.execute-api.us-west-2.amazonaws.com/prod';

const SubdomainManager: React.FC = () => {
    // Get user from auth if available, fallback to dummy ID for testing
    const { data: session } = useSession();
    const userId = session?.user?.id || 'user-' + Math.floor(Math.random() * 1000000);

    const { toast } = useToast();

    // State
    const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
    const [newSubdomain, setNewSubdomain] = useState('');
    const [htmlContent, setHtmlContent] = useState('<html><body><h1>My WorldBuilder Space</h1><p>Welcome to my custom space!</p></body></html>');
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
    const [checking, setChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    // Load user's subdomains on mount
    useEffect(() => {
        if (userId) {
            loadUserSubdomains();
        }
    }, [userId]);

    const loadUserSubdomains = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/domains');
            const data = await response.json();

            if (data.status === 'success') {
                setSubdomains(data.subdomains || []);
            } else {
                setStatusMessage({
                    message: data.message || 'Failed to load your spaces',
                    isError: true
                });
                toast({
                    title: 'Error',
                    description: data.message || 'Failed to load your spaces',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error loading subdomains:', error);
            setStatusMessage({
                message: error instanceof Error ? error.message : 'Unknown error',
                isError: true
            });
        } finally {
            setLoading(false);
        }
    };

    const checkSubdomainAvailability = async () => {
        if (!newSubdomain || newSubdomain.length < 3) {
            setStatusMessage({
                message: 'Subdomain must be at least 3 characters long',
                isError: true
            });
            return;
        }

        setChecking(true);
        try {
            const response = await fetch(`/api/domains/check?subdomain=${encodeURIComponent(newSubdomain)}`);
            const data = await response.json();

            setIsAvailable(data.available);
            setStatusMessage({
                message: data.message,
                isError: !data.available
            });
        } catch (error) {
            console.error('Error checking availability:', error);
            setStatusMessage({
                message: error instanceof Error ? `Error: ${error.message}` : 'Failed to check availability',
                isError: true
            });
        } finally {
            setChecking(false);
        }
    };

    const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setNewSubdomain(value);
        setIsAvailable(null);
    };

    const createSubdomain = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newSubdomain || !isAvailable) {
            return;
        }

        setLoading(true);
        setStatusMessage(null);

        try {
            const response = await fetch('/api/domains', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subdomain: newSubdomain,
                    htmlContent
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                setStatusMessage({
                    message: `Space created successfully!`,
                    isError: false,
                    url: data.url
                });

                toast({
                    title: 'Success!',
                    description: 'Your new space has been created',
                });

                // Clear form and refresh list
                setNewSubdomain('');
                setIsAvailable(null);
                loadUserSubdomains();
            } else {
                setStatusMessage({
                    message: data.message || 'Failed to create space',
                    isError: true
                });

                toast({
                    title: 'Error',
                    description: data.message || 'Failed to create space',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error creating subdomain:', error);
            setStatusMessage({
                message: error instanceof Error ? `Error: ${error.message}` : 'Failed to create space',
                isError: true
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Your WorldBuilder Spaces</h1>

            {subdomains.length > 0 ? (
                <div className="mb-10">
                    <h2 className="text-xl font-semibold mb-4">Your Spaces ({subdomains.length}/10)</h2>
                    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {subdomains.map(space => (
                            <Card key={space.subdomain}>
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold text-primary">
                                        {space.subdomain}.app.worldbuilder.space
                                    </CardTitle>
                                    <CardDescription>
                                        Created: {new Date(space.created_at * 1000).toLocaleString()}
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="flex justify-between">
                                    <Button variant="outline" asChild>
                                        <a
                                            href={space.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Visit Site
                                        </a>
                                    </Button>
                                    <Button variant="ghost">Edit Content</Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p>You haven't created any spaces yet. Get started below!</p>
                </div>
            )}

            {subdomains.length < 10 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Create New Space</CardTitle>
                        <CardDescription>
                            Create a custom subdomain with your own content
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={createSubdomain}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2" htmlFor="subdomain">
                                    Choose a Subdomain
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="flex flex-1">
                                        <Input
                                            id="subdomain"
                                            value={newSubdomain}
                                            onChange={handleSubdomainChange}
                                            placeholder="myspace"
                                            className="rounded-r-none"
                                            aria-label="Subdomain name"
                                        />
                                        <div className="inline-flex items-center px-3 py-2 text-sm border border-l-0 border-input bg-muted">
                                            .app.worldbuilder.space
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={checkSubdomainAvailability}
                                        disabled={!newSubdomain || checking}
                                    >
                                        {checking ? 'Checking...' : 'Check Availability'}
                                    </Button>
                                </div>

                                {isAvailable !== null && (
                                    <p className={`mt-2 text-sm ${isAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {isAvailable ? '✓ Available!' : '✗ Already taken'}
                                    </p>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2" htmlFor="content">
                                    HTML Content
                                </label>
                                <Textarea
                                    id="content"
                                    value={htmlContent}
                                    onChange={(e) => setHtmlContent(e.target.value)}
                                    rows={6}
                                    placeholder="Enter HTML content for your site"
                                    className="font-mono text-sm"
                                    aria-label="HTML content"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={loading || !newSubdomain || !isAvailable}
                            >
                                {loading ? 'Creating...' : 'Create Space'}
                            </Button>
                        </form>
                    </CardContent>

                    {statusMessage && (
                        <div
                            className={`mx-6 mb-6 p-3 rounded ${statusMessage.isError ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                }`}
                        >
                            <p>{statusMessage.message}</p>
                            {statusMessage.url && (
                                <Button variant="link" asChild className="mt-2 p-0">
                                    <a
                                        href={statusMessage.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Visit your new space →
                                    </a>
                                </Button>
                            )}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default SubdomainManager; 