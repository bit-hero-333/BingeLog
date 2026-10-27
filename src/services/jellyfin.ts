/**
 * Jellyfin Media Server API Service
 * Handles server ping, diagnostics, API key validation, and user authentication.
 * Strictly zero emojis.
 */

export interface JellyfinConfig {
  serverUrl: string;
  authType: 'api_key' | 'credentials';
  apiKey?: string;
  username?: string;
  accessToken?: string;
  userId?: string;
  serverName?: string;
  serverVersion?: string;
  isConnected: boolean;
  lastConnectedAt?: string;
}

export interface JellyfinTestResult {
  valid: boolean;
  message: string;
  serverName?: string;
  serverVersion?: string;
  userName?: string;
  userId?: string;
  accessToken?: string;
  apiKey?: string;
}

export interface JellyfinPublicInfo {
  ServerName?: string;
  Version?: string;
  Id?: string;
  OperatingSystem?: string;
}

const DEFAULT_TIMEOUT_MS = 8000;

export const JellyfinService = {
  /**
   * Normalizes a user-entered server URL into a valid, trimmed HTTP/HTTPS base endpoint.
   */
  normalizeServerUrl(rawUrl: string): string {
    if (!rawUrl || !rawUrl.trim()) return '';
    let trimmed = rawUrl.trim();

    // If protocol is missing, add http:// (or https:// if domain-like without IP/port)
    if (!/^https?:\/\//i.test(trimmed)) {
      if (/:\d+/.test(trimmed) || /^(\d{1,3}\.){3}\d{1,3}/.test(trimmed) || /localhost/i.test(trimmed)) {
        trimmed = `http://${trimmed}`;
      } else {
        trimmed = `https://${trimmed}`;
      }
    }

    // Strip trailing slashes
    trimmed = trimmed.replace(/\/+$/, '');
    return trimmed;
  },

  /**
   * Builds the standard authorization header required by Jellyfin.
   */
  getAuthHeader(token?: string): Record<string, string> {
    const authHeader = 'MediaBrowser Client="BingeLog", Device="Mobile", DeviceId="BingeLogApp", Version="0.25.0"';
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Emby-Authorization': authHeader,
    };
    if (token) {
      headers['X-Emby-Token'] = token;
    }
    return headers;
  },

  /**
   * Pings the Jellyfin server's public endpoint to verify reachability and metadata without auth.
   */
  async pingServer(serverUrl: string): Promise<{ ok: boolean; info?: JellyfinPublicInfo; error?: string }> {
    const normalized = this.normalizeServerUrl(serverUrl);
    if (!normalized) {
      return { ok: false, error: 'Please enter a valid server URL.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${normalized}/System/Info/Public`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return {
          ok: false,
          error: `Server responded with HTTP ${response.status} (${response.statusText || 'Error'}).`,
        };
      }

      const info: JellyfinPublicInfo = await response.json();
      return { ok: true, info };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { ok: false, error: 'Connection timed out. Check your server URL, IP, port, or network.' };
      }
      return {
        ok: false,
        error: `Could not reach Jellyfin server: ${err.message || 'Network request failed'}.`,
      };
    }
  },

  /**
   * Validates an API Key by requesting system info with the token header.
   */
  async testApiKey(serverUrl: string, apiKey: string): Promise<JellyfinTestResult> {
    const normalized = this.normalizeServerUrl(serverUrl);
    if (!normalized) {
      return { valid: false, message: 'Please enter a valid server URL.' };
    }
    if (!apiKey || !apiKey.trim()) {
      return { valid: false, message: 'Please enter an API Key.' };
    }

    const trimmedKey = apiKey.trim();

    // First ensure the server is reachable
    const ping = await this.pingServer(normalized);
    if (!ping.ok) {
      return { valid: false, message: ping.error || 'Server unreachable.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${normalized}/System/Info`, {
        method: 'GET',
        headers: this.getAuthHeader(trimmedKey),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          message: 'Invalid or unauthorized API Key. Verify the token in your Jellyfin Dashboard -> API Keys.',
        };
      }

      if (!response.ok) {
        return {
          valid: false,
          message: `Server returned HTTP ${response.status} when verifying API Key.`,
        };
      }

      const info = await response.json();
      const serverName = info.ServerName || ping.info?.ServerName || 'Jellyfin Server';
      const serverVersion = info.Version || ping.info?.Version || 'Unknown version';

      return {
        valid: true,
        message: `Successfully connected to ${serverName} (v${serverVersion}) via API Key!`,
        serverName,
        serverVersion,
        apiKey: trimmedKey,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { valid: false, message: 'API verification request timed out.' };
      }
      return { valid: false, message: `API verification failed: ${err.message || 'Unknown network error'}` };
    }
  },

  /**
   * Authenticates using a Jellyfin username and password, returning an access token and user profile.
   */
  async authenticateWithCredentials(
    serverUrl: string,
    username: string,
    pw: string
  ): Promise<JellyfinTestResult> {
    const normalized = this.normalizeServerUrl(serverUrl);
    if (!normalized) {
      return { valid: false, message: 'Please enter a valid server URL.' };
    }
    if (!username || !username.trim()) {
      return { valid: false, message: 'Please enter a username.' };
    }

    // Ping check first
    const ping = await this.pingServer(normalized);
    if (!ping.ok) {
      return { valid: false, message: ping.error || 'Server unreachable.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${normalized}/Users/AuthenticateByName`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          Username: username.trim(),
          Pw: pw || '',
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401) {
        return {
          valid: false,
          message: 'Invalid username or password. Please verify your Jellyfin login credentials.',
        };
      }

      if (!response.ok) {
        return {
          valid: false,
          message: `Authentication failed with HTTP ${response.status} (${response.statusText || 'Error'}).`,
        };
      }

      const data = await response.json();
      const accessToken = data.AccessToken;
      const userId = data.User?.Id;
      const userName = data.User?.Name || username.trim();
      const serverName = ping.info?.ServerName || data.ServerId || 'Jellyfin Server';
      const serverVersion = ping.info?.Version || 'Unknown version';

      if (!accessToken) {
        return {
          valid: false,
          message: 'Server did not return an access token upon authentication.',
        };
      }

      return {
        valid: true,
        message: `Successfully authenticated as ${userName} on ${serverName} (v${serverVersion})!`,
        serverName,
        serverVersion,
        userName,
        userId,
        accessToken,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { valid: false, message: 'Authentication request timed out.' };
      }
      return { valid: false, message: `Authentication error: ${err.message || 'Unknown network error'}` };
    }
  },

  /**
   * Unified connection test entry point.
   */
  async testConnection(
    serverUrl: string,
    authType: 'api_key' | 'credentials',
    apiKey?: string,
    username?: string,
    password?: string
  ): Promise<JellyfinTestResult> {
    if (authType === 'api_key') {
      return this.testApiKey(serverUrl, apiKey || '');
    }
    return this.authenticateWithCredentials(serverUrl, username || '', password || '');
  },
};
