const express = require("express");
const router = express.Router();

const { getDb } = require("../lib/db");
const {
  buildSeo,
  buildTitle,
  buildDescription,
  breadcrumbSchema,
  websiteSchema,
  organizationSchema,
  localBusinessSchema,
  webpageSchema,
  articleSchema,
  touristAttractionSchema,
  lodgingBusinessSchema,
  restaurantSchema,
  makeJsonLdGraph,
  absoluteUrl
} = require("../lib/seo");
const { excerpt, avgRating, formatCurrency } = require("../lib/helpers");

function getSettings() {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get();
}

function getRatings(itemType, itemId) {
  return getDb()
    .prepare(`
      SELECT *
      FROM ratings
      WHERE item_type = ? AND item_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(itemType, itemId);
}

function getComments(itemType, itemId, status = "approved") {
  return getDb()
    .prepare(`
      SELECT *
      FROM comments
      WHERE item_type = ? AND item_id = ? AND status = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(itemType, itemId, status);
}

function safeDescription(item, fallbackText) {
  return (
    item?.meta_description ||
    excerpt(item?.content || "", 155) ||
    fallbackText
  );
}

function safeParseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function safeVillaImages(item) {
  const images = safeParseJsonArray(item?.images);

  if (item?.image && !images.includes(item.image)) {
    images.unshift(item.image);
  }

  return images.filter(Boolean);
}

function safeImage(item) {
  if (item?.images) {
    const villaImages = safeVillaImages(item);
    if (villaImages.length) return villaImages[0];
  }

  return item?.image || "/images/wisata-berastagi-cover.jpg";
}

function safeDate(value) {
  try {
    return value ? new Date(value).toISOString() : new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

function getActiveGallery(limit = null) {
  const db = getDb();

  if (limit) {
    return db
      .prepare(`
        SELECT *
        FROM gallery
        WHERE is_active = 1
        ORDER BY sort_order ASC, id DESC
        LIMIT ?
      `)
      .all(limit);
  }

  return db
    .prepare(`
      SELECT *
      FROM gallery
      WHERE is_active = 1
      ORDER BY sort_order ASC, id DESC
    `)
    .all();
}

function renderPage(res, view, data = {}) {
  return res.render(view, {
    ...data,
    helpers: { formatCurrency }
  });
}

function buildCommonSchemas(baseUrl, settings, page) {
  return [
    websiteSchema(baseUrl, settings),
    organizationSchema(baseUrl, settings),
    localBusinessSchema(baseUrl, settings),
    webpageSchema(page)
  ];
}

function buildAggregateRating(ratings = []) {
  if (!ratings.length) return undefined;

  return {
    "@type": "AggregateRating",
    ratingValue: Number(avgRating(ratings)),
    reviewCount: ratings.length,
    bestRating: 5,
    worstRating: 1
  };
}

/* =========================
   HOME
========================= */
router.get("/", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;

  const featuredWisata = db
    .prepare("SELECT * FROM wisata WHERE is_featured = 1 ORDER BY id DESC LIMIT 6")
    .all();

  const featuredVilla = db
    .prepare("SELECT * FROM villa WHERE is_featured = 1 ORDER BY id DESC LIMIT 6")
    .all()
    .map((item) => ({
      ...item,
      images: safeVillaImages(item)
    }));

  const latestKuliner = db
    .prepare("SELECT * FROM kuliner ORDER BY id DESC LIMIT 6")
    .all();

  const latestBerita = db
    .prepare(`
      SELECT *
      FROM articles
      ORDER BY COALESCE(published_at, created_at) DESC, id DESC
      LIMIT 6
    `)
    .all();

  const galleryItems = getActiveGallery(8);
  const canonical = `${baseUrl}/`;

  const gallerySchema =
    galleryItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          name: "Galeri Keindahan Berastagi",
          description: "Kumpulan foto pemandangan, wisata, suasana kota, dan panorama terbaik di Berastagi.",
          url: `${baseUrl}/galeri`,
          image: galleryItems.map((item) => absoluteUrl(baseUrl, item.image))
        }
      : null;

  const title =
    settings?.homepage_meta_title ||
    "Wisata Berastagi Terlengkap – Tempat Wisata, Villa, Hotel, Kuliner & Panduan Liburan";

  const description =
    settings?.homepage_meta_description ||
    "Panduan wisata Berastagi terlengkap untuk menemukan tempat wisata populer, villa dan hotel terbaik, kuliner khas Karo, berita terbaru, serta tips liburan ke Berastagi Kabupaten Karo Sumatera Utara.";

  const pageSchemas = [
    ...buildCommonSchemas(baseUrl, settings, {
      baseUrl,
      url: canonical,
      title,
      description,
      image: settings?.hero_background || "/images/wisata-berastagi-cover.jpg",
      breadcrumbItems: [{ name: "Beranda", url: canonical }]
    }),
    breadcrumbSchema([{ name: "Beranda", url: canonical }]),
    gallerySchema
  ].filter(Boolean);

  renderPage(res, "home", {
    settings,
    featuredWisata,
    featuredVilla,
    latestKuliner,
    latestBerita,
    galleryItems,
    seo: buildSeo({
      title,
      description,
      canonical,
      image: settings?.hero_background || "/images/wisata-berastagi-cover.jpg",
      keywords: [
        "wisata berastagi",
        "tempat wisata berastagi",
        "villa berastagi",
        "hotel berastagi",
        "kuliner berastagi",
        "liburan berastagi",
        "berita berastagi",
        "wisata karo",
        "penginapan berastagi"
      ],
      jsonLd: makeJsonLdGraph(pageSchemas)
    })
  });
});

/* =========================
   GALLERY
========================= */
router.get("/galeri", (req, res) => {
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const galleryItems = getActiveGallery();
  const canonical = `${baseUrl}/galeri`;

  const title = "Galeri Wisata Berastagi Terindah | Wisata Berastagi";
  const description =
    "Lihat galeri foto keindahan Berastagi, mulai dari panorama pegunungan, tempat wisata populer, suasana kota, hingga pemandangan alam terbaik di Kabupaten Karo.";

  renderPage(res, "gallery-list", {
    settings,
    items: galleryItems,
    seo: buildSeo({
      title,
      description,
      canonical,
      image: galleryItems.length ? safeImage(galleryItems[0]) : "/images/wisata-berastagi-cover.jpg",
      keywords: [
        "galeri berastagi",
        "foto wisata berastagi",
        "pemandangan berastagi",
        "wisata karo"
      ],
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: galleryItems.length ? safeImage(galleryItems[0]) : "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Galeri", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Galeri", url: canonical }
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          name: "Galeri Keindahan Berastagi",
          description: "Galeri foto wisata dan panorama terbaik di Berastagi.",
          url: canonical,
          image: galleryItems.map((item) => absoluteUrl(baseUrl, item.image))
        }
      )
    })
  });
});

