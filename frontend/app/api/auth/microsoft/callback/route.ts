import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the authorization code from the URL
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle errors
  if (error) {
    return NextResponse.redirect(
      new URL(`/email-providers?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  // If no code is provided, redirect back to the providers page
  if (!code) {
    return NextResponse.redirect(
      new URL('/email-providers?error=No+authorization+code+provided', request.url)
    );
  }

  try {
    // In a real implementation, we would exchange the code for tokens
    // and store the provider information in the database
    
    // For now, we'll just redirect back to the providers page with a success parameter
    return NextResponse.redirect(
      new URL(`/email-providers?provider=outlook&success=true&code=${encodeURIComponent(code)}`, request.url)
    );
  } catch (error) {
    console.error('Error connecting Outlook:', error);
    
    return NextResponse.redirect(
      new URL('/email-providers?error=Failed+to+connect+Outlook', request.url)
    );
  }
} 