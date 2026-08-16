import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronLeft, ChevronDown, Globe } from "lucide-react";
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
        !menuRef.current.contains(e.target as Node)
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

  // Prevent body scroll when menu open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
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
              <span
                className={`font-mono uppercase select-none ${isHome ? "" : "ml-auto"}`}
                style={{
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  fontWeight: 700,
                  color: "#E0B04E",
                  padding: "4px 8px 3px",
                  borderRadius: 3,
                  background: "linear-gradient(135deg, rgba(248,216,140,0.14) 0%, rgba(224,176,78,0.10) 100%)",
                  border: "1px solid rgba(224,176,78,0.45)",
                  boxShadow: "0 0 14px -4px rgba(224,176,78,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
                  textShadow: "0 0 10px rgba(224,176,78,0.35)",
                }}
              >
                BETA
              </span>
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
                onClick={() => setOpen(!open)}
                className="relative z-[95] p-2 transition-opacity hover:opacity-80"
                style={{
                  color: open ? "#2f3f2b" : forest,
                  backgroundColor: open
                    ? "rgba(63, 88, 57, 0.08)"
                    : "transparent",
                  borderRadius: 999,
                }}
                aria-label={t("nav.openMenu")}
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
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-[60]"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              opacity: open ? 1 : 0,
              transition: "opacity 0.35s ease",
            }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Menu panel */}
          <div
            className="fixed left-0 right-0 z-[70]"
            style={{
              top: 64,
              background: "#0a0c08",
              borderTop: "1px solid rgba(224,176,78,0.30)",
              borderBottom: "1px solid rgba(224,176,78,0.18)",
              boxShadow: "0 20px 40px -20px rgba(0,0,0,0.7)",
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(-12px)",
              transition: "opacity 0.35s ease, transform 0.35s ease",
            }}
          >
            <nav className="px-6 py-8 max-w-2xl mx-auto space-y-6">
              {([
                { label: lang === "en" ? "HOME" : "DOMOV", to: "/spartanops" as const },
                { label: lang === "en" ? "JOIN MISSION" : "PRIDRUŽI SE MISIJI", to: "/join" as const },
                { label: lang === "en" ? "MARSHAL COMMAND CENTER" : "MARSHAL COMMAND CENTER", to: "/admin-pregled" as const },
                { label: lang === "en" ? "SYSTEM UPDATES" : "SISTEMSKE POSODOBITVE", to: "/updates" as const },
                { label: lang === "en" ? "PRICING" : "CENIK", to: "/spartanops" as const, hash: "pricing" },
                { label: lang === "en" ? "PRINT" : "TISK", to: "/print" as const },
                { label: lang === "en" ? "MISSION ARCHIVE" : "ARHIV MISIJ", to: "/archive" as const },
              ]).map((link) => (
                <Link
                  key={`${link.label}`}
                  to={link.to as any}
                  hash={(link as any).hash}
                  search={(link as any).search}
                  onClick={() => setOpen(false)}
                  className="group block transition-colors"
                  style={{
                    fontFamily: "'Michroma', monospace",
                    fontSize: 13,
                    letterSpacing: "0.18em",
                    color: "#ece3c4",
                    textTransform: "uppercase",
                  }}
                  activeOptions={{ exact: true, includeHash: true, includeSearch: true }}
                  inactiveProps={{
                    style: {
                      fontFamily: "'Michroma', monospace",
                      fontSize: 13,
                      letterSpacing: "0.18em",
                      color: "#ece3c4",
                      textTransform: "uppercase",
                    },
                  }}
                  activeProps={{
                    style: {
                      fontFamily: "'Michroma', monospace",
                      fontSize: 13,
                      letterSpacing: "0.18em",
                      color: "#ece3c4",
                      textTransform: "uppercase",
                    },
                  }}
                >
                  <span className="inline-flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      style={{
                        color: "#E0B04E",
                        fontSize: 12,
                        letterSpacing: "0.10em",
                        opacity: 0.75,
                        transition: "opacity 0.2s ease",
                      }}
                      className="group-hover:opacity-100"
                    >
                      //
                    </span>
                    <span
                      className="group-hover:text-[#E0B04E]"
                      style={{ transition: "color 0.2s ease" }}
                    >
                      {link.label}
                    </span>
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
