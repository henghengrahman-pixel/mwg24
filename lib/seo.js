function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value = "", max = 160) {
  const clean = stripHtml(value);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "").trim() + "...";
}

function absoluteUrl(baseUrl = "", input = "") {
  const safeBase = String(baseUrl || "").replace(/\/+$/, "");
  const safeInput = String(input || "").trim();

  if (!safeInput) return safeBase;
  if (/^https?:\/\//i.test(safeInput)) return safeInput;
  if (!safeBase) return safeInput.startsWith("/") ? safeInput : `/${safeInput}`;

  return `${safeBase}${safeInput.startsWith("/") ? safeInput : `/${safeInput}`}`;
}

function normalizeCanonical(baseUrl = "", canonicalOrPath = "") {
  const url = absoluteUrl(baseUrl, canonicalOrPath || "/");
  return url.replace(/([^:]\/)\/+/g, "$1").replace(/\/$/, "") || baseUrl;
}

function dedupeKeywords(keywords = []) {
  const seen = new Set();
  const result = [];

  for (const item of keywords) {
    const clean = String(item || "").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }

  return result;
}

function keywordsToString(keywords) {
  if (Array.isArray(keywords)) {
    return dedupeKeywords(keywords).join(", ");
  }
  return String(keywords || "").trim();
}

function siteSeoDefaults() {
  return {
    siteName: "Wisata Berastagi",
    siteTagline: "Panduan wisata Berastagi terlengkap",
    siteUrl: "https://wisataberastagi.com",
    locale: "id_ID",
    language: "id-ID",

    defaultTitle:
      "Wisata Berastagi Terlengkap – Tempat Wisata, Villa, Hotel, Kuliner & Panduan Liburan",

    defaultDescription:
      "Panduan wisata Berastagi terlengkap untuk menemukan tempat wisata populer, villa dan hotel terbaik, kuliner khas Karo, berita terbaru, serta tips liburan ke Berastagi Kabupaten Karo Sumatera Utara.",

    defaultKeywords: [
      "wisata berastagi",
      "tempat wisata berastagi",
      "villa berastagi",
      "hotel berastagi",
      "kuliner berastagi",
      "liburan berastagi",
      "wisata karo",
      "tempat wisata karo",
      "penginapan berastagi",
      "berita berastagi",
      "wisata sumatera utara",
      "kabupaten karo"
    ],

    defaultImage: "/images/wisata-berastagi-cover.jpg",
    twitterCard: "summary_large_image"
  };
}

function buildSeo({
  title,
  description,
  image,
  canonical,
  keywords,
  type = "website",
  noindex = false,
  jsonLd = null,
  section = "",
  tags = [],
  publishedTime = "",
  modifiedTime = "",
  locale,
  language,
  siteName
} = {}) {
  const defaults = siteSeoDefaults();

  const finalTitle = truncate(title || defaults.defaultTitle, 70);
  const finalDescription = truncate(description || defaults.defaultDescription, 160);
  const finalKeywords = keywordsToString(keywords || defaults.defaultKeywords);
  const finalCanonical = normalizeCanonical(defaults.siteUrl, canonical || "/");
  const finalImage = absoluteUrl(defaults.siteUrl, image || defaults.defaultImage);

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords,
    image: finalImage,
    canonical: finalCanonical,
    type,
    noindex: Boolean(noindex),
    jsonLd,
    section: section || "",
    tags: Array.isArray(tags) ? tags : [],
    publishedTime: publishedTime || "",
    modifiedTime: modifiedTime || "",
    locale: locale || defaults.locale,
    language: language || defaults.language,
    siteName: siteName || defaults.siteName,
    twitterCard: defaults.twitterCard
  };
}

function buildTitle(primary, fallbackSuffix = "Wisata Berastagi") {
  const cleanPrimary = stripHtml(primary || "");
  if (!cleanPrimary) return fallbackSuffix;
  if (cleanPrimary.toLowerCase().includes("wisata berastagi")) return cleanPrimary;
  return `${cleanPrimary} | ${fallbackSuffix}`;
}

function buildDescription(text, fallback) {
  return truncate(text || fallback || siteSeoDefaults().defaultDescription, 160);
}

function websiteSchema(baseUrl, settings = {}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const siteName = settings.site_name || defaults.siteName;
  const description =
    settings.homepage_meta_description || defaults.defaultDescription;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${safeBase}/#website`,
    name: siteName,
    alternateName: "Portal Wisata Berastagi",
    url: `${safeBase}/`,
    description,
    inLanguage: defaults.language,
    potentialAction: {
      "@type": "SearchAction",
      target: `${safeBase}/cari?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

function organizationSchema(baseUrl, settings = {}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const siteName = settings.site_name || defaults.siteName;
  const logo = absoluteUrl(
    safeBase,
    settings.logo || defaults.defaultImage
  );

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${safeBase}/#organization`,
    name: siteName,
    url: `${safeBase}/`,
    logo: {
      "@type": "ImageObject",
      url: logo
    },
    image: logo
  };
}

