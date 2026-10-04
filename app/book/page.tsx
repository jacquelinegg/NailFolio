import Link from "next/link";

import { getServerDictionary } from "@/lib/i18n/server";
import { listArtists } from "@/lib/supabase";
import type { Artist } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const t = await getServerDictionary();
  const artists = await listArtists().catch(() => []);

  return (
    <main className="mx-auto max-w-1100 px-5 pt-10 pb-20 md:pt-16 md:pb-28">
      <h1 className="mb-2 text-[clamp(30px,5vw,48px)] leading-[1.05]">{t.book.title}</h1>
      <p className="mt-2 mb-8 max-w-[60ch] text-white/70">{t.book.body}</p>

      {artists.length === 0 ? (
        <p className="text-white/60">{t.client.artistsEmpty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist: Artist) => (
            <li key={artist.id} className="card">
              <h2 className="text-lg font-semibold">{artist.display_name}</h2>
              <p className="text-sm text-white/60">@{artist.handle}</p>
              <p className="mt-3 text-blush-300">
                {t.home.fromPrice} {artist.base_price} {t.home.lev}
              </p>
              <Link
                href={artist.share_token ? `/confirm/${artist.share_token}` : `/confirm/${artist.id}`}
                className="btn-pearl mt-4 !px-4 !py-2 !text-sm"
              >
                {t.client.tryStyle}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
