const express = require("express");
const router = express.Router();

const { getDb } = require("../lib/db");
const { buildSeo, breadcrumbSchema, localBusinessSchema } = require("../lib/seo");
const { excerpt, avgRating, formatCurrency } = require("../lib/helpers");

function getSettings() {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get();
}

function getRatings(itemType, itemId) {
  return getDb()
    .prepare("SELECT * FROM ratings WHERE item_type = ? AND item_id = ? ORDER BY created_at DESC")
    .all(itemType, itemId);
}

function getComments(itemType, itemId, status = "approved") {
  return getDb()
    .prepare("SELECT * FROM comments WHERE item_type = ? AND item_id = ? AND status = ? ORDER BY created_at DESC")
    .all(itemType, itemId, status);
}

router.get("/", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const featuredWisata = db.prepare("SELECT * FROM wisata WHERE is_featured = 1 ORDER BY id DESC LIMIT 6").all();
  const featuredVilla = db.prepare("SELECT * FROM villa WHERE is_featured = 1 ORDER BY id DESC LIMIT 6").all();
  const latestArticles = db.prepare("SELECT * FROM articles ORDER BY id DESC LIMIT 6").all();

  res.render("home", {
    settings,
    featuredWisata,
    featuredVilla,
    latestArticles,
    seo: buildSeo({
      title: settings.homepage_title,
      description: settings.homepage_meta_description,
      canonical: `${res.locals.baseUrl}/`,
      jsonLd: JSON.stringify([
        localBusinessSchema(res.locals.baseUrl, settings),
        breadcrumbSchema([{ name: "Home", url: `${res.locals.baseUrl}/` }])
      ])
    }),
    helpers: { formatCurrency }
  });
});

router.get("/wisata", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const items = db.prepare("SELECT * FROM wisata ORDER BY id DESC").all();

  res.render("wisata-list", {
    settings,
    items,
    seo: buildSeo({
      title: "Tempat Wisata Berastagi Terbaru | Wisata Berastagi",
      description: "Daftar tempat wisata Berastagi terbaru, populer, dan cocok untuk liburan keluarga.",
      canonical: `${res.locals.baseUrl}/wisata`,
      jsonLd: JSON.stringify(
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Wisata", url: `${res.locals.baseUrl}/wisata` }
        ])
      )
    })
  });
});

