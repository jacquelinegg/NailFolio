import Link from "next/link";

import { getServerDictionary } from "@/lib/i18n/server";
import { listArtists, listLooksForArtist } from "@/lib/supabase";
import { tagLabel } from "@/lib/tags";

export const dynamic = "force-dynamic";

/** Enough of the portfolio to read the artist's range without loading it all. */
const PREVIEW_LIMIT = 4;

export default async function ArtistsPage() {
  const t = await getServerDictionary();
  const artists = await listArtists().catch(() => []);

  // The preview is what separates one artist card from another: without it the
  // directory is a list of names and prices, and the client is asked to commit to
  // a style they have not seen yet. One portfolio query per artist, then capped
  // here rather than in the query so the count stays accurate.
  const cards = await Promise.all(
    artists.map(async (artist) => {
      const looks = await listLooksForArtist(artist.id).catch(() => []);
      return { artist, total: looks.length, looks: looks.slice(0, PREVIEW_LIMIT) };
    }),
  );

  return (
    <main className="mx-auto max-w-1100 px-5 pt-10 pb-20 md:pt-16 md:pb-28">
      <h1 className="mb-2 text-[clamp(30px,5vw,48px)] leading-[1.05]">{t.client.artistsTitle}</h1>
      <p className="mt-2 mb-8 max-w-[60ch] text-white/70">{t.client.artistsBody}</p>

      {artists.length === 0 ? (
        <p className="text-white/60">{t.client.artistsEmpty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ artist, looks, total }) => (
            <li key={artist.id} className="card !p-0">
              {looks.length > 0 ? (
                <ul className="grid grid-cols-4 gap-0.5">
                  {looks.map((look) => (
                    <li key={look.id} className="aspect-square overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={look.image_url}
                        alt={look.tags.map((tag) => tagLabel(tag)).join(", ")}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex aspect-[4/1] items-center justify-center gap-2 bg-white/5">
                  <div className="nail" />
                  <div className="nail" />
                  <div className="nail" />
                </div>
              )}

              <div className="p-5">
                <h2 className="text-lg font-semibold">{artist.display_name}</h2>
                <p className="text-sm text-white/60">@{artist.handle}</p>

                {total > 0 ? (
                  <p className="mt-3 text-xs text-white/50">
                    {t.looks.portfolioCountLabel} {total}
                  </p>
                ) : null}

                <p className="mt-2 text-blush-300">
                  {t.home.fromPrice} {artist.base_price} {t.home.lev}
                </p>
                <Link
                  href={artist.share_token ? `/confirm/${artist.share_token}` : `/confirm/${artist.id}`}
                  className="btn-pearl mt-4 !px-4 !py-2 !text-sm"
                >
                  {t.client.tryStyle}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
