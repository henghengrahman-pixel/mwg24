const express = require("express");
const { getDb } = require("../lib/db");
const helpers = require("../lib/helpers");
const {
  buildSeo,
  buildTitle,
  buildDescription,
  makeJsonLdGraph,
  websiteSchema,
  organizationSchema,
  localBusinessSchema,
  collectionPageSchema,
  webpageSchema,
  itemListSchema,
  articleSchema,
  touristAttractionSchema,
  lodgingBusinessSchema,
  restaurantSchema,
  breadcrumbSchema,
  faqSchema,
  absoluteUrl
} = require("../lib/seo");

const router = express.Router();

function getSettings() {
  const db = getDb();
  return db.prepare("SELECT * FROM settings WHERE id = 1").get() || {};
}

router.use((req, res, next) => {
  res.locals.settings = getSettings();
  res.locals.helpers = helpers;
  next();
});

function normalizeImage(value, fallback = "/images/wisata-berastagi-cover.jpg") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/public/")) return raw.replace("/public", "");
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function parseGalleryImages(value, coverImage = "") {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => normalizeImage(item));
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map((item) => normalizeImage(item));
  } catch {}
  const fallback = String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeImage(item));
  if (fallback.length) return fallback;
  return coverImage ? [normalizeImage(coverImage)] : [];
}

function parseDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function makeListItems(items, prefix) {
  return (items || []).map((item) => ({ name: item.title, url: `/${prefix}/${item.slug}` }));
}

function getApprovedComments(itemType, itemId) {
  return getDb().prepare(
    "SELECT * FROM comments WHERE item_type = ? AND item_id = ? AND status = 'approved' ORDER BY id DESC"
  ).all(itemType, itemId);
}

function getRatings(itemType, itemId) {
  return getDb().prepare(
    "SELECT * FROM ratings WHERE item_type = ? AND item_id = ? ORDER BY id DESC"
  ).all(itemType, itemId);
}

function getAverageRating(rows = []) {
  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + Number(row.rating || 0), 0);
  return Number((total / rows.length).toFixed(1));
}

router.get("/", (req, res) => {
  const db = getDb();
  const settings = res.locals.settings;
  const featuredWisata = db.prepare("SELECT * FROM wisata ORDER BY is_featured DESC, updated_at DESC, id DESC LIMIT 6").all();
  const featuredVilla = db.prepare("SELECT * FROM villa ORDER BY is_featured DESC, updated_at DESC, id DESC LIMIT 6").all();
  const latestKuliner = db.prepare("SELECT * FROM kuliner ORDER BY is_featured DESC, updated_at DESC, id DESC LIMIT 6").all();
  const latestBerita = db.prepare("SELECT * FROM articles WHERE status = 'publish' ORDER BY published_at DESC, id DESC LIMIT 6").all();
  const galleryItems = db.prepare("SELECT * FROM gallery WHERE is_active = 1 ORDER BY sort_order ASC, id DESC LIMIT 5").all();

  const faq = [
    { question: "Apa saja tempat wisata populer di Berastagi?", answer: "Wisata populer di Berastagi antara lain Bukit Gundaling, Gunung Sibayak, Pasar Buah Berastagi, dan berbagai spot alam dataran tinggi Karo." },
    { question: "Apakah Berastagi cocok untuk liburan keluarga?", answer: "Ya. Berastagi cocok untuk keluarga karena punya udara sejuk, wisata alam, kuliner, dan pilihan penginapan yang beragam." },
    { question: "Di mana cari villa dan hotel di Berastagi?", answer: "Kamu bisa melihat rekomendasi villa dan hotel di halaman kategori penginapan lengkap dengan harga, fasilitas, dan lokasi." }
  ];

  const seo = buildSeo({
    title: settings.homepage_title || "Wisata Berastagi Terlengkap | Tempat Wisata, Villa, Hotel & Kuliner Terbaik",
    description: settings.homepage_meta_description,
    canonical: "/",
    image: settings.hero_background,
    type: "website",
    jsonLd: makeJsonLdGraph(
      websiteSchema(res.locals.baseUrl, settings),
      organizationSchema(res.locals.baseUrl, settings),
      localBusinessSchema(res.locals.baseUrl, settings),
      collectionPageSchema({ baseUrl: res.locals.baseUrl, url: "/", title: settings.homepage_title, description: settings.homepage_meta_description, image: settings.hero_background }),
      itemListSchema({ baseUrl: res.locals.baseUrl, url: "/wisata", name: "Tempat Wisata di Berastagi", items: makeListItems(featuredWisata, "wisata") }),
      itemListSchema({ baseUrl: res.locals.baseUrl, url: "/villa", name: "Villa dan Hotel di Berastagi", items: makeListItems(featuredVilla, "villa") }),
      itemListSchema({ baseUrl: res.locals.baseUrl, url: "/kuliner", name: "Kuliner Berastagi", items: makeListItems(latestKuliner, "kuliner") }),
      faqSchema(faq, `${res.locals.baseUrl}/#faq`)
    )
  });

  res.render("home", { settings, featuredWisata, featuredVilla, latestKuliner, latestBerita, galleryItems, seo, helpers });
});

