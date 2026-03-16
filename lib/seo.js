function siteSeoDefaults() {
  return {
    siteName: "Wisata Berastagi",
    siteTagline: "Panduan wisata Berastagi terlengkap",

    defaultTitle:
      "Wisata Berastagi – Tempat Wisata, Villa, Hotel, Kuliner & Panduan Liburan",

    defaultDescription:
      "Panduan lengkap wisata Berastagi untuk menemukan tempat wisata populer, villa dan hotel terbaik, kuliner khas Karo, serta tips liburan di Berastagi Kabupaten Karo Sumatera Utara.",

    defaultKeywords:
      "wisata berastagi, tempat wisata berastagi, villa berastagi, hotel berastagi, kuliner berastagi, liburan berastagi, wisata karo, tempat wisata karo",

    defaultImage: "/images/wisata-berastagi-cover.jpg",

    canonical: "https://wisataberastagi.com"
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
  jsonLd = null
}) {
  const defaults = siteSeoDefaults();

  return {
    title: title || defaults.defaultTitle,
    description: description || defaults.defaultDescription,
    keywords: keywords || defaults.defaultKeywords,
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
      "Website panduan wisata Berastagi yang membahas tempat wisata, villa dan hotel, kuliner khas Karo, serta tips liburan di Berastagi Sumatera Utara.",

    image: `${baseUrl}/images/wisata-berastagi-cover.jpg`,

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
    description:
      "Panduan wisata Berastagi yang membahas tempat wisata, villa, hotel, kuliner, serta tips liburan ke Berastagi di Kabupaten Karo.",

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
