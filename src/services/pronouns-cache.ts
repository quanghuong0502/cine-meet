import { unstable_cache } from "next/cache";
import { DEFAULT_PRONOUNS, type Pronouns } from "@/lib/pronouns";
import { getPronouns } from "./pronouns.service";

/** Cache tag of the pronoun pair; the save action expires it with `updateTag`. */
export const PRONOUNS_TAG = "settings:pronouns";

const cached = unstable_cache(getPronouns, ["pronouns"], { tags: [PRONOUNS_TAG], revalidate: 3600 });

/**
 * The pair for every request (shared by everyone, changes rarely, so cached across requests: two plain strings). If the database
 * cannot be reached the default pair is used, so no page ever fails because of it.
 */
export async function getPronounsCached(): Promise<Pronouns> {
  try {
    return await cached();
  } catch {
    return DEFAULT_PRONOUNS;
  }
}
