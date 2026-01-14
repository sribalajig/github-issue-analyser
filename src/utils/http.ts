/**
 * HTTP client utility for making HTTP requests
 * Provides a clean abstraction over fetch API
 */

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  ok: boolean;
  data: T;
  headers: Headers;
}

/**
 * Make an HTTP request
 * 
 * @param url - Request URL
 * @param options - Request options (method, headers, body)
 * @returns Response with typed data
 * @throws Error if request fails
 */
export async function httpRequest<T = unknown>(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse<T>> {
  const { method = 'GET', headers = {}, body } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const requestOptions: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined) {
    requestOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, requestOptions);
    const data = (await response.json()) as T;

    return {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data,
      headers: response.headers,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`HTTP request failed: ${error.message}`);
    }
    throw new Error('HTTP request failed: Unknown error');
  }
}

/**
 * Make a GET request
 * 
 * @param url - Request URL
 * @param headers - Optional headers
 * @returns Response with typed data
 */
export async function httpGet<T = unknown>(
  url: string,
  headers?: Record<string, string>
): Promise<HttpResponse<T>> {
  return httpRequest<T>(url, { method: 'GET', headers });
}
