// Garde d'accès minimale (cahier des charges §3) : un seul mot de passe via env,
// utile parce que l'app passe par un tunnel public. Désactivée si ACCESS_PASSWORD
// est vide. crypto.subtle est disponible côté Node 20 ET côté Edge (middleware).

export const ACCESS_COOKIE = "nf_auth";

export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode("naturofiche:" + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
