import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronLeft, ChevronDown, Globe, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { playerGetMine } from "@/lib/player.functions";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useSignedIn, useIsMarshal, useAccountLabel } from "@/lib/use-signed-in";
import logoImg from "@/assets/logo-glamping.png";
const AIRSOFT_LOGO = "https://res.cloudinary.com/dfifiytid/image/upload/v1783765381/SpartanOps%20app%20v1.0/LOGO/SpartanOps_app_LOGO_NO_BACKROUND-05.webp";
import { useT, useLang, type Lang } from "@/lib/i18n";



export default function Header() {
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const t = useT();
  const { lang, setLang } = useLang();
  const location = useLocation();
  const isHome = location.pathname === "/spartanops";
  const isAirsoft = true;
  const logoTo = "/spartanops";
  const langRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const signedIn = useSignedIn();
  const isMarshal = useIsMarshal();
  const accountLabel = useAccountLabel();
  const accountInitial = accountLabel ? Array.from(accountLabel.trim())[0]?.toUpperCase() ?? null : null;
  const en = lang === "en";
  const getMine = useServerFn(playerGetMine);
  const navRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  // Close on every navigation
  useEffect(() => { setOpen(false); }, [location.pathname, location.hash]);
  // Focus: first item on open, menu button on close
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => navRef.current?.querySelector<HTMLElement>("a,button")?.focus(), 30);
      wasOpen.current = true;
      return () => window.clearTimeout(t);
    }
    if (wasOpen.current) { wasOpen.current = false; menuBtnRef.current?.focus(); }
  }, [open, menuVisible]);
  const [avatar, setAvatar] = useState<{ icon: string; color: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!s) { if (!cancelled) setAvatar(null); return; }
      try {
        const r = await getMine({ data: { accessToken: s.access_token } });
        const p = r.profile as { avatar_icon?: string | null; avatar_color?: string | null } | null;
        if (!cancelled) setAvatar(p?.avatar_icon && p.avatar_color ? { icon: p.avatar_icon, color: p.avatar_color } : null);
      } catch { /* keep initial */ }
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    window.addEventListener("spartanops:profile-saved", load);
    return () => { cancelled = true; sub.subscription.unsubscribe(); window.removeEventListener("spartanops:profile-saved", load); };
  }, [getMine]);

  // Smooth menu open/close
  useEffect(() => {
    if (open) {
      setMenuVisible(true);
    } else {
      const timer = setTimeout(() => setMenuVisible(false), 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (
        open &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !menuBtnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent page scroll behind the menu
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) return;
    return () => { document.documentElement.style.overflow = ""; document.body.style.overflow = ""; };
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // On airsoft routes, lock html/body background to the tactical dark color so
  // there is no white gap above the fixed header (e.g. overscroll bounce on iOS).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (isAirsoft) {
      const prevHtml = html.style.backgroundColor;
      const prevBody = body.style.backgroundColor;
      html.style.backgroundColor = "#0a0c08";
      body.style.backgroundColor = "#0a0c08";
      return () => {
        html.style.backgroundColor = prevHtml;
        body.style.backgroundColor = prevBody;
      };
    }
  }, [isAirsoft]);


  const normalizeHash = (hash: string) => hash.replace(/^#/, "");

  const scrollToHashTarget = (hash: string, behavior: ScrollBehavior = "smooth") => {
    const id = normalizeHash(hash);
    if (!id) return;
    const attempt = (tries: number) => {
      const el = document.getElementById(id);
      if (!el) {
        if (tries > 0) window.setTimeout(() => attempt(tries - 1), 80);
        return;
      }
      const headerEl = document.querySelector("header") as HTMLElement | null;
      const headerHeight = headerEl?.getBoundingClientRect().height ?? 80;
      const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ top: Math.max(0, top), left: 0, behavior });
      // Force repaint on the header after scroll settles to clear paint artifacts
      window.setTimeout(() => {
        if (headerEl) {
          // Toggle a transform to force GPU layer refresh
          headerEl.style.transform = "translateZ(0) translateY(0.001px)";
          requestAnimationFrame(() => {
            headerEl.style.transform = "translateZ(0)";
          });
        }
        window.dispatchEvent(new Event("resize"));
      }, behavior === "smooth" ? 700 : 50);
    };
    attempt(8);
  };

  useEffect(() => {
    if (!location.hash) return;
    const timer = window.setTimeout(() => scrollToHashTarget(location.hash, "smooth"), 380);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);




  const muted = isAirsoft ? "#ece3c4" : "#6b6258";
  const forest = isAirsoft ? "#ece3c4" : "#3f5839";
  const headerBg = isAirsoft ? "rgba(10, 12, 8, 1)" : "rgba(245, 239, 225, 1)";
  const headerBorder = isAirsoft
    ? "none"
    : "1px solid rgba(184, 134, 11, 0.14)";
  const headerLogo = isAirsoft ? AIRSOFT_LOGO : logoImg;


  // Dropdown palette that matches the current section theme (dark for airsoft, cream for glamping)
  const dropdownBg = isAirsoft ? "rgba(20, 24, 16, 0.98)" : "rgba(250, 247, 240, 0.98)";
  const dropdownBorder = isAirsoft ? "1px solid rgba(224,176,78,0.35)" : "1px solid rgba(184, 134, 11, 0.10)";
  const dropdownActiveText = isAirsoft ? "#E0B04E" : "#3f5839";
  const dropdownIdleText = isAirsoft ? "rgba(236,227,196,0.75)" : "#6b6258";
  const dropdownActiveBg = isAirsoft ? "rgba(224,176,78,0.10)" : "rgba(61, 124, 61, 0.06)";

  const LangSelector = () => (
    <div ref={langRef} className="relative" style={{ zIndex: 120 }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLangOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1.5 font-accent transition-opacity hover:opacity-70"
        style={{
          fontSize: 12,
          letterSpacing: "1.8px",
          color: muted,
          padding: "6px 4px",
          background: "transparent",
          cursor: "pointer",
        }}
        aria-haspopup="listbox"
        aria-expanded={langOpen}
        aria-label={t("nav.language")}
      >
        <Globe size={13} strokeWidth={1.4} style={{ opacity: 0.55 }} />
        <span style={{ fontWeight: 500, color: forest }}>{lang.toUpperCase()}</span>
        <ChevronDown
          size={10}
          strokeWidth={1.4}
          style={{
            opacity: 0.45,
            transition: "transform 0.3s ease",
            transform: langOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      <div
        role="listbox"
        className="absolute right-0 rounded-xl overflow-hidden"
        style={{
          top: "calc(100% + 8px)",
          minWidth: 110,
          backgroundColor: dropdownBg,
          border: dropdownBorder,
          boxShadow: "0 8px 28px -10px rgba(0, 0, 0, 0.35)",
          backdropFilter: "blur(10px)",
          padding: "6px",
          zIndex: 130,
          opacity: langOpen ? 1 : 0,
          transform: langOpen ? "translateY(0)" : "translateY(-4px)",
          pointerEvents: langOpen ? "auto" : "none",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}
      >
        {(["sl", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            role="option"
            aria-selected={lang === l}
            onClick={(e) => {
              e.stopPropagation();
              setLang(l);
              setLangOpen(false);
            }}
            className="block w-full text-center font-accent rounded-lg"
            style={{
              fontSize: 12,
              letterSpacing: "1.6px",
              padding: "10px 14px",
              color: lang === l ? dropdownActiveText : dropdownIdleText,
              fontWeight: lang === l ? 600 : 400,
              background: lang === l ? dropdownActiveBg : "transparent",
              cursor: "pointer",
              border: "none",
            }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );

  const isCurrent = (to: string, hash?: string) =>
    location.pathname === to && (hash ? location.hash.replace(/^#/, "") === hash : !location.hash || to !== "/spartanops");
  const menuLink = ({ label, to, hash }: { label: string; to: string; hash?: string }) => {
    const active = isCurrent(to, hash);
    return (
      <Link key={label} to={to as never} hash={hash} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
        className="menu-item group block"
        style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.18em", color: active ? "#E0B04E" : "#ece3c4", textTransform: "uppercase", textDecoration: "none" }}>
        <span className="inline-flex items-center gap-3">
          <span aria-hidden="true" className="group-hover:opacity-100" style={{ color: "#E0B04E", fontSize: 12, letterSpacing: "0.10em", opacity: active ? 1 : 0.75, transition: "opacity 0.2s ease" }}>//</span>
          <span className="group-hover:text-[#E0B04E]" style={{ transition: "color 0.2s ease" }}>{label}</span>
        </span>
      </Link>
    );
  };

  const layoutCols = "grid-cols-3";

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0"
        style={{
          zIndex: 1000,
          width: "100%",
          backgroundColor: headerBg,
          borderBottom: headerBorder,
          boxShadow: isAirsoft
            ? "none"
            : "0 1px 0 rgba(255,255,255,0.5) inset, 0 6px 24px -18px rgba(45, 62, 42, 0.35)",
          transition: "background-color 0.3s ease, box-shadow 0.3s ease",
          isolation: "isolate",
          overflow: "visible",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid ${layoutCols} items-center h-16 lg:h-20`}>
            <div className="flex items-center justify-start gap-2 sm:gap-3">
              {!isHome && (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.history.length > 1) {
                      window.history.back();
                    } else {
                      window.location.href = "/spartanops";
                    }
                  }}
                  className="group inline-flex items-center gap-1.5 font-accent transition-opacity hover:opacity-70"
                  style={{
                    fontSize: 12,
                    letterSpacing: "1.4px",
                    color: muted,
                    padding: "6px 2px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                  aria-label={t("nav.back")}
                >
                  <ChevronLeft
                    size={14}
                    strokeWidth={1.5}
                    style={{ transition: "transform 0.3s ease" }}
                    className="group-hover:-translate-x-0.5"
                  />
                  <span className="hidden sm:inline">{t("nav.back")}</span>
                </button>
              )}
              <Link
                to="/me"
                aria-label={signedIn ? (en ? "My account" : "Moj račun") : (en ? "Sign in or create account" : "Prijava ali registracija")}
                className={`relative inline-flex items-center justify-center transition-opacity hover:opacity-80 focus-visible:opacity-80 ${isHome ? "" : "ml-auto"}`}
                style={{ width: 44, height: 44, flexShrink: 0, color: "#E0B04E" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 40, height: 40, borderRadius: 999,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid rgba(224,176,78,0.6)",
                    background: signedIn && accountInitial && !avatar ? avatarTint(accountLabel ?? "") : "transparent",
                    fontFamily: "'Michroma', monospace", fontSize: 13, lineHeight: 1,
                  }}
                >
                  {signedIn && avatar ? <PlayerAvatar icon={avatar.icon} color={avatar.color} name={accountLabel ?? "?"} size={34} /> : signedIn && accountInitial ? accountInitial : <User size={20} strokeWidth={1.6} />}
                </span>
              </Link>
            </div>

            <div className="flex items-center justify-center">
              <Link
                to={logoTo}
                aria-label="SpartanOps"
                className="relative z-[95] inline-flex"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              >
                <img
                  src={headerLogo}
                  alt="SpartanOps"
                  className="h-10 sm:h-12 md:h-14 w-auto object-contain block"
                />
                <span
                  aria-hidden="true"
                  className="absolute select-none pointer-events-none"
                  style={{ top: -2, left: "100%", marginLeft: 2, fontFamily: "'Michroma', monospace", fontSize: 8, letterSpacing: "0.2em", color: "#E0B04E", lineHeight: 1 }}
                >
                  BETA
                </span>
              </Link>
            </div>


            <div className="flex items-center justify-end gap-3 sm:gap-5">
              {LangSelector()}
              <span
                aria-hidden="true"
                className="hidden sm:inline-block"
                style={{
                  width: 1,
                  height: 14,
                  backgroundColor: "rgba(107, 98, 88, 0.22)",
                }}
              />
              <button
                ref={menuBtnRef}
                aria-controls="site-menu"
                onClick={() => setOpen(!open)}
                className="relative z-[95] p-2 transition-opacity hover:opacity-80"
                style={{
                  color: open ? "#2f3f2b" : forest,
                  backgroundColor: open
                    ? "rgba(63, 88, 57, 0.08)"
                    : "transparent",
                  borderRadius: 999,
                }}
                aria-label={open ? (en ? "Close menu" : "Zapri meni") : (en ? "Open menu" : "Odpri meni")}
                aria-expanded={open}
              >
                {open ? (
                  <X
                    size={24}
                    strokeWidth={2.4}
                    style={{ opacity: 1, display: "block" }}
                  />
                ) : (
                  <Menu size={20} strokeWidth={1.6} />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Overlay + Menu — tactical dark drawer */}
      {menuVisible && (
        <div ref={menuRef}>
          <div
            className="fixed inset-0 z-[60]"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", opacity: open ? 1 : 0, transition: "opacity 0.35s ease" }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            id="site-menu"
            className="fixed left-0 right-0 z-[70]"
            style={{
              top: 64, maxHeight: "calc(100dvh - 64px)", overflowY: "auto", overscrollBehavior: "contain",
              background: "#0a0c08", borderTop: "1px solid rgba(224,176,78,0.30)", borderBottom: "1px solid rgba(224,176,78,0.18)",
              boxShadow: "0 20px 40px -20px rgba(0,0,0,0.7)", opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(-12px)", transition: "opacity 0.35s ease, transform 0.35s ease",
            }}
          >
            <nav ref={navRef} aria-label={en ? "Main menu" : "Glavni meni"} className="px-6 py-6 max-w-2xl mx-auto">
              {/* Account block */}
              <div style={{ paddingBottom: 18, marginBottom: 22, borderBottom: "1px solid rgba(224,176,78,0.18)" }}>
                {signedIn ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Link to="/me" onClick={() => setOpen(false)} className="menu-item flex items-center gap-3" style={{ flex: 1, minWidth: 0, minHeight: 44, textDecoration: "none", color: "#ece3c4" }}>
                      <PlayerAvatar icon={avatar?.icon} color={avatar?.color} name={accountLabel ?? email ?? "?"} size={40} />
                      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.12em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{accountLabel ?? ""}</span>
                        {email && <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(236,227,196,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>}
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#E0B04E", letterSpacing: "0.08em" }}>{en ? "My account →" : "Moj račun →"}</span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={async () => { setOpen(false); await supabase.auth.signOut(); }}
                      className="menu-item"
                      style={{ minHeight: 44, minWidth: 44, padding: "0 6px", flexShrink: 0, fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.18em", color: "rgba(224,176,78,0.75)", background: "transparent", border: "none", cursor: "pointer", textTransform: "uppercase" }}
                    >
                      {en ? "SIGN OUT" : "ODJAVA"}
                    </button>
                  </div>
                ) : (
                  <Link to="/me" onClick={() => setOpen(false)} className="menu-item flex items-center justify-center"
                    style={{ minHeight: 44, width: "100%", background: "#E0B04E", color: "#0a0c08", fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, textDecoration: "none", padding: "0 12px" }}>
                    {en ? "SIGN IN / CREATE ACCOUNT" : "PRIJAVA / REGISTRACIJA"}
                  </Link>
                )}
              </div>
              <div className="space-y-6">
                {menuLink({ label: en ? "HOME" : "DOMOV", to: "/spartanops" })}
                {menuLink({ label: en ? "JOIN A GAME" : "VSTOPI V IGRO", to: "/join" })}
                {menuLink({ label: en ? "EVENTS" : "DOGODKI", to: "/events" })}
              </div>
              <div style={{ borderTop: "1px solid rgba(224,176,78,0.12)", margin: "30px 0 14px" }} />
              <p aria-hidden="true" style={{ fontFamily: "'Michroma', monospace", fontSize: 8, letterSpacing: "0.3em", color: "#E0B04E", margin: "0 0 18px" }}>{en ? "FOR FIELDS" : "ZA POLIGONE"}</p>
              <div className="space-y-6">
                {signedIn && isMarshal && menuLink({ label: en ? "COMMAND CENTER" : "KOMANDNI CENTER", to: "/admin-pregled" })}
                {menuLink({ label: en ? "PRICING" : "CENIK", to: "/spartanops", hash: "pricing" })}
                {menuLink({ label: en ? "FIELD MANUAL" : "PRIROČNIK", to: "/intel" })}
                {menuLink({ label: en ? "PRINT KIT" : "TISKOVINE", to: "/print" })}
                {menuLink({ label: en ? "WHAT'S NEW" : "NOVOSTI", to: "/updates" })}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

/** Same hue as the attendee avatars on events (AttendeeList), as a thin tint. */
function avatarTint(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 38% / 0.18)`;
}
