import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { State, City } from "country-state-city";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { OrderLayout } from "@/components/order/OrderLayout";
import { OrderSummaryCard } from "@/components/order/OrderSummaryCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrder } from "@/contexts/OrderContext";
import { useI18n } from "@/hooks/useI18n";

const schema = z.object({
  name: z.string().trim().min(1, "Nama lengkap wajib diisi").max(100),
  email: z.string().trim().email("Email tidak valid").max(255),
  phone: z.string().trim().min(6, "Nomor Telp/WhatsApp wajib diisi").max(30, "Nomor Telp/WhatsApp terlalu panjang"),
  businessName: z.string().trim().max(120).optional().or(z.literal("")),
  provinceCode: z.string().trim().min(1, "Provinsi wajib dipilih").max(10),
  city: z.string().trim().min(1, "Kota/Kab wajib dipilih").max(120),
  acceptedTerms: z.boolean().refine((v) => v === true, { message: "Kamu harus setuju dengan syarat" }),
});

type FormValues = z.infer<typeof schema>;

export default function Details() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { state, setDetails } = useOrder();

  const provinces = useMemo(() => {
    const list = State.getStatesOfCountry("ID") || [];
    return [...list].sort((a, b) => String(a.name).localeCompare(String(b.name), "id"));
  }, []);

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: state.details.name,
      email: state.details.email,
      phone: state.details.phone,
      businessName: state.details.businessName ?? "",
      provinceCode: state.details.provinceCode ?? "",
      city: state.details.city ?? "",
      acceptedTerms: state.details.acceptedTerms,
    }),
    [state.details],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  return (
    <OrderLayout title={t("order.step.details")} step="details" sidebar={<OrderSummaryCard showEstPrice={false} />}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("order.contactInfo")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit((values) => {
                const provinceName = provinces.find((p) => p.isoCode === values.provinceCode)?.name ?? "";
                setDetails({ ...values, provinceName });
                navigate("/order/subscription");
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("order.name")}</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("order.email")}</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("order.phoneWhatsApp")}</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="tel" inputMode="tel" placeholder="08xxxxxxxxxx" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("order.businessNameOptional")}</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="organization" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="provinceCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("order.province")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          // reset city when province changes
                          form.setValue("city", "", { shouldValidate: true, shouldDirty: true });
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("order.selectProvince")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {provinces.map((p) => (
                            <SelectItem key={p.isoCode} value={p.isoCode}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => {
                    const provinceValue = form.watch("provinceCode");

                    // provinceCode is supposed to store State.isoCode, but older/saved values could be the province name.
                    // Normalize to a valid isoCode so City.getCitiesOfState always receives the expected stateCode.
                    const resolvedProvinceCode = (() => {
                      if (!provinceValue) return "";
                      const byIso = provinces.find((p) => p.isoCode === provinceValue);
                      if (byIso) return byIso.isoCode;
                      const byName = provinces.find(
                        (p) => String(p.name).toLowerCase() === String(provinceValue).toLowerCase(),
                      );
                      return byName?.isoCode ?? "";
                    })();

                    const cities = resolvedProvinceCode ? City.getCitiesOfState("ID", resolvedProvinceCode) || [] : [];
                    const cityItems = [...cities].sort((a, b) => String(a.name).localeCompare(String(b.name), "id"));

                    return (
                      <FormItem>
                        <FormLabel>{t("order.city")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={!resolvedProvinceCode}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("order.selectCity")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cityItems.map((c) => (
                              <SelectItem key={`${c.stateCode}-${c.name}`} value={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <FormField
                control={form.control}
                name="acceptedTerms"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-3 rounded-lg border p-4">
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                      <div className="space-y-1">
                        <FormLabel className="leading-none">{t("order.termsAgree")}</FormLabel>
                        <p className="text-sm text-muted-foreground">{t("order.updateLater")}</p>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/order/choose-design")}>
                  {t("common.back")}
                </Button>
                <Button type="submit" size="lg" disabled={!form.formState.isValid}>
                  {t("order.continueSubscription")}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </OrderLayout>
  );
}

