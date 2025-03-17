import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust based on your auth setup

const API_BASE_URL = process.env.API_GATEWAY_URL; // Store in .env.local

/**
 * List user's subdomains
 */
export async function GET(request: NextRequest) {
    // Get user from session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json(
            { status: 'error', message: 'Unauthorized' },
            { status: 401 }
        );
    }

    const userId = session.user.id;

    // Forward to AWS API
    try {
        const response = await fetch(
            `${API_BASE_URL}/user-subdomains?userId=${userId}`,
            { cache: 'no-store' }
        );

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching subdomains:', error);
        return NextResponse.json(
            { status: 'error', message: 'Failed to fetch subdomains' },
            { status: 500 }
        );
    }
}

/**
 * Create a new subdomain
 */
export async function POST(request: NextRequest) {
    // Get user from session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json(
            { status: 'error', message: 'Unauthorized' },
            { status: 401 }
        );
    }

    const userId = session.user.id;

    try {
        const body = await request.json();

        // Forward to AWS API with user ID
        const response = await fetch(`${API_BASE_URL}/register-subdomain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...body,
                userId,
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating subdomain:', error);
        return NextResponse.json(
            { status: 'error', message: 'Failed to create subdomain' },
            { status: 500 }
        );
    }
} 