function renderCollection(req, res, options) {
  const { table, view, path, title, description, prefix, introItems, schemaType = "collection" } = options;
  const db = getDb();
  const items = db.prepare(`SELECT * FROM ${table} ORDER BY is_featured DESC, updated_at DESC, id DESC`).all();
  const settings = res.locals.settings;
  const breadcrumbs = [{ name: "Beranda", url: "/" }, { name: title, url: path }];
  const faq = introItems || [];
  const seo = buildSeo({
    title: `${title} | Wisata Berastagi`,
    description,
    canonical: path,
    image: settings.hero_background,
    type: "website",
    breadcrumbs,
    jsonLd: makeJsonLdGraph(
      collectionPageSchema({ baseUrl: res.locals.baseUrl, url: path, title, description, image: settings.hero_background, breadcrumbItems: breadcrumbs }),
      itemListSchema({ baseUrl: res.locals.baseUrl, url: path, name: title, items: makeListItems(items, prefix) }),
      breadcrumbSchema(breadcrumbs, res.locals.baseUrl, path),
      faqSchema(faq, `${res.locals.baseUrl}${path}#faq`)
    )
  });
  res.render(view, { settings, items, seo, helpers });
}

router.get("/wisata", (req, res) => renderCollection(req, res, {
  table: "wisata",
  view: "wisata-list",
  path: "/wisata",
  title: "Tempat Wisata di Berastagi",
  description: "Temukan tempat wisata di Berastagi yang populer, menarik, dan cocok untuk liburan keluarga, pasangan, maupun rombongan di dataran tinggi Karo.",
  prefix: "wisata",
  introItems: [
    { question: "Apa saja tempat wisata populer di Berastagi?", answer: "Tempat wisata populer di Berastagi antara lain Bukit Gundaling, Gunung Sibayak, Pasar Buah Berastagi, dan berbagai wisata alam lainnya." }
  ]
}));

router.get("/villa", (req, res) => renderCollection(req, res, {
  table: "villa",
  view: "villa-list",
  path: "/villa",
  title: "Villa dan Hotel di Berastagi",
  description: "Temukan rekomendasi villa dan hotel di Berastagi yang nyaman, bersih, dan cocok untuk keluarga, pasangan, maupun rombongan.",
  prefix: "villa",
  introItems: [
    { question: "Apakah Berastagi punya banyak pilihan villa dan hotel?", answer: "Ya. Berastagi punya banyak pilihan villa, hotel, dan penginapan untuk keluarga maupun rombongan." }
  ]
}));

router.get("/kuliner", (req, res) => renderCollection(req, res, {
  table: "kuliner",
  view: "kuliner-list",
  path: "/kuliner",
  title: "Kuliner Berastagi",
  description: "Temukan rekomendasi kuliner Berastagi yang enak, populer, nyaman untuk keluarga, dan cocok dinikmati saat liburan di udara sejuk dataran tinggi.",
  prefix: "kuliner",
  introItems: [
    { question: "Apa saja kuliner terkenal di Berastagi?", answer: "Kuliner terkenal di Berastagi meliputi jagung bakar, makanan khas Karo, serta berbagai tempat makan favorit di pusat kota dan area wisata." }
  ]
}));

