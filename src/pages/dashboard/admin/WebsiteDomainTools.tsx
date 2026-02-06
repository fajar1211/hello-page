import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCcw, Save, Trash2, Upload, X, Pencil } from "lucide-react";

type TemplateRow = {
  id: string;
  name: string;
  category: string;
  is_active?: boolean;
  sort_order?: number;
  // Thumbnail image URL
  preview_image_url?: string;
  // Demo URL (opens in a new tab)
  preview_url?: string;
};

const SETTINGS_TEMPLATES_KEY = "order_templates";
const SETTINGS_TEMPLATE_CATEGORIES_KEY = "order_template_categories";

function asNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isLikelyImageUrl(url: string): boolean {
  const u = (url ?? "").trim().toLowerCase();
  if (!u) return false;
  if (u.includes("/template-previews/")) return true;
  return /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(u);
}

export default function WebsiteDomainTools() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const [templateCategories, setTemplateCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [uploadingTemplate, setUploadingTemplate] = useState<Record<string, boolean>>({});

  const [templateQuery, setTemplateQuery] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>("all");
  const [templatePage, setTemplatePage] = useState(1);
  const TEMPLATE_PAGE_SIZE = 20;

  const [categoryQuery, setCategoryQuery] = useState("");
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; src?: string; title?: string }>({ open: false });

  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<string[]>([]);
  const [draftTemplateId, setDraftTemplateId] = useState<string | null>(null);

  const editingTemplate = useMemo(() => {
    if (!editTemplateId) return null;
    return templates.find((t) => t.id === editTemplateId) ?? null;
  }, [editTemplateId, templates]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const [{ data: tplRow }, { data: catsRow }] = await Promise.all([
        (supabase as any).from("website_settings").select("value").eq("key", SETTINGS_TEMPLATES_KEY).maybeSingle(),
        (supabase as any)
          .from("website_settings")
          .select("value")
          .eq("key", SETTINGS_TEMPLATE_CATEGORIES_KEY)
          .maybeSingle(),
      ]);

      const rawTemplates = Array.isArray(tplRow?.value) ? (tplRow.value as any[]) : [];
      // Backward-compat: `preview_url` used to store image URL.
      // Now: image -> `preview_image_url`, demo URL -> `preview_url`.
      const nextTemplates: TemplateRow[] = rawTemplates.map((t: any) => {
        const legacyPreview = String(t?.preview_url ?? "").trim();
        const explicitImg = String(t?.preview_image_url ?? "").trim();
        const preview_image_url = explicitImg || (isLikelyImageUrl(legacyPreview) ? legacyPreview : "");
        const preview_url = !isLikelyImageUrl(legacyPreview) ? legacyPreview : "";
        return {
          ...t,
          preview_image_url: preview_image_url || undefined,
          preview_url: preview_url || undefined,
        };
      });
      setTemplates(nextTemplates);
      const nextCategories = Array.isArray(catsRow?.value) ? (catsRow.value as any[]).map((v) => String(v ?? "").trim()).filter(Boolean) : [];
      setTemplateCategories(Array.from(new Set(nextCategories)).sort((a, b) => a.localeCompare(b)));
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Failed to load templates";
      if (String(msg).toLowerCase().includes("unauthorized")) {
        navigate("/admin/login", { replace: true });
        return;
      }
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of templates) {
      const c = String(t.category ?? "").trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    const fromDb = (templateCategories ?? []).map((name) => ({ name, count: counts.get(name) ?? 0 }));
    // include any categories used by templates but missing in DB
    const extras = Array.from(counts.entries())
      .filter(([name]) => !fromDb.some((c) => c.name === name))
      .map(([name, count]) => ({ name, count }));
    return [...fromDb, ...extras].sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, templateCategories]);

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categoryQuery]);

  useEffect(() => {
    // Default: all categories collapsed
    setExpandedCategoryKeys([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    return (templates ?? []).filter((t) => {
      const byQuery = !q ? true : String(t.name ?? "").toLowerCase().includes(q);
      const byCategory = templateCategoryFilter === "all" ? true : String(t.category ?? "").trim() === templateCategoryFilter;
      return byQuery && byCategory;
    });
  }, [templateCategoryFilter, templateQuery, templates]);

  const totalTemplatePages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTemplates.length / TEMPLATE_PAGE_SIZE));
  }, [filteredTemplates.length]);

  useEffect(() => {
    setTemplatePage(1);
  }, [templateQuery, templateCategoryFilter]);

  const pagedTemplates = useMemo(() => {
    const start = (templatePage - 1) * TEMPLATE_PAGE_SIZE;
    return filteredTemplates.slice(start, start + TEMPLATE_PAGE_SIZE);
  }, [filteredTemplates, templatePage]);

  const updateTemplate = (id: string, patch: Partial<TemplateRow>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const saveCategoriesOnly = async (nextCategories: string[]) => {
    try {
      const categoriesPayload = Array.from(
        new Set(
          (nextCategories ?? [])
            .map((c) => String(c ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b));

      const { error } = await (supabase as any)
        .from("website_settings")
        .upsert({ key: SETTINGS_TEMPLATE_CATEGORIES_KEY, value: categoriesPayload }, { onConflict: "key" });
      if (error) throw error;
    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Failed to save category",
        description: e?.message ?? "Unknown error",
      });
    }
  };

  const renameCategory = (from: string, to: string) => {
    const next = String(to ?? "").trim();
    if (!next) return;
    setTemplates((prev) => prev.map((t) => (String(t.category ?? "").trim() === from ? { ...t, category: next } : t)));
    setTemplateCategories((prev) => {
      const updated = prev.map((c) => (c === from ? next : c));
      const deduped = Array.from(new Set(updated.map((c) => String(c).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      void saveCategoriesOnly(deduped);
      return deduped;
    });
  };

  const deleteCategory = (name: string) => {
    const used = templates.some((t) => String(t.category ?? "").trim() === name);
    if (used) {
      toast({
        variant: "destructive",
        title: "Cannot delete category",
        description: "This category is still used by a template. Move templates to another category first, then try again.",
      });
      return;
    }
    setTemplateCategories((prev) => {
      const next = prev.filter((c) => c !== name);
      void saveCategoriesOnly(next);
      return next;
    });
    toast({ title: "Deleted", description: "Category deleted." });
  };

  const handleUploadImage = async (templateId: string, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Error", description: "File must be an image." });
      return;
    }

    setUploadingTemplate((prev) => ({ ...prev, [templateId]: true }));
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const filename = `${templateId}-${Date.now()}.${ext}`;
      const { data, error } = await (supabase as any).storage.from("template-previews").upload(filename, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      const { data: urlData } = (supabase as any).storage.from("template-previews").getPublicUrl(data.path);
      const publicUrl = urlData?.publicUrl ?? "";

      setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, preview_image_url: publicUrl } : t)));
      toast({ title: "Uploaded", description: "Image uploaded." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Upload failed", description: e?.message ?? "Unknown error" });
    } finally {
      setUploadingTemplate((prev) => ({ ...prev, [templateId]: false }));
    }
  };

  const handleRemoveImage = async (templateId: string, currentUrl: string) => {
    const url = String(currentUrl ?? "").trim();
    if (!url) return;

    setUploadingTemplate((prev) => ({ ...prev, [templateId]: true }));
    try {
      // Extract file path from public URL
      const match = url.match(/template-previews\/(.+)/);
      if (match?.[1]) {
        const { error } = await (supabase as any).storage.from("template-previews").remove([match[1]]);
        if (error) console.warn("Failed to delete file from storage:", error);
      }

      setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, preview_image_url: "" } : t)));
      toast({ title: "Removed", description: "Image removed." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Remove failed", description: e?.message ?? "Unknown error" });
    } finally {
      setUploadingTemplate((prev) => ({ ...prev, [templateId]: false }));
    }
  };

  const saveTemplates = async () => {
    setSaving(true);
    try {
      const payload = templates
        .map((t) => ({
          id: String(t.id ?? "").trim(),
          name: String(t.name ?? "").trim(),
          category: t.category,
          is_active: t.is_active !== false,
          sort_order: typeof t.sort_order === "number" ? t.sort_order : Number(t.sort_order ?? 0),
          preview_image_url: String((t as any)?.preview_image_url ?? "").trim() || undefined,
          preview_url: String((t as any)?.preview_url ?? "").trim() || undefined,
        }))
        .filter((t) => t.id && t.name);

      const { error } = await (supabase as any)
        .from("website_settings")
        .upsert({ key: SETTINGS_TEMPLATES_KEY, value: payload }, { onConflict: "key" });
      if (error) throw error;

      const categoriesPayload = Array.from(
        new Set(
          (templateCategories ?? [])
            .map((c) => String(c ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b));
      const { error: catErr } = await (supabase as any)
        .from("website_settings")
        .upsert({ key: SETTINGS_TEMPLATE_CATEGORIES_KEY, value: categoriesPayload }, { onConflict: "key" });
      if (catErr) throw catErr;

      toast({ title: "Saved", description: "Templates updated." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to save", description: e?.message ?? "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const persistTemplates = async (nextTemplates: TemplateRow[]) => {
    setSaving(true);
    try {
      const payload = (nextTemplates ?? [])
        .map((t) => ({
          id: String(t.id ?? "").trim(),
          name: String(t.name ?? "").trim(),
          category: t.category,
          is_active: t.is_active !== false,
          sort_order: typeof t.sort_order === "number" ? t.sort_order : Number(t.sort_order ?? 0),
          preview_image_url: String((t as any)?.preview_image_url ?? "").trim() || undefined,
          preview_url: String((t as any)?.preview_url ?? "").trim() || undefined,
        }))
        .filter((t) => t.id && t.name);

      const { error } = await (supabase as any)
        .from("website_settings")
        .upsert({ key: SETTINGS_TEMPLATES_KEY, value: payload }, { onConflict: "key" });
      if (error) throw error;

      toast({ title: "Saved", description: "Template list updated." });
      await fetchTemplates();
      return true;
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to save", description: e?.message ?? "Unknown error" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const templateCountLabel = useMemo(() => String(templates.length), [templates.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-foreground">Templates (Order)</h1>
          <p className="text-muted-foreground">Manage templates shown on /order/choose-design.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={fetchTemplates} disabled={loading || saving}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="category">Category</TabsTrigger>
          </TabsList>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Order Templates</CardTitle>
                  <CardDescription>Templates shown on /order/choose-design.</CardDescription>
                </div>
                <Badge variant="outline">Total: {templateCountLabel}</Badge>
              </div>

              <div className="grid gap-2 md:grid-cols-6">
                <div className="md:col-span-4">
                  <Label className="text-xs">Search template</Label>
                  <Input value={templateQuery} onChange={(e) => setTemplateQuery(e.target.value)} placeholder="Search template name..." />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Filter category</Label>
                  <Select value={templateCategoryFilter} onValueChange={setTemplateCategoryFilter}>
                    <SelectTrigger disabled={saving}>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {(categories.length ? categories : [{ name: "business", count: 0 }]).map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Showing {filteredTemplates.length} templates • Page {templatePage} / {totalTemplatePages}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const id = `t${Date.now()}`;
                      setTemplates((prev) => {
                        const baseCategory =
                          templateCategoryFilter !== "all" && templateCategoryFilter
                            ? (templateCategoryFilter as any)
                            : ((categories[0]?.name ?? "business") as any);

                        const maxSortInCategory = prev
                          .filter((t) => String(t.category ?? "").trim() === String(baseCategory ?? "").trim())
                          .reduce((max, t) => Math.max(max, Number(t.sort_order ?? 0)), 0);

                        return [
                          ...prev,
                          {
                            id,
                            name: "New Template",
                            category: baseCategory,
                            is_active: true,
                            sort_order: maxSortInCategory + 1,
                          },
                        ];
                      });
                      setDraftTemplateId(id);
                      setEditTemplateId(id);
                    }}
                    disabled={saving}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTemplatePage((p) => Math.max(1, p - 1))}
                    disabled={templatePage <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTemplatePage((p) => Math.min(totalTemplatePages, p + 1))}
                    disabled={templatePage >= totalTemplatePages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}

              {/* Templates table */}
              <div className="space-y-3">
                  {!loading && pagedTemplates.length ? (
                    <div className="rounded-md border bg-muted/20">
                      <div className="max-h-[70vh] overflow-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                              <TableHead className="w-[84px]">Preview</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="w-[180px] hidden lg:table-cell">Demo</TableHead>
                              <TableHead className="w-[220px] hidden md:table-cell">Category</TableHead>
                              <TableHead className="w-[120px] hidden md:table-cell">Sort</TableHead>
                              <TableHead className="w-[160px] hidden sm:table-cell">Status</TableHead>
                              <TableHead className="w-[210px] text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pagedTemplates.map((t) => {
                              const previewSrc = String((t as any)?.preview_image_url ?? "").trim();
                              const demoUrl = String((t as any)?.preview_url ?? "").trim();

                              return (
                                <TableRow key={t.id}>
                                  <TableCell>
                                    {previewSrc ? (
                                      <button
                                        type="button"
                                        className="block"
                                        onClick={() => setPreviewDialog({ open: true, src: previewSrc, title: t.name })}
                                        title="Click to preview"
                                      >
                                        <img
                                          src={previewSrc}
                                          alt={`Preview ${t.name}`}
                                          className="h-12 w-16 rounded border object-cover"
                                          loading="lazy"
                                        />
                                      </button>
                                    ) : (
                                      <div className="h-12 w-16 rounded border bg-background" />
                                    )}
                                  </TableCell>

                                  <TableCell>
                                    <div className="min-w-0">
                                      <div className="font-medium text-foreground truncate">{t.name}</div>
                                      <div className="text-xs text-muted-foreground truncate md:hidden">
                                        {String(t.category ?? "").trim() || "-"}
                                      </div>
                                    </div>
                                  </TableCell>

                                  <TableCell className="hidden lg:table-cell">
                                    {demoUrl ? (
                                      <Button type="button" variant="outline" size="sm" asChild>
                                        <a href={demoUrl} target="_blank" rel="noopener noreferrer" title={demoUrl}>
                                          Preview
                                        </a>
                                      </Button>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    )}
                                  </TableCell>

                                  <TableCell className="hidden md:table-cell">
                                    <span className="text-sm text-foreground">{String(t.category ?? "").trim() || "-"}</span>
                                  </TableCell>

                                  <TableCell className="hidden md:table-cell">
                                    <span className="text-sm text-foreground">{String(t.sort_order ?? 0)}</span>
                                  </TableCell>

                                  <TableCell className="hidden sm:table-cell">
                                    <Badge variant={t.is_active === false ? "secondary" : "default"}>
                                      {t.is_active === false ? "Off" : "On"}
                                    </Badge>
                                  </TableCell>

                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setEditTemplateId(t.id)}
                                        disabled={saving}
                                        aria-label="Edit template"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>

                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setDeleteTemplateId(t.id)}
                                        disabled={saving}
                                        aria-label="Delete template"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : !loading ? (
                    <div className="text-sm text-muted-foreground">No templates yet. Click “Add Template”.</div>
                  ) : null}

                  {/* Saved via the Add/Edit dialog */}
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category">
          <Card>
            <CardHeader>
              <CardTitle>Template Categories</CardTitle>
              <CardDescription>Manage category list for Templates (Order).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Template Categories</p>
                    <p className="text-xs text-muted-foreground">Add, rename, and delete categories.</p>
                  </div>
                  <Badge variant="outline">{categories.length}</Badge>
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <Label className="text-xs">Search categories</Label>
                    <Input
                      value={categoryQuery}
                      onChange={(e) => setCategoryQuery(e.target.value)}
                      placeholder="Search categories..."
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">New category</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="e.g. ecommerce"
                        disabled={saving}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const next = newCategory.trim();
                          if (!next) return;
                          const exists = (templateCategories ?? []).some((c) => c === next);
                          if (exists) {
                            toast({ variant: "destructive", title: "Category already exists", description: "Please use a different name." });
                            return;
                          }
                          setTemplateCategories((prev) => {
                            const deduped = Array.from(new Set([...prev, next])).sort((a, b) => a.localeCompare(b));
                            void saveCategoriesOnly(deduped);
                            return deduped;
                          });
                          setNewCategory("");
                        }}
                        disabled={saving}
                        aria-label="Add Category"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[520px] pr-2">
                    <Accordion
                      type="multiple"
                      value={expandedCategoryKeys}
                      onValueChange={(v) => setExpandedCategoryKeys(v as string[])}
                      className="space-y-2"
                    >
                      {(filteredCategories.length ? filteredCategories : []).map((c) => (
                        <AccordionItem key={c.name} value={c.name} className="rounded-md border bg-background px-2">
                          <div className="flex items-center justify-between gap-2">
                            <AccordionTrigger className="flex-1 py-2 hover:no-underline">
                              <div className="min-w-0 text-left">
                                <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                                <div className="text-xs text-muted-foreground">Used: {c.count}</div>
                              </div>
                            </AccordionTrigger>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteCategory(c.name);
                              }}
                              disabled={saving}
                              aria-label="Delete category"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <AccordionContent className="pb-2">
                            <div className="mt-2">
                              <Label className="text-xs">Rename</Label>
                              <Input
                                defaultValue={c.name}
                                onBlur={(e) => {
                                  const next = e.target.value.trim();
                                  if (!next || next === c.name) return;
                                  renameCategory(c.name, next);
                                }}
                                disabled={saving}
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewDialog.title || "Preview"}</DialogTitle>
          </DialogHeader>
          {previewDialog.src ? (
            <img
              src={previewDialog.src}
              alt={previewDialog.title ? `Preview ${previewDialog.title}` : "Preview"}
              className="w-full rounded-md border object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit template dialog */}
      <Dialog
        open={!!editTemplateId}
        onOpenChange={(open) => {
          if (open) return;
          // If this was a newly-added draft and user closes without saving, remove it.
          setTemplates((prev) => (draftTemplateId ? prev.filter((t) => t.id !== draftTemplateId) : prev));
          setDraftTemplateId(null);
          setEditTemplateId(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{draftTemplateId ? "Add Template" : "Edit Template"}</DialogTitle>
          </DialogHeader>

          {editingTemplate ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input
                  value={editingTemplate.name}
                  onChange={(e) => updateTemplate(editingTemplate.id, { name: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">Demo URL</Label>
                <Input
                  value={String((editingTemplate as any)?.preview_url ?? "")}
                  onChange={(e) => updateTemplate(editingTemplate.id, { preview_url: e.target.value } as any)}
                  placeholder="https://demo..."
                  disabled={saving}
                />
              </div>

              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={String(editingTemplate.category ?? "").trim() || (categories[0]?.name ?? "business")}
                  onValueChange={(v) => updateTemplate(editingTemplate.id, { category: v as any })}
                >
                  <SelectTrigger disabled={saving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.length ? categories : [{ name: "business", count: 0 }]).map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Sort Order</Label>
                <Input
                  value={String(editingTemplate.sort_order ?? 0)}
                  onChange={(e) => updateTemplate(editingTemplate.id, { sort_order: asNumber(e.target.value, 0) })}
                  inputMode="numeric"
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">Status</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={editingTemplate.is_active === false ? "secondary" : "default"}>
                    {editingTemplate.is_active === false ? "Off" : "On"}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateTemplate(editingTemplate.id, { is_active: editingTemplate.is_active === false })}
                    disabled={saving}
                  >
                    Toggle
                  </Button>
                </div>
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">Preview Image</Label>
                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    {String((editingTemplate as any)?.preview_image_url ?? "").trim() ? (
                      <button
                        type="button"
                        className="block"
                        onClick={() =>
                          setPreviewDialog({
                            open: true,
                            src: String((editingTemplate as any)?.preview_image_url ?? "").trim(),
                            title: editingTemplate.name,
                          })
                        }
                      >
                        <img
                          src={String((editingTemplate as any)?.preview_image_url ?? "").trim()}
                          alt={`Preview ${editingTemplate.name}`}
                          className="h-16 w-24 rounded border object-cover"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="h-16 w-24 rounded border bg-background" />
                    )}
                    <div className="text-xs text-muted-foreground">Bucket: template-previews</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImage(editingTemplate.id, e.target.files?.[0] ?? null)}
                        disabled={saving || uploadingTemplate[editingTemplate.id]}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={saving || uploadingTemplate[editingTemplate.id]} asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingTemplate[editingTemplate.id] ? "Uploading..." : "Upload"}
                        </span>
                      </Button>
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveImage(editingTemplate.id, String((editingTemplate as any)?.preview_image_url ?? ""))}
                      disabled={saving || uploadingTemplate[editingTemplate.id] || !String((editingTemplate as any)?.preview_image_url ?? "").trim()}
                    >
                      <X className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTemplates((prev) => (draftTemplateId ? prev.filter((t) => t.id !== draftTemplateId) : prev));
                    setDraftTemplateId(null);
                    setEditTemplateId(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={async () => {
                    if (!editingTemplate) return;
                    const ok = await persistTemplates(templates);
                    if (!ok) return;
                    setDraftTemplateId(null);
                    setEditTemplateId(null);
                  }}
                  disabled={saving || !String(editingTemplate.name ?? "").trim()}
                >
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Template not found.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => (!open ? setDeleteTemplateId(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This template will be removed from the list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTemplateId(null)}>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = deleteTemplateId;
                if (!id) return;
                const next = templates.filter((t) => t.id !== id);
                const ok = await persistTemplates(next);
                if (ok) setDeleteTemplateId(null);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
