const express = require("express");
const { getDb, hashPassword, verifyPassword } = require("../lib/db");
const { requireAdmin } = require("../middleware/auth");
const { makeSlug, excerpt, sanitizeHtml } = require("../lib/helpers");
const { buildSeo } = require("../lib/seo");

const router = express.Router();

const loginAttempts = new Map();

function cleanText(v) { return String(v || "").trim(); }
function cleanHtml(v) { return sanitizeHtml(String(v || "").trim()); }
function plainTextFromHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function boolToInt(v) { return v ? 1 : 0; }

function uniqueSlug(table, slug, id = null) {
  const db = getDb();
  let base = cleanText(slug) || `item-${Date.now()}`;
  let final = base;
  let i = 2;
  while (true) {
    const exists = id
      ? db.prepare(`SELECT id FROM ${table} WHERE slug=? AND id!=?`).get(final, id)
      : db.prepare(`SELECT id FROM ${table} WHERE slug=?`).get(final);
    if (!exists) return final;
    final = `${base}-${i++}`;
  }
}

function isValidImageUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseGallery(input) {
  if (!input) return [];
  let arr = [];
  if (Array.isArray(input)) arr = input;
  else if (typeof input === "string") {
    try { arr = JSON.parse(input); } catch { arr = input.split(/[\n,]/); }
  }
  return arr.map(u => cleanText(u)).filter(u => isValidImageUrl(u));
}

/* LOGIN */
router.get("/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin");
  res.render("login", {
    seo: buildSeo({ title: "Login Admin", noindex: true }),
    error: null
  });
});

router.post("/login", (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const attempts = loginAttempts.get(ip) || [];
  const now = Date.now();
  const recent = attempts.filter(t => now - t < 15 * 60 * 1000);
  if (recent.length >= 5) {
    return res.render("login", {
      seo: buildSeo({ title: "Login Admin", noindex: true }),
      error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
    });
  }
  const db = getDb();
  const username = cleanText(req.body.username);
  const password = req.body.password || "";
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);

  if (!user || !verifyPassword(password, user.password)) {
    recent.push(now);
    loginAttempts.set(ip, recent);
    return res.render("login", {
      seo: buildSeo({ title: "Login Admin", noindex: true }),
      error: "Username atau password salah"
    });
  }

  loginAttempts.delete(ip);
  req.session.regenerate((err) => {
    if (err) {
      console.error("Session regeneration failed:", err.message);
      return res.status(503).send("Login sementara tidak tersedia. Silakan coba lagi.");
    }
    req.session.isAdmin = true;
    req.session.userId = user.id;
    req.session.save((saveError) => {
      if (saveError) {
        console.error("Session persistence failed:", saveError.message);
        return res.status(503).send("Login sementara tidak tersedia. Silakan coba lagi.");
      }
      res.redirect("/admin");
    });
  });
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.use(requireAdmin);

/* DASHBOARD */
router.get("/", (req, res) => {
  const db = getDb();
  const stats = {
    wisata: db.prepare("SELECT COUNT(*) as total FROM wisata").get().total,
    villa: db.prepare("SELECT COUNT(*) as total FROM villa").get().total,
    kuliner: db.prepare("SELECT COUNT(*) as total FROM kuliner").get().total,
    berita: db.prepare("SELECT COUNT(*) as total FROM articles").get().total,
    gallery: db.prepare("SELECT COUNT(*) as total FROM gallery").get().total,
    comments: db.prepare("SELECT COUNT(*) as total FROM comments").get().total,
    pending: db.prepare("SELECT COUNT(*) as total FROM comments WHERE status='pending'").get().total
  };
  res.render("admin-dashboard", {
    seo: buildSeo({ title: "Dashboard", noindex: true }),
    stats
  });
});

/* WISATA */
router.get("/wisata", (req, res) => {
  const db = getDb();
  const items = db.prepare("SELECT * FROM wisata ORDER BY updated_at DESC, id DESC").all();
  res.render("admin-wisata", { seo: buildSeo({ title: "Kelola Wisata", noindex: true }), items });
});

router.get("/wisata/new", (req, res) => {
  res.render("admin-wisata-form", { seo: buildSeo({ title: "Tambah Wisata", noindex: true }), item: null, error: null });
});

router.get("/wisata/edit/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM wisata WHERE id=?").get(req.params.id);
  if (!item) return res.redirect("/admin/wisata");
  res.render("admin-wisata-form", { seo: buildSeo({ title: "Edit Wisata", noindex: true }), item, error: null });
});

