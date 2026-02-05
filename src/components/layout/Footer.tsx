import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { useWebsiteLayoutSettings } from "@/hooks/useWebsiteLayout";
import { useI18n } from "@/hooks/useI18n";

function translateFooterLinkLabel(label: string, href: string, t: (k: any) => string) {
  const byHref: Record<string, string> = {
    "/services": t("nav.services"),
    "/packages": t("nav.packages"),
    "/blog": t("nav.blog"),
    "/about": t("nav.about"),
    "/contact": t("nav.contact"),
    "/": t("nav.home"),
  };

  return byHref[href] ?? label;
}

export function Footer() {
  const { settings, loading, hasCache } = useWebsiteLayoutSettings();
  const { t } = useI18n();

  const showPlaceholder = loading && !hasCache;

  return (
    <footer className="bg-footer text-sidebar-foreground">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">{settings.header.brandMarkText}</span>
              </div>
              {showPlaceholder ? (
                <span className="inline-block h-5 w-32 rounded bg-sidebar-foreground/20 animate-pulse" />
              ) : (
                <span className="text-xl font-bold">{settings.header.brandName}</span>
              )}
            </Link>
            {showPlaceholder ? (
              <div className="h-10 w-64 rounded bg-sidebar-foreground/10 animate-pulse" />
            ) : (
              <p className="text-sm text-sidebar-foreground/70 max-w-xs">{settings.footer.tagline}</p>
            )}
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider">{settings.footer.quickLinksTitle}</h4>
            <ul className="space-y-2">
              {(settings.footer.quickLinks ?? []).map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-sm text-sidebar-foreground/70 hover:text-primary transition-colors">
                    {translateFooterLinkLabel(link.label, link.href, t)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider">{settings.footer.servicesTitle}</h4>
            <ul className="space-y-2">
              {(settings.footer.services ?? []).map((service) => (
                <li key={service}>
                  <span className="text-sm text-sidebar-foreground/70">{service}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider">{settings.footer.contactTitle}</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
                <Mail className="h-4 w-4 text-primary" />
                {settings.footer.contactEmail}
              </li>
              <li className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
                <Phone className="h-4 w-4 text-primary" />
                {settings.footer.contactPhone}
              </li>
              <li className="flex items-start gap-2 text-sm text-sidebar-foreground/70">
                <MapPin className="h-4 w-4 text-primary mt-0.5" />
                {settings.footer.contactAddress}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-sidebar-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-sidebar-foreground/60">© {new Date().getFullYear()} {settings.footer.copyrightText}</p>
            <div className="flex gap-6">
              <Link to={settings.footer.privacyHref} className="text-sm text-sidebar-foreground/60 hover:text-primary transition-colors">
                {t("footer.privacy")}
              </Link>
              <Link to={settings.footer.termsHref} className="text-sm text-sidebar-foreground/60 hover:text-primary transition-colors">
                {t("footer.terms")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
