import { NextResponse, NextRequest } from 'next/server';
import db from '@/lib/db';
import type { BackendConfig } from '@/lib/types';

interface RequestBody {
  rule: string;
  comment?: string;
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const backendId = searchParams.get('backendId'); // Expect backendId

  if (!backendId) {
    return NextResponse.json({ error: 'Bad Request', details: 'Missing backendId query parameter.' }, { status: 400 });
  }

  let activeBackend: BackendConfig | undefined;

  try {
    // Fetch the full backend config using ID
    activeBackend = db.prepare("SELECT id, name, url, apiKey FROM backends WHERE id = ?").get(backendId) as BackendConfig | undefined;

    if (!activeBackend || !activeBackend.url || !activeBackend.apiKey) {
      console.error(`Backend configuration not found or incomplete for backendId: ${backendId}`);
      return NextResponse.json({ error: 'Configuration Error', details: 'Backend not configured or API key/URL is missing.' }, { status: 401 });
    }
  } catch (dbError: any) {
    console.error("Database error fetching backend configuration:", dbError);
    return NextResponse.json({ error: 'Internal Server Error', details: 'Failed to retrieve backend configuration.' }, { status: 500 });
  }
  
  // Validate URL format from the fetched config
  try {
    new URL(activeBackend.url);
  } catch (_) {
    return NextResponse.json({ error: 'Bad Request', details: 'Invalid backendUrl format in stored configuration.' }, { status: 400 });
  }

  // --- Body Parsing Logic ---
  let body: RequestBody;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Bad Request', details: 'Invalid JSON body.' }, { status: 400 });
  }

  const { rule, comment } = body;

  if (!rule) {
    return NextResponse.json({ error: 'Bad Request', details: 'Missing required field: rule.' }, { status: 400 });
  }

  try {
    const payload = { rule, comment };

    // Use the fetched backend URL and API key
    const response = await fetch(`${activeBackend.url}/rules/allow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': activeBackend.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorDetails = `Backend error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetails += `: ${errorData.error || 'Unknown backend error'} - ${errorData.details || ''}`;
      } catch (e) { }
      console.error(`Failed to add allow rule "${rule}" via backend:`, errorDetails);
      return NextResponse.json({ error: `Failed to add allow rule "${rule}"`, details: errorDetails }, { status: response.status });
    }

    return NextResponse.json({ message: `Rule "${rule}" allowed successfully via backend` }, { status: response.status });

  } catch (error: any) {
    console.error(`Error adding allow rule "${rule}":`, error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message || 'Unknown error occurred' }, { status: 500 });
  }
}