router.post("/wisata/save", (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id || null;
    const title = cleanText(req.body.title);
    const content = sanitizeHtml(cleanHtml(req.body.content));
    if (!title || !plainTextFromHtml(content)) {
      return res.render("admin-wisata-form", { seo: buildSeo({ title: "Form Wisata", noindex: true }), item: req.body, error: "Judul & konten wajib" });
    }
    const image = cleanText(req.body.image);
    if (image && !isValidImageUrl(image)) {
      return res.render("admin-wisata-form", { seo: buildSeo({ title: "Form Wisata", noindex: true }), item: req.body, error: "URL gambar utama harus HTTPS valid" });
    }
    const gallery = parseGallery(req.body.images || req.body.gallery);
    const payload = {
      id,
      title,
      slug: uniqueSlug("wisata", makeSlug(req.body.slug || title), id),
      excerpt: excerpt(plainTextFromHtml(content), 150),
      content,
      image: image || null,
      images: JSON.stringify(gallery),
      location: cleanText(req.body.location),
      ticket_price: cleanText(req.body.ticket_price),
      open_hours: cleanText(req.body.open_hours),
      maps_url: cleanText(req.body.maps_url),
      meta_title: cleanText(req.body.meta_title || title),
      meta_description: cleanText(req.body.meta_description),
      is_featured: boolToInt(req.body.is_featured),
      status: cleanText(req.body.status) || "publish"
    };
    if (id) {
      db.prepare(`UPDATE wisata SET title=@title, slug=@slug, excerpt=@excerpt, content=@content, image=@image, images=@images, location=@location, ticket_price=@ticket_price, open_hours=@open_hours, maps_url=@maps_url, meta_title=@meta_title, meta_description=@meta_description, is_featured=@is_featured, status=@status, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run(payload);
    } else {
      db.prepare(`INSERT INTO wisata (title,slug,excerpt,content,image,images,location,ticket_price,open_hours,maps_url,meta_title,meta_description,is_featured,status) VALUES (@title,@slug,@excerpt,@content,@image,@images,@location,@ticket_price,@open_hours,@maps_url,@meta_title,@meta_description,@is_featured,@status)`).run(payload);
    }
    res.redirect("/admin/wisata");
  } catch (e) {
    res.render("admin-wisata-form", { seo: buildSeo({ title: "Form Wisata", noindex: true }), item: req.body, error: e.message });
  }
});

router.post("/wisata/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM wisata WHERE id=?").run(req.params.id);
  res.redirect("/admin/wisata");
});

/* VILLA - similar pattern */
router.get("/villa", (req, res) => {
  const items = getDb().prepare("SELECT * FROM villa ORDER BY updated_at DESC, id DESC").all();
  res.render("admin-villa", { seo: buildSeo({ title: "Kelola Villa", noindex: true }), items });
});

router.get("/villa/new", (req, res) => {
  res.render("admin-villa-form", { seo: buildSeo({ title: "Tambah Villa", noindex: true }), item: null });
});

router.get("/villa/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM villa WHERE id=?").get(req.params.id);
  if (!item) return res.redirect("/admin/villa");
  res.render("admin-villa-form", { seo: buildSeo({ title: "Edit Villa", noindex: true }), item });
});

router.post("/villa/save", (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id || null;
    const title = cleanText(req.body.title);
    const content = sanitizeHtml(cleanHtml(req.body.content));
    const image = cleanText(req.body.image);
    if (image && !isValidImageUrl(image)) {
      return res.render("admin-villa-form", { seo: buildSeo({ title: "Form Villa", noindex: true }), item: req.body, error: "URL gambar tidak valid" });
    }
    const gallery = parseGallery(req.body.images);
    const payload = {
      id, title,
      slug: uniqueSlug("villa", makeSlug(req.body.slug || title), id),
      excerpt: excerpt(plainTextFromHtml(content), 150),
      content,
      image: image || null,
      images: JSON.stringify(gallery),
      price: cleanText(req.body.price),
      location: cleanText(req.body.location),
      facilities: cleanText(req.body.facilities),
      capacity: cleanText(req.body.capacity),
      booking_url: cleanText(req.body.booking_url),
      contact_phone: cleanText(req.body.contact_phone),
      maps_url: cleanText(req.body.maps_url),
      meta_title: cleanText(req.body.meta_title || title),
      meta_description: cleanText(req.body.meta_description),
      is_featured: boolToInt(req.body.is_featured),
      status: cleanText(req.body.status) || "publish"
    };
    if (id) {
      db.prepare(`UPDATE villa SET title=@title,slug=@slug,excerpt=@excerpt,content=@content,image=@image,images=@images,price=@price,location=@location,facilities=@facilities,capacity=@capacity,booking_url=@booking_url,contact_phone=@contact_phone,maps_url=@maps_url,meta_title=@meta_title,meta_description=@meta_description,is_featured=@is_featured,status=@status,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run(payload);
    } else {
      db.prepare(`INSERT INTO villa (title,slug,excerpt,content,image,images,price,location,facilities,capacity,booking_url,contact_phone,maps_url,meta_title,meta_description,is_featured,status) VALUES (@title,@slug,@excerpt,@content,@image,@images,@price,@location,@facilities,@capacity,@booking_url,@contact_phone,@maps_url,@meta_title,@meta_description,@is_featured,@status)`).run(payload);
    }
    res.redirect("/admin/villa");
  } catch (e) {
    res.render("admin-villa-form", { seo: buildSeo({ title: "Form Villa", noindex: true }), item: req.body, error: e.message });
  }
});

