import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  backgroundImage: string;
  className?: string;
  children?: ReactNode;
};

/**
 * Page hero with background image.
 * Uses a dark (navy) overlay + slight blur to guarantee text readability.
 */
export function PageHero({ title, subtitle, backgroundImage, className, children }: Props) {
  return (
    <section className={cn("relative overflow-hidden py-16 md:py-24", className)}>
      <div className="absolute inset-0">
        <img
          src={backgroundImage}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover blur-sm scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-navy/75" />
      </div>

      <div className="relative container">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary-foreground">{title}</h1>
          {subtitle ? (
            <p className="mt-6 text-lg text-primary-foreground/80 max-w-2xl mx-auto">{subtitle}</p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
