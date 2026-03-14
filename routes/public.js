const express = require("express");
const router = express.Router();

const { getDb } = require("../lib/db");
const {
  buildSeo,
  breadcrumbSchema,
  localBusinessSchema,
  websiteSchema
} = require("../lib/seo");
const { excerpt, avgRating, formatCurrency } = require("../lib/helpers");

function getSettings() {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get();
}

function getRatings(itemType, itemId) {
  return getDb()
    .prepare(`
      SELECT * FROM ratings
      WHERE item_type = ? AND item_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(itemType, itemId);
}

function getComments(itemType, itemId, status = "approved") {
  return getDb()
    .prepare(`
      SELECT * FROM comments
      WHERE item_type = ? AND item_id = ? AND status = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(itemType, itemId, status);
}

/* =========================
   HOME
========================= */
router.get("/", (req, res) => {
  const db = getDb();
  const settings = getSettings();

  const featuredWisata = db
    .prepare("SELECT * FROM wisata WHERE is_featured = 1 ORDER BY id DESC LIMIT 6")
    .all();

  const featuredVilla = db
    .prepare("SELECT * FROM villa WHERE is_featured = 1 ORDER BY id DESC LIMIT 6")
    .all();

  const latestKuliner = db
    .prepare("SELECT * FROM kuliner ORDER BY id DESC LIMIT 6")
    .all();

  // tetap pakai tabel articles, tapi route publiknya /berita
  const latestBerita = db
    .prepare("SELECT * FROM articles ORDER BY id DESC LIMIT 6")
    .all();

  res.render("home", {
    settings,
    featuredWisata,
    featuredVilla,
    latestKuliner,
    latestBerita,
    seo: buildSeo({
      title:
        settings?.homepage_title ||
        "Wisata Berastagi Terlengkap 2026 | Tempat Wisata, Vila, Kuliner & Berita",
      description:
        settings?.homepage_meta_description ||
        "Temukan panduan lengkap wisata Berastagi: tempat wisata populer, vila dan hotel, kuliner favorit, berita terbaru, serta tips liburan terbaik di Berastagi, Sumatera Utara.",
      canonical: `${res.locals.baseUrl}/`,
      jsonLd: JSON.stringify([
        websiteSchema(res.locals.baseUrl),
        localBusinessSchema(res.locals.baseUrl, settings),
        breadcrumbSchema([{ name: "Home", url: `${res.locals.baseUrl}/` }])
      ])
    }),
    helpers: { formatCurrency }
  });
});

/* =========================
   WISATA
========================= */
router.get("/wisata", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const items = db.prepare("SELECT * FROM wisata ORDER BY id DESC").all();

  res.render("wisata-list", {
    settings,
    items,
    seo: buildSeo({
      title: "Tempat Wisata di Berastagi Terbaru | Wisata Berastagi",
      description:
        "Temukan tempat wisata di Berastagi yang populer, menarik, dan cocok untuk keluarga, pasangan, maupun rombongan liburan.",
      canonical: `${res.locals.baseUrl}/wisata`,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Tempat Wisata", url: `${res.locals.baseUrl}/wisata` }
        ])
      ])
    }),
    helpers: { formatCurrency }
  });
});