router.get("/wisata/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const item = db.prepare("SELECT * FROM wisata WHERE slug = ?").get(req.params.slug);
  if (!item) return res.redirect("/wisata");

  const ratings = getRatings("wisata", item.id);
  const comments = getComments("wisata", item.id);
  const related = db.prepare("SELECT * FROM wisata WHERE id != ? ORDER BY id DESC LIMIT 4").all(item.id);

  res.render("wisata-detail", {
    settings,
    item,
    comments,
    ratings,
    related,
    avg: avgRating(ratings),
    seo: buildSeo({
      title: item.meta_title || `${item.title} | Wisata Berastagi`,
      description: item.meta_description || excerpt(item.content, 150),
      canonical: `${res.locals.baseUrl}/wisata/${item.slug}`,
      type: "article",
      image: item.image,
      jsonLd: JSON.stringify([
        breadcrumbSchema([
          { name: "Home", url: `${res.locals.baseUrl}/` },
          { name: "Wisata", url: `${res.locals.baseUrl}/wisata` },
          { name: item.title, url: `${res.locals.baseUrl}/wisata/${item.slug}` }
        ]),
        {
          "@context": "https://schema.org",
          "@type": "TouristAttraction",
          name: item.title,
          description: item.meta_description || excerpt(item.content, 150),
          image: item.image,
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

  db.prepare("INSERT INTO ratings (item_type, item_id, name, rating) VALUES (?, ?, ?, ?)")
    .run("wisata", item.id, name, rating);

  res.redirect(`/wisata/${item.slug}#rating`);
});

router.get("/villa", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const items = db.prepare("SELECT * FROM villa ORDER BY id DESC").all();

  res.render("villa-list", {
    settings,
    items,
    seo: buildSeo({
      title: "Villa Berastagi Murah dan Nyaman | Wisata Berastagi",
      description: "Rekomendasi villa Berastagi murah, nyaman, dan cocok untuk keluarga atau rombongan.",
      canonical: `${res.locals.baseUrl}/villa`
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
  const related = db.prepare("SELECT * FROM villa WHERE id != ? ORDER BY id DESC LIMIT 4").all(item.id);

  res.render("villa-detail", {
    settings,
    item,
    comments,
    ratings,
    related,
    avg: avgRating(ratings),
    seo: buildSeo({
      title: item.meta_title || `${item.title} | Villa Berastagi`,
      description: item.meta_description || excerpt(item.content, 150),
      canonical: `${res.locals.baseUrl}/villa/${item.slug}`,
      type: "article",
      image: item.image
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

  db.prepare("INSERT INTO ratings (item_type, item_id, name, rating) VALUES (?, ?, ?, ?)")
    .run("villa", item.id, name, rating);

  res.redirect(`/villa/${item.slug}#rating`);
});

router.get("/artikel", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const items = db.prepare("SELECT * FROM articles ORDER BY id DESC").all();

  res.render("article-list", {
    settings,
    items,
    seo: buildSeo({
      title: "Artikel Wisata Berastagi Terbaru | Wisata Berastagi",
      description: "Baca artikel wisata Berastagi terbaru seputar tempat wisata, villa, kuliner, dan tips liburan.",
      canonical: `${res.locals.baseUrl}/artikel`
    })
  });
});

router.get("/artikel/:slug", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const item = db.prepare("SELECT * FROM articles WHERE slug = ?").get(req.params.slug);
  if (!item) return res.redirect("/artikel");

  const comments = getComments("artikel", item.id);
  const related = db.prepare("SELECT * FROM articles WHERE id != ? ORDER BY id DESC LIMIT 4").all(item.id);

  res.render("article-detail", {
    settings,
    item,
    comments,
    related,
    seo: buildSeo({
      title: item.meta_title || `${item.title} | Wisata Berastagi`,
      description: item.meta_description || excerpt(item.content, 150),
      canonical: `${res.locals.baseUrl}/artikel/${item.slug}`,
      type: "article",
      image: item.image
    })
  });
});

router.post("/artikel/:slug/comment", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM articles WHERE slug = ?").get(req.params.slug);
  if (!item) return res.redirect("/artikel");

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const comment = String(req.body.comment || "").trim();

  if (name && comment) {
    db.prepare(`
      INSERT INTO comments (item_type, item_id, name, email, comment, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run("artikel", item.id, name, email, comment);
  }

  res.redirect(`/artikel/${item.slug}#ulasan`);
});

router.get("/tentang", (req, res) => {
  const settings = getSettings();
  res.render("about", {
    settings,
    seo: buildSeo({
      title: "Tentang Kami | Wisata Berastagi",
      description: "Tentang Wisata Berastagi, website panduan wisata Berastagi yang informatif dan ramah pengunjung.",
      canonical: `${res.locals.baseUrl}/tentang`
    }),
    pageTitle: "Tentang Wisata Berastagi",
    pageContent: "Wisata Berastagi adalah website panduan wisata yang fokus pada informasi tempat wisata, villa, kuliner, dan tips liburan terbaik di Berastagi."
  });
});

router.get("/kontak", (req, res) => {
  const settings = getSettings();
  res.render("contact", {
    settings,
    seo: buildSeo({
      title: "Kontak Kami | Wisata Berastagi",
      description: "Hubungi Wisata Berastagi melalui nomor telepon, email, atau alamat yang tersedia.",
      canonical: `${res.locals.baseUrl}/kontak`
    })
  });
});

router.get("/cari", (req, res) => {
  const db = getDb();
  const settings = getSettings();
  const q = String(req.query.q || "").trim();

  let wisata = [];
  let villa = [];
  let articles = [];

  if (q) {
    const like = `%${q}%`;
    wisata = db.prepare("SELECT * FROM wisata WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC").all(like, like);
    villa = db.prepare("SELECT * FROM villa WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC").all(like, like);
    articles = db.prepare("SELECT * FROM articles WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC").all(like, like);
  }

  res.render("search", {
    settings,
    q,
    wisata,
    villa,
    articles,
    seo: buildSeo({
      title: q ? `Hasil Pencarian "${q}" | Wisata Berastagi` : "Pencarian | Wisata Berastagi",
      description: q ? `Hasil pencarian untuk ${q} di Wisata Berastagi.` : "Cari tempat wisata, villa, dan artikel di Wisata Berastagi.",
      canonical: `${res.locals.baseUrl}/cari${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      noindex: true
    })
  });
});

router.get("/sitemap.xml", (req, res) => {
  const db = getDb();
  const wisata = db.prepare("SELECT slug, updated_at FROM wisata").all();
  const villa = db.prepare("SELECT slug, updated_at FROM villa").all();
  const articles = db.prepare("SELECT slug, updated_at FROM articles").all();

  const urls = [
    { loc: `${res.locals.baseUrl}/`, lastmod: new Date().toISOString() },
    { loc: `${res.locals.baseUrl}/wisata`, lastmod: new Date().toISOString() },
    { loc: `${res.locals.baseUrl}/villa`, lastmod: new Date().toISOString() },
    { loc: `${res.locals.baseUrl}/artikel`, lastmod: new Date().toISOString() },
    { loc: `${res.locals.baseUrl}/tentang`, lastmod: new Date().toISOString() },
    { loc: `${res.locals.baseUrl}/kontak`, lastmod: new Date().toISOString() },
    ...wisata.map(item => ({ loc: `${res.locals.baseUrl}/wisata/${item.slug}`, lastmod: item.updated_at })),
    ...villa.map(item => ({ loc: `${res.locals.baseUrl}/villa/${item.slug}`, lastmod: item.updated_at })),
    ...articles.map(item => ({ loc: `${res.locals.baseUrl}/artikel/${item.slug}`, lastmod: item.updated_at }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.map(url => `
      <url>
        <loc>${url.loc}</loc>
        <lastmod>${new Date(url.lastmod).toISOString()}</lastmod>
      </url>
    `).join("")}
  </urlset>`;

  res.type("application/xml").send(xml);
});

module.exports = router;
