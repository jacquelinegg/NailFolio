import type { Metadata } from "next";

import { StatusTracker } from "@/components/client/StatusTracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your NailFolio booking",
  robots: { index: false },
};

interface StatusPageProps {
  params: Promise<{ token: string }>;
}

export default async function StatusPage({ params }: StatusPageProps) {
  const { token } = await params;
  return <StatusTracker token={token} />;
}