router.get("/berita", (req, res) => {
  const db = getDb();
  const settings = res.locals.settings;
  const items = db.prepare("SELECT * FROM articles WHERE status = 'publish' ORDER BY published_at DESC, id DESC").all();
  const breadcrumbs = [{ name: "Beranda", url: "/" }, { name: "Berita Wisata Berastagi", url: "/berita" }];
  const seo = buildSeo({
    title: "Berita Wisata Berastagi Terbaru | Info Liburan, Event, Kuliner & Hotel",
    description: "Ikuti berita terbaru seputar wisata Berastagi, event, kuliner, penginapan, dan tips liburan yang relevan untuk pengunjung Kabupaten Karo.",
    canonical: "/berita",
    image: settings.hero_background,
    breadcrumbs,
    jsonLd: makeJsonLdGraph(
      collectionPageSchema({ baseUrl: res.locals.baseUrl, url: "/berita", title: "Berita Wisata Berastagi", description: "Kumpulan berita wisata Berastagi terbaru.", image: settings.hero_background, breadcrumbItems: breadcrumbs }),
      itemListSchema({ baseUrl: res.locals.baseUrl, url: "/berita", name: "Berita Wisata Berastagi", items: makeListItems(items, "berita") }),
      breadcrumbSchema(breadcrumbs, res.locals.baseUrl, "/berita")
    )
  });
  res.render("berita-list", { settings, items, seo, helpers });
});

router.get("/galeri", (req, res) => {
  const db = getDb();
  const settings = res.locals.settings;
  const items = db.prepare("SELECT * FROM gallery WHERE is_active = 1 ORDER BY sort_order ASC, id DESC").all();
  const breadcrumbs = [{ name: "Beranda", url: "/" }, { name: "Galeri Berastagi", url: "/galeri" }];
  const seo = buildSeo({
    title: "Galeri Berastagi | Foto Tempat Wisata, Panorama Alam & Suasana Liburan",
    description: "Lihat galeri foto Berastagi yang menampilkan panorama alam, destinasi wisata, suasana kota, dan pesona terbaik dataran tinggi Karo.",
    canonical: "/galeri",
    image: items[0]?.image || settings.hero_background,
    breadcrumbs,
    jsonLd: makeJsonLdGraph(
      collectionPageSchema({ baseUrl: res.locals.baseUrl, url: "/galeri", title: "Galeri Berastagi", description: "Galeri foto keindahan Berastagi.", image: items[0]?.image || settings.hero_background, breadcrumbItems: breadcrumbs }),
      breadcrumbSchema(breadcrumbs, res.locals.baseUrl, "/galeri")
    )
  });
  res.render("gallery-list", { settings, items, seo, helpers });
});

function renderDetail(req, res, options) {
  const { table, itemType, slug, view, pathPrefix, sectionLabel, schemaBuilder, faqBuilder } = options;
  const db = getDb();
  const settings = res.locals.settings;
  const item = db.prepare(`SELECT * FROM ${table} WHERE slug = ?`).get(slug);
  if (!item) return res.status(404).render("about", { settings, seo: { title: "404 | Data Tidak Ditemukan", noindex: true } });

  item.image = normalizeImage(item.image);
  const comments = getApprovedComments(itemType, item.id);
  const ratings = getRatings(itemType, item.id);
  const avg = getAverageRating(ratings);
  const related = db.prepare(`SELECT * FROM ${table} WHERE id != ? ORDER BY is_featured DESC, updated_at DESC, id DESC LIMIT 6`).all(item.id);
  const breadcrumbs = [
    { name: "Beranda", url: "/" },
    { name: sectionLabel, url: pathPrefix },
    { name: item.title, url: `${pathPrefix}/${item.slug}` }
  ];
  const faq = faqBuilder ? faqBuilder(item) : [];
  const seo = buildSeo({
    title: item.meta_title || buildTitle(item.title, "Wisata Berastagi"),
    description: item.meta_description || buildDescription(item.excerpt || item.content, settings.homepage_meta_description),
    canonical: `${pathPrefix}/${item.slug}`,
    image: item.image,
    type: itemType === "berita" ? "article" : "website",
    breadcrumbs,
    publishedTime: parseDate(item.published_at || item.created_at),
    modifiedTime: parseDate(item.updated_at || item.created_at),
    section: sectionLabel,
    jsonLd: makeJsonLdGraph(
      webpageSchema({ baseUrl: res.locals.baseUrl, url: `${pathPrefix}/${item.slug}`, title: item.meta_title || item.title, description: item.meta_description || item.excerpt || item.content, image: item.image, breadcrumbItems: breadcrumbs }),
      breadcrumbSchema(breadcrumbs, res.locals.baseUrl, `${pathPrefix}/${item.slug}`),
      schemaBuilder(item, settings),
      faqSchema(faq, `${res.locals.baseUrl}${pathPrefix}/${item.slug}#faq`)
    )
  });
  res.render(view, { settings, item, related, comments, ratings, avg, totalImages: 0, mainImage: item.image, sideImages: [], seo, helpers });
}

