import { BookingStudio } from "@/components/client/BookingStudio";
import { getServerDictionary } from "@/lib/i18n/server";
import { getArtistByShareToken, getArtistById, listLooksForArtist } from "@/lib/supabase";
import { publicEnv } from "@/lib/env";
import { MissingEnvError } from "@/lib/env";

export const dynamic = "force-dynamic";

interface ConfirmPageProps {
  params: Promise<{ token: string }>;
}

/**
 * `/confirm/[token]` — the link the artist drops in an Instagram DM.
 * The token resolves to the artist; the client never signs in.
 *
 * The portfolio is loaded here rather than fetched from the browser so the
 * look rail is present in the first paint. That matters: the whole point of the
 * step is that the client chooses between real looks, and a rail that pops in
 * after a round trip reads as an empty gallery.
 */
export default async function ConfirmPage({ params }: ConfirmPageProps) {
  const { token } = await params;

  const artist = await resolveArtist(token);
  const t = await getServerDictionary();

  if (!artist) {
    return (
      <main className="mx-auto max-w-1100 px-5 py-24 text-center">
        <h1 className="text-xl font-semibold">{t.confirm.expiredTitle}</h1>
        <p className="mt-2 text-sm text-white/60">{t.confirm.expiredBody}</p>
      </main>
    );
  }

  const looks = await listLooksForArtist(artist.id).catch(() => []);

  return (
    <main className="mx-auto max-w-1100 px-5 pt-10 pb-24">
      <BookingStudio artistId={artist.id} artistName={artist.display_name} looks={looks} />
    </main>
  );
}

async function resolveArtist(token: string) {
  if (token && token !== "demo") {
    const byToken = await getArtistByShareToken(token).catch(() => null);
    if (byToken) return byToken;
  }

  const fallbackId = (() => {
    try {
      return publicEnv.defaultArtistId;
    } catch (error) {
      if (error instanceof MissingEnvError) return undefined;
      throw error;
    }
  })();

  if (!fallbackId) return null;
  return getArtistById(fallbackId).catch(() => null);
}
