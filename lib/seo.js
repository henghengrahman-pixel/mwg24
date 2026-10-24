function stripHtml(value = "") {
  return String(value || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value = "", max = 160) {
  const clean = stripHtml(value);
  if (!clean.length) return "";
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "").trim() + "...";
}

function absoluteUrl(baseUrl = "", input = "") {
  const safeBase = String(baseUrl || "").replace(/\/+$/, "");
  const safeInput = String(input || "").trim();

  if (!safeInput) return safeBase;
  if (/^https?:\/\//i.test(safeInput)) return safeInput;

  if (!safeBase) {
    return safeInput.startsWith("/") ? safeInput : `/${safeInput}`;
  }

  return `${safeBase}${safeInput.startsWith("/") ? safeInput : `/${safeInput}`}`;
}

function normalizeCanonical(baseUrl = "", canonicalOrPath = "") {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const safePath = String(canonicalOrPath || "/").trim() || "/";
  const raw = absoluteUrl(safeBase, safePath);

  try {
    const url = new URL(raw);
    url.hash = "";
    url.searchParams.sort();

    url.pathname = url.pathname.replace(/\/{2,}/g, "/");

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    } else {
      url.pathname = "/";
    }

    return url.toString();
  } catch {
    const cleaned = raw.replace(/([^:]\/)\/+/g, "$1");
    if (cleaned === safeBase || cleaned === `${safeBase}/`) return `${safeBase}/`;
    return cleaned.replace(/\/+$/, "");
  }
}

function normalizeSchemaId(baseUrl = "", path = "/", suffix = "") {
  const canonical = normalizeCanonical(baseUrl, path || "/");
  const safeSuffix = String(suffix || "").replace(/^#*/, "");
  return safeSuffix ? `${canonical}#${safeSuffix}` : canonical;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function dedupeKeywords(keywords = []) {
  const seen = new Set();
  const result = [];

  for (const item of ensureArray(keywords)) {
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

  return String(keywords || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(x => x.toLowerCase() === item.toLowerCase()) === index)
    .join(", ");
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
  breadcrumbs = [],
  section = "",
  tags = [],
  publishedTime = "",
  modifiedTime = "",
  locale,
  language,
  siteName
} = {}) {
  const defaults = siteSeoDefaults();
  const finalCanonical = normalizeCanonical(defaults.siteUrl, canonical || "/");

  return {
    title: truncate(title || defaults.defaultTitle, 70),
    description: truncate(description || defaults.defaultDescription, 160),
    keywords: keywordsToString(keywords || defaults.defaultKeywords),
    image: absoluteUrl(defaults.siteUrl, image || defaults.defaultImage),
    canonical: finalCanonical,
    type: String(type || "website"),
    noindex: Boolean(noindex),
    jsonLd,
    breadcrumbs: Array.isArray(breadcrumbs) ? breadcrumbs : [],
    section: String(section || "").trim(),
    tags: dedupeKeywords(Array.isArray(tags) ? tags : []),
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

function buildImage(baseUrl, image) {
  const defaults = siteSeoDefaults();
  return absoluteUrl(baseUrl || defaults.siteUrl, image || defaults.defaultImage);
}

function websiteSchema(baseUrl, settings = {}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const siteName = settings.site_name || defaults.siteName;
  const description = settings.homepage_meta_description || defaults.defaultDescription;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${safeBase}/#website`,
    url: `${safeBase}/`,
    name: siteName,
    alternateName: "Portal Wisata Berastagi",
    description: truncate(description, 160),
    inLanguage: defaults.language,
    publisher: {
      "@id": `${safeBase}/#organization`
    },
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
  const logo = absoluteUrl(safeBase, settings.logo || defaults.defaultImage);

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
    telephone: settings.contact_phone || undefined,
    email: settings.contact_email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address || undefined,
      addressLocality: "Berastagi",
      addressRegion: "Sumatera Utara",
      postalCode: settings.postal_code || undefined,
      addressCountry: "ID"
    },
    areaServed: [
      { "@type": "City", name: "Berastagi" },
      { "@type": "AdministrativeArea", name: "Kabupaten Karo" },
      { "@type": "AdministrativeArea", name: "Sumatera Utara" }
    ]
  };
}

function breadcrumbSchema(items = [], baseUrl = "", url = "/") {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const canonical = normalizeCanonical(safeBase, url || "/");

  const normalized = ensureArray(items)
    .filter(item => item && item.name && item.url)
    .map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: stripHtml(item.name),
      item: normalizeCanonical(safeBase, item.url)
    }))
    .filter(item => item.name && item.item);

  if (!normalized.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
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
  const canonical = normalizeCanonical(safeBase, url || "/");
  const pageImage = absoluteUrl(safeBase, image || defaults.defaultImage);

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: stripHtml(title || defaults.defaultTitle),
    headline: stripHtml(title || defaults.defaultTitle),
    description: truncate(description || defaults.defaultDescription, 160),
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
    }
  };

  if (Array.isArray(breadcrumbItems) && breadcrumbItems.length) {
    schema.breadcrumb = {
      "@id": `${canonical}#breadcrumb`
    };
  }

  return schema;
}

