export const RESOURCE_CATEGORY_META: Record<
  string,
  { label: string; description: string }
> = {
  brand_voice: {
    label: "Brand Voice",
    description:
      "Brand personality, tone guidelines, and messaging pillars",
  },
  product_features: {
    label: "Product Features",
    description:
      "Product capabilities, features, and integration points for natural mention in content",
  },
  visual_identity: {
    label: "Visual Identity",
    description:
      "Visual brand guidelines, color palettes, typography, and logo usage",
  },
  documentation: {
    label: "Documentation",
    description:
      "Technical documentation, API references, and product guides",
  },
  competitor_info: {
    label: "Competitor Info",
    description:
      "Competitor analysis, positioning, and differentiation points",
  },
  target_audience: {
    label: "Target Audience",
    description:
      "Audience personas, demographics, pain points, and buyer journey stages",
  },
  website: {
    label: "Website",
    description:
      "Website pages, landing pages, and site structure for reference",
  },
  target_keywords: {
    label: "Target Keywords",
    description:
      "Primary and secondary SEO keywords to target, with search intent and difficulty indicators",
  },
  seo_guidelines: {
    label: "SEO Guidelines",
    description:
      "SEO best practices, on-page optimization rules, and content structure requirements",
  },
  style_guide: {
    label: "Style Guide",
    description:
      "Writing style rules, formatting conventions, terminology, and tone specifications",
  },
  writing_examples: {
    label: "Writing Examples",
    description:
      "Sample content demonstrating the desired writing style and quality bar",
  },
  internal_links: {
    label: "Internal Links",
    description:
      "Internal link targets with URLs, anchor text variations, and contextual linking guidance",
  },
  other: {
    label: "Other",
    description: "Custom project resource",
  },
}

/** Resolve a category label with fallback for unknown categories */
export function getCategoryLabel(category: string): string {
  return RESOURCE_CATEGORY_META[category]?.label ?? category
}

/** Resolve a category description with fallback */
export function getCategoryDescription(category: string): string {
  return (
    RESOURCE_CATEGORY_META[category]?.description ?? "Custom project resource"
  )
}
