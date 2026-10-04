import { listLooksForArtist, listArtists } from "@/lib/supabase";
import { tagLabel } from "@/lib/tags";
import type { Look } from "@/lib/types";
import { ManicureOfTheDayClient } from "./ManicureOfTheDayClient";

export const dynamic = "force-dynamic";

export default async function NailOfTheDayPage() {
  const artists = await listArtists().catch(() => []);
  const firstArtist = artists[0];
  const looks: Look[] = firstArtist
    ? await listLooksForArtist(firstArtist.id).catch(() => [])
    : [];
  const look = looks[0] ?? null;

  return (
    <main className="w-full px-5 pt-10 pb-20 md:pt-16 md:pb-28">
      <ManicureOfTheDayClient initialLook={look} />
    </main>
  );
}
