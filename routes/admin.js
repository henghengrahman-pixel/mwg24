const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { getDb } = require("../lib/db");
const { makeSlug, excerpt } = require("../lib/helpers");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uploadsRoot = path.join(process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR) ? process.env.DATA_DIR : path.join(__dirname, "..", "data"), "uploads", "berita");
fs.mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const base = makeSlug(path.basename(file.originalname || `berita-${Date.now()}`, ext)) || `berita-${Date.now()}`;
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype || ""))
});

function normalizeImageInput(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("/images/") || raw.startsWith("/favicon/")) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function parseMultiUrls(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => normalizeImageInput(item))
    )
  );
}

function getSettings() {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get() || {};
}

function dashboardStats() {
  const db = getDb();
  return {
    wisata: db.prepare("SELECT COUNT(*) total FROM wisata").get().total,
    villa: db.prepare("SELECT COUNT(*) total FROM villa").get().total,
    kuliner: db.prepare("SELECT COUNT(*) total FROM kuliner").get().total,
    berita: db.prepare("SELECT COUNT(*) total FROM articles").get().total,
    gallery: db.prepare("SELECT COUNT(*) total FROM gallery").get().total,
    comments: db.prepare("SELECT COUNT(*) total FROM comments").get().total
  };
}

router.use((req, res, next) => {
  res.locals.settings = getSettings();
  next();
});

router.get("/login", (req, res) => {
  if (req.session?.isAdmin) return res.redirect("/admin");
  res.render("login", { error: "", seo: { title: "Login Admin | Wisata Berastagi", noindex: true } });
});

router.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();
  const user = getDb().prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
  if (!user) {
    return res.status(401).render("login", { error: "Username atau password salah.", seo: { title: "Login Admin | Wisata Berastagi", noindex: true } });
  }
  req.session.isAdmin = true;
  req.session.adminUsername = user.username;
  res.redirect("/admin");
});

router.use(requireAdmin);

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.get("/", (req, res) => {
  res.render("admin-dashboard", { stats: dashboardStats(), seo: { title: "Dashboard Admin | Wisata Berastagi", noindex: true } });
});

function listRoute(pathname, table, view) {
  router.get(pathname, (req, res) => {
    const items = getDb().prepare(`SELECT * FROM ${table} ORDER BY updated_at DESC, id DESC`).all();
    res.render(view, { items, seo: { title: `Admin ${table}`, noindex: true } });
  });
}
listRoute("/wisata", "wisata", "admin-wisata");
listRoute("/villa", "villa", "admin-villa");
listRoute("/kuliner", "kuliner", "admin-kuliner");
listRoute("/berita", "articles", "admin-articles");

router.get("/gallery", (req, res) => {
  const items = getDb().prepare("SELECT * FROM gallery ORDER BY sort_order ASC, updated_at DESC, id DESC").all();
  res.render("admin-gallery", { items, item: null, seo: { title: "Admin Gallery", noindex: true } });
});

function editRender(pathname, table, view, empty = {}) {
  router.get(`${pathname}/new`, (req, res) => res.render(view, { item: empty, error: "", items: [], seo: { noindex: true } }));
  router.get(`${pathname}/edit/:id`, (req, res) => {
    const item = getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!item) return res.redirect(pathname);
    res.render(view, { item, error: "", items: [], seo: { noindex: true } });
  });
}
editRender("/wisata", "wisata", "admin-wisata-form");
editRender("/villa", "villa", "admin-villa-form");
editRender("/kuliner", "kuliner", "admin-kuliner-form");
editRender("/berita", "articles", "admin-article-form");
router.get("/gallery/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM gallery WHERE id = ?").get(req.params.id);
  const items = getDb().prepare("SELECT * FROM gallery ORDER BY sort_order ASC, updated_at DESC, id DESC").all();
  res.render("admin-gallery", { items, item, error: "", seo: { noindex: true } });
});

router.post("/wisata/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = String(req.body.title || "").trim();
  const slug = makeSlug(req.body.slug || title);
  const data = {
    title,
    slug,
    excerpt: String(req.body.excerpt || "").trim() || excerpt(req.body.content || "", 155),
    content: String(req.body.content || "").trim(),
    image: normalizeImageInput(req.body.image_url, String(req.body.current_image || "").trim() || "/images/wisata-berastagi-cover.jpg"),
    location: String(req.body.location || "").trim(),
    ticket_price: String(req.body.ticket_price || "").trim(),
    open_hours: String(req.body.open_hours || "").trim(),
    maps_url: String(req.body.maps_url || "").trim(),
    meta_title: String(req.body.meta_title || "").trim() || `${title} | Tempat Wisata Berastagi`,
    meta_description: String(req.body.meta_description || "").trim() || excerpt(req.body.excerpt || req.body.content || "", 155),
    is_featured: Number(req.body.is_featured) === 1 ? 1 : 0
  };
  if (!title || !slug) return res.render("admin-wisata-form", { item: { ...req.body }, error: "Judul wajib diisi.", seo: { noindex: true } });
  if (id) {
    db.prepare(`UPDATE wisata SET title=@title, slug=@slug, excerpt=@excerpt, content=@content, image=@image, location=@location, ticket_price=@ticket_price, open_hours=@open_hours, maps_url=@maps_url, meta_title=@meta_title, meta_description=@meta_description, is_featured=@is_featured, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO wisata (title, slug, excerpt, content, image, location, ticket_price, open_hours, maps_url, meta_title, meta_description, is_featured) VALUES (@title,@slug,@excerpt,@content,@image,@location,@ticket_price,@open_hours,@maps_url,@meta_title,@meta_description,@is_featured)`).run(data);
  }
  res.redirect("/admin/wisata");
});