router.get("/wisata/:slug", (req, res) => renderDetail(req, res, {
  table: "wisata",
  itemType: "wisata",
  slug: req.params.slug,
  view: "wisata-detail",
  pathPrefix: "/wisata",
  sectionLabel: "Tempat Wisata",
  schemaBuilder: (item) => touristAttractionSchema({ baseUrl: res.locals.baseUrl, url: `/wisata/${item.slug}`, name: item.title, description: item.meta_description || item.excerpt || item.content, image: item.image }),
  faqBuilder: (item) => [
    { question: `Di mana lokasi ${item.title}?`, answer: `${item.title} berada di ${item.location || "kawasan Berastagi, Kabupaten Karo"}.` },
    { question: `Berapa harga tiket masuk ${item.title}?`, answer: `Harga tiket masuk ${item.title} sekitar ${helpers.formatCurrency(item.ticket_price || 0)}.` }
  ]
}));

router.post("/wisata/:slug/comment", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT id FROM wisata WHERE slug = ?").get(req.params.slug);
  if (item && req.body.name && req.body.comment) {
    db.prepare("INSERT INTO comments (item_type, item_id, name, email, comment, status) VALUES ('wisata', ?, ?, ?, ?, 'pending')").run(item.id, String(req.body.name).trim(), String(req.body.email || "").trim(), String(req.body.comment).trim());
  }
  res.redirect(`/wisata/${req.params.slug}#ulasan`);
});
router.post("/wisata/:slug/rating", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT id FROM wisata WHERE slug = ?").get(req.params.slug);
  const rating = Number(req.body.rating || 0);
  if (item && rating >= 1 && rating <= 5) {
    db.prepare("INSERT INTO ratings (item_type, item_id, name, rating) VALUES ('wisata', ?, ?, ?)").run(item.id, String(req.body.name || "Pengunjung").trim(), rating);
  }
  res.redirect(`/wisata/${req.params.slug}#rating`);
});

router.get("/villa/:slug", (req, res) => {
  const db = getDb();
  const settings = res.locals.settings;
  const item = db.prepare("SELECT * FROM villa WHERE slug = ?").get(req.params.slug);
  if (!item) return res.status(404).render("about", { settings, seo: { title: "404 | Data Tidak Ditemukan", noindex: true } });
  const comments = getApprovedComments("villa", item.id);
  const ratings = getRatings("villa", item.id);
  const avg = getAverageRating(ratings);
  const related = db.prepare("SELECT * FROM villa WHERE id != ? ORDER BY is_featured DESC, updated_at DESC, id DESC LIMIT 6").all(item.id);
  item.image = normalizeImage(item.image);
  const allImages = Array.from(new Set([item.image, ...parseGalleryImages(item.images, item.image)])).filter(Boolean);
  const mainImage = allImages[0] || item.image;
  const sideImages = allImages.slice(1, 5);
  const breadcrumbs = [{ name: "Beranda", url: "/" }, { name: "Villa & Hotel", url: "/villa" }, { name: item.title, url: `/villa/${item.slug}` }];
  const faq = [
    { question: `Di mana lokasi ${item.title}?`, answer: `${item.title} berada di ${item.location || "Berastagi, Kabupaten Karo"}.` },
    { question: `Berapa harga menginap di ${item.title}?`, answer: `Harga mulai dari ${helpers.formatCurrency(item.price || 0)}.` }
  ];
  const seo = buildSeo({
    title: item.meta_title || buildTitle(item.title, "Villa dan Hotel Berastagi"),
    description: item.meta_description || buildDescription(item.excerpt || item.content, settings.homepage_meta_description),
    canonical: `/villa/${item.slug}`,
    image: item.image,
    breadcrumbs,
    jsonLd: makeJsonLdGraph(
      webpageSchema({ baseUrl: res.locals.baseUrl, url: `/villa/${item.slug}`, title: item.meta_title || item.title, description: item.meta_description || item.excerpt || item.content, image: item.image, breadcrumbItems: breadcrumbs }),
      lodgingBusinessSchema({ baseUrl: res.locals.baseUrl, url: `/villa/${item.slug}`, name: item.title, description: item.meta_description || item.excerpt || item.content, image: item.image }),
      breadcrumbSchema(breadcrumbs, res.locals.baseUrl, `/villa/${item.slug}`),
      faqSchema(faq, `${res.locals.baseUrl}/villa/${item.slug}#faq`)
    )
  });
  res.render("villa-detail", { settings, item, related, comments, ratings, avg, totalImages: allImages.length, mainImage, sideImages, seo, helpers });
});

