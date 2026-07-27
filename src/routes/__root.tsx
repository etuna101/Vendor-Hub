import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import logoUrl from "@/assets/vendorhub-logo.png";

function replaceLovableWatermark() {
  const selectors = [
    "#lovable-watermark",
    ".lovable-watermark",
    ".lovable-brand",
    "[data-lovable-watermark]",
    "img[alt*='lovable' i]",
    "a[href*='lovable.dev' i]",
    "[id*='lovable' i]",
    "[class*='lovable' i]",
  ];

  document.querySelectorAll(selectors.join(",")).forEach((node) => node.remove());

  if (document.getElementById("vendorhub-watermark")) return;

  const watermark = document.createElement("div");
  watermark.id = "vendorhub-watermark";
  watermark.setAttribute("aria-hidden", "true");
  watermark.innerHTML = `
    <div class="vendorhub-watermark-card">
      <img src="${logoUrl}" alt="VendorHub" />
    </div>
  `;

  document.body.appendChild(watermark);
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-flex tap-target items-center rounded-2xl bg-primary px-6 font-semibold text-primary-foreground">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 tap-target rounded-2xl bg-primary px-6 font-semibold text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "theme-color", content: "#2E7D32" },
      { title: "VendorHub — Sales, Stock & Credit for Mama Mboga" },
      { name: "description", content: "VendorHub helps small-scale fresh produce vendors in Kenya track sales, stock, expenses, and customer credit — right from their phone." },
      { property: "og:title", content: "VendorHub" },
      { property: "og:description", content: "Sales, stock, and credit tracking built for Mama Mboga vendors in Kenya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    replaceLovableWatermark();

    const observer = new MutationObserver(() => {
      replaceLovableWatermark();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <Outlet />
          <Toaster position="top-center" />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
