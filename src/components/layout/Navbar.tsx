import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWebsiteLayoutSettings } from "@/hooks/useWebsiteLayout";
import { useI18n } from "@/hooks/useI18n";

function translateNavLabel(label: string, href: string, lang: "id" | "en", t: (k: any) => string) {
  // Prefer translating based on route, so admin settings can remain EN while UI switches.
  const byHref: Record<string, { id: string; en: string }> = {
    "/": { id: t("nav.home"), en: t("nav.home") },
    "/services": { id: t("nav.services"), en: t("nav.services") },
    "/packages": { id: t("nav.packages"), en: t("nav.packages") },
    "/blog": { id: t("nav.blog"), en: t("nav.blog") },
    "/about": { id: t("nav.about"), en: t("nav.about") },
    "/contact": { id: t("nav.contact"), en: t("nav.contact") },
  };

  if (byHref[href]) return lang === "id" ? byHref[href].id : byHref[href].en;

  // Fallback: translate well-known labels if they match defaults.
  const normalized = label.trim().toLowerCase();
  const byLabel: Record<string, string> = {
    home: t("nav.home"),
    services: t("nav.services"),
    packages: t("nav.packages"),
    blog: t("nav.blog"),
    "about us": t("nav.about"),
    contact: t("nav.contact"),
  };
  return byLabel[normalized] ?? label;
}

export function Navbar() {
  const { settings, loading, hasCache } = useWebsiteLayoutSettings();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { lang, setLang, t } = useI18n();

  const navLinks = useMemo(() => settings.header.navLinks ?? [], [settings.header.navLinks]);

  const primaryCtaLabel = useMemo(() => {
    const raw = settings.header.primaryCtaLabel;
    if (raw.trim().toLowerCase() === "get started") return t("nav.getStarted");
    return raw;
  }, [settings.header.primaryCtaLabel, t]);

  const secondaryCtaLabel = useMemo(() => {
    const raw = settings.header.secondaryCtaLabel;
    if (raw.trim().toLowerCase() === "login") return t("nav.login");
    return raw;
  }, [settings.header.secondaryCtaLabel, t]);

  const showPlaceholder = loading && !hasCache;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {showPlaceholder ? (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted animate-pulse" />
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            </>
          ) : settings.header.logoUrl ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted overflow-hidden">
              <img
                src={settings.header.logoUrl}
                alt={settings.header.logoAlt || settings.header.brandName}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">{settings.header.brandMarkText}</span>
            </div>
          )}
          {showPlaceholder ? null : (
            <span className="text-xl font-bold text-foreground">{settings.header.brandName}</span>
          )}
        </Link>

        {/* Desktop Navigation (show from lg so tablet still uses the mobile menu) */}
        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted",
                location.pathname === link.href ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {translateNavLabel(link.label, link.href, lang, t)}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLang(lang === "id" ? "en" : "id")}
            aria-label="Toggle language"
          >
            {lang === "id" ? t("lang.en") : t("lang.id")}
          </Button>
          <Button variant="ghost" asChild>
            <Link to={settings.header.secondaryCtaHref}>{secondaryCtaLabel}</Link>
          </Button>
          <Button asChild>
            <Link to={settings.header.primaryCtaHref}>{primaryCtaLabel}</Link>
          </Button>
        </div>

        {/* Mobile Menu Button (kept for tablet) */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-md lg:hidden hover:bg-muted"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation (used for phone + tablet) */}
      {isOpen && (
        <div className="border-t border-border bg-background lg:hidden animate-fade-in">
          <div className="container py-4 space-y-2">
            <div className="flex items-center justify-between gap-3 px-4">
              <p className="text-sm font-medium text-foreground">{settings.header.brandName}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLang(lang === "id" ? "en" : "id")}
                aria-label="Toggle language"
              >
                {lang === "id" ? t("lang.en") : t("lang.id")}
              </Button>
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "block px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  location.pathname === link.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {translateNavLabel(link.label, link.href, lang, t)}
              </Link>
            ))}
            <div className="pt-4 border-t border-border space-y-2">
              <Button variant="outline" className="w-full" asChild>
                <Link to={settings.header.secondaryCtaHref} onClick={() => setIsOpen(false)}>
                  {secondaryCtaLabel}
                </Link>
              </Button>
              <Button className="w-full" asChild>
                <Link to={settings.header.primaryCtaHref} onClick={() => setIsOpen(false)}>
                  {primaryCtaLabel}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