router.get("/wisata/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const item = db.prepare("SELECT * FROM wisata WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/wisata");

  const ratings = getRatings("wisata", item.id);
  const comments = getComments("wisata", item.id);
  const related = db
    .prepare("SELECT * FROM wisata WHERE id != ? ORDER BY id DESC LIMIT 4")
    .all(item.id);

  res.render("wisata-detail", {
    settings,
    item,
    comments,
    ratings,
    related,
    avg: avgRating(ratings),
    seo: buildSeo({
      title: item.meta_title || `${item.title} | Wisata Berastagi`,
      description:
        item.meta_description ||
        excerpt(item.content, 155) ||
        `${item.title} adalah salah satu tempat wisata di Berastagi yang menarik untuk dikunjungi.`,
      canonical: `${res.locals.baseUrl}/wisata/${item.slug}`,
      type: "article",
      image: item.image,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Tempat Wisata", url: `${res.locals.baseUrl}/wisata` },
          { name: item.title, url: `${res.locals.baseUrl}/wisata/${item.slug}` }
        ]),
        {
          "@context": "https://schema.org",
          "@type": "TouristAttraction",
          name: item.title,
          description: item.meta_description || excerpt(item.content, 155),
          image: item.image,
          url: `${res.locals.baseUrl}/wisata/${item.slug}`,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Berastagi",
            addressRegion: "Sumatera Utara",
            addressCountry: "ID"
          },
          aggregateRating: ratings.length
            ? {
                "@type": "AggregateRating",
                ratingValue: avgRating(ratings),
                reviewCount: ratings.length
              }
            : undefined
        }
      ].filter(Boolean))
    }),
    helpers: { formatCurrency }
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
  const items = db.prepare("SELECT * FROM villa ORDER BY id DESC").all();

  res.render("villa-list", {
    settings,
    items,
    seo: buildSeo({
      title: "Vila dan Hotel di Berastagi | Wisata Berastagi",
      description:
        "Temukan rekomendasi vila dan hotel di Berastagi yang nyaman, bersih, dan cocok untuk keluarga, pasangan, maupun rombongan.",
      canonical: `${res.locals.baseUrl}/villa`,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Vila & Hotel", url: `${res.locals.baseUrl}/villa` }
        ])
      ])
    }),
    helpers: { formatCurrency }
  });
});

router.get("/villa/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const item = db.prepare("SELECT * FROM villa WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/villa");

  const ratings = getRatings("villa", item.id);
  const comments = getComments("villa", item.id);
  const related = db
    .prepare("SELECT * FROM villa WHERE id != ? ORDER BY id DESC LIMIT 4")
    .all(item.id);

  res.render("villa-detail", {
    settings,
    item,
    comments,
    ratings,
    related,
    avg: avgRating(ratings),
    seo: buildSeo({
      title: item.meta_title || `${item.title} | Vila & Hotel di Berastagi`,
      description:
        item.meta_description ||
        excerpt(item.content, 155) ||
        `${item.title} adalah salah satu pilihan vila dan hotel di Berastagi yang bisa dipertimbangkan untuk liburan.`,
      canonical: `${res.locals.baseUrl}/villa/${item.slug}`,
      type: "article",
      image: item.image,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Vila & Hotel", url: `${res.locals.baseUrl}/villa` },
          { name: item.title, url: `${res.locals.baseUrl}/villa/${item.slug}` }
        ]),
        {
          "@context": "https://schema.org",
          "@type": "LodgingBusiness",
          name: item.title,
          description: item.meta_description || excerpt(item.content, 155),
          image: item.image,
          url: `${res.locals.baseUrl}/villa/${item.slug}`,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Berastagi",
            addressRegion: "Sumatera Utara",
            addressCountry: "ID"
          },
          aggregateRating: ratings.length
            ? {
                "@type": "AggregateRating",
                ratingValue: avgRating(ratings),
                reviewCount: ratings.length
              }
            : undefined
        }
      ].filter(Boolean))
    }),
    helpers: { formatCurrency }
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
  const items = db.prepare("SELECT * FROM kuliner ORDER BY id DESC").all();

  res.render("kuliner-list", {
    settings,
    items,
    seo: buildSeo({
      title: "Kuliner Berastagi Terbaru & Terfavorit | Wisata Berastagi",
      description:
        "Temukan rekomendasi kuliner Berastagi yang enak, populer, viral, dan wajib dicoba saat liburan ke Berastagi.",
      canonical: `${res.locals.baseUrl}/kuliner`,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Kuliner", url: `${res.locals.baseUrl}/kuliner` }
        ])
      ])
    }),
    helpers: { formatCurrency }
  });
});

