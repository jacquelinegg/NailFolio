import { getServerDictionary } from "@/lib/i18n/server";
import { StyleSearch } from "@/components/client/StyleSearch";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const t = await getServerDictionary();

  return (
    <main className="mx-auto max-w-1100 px-5 pt-10 pb-20 md:pt-16 md:pb-28">
      <h1 className="text-[clamp(30px,5vw,48px)] leading-[1.05]">{t.search.title}</h1>
      <p className="mt-2 mb-8 max-w-[60ch] text-white/70">{t.search.body}</p>

      <StyleSearch />
    </main>
  );
}
