import express, { Request, Response, Router } from 'express';
import axios, { AxiosRequestConfig } from 'axios';

// Simple in-memory cache
type CacheEntry<T = any> = { data: T; expiresAt: number; etag?: string };
const cache = new Map<string, CacheEntry>();

// Config
const GITHUB_REPO_OWNER = 'Highl1te';
const GITHUB_REPO_NAME = 'Plugin-Hub';
const GITHUB_API_BASE = 'https://api.github.com';
const MANIFEST_TTL_MS = 5 * 60 * 1000; // 5 minutes for manifest freshness
const ASSET_TTL_MS = Number.POSITIVE_INFINITY; // cache plugin assets indefinitely (server-side)

// Helper to build cache keys
const key = (...parts: string[]) => parts.join('::');

async function fetchLatestReleaseManifest(): Promise<{ content: any; raw: string; etag?: string } | null> {
  const cacheKey = key('manifest');
  const now = Date.now();
  const cached = cache.get(cacheKey);

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'highlite.dev-server'
  };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  if (cached?.etag) headers['If-None-Match'] = cached.etag as string;

  try {
    // Get latest release
    const latestUrl = `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
    const latestRes = await axios.get(latestUrl, { headers } as AxiosRequestConfig);
    const assets: any[] = latestRes.data.assets || [];
    const manifestAsset = assets.find(a => a.name === 'manifest.json');
    if (!manifestAsset?.browser_download_url) return null;

    // Fetch manifest asset with conditional request if we have ETag
    const assetHeaders = { ...headers, Accept: 'application/octet-stream' } as Record<string, string>;
    if (cached?.etag) assetHeaders['If-None-Match'] = cached.etag as string;

    const manifestRes = await axios.get(manifestAsset.browser_download_url, {
      headers: assetHeaders,
      responseType: 'text'
    } as AxiosRequestConfig);

    const etag = (manifestRes.headers['etag'] as string | undefined);
    const raw = typeof manifestRes.data === 'string' ? manifestRes.data : JSON.stringify(manifestRes.data);
    const content = JSON.parse(raw);

    cache.set(cacheKey, { data: content, expiresAt: now + MANIFEST_TTL_MS, etag });
    return { content, raw, etag };
  } catch (err: any) {
    if (err?.response?.status === 304 && cached) {
      // Not modified - extend TTL
      cache.set(cacheKey, { ...cached, expiresAt: now + MANIFEST_TTL_MS });
      return { content: cached.data, raw: JSON.stringify(cached.data), etag: cached.etag };
    }
    // If rate limited or other error but we have cached, serve cached
    if (cached && cached.expiresAt > now) {
      return { content: cached.data, raw: JSON.stringify(cached.data), etag: cached.etag };
    }
    throw err;
  }
}

async function fetchPluginAsset(owner: string, repo: string, sha: string): Promise<Buffer> {
  const cacheKey = key('asset', owner, repo, sha);
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return Buffer.from(cached.data as any);
  }

  const apiHeaders: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'highlite.dev-server',
  };

  if (process.env.GITHUB_TOKEN) {
    apiHeaders['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

    const releasesUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases`;
    const repoReleases = await axios.get(releasesUrl, { headers: apiHeaders } as AxiosRequestConfig);
    for (const release of repoReleases.data) {
      for (const asset of release.assets || []) {
        if (asset.digest === sha) {
            const assetRes = await axios.get(asset.browser_download_url, { headers: apiHeaders, responseType: 'arraybuffer' } as AxiosRequestConfig);
            const buf = Buffer.from(assetRes.data);
            cache.set(cacheKey, { data: buf, expiresAt: ASSET_TTL_MS });
            return buf;
        }
      }
    }

    throw new Error('Asset with matching sha not found across all releases');
}

const router: Router = express.Router();

// GET /api/plugins/manifest.json -> proxy cached manifest from latest release
router.get('/manifest.json', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await fetchLatestReleaseManifest();
    if (!result) {
      res.status(404).json({ error: 'Manifest not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    if (result.etag) res.setHeader('ETag', result.etag);
    // Short client cache; rely on server cache for freshness
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(result.raw);
  } catch (error: any) {
    console.error('Error fetching manifest:', error?.response?.status, error?.message);
    res.status(500).json({ error: 'Failed to fetch manifest' });
  }
});

// GET /api/plugins/:owner/:name -> fetch plugin asset identified by display_name (fallback to repository_name)
router.get('/:owner/:repo', async (req: Request, res: Response): Promise<void> => {
  const owner = req.params.owner;
  const name = req.params.repo; // path keeps :repo for back-compat; treat it as display_name or repository_name
  try {
    const result = await fetchLatestReleaseManifest();
    if (!result?.content) {
      res.status(404).json({ error: 'Manifest not found' });
      return;
    }

    // Expect manifest to be an array or object containing entries with repository_owner, repository_name, asset_sha
    const manifest = result.content;
    const entries: any[] = Array.isArray(manifest) ? manifest : (manifest.plugins || manifest.entries || []);
    const entry = entries.find((e: any) => e.repository_owner === owner && (e.display_name === name || e.repository_name === name));
    if (!entry || !entry.asset_sha) {
      res.status(404).json({ error: 'Plugin not found in manifest' });
      return;
    }

    // Use the actual repository_name from the manifest to fetch the asset (supports monorepos)
    const buf = await fetchPluginAsset(entry.repository_owner, entry.repository_name, entry.asset_sha);
    // Serve as application/octet-stream
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(buf);
  } catch (error: any) {
    console.error('Error fetching plugin asset:', error?.response?.status, error?.message);
    res.status(500).json({ error: 'Failed to fetch plugin asset' });
  }
});

export default router;