router.get("/kuliner/:slug", (req, res) => renderDetail(req, res, {
  table: "kuliner",
  itemType: "kuliner",
  slug: req.params.slug,
  view: "kuliner-detail",
  pathPrefix: "/kuliner",
  sectionLabel: "Kuliner",
  schemaBuilder: (item) => restaurantSchema({ baseUrl: res.locals.baseUrl, url: `/kuliner/${item.slug}`, name: item.title, description: item.meta_description || item.excerpt || item.content, image: item.image }),
  faqBuilder: (item) => [
    { question: `Di mana lokasi ${item.title}?`, answer: `${item.title} berada di ${item.location || "Berastagi, Kabupaten Karo"}.` },
    { question: `Berapa kisaran harga di ${item.title}?`, answer: `Kisaran harga di ${item.title} adalah ${item.price_range || "menyesuaikan menu yang dipilih"}.` }
  ]
}));

router.post("/kuliner/:slug/comment", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT id FROM kuliner WHERE slug = ?").get(req.params.slug);
  if (item && req.body.name && req.body.comment) {
    db.prepare("INSERT INTO comments (item_type, item_id, name, email, comment, status) VALUES ('kuliner', ?, ?, ?, ?, 'pending')").run(item.id, String(req.body.name).trim(), String(req.body.email || "").trim(), String(req.body.comment).trim());
  }
  res.redirect(`/kuliner/${req.params.slug}#ulasan`);
});
router.post("/kuliner/:slug/rating", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT id FROM kuliner WHERE slug = ?").get(req.params.slug);
  const rating = Number(req.body.rating || 0);
  if (item && rating >= 1 && rating <= 5) {
    db.prepare("INSERT INTO ratings (item_type, item_id, name, rating) VALUES ('kuliner', ?, ?, ?)").run(item.id, String(req.body.name || "Pengunjung").trim(), rating);
  }
  res.redirect(`/kuliner/${req.params.slug}#rating`);
});

router.get("/berita/:slug", (req, res) => {
  const db = getDb();
  const settings = res.locals.settings;
  const item = db.prepare("SELECT * FROM articles WHERE slug = ? AND status = 'publish'").get(req.params.slug);
  if (!item) return res.status(404).render("about", { settings, seo: { title: "404 | Artikel Tidak Ditemukan", noindex: true } });
  const related = db.prepare("SELECT * FROM articles WHERE id != ? AND status = 'publish' ORDER BY published_at DESC, id DESC LIMIT 6").all(item.id);
  item.image = normalizeImage(item.image);
  const breadcrumbs = [{ name: "Beranda", url: "/" }, { name: "Berita", url: "/berita" }, { name: item.title, url: `/berita/${item.slug}` }];
  const faq = [
    { question: "Berita ini membahas tentang apa?", answer: item.excerpt || helpers.excerpt(item.content || "Informasi wisata Berastagi.", 160) },
    { question: "Kapan berita ini dipublikasikan?", answer: item.published_at || item.created_at || "Sesuai tanggal yang tertera di halaman artikel." }
  ];
  const seo = buildSeo({
    title: item.meta_title || buildTitle(item.title, "Berita Wisata Berastagi"),
    description: item.meta_description || buildDescription(item.excerpt || item.content, settings.homepage_meta_description),
    canonical: `/berita/${item.slug}`,
    image: item.image,
    type: "article",
    breadcrumbs,
    publishedTime: parseDate(item.published_at || item.created_at),
    modifiedTime: parseDate(item.updated_at || item.created_at),
    section: "Berita",
    jsonLd: makeJsonLdGraph(
      webpageSchema({ baseUrl: res.locals.baseUrl, url: `/berita/${item.slug}`, title: item.meta_title || item.title, description: item.meta_description || item.excerpt || item.content, image: item.image, breadcrumbItems: breadcrumbs }),
      articleSchema({ baseUrl: res.locals.baseUrl, url: `/berita/${item.slug}`, title: item.title, description: item.meta_description || item.excerpt || item.content, image: item.image, datePublished: parseDate(item.published_at || item.created_at), dateModified: parseDate(item.updated_at || item.created_at), keywords: [item.category, item.title, "berita wisata berastagi"] }),
      breadcrumbSchema(breadcrumbs, res.locals.baseUrl, `/berita/${item.slug}`),
      faqSchema(faq, `${res.locals.baseUrl}/berita/${item.slug}#faq`)
    )
  });
  res.render("berita-detail", { settings, item, related, seo, helpers });
});