router.get("/kuliner/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const item = db.prepare("SELECT * FROM kuliner WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/kuliner");

  const ratings = getRatings("kuliner", item.id);
  const comments = getComments("kuliner", item.id);
  const related = db
    .prepare("SELECT * FROM kuliner WHERE id != ? ORDER BY id DESC LIMIT 4")
    .all(item.id);

  res.render("kuliner-detail", {
    settings,
    item,
    comments,
    ratings,
    related,
    avg: avgRating(ratings),
    seo: buildSeo({
      title: item.meta_title || `${item.title} | Kuliner Berastagi`,
      description:
        item.meta_description ||
        excerpt(item.content, 155) ||
        `${item.title} adalah salah satu rekomendasi kuliner Berastagi yang menarik untuk dicoba.`,
      canonical: `${res.locals.baseUrl}/kuliner/${item.slug}`,
      type: "article",
      image: item.image,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Kuliner", url: `${res.locals.baseUrl}/kuliner` },
          { name: item.title, url: `${res.locals.baseUrl}/kuliner/${item.slug}` }
        ]),
        {
          "@context": "https://schema.org",
          "@type": "Restaurant",
          name: item.title,
          description: item.meta_description || excerpt(item.content, 155),
          image: item.image,
          url: `${res.locals.baseUrl}/kuliner/${item.slug}`,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Berastagi",
            addressRegion: "Sumatera Utara",
            addressCountry: "ID"
          },
          aggregateRating: ratings.length
            ? {
                "@type": "AggregateRating",
                ratingValue: avgRating(ratings),
                reviewCount: ratings.length
              }
            : undefined
        }
      ].filter(Boolean))
    }),
    helpers: { formatCurrency }
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
   BERITA (pakai tabel articles)
========================= */
router.get("/berita", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const items = db.prepare("SELECT * FROM articles ORDER BY id DESC").all();

  res.render("berita-list", {
    settings,
    items,
    seo: buildSeo({
      title: "Berita Wisata Berastagi Terbaru | Wisata Berastagi",
      description:
        "Baca berita wisata Berastagi terbaru seputar tempat wisata, villa, kuliner, event, dan tips liburan.",
      canonical: `${res.locals.baseUrl}/berita`,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Berita", url: `${res.locals.baseUrl}/berita` }
        ])
      ])
    })
  });
});

router.get("/berita/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const item = db.prepare("SELECT * FROM articles WHERE slug = ?").get(req.params.slug);

  if (!item) return res.redirect("/berita");

  const comments = getComments("berita", item.id);
  const related = db
    .prepare("SELECT * FROM articles WHERE id != ? ORDER BY id DESC LIMIT 4")
    .all(item.id);

  res.render("berita-detail", {
    settings,
    item,
    comments,
    related,
    seo: buildSeo({
      title: item.meta_title || `${item.title} | Berita Wisata Berastagi`,
      description:
        item.meta_description ||
        excerpt(item.content, 155) ||
        `${item.title} adalah berita terbaru seputar wisata Berastagi, villa, kuliner, dan tips liburan.`,
      canonical: `${res.locals.baseUrl}/berita/${item.slug}`,
      type: "article",
      image: item.image,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Berita", url: `${res.locals.baseUrl}/berita` },
          { name: item.title, url: `${res.locals.baseUrl}/berita/${item.slug}` }
        ]),
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: item.title,
          description: item.meta_description || excerpt(item.content, 155),
          image: item.image,
          mainEntityOfPage: `${res.locals.baseUrl}/berita/${item.slug}`,
          author: {
            "@type": "Organization",
            name: "Wisata Berastagi"
          },
          publisher: {
            "@type": "Organization",
            name: "Wisata Berastagi"
          },
          datePublished: item.created_at || new Date().toISOString(),
          dateModified: item.updated_at || item.created_at || new Date().toISOString()
        }
      ])
    })
  });
});

