import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { WebsiteMediaPickerDialog } from "@/components/media/WebsiteMediaPickerDialog";
import { useToast } from "@/hooks/use-toast";

import {
  defaultWebsiteLayoutSettings,
  sanitizeWebsiteLayoutSettings,
  type FooterLinkItem,
  type NavLinkItem,
  type WebsiteLayoutSettings,
} from "./website-layout/types";

const SETTINGS_KEY = "website_layout";
const LAYOUT_CACHE_KEY = "ema.website_layout_cache.v1";

function writeLayoutCache(value: WebsiteLayoutSettings) {
  try {
    localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export default function WebsiteLayout() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [logoPickerOpen, setLogoPickerOpen] = useState(false);

  const [settings, setSettings] = useState<WebsiteLayoutSettings>(defaultWebsiteLayoutSettings);
  const [baseline, setBaseline] = useState<WebsiteLayoutSettings>(defaultWebsiteLayoutSettings);

  const canSave = isEditing && !loading && !saving;

  const hasChanges = useMemo(() => {
    try {
      return JSON.stringify(settings) !== JSON.stringify(baseline);
    } catch {
      return true;
    }
  }, [baseline, settings]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("website_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        console.error("Failed to load website layout settings", error);
        setSettings(defaultWebsiteLayoutSettings);
        setBaseline(defaultWebsiteLayoutSettings);
      } else {
        const normalized = sanitizeWebsiteLayoutSettings(data?.value);
        setSettings(normalized);
        setBaseline(normalized);
        writeLayoutCache(normalized);
      }
      setLoading(false);
    })();
  }, []);

  const saveNow = async (nextSettings: WebsiteLayoutSettings) => {
    setSaving(true);
    const payload = { key: SETTINGS_KEY, value: nextSettings };

    const { error } = await (supabase as any)
      .from("website_settings")
      .upsert(payload, { onConflict: "key" });

    if (error) {
      toast({ variant: "destructive", title: "Failed to save", description: error.message });
      setSaving(false);
      return false;
    }

    // Update cache immediately so public pages don't flash old defaults on next navigation.
    writeLayoutCache(nextSettings);

    setLastSavedAt(new Date());
    setSaving(false);
    return true;
  };

  const cancelEdit = () => {
    setSettings(baseline);
    setIsEditing(false);
  };

  const finishEdit = async () => {
    const ok = await saveNow(settings);
    if (!ok) return;

    setBaseline(settings);
    setIsEditing(false);
  };

  const updateHeader = (patch: Partial<WebsiteLayoutSettings["header"]>) => {
    setSettings((prev) => ({ ...prev, header: { ...prev.header, ...patch } }));
  };

  const updateFooter = (patch: Partial<WebsiteLayoutSettings["footer"]>) => {
    setSettings((prev) => ({ ...prev, footer: { ...prev.footer, ...patch } }));
  };

  const updateHeaderLink = (index: number, patch: Partial<NavLinkItem>) => {
    setSettings((prev) => {
      const next = [...prev.header.navLinks];
      next[index] = { ...next[index], ...patch };
      return { ...prev, header: { ...prev.header, navLinks: next } };
    });
  };

  const addHeaderLink = () => {
    setSettings((prev) => ({
      ...prev,
      header: { ...prev.header, navLinks: [...prev.header.navLinks, { href: "/", label: "New Link" }] },
    }));
  };

  const removeHeaderLink = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      header: { ...prev.header, navLinks: prev.header.navLinks.filter((_, i) => i !== index) },
    }));
  };

  const updateFooterQuickLink = (index: number, patch: Partial<FooterLinkItem>) => {
    setSettings((prev) => {
      const next = [...prev.footer.quickLinks];
      next[index] = { ...next[index], ...patch };
      return { ...prev, footer: { ...prev.footer, quickLinks: next } };
    });
  };

  const addFooterQuickLink = () => {
    setSettings((prev) => ({
      ...prev,
      footer: { ...prev.footer, quickLinks: [...prev.footer.quickLinks, { href: "/", label: "New Link" }] },
    }));
  };

  const removeFooterQuickLink = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      footer: { ...prev.footer, quickLinks: prev.footer.quickLinks.filter((_, i) => i !== index) },
    }));
  };

  const servicesTextarea = useMemo(() => (settings.footer.services ?? []).join("\n"), [settings.footer.services]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Website Layout</h1>
          <p className="text-sm text-muted-foreground">Edit the public site header and footer.</p>
          <div className="mt-2 text-xs text-muted-foreground">
            {loading ? (
              "Loading..."
            ) : saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
              </span>
            ) : lastSavedAt ? (
              <>Saved at {lastSavedAt.toLocaleTimeString()}</>
            ) : (
              "Click Done to save changes."
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={finishEdit} disabled={saving}>
                <Save className="h-4 w-4 mr-2" /> Done
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} disabled={loading}>
              Edit
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
          <CardDescription>Brand + navigation menu + CTA.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Brand Name</Label>
            <Input value={settings.header.brandName} onChange={(e) => updateHeader({ brandName: e.target.value })} disabled={!canSave} />
          </div>
          <div className="grid gap-2">
            <Label>Logo</Label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-12 w-12 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                {settings.header.logoUrl ? (
                  <img
                    src={settings.header.logoUrl}
                    alt={settings.header.logoAlt ?? settings.header.brandName}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">No logo</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setLogoPickerOpen(true)} disabled={!canSave}>
                    Choose / Upload Logo
                  </Button>
                {settings.header.logoUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => updateHeader({ logoUrl: null })}
                    disabled={!canSave}
                  >
                    Remove Logo
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This logo appears in the site navbar (homepage and public pages).</p>
          </div>

          <WebsiteMediaPickerDialog
            open={logoPickerOpen}
            onOpenChange={setLogoPickerOpen}
            title="Choose Logo"
            accept="image/*"
            onPick={(pick) => {
              updateHeader({ logoUrl: pick.url, logoAlt: pick.name ?? settings.header.brandName });
            }}
          />

          <div className="grid gap-2">
            <Label>Brand Mark (fallback 1–2 letters)</Label>
            <Input
              value={settings.header.brandMarkText}
              onChange={(e) => updateHeader({ brandMarkText: e.target.value })}
              disabled={!canSave}
              placeholder="E"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Nav Links</div>
              <div className="text-xs text-muted-foreground">Order here = order shown in the header.</div>
            </div>
            <Button type="button" onClick={addHeaderLink} disabled={!canSave}>
              <Plus className="h-4 w-4" /> Add Link
            </Button>
          </div>

          <div className="space-y-3">
            {settings.header.navLinks.map((l, idx) => (
              <div key={`${l.href}-${idx}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="grid gap-2">
                  <Label>Label</Label>
                  <Input value={l.label} onChange={(e) => updateHeaderLink(idx, { label: e.target.value })} disabled={!canSave} />
                </div>
                <div className="grid gap-2">
                  <Label>Href</Label>
                  <Input value={l.href} onChange={(e) => updateHeaderLink(idx, { href: e.target.value })} disabled={!canSave} />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeHeaderLink(idx)}
                    disabled={!canSave}
                    aria-label="Remove link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Secondary CTA Label</Label>
              <Input
                value={settings.header.secondaryCtaLabel}
                onChange={(e) => updateHeader({ secondaryCtaLabel: e.target.value })}
                disabled={!canSave}
              />
            </div>
            <div className="grid gap-2">
              <Label>Secondary CTA Href</Label>
              <Input
                value={settings.header.secondaryCtaHref}
                onChange={(e) => updateHeader({ secondaryCtaHref: e.target.value })}
                disabled={!canSave}
              />
            </div>
            <div className="grid gap-2">
              <Label>Primary CTA Label</Label>
              <Input
                value={settings.header.primaryCtaLabel}
                onChange={(e) => updateHeader({ primaryCtaLabel: e.target.value })}
                disabled={!canSave}
              />
            </div>
            <div className="grid gap-2">
              <Label>Primary CTA Href</Label>
              <Input
                value={settings.header.primaryCtaHref}
                onChange={(e) => updateHeader({ primaryCtaHref: e.target.value })}
                disabled={!canSave}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Footer</CardTitle>
          <CardDescription>Tagline, links, services list, and contact details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Tagline</Label>
            <Textarea value={settings.footer.tagline} onChange={(e) => updateFooter({ tagline: e.target.value })} disabled={!canSave} rows={3} />
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Quick Links Title</Label>
              <Input
                value={settings.footer.quickLinksTitle}
                onChange={(e) => updateFooter({ quickLinksTitle: e.target.value })}
                disabled={!canSave}
              />
            </div>
            <div className="flex items-end md:justify-end">
              <Button type="button" onClick={addFooterQuickLink} disabled={!canSave}>
                <Plus className="h-4 w-4" /> Add Quick Link
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {settings.footer.quickLinks.map((l, idx) => (
              <div key={`${l.href}-${idx}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="grid gap-2">
                  <Label>Label</Label>
                  <Input value={l.label} onChange={(e) => updateFooterQuickLink(idx, { label: e.target.value })} disabled={!canSave} />
                </div>
                <div className="grid gap-2">
                  <Label>Href</Label>
                  <Input value={l.href} onChange={(e) => updateFooterQuickLink(idx, { href: e.target.value })} disabled={!canSave} />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeFooterQuickLink(idx)}
                    disabled={!canSave}
                    aria-label="Remove quick link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label>Services Title</Label>
            <Input value={settings.footer.servicesTitle} onChange={(e) => updateFooter({ servicesTitle: e.target.value })} disabled={!canSave} />
          </div>
          <div className="grid gap-2">
            <Label>Services (one per line)</Label>
            <Textarea
              value={servicesTextarea}
              onChange={(e) => updateFooter({ services: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
              disabled={!canSave}
              rows={5}
            />
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Contact Title</Label>
              <Input value={settings.footer.contactTitle} onChange={(e) => updateFooter({ contactTitle: e.target.value })} disabled={!canSave} />
            </div>
            <div className="grid gap-2">
              <Label>Contact Email</Label>
              <Input value={settings.footer.contactEmail} onChange={(e) => updateFooter({ contactEmail: e.target.value })} disabled={!canSave} />
            </div>
            <div className="grid gap-2">
              <Label>Contact Phone</Label>
              <Input value={settings.footer.contactPhone} onChange={(e) => updateFooter({ contactPhone: e.target.value })} disabled={!canSave} />
            </div>
            <div className="grid gap-2">
              <Label>Contact Address</Label>
              <Input value={settings.footer.contactAddress} onChange={(e) => updateFooter({ contactAddress: e.target.value })} disabled={!canSave} />
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Privacy Href</Label>
              <Input value={settings.footer.privacyHref} onChange={(e) => updateFooter({ privacyHref: e.target.value })} disabled={!canSave} />
            </div>
            <div className="grid gap-2">
              <Label>Terms Href</Label>
              <Input value={settings.footer.termsHref} onChange={(e) => updateFooter({ termsHref: e.target.value })} disabled={!canSave} />
            </div>
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label>Copyright Text (after the year)</Label>
            <Input
              value={settings.footer.copyrightText}
              onChange={(e) => updateFooter({ copyrightText: e.target.value })}
              disabled={!canSave}
            />
          </div>

          {isEditing && !loading && (
            <div className="text-xs text-muted-foreground">
              {hasChanges ? "Changes not saved." : "No changes."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
