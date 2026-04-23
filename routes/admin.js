const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { getDb } = require("../lib/db");
const { makeSlug, excerpt } = require("../lib/helpers");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const dataRoot = process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
  ? process.env.DATA_DIR
  : path.join(__dirname, "..", "data");

const uploadsBase = path.join(dataRoot, "uploads");
const beritaUploads = path.join(uploadsBase, "berita");

fs.mkdirSync(uploadsBase, { recursive: true });
fs.mkdirSync(beritaUploads, { recursive: true });

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, beritaUploads),
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

/* FIX MULTIPART ERROR */
function safeUploadNone(req, res, next) {
  upload.none()(req, res, function (err) {
    if (err) return next();
    next();
  });
}

/* ================= HELPERS ================= */
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

function adminPath(pathname = "") {
  return `/admin${pathname}`;
}

/* ================= GLOBAL ================= */
router.use((req, res, next) => {
  res.locals.settings = getSettings();
  next();
});

/* ================= LOGIN ================= */
router.get("/login", (req, res) => {
  if (req.session?.isAdmin) return res.redirect("/admin");
  res.render("login", { error: "", seo: { title: "Login Admin", noindex: true } });
});

router.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  const user = getDb().prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);

  if (!user) {
    return res.render("login", { error: "Login gagal", seo: { noindex: true } });
  }

  req.session.isAdmin = true;
  res.redirect("/admin");
});

router.use(requireAdmin);

/* ================= DASHBOARD ================= */
router.get("/", (req, res) => {
  res.render("admin-dashboard", {
    stats: dashboardStats(),
    seo: { noindex: true }
  });
});

/* ================= LIST ================= */
function listRoute(pathname, table, view) {
  router.get(pathname, (req, res) => {
    const items = getDb().prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
    res.render(view, { items, seo: { noindex: true } });
  });
}

listRoute("/wisata", "wisata", "admin-wisata");
listRoute("/villa", "villa", "admin-villa");
listRoute("/kuliner", "kuliner", "admin-kuliner");
listRoute("/berita", "articles", "admin-articles");

/* ================= SAVE WISATA ================= */
router.post("/wisata/save", safeUploadNone, (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = req.body.title;

  if (!title) return res.redirect("/admin/wisata");

  const data = {
    title,
    slug: makeSlug(req.body.slug || title),
    excerpt: req.body.excerpt || excerpt(req.body.content || "", 155),
    content: req.body.content || "",
    image: normalizeImageInput(req.body.image || req.body.current_image, "/images/default.jpg"),
    location: req.body.location || "",
    ticket_price: req.body.ticket_price || "",
    open_hours: req.body.open_hours || "",
    maps_url: req.body.maps_url || "",
    meta_title: req.body.meta_title || title,
    meta_description: req.body.meta_description || "",
    is_featured: req.body.is_featured ? 1 : 0
  };

  if (id) {
    db.prepare(`UPDATE wisata SET title=@title, slug=@slug, excerpt=@excerpt, content=@content, image=@image WHERE id=@id`)
      .run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO wisata (title,slug,excerpt,content,image) VALUES (@title,@slug,@excerpt,@content,@image)`)
      .run(data);
  }

  res.redirect("/admin/wisata");
});

/* ================= SAVE KULINER (FIX ERROR UTAMA) ================= */
router.post("/kuliner/save", safeUploadNone, (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = req.body.title;

  if (!title) return res.redirect("/admin/kuliner");

  const data = {
    title,
    slug: makeSlug(req.body.slug || title),
    excerpt: req.body.excerpt || excerpt(req.body.content || "", 155),
    content: req.body.content || "",
    image: normalizeImageInput(req.body.image || req.body.current_image, "/images/default.jpg"),
    location: req.body.location || "",
    price_range: req.body.price_range || "",
    open_hours: req.body.open_hours || "",
    contact_phone: req.body.contact_phone || "",
    maps_url: req.body.maps_url || "",
    meta_title: req.body.meta_title || title,
    meta_description: req.body.meta_description || "",
    is_featured: req.body.is_featured ? 1 : 0
  };

  if (id) {
    db.prepare(`UPDATE kuliner SET title=@title, slug=@slug, content=@content, image=@image WHERE id=@id`)
      .run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO kuliner (title,slug,content,image) VALUES (@title,@slug,@content,@image)`)
      .run(data);
  }

  res.redirect("/admin/kuliner");
});

/* ================= SAVE BERITA ================= */
router.post("/berita/save", upload.single("image"), (req, res) => {
  const db = getDb();
  const title = req.body.title;

  if (!title) return res.redirect("/admin/berita");

  const image = req.file
    ? `/uploads/berita/${req.file.filename}`
    : normalizeImageInput(req.body.current_image);

  db.prepare(`INSERT INTO articles (title,slug,image) VALUES (?,?,?)`)
    .run(title, makeSlug(title), image);

  res.redirect("/admin/berita");
});

/* ================= DELETE ================= */
router.post("/kuliner/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM kuliner WHERE id = ?").run(req.params.id);
  res.redirect("/admin/kuliner");
});

module.exports = router;
