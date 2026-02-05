import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Phone, MessageCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PageHero } from '@/components/layout/PageHero';
import heroContact from '@/assets/hero-contact.jpg';
import { supabase } from '@/integrations/supabase/client';
import { usePageSeo } from '@/hooks/usePageSeo';

import { ContactMessageForm } from '@/components/contact/ContactMessageForm';

const SETTINGS_KEY = 'contact_other_ways';

type ContactKey = "email" | "phone" | "whatsapp" | "location";

type ContactInfoItem = {
  key: ContactKey;
  icon: typeof Mail;
  title: string;
  detail: string;
  description: string;
  /** Only used when key === "whatsapp" */
  openingMessage?: string;
};

const defaultContactInfo: ContactInfoItem[] = [
  {
    key: "email",
    icon: Mail,
    title: "Email Us",
    detail: "hello@easymarketingassist.com",
    description: "We typically respond within 24 hours",
  },
  {
    key: "phone",
    icon: Phone,
    title: "Call Us",
    detail: "+1 (555) 123-4567",
    description: "Mon-Fri from 9am to 5pm EST",
  },
  {
    key: "whatsapp",
    icon: MessageCircle,
    title: "WhatsApp",
    detail: "+1 (555) 123-4567",
    description: "Quick responses for existing clients",
    openingMessage: "Hallo !!!",
  },
  {
    key: "location",
    icon: MapPin,
    title: "Location",
    detail: "Remote / Worldwide",
    description: "Available for global clients",
  },
];

const iconByKey = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  location: MapPin,
} as const;

function toWhatsAppPhone(input: string) {
  // WhatsApp phone param supports digits only (no +, spaces, (), -)
  return (input ?? "").replace(/\D/g, "");
}

function buildWhatsAppUrl(phone: string, message: string) {
  const normalized = toWhatsAppPhone(phone);
  if (!normalized) return null;
  const text = encodeURIComponent(message || "Hallo !!!");
  return `https://api.whatsapp.com/send?phone=${normalized}&text=${text}`;
}

function buildOutlookComposeUrl(email: string) {
  const to = (email ?? "").trim();
  if (!to) return null;
  return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}`;
}

function parseContactInfo(value: unknown): ContactInfoItem[] {
  if (!Array.isArray(value)) return defaultContactInfo;

  const normalized = value
    .map((raw) => {
      const obj = raw as any;
      const key = obj?.key as keyof typeof iconByKey | undefined;
      const Icon = key ? iconByKey[key] : undefined;
      if (!Icon || !key) return null;

      return {
        key,
        icon: Icon,
        title: typeof obj.title === "string" ? obj.title : "",
        detail: typeof obj.detail === "string" ? obj.detail : "",
        description: typeof obj.description === "string" ? obj.description : "",
        openingMessage: typeof obj.openingMessage === "string" ? obj.openingMessage : undefined,
      } satisfies ContactInfoItem;
    })
    .filter(Boolean) as ContactInfoItem[];

  // If malformed, fallback
  return normalized.length ? normalized : defaultContactInfo;
}


export default function Contact() {
  usePageSeo("contact", {
    title: "Contact | EasyMarketingAssist",
    description: "Have a question or ready to get started? Contact EasyMarketingAssist.",
  });

  const [contactInfo, setContactInfo] = useState<ContactInfoItem[]>(defaultContactInfo);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from('website_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (!error) setContactInfo(parseContactInfo(data?.value));
    })();
  }, []);


  return (
    <PublicLayout>
      {/* Hero */}
      <PageHero
        backgroundImage={heroContact}
        title={
          <>
            Let's <span className="text-primary">Connect</span>
          </>
        }
        subtitle={"Have a question or ready to get started? We'd love to hear from you."}
      />

      {/* Contact Form & Info */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Contact Form */}
            <ContactMessageForm source="contact_page" />


            {/* Contact Info */}
            <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Other Ways to Reach Us</h2>
                <p className="text-muted-foreground">
                  Choose the method that works best for you.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {contactInfo.map((info) => {
                  const href =
                    info.key === "email"
                      ? buildOutlookComposeUrl(info.detail)
                      : info.key === "whatsapp"
                        ? buildWhatsAppUrl(info.detail, info.openingMessage ?? "Hallo !!!")
                        : null;

                  const CardInner = (
                    <Card key={info.key} className="shadow-soft">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <info.icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-foreground">{info.title}</h3>
                            <p className="text-foreground break-words">{info.detail}</p>
                            <p className="text-sm text-muted-foreground break-words">{info.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );

                  return href ? (
                    <a
                      key={info.key}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                      aria-label={info.key === "email" ? `Email ke ${info.detail}` : `WhatsApp ke ${info.detail}`}
                    >
                      {CardInner}
                    </a>
                  ) : (
                    CardInner
                  );
                })}
              </div>

              {/* Existing Client CTA */}
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-foreground mb-2">Already a Client?</h3>
                  <p className="text-muted-foreground mb-4">
                    Login to access your dashboard and send messages directly to your assist.
                  </p>
                  <Button variant="outline" asChild>
                    <Link to="/auth">
                      Login to Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