function localBusinessSchema(baseUrl, settings = {}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const siteName = settings.site_name || defaults.siteName;

  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": `${safeBase}/#localbusiness`,
    name: siteName,
    alternateName: "WisataBerastagi.com",
    url: `${safeBase}/`,
    description:
      "Website panduan wisata Berastagi yang membahas tempat wisata, villa dan hotel, kuliner khas Karo, berita, serta tips liburan di Berastagi Sumatera Utara.",
    image: absoluteUrl(safeBase, settings.hero_background || defaults.defaultImage),
    telephone: settings.contact_phone || "",
    email: settings.contact_email || "",
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address || "",
      addressLocality: "Berastagi",
      addressRegion: "Sumatera Utara",
      postalCode: settings.postal_code || "",
      addressCountry: "ID"
    },
    areaServed: [
      {
        "@type": "City",
        name: "Berastagi"
      },
      {
        "@type": "AdministrativeArea",
        name: "Kabupaten Karo"
      },
      {
        "@type": "AdministrativeArea",
        name: "Sumatera Utara"
      }
    ]
  };
}

function breadcrumbSchema(items = []) {
  const normalized = items
    .filter(item => item && item.name && item.url)
    .map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: String(item.name).trim(),
      item: String(item.url).trim()
    }));

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: normalized
  };
}

function webpageSchema({
  baseUrl,
  url,
  title,
  description,
  image,
  breadcrumbItems = []
}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const pageUrl = normalizeCanonical(safeBase, url || "/");
  const pageImage = absoluteUrl(safeBase, image || defaults.defaultImage);

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: title,
    headline: title,
    description: description,
    inLanguage: defaults.language,
    isPartOf: {
      "@id": `${safeBase}/#website`
    },
    about: {
      "@id": `${safeBase}/#organization`
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: pageImage
    },
    breadcrumb: breadcrumbItems.length
      ? {
          "@id": `${pageUrl}#breadcrumb`
        }
      : undefined
  };
}

function articleSchema({
  baseUrl,
  url,
  title,
  description,
  image,
  datePublished,
  dateModified,
  authorName = "Admin Wisata Berastagi",
  siteName,
  keywords = []
}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const pageUrl = normalizeCanonical(safeBase, url || "/");
  const pageImage = absoluteUrl(safeBase, image || defaults.defaultImage);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: pageUrl,
    headline: truncate(title, 110),
    description: truncate(description, 160),
    image: [pageImage],
    datePublished: datePublished || "",
    dateModified: dateModified || datePublished || "",
    author: {
      "@type": "Person",
      name: authorName
    },
    publisher: {
      "@type": "Organization",
      name: siteName || defaults.siteName,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(safeBase, defaults.defaultImage)
      }
    },
    keywords: Array.isArray(keywords) ? dedupeKeywords(keywords).join(", ") : String(keywords || "")
  };
}

function touristAttractionSchema({
  baseUrl,
  url,
  name,
  description,
  image,
  addressLocality = "Berastagi",
  addressRegion = "Sumatera Utara",
  addressCountry = "ID"
}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");

  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name,
    url: normalizeCanonical(safeBase, url || "/"),
    description: truncate(description, 160),
    image: absoluteUrl(safeBase, image || defaults.defaultImage),
    address: {
      "@type": "PostalAddress",
      addressLocality,
      addressRegion,
      addressCountry
    }
  };
}

function lodgingBusinessSchema({
  baseUrl,
  url,
  name,
  description,
  image,
  addressLocality = "Berastagi",
  addressRegion = "Sumatera Utara",
  addressCountry = "ID"
}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");

  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name,
    url: normalizeCanonical(safeBase, url || "/"),
    description: truncate(description, 160),
    image: absoluteUrl(safeBase, image || defaults.defaultImage),
    address: {
      "@type": "PostalAddress",
      addressLocality,
      addressRegion,
      addressCountry
    }
  };
}

function restaurantSchema({
  baseUrl,
  url,
  name,
  description,
  image,
  addressLocality = "Berastagi",
  addressRegion = "Sumatera Utara",
  addressCountry = "ID",
  servesCuisine = "Masakan Karo, Masakan Indonesia"
}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    url: normalizeCanonical(safeBase, url || "/"),
    description: truncate(description, 160),
    image: absoluteUrl(safeBase, image || defaults.defaultImage),
    servesCuisine,
    address: {
      "@type": "PostalAddress",
      addressLocality,
      addressRegion,
      addressCountry
    }
  };
}

function faqSchema(items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items
      .filter(item => item && item.question && item.answer)
      .map(item => ({
        "@type": "Question",
        name: stripHtml(item.question),
        acceptedAnswer: {
          "@type": "Answer",
          text: stripHtml(item.answer)
        }
      }))
  };
}

function makeJsonLdGraph(...schemas) {
  const flat = schemas.flat().filter(Boolean);

  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": flat.map(schema => {
        if (schema["@context"]) {
          const { ["@context"]: _ignored, ...rest } = schema;
          return rest;
        }
        return schema;
      })
    },
    null,
    2
  );
}

module.exports = {
  stripHtml,
  truncate,
  absoluteUrl,
  normalizeCanonical,
  dedupeKeywords,
  keywordsToString,
  siteSeoDefaults,
  buildSeo,
  buildTitle,
  buildDescription,
  websiteSchema,
  organizationSchema,
  localBusinessSchema,
  breadcrumbSchema,
  webpageSchema,
  articleSchema,
  touristAttractionSchema,
  lodgingBusinessSchema,
  restaurantSchema,
  faqSchema,
  makeJsonLdGraph
};