router.post("/villa/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM villa WHERE id=?").run(req.params.id);
  res.redirect("/admin/villa");
});

/* KULINER */
router.get("/kuliner", (req, res) => {
  const items = getDb().prepare("SELECT * FROM kuliner ORDER BY updated_at DESC, id DESC").all();
  res.render("admin-kuliner", { seo: buildSeo({ title: "Kelola Kuliner", noindex: true }), items });
});

router.get("/kuliner/new", (req, res) => {
  res.render("admin-kuliner-form", { seo: buildSeo({ title: "Tambah Kuliner", noindex: true }), item: null });
});

router.get("/kuliner/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM kuliner WHERE id=?").get(req.params.id);
  if (!item) return res.redirect("/admin/kuliner");
  res.render("admin-kuliner-form", { seo: buildSeo({ title: "Edit Kuliner", noindex: true }), item });
});

router.post("/kuliner/save", (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id || null;
    const title = cleanText(req.body.title);
    const content = sanitizeHtml(cleanHtml(req.body.content));
    const image = cleanText(req.body.image);
    if (image && !isValidImageUrl(image)) {
      return res.render("admin-kuliner-form", { seo: buildSeo({ title: "Form Kuliner", noindex: true }), item: req.body, error: "URL gambar tidak valid" });
    }
    const gallery = parseGallery(req.body.images);
    const payload = {
      id, title,
      slug: uniqueSlug("kuliner", makeSlug(req.body.slug || title), id),
      excerpt: excerpt(plainTextFromHtml(content), 150),
      content,
      image: image || null,
      images: JSON.stringify(gallery),
      location: cleanText(req.body.location),
      price_range: cleanText(req.body.price_range),
      open_hours: cleanText(req.body.open_hours),
      contact_phone: cleanText(req.body.contact_phone),
      maps_url: cleanText(req.body.maps_url),
      meta_title: cleanText(req.body.meta_title || title),
      meta_description: cleanText(req.body.meta_description),
      is_featured: boolToInt(req.body.is_featured),
      status: cleanText(req.body.status) || "publish",
      category: cleanText(req.body.category)
    };
    if (id) {
      db.prepare(`UPDATE kuliner SET title=@title,slug=@slug,excerpt=@excerpt,content=@content,image=@image,images=@images,location=@location,price_range=@price_range,open_hours=@open_hours,contact_phone=@contact_phone,maps_url=@maps_url,meta_title=@meta_title,meta_description=@meta_description,is_featured=@is_featured,status=@status,category=@category,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run(payload);
    } else {
      db.prepare(`INSERT INTO kuliner (title,slug,excerpt,content,image,images,location,price_range,open_hours,contact_phone,maps_url,meta_title,meta_description,is_featured,status,category) VALUES (@title,@slug,@excerpt,@content,@image,@images,@location,@price_range,@open_hours,@contact_phone,@maps_url,@meta_title,@meta_description,@is_featured,@status,@category)`).run(payload);
    }
    res.redirect("/admin/kuliner");
  } catch (e) {
    res.render("admin-kuliner-form", { seo: buildSeo({ title: "Form Kuliner", noindex: true }), item: req.body, error: e.message });
  }
});

router.post("/kuliner/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM kuliner WHERE id=?").run(req.params.id);
  res.redirect("/admin/kuliner");
});

/* BERITA / ARTICLES */
router.get("/berita", (req, res) => {
  const items = getDb().prepare("SELECT * FROM articles ORDER BY updated_at DESC, id DESC").all();
  res.render("admin-articles", { seo: buildSeo({ title: "Kelola Berita", noindex: true }), items });
});

router.get("/berita/new", (req, res) => {
  res.render("admin-article-form", { seo: buildSeo({ title: "Tambah Berita", noindex: true }), item: null });
});

router.get("/berita/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM articles WHERE id=?").get(req.params.id);
  if (!item) return res.redirect("/admin/berita");
  res.render("admin-article-form", { seo: buildSeo({ title: "Edit Berita", noindex: true }), item });
});

router.post("/berita/save", (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id || null;
    const title = cleanText(req.body.title);
    const content = sanitizeHtml(cleanHtml(req.body.content));
    const image = cleanText(req.body.image);
    if (image && !isValidImageUrl(image)) {
      return res.render("admin-article-form", { seo: buildSeo({ title: "Form Berita", noindex: true }), item: req.body, error: "URL gambar tidak valid" });
    }
    const gallery = parseGallery(req.body.images);
    const status = cleanText(req.body.status) || "publish";
    const payload = {
      id, title,
      slug: uniqueSlug("articles", makeSlug(req.body.slug || title), id),
      excerpt: excerpt(plainTextFromHtml(content), 150),
      content,
      image: image || null,
      images: JSON.stringify(gallery),
      category: cleanText(req.body.category) || "berita",
      status,
      meta_title: cleanText(req.body.meta_title || title),
      meta_description: cleanText(req.body.meta_description),
      published_at: status === "publish" ? (req.body.published_at || new Date().toISOString()) : null
    };
    if (id) {
      db.prepare(`UPDATE articles SET title=@title,slug=@slug,excerpt=@excerpt,content=@content,image=@image,images=@images,category=@category,status=@status,meta_title=@meta_title,meta_description=@meta_description,published_at=@published_at,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run(payload);
    } else {
      db.prepare(`INSERT INTO articles (title,slug,excerpt,content,image,images,category,status,meta_title,meta_description,published_at) VALUES (@title,@slug,@excerpt,@content,@image,@images,@category,@status,@meta_title,@meta_description,@published_at)`).run(payload);
    }
    res.redirect("/admin/berita");
  } catch (e) {
    res.render("admin-article-form", { seo: buildSeo({ title: "Form Berita", noindex: true }), item: req.body, error: e.message });
  }
});

