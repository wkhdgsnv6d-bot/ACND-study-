import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/** Which labs this account has solved. */
export async function getSolvedLabs(
  user: User,
): Promise<{ solved: Set<string>; error: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { solved: new Set(), error: "Database not configured." };

  const { data, error } = await supabase
    .from("lab_attempts")
    .select("lab_id, solved")
    .eq("user_id", user.id)
    .eq("solved", true);

  if (error) return { solved: new Set(), error: error.message };

  return {
    solved: new Set((data ?? []).map((row) => (row as { lab_id: string }).lab_id)),
    error: null,
  };
}
