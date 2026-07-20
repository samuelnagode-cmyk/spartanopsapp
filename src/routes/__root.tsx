import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { LanguageProvider } from "@/lib/i18n";
import { PremiumProvider } from "@/lib/premium";
import { AmbientAudioProvider } from "@/components/AmbientAudio";
import MissionInProgressModal from "@/components/MissionInProgressModal";
import SpartacusGpsGate from "@/components/SpartacusGpsGate";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground font-display">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Stran ni bila najdena</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Stran, ki jo iščete, ne obstaja ali je bila premaknjena.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-lg bg-forest px-4 py-2 text-sm font-accent font-medium text-cream transition-colors hover:bg-forest-light">
            Domov
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light" },
      { name: "supported-color-schemes", content: "light" },
      { name: "theme-color", content: "#0a0c08" },
      { title: "SpartanOps APP" },
      { name: "description", content: "SpartanOps: Next-Gen Tactical Command & Real-Time Airsoft Match Telemetry via QR codes." },
      { name: "author", content: "SpartanOps" },
      { property: "og:title", content: "SpartanOps APP" },
      { property: "og:description", content: "SpartanOps: Next-Gen Tactical Command & Real-Time Airsoft Match Telemetry via QR codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "SpartanOps APP" },
      { name: "twitter:description", content: "SpartanOps: Next-Gen Tactical Command & Real-Time Airsoft Match Telemetry via QR codes." },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/pnuEeej0s2fuaeyJ1j4H7JsWP8j1/social-images/social-1784546307603-SEKTORJI_PREDSTAVITEV-08.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/pnuEeej0s2fuaeyJ1j4H7JsWP8j1/social-images/social-1784546307603-SEKTORJI_PREDSTAVITEV-08.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Source+Sans+3:wght@300;400;500;600;700&family=Josefin+Sans:wght@400;500;600;700&family=Michroma&family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("airsoft-route");
  }, [pathname]);
  const hideFooter =
    pathname.startsWith("/misija") ||
    pathname.startsWith("/capture");
  return (
    <LanguageProvider>
      <PremiumProvider>
        <AmbientAudioProvider>
          <Header />
          <main className="min-h-screen">
            <Outlet />
          </main>
          {!hideFooter && <Footer />}
          <MissionInProgressModal />
          <SpartacusGpsGate />
        </AmbientAudioProvider>
      </PremiumProvider>
    </LanguageProvider>
  );
}