/* =========================
   WISATA
========================= */
router.get("/wisata", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const canonical = `${baseUrl}/wisata`;
  const items = db.prepare("SELECT * FROM wisata ORDER BY id DESC").all();

  const title = "Tempat Wisata di Berastagi Terbaru & Terfavorit | Wisata Berastagi";
  const description =
    "Temukan tempat wisata di Berastagi yang populer, menarik, sejuk, dan cocok untuk liburan keluarga, pasangan, maupun rombongan di Kabupaten Karo.";

  renderPage(res, "wisata-list", {
    settings,
    items,
    seo: buildSeo({
      title,
      description,
      canonical,
      keywords: [
        "tempat wisata berastagi",
        "wisata berastagi",
        "objek wisata berastagi",
        "tempat liburan di berastagi",
        "wisata karo"
      ],
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Tempat Wisata", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Tempat Wisata", url: canonical }
        ])
      )
    })
  });
});

router.get("/wisata/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const item = db.prepare("SELECT * FROM wisata WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/wisata");

  const ratings = getRatings("wisata", item.id);
  const comments = getComments("wisata", item.id);
  const related = db
    .prepare("SELECT * FROM wisata WHERE id != ? ORDER BY id DESC LIMIT 4")
    .all(item.id);

  const canonical = `${baseUrl}/wisata/${item.slug}`;
  const title = item.meta_title || buildTitle(item.title, "Wisata Berastagi");
  const description = buildDescription(
    safeDescription(item, `${item.title} adalah salah satu tempat wisata di Berastagi yang menarik untuk dikunjungi.`)
  );

  const attractionSchema = touristAttractionSchema({
    baseUrl,
    url: canonical,
    name: item.title,
    description,
    image: safeImage(item)
  });

  const aggregateRating = buildAggregateRating(ratings);
  if (aggregateRating) {
    attractionSchema.aggregateRating = aggregateRating;
  }

  renderPage(res, "wisata-detail", {
    settings,
    item,
    comments,
    ratings,
    related,
    avg: avgRating(ratings),
    seo: buildSeo({
      title,
      description,
      canonical,
      type: "article",
      image: safeImage(item),
      keywords: [
        item.title,
        "tempat wisata berastagi",
        "wisata berastagi",
        "liburan berastagi",
        "wisata karo"
      ],
      section: "Wisata",
      tags: [item.title, "Wisata Berastagi", "Kabupaten Karo"],
      publishedTime: safeDate(item.created_at),
      modifiedTime: safeDate(item.updated_at || item.created_at),
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: safeImage(item),
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Tempat Wisata", url: `${baseUrl}/wisata` },
            { name: item.title, url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Tempat Wisata", url: `${baseUrl}/wisata` },
          { name: item.title, url: canonical }
        ]),
        attractionSchema,
        articleSchema({
          baseUrl,
          url: canonical,
          title,
          description,
          image: safeImage(item),
          datePublished: safeDate(item.created_at),
          dateModified: safeDate(item.updated_at || item.created_at),
          authorName: settings?.site_name || "Wisata Berastagi",
          siteName: settings?.site_name || "Wisata Berastagi",
          keywords: [item.title, "tempat wisata berastagi", "wisata berastagi"]
        })
      )
    })
  });
});

