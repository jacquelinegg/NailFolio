import Link from "next/link";

import { listArtists, listLooksForArtist } from "@/lib/supabase";
import { getServerDictionary } from "@/lib/i18n/server";
import { tagLabel } from "@/lib/tags";

export const dynamic = "force-dynamic";

const STEP_KEYS = ["stepOne", "stepTwo", "stepThree"] as const;

export default async function HomePage() {
  const t = await getServerDictionary();
  const artists = await listArtists().catch(() => []);
  const featured = artists.slice(0, 3);
  const leadArtist = artists[0];
  const looks = leadArtist ? await listLooksForArtist(leadArtist.id).catch(() => []) : [];
  const look = looks[0] ?? null;

  return (
    <main className="relative z-10 mx-auto max-w-1100 px-5 pt-10 pb-20 md:pt-16 md:pb-28">
      <section className="text-center">
        <h1 className="pearl-text mx-auto max-w-[16ch] text-[clamp(34px,7vw,68px)] leading-[1.02]">
          {t.home.heroTitle}
        </h1>
        <p className="mx-auto mt-6 max-w-[58ch] text-[15px] leading-relaxed text-blush-300/80 md:text-base">
          {t.home.heroBody}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/search" className="btn-pearl">{t.home.ctaSearch}</Link>
          <Link href="/artists" className="btn-ghost">{t.home.ctaArtists}</Link>
        </div>
      </section>

      <section id="design-of-the-day" className="mt-20 md:mt-28">
        <div className="card grid items-center gap-8 !p-0 md:grid-cols-[1fr_1fr]">
          <div className="aspect-[4/3] w-full overflow-hidden">
            {look ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={look.image_url}
                alt={look.tags.join(", ")}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center gap-2.5 bg-[radial-gradient(circle_at_32%_26%,#fff8f3_0%,#E8D5CE_34%,#D4B8B1_62%,#9C94A0_100%)]">
                <div className="nail" />
                <div className="nail" />
                <div className="nail" />
                <div className="nail" />
                <div className="nail" />
              </div>
            )}
          </div>

          <div className="px-6 py-8 md:px-9 md:py-10">
            <p className="text-[11px] tracking-[0.28em] text-blush-300/70 uppercase">
              {t.home.designOfTheDay}
            </p>
            <h2 className="pearl-text mt-3 text-[clamp(24px,3.4vw,34px)] leading-tight">
              {look ? look.tags.map((tag) => tagLabel(tag)).join(" · ") : t.home.featureName}
            </h2>
            <p className="mt-4 max-w-[42ch] text-sm leading-relaxed text-blush-300/80">
              {t.home.featureDescription}
            </p>
            <p className="mt-5 text-sm text-ash-400">
              {look
                ? `${t.home.featureMinutes} • ~${look.base_price} ${t.home.lev}`
                : t.home.featureMeta}
            </p>
            <Link href="/search" className="btn-pearl mt-7 !px-6 !py-3 !text-sm">
              {t.home.tryLook}
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mt-24 text-center md:mt-32">
        <h2 className="text-[clamp(26px,4vw,42px)]">{t.home.howItWorks}</h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-sm text-blush-300/70">
          {t.home.howItWorksBody}
        </p>

        <ol className="mt-12 grid gap-4 text-left md:grid-cols-3">
          {STEP_KEYS.map((key, index) => (
            <li key={key} className="card">
              <h3 className="text-lg">
                <span className="pearl-text font-[var(--font-serif)] text-2xl">
                  0{index + 1}.
                </span>{" "}
                {t.home[`${key}Title`]}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-blush-300/75">
                {t.home[`${key}Body`]}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section id="artists" className="mt-24 md:mt-32">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-[clamp(26px,4vw,42px)]">{t.home.artistsInVarna}</h2>
          {featured.length > 0 ? (
            <Link href="/artists" className="btn-ghost !py-2.5 !text-sm">
              {t.home.seeAll}
            </Link>
          ) : null}
        </div>

        {featured.length === 0 ? (
          <p className="mt-8 max-w-[52ch] text-blush-300/70">
            {t.home.emptyArtists}
          </p>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((artist) => (
              <li key={artist.id} className="card">
                <h3 className="text-lg font-semibold">{artist.display_name}</h3>
                <p className="mt-0.5 text-sm text-ash-400">@{artist.handle}</p>
                <p className="mt-4 text-blush-300">
                  {t.home.fromPrice} {artist.base_price} {t.home.lev}
                </p>
                <Link
                  href={artist.share_token ? `/confirm/${artist.share_token}` : `/confirm/${artist.id}`}
                  className="btn-pearl mt-5 !px-5 !py-2.5 !text-sm"
                >
                  {t.home.viewPortfolio}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="cta" className="card mt-24 !px-6 !py-16 text-center md:mt-32 md:!px-12">
        <h2 className="pearl-text text-[clamp(24px,3.6vw,38px)]">
          {t.home.ctaTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-[48ch] text-sm text-blush-300/75">
          {t.home.ctaBody}
        </p>
        <Link href="/search" className="btn-pearl mt-8">{t.home.ctaButton}</Link>
      </section>
    </main>
  );
}
