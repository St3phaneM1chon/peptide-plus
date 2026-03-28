import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getModuleBySlug,
  getModuleSlugs,
} from '@/lib/marketing/module-data';
import {
  FeatureHero,
  StatsBar,
  BentoGrid,
  IntegrationFlow,
  PricingCTA,
} from '@/components/marketing';

/* -------------------------------------------------------------------------- */
/*  Static params — pre-render all 11 module pages at build time              */
/* -------------------------------------------------------------------------- */

export function generateStaticParams() {
  return getModuleSlugs().map((slug) => ({ module: slug }));
}

/* -------------------------------------------------------------------------- */
/*  Dynamic metadata per module                                               */
/* -------------------------------------------------------------------------- */

interface PageProps {
  params: Promise<{ module: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { module: slug } = await params;
  const mod = getModuleBySlug(slug);
  if (!mod) return {};

  return {
    title: `${mod.name} — Suite Koraline | Attitudes VIP`,
    description: mod.description,
    openGraph: {
      title: `${mod.name} — Suite Koraline`,
      description: mod.tagline,
      url: `https://attitudes.vip/platform/features/${mod.slug}`,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function ModuleFeaturePage({ params }: PageProps) {
  const { module: slug } = await params;
  const mod = getModuleBySlug(slug);

  if (!mod) {
    notFound();
  }

  return (
    <div>
      {/* 1. Hero */}
      <FeatureHero
        icon={mod.icon}
        name={mod.name}
        tagline={mod.tagline}
        description={mod.description}
        gradient={mod.gradient}
        includedIn={mod.includedIn}
        ctaPrimary={{ label: 'Voir les tarifs', href: '/pricing' }}
        ctaSecondary={{ label: 'Toutes les fonctionnalites', href: '/platform/features' }}
      />

      {/* 2. Stats */}
      <StatsBar stats={mod.stats} gradient={mod.gradient} />

      {/* 3. Features bento grid */}
      <BentoGrid
        title={`Fonctionnalites ${mod.name}`}
        subtitle={`Tout ce que ${mod.name} met a votre disposition, nativement integre dans Koraline.`}
        features={mod.features}
      />

      {/* 4. Integration diagram */}
      {mod.integrations.length > 0 && (
        <IntegrationFlow
          currentSlug={mod.slug}
          integrations={mod.integrations}
        />
      )}

      {/* 5. Pricing CTA */}
      <PricingCTA
        moduleName={mod.name}
        addonPrice={mod.addonPrice}
        includedIn={mod.includedIn}
        gradient={mod.gradient}
      />
    </div>
  );
}