router.post("/wisata/:slug/comment", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM wisata WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/wisata");

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const comment = String(req.body.comment || "").trim();

  if (name && comment) {
    db.prepare(`
      INSERT INTO comments (item_type, item_id, name, email, comment, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run("wisata", item.id, name, email, comment);
  }

  res.redirect(`/wisata/${item.slug}#ulasan`);
});

router.post("/wisata/:slug/rating", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM wisata WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/wisata");

  const name = String(req.body.name || "Pengunjung").trim();
  let rating = Number(req.body.rating || 0);

  if (rating < 1) rating = 1;
  if (rating > 5) rating = 5;

  db.prepare(`
    INSERT INTO ratings (item_type, item_id, name, rating)
    VALUES (?, ?, ?, ?)
  `).run("wisata", item.id, name, rating);

  res.redirect(`/wisata/${item.slug}#rating`);
});

/* =========================
   VILLA
========================= */
router.get("/villa", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const canonical = `${baseUrl}/villa`;

  const items = db
    .prepare("SELECT * FROM villa ORDER BY id DESC")
    .all()
    .map((item) => ({
      ...item,
      images: safeVillaImages(item)
    }));

  const title = "Villa dan Hotel di Berastagi Terbaik | Wisata Berastagi";
  const description =
    "Temukan rekomendasi villa dan hotel di Berastagi yang nyaman, bersih, sejuk, dan cocok untuk keluarga, pasangan, maupun rombongan liburan.";

  renderPage(res, "villa-list", {
    settings,
    items,
    seo: buildSeo({
      title,
      description,
      canonical,
      keywords: [
        "villa berastagi",
        "hotel berastagi",
        "penginapan berastagi",
        "tempat menginap di berastagi"
      ],
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Villa & Hotel", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Villa & Hotel", url: canonical }
        ])
      )
    })
  });
});

