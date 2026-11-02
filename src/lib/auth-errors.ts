// Pure mapper from raw auth-library errors to player-facing bilingual text.
// No imports: shared by components and unit tests without circular dependencies.
// Never returns the raw library message.

export type FriendlyAuthError = { text: string; kind: "unconfirmed" | "other" };

export function friendlyAuthError(
  err: { code?: string; message?: string; status?: number } | null | undefined,
  en: boolean,
): FriendlyAuthError {
  const code = (err?.code ?? "").toLowerCase();
  const message = (err?.message ?? "").toLowerCase();
  const status = err?.status;
  const has = (needle: string) => message.includes(needle);
  const pick = (sl: string, enText: string, kind: FriendlyAuthError["kind"] = "other"): FriendlyAuthError => ({
    text: en ? enText : sl,
    kind,
  });

  if (code === "invalid_credentials" || has("invalid login credentials"))
    return pick(
      "Napačen e-naslov ali geslo. Če si račun šele ustvaril, najprej potrdi e-pošto.",
      "Wrong email or password. If you just created the account, confirm your email first.",
    );
  if (code === "email_not_confirmed" || has("email not confirmed"))
    return pick(
      "E-naslov še ni potrjen. Odpri e-pošto in klikni potrditveno povezavo (poglej tudi med neželeno pošto).",
      "Your email is not confirmed yet. Open your inbox and click the confirmation link (check your spam folder too).",
      "unconfirmed",
    );
  if (code === "user_already_exists" || has("already registered"))
    return pick(
      "Račun s tem e-naslovom že obstaja. Prijavi se ali uporabi »Pozabljeno geslo«.",
      'An account with this email already exists. Sign in, or use "Forgot password".',
    );
  if (
    code === "weak_password" ||
    has("leaked") ||
    has("known password") ||
    (has("password") && (has("weak") || has("strength")))
  )
    return pick(
      "Geslo je prešibko ali preveč znano. Izberi daljše, manj običajno geslo (vsaj 8 znakov).",
      "That password is too weak or too common. Choose a longer, less common one (at least 8 characters).",
    );
  if (code === "email_address_invalid" || has("invalid email") || (has("email") && has("invalid") && !has("login")))
    return pick("E-naslov ni veljaven.", "That email address is not valid.");
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429 ||
    has("rate limit")
  )
    return pick("Preveč poskusov. Počakaj nekaj minut in poskusi znova.", "Too many attempts. Wait a few minutes and try again.");
  if (has("failed to fetch") || has("load failed") || has("network") || err instanceof TypeError)
    return pick("Ni povezave. Preveri signal in poskusi znova.", "No connection. Check your signal and try again.");
  return pick("Prijava ni uspela. Poskusi znova.", "Something went wrong. Please try again.");
}