function collectionPageSchema({
  baseUrl,
  url,
  title,
  description,
  image,
  breadcrumbItems = []
}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const canonical = normalizeCanonical(safeBase, url || "/");
  const pageImage = absoluteUrl(safeBase, image || defaults.defaultImage);

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: stripHtml(title || defaults.defaultTitle),
    headline: stripHtml(title || defaults.defaultTitle),
    description: truncate(description || defaults.defaultDescription, 160),
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
    }
  };

  if (Array.isArray(breadcrumbItems) && breadcrumbItems.length) {
    schema.breadcrumb = {
      "@id": `${canonical}#breadcrumb`
    };
  }

  return schema;
}

function itemListSchema({ baseUrl, url, name, items = [] }) {
  const safeBase = String(baseUrl || siteSeoDefaults().siteUrl).replace(/\/+$/, "");
  const canonical = normalizeCanonical(safeBase, url || "/");

  const itemListElement = ensureArray(items)
    .map((item, index) => {
      const itemUrl = item?.url ? normalizeCanonical(safeBase, item.url) : "";
      const itemName = stripHtml(item?.name || item?.title || "");
      if (!itemUrl || !itemName) return null;

      return {
        "@type": "ListItem",
        position: index + 1,
        url: itemUrl,
        name: itemName
      };
    })
    .filter(Boolean);

  if (!itemListElement.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${canonical}#itemlist`,
    name: stripHtml(name || ""),
    itemListElement
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
  keywords = []
}) {
  const defaults = siteSeoDefaults();
  const safeBase = String(baseUrl || defaults.siteUrl).replace(/\/+$/, "");
  const canonical = normalizeCanonical(safeBase, url || "/");
  const pageImage = absoluteUrl(safeBase, image || defaults.defaultImage);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonical}#article`,
    mainEntityOfPage: {
      "@id": `${canonical}#webpage`
    },
    headline: truncate(title || defaults.defaultTitle, 110),
    description: truncate(description || defaults.defaultDescription, 160),
    image: [pageImage],
    datePublished: datePublished || undefined,
    dateModified: dateModified || datePublished || undefined,
    author: {
      "@type": "Person",
      name: stripHtml(authorName)
    },
    publisher: {
      "@id": `${safeBase}/#organization`
    },
    keywords: keywordsToString(keywords || [])
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
  const canonical = normalizeCanonical(safeBase, url || "/");

  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    "@id": `${canonical}#touristattraction`,
    name: stripHtml(name),
    url: canonical,
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
  const canonical = normalizeCanonical(safeBase, url || "/");

  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${canonical}#lodgingbusiness`,
    name: stripHtml(name),
    url: canonical,
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
  const canonical = normalizeCanonical(safeBase, url || "/");

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${canonical}#restaurant`,
    name: stripHtml(name),
    url: canonical,
    description: truncate(description, 160),
    image: absoluteUrl(safeBase, image || defaults.defaultImage),
    servesCuisine: stripHtml(servesCuisine),
    address: {
      "@type": "PostalAddress",
      addressLocality,
      addressRegion,
      addressCountry
    }
  };
}

function faqSchema(items = [], id = "") {
  const normalized = ensureArray(items)
    .filter(item => item && item.question && item.answer)
    .map(item => ({
      "@type": "Question",
      name: stripHtml(item.question),
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(item.answer)
      }
    }));

  if (!normalized.length) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: normalized
  };

  if (id) schema["@id"] = id;

  return schema;
}

function cleanSchemaNode(node) {
  if (Array.isArray(node)) {
    return node.map(cleanSchemaNode).filter(Boolean);
  }

  if (!node || typeof node !== "object") return node;

  const cleaned = {};

  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      const arr = value.map(cleanSchemaNode).filter(Boolean);
      if (!arr.length) continue;
      cleaned[key] = arr;
      continue;
    }

    if (typeof value === "object") {
      const nested = cleanSchemaNode(value);
      if (!nested || (typeof nested === "object" && !Array.isArray(nested) && !Object.keys(nested).length)) {
        continue;
      }
      cleaned[key] = nested;
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

function makeJsonLdGraph(...schemas) {
  const flat = schemas
    .flat(Infinity)
    .filter(Boolean)
    .map(schema => {
      if (schema && schema["@context"]) {
        const { ["@context"]: _ignored, ...rest } = schema;
        return rest;
      }
      return schema;
    })
    .map(cleanSchemaNode)
    .filter(Boolean);

  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": flat
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
  normalizeSchemaId,
  ensureArray,
  dedupeKeywords,
  keywordsToString,
  siteSeoDefaults,
  buildSeo,
  buildTitle,
  buildDescription,
  buildImage,
  websiteSchema,
  organizationSchema,
  localBusinessSchema,
  breadcrumbSchema,
  webpageSchema,
  collectionPageSchema,
  itemListSchema,
  articleSchema,
  touristAttractionSchema,
  lodgingBusinessSchema,
  restaurantSchema,
  faqSchema,
  cleanSchemaNode,
  makeJsonLdGraph
};