router.get("/villa/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const rawItem = db.prepare("SELECT * FROM villa WHERE slug = ?").get(req.params.slug);

  if (!rawItem) return res.redirect("/villa");

  const item = {
    ...rawItem,
    images: safeVillaImages(rawItem)
  };

  const ratings = getRatings("villa", item.id);
  const comments = getComments("villa", item.id);
  const related = db
    .prepare("SELECT * FROM villa WHERE id != ? ORDER BY id DESC LIMIT 4")
    .all(item.id)
    .map((rel) => ({
      ...rel,
      images: safeVillaImages(rel)
    }));

  const canonical = `${baseUrl}/villa/${item.slug}`;
  const title = item.meta_title || buildTitle(item.title, "Villa & Hotel di Berastagi");
  const description = buildDescription(
    safeDescription(item, `${item.title} adalah salah satu pilihan villa dan hotel di Berastagi yang bisa dipertimbangkan untuk liburan.`)
  );

  const lodgingSchema = lodgingBusinessSchema({
    baseUrl,
    url: canonical,
    name: item.title,
    description,
    image: safeImage(item)
  });

  const aggregateRating = buildAggregateRating(ratings);
  if (aggregateRating) {
    lodgingSchema.aggregateRating = aggregateRating;
  }

  renderPage(res, "villa-detail", {
    settings,
    item,
    comments,
    ratings,
    related,
    avg: avgRating(ratings),
    seo: buildSeo({
      title,
      description,
      canonical,
      type: "article",
      image: safeImage(item),
      keywords: [
        item.title,
        "villa berastagi",
        "hotel berastagi",
        "penginapan berastagi",
        "villa dan hotel di berastagi"
      ],
      section: "Villa",
      tags: [item.title, "Villa Berastagi", "Hotel Berastagi"],
      publishedTime: safeDate(item.created_at),
      modifiedTime: safeDate(item.updated_at || item.created_at),
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: safeImage(item),
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Villa & Hotel", url: `${baseUrl}/villa` },
            { name: item.title, url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Villa & Hotel", url: `${baseUrl}/villa` },
          { name: item.title, url: canonical }
        ]),
        lodgingSchema,
        articleSchema({
          baseUrl,
          url: canonical,
          title,
          description,
          image: safeImage(item),
          datePublished: safeDate(item.created_at),
          dateModified: safeDate(item.updated_at || item.created_at),
          authorName: settings?.site_name || "Wisata Berastagi",
          siteName: settings?.site_name || "Wisata Berastagi",
          keywords: [item.title, "villa berastagi", "hotel berastagi"]
        })
      )
    })
  });
});

router.post("/villa/:slug/comment", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM villa WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/villa");

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const comment = String(req.body.comment || "").trim();

  if (name && comment) {
    db.prepare(`
      INSERT INTO comments (item_type, item_id, name, email, comment, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run("villa", item.id, name, email, comment);
  }

  res.redirect(`/villa/${item.slug}#ulasan`);
});

router.post("/villa/:slug/rating", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM villa WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/villa");

  const name = String(req.body.name || "Pengunjung").trim();
  let rating = Number(req.body.rating || 0);

  if (rating < 1) rating = 1;
  if (rating > 5) rating = 5;

  db.prepare(`
    INSERT INTO ratings (item_type, item_id, name, rating)
    VALUES (?, ?, ?, ?)
  `).run("villa", item.id, name, rating);

  res.redirect(`/villa/${item.slug}#rating`);
});

