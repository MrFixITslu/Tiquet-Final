export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle JSON content type automatically if body is present and not FormData
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/?login=true';
      return response;
    }

    if (response.status === 403) {
      // Forbidden - possibly cross-tenant or permissions issue
      console.error("Access forbidden to this resource");
      return response;
    }

    if (response.status === 503 && retries < maxRetries - 1) {
      // Server busy / unavailable - retry with backoff
      retries++;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      continue;
    }

    return response;
  }

  // Fallback if all retries fail
  return fetch(endpoint, { ...options, headers });
}

/**
 * PRODUCTION FILE URL HELPER
 * Resolves safe download URLs for job files.
 */
export function getFileUrl(accountId: string, filePath: string) {
  // In production, we proxy through /api/files with the auth token.
  // In development, we use the local /uploads static route.
  // @ts-ignore
  const isProd = import.meta.env.PROD;
  if (isProd) {
    // Note: The caller must use apiFetch() or an img tag that triggers auth
    // Since browser <img> tags don't send Bearer headers easily, 
    // for images we often need a signed URL pattern or similar.
    // For now, we return the proxy path.
    return `/api/files/${accountId}/${filePath}`;
  }
  return `/uploads/${accountId}/${filePath}`;
}
