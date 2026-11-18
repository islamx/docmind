export interface RepoRef {
  readonly owner: string;
  readonly repo: string;
  /** Only index files under this folder. Empty means the whole repo. */
  readonly path: string;
}

export interface RepoFile {
  readonly path: string;
  readonly size: number;
}

const REPO_PATTERN =
  /^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})(?:\/tree\/[^/]+\/(.+))?$/;

/** Accepts `owner/repo`, a repo URL, or a `/tree/<branch>/<folder>` URL. */
export function parseRepoInput(input: string): RepoRef | null {
  const value = input.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const match = REPO_PATTERN.exec(value);
  if (!match) return null;
  return { owner: match[1], repo: match[2], path: (match[3] ?? '').replace(/^\/+|\/+$/g, '') };
}

export function sourceId(ref: RepoRef): string {
  return ref.path ? `${ref.owner}/${ref.repo}:${ref.path}` : `${ref.owner}/${ref.repo}`;
}

export interface FileFilter {
  readonly extensions: readonly string[];
  readonly maxFileBytes: number;
  readonly maxFiles: number;
}

export const DEFAULT_FILE_FILTER: FileFilter = {
  extensions: ['.md', '.mdx', '.txt', '.ts', '.tsx', '.js', '.py', '.go', '.rs', '.java'],
  maxFileBytes: 150_000,
  maxFiles: 300,
};

const IGNORED = /(^|\/)(node_modules|dist|build|vendor|\.git|__snapshots__|fixtures?)\//i;
const NOISE = /(package-lock\.json|yarn\.lock|\.min\.js|\.spec\.ts|\.test\.ts|CHANGELOG\.md)$/i;

/** Docs first, then by path, so a `maxFiles` cut keeps the most useful files. */
export function selectFiles(
  all: readonly RepoFile[],
  ref: RepoRef,
  filter: FileFilter = DEFAULT_FILE_FILTER,
): RepoFile[] {
  const prefix = ref.path ? `${ref.path}/` : '';
  const isDoc = (p: string) => /\.(md|mdx|txt)$/i.test(p);
  return all
    .filter((f) => f.path.startsWith(prefix))
    .filter((f) => !IGNORED.test(f.path) && !NOISE.test(f.path))
    .filter((f) => filter.extensions.some((e) => f.path.toLowerCase().endsWith(e)))
    .filter((f) => f.size > 0 && f.size <= filter.maxFileBytes)
    .sort((a, b) => Number(isDoc(b.path)) - Number(isDoc(a.path)) || a.path.localeCompare(b.path))
    .slice(0, filter.maxFiles);
}

export function blobUrl(ref: RepoRef, path: string, startLine: number, endLine: number): string {
  const anchor = startLine === endLine ? `#L${startLine}` : `#L${startLine}-L${endLine}`;
  return `https://github.com/${ref.owner}/${ref.repo}/blob/HEAD/${path}${anchor}`;
}