/* =========================
   KULINER
========================= */
router.get("/kuliner", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const canonical = `${baseUrl}/kuliner`;
  const items = db.prepare("SELECT * FROM kuliner ORDER BY id DESC").all();

  const title = "Kuliner Berastagi Enak, Populer & Wajib Dicoba | Wisata Berastagi";
  const description =
    "Temukan rekomendasi kuliner Berastagi yang enak, populer, dan wajib dicoba saat liburan ke Berastagi, mulai dari makanan khas hingga tempat makan favorit.";

  renderPage(res, "kuliner-list", {
    settings,
    items,
    seo: buildSeo({
      title,
      description,
      canonical,
      keywords: [
        "kuliner berastagi",
        "makanan di berastagi",
        "tempat makan di berastagi",
        "kuliner karo",
        "makanan khas karo"
      ],
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Kuliner", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Kuliner", url: canonical }
        ])
      )
    })
  });
});

router.get("/kuliner/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const item = db.prepare("SELECT * FROM kuliner WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/kuliner");

  const ratings = getRatings("kuliner", item.id);
  const comments = getComments("kuliner", item.id);
  const related = db
    .prepare("SELECT * FROM kuliner WHERE id != ? ORDER BY id DESC LIMIT 4")
    .all(item.id);

  const canonical = `${baseUrl}/kuliner/${item.slug}`;
  const title = item.meta_title || buildTitle(item.title, "Kuliner Berastagi");
  const description = buildDescription(
    safeDescription(item, `${item.title} adalah salah satu rekomendasi kuliner Berastagi yang menarik untuk dicoba.`)
  );

  const restoSchema = restaurantSchema({
    baseUrl,
    url: canonical,
    name: item.title,
    description,
    image: safeImage(item)
  });

  const aggregateRating = buildAggregateRating(ratings);
  if (aggregateRating) {
    restoSchema.aggregateRating = aggregateRating;
  }

  renderPage(res, "kuliner-detail", {
    settings,
    item,
    comments,
    ratings,
    related,
    avg: avgRating(ratings),
    seo: buildSeo({
      title,
      description,
      canonical,
      type: "article",
      image: safeImage(item),
      keywords: [
        item.title,
        "kuliner berastagi",
        "makanan di berastagi",
        "tempat makan di berastagi",
        "kuliner karo"
      ],
      section: "Kuliner",
      tags: [item.title, "Kuliner Berastagi", "Makanan Karo"],
      publishedTime: safeDate(item.created_at),
      modifiedTime: safeDate(item.updated_at || item.created_at),
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: safeImage(item),
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Kuliner", url: `${baseUrl}/kuliner` },
            { name: item.title, url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Kuliner", url: `${baseUrl}/kuliner` },
          { name: item.title, url: canonical }
        ]),
        restoSchema,
        articleSchema({
          baseUrl,
          url: canonical,
          title,
          description,
          image: safeImage(item),
          datePublished: safeDate(item.created_at),
          dateModified: safeDate(item.updated_at || item.created_at),
          authorName: settings?.site_name || "Wisata Berastagi",
          siteName: settings?.site_name || "Wisata Berastagi",
          keywords: [item.title, "kuliner berastagi", "kuliner karo"]
        })
      )
    })
  });
});

router.post("/kuliner/:slug/comment", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM kuliner WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/kuliner");

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const comment = String(req.body.comment || "").trim();

  if (name && comment) {
    db.prepare(`
      INSERT INTO comments (item_type, item_id, name, email, comment, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run("kuliner", item.id, name, email, comment);
  }

  res.redirect(`/kuliner/${item.slug}#ulasan`);
});

router.post("/kuliner/:slug/rating", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM kuliner WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/kuliner");

  const name = String(req.body.name || "Pengunjung").trim();
  let rating = Number(req.body.rating || 0);

  if (rating < 1) rating = 1;
  if (rating > 5) rating = 5;

  db.prepare(`
    INSERT INTO ratings (item_type, item_id, name, rating)
    VALUES (?, ?, ?, ?)
  `).run("kuliner", item.id, name, rating);

  res.redirect(`/kuliner/${item.slug}#rating`);
});

