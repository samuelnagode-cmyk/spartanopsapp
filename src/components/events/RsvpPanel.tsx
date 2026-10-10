import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eventAttendance, eventRsvpRemove, eventRsvpSet, type Attendance } from "@/lib/event-rsvps.functions";
import { playerGetMine, playerSaveMine } from "@/lib/player.functions";
import { normalizePhone } from "@/lib/player-validation";
import { SI_TOWNS } from "@/lib/si-towns";
import { eventEndMs, shortDate, type Lang } from "@/lib/events";
import { PlayerAuthDialog } from "@/components/PlayerAuth";
import { ACCENT, ERR, INK, MICHROMA, MUTED, OK, PANEL, btnOutline, btnPrimary } from "./ui";
import { CapacityBar } from "./CapacityBar";
import { AttendeeList, LockedAttendees } from "./AttendeeList";
import { CarpoolBoard } from "./CarpoolBoard";

const INTENT_KEY = "spartanops:rsvp-intent";
type Status = "going" | "maybe";
type Share = "none" | "organiser" | "attendees";
type Ride = "none" | "driver" | "rider";

export type RsvpEvent = { id: string; status: string; starts_at: string; ends_at: string | null; tz: string; capacity: number | null; schedule_changed_at: string | null };

const ERRORS: Record<string, [string, string]> = {
  full: ["Event is full.", "Dogodek je poln."],
  event_closed: ["This event is not open for answers.", "Ta dogodek ne sprejema odgovorov."],
  event_over: ["This event is over.", "Dogodek je že mimo."],
  not_found: ["Event not found.", "Dogodka ni."],
  needs_profile: ["Create your player profile first.", "Najprej ustvari igralski profil."],
  needs_reconsent: ["Please accept the updated privacy notice first.", "Najprej sprejmi posodobljeno obvestilo o zasebnosti."],
  needs_phone: ["Add your phone number to arrange a ride.", "Za dogovor o prevozu dodaj telefonsko številko."],
  "validation:ride_from": ["Enter the town you are leaving from.", "Vpiši kraj, od koder greš."],
  "validation:ride_seats": ["Free seats: 1 to 8.", "Prosta mesta: od 1 do 8."],
  "validation:phone": ["Phone number is not valid.", "Telefonska številka ni veljavna."],
  login_required: ["Please sign in again.", "Ponovno se prijavi."],
};
const errText = (e: unknown, en: boolean) => {
  const m = String((e as Error)?.message ?? "");
  const k = Object.keys(ERRORS).find((key) => m.includes(key));
  return k ? ERRORS[k][en ? 0 : 1] : en ? "Something went wrong. Try again." : "Prišlo je do napake. Poskusi znova.";
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const label: CSSProperties = { display: "block", fontFamily: MICHROMA, fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`, padding: "10px 12px", fontFamily: "monospace", fontSize: 16, minHeight: 44 };
const segBtn = (active: boolean, color = ACCENT): CSSProperties => ({
  flex: 1, minHeight: 44, padding: "0 8px", border: `1px solid ${active ? color : `${ACCENT}44`}`, background: active ? color : "transparent",
  color: active ? "#0b0d09" : INK, fontFamily: MICHROMA, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
});

function Big({ n, label: l }: { n: number; label: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 0 }}>
      <div style={{ fontFamily: MICHROMA, fontSize: "clamp(22px, 6vw, 30px)", color: INK }}>{n}</div>
      <div style={{ fontFamily: MICHROMA, fontSize: 9, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginTop: 4 }}>{l}</div>
    </div>
  );
}

export function RsvpPanel({ event, lang, onCounts }: { event: RsvpEvent; lang: Lang; onCounts?: (going: number) => void }) {
  const en = lang === "en";
  const navigate = useNavigate();
  const attendanceFn = useServerFn(eventAttendance);
  const setFn = useServerFn(eventRsvpSet);
  const removeFn = useServerFn(eventRsvpRemove);
  const getMine = useServerFn(playerGetMine);
  const saveProfile = useServerFn(playerSaveMine);

  const [att, setAtt] = useState<Attendance | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contactOpenUi, setContactOpenUi] = useState<boolean | null>(null);
  // contact & ride form
  const [share, setShare] = useState<Share | null>(null);
  const [ride, setRide] = useState<Ride>("none");
  const [from, setFrom] = useState("");
  const [seats, setSeats] = useState(3);
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [forcedLine, setForcedLine] = useState(false);
  const [saved, setSaved] = useState(false);
  const applying = useRef(false);

  const cancelled = event.status === "cancelled";
  const over = eventEndMs(event) < Date.now();
  const next = `/events/${event.id}`;

  const load = useCallback(async () => {
    try {
      const a = await attendanceFn({ data: { eventId: event.id, accessToken: await token() } });
      setAtt(a); setLoadErr(false); onCounts?.(a.going);
      if (a.me) {
        setShare(a.me.phone_share as Share); setRide(a.me.ride_role as Ride); setFrom(a.me.ride_from ?? "");
        setSeats(a.me.ride_seats ?? 3); setNote(a.me.ride_note ?? "");
      }
      return a;
    } catch { setLoadErr(true); return null; }
  }, [attendanceFn, event.id, onCounts]);

  // Apply an answer chosen before signing in, once the player has a profile.
  const applyIntent = useCallback(async (a: Attendance | null) => {
    if (!a || applying.current) return;
    let intent: { eventId: string; status: Status } | null = null;
    try { intent = JSON.parse(sessionStorage.getItem(INTENT_KEY) ?? "null"); } catch { /* ignore */ }
    if (!intent || intent.eventId !== event.id) return;
    if (!a.viewer.signedIn || !a.viewer.hasProfile || a.viewer.needsReconsent) return;
    sessionStorage.removeItem(INTENT_KEY);
    if (a.me) return;
    applying.current = true;
    try {
      await setFn({ data: { accessToken: await token(), eventId: event.id, status: intent.status, phoneShare: "none", rideRole: "none" } });
      setNotice(intent.status === "going" ? (en ? "You're going" : "Prideš") : (en ? "Marked as maybe" : "Označeno kot morda"));
      await load();
    } catch (e) { setErr(errText(e, en)); }
    finally { applying.current = false; }
  }, [event.id, setFn, load, en]);

  useEffect(() => {
    void load().then(applyIntent);
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") void load().then(applyIntent);
    });
    return () => sub.subscription.unsubscribe();
  }, [load, applyIntent]);

  if (loadErr && !att) return null;
  if (!att) return <div style={{ marginTop: 22, height: 120, background: PANEL, border: `1px solid ${ACCENT}1f` }} className="event-skeleton" />;

  const v = att.viewer;
  const full = att.capacity !== null && att.going >= att.capacity;
  const me = att.me ?? null;
  const showContact = contactOpenUi ?? (v.adult && !!me);

  const start = (status: Status) => {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ eventId: event.id, status }));
    if (!v.signedIn) setAuthOpen(true);
    else navigate({ to: "/me", search: { next } as never });
  };

  const answer = async (status: Status | "not") => {
    setBusy(true); setErr(null); setNotice(null); setSaved(false);
    try {
      const t = await token();
      if (status === "not") await removeFn({ data: { accessToken: t, eventId: event.id } });
      else await setFn({ data: { accessToken: t, eventId: event.id, status, phoneShare: me?.phone_share ?? "none", rideRole: me?.ride_role ?? "none", rideFrom: me?.ride_from, rideSeats: me?.ride_seats, rideNote: me?.ride_note } });
      if (status !== "not" && !me && v.adult) setContactOpenUi(true);
      await load();
    } catch (e) { setErr(errText(e, en)); }
    finally { setBusy(false); }
  };

  const saveContact = async () => {
    if (!me || !share) return;
    setBusy(true); setErr(null); setSaved(false);
    try {
      const t = await token();
      if (share !== "none" && !v.hasPhone) {
        const n = normalizePhone(phone);
        if (!n.ok) throw new Error("validation:phone");
        const mine = await getMine({ data: { accessToken: t } });
        if (!mine.profile) throw new Error("needs_profile");
        await saveProfile({ data: { accessToken: t, profile: { ...mine.profile, phone: n.value } } });
      }
      await setFn({ data: { accessToken: t, eventId: event.id, status: me.status, phoneShare: share, rideRole: ride, rideFrom: from, rideSeats: seats, rideNote: note } });
      await load();
      setSaved(true);
    } catch (e) { setErr(errText(e, en)); }
    finally { setBusy(false); }
  };

  const pickRide = (r: Ride) => {
    setRide(r); setSaved(false);
    if (r !== "none" && share !== "attendees") { setShare("attendees"); setForcedLine(true); }
  };

  const shareTarget = share === "organiser" ? (en ? "the organiser" : "organizatorju") : (en ? "the organiser and signed-in adult players going to this event" : "organizatorju in prijavljenim polnoletnim igralcem, ki pridejo na ta dogodek");
  const canSeeList = !!att.attendees;
  const canSeeRides = canSeeList && (v.organiser || v.adult);

  return (
    <div style={{ marginTop: 22 }}>
      {/* 4a header numbers */}
      <section style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "16px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${att.seatsOffered > 0 ? 3 : 2}, minmax(0, 1fr))`, gap: 8 }}>
          <Big n={att.going} label={en ? "Going" : "Pride"} />
          <Big n={att.maybe} label={en ? "Maybe" : "Morda"} />
          {att.seatsOffered > 0 && <Big n={att.seatsOffered} label={en ? "Seats offered" : "Ponujena mesta"} />}
        </div>
        <CapacityBar going={att.going} capacity={att.capacity} lang={lang} />
        {event.schedule_changed_at && (
          <p style={{ marginTop: 10, display: "inline-block", border: `1px solid ${ACCENT}`, color: ACCENT, padding: "3px 8px", fontFamily: "monospace", fontSize: 11.5 }}>
            {en ? `Updated: time changed on ${shortDate(event.schedule_changed_at, event.tz, lang)}` : `Posodobljeno: čas spremenjen ${shortDate(event.schedule_changed_at, event.tz, lang)}`}
          </p>
        )}
      </section>

      {/* 4b your answer */}
      {cancelled || over ? (
        <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 13, color: MUTED, background: PANEL, border: `1px solid ${ACCENT}22`, padding: "12px 14px" }}>
          {cancelled ? (en ? "This event is cancelled. Answers are closed." : "Dogodek je odpovedan. Odgovori so zaprti.") : (en ? "This event is over." : "Dogodek je že mimo.")}
          {me && <> {en ? `Your answer: ${me.status === "going" ? "going" : "maybe"}.` : `Tvoj odgovor: ${me.status === "going" ? "pridem" : "morda"}.`}</>}
        </p>
      ) : (
        <section style={{ marginTop: 12, background: PANEL, border: `1px solid ${ACCENT}44`, padding: "16px 14px" }}>
          <h2 style={{ ...label, fontSize: 11, marginBottom: 12 }}>{en ? "Your answer" : "Tvoj odgovor"}</h2>
          {notice && <p role="status" style={{ color: OK, fontFamily: "monospace", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Check size={15} />{notice}</p>}
          {v.needsReconsent && (
            <div style={{ border: `1px solid ${ACCENT}`, background: `${ACCENT}14`, padding: "10px 12px", marginBottom: 12, fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.6 }}>
              {en ? "We updated the privacy notice. " : "Posodobili smo obvestilo o zasebnosti. "}
              <Link to="/privacy" style={{ color: ACCENT }}>{en ? "Read it" : "Preberi"}</Link>
              <div style={{ marginTop: 8 }}><Link to="/me" search={{ next } as never} className="ev-focus" style={btnPrimary}>{en ? "Accept" : "Sprejmi"}</Link></div>
            </div>
          )}

          {!v.hasProfile ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="ev-focus" style={{ ...btnPrimary, flex: "1 1 160px", opacity: full ? 0.5 : 1 }} disabled={full} onClick={() => start("going")}>{en ? "I'm going" : "Pridem"}</button>
                <button type="button" className="ev-focus" style={{ ...btnOutline, flex: "1 1 120px" }} onClick={() => start("maybe")}>{en ? "Maybe" : "Morda"}</button>
              </div>
              {full && <p style={{ color: ERR, fontFamily: "monospace", fontSize: 12, marginTop: 6 }}>{en ? "Event is full" : "Dogodek je poln"}</p>}
              <p style={{ fontFamily: "monospace", fontSize: 12, color: MUTED, lineHeight: 1.6, marginTop: 10 }}>
                {en ? "Account needed so organisers and other players know who is coming. Playing a game never needs one." : "Račun je potreben, da organizatorji in drugi igralci vedo, kdo pride. Za igranje igre ga nikoli ne potrebuješ."}
              </p>
            </>
          ) : !v.needsReconsent && (
            <>
              <div role="radiogroup" aria-label={en ? "Your answer" : "Tvoj odgovor"} style={{ display: "flex", gap: 6 }}>
                <button type="button" role="radio" aria-checked={me?.status === "going"} className="ev-focus" disabled={busy || (full && me?.status !== "going")}
                  style={{ ...segBtn(me?.status === "going"), opacity: full && me?.status !== "going" ? 0.45 : 1 }} onClick={() => me?.status !== "going" && answer("going")}>{en ? "Going" : "Pridem"}</button>
                <button type="button" role="radio" aria-checked={me?.status === "maybe"} className="ev-focus" disabled={busy} style={segBtn(me?.status === "maybe")} onClick={() => me?.status !== "maybe" && answer("maybe")}>{en ? "Maybe" : "Morda"}</button>
                <button type="button" role="radio" aria-checked={!me} className="ev-focus" disabled={busy} style={segBtn(!me, `${INK}`)} onClick={() => me && answer("not")}>{en ? "Not going" : "Ne pridem"}</button>
              </div>
              {full && me?.status !== "going" && <p style={{ color: ERR, fontFamily: "monospace", fontSize: 12, marginTop: 6 }}>{en ? "Event is full" : "Dogodek je poln"}</p>}

              {me && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${ACCENT}22`, paddingTop: 10 }}>
                  <button type="button" className="ev-focus" aria-expanded={showContact} onClick={() => setContactOpenUi(!showContact)}
                    style={{ width: "100%", minHeight: 44, background: "none", border: "none", color: ACCENT, fontFamily: MICHROMA, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: 0 }}>
                    {en ? "Contact and car pool" : "Stik in skupni prevoz"} <ChevronDown size={16} style={{ transform: showContact ? "rotate(180deg)" : "none" }} />
                  </button>
                  {showContact && (!v.adult ? (
                    <p style={{ fontFamily: "monospace", fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>{en ? "Contact sharing and car pool are for players 18 and older." : "Deljenje kontakta in skupni prevoz sta za igralce, stare 18 let in več."}</p>
                  ) : (
                    <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
                      <div role="radiogroup" aria-label={en ? "Phone sharing" : "Deljenje številke"} style={{ display: "grid", gap: 6 }}>
                        {([
                          ["none", en ? "Don't share my phone" : "Ne deli moje številke"],
                          ["organiser", en ? "Share with the organiser" : "Deli z organizatorjem"],
                          ["attendees", en ? "Share with the organiser and the other players going" : "Deli z organizatorjem in drugimi igralci, ki pridejo"],
                        ] as [Share, string][]).map(([val, txt]) => (
                          <label key={val} style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 44, padding: "8px 12px", border: `1px solid ${share === val ? ACCENT : `${ACCENT}33`}`, background: share === val ? `${ACCENT}14` : "transparent", fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}>
                            <input type="radio" name={`share-${event.id}`} checked={share === val} onChange={() => { setShare(val); setSaved(false); setForcedLine(false); if (val !== "attendees") setRide("none"); }} style={{ accentColor: ACCENT, width: 18, height: 18 }} />
                            {txt}
                          </label>
                        ))}
                      </div>
                      {share && share !== "none" && (
                        <p style={{ fontFamily: "monospace", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                          {en ? `Your phone number will be visible to ${shareTarget} until 3 days after the event. You can change this at any time.` : `Tvoja telefonska številka bo vidna ${shareTarget} do 3 dni po dogodku. To lahko kadar koli spremeniš.`}
                        </p>
                      )}
                      {share && share !== "none" && !v.hasPhone && (
                        <div>
                          <label style={label} htmlFor={`ph-${event.id}`}>{en ? "Phone number" : "Telefonska številka"}</label>
                          <input id={`ph-${event.id}`} className="ev-focus" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(x) => setPhone(x.target.value)} placeholder="041 123 456" style={input} />
                        </div>
                      )}

                      {(share === "attendees" || ride !== "none") && (
                        <div style={{ borderTop: `1px solid ${ACCENT}22`, paddingTop: 10, display: "grid", gap: 10 }}>
                          <span style={label}>{en ? "Car pool" : "Skupni prevoz"}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="ev-focus" style={segBtn(ride === "none")} onClick={() => pickRide("none")}>{en ? "No ride needed" : "Ne potrebujem"}</button>
                            <button type="button" className="ev-focus" style={segBtn(ride === "driver")} onClick={() => pickRide("driver")}>{en ? "I can drive" : "Lahko peljem"}</button>
                            <button type="button" className="ev-focus" style={segBtn(ride === "rider")} onClick={() => pickRide("rider")}>{en ? "I need a ride" : "Rabim prevoz"}</button>
                          </div>
                          {forcedLine && <p style={{ fontFamily: "monospace", fontSize: 12, color: ACCENT }}>{en ? "To arrange a ride your phone must be visible to the other players going." : "Za dogovor o prevozu mora biti tvoja številka vidna drugim igralcem, ki pridejo."}</p>}
                          {ride !== "none" && (
                            <>
                              <div>
                                <label style={label} htmlFor={`from-${event.id}`}>{en ? "Leaving from" : "Odhod iz"}</label>
                                <input id={`from-${event.id}`} className="ev-focus" list={`towns-${event.id}`} maxLength={60} value={from} onChange={(x) => { setFrom(x.target.value); setSaved(false); }} style={input} />
                                <datalist id={`towns-${event.id}`}>{SI_TOWNS.map((t) => <option key={t} value={t} />)}</datalist>
                                <p style={{ fontFamily: "monospace", fontSize: 11.5, color: MUTED, marginTop: 4 }}>{en ? "Town only, never your address." : "Samo kraj, nikoli naslova."}</p>
                              </div>
                              {ride === "driver" && (
                                <div>
                                  <span style={label}>{en ? "Free seats" : "Prosta mesta"}</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <button type="button" className="ev-focus" aria-label="-" style={{ ...btnOutline, minWidth: 44, padding: 0 }} onClick={() => setSeats((s) => Math.max(1, s - 1))}><Minus size={16} /></button>
                                    <span style={{ fontFamily: MICHROMA, fontSize: 18, minWidth: 24, textAlign: "center" }} aria-live="polite">{seats}</span>
                                    <button type="button" className="ev-focus" aria-label="+" style={{ ...btnOutline, minWidth: 44, padding: 0 }} onClick={() => setSeats((s) => Math.min(8, s + 1))}><Plus size={16} /></button>
                                  </div>
                                </div>
                              )}
                              <div>
                                <label style={label} htmlFor={`note-${event.id}`}>{en ? "Note (optional)" : "Opomba (neobvezno)"}</label>
                                <input id={`note-${event.id}`} className="ev-focus" maxLength={120} value={note} onChange={(x) => { setNote(x.target.value); setSaved(false); }}
                                  placeholder={en ? "e.g. leaving Friday 17:00 from the Petrol in Kranj" : "npr. odhod v petek ob 17:00 s Petrola v Kranju"} style={input} />
                                <p style={{ fontFamily: "monospace", fontSize: 11, color: MUTED, textAlign: "right", marginTop: 2 }}>{note.length}/120</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <p style={{ fontFamily: "monospace", fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
                        {en ? "Share costs only. Rides are arranged between players, at their own responsibility. See the " : "Delite le stroške. Prevoze se dogovorijo igralci med seboj, na lastno odgovornost. Glej "}
                        <Link to="/terms" style={{ color: ACCENT }}>{en ? "Terms" : "pogoje"}</Link>.
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button type="button" className="ev-focus" style={{ ...btnPrimary, opacity: !share || busy ? 0.5 : 1 }} disabled={!share || busy} onClick={saveContact}>{en ? "Save" : "Shrani"}</button>
                        {saved && <span role="status" style={{ color: OK, fontFamily: "monospace", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={14} />{en ? "Saved" : "Shranjeno"}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {err && <p role="alert" style={{ color: ERR, fontFamily: "monospace", fontSize: 12.5, marginTop: 10 }}>{err}</p>}
        </section>
      )}

      {/* 4d who is going */}
      {canSeeList ? (
        <AttendeeList attendees={att.attendees ?? []} organiser={v.organiser} going={att.going} maybe={att.maybe} lang={lang} />
      ) : !v.signedIn ? (
        <LockedAttendees lang={lang} onSignIn={() => setAuthOpen(true)} />
      ) : null}

      {/* 4e car pool */}
      {canSeeRides ? <CarpoolBoard rides={att.rides ?? []} lang={lang} /> : !v.signedIn && (
        <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, color: MUTED }}>{en ? "Sign in (18+) to see rides." : "Prijavi se (18+), da vidiš prevoze."}</p>
      )}

      <PlayerAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} next={next} onDone={() => { void load().then(async (a) => { if (a?.viewer.signedIn && !a.viewer.hasProfile) navigate({ to: "/me", search: { next } as never }); else await applyIntent(a); }); }} />
    </div>
  );
}
