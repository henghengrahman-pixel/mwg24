function siteSeoDefaults() {
  return {
    siteName: "Wisata Berastagi",
    siteTagline: "Panduan wisata Berastagi terlengkap",
    defaultTitle:
      "Wisata Berastagi Terlengkap 2026 | Tempat Wisata, Vila & Hotel, Kuliner & Liburan",
    defaultDescription:
      "Temukan panduan lengkap wisata Berastagi, tempat wisata populer, vila dan hotel di Berastagi, kuliner favorit, ulasan pengunjung, dan tips liburan terbaru di Berastagi, Sumatera Utara.",
    defaultImage: "/public/images/default-cover.jpg",
    canonical: "https://wisataberastagi.com"
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
    canonical: canonical || defaults.canonical,
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
    alternateName: "WisataBerastagi.com",
    url: baseUrl,
    description:
      "Panduan lengkap wisata Berastagi yang membahas tempat wisata, vila dan hotel, kuliner, serta tips liburan di Berastagi Sumatera Utara.",
    telephone: settings.contact_phone || "",
    email: settings.contact_email || "",
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address || "",
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

function websiteSchema(baseUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Wisata Berastagi",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}/cari?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

module.exports = {
  siteSeoDefaults,
  buildSeo,
  localBusinessSchema,
  breadcrumbSchema,
  websiteSchema
};
