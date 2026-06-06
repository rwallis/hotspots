export const WEGLIDE_FILES_CDN = "https://weglidefiles.b-cdn.net";

function looksLikeIgc(text: string): boolean {
  const sample = text.slice(0, 2000).toUpperCase();
  return sample.includes("HFDTE") || sample.includes("\nB") || sample.startsWith("B");
}

export function resolveIgcDownloadUrl(file: string): string | null {
  const trimmed = file.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.includes("/igcfiles/") || trimmed.endsWith(".igc")) {
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${WEGLIDE_FILES_CDN}${path}`;
  }

  if (trimmed.startsWith("/")) {
    return `https://api.weglide.org${trimmed}`;
  }

  return null;
}

export async function resolveIgcFileField(
  file: string,
  fetchText: (url: string) => Promise<string>,
): Promise<string | null> {
  const trimmed = file.trim();
  if (!trimmed) return null;

  if (looksLikeIgc(trimmed)) {
    return trimmed;
  }

  const downloadUrl = resolveIgcDownloadUrl(trimmed);
  if (downloadUrl) {
    const text = await fetchText(downloadUrl);
    return looksLikeIgc(text) ? text : null;
  }

  return null;
}
