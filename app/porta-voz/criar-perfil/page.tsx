import type { Metadata } from "next";
import { CreateCandidateProfileForm } from "@/components/create-candidate-profile-form";
import { readCandidateOnboarding } from "@/lib/candidate-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Montar perfil — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function CreateCandidateProfilePage() {
  const session = await requireSession();
  const initial = (await readCandidateOnboarding(session.id)) ?? {
    name: session.name,
    photoUrl: "",
    role: "",
    runningFor: "",
    electionYear: "2026",
    location: "",
    causes: [],
    communicationTone: "",
    keywords: [],
    socialLinks: {},
    bio: "",
    profileComplete: false,
  };

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <CreateCandidateProfileForm initial={initial} />
    </div>
  );
}
