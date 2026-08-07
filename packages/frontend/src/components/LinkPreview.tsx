/**
 * OGP リンクプレビュー (要件 #2 §4.2)
 * メッセージ内の URL を検出し、OGP カードを表示。
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface OGP {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

export function LinkPreview({ url }: { url: string }) {
  const [ogp, setOgp] = useState<OGP | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.ogp
      .get(url)
      .then((r) => {
        if (!cancelled && (r.title || r.image)) setOgp(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!ogp) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-2 flex max-w-sm items-center gap-3 rounded-md border border-gray-200 p-3 no-underline transition-colors duration-150 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
    >
      {ogp.image && (
        <img
          src={ogp.image}
          alt=""
          className="size-12 shrink-0 rounded object-cover"
          loading="lazy"
        />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{ogp.title ?? url}</span>
        {ogp.description && (
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {ogp.description}
          </span>
        )}
      </span>
    </a>
  );
}