/* =========================
   BERITA
========================= */
router.get("/berita", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const canonical = `${baseUrl}/berita`;

  const items = db
    .prepare(`
      SELECT *
      FROM articles
      ORDER BY COALESCE(published_at, created_at) DESC, id DESC
    `)
    .all();

  const title = "Berita Wisata Berastagi Terbaru Hari Ini | Wisata Berastagi";
  const description =
    "Baca berita wisata Berastagi terbaru seputar tempat wisata, villa, kuliner, event, suasana kota, dan tips liburan di Kabupaten Karo.";

  renderPage(res, "berita-list", {
    settings,
    items,
    seo: buildSeo({
      title,
      description,
      canonical,
      keywords: [
        "berita wisata berastagi",
        "berita berastagi",
        "info wisata berastagi",
        "kabar berastagi",
        "event berastagi"
      ],
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Berita", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Berita", url: canonical }
        ])
      )
    })
  });
});

router.get("/berita/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;

  const item = db
    .prepare("SELECT * FROM articles WHERE slug = ?")
    .get(req.params.slug);

  if (!item) return res.redirect("/berita");

  const comments = getComments("berita", item.id);
  const related = db
    .prepare(`
      SELECT *
      FROM articles
      WHERE id != ?
      ORDER BY COALESCE(published_at, created_at) DESC, id DESC
      LIMIT 4
    `)
    .all(item.id);

  const canonical = `${baseUrl}/berita/${item.slug}`;
  const title = item.meta_title || buildTitle(item.title, "Berita Wisata Berastagi");
  const description = buildDescription(
    safeDescription(item, `${item.title} adalah berita terbaru seputar wisata Berastagi, villa, kuliner, dan tips liburan.`)
  );

  renderPage(res, "berita-detail", {
    settings,
    item,
    comments,
    related,
    seo: buildSeo({
      title,
      description,
      canonical,
      type: "article",
      image: safeImage(item),
      keywords: [
        item.title,
        "berita wisata berastagi",
        "berita berastagi",
        "info berastagi"
      ],
      section: "Berita",
      tags: [item.title, "Berita Berastagi", "Wisata Berastagi"],
      publishedTime: safeDate(item.published_at || item.created_at),
      modifiedTime: safeDate(item.updated_at || item.created_at),
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: safeImage(item),
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Berita", url: `${baseUrl}/berita` },
            { name: item.title, url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Berita", url: `${baseUrl}/berita` },
          { name: item.title, url: canonical }
        ]),
        articleSchema({
          baseUrl,
          url: canonical,
          title,
          description,
          image: safeImage(item),
          datePublished: safeDate(item.published_at || item.created_at),
          dateModified: safeDate(item.updated_at || item.created_at),
          authorName: settings?.site_name || "Wisata Berastagi",
          siteName: settings?.site_name || "Wisata Berastagi",
          keywords: [item.title, "berita wisata berastagi", "berita berastagi"]
        }),
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: item.title,
          description,
          image: [absoluteUrl(baseUrl, safeImage(item))],
          mainEntityOfPage: canonical,
          datePublished: safeDate(item.published_at || item.created_at),
          dateModified: safeDate(item.updated_at || item.created_at),
          author: {
            "@type": "Organization",
            name: settings?.site_name || "Wisata Berastagi"
          },
          publisher: {
            "@type": "Organization",
            name: settings?.site_name || "Wisata Berastagi",
            logo: {
              "@type": "ImageObject",
              url: absoluteUrl(baseUrl, settings?.logo || settings?.hero_background || "/images/wisata-berastagi-cover.jpg")
            }
          }
        }
      )
    })
  });
});

