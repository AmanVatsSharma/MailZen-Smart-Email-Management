import { NextRequest } from 'next/server';

const getBackendOrigin = (): string => {
  return process.env.BACKEND_GRAPHQL_ORIGIN || 'http://localhost:4000/graphql';
};

export async function POST(request: NextRequest) {
  const backendUrl = getBackendOrigin();
  const body = await request.text();

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'host') return;
    headers[key] = value;
  });

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body,
  });

  const responseText = await response.text();
  return new Response(responseText, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  });
}

export async function GET(request: NextRequest) {
  const backendUrl = getBackendOrigin();
  const url = new URL(request.url);
  const response = await fetch(`${backendUrl}?${url.searchParams.toString()}`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  });
  const responseText = await response.text();
  return new Response(responseText, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  });
}

