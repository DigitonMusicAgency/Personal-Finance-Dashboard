import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: journals } = await supabase
    .from("journals")
    .select("id")
    .eq("is_archived", false)
    .order("sort_order")
    .limit(1);

  if (journals && journals.length > 0) {
    redirect(`/journal/${journals[0].id}`);
  }

  // If no journals, redirect to a welcome/create page
  redirect("/welcome");
}
