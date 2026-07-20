import { useState, type ReactNode } from "react";
import { X, Check, Shield, Crosshair, Target, Skull, Flame, Ghost, Eye, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import {
  EXPERIENCE_LEVELS,
  ExperienceBadge,
  type ExperienceLevel,
} from "@/components/ExperienceBadge";

export const LOADOUT_ROLES = ["AEG", "Sniper", "DMR", "HPA", "Pistol", "Rental"] as const;

export const AVATAR_OPTIONS: { id: string; Icon: typeof Shield }[] = [
  { id: "shield", Icon: Shield },
  { id: "crosshair", Icon: Crosshair },
  { id: "target", Icon: Target },
  { id: "skull", Icon: Skull },
  { id: "flame", Icon: Flame },
  { id: "ghost", Icon: Ghost },
  { id: "eye", Icon: Eye },
  { id: "swords", Icon: Swords },
];

export function AvatarIcon({ id, size = 22 }: { id: string; size?: number }) {
  const found = AVATAR_OPTIONS.find((a) => a.id === id) ?? AVATAR_OPTIONS[0];
  const { Icon } = found;
  return <Icon size={size} strokeWidth={1.6} />;
}

const ACCENT = "#a8954f";
const BG = "#1a1f17";
const PANEL = "#22281e";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";

export default function AirsoftRegistrationModal({
  eventId,
  eventTitle,
  onClose,
  onSuccess,
}: {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { lang } = useLang();
  const en = lang === "en";

  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [callsign, setCallsign] = useState("");
  const [experience, setExperience] = useState<ExperienceLevel>("dobro");
  const [wantsFood, setWantsFood] = useState(true);
  const [teamClub, setTeamClub] = useState("");
  const [role, setRole] = useState<string>(LOADOUT_ROLES[0]);
  const [avatarId, setAvatarId] = useState<string>(AVATAR_OPTIONS[0].id);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const t = (sl: string, en2: string) => (en ? en2 : sl);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = firstName.trim().slice(0, 40);
    const cleanInitial = lastInitial.trim().slice(0, 1).toUpperCase();
    const cleanCallsign = callsign.trim().slice(0, 40);
    if (!cleanFirst || !cleanInitial || !cleanCallsign) {
      setErrMsg(t("Izpolnite vsa obvezna polja.", "Please fill in all required fields."));
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrMsg("");
    const mealText = wantsFood
      ? t("Da, računajte name!", "Yes, count me in!")
      : t("Ne, prinesem svoje", "No, I'll bring my own");
    const displayName = `${cleanFirst} ${cleanInitial}.`;
    const { error } = await supabase.from("registrations").insert({
      event_id: eventId,
      event_title: eventTitle,
      first_name: cleanFirst,
      last_initial: cleanInitial,
      full_name: displayName,
      experience_level: experience,
      meal: mealText,
      callsign: cleanCallsign,
      team_club: teamClub.trim().slice(0, 80) || null,
      gear_type: role,
      avatar: avatarId,
    } as any);
    if (error) {
      console.error("[registration] insert error", error);
      setErrMsg(t("Napaka pri pošiljanju. Poskusite znova.", "Submission failed. Please try again."));
      setStatus("error");
      return;
    }
    setStatus("ok");
    onSuccess?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BG,
          color: INK,
          maxWidth: 560,
          width: "100%",
          borderRadius: 8,
          border: `1px solid ${ACCENT}40`,
          padding: 28,
          position: "relative",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            color: INK,
            cursor: "pointer",
            padding: 6,
          }}
        >
          <X size={20} />
        </button>

        {status === "ok" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div
              style={{
                margin: "0 auto 16px",
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: `${ACCENT}28`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${ACCENT}`,
              }}
            >
              <Check size={28} color={ACCENT} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 10 }}>
              {t("PRIJAVA USPEŠNA!", "REGISTRATION SUCCESSFUL!")}
            </h3>
            <p style={{ color: INK, fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>
              {t(
                "Tvoj Callsign je dodan na seznam. Se vidimo na terenu!",
                "Your callsign has been added to the roster. See you on the field!",
              )}
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: 22,
                padding: "10px 28px",
                background: ACCENT,
                color: BG,
                border: "none",
                fontSize: 12,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {t("Zapri", "Close")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: ACCENT, marginBottom: 6 }}>
              {t("Prijava na dogodek", "Event registration")}
            </p>
            <h3 style={{ fontSize: 19, fontWeight: 600, marginBottom: 18, lineHeight: 1.3 }}>{eventTitle}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10, marginBottom: 14, alignItems: "end" }}>
              <div>
                <label style={{ ...labelStyle, minHeight: 28 }}>{t("Ime *", "First name *")}</label>
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={40}
                  style={inputStyle}
                  placeholder={t("npr. Miha", "e.g. Mike")}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, minHeight: 28 }}>
                  {t("Črka priimka *", "Surname *")}
                </label>
                <input
                  required
                  value={lastInitial}
                  onChange={(e) => setLastInitial(e.target.value.replace(/[^\p{L}]/gu, "").slice(0, 1).toUpperCase())}
                  maxLength={1}
                  style={{ ...inputStyle, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}
                  placeholder="N"
                />
              </div>
            </div>

            <Field label={t("Javen vzdevek (callsign) *", "Public callsign *")}>
              <input
                required
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                maxLength={40}
                style={inputStyle}
                placeholder={t("npr. GHOST-12", "e.g. GHOST-12")}
              />
            </Field>

            <Field label={t("Nivo izkušenj *", "Experience level *")}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {EXPERIENCE_LEVELS.map((lvl) => {
                  const active = experience === lvl.value;
                  return (
                    <button
                      type="button"
                      key={lvl.value}
                      onClick={() => setExperience(lvl.value)}
                      style={{
                        background: active ? `${ACCENT}20` : PANEL,
                        border: `1px solid ${active ? ACCENT : "rgba(236,227,196,0.18)"}`,
                        padding: "10px 6px 8px",
                        cursor: "pointer",
                        color: INK,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "space-between",
                        minHeight: 88,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ExperienceBadge level={lvl.value} size={18} color={active ? ACCENT : "rgba(236,227,196,0.55)"} />
                      </div>
                      <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: active ? INK : MUTED, fontFamily: "monospace", textAlign: "center" }}>
                        {en ? lvl.labelEn : lvl.labelSl}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div style={{ marginBottom: 14 }}>
              <label style={{ ...labelStyle, letterSpacing: "0.06em", textTransform: "none", fontSize: 12, whiteSpace: "normal", textAlign: "justify" }}>
                {t("Ali boš jedel našo organizirano malico?", "Will you join our organized meal?")}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <ToggleBtn active={wantsFood} onClick={() => setWantsFood(true)}>
                  {t("Da, računajte name!", "Yes, count me in!")}
                </ToggleBtn>
                <ToggleBtn active={!wantsFood} onClick={() => setWantsFood(false)}>
                  {t("Ne, prinesem svoje", "No, I'll bring my own")}
                </ToggleBtn>
              </div>
            </div>

            <Field label={t("EKIPA / KLUB", "TEAM / CLUB")}>
              <input
                value={teamClub}
                onChange={(e) => setTeamClub(e.target.value)}
                maxLength={80}
                style={inputStyle}
                placeholder={t("(Neobvezno)", "(Optional)")}
              />
            </Field>

            <Field label={t("Tip opreme", "Loadout role")}>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                {LOADOUT_ROLES.map((r) => (
                  <option key={r} value={r} style={{ background: BG, color: INK }}>
                    {r === "Rental" ? t("Najem opreme", "Rental") : r}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("Izberi avatar", "Choose your avatar")}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 6 }}>
                {AVATAR_OPTIONS.map(({ id, Icon }) => {
                  const active = avatarId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAvatarId(id)}
                      aria-label={id}
                      style={{
                        aspectRatio: "1/1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: active ? ACCENT : PANEL,
                        color: active ? BG : INK,
                        border: `1px solid ${active ? ACCENT : "rgba(236,227,196,0.18)"}`,
                        cursor: "pointer",
                        transition: "all 150ms",
                      }}
                    >
                      <Icon size={18} strokeWidth={1.6} />
                    </button>
                  );
                })}
              </div>
            </Field>

            {status === "error" && errMsg && (
              <p style={{ color: "#d97a6c", fontSize: 12, marginTop: 8 }}>{errMsg}</p>
            )}

            <p style={{ fontSize: 10.5, color: MUTED, marginTop: 14, lineHeight: 1.5, letterSpacing: "0.04em" }}>
              {t(
                "Ne zbiramo e-poštnih naslovov ali telefonskih številk. Na javnem seznamu bo prikazano samo tvoje ime, prva črka priimka in tvoj callsign (npr. Miha N. · GHOST-12).",
                "We do not collect email addresses or phone numbers. Only your first name, the first letter of your surname and your callsign (e.g. Mike N. · GHOST-12) will be shown on the public roster.",
              )}
            </p>

            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                marginTop: 18,
                width: "100%",
                padding: "13px",
                background: ACCENT,
                color: BG,
                border: "none",
                fontSize: 12,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                cursor: status === "sending" ? "wait" : "pointer",
                fontWeight: 700,
                opacity: status === "sending" ? 0.6 : 1,
              }}
            >
              {status === "sending" ? t("POŠILJAM...", "SENDING...") : t("POTRDI PRIJAVO", "CONFIRM REGISTRATION")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: PANEL,
  color: INK,
  border: "1px solid rgba(236,227,196,0.18)",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: 4,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: MUTED,
  marginBottom: 6,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>
        {label}
        {hint && <span style={{ marginLeft: 8, color: "rgba(236,227,196,0.35)", textTransform: "none", letterSpacing: 0 }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 12px",
        background: active ? ACCENT : PANEL,
        color: active ? BG : INK,
        border: `1px solid ${active ? ACCENT : "rgba(236,227,196,0.18)"}`,
        fontSize: 12,
        cursor: "pointer",
        borderRadius: 4,
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