router.post("/berita/:slug/comment", (req, res) => {
  const db = getDb();
  const item = db
    .prepare("SELECT * FROM articles WHERE slug = ?")
    .get(req.params.slug);

  if (!item) return res.redirect("/berita");

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const comment = String(req.body.comment || "").trim();

  if (name && comment) {
    db.prepare(`
      INSERT INTO comments (item_type, item_id, name, email, comment, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run("berita", item.id, name, email, comment);
  }

  res.redirect(`/berita/${item.slug}#ulasan`);
});

/* =========================
   BACKWARD COMPATIBILITY
========================= */
router.get("/artikel", (req, res) => {
  return res.redirect(301, "/berita");
});

router.get("/artikel/:slug", (req, res) => {
  return res.redirect(301, `/berita/${req.params.slug}`);
});

router.post("/artikel/:slug/comment", (req, res) => {
  return res.redirect(307, `/berita/${req.params.slug}/comment`);
});

/* =========================
   HALAMAN STATIS
========================= */
router.get("/about", (req, res) => {
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const canonical = `${baseUrl}/about`;

  const title = "Tentang Wisata Berastagi | Portal Wisata Berastagi";
  const description =
    "Tentang Wisata Berastagi, portal informasi wisata yang membahas tempat wisata, villa dan hotel, kuliner, berita terbaru, serta tips liburan di Berastagi.";

  renderPage(res, "about", {
    settings,
    path: "/about",
    pageTitle: "Tentang Wisata Berastagi",
    pageContent:
      "Wisata Berastagi adalah website panduan wisata yang fokus pada informasi tempat wisata, villa dan hotel, kuliner, berita terbaru, dan tips liburan terbaik di Berastagi.",
    seo: buildSeo({
      title,
      description,
      canonical,
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: settings?.hero_background || "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Tentang Kami", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Tentang Kami", url: canonical }
        ])
      )
    })
  });
});

router.get("/contact", (req, res) => {
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const canonical = `${baseUrl}/contact`;

  const title = "Kontak Wisata Berastagi | Hubungi Kami";
  const description =
    "Hubungi Wisata Berastagi untuk promosi, kerja sama, informasi wisata, villa dan hotel, kuliner, maupun pertanyaan lainnya.";

  renderPage(res, "contact", {
    settings,
    path: "/contact",
    seo: buildSeo({
      title,
      description,
      canonical,
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: settings?.hero_background || "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Kontak", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Kontak", url: canonical }
        ])
      )
    })
  });
});

router.get("/privacy-policy", (req, res) => {
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const canonical = `${baseUrl}/privacy-policy`;

  const title = "Kebijakan Privasi | Wisata Berastagi";
  const description =
    "Baca kebijakan privasi Wisata Berastagi mengenai penggunaan data, cookie, analitik, dan layanan pihak ketiga seperti Google AdSense.";

  renderPage(res, "privacy", {
    settings,
    path: "/privacy-policy",
    seo: buildSeo({
      title,
      description,
      canonical,
      noindex: false,
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: settings?.hero_background || "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Kebijakan Privasi", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Kebijakan Privasi", url: canonical }
        ])
      )
    })
  });
});

router.get("/disclaimer", (req, res) => {
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const canonical = `${baseUrl}/disclaimer`;

  const title = "Disclaimer | Wisata Berastagi";
  const description =
    "Baca disclaimer Wisata Berastagi terkait informasi, ulasan, akurasi data, dan tanggung jawab penggunaan konten di website ini.";

  renderPage(res, "disclaimer", {
    settings,
    path: "/disclaimer",
    seo: buildSeo({
      title,
      description,
      canonical,
      noindex: false,
      jsonLd: makeJsonLdGraph(
        ...buildCommonSchemas(baseUrl, settings, {
          baseUrl,
          url: canonical,
          title,
          description,
          image: settings?.hero_background || "/images/wisata-berastagi-cover.jpg",
          breadcrumbItems: [
            { name: "Beranda", url: `${baseUrl}/` },
            { name: "Disclaimer", url: canonical }
          ]
        }),
        breadcrumbSchema([
          { name: "Beranda", url: `${baseUrl}/` },
          { name: "Disclaimer", url: canonical }
        ])
      )
    })
  });
});