router.get("/about", (req, res) => {
  const settings = res.locals.settings;
  const seo = buildSeo({ title: "Tentang Wisata Berastagi | Portal Informasi Wisata Berastagi", description: "Kenali website Wisata Berastagi yang menyediakan panduan tempat wisata, penginapan, kuliner, dan berita terbaru di Kabupaten Karo.", canonical: "/about", image: settings.hero_background });
  res.render("about", { settings, seo, helpers });
});
router.get("/contact", (req, res) => {
  const settings = res.locals.settings;
  const seo = buildSeo({ title: "Kontak Wisata Berastagi | Hubungi Kami untuk Info Wisata, Villa & Kuliner", description: "Hubungi tim Wisata Berastagi untuk informasi wisata, kerja sama promosi, villa, hotel, kuliner, dan panduan liburan di Berastagi.", canonical: "/contact", image: settings.hero_background });
  res.render("contact", { settings, seo, helpers });
});
router.get("/privacy-policy", (req, res) => {
  const settings = res.locals.settings;
  const seo = buildSeo({ title: "Kebijakan Privasi | Wisata Berastagi", description: "Baca kebijakan privasi website Wisata Berastagi terkait pengumpulan data, cookie, dan perlindungan informasi pengguna.", canonical: "/privacy-policy", image: settings.hero_background });
  res.render("privacy", { settings, seo, helpers });
});
router.get("/disclaimer", (req, res) => {
  const settings = res.locals.settings;
  const seo = buildSeo({ title: "Disclaimer | Wisata Berastagi", description: "Baca disclaimer website Wisata Berastagi terkait akurasi informasi wisata, harga, jadwal, dan tautan pihak ketiga.", canonical: "/disclaimer", image: settings.hero_background });
  res.render("disclaimer", { settings, seo, helpers });
});

router.get("/cari", (req, res) => {
  const db = getDb();
  const settings = res.locals.settings;
  const q = String(req.query.q || "").trim();
  const like = `%${q}%`;
  const searchIn = (table, extra = "") => q ? db.prepare(`SELECT * FROM ${table} WHERE (title LIKE ? OR excerpt LIKE ? OR content LIKE ?) ${extra} ORDER BY updated_at DESC, id DESC LIMIT 10`).all(like, like, like) : [];
  const wisata = searchIn("wisata");
  const villa = searchIn("villa");
  const kuliner = searchIn("kuliner");
  const berita = q ? db.prepare("SELECT * FROM articles WHERE status = 'publish' AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?) ORDER BY published_at DESC, id DESC LIMIT 10").all(like, like, like) : [];
  const seo = buildSeo({ title: q ? `Hasil Pencarian: ${q} | Wisata Berastagi` : "Pencarian | Wisata Berastagi", description: q ? `Hasil pencarian untuk ${q} di website Wisata Berastagi.` : "Cari tempat wisata, penginapan, kuliner, dan berita di Wisata Berastagi.", canonical: q ? `/cari?q=${encodeURIComponent(q)}` : "/cari", noindex: true });
  res.render("search", { settings, q, wisata, villa, kuliner, berita, seo, helpers });
});

module.exports = router;
