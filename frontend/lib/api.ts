const envBase = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "";

export const resolveApiUrl = (path: string): string => {
  const base = envBase || (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, base);
  return url.toString();
};

export const apiBase = envBase;
