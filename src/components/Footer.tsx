import { Mail, Phone, MapPin, Instagram, Facebook, ExternalLink } from "lucide-react";
import { useLocation, Link, useNavigate } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { clearMasterPw, useMasterAdmin } from "@/lib/master-admin";

export default function Footer() {
  const t = useT();
  const navigate = useNavigate();
  const isAdmin = useMasterAdmin();

  useLocation();
  const isAirsoft = true;

  // Airsoft variant — pure tactical black, gold/amber brand accent.
  const airsoft = {
    background: "#000000",
    overlay: "none",
    topFade: "none",
    ivory: "#9ca3af",          // cool cyber-gray for body text
    ivoryMuted: "rgba(156,163,175,0.55)",
    ivoryFaint: "rgba(156,163,175,0.32)",
    accent: "#E0B04E",         // brand premium gold
    accentSoft: "rgba(224,176,78,0.35)",
    brand: "#E0B04E",          // gold brand wordmark
    topFadeHeight: 0,
    grain: "",
  };


  // Glamping variant — desaturated sage/olive, soft and elegant
  const glamping = {
    background:
      "linear-gradient(180deg, #47513a 0%, #3b4432 50%, #2f382a 100%)",
    // Very faint, even atmospheric shading — no centered glow
    overlay:
      "radial-gradient(ellipse 130% 80% at 50% 115%, rgba(0,0,0,0.18), transparent 72%), radial-gradient(ellipse 100% 70% at 12% 8%, rgba(168,133,61,0.05), transparent 75%)",
    // Subtle tonal shift only — short, barely perceptible blend
    topFade:
      "linear-gradient(to bottom, rgba(85,97,73,0.55) 0%, rgba(85,97,73,0.22) 60%, transparent 100%)",
    ivory: "#efe6cf",
    ivoryMuted: "rgba(239, 230, 207, 0.7)",
    ivoryFaint: "rgba(239, 230, 207, 0.4)",
    accent: "#c9a35a",
    accentSoft: "rgba(201, 163, 90, 0.3)",
    brand: "#f6eed7",
    topFadeHeight: 64,
    // VERY subtle natural grain — almost invisible
    grain:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.12  0 0 0 0 0.14  0 0 0 0 0.10  0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
  };

  const v = isAirsoft ? airsoft : glamping;

  return (
    <footer
      style={{
        background: v.background,
        color: v.ivory,
        position: "relative",
        overflow: "visible",
        isolation: "isolate",
      }}
    >
      {/* Top border separator above the footer (airsoft only) */}
      {isAirsoft && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 1,
            background: `linear-gradient(90deg, transparent 0%, ${airsoft.accent} 18%, ${airsoft.accent} 82%, transparent 100%)`,
            opacity: 0.7,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}


      {/* Atmospheric overlay (glamping only) */}
      {v.overlay !== "none" && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: v.overlay,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Subtle grain */}
      {v.grain && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: v.grain,
            opacity: isAirsoft ? 0.35 : 0.5,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Inner top fade (glamping only) */}
      {v.topFade !== "none" && v.topFadeHeight > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: v.topFadeHeight,
            background: v.topFade,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      <div className={`relative max-w-5xl mx-auto px-6 sm:px-8 ${isAirsoft ? "pt-24 md:pt-28" : "pt-16 md:pt-20"} pb-8`}>
        {/* Brand centerpiece */}
        <div className="text-center">
          <img
            src="https://res.cloudinary.com/dfifiytid/image/upload/v1783784323/SpartanOps%20app%20v1.0/LOGO/spartan_ops_napis_brez_ozadja-06.webp"
            alt="SpartanOps"
            className="mx-auto block w-full h-auto"
            style={{ maxWidth: "min(320px, 72vw)" }}
            loading="lazy"
            decoding="async"
          />
          {/* Spartan collaboration line — clickable */}
          {isAirsoft && (
            <a
              href="https://glampingzeleniraj.si/airsoft"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-100"
              style={{
                fontSize: 11,
                color: v.ivoryFaint,
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = v.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = v.ivoryFaint)}
            >
              <span>{t("footer.spartan.collab")}</span>
              <ExternalLink size={11} strokeWidth={1.5} />
            </a>
          )}
          {!isAirsoft && (
            <p
              className="font-display italic mt-3"
              style={{ fontSize: 14, color: v.accent, letterSpacing: "0.4px" }}
            >
              {t("footer.slogan")}
            </p>
          )}
        </div>

        {/* Soft divider (glamping only) — airsoft uses generous spacing instead */}
        {!isAirsoft && (
          <div
            className="my-9 mx-auto"
            style={{
              height: 1,
              maxWidth: 96,
              background: `linear-gradient(90deg, transparent, ${v.accentSoft}, transparent)`,
            }}
          />
        )}
        {isAirsoft && <div className="mt-10" />}


        {/* Contact */}
        <div className="flex flex-col md:flex-row md:justify-center md:items-center md:flex-wrap gap-3 md:gap-x-9 md:gap-y-2.5 text-center">
          <a
            href="mailto:info@spartanopsapp.com"
            className="inline-flex items-center justify-center gap-2.5 text-[13.5px] leading-none transition-opacity opacity-90 hover:opacity-100"
            style={{ color: v.ivory }}
          >
            <Mail size={14} style={{ color: v.accent, flexShrink: 0 }} strokeWidth={1.5} />
            <span>info@spartanopsapp.com</span>
          </a>
          <a
            href="tel:+38670761455"
            className="inline-flex items-center justify-center gap-2.5 text-[13.5px] leading-none transition-opacity opacity-90 hover:opacity-100"
            style={{ color: v.ivory }}
          >
            <Phone size={14} style={{ color: v.accent, flexShrink: 0 }} strokeWidth={1.5} />
            <span>070 761 455</span>
          </a>
          <a
            href="https://www.google.com/maps/search/?api=1&query=Glamping+Zeleni+Raj+Va%C4%8De"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 text-[13.5px] leading-none transition-opacity opacity-90 hover:opacity-100"
            style={{ color: v.ivory }}
          >
            <MapPin size={14} style={{ color: v.accent, flexShrink: 0 }} strokeWidth={1.5} />
            <span>Vače, Slovenija</span>
          </a>
        </div>

        {/* Social */}
        <div className="mt-6 md:mt-5 flex justify-center items-center gap-7">
          {[
            { href: "https://www.instagram.com/spartanopsapp/", label: "Instagram", Icon: Instagram },
            { href: "https://www.facebook.com/profile.php?id=61593535313976", label: "Facebook", Icon: Facebook },
          ].map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              style={{ color: v.accent }}
              className="transition-opacity opacity-90 hover:opacity-100"
            >
              <Icon size={20} strokeWidth={1.5} />
            </a>
          ))}
        </div>

        {/* Copyright */}
        <p
          className="text-center mt-10"
          style={{ color: v.ivoryFaint, fontSize: 11, letterSpacing: "0.3px" }}
        >
          {t("footer.rights")}
          {isAirsoft && (
            <>
              {" · "}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    clearMasterPw();
                    void navigate({ to: "/spartanops" });
                  }}
                  style={{
                    background: "transparent", border: "none", padding: 0, cursor: "pointer",
                    font: "inherit", color: v.ivoryFaint, letterSpacing: "0.2em",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = v.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = v.ivoryFaint)}
                >
                  EXIT ADMIN
                </button>
              ) : (
                <Link
                  to="/admin-pregled"
                  search={{ edit: "1" }}
                  style={{ color: v.ivoryFaint, textDecoration: "none", letterSpacing: "0.2em" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = v.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = v.ivoryFaint)}
                >
                  ADMIN
                </Link>
              )}
            </>
          )}

        </p>
      </div>
    </footer>
  );
}