router.post("/kuliner/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = String(req.body.title || "").trim();
  const slug = makeSlug(req.body.slug || title);
  const data = {
    title,
    slug,
    excerpt: String(req.body.excerpt || "").trim() || excerpt(req.body.content || "", 155),
    content: String(req.body.content || "").trim(),
    image: normalizeImageInput(req.body.image_url, String(req.body.current_image || "").trim() || "/images/wisata-berastagi-cover.jpg"),
    location: String(req.body.location || "").trim(),
    price_range: String(req.body.price_range || "").trim(),
    open_hours: String(req.body.open_hours || "").trim(),
    contact_phone: String(req.body.contact_phone || "").trim(),
    maps_url: String(req.body.maps_url || "").trim(),
    meta_title: String(req.body.meta_title || "").trim() || `${title} | Kuliner Berastagi`,
    meta_description: String(req.body.meta_description || "").trim() || excerpt(req.body.excerpt || req.body.content || "", 155),
    is_featured: Number(req.body.is_featured) === 1 ? 1 : 0
  };
  if (!title || !slug) return res.render("admin-kuliner-form", { item: { ...req.body }, error: "Judul wajib diisi.", seo: { noindex: true } });
  if (id) {
    db.prepare(`UPDATE kuliner SET title=@title, slug=@slug, excerpt=@excerpt, content=@content, image=@image, location=@location, price_range=@price_range, open_hours=@open_hours, contact_phone=@contact_phone, maps_url=@maps_url, meta_title=@meta_title, meta_description=@meta_description, is_featured=@is_featured, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO kuliner (title, slug, excerpt, content, image, location, price_range, open_hours, contact_phone, maps_url, meta_title, meta_description, is_featured) VALUES (@title,@slug,@excerpt,@content,@image,@location,@price_range,@open_hours,@contact_phone,@maps_url,@meta_title,@meta_description,@is_featured)`).run(data);
  }
  res.redirect("/admin/kuliner");
});

router.post("/villa/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = String(req.body.title || "").trim();
  const slug = makeSlug(req.body.slug || title);
  const image = normalizeImageInput(req.body.image_url, String(req.body.current_image || "").trim() || "/images/wisata-berastagi-cover.jpg");
  const galleryImages = Array.from(new Set([image, ...parseMultiUrls(req.body.gallery_image_urls)])).filter(Boolean);
  const data = {
    title,
    slug,
    excerpt: String(req.body.excerpt || "").trim() || excerpt(req.body.content || "", 155),
    content: String(req.body.content || "").trim(),
    image,
    images: JSON.stringify(galleryImages),
    price: String(req.body.price || "").trim(),
    location: String(req.body.location || "").trim(),
    facilities: String(req.body.facilities || "").trim(),
    booking_url: String(req.body.booking_url || "").trim(),
    contact_phone: String(req.body.contact_phone || "").trim(),
    maps_url: String(req.body.maps_url || "").trim(),
    meta_title: String(req.body.meta_title || "").trim() || `${title} | Villa dan Hotel di Berastagi`,
    meta_description: String(req.body.meta_description || "").trim() || excerpt(req.body.excerpt || req.body.content || "", 155),
    is_featured: Number(req.body.is_featured) === 1 ? 1 : 0
  };
  if (!title || !slug) return res.render("admin-villa-form", { item: { ...req.body }, error: "Judul wajib diisi.", seo: { noindex: true } });
  if (id) {
    db.prepare(`UPDATE villa SET title=@title, slug=@slug, excerpt=@excerpt, content=@content, image=@image, images=@images, price=@price, location=@location, facilities=@facilities, booking_url=@booking_url, contact_phone=@contact_phone, maps_url=@maps_url, meta_title=@meta_title, meta_description=@meta_description, is_featured=@is_featured, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO villa (title, slug, excerpt, content, image, images, price, location, facilities, booking_url, contact_phone, maps_url, meta_title, meta_description, is_featured) VALUES (@title,@slug,@excerpt,@content,@image,@images,@price,@location,@facilities,@booking_url,@contact_phone,@maps_url,@meta_title,@meta_description,@is_featured)`).run(data);
  }
  res.redirect("/admin/villa");
});

router.post("/berita/save", upload.single("image"), (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = String(req.body.title || "").trim();
  const slug = makeSlug(req.body.slug || title);
  const uploadedImage = req.file ? `/uploads/berita/${req.file.filename}` : "";
  const image = uploadedImage || normalizeImageInput(req.body.image_url, String(req.body.current_image || "").trim() || "/images/wisata-berastagi-cover.jpg");
  const publishedAt = String(req.body.published_at || "").trim().replace("T", " ");
  const data = {
    title,
    slug,
    category: String(req.body.category || "berita").trim() || "berita",
    excerpt: String(req.body.excerpt || "").trim() || excerpt(req.body.content || "", 155),
    content: String(req.body.content || "").trim(),
    image,
    status: "publish",
    meta_title: String(req.body.meta_title || "").trim() || `${title} | Berita Wisata Berastagi`,
    meta_description: String(req.body.meta_description || "").trim() || excerpt(req.body.excerpt || req.body.content || "", 155),
    published_at: publishedAt || new Date().toISOString().slice(0, 19).replace("T", " ")
  };
  if (!title || !slug) return res.render("admin-article-form", { item: { ...req.body }, error: "Judul wajib diisi.", seo: { noindex: true } });
  if (id) {
    db.prepare(`UPDATE articles SET title=@title, slug=@slug, excerpt=@excerpt, content=@content, image=@image, category=@category, status=@status, meta_title=@meta_title, meta_description=@meta_description, published_at=@published_at, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO articles (title, slug, excerpt, content, image, category, status, meta_title, meta_description, published_at) VALUES (@title,@slug,@excerpt,@content,@image,@category,@status,@meta_title,@meta_description,@published_at)`).run(data);
  }
  res.redirect("/admin/berita");
});

router.post("/gallery/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const image = normalizeImageInput(req.body.image_url, String(req.body.current_image || "").trim());
  const data = {
    title: String(req.body.title || "").trim(),
    slug: makeSlug(req.body.slug || req.body.title || `gallery-${Date.now()}`),
    image,
    alt_text: String(req.body.alt_text || "").trim() || String(req.body.title || "Galeri Berastagi").trim(),
    caption: String(req.body.caption || "").trim(),
    sort_order: Number(req.body.sort_order || 0),
    is_active: Number(req.body.is_active) === 1 ? 1 : 0
  };
  if (!image) {
    const items = db.prepare("SELECT * FROM gallery ORDER BY sort_order ASC, updated_at DESC, id DESC").all();
    return res.render("admin-gallery", { items, item: { ...req.body }, error: "URL gambar wajib diisi.", seo: { noindex: true } });
  }
  if (id) {
    db.prepare(`UPDATE gallery SET title=@title, slug=@slug, image=@image, alt_text=@alt_text, caption=@caption, sort_order=@sort_order, is_active=@is_active, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO gallery (title, slug, image, alt_text, caption, sort_order, is_active) VALUES (@title,@slug,@image,@alt_text,@caption,@sort_order,@is_active)`).run(data);
  }
  res.redirect("/admin/gallery");
});

function deleteRoute(pathname, table) {
  router.post(`${pathname}/delete/:id`, (req, res) => {
    getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    res.redirect(pathname);
  });
}
deleteRoute("/admin/wisata".replace('/admin',''), "wisata");
deleteRoute("/admin/villa".replace('/admin',''), "villa");
deleteRoute("/admin/kuliner".replace('/admin',''), "kuliner");
deleteRoute("/admin/berita".replace('/admin',''), "articles");
deleteRoute("/admin/gallery".replace('/admin',''), "gallery");

router.get("/comments", (req, res) => {
  const items = getDb().prepare("SELECT * FROM comments ORDER BY id DESC").all();
  res.render("admin-comments", { items, seo: { noindex: true } });
});
router.post("/comments/approve/:id", (req, res) => {
  getDb().prepare("UPDATE comments SET status = 'approved' WHERE id = ?").run(req.params.id);
  res.redirect("/admin/comments");
});
router.post("/comments/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
  res.redirect("/admin/comments");
});

router.get("/settings", (req, res) => {
  res.render("admin-settings", { settings: getSettings(), seo: { noindex: true } });
});
router.post("/settings", (req, res) => {
  getDb().prepare(`UPDATE settings SET site_name=?, site_tagline=?, contact_phone=?, contact_email=?, address=?, footer_text=?, homepage_title=?, homepage_meta_description=?, hero_title=?, hero_subtitle=?, hero_background=?, logo=? WHERE id = 1`).run(
    String(req.body.site_name || "").trim(),
    String(req.body.site_tagline || "").trim(),
    String(req.body.contact_phone || "").trim(),
    String(req.body.contact_email || "").trim(),
    String(req.body.address || "").trim(),
    String(req.body.footer_text || "").trim(),
    String(req.body.homepage_title || "").trim(),
    String(req.body.homepage_meta_description || "").trim(),
    String(req.body.hero_title || "").trim(),
    String(req.body.hero_subtitle || "").trim(),
    normalizeImageInput(req.body.hero_background, "/images/wisata-berastagi-cover.jpg"),
    normalizeImageInput(req.body.logo, "/favicon/favicon-512x512.png")
  );
  res.redirect("/admin/settings");
});

module.exports = router;
