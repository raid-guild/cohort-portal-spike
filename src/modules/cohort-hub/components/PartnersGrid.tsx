import type { PartnerCard } from "@/modules/cohort-hub/landing-types";

export function PartnersGrid({ partners }: { partners: PartnerCard[] }) {
  if (!partners.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Partners coming soon.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {partners.map((partner) => (
        <article
          key={partner.id}
          className="rounded-xl border border-border bg-card p-4 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <div className="flex items-start gap-3">
            {partner.logoUrl ? (
              <div className="flex h-12 w-24 items-center justify-center rounded border border-border bg-muted/40 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={partner.logoUrl}
                  alt={`${partner.name} logo`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}
            <div>
              <p className="font-semibold">{partner.name}</p>
              {partner.description ? <p className="text-sm text-muted-foreground">{partner.description}</p> : null}
            </div>
          </div>
          {partner.websiteUrl ? (
            <a
              href={partner.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm underline-offset-4 hover:underline"
            >
              Visit website
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}