router.post("/berita/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM articles WHERE id=?").run(req.params.id);
  res.redirect("/admin/berita");
});

/* COMMENTS */
router.get("/comments", (req, res) => {
  const items = getDb().prepare("SELECT * FROM comments ORDER BY created_at DESC").all();
  res.render("admin-comments", { seo: buildSeo({ title: "Moderasi Komentar", noindex: true }), items });
});

router.post("/comments/approve/:id", (req, res) => {
  getDb().prepare("UPDATE comments SET status='approved' WHERE id=?").run(req.params.id);
  res.redirect("/admin/comments");
});

router.post("/comments/reject/:id", (req, res) => {
  getDb().prepare("UPDATE comments SET status='rejected' WHERE id=?").run(req.params.id);
  res.redirect("/admin/comments");
});

router.post("/comments/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM comments WHERE id=?").run(req.params.id);
  res.redirect("/admin/comments");
});

/* SETTINGS */
router.get("/settings", (req, res) => {
  const settings = getDb().prepare("SELECT * FROM settings WHERE id=1").get() || {};
  res.render("admin-settings", { seo: buildSeo({ title: "Pengaturan", noindex: true }), settings });
});

router.post("/settings/save", (req, res) => {
  const db = getDb();
  const s = {
    site_name: cleanText(req.body.site_name),
    site_tagline: cleanText(req.body.site_tagline),
    contact_phone: cleanText(req.body.contact_phone),
    contact_email: cleanText(req.body.contact_email),
    address: cleanText(req.body.address),
    footer_text: cleanText(req.body.footer_text),
    homepage_title: cleanText(req.body.homepage_title),
    homepage_meta_description: cleanText(req.body.homepage_meta_description),
    hero_title: cleanText(req.body.hero_title),
    hero_subtitle: cleanText(req.body.hero_subtitle),
    hero_background: cleanText(req.body.hero_background),
    logo: cleanText(req.body.logo),
    favicon: cleanText(req.body.favicon),
    whatsapp: cleanText(req.body.whatsapp),
    social_facebook: cleanText(req.body.social_facebook),
    social_instagram: cleanText(req.body.social_instagram),
    social_twitter: cleanText(req.body.social_twitter),
    google_analytics: cleanText(req.body.google_analytics)
  };
  db.prepare(`INSERT OR IGNORE INTO settings(id) VALUES (1)`).run();
  const result = db.prepare(`UPDATE settings SET site_name=@site_name, site_tagline=@site_tagline, contact_phone=@contact_phone, contact_email=@contact_email, address=@address, footer_text=@footer_text, homepage_title=@homepage_title, homepage_meta_description=@homepage_meta_description, hero_title=@hero_title, hero_subtitle=@hero_subtitle, hero_background=@hero_background, logo=@logo, favicon=@favicon, whatsapp=@whatsapp, social_facebook=@social_facebook, social_instagram=@social_instagram, social_twitter=@social_twitter, google_analytics=@google_analytics WHERE id=1`).run(s);
  if (result.changes !== 1) return res.status(500).send("Gagal menyimpan settings");
  res.redirect("/admin/settings");
});

