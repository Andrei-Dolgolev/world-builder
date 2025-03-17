import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL; // Store in .env.local

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
        return NextResponse.json(
            { status: 'error', message: 'Subdomain parameter is required' },
            { status: 400 }
        );
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`,
            { cache: 'no-store' }
        );

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error checking subdomain:', error);
        return NextResponse.json(
            { status: 'error', message: 'Failed to check subdomain availability' },
            { status: 500 }
        );
    }
} 