function siteSeoDefaults() {
  return {
    siteName: "Wisata Berastagi",
    siteTagline: "Panduan wisata Berastagi terlengkap",
    defaultTitle: "Wisata Berastagi Terlengkap 2026 | Tempat Wisata, Villa, Kuliner & Liburan",
    defaultDescription:
      "Temukan panduan lengkap wisata Berastagi: tempat wisata populer, villa murah, kuliner, ulasan pengunjung, dan tips liburan terbaru di Berastagi.",
    defaultImage: "/public/images/default-cover.jpg"
  };
}

function buildSeo({
  title,
  description,
  image,
  canonical,
  type = "website",
  noindex = false,
  jsonLd = null
}) {
  const defaults = siteSeoDefaults();
  return {
    title: title || defaults.defaultTitle,
    description: description || defaults.defaultDescription,
    image: image || defaults.defaultImage,
    canonical,
    type,
    noindex,
    jsonLd
  };
}

function localBusinessSchema(baseUrl, settings = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: settings.site_name || "Wisata Berastagi",
    url: baseUrl,
    telephone: settings.contact_phone || "",
    email: settings.contact_email || "",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Berastagi",
      addressRegion: "Sumatera Utara",
      addressCountry: "ID"
    }
  };
}

function breadcrumbSchema(items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

module.exports = {
  siteSeoDefaults,
  buildSeo,
  localBusinessSchema,
  breadcrumbSchema
};