/* GALLERY */
router.get("/gallery", (req, res) => {
  const items = getDb().prepare("SELECT * FROM gallery ORDER BY sort_order ASC, id DESC").all();
  res.render("admin-gallery", { seo: buildSeo({ title: "Kelola Galeri", noindex: true }), items, item: null });
});

router.get("/gallery/edit/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(404).send("Galeri tidak ditemukan");
  const db = getDb();
  const item = db.prepare("SELECT * FROM gallery WHERE id=?").get(id);
  if (!item) return res.status(404).send("Galeri tidak ditemukan");
  const items = db.prepare("SELECT * FROM gallery ORDER BY sort_order ASC, id DESC").all();
  res.render("admin-gallery", { seo: buildSeo({ title: "Edit Galeri", noindex: true }), items, item });
});

router.post("/gallery/save", (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) return res.status(400).send("ID galeri tidak valid");
  if (id !== null && !db.prepare("SELECT id FROM gallery WHERE id=?").get(id)) return res.status(404).send("Galeri tidak ditemukan");
  const image = cleanText(req.body.image);
  if (!isValidImageUrl(image)) {
    return res.redirect("/admin/gallery");
  }
  const payload = {
    id,
    title: cleanText(req.body.title),
    slug: uniqueSlug("gallery", makeSlug(req.body.slug || req.body.title || `galeri-${Date.now()}`), id),
    image,
    alt_text: cleanText(req.body.alt_text),
    caption: cleanText(req.body.caption),
    sort_order: Number(req.body.sort_order) || 0,
    is_active: boolToInt(req.body.is_active)
  };
  if (id) {
    db.prepare("UPDATE gallery SET title=@title, slug=@slug, image=@image, alt_text=@alt_text, caption=@caption, sort_order=@sort_order, is_active=@is_active, updated_at=CURRENT_TIMESTAMP WHERE id=@id").run(payload);
  } else {
    db.prepare("INSERT INTO gallery (title, slug, image, alt_text, caption, sort_order, is_active) VALUES (@title, @slug, @image, @alt_text, @caption, @sort_order, @is_active)").run(payload);
  }
  res.redirect("/admin/gallery");
});

router.post("/gallery/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM gallery WHERE id=?").run(req.params.id);
  res.redirect("/admin/gallery");
});

module.exports = router;