/* =========================
   REDIRECT ROUTE LAMA
========================= */
router.get("/tentang", (req, res) => {
  return res.redirect(301, "/about");
});

router.get("/kontak", (req, res) => {
  return res.redirect(301, "/contact");
});

/* =========================
   SEARCH
========================= */
router.get("/cari", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const baseUrl = res.locals.baseUrl;
  const q = String(req.query.q || "").trim();

  let wisata = [];
  let villa = [];
  let kuliner = [];
  let berita = [];

  if (q) {
    const like = `%${q}%`;

    wisata = db
      .prepare("SELECT * FROM wisata WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC")
      .all(like, like);

    villa = db
      .prepare("SELECT * FROM villa WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC")
      .all(like, like)
      .map((item) => ({
        ...item,
        images: safeVillaImages(item)
      }));

    kuliner = db
      .prepare("SELECT * FROM kuliner WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC")
      .all(like, like);

    berita = db
      .prepare(`
        SELECT *
        FROM articles
        WHERE title LIKE ? OR content LIKE ?
        ORDER BY COALESCE(published_at, created_at) DESC, id DESC
      `)
      .all(like, like);
  }

  renderPage(res, "search", {
    settings,
    q,
    wisata,
    villa,
    kuliner,
    berita,
    seo: buildSeo({
      title: q ? `Hasil Pencarian "${q}" | Wisata Berastagi` : "Pencarian | Wisata Berastagi",
      description: q
        ? `Hasil pencarian untuk ${q} di Wisata Berastagi.`
        : "Cari tempat wisata, villa, kuliner, dan berita di Wisata Berastagi.",
      canonical: `${baseUrl}/cari${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      noindex: true
    })
  });
});

/* =========================
   SITEMAP
========================= */
router.get("/sitemap.xml", (req, res) => {
  const db = getDb();
  const baseUrl = res.locals.baseUrl;
  const now = new Date().toISOString();

  const wisata = db.prepare("SELECT slug, updated_at, created_at FROM wisata").all();
  const villa = db.prepare("SELECT slug, updated_at, created_at FROM villa").all();
  const kuliner = db.prepare("SELECT slug, updated_at, created_at FROM kuliner").all();
  const berita = db
    .prepare("SELECT slug, updated_at, created_at, published_at FROM articles")
    .all();

  const urls = [
    { loc: `${baseUrl}/`, lastmod: now },
    { loc: `${baseUrl}/wisata`, lastmod: now },
    { loc: `${baseUrl}/villa`, lastmod: now },
    { loc: `${baseUrl}/kuliner`, lastmod: now },
    { loc: `${baseUrl}/berita`, lastmod: now },
    { loc: `${baseUrl}/galeri`, lastmod: now },
    { loc: `${baseUrl}/about`, lastmod: now },
    { loc: `${baseUrl}/contact`, lastmod: now },
    { loc: `${baseUrl}/privacy-policy`, lastmod: now },
    { loc: `${baseUrl}/disclaimer`, lastmod: now },

    ...wisata.map((item) => ({
      loc: `${baseUrl}/wisata/${item.slug}`,
      lastmod: item.updated_at || item.created_at || now
    })),

    ...villa.map((item) => ({
      loc: `${baseUrl}/villa/${item.slug}`,
      lastmod: item.updated_at || item.created_at || now
    })),

    ...kuliner.map((item) => ({
      loc: `${baseUrl}/kuliner/${item.slug}`,
      lastmod: item.updated_at || item.created_at || now
    })),

    ...berita.map((item) => ({
      loc: `${baseUrl}/berita/${item.slug}`,
      lastmod: item.updated_at || item.published_at || item.created_at || now
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${safeDate(url.lastmod)}</lastmod>
  </url>`
  )
  .join("")}
</urlset>`;

  res.type("application/xml").send(xml);
});

module.exports = router;
