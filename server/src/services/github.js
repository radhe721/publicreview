import { env } from '../config/env.js';

// GitHub's own limits: usernames are up to 39 letters, digits or single hyphens; repo names up to
// 100 letters, digits, ".", "-" or "_".
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

// Accepts "https://github.com/owner/repo", "github.com/owner/repo/tree/main/...", "owner/repo"
// and clone URLs ending in ".git". Returns { owner, name } or null.
export function parseGithubRepo(input) {
  const text = String(input || '').trim();
  let segments;

  if (/^(https?:\/\/)?(www\.)?github\.com\//i.test(text)) {
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      segments = url.pathname.split('/').filter(Boolean);
    } catch {
      return null;
    }
  } else {
    // Bare "owner/repo" shorthand; anything else (other hosts, single words) is rejected.
    segments = text.split('/');
    if (segments.length !== 2) return null;
  }

  const [owner, rawName] = segments;
  const name = (rawName || '').replace(/\.git$/i, '');
  if (!owner || !OWNER_RE.test(owner) || !NAME_RE.test(name) || name === '.' || name === '..') {
    return null;
  }
  return { owner, name };
}

export class GithubLookupError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Looks a public repository up on the GitHub API. Without GITHUB_TOKEN the API allows
// 60 lookups per hour per server IP, which is plenty for sharing but worth setting in production.
export async function fetchGithubRepo({ owner, name }) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'BusinessListe',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  let response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
  } catch {
    throw new GithubLookupError('Could not reach GitHub. Please try again in a moment.', 502);
  }

  if (response.status === 404) {
    throw new GithubLookupError('That repository does not exist or is private.', 404);
  }
  if (response.status === 403 || response.status === 429) {
    throw new GithubLookupError('GitHub is rate limiting us right now. Please try again later.', 503);
  }
  if (!response.ok) {
    throw new GithubLookupError('GitHub returned an unexpected error. Please try again.', 502);
  }

  const repo = await response.json();
  // A token with private access would otherwise let private repos be published here.
  if (repo.private) {
    throw new GithubLookupError('That repository does not exist or is private.', 404);
  }

  return {
    github_id: repo.id,
    full_name: repo.full_name,
    owner_avatar: repo.owner?.avatar_url || null,
    description: repo.description ? String(repo.description).slice(0, 500) : null,
    language: repo.language || null,
    stars: Number(repo.stargazers_count || 0),
    forks: Number(repo.forks_count || 0),
    topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 10) : [],
    license: repo.license?.spdx_id || null,
    pushed_at: repo.pushed_at || null
  };
}

// Plain-English meaning of common licenses for someone thinking of building a business on the code.
export function licenseNote(spdx) {
  const id = String(spdx || '').toUpperCase();
  if (!id || id === 'NOASSERTION') return 'Custom or unclear license: read it carefully before building a business on it.';
  if (['MIT', 'ISC', '0BSD', 'UNLICENSE'].includes(id) || id.startsWith('BSD')) return 'Permissive: almost anything allowed, including commercial use; keep the copyright notice.';
  if (id === 'APACHE-2.0') return 'Permissive: commercial use allowed; keep the notice and state your changes.';
  if (id.startsWith('AGPL')) return 'AGPL: if you run it as a service, you must share your changes under the same license.';
  if (id.startsWith('GPL') || id.startsWith('LGPL')) return 'GPL: if you distribute it, you must share your changes under the same license.';
  if (id === 'MPL-2.0') return 'MPL: changes to its files must stay open; your own files can stay private.';
  return 'Read the license before building a business on it.';
}
