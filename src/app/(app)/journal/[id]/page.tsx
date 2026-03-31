import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import JournalDashboard from "./journal-dashboard";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JournalPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: journal } = await supabase
    .from("journals")
    .select("*")
    .eq("id", id)
    .single();

  if (!journal) notFound();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("journal_id", id)
    .eq("is_active", true)
    .order("created_at");

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("journal_id", id)
    .eq("is_active", true)
    .order("sort_order");

  return (
    <JournalDashboard
      journal={journal}
      accounts={accounts ?? []}
      categories={categories ?? []}
    />
  );
}