router.post("/berita/:slug/comment", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM articles WHERE slug = ?").get(req.params.slug);

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
   HALAMAN STATIS
========================= */
router.get("/tentang", (req, res) => {
  const settings = getSettings();

  res.render("about", {
    settings,
    seo: buildSeo({
      title: "Tentang Kami | Wisata Berastagi",
      description:
        "Tentang Wisata Berastagi, website panduan wisata Berastagi yang membahas tempat wisata, villa dan hotel, kuliner, berita, serta tips liburan.",
      canonical: `${res.locals.baseUrl}/tentang`,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Tentang", url: `${res.locals.baseUrl}/tentang` }
        ])
      ])
    }),
    pageTitle: "Tentang Wisata Berastagi",
    pageContent:
      "Wisata Berastagi adalah website panduan wisata yang fokus pada informasi tempat wisata, villa dan hotel, kuliner, berita terbaru, dan tips liburan terbaik di Berastagi."
  });
});

router.get("/kontak", (req, res) => {
  const settings = getSettings();

  res.render("contact", {
    settings,
    seo: buildSeo({
      title: "Kontak Kami | Wisata Berastagi",
      description:
        "Hubungi Wisata Berastagi untuk promosi, kerja sama, informasi wisata, villa dan hotel, kuliner, maupun pertanyaan lainnya.",
      canonical: `${res.locals.baseUrl}/kontak`,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Kontak", url: `${res.locals.baseUrl}/kontak` }
        ])
      ])
    })
  });
});

/* =========================
   SEARCH
========================= */
router.get("/cari", (req, res) => {
  const db = getDb();
  const settings = getSettings();
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
      .all(like, like);

    kuliner = db
      .prepare("SELECT * FROM kuliner WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC")
      .all(like, like);

    berita = db
      .prepare("SELECT * FROM articles WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC")
      .all(like, like);
  }

  res.render("search", {
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
      canonical: `${res.locals.baseUrl}/cari${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      noindex: true
    })
  });
});

/* =========================
   SITEMAP
========================= */
router.get("/sitemap.xml", (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();

  const wisata = db.prepare("SELECT slug, updated_at FROM wisata").all();
  const villa = db.prepare("SELECT slug, updated_at FROM villa").all();
  const kuliner = db.prepare("SELECT slug, updated_at FROM kuliner").all();
  const berita = db.prepare("SELECT slug, updated_at FROM articles").all();

  const urls = [
    { loc: `${res.locals.baseUrl}/`, lastmod: now },
    { loc: `${res.locals.baseUrl}/wisata`, lastmod: now },
    { loc: `${res.locals.baseUrl}/villa`, lastmod: now },
    { loc: `${res.locals.baseUrl}/kuliner`, lastmod: now },
    { loc: `${res.locals.baseUrl}/berita`, lastmod: now },
    { loc: `${res.locals.baseUrl}/tentang`, lastmod: now },
    { loc: `${res.locals.baseUrl}/kontak`, lastmod: now },

    ...wisata.map((item) => ({
      loc: `${res.locals.baseUrl}/wisata/${item.slug}`,
      lastmod: item.updated_at || now
    })),

    ...villa.map((item) => ({
      loc: `${res.locals.baseUrl}/villa/${item.slug}`,
      lastmod: item.updated_at || now
    })),

    ...kuliner.map((item) => ({
      loc: `${res.locals.baseUrl}/kuliner/${item.slug}`,
      lastmod: item.updated_at || now
    })),

    ...berita.map((item) => ({
      loc: `${res.locals.baseUrl}/berita/${item.slug}`,
      lastmod: item.updated_at || now
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${new Date(url.lastmod).toISOString()}</lastmod>
  </url>`
  )
  .join("")}
</urlset>`;

  res.type("application/xml").send(xml);
});

module.exports = router;
