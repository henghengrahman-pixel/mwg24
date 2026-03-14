const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();
const { getDb } = require("../lib/db");
const { requireAdmin } = require("../middleware/auth");
const { makeSlug, excerpt } = require("../lib/helpers");
const { buildSeo } = require("../lib/seo");

const dataDir =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? path.join(process.env.DATA_DIR, "uploads")
    : path.join(__dirname, "..", "uploads");

function storageFor(folderName) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(dataDir, folderName);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || ".jpg");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  });
}

const wisataUpload = multer({ storage: storageFor("wisata") });
const villaUpload = multer({ storage: storageFor("villa") });
const kulinerUpload = multer({ storage: storageFor("kuliner") });
const beritaUpload = multer({ storage: storageFor("berita") });

function fileUrl(folder, filename) {
  return `/uploads/${folder}/${filename}`;
}

function settingsRow() {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get();
}

/* =========================
   LOGIN
========================= */
router.get("/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin");

  res.render("login", {
    seo: buildSeo({
      title: "Login Admin | Wisata Berastagi",
      description: "Login admin Wisata Berastagi.",
      noindex: true
    }),
    error: null
  });
});

router.post("/login", (req, res) => {
  const db = getDb();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
    .get(username, password);

  if (!user) {
    return res.status(401).render("login", {
      seo: buildSeo({
        title: "Login Admin | Wisata Berastagi",
        description: "Login admin Wisata Berastagi.",
        noindex: true
      }),
      error: "Username atau password salah."
    });
  }

  req.session.isAdmin = true;
  req.session.adminUsername = user.username;

  res.redirect("/admin");
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.use(requireAdmin);

/* =========================
   DASHBOARD
========================= */
router.get("/", (req, res) => {
  const db = getDb();

  res.render("admin-dashboard", {
    seo: buildSeo({
      title: "Dashboard Admin | Wisata Berastagi",
      noindex: true
    }),
    stats: {
      wisata: db.prepare("SELECT COUNT(*) as total FROM wisata").get().total,
      villa: db.prepare("SELECT COUNT(*) as total FROM villa").get().total,
      kuliner: db.prepare("SELECT COUNT(*) as total FROM kuliner").get().total,
      berita: db.prepare("SELECT COUNT(*) as total FROM articles").get().total,
      comments: db.prepare("SELECT COUNT(*) as total FROM comments").get().total
    }
  });
});

/* =========================
   WISATA
========================= */
router.get("/wisata", (req, res) => {
  const items = getDb().prepare("SELECT * FROM wisata ORDER BY id DESC").all();

  res.render("admin-wisata", {
    seo: buildSeo({
      title: "Admin Wisata | Wisata Berastagi",
      noindex: true
    }),
    items
  });
});

router.get("/wisata/new", (req, res) => {
  res.render("admin-wisata-form", {
    seo: buildSeo({
      title: "Tambah Wisata | Wisata Berastagi",
      noindex: true
    }),
    item: null
  });
});

router.get("/wisata/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM wisata WHERE id = ?").get(req.params.id);

  if (!item) return res.redirect("/admin/wisata");

  res.render("admin-wisata-form", {
    seo: buildSeo({
      title: "Edit Wisata | Wisata Berastagi",
      noindex: true
    }),
    item
  });
});

router.post("/wisata/save", wisataUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;
  const title = String(req.body.title || "").trim();
  const content = String(req.body.content || "").trim();
  const slug = makeSlug(req.body.slug || title);
  const image = req.file
    ? fileUrl("wisata", req.file.filename)
    : String(req.body.current_image || "").trim();

  const payload = {
    id,
    title,
    slug,
    excerpt: String(req.body.excerpt || excerpt(content, 150)).trim(),
    content,
    image,
    location: String(req.body.location || "").trim(),
    ticket_price: String(req.body.ticket_price || "").trim(),
    open_hours: String(req.body.open_hours || "").trim(),
    maps_url: String(req.body.maps_url || "").trim(),
    meta_title: String(req.body.meta_title || `${title} | Wisata Berastagi`).trim(),
    meta_description: String(req.body.meta_description || excerpt(content, 150)).trim(),
    is_featured: req.body.is_featured ? 1 : 0
  };

  if (id) {
    db.prepare(`
      UPDATE wisata
      SET
        title = @title,
        slug = @slug,
        excerpt = @excerpt,
        content = @content,
        image = @image,
        location = @location,
        ticket_price = @ticket_price,
        open_hours = @open_hours,
        maps_url = @maps_url,
        meta_title = @meta_title,
        meta_description = @meta_description,
        is_featured = @is_featured,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run(payload);
  } else {
    db.prepare(`
      INSERT INTO wisata (
        title, slug, excerpt, content, image, location, ticket_price, open_hours, maps_url,
        meta_title, meta_description, is_featured
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @location, @ticket_price, @open_hours, @maps_url,
        @meta_title, @meta_description, @is_featured
      )
    `).run(payload);
  }

  res.redirect("/admin/wisata");
});

router.post("/wisata/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM wisata WHERE id = ?").run(req.params.id);
  res.redirect("/admin/wisata");
});

/* =========================
   VILLA
========================= */
router.get("/villa", (req, res) => {
  const items = getDb().prepare("SELECT * FROM villa ORDER BY id DESC").all();

  res.render("admin-villa", {
    seo: buildSeo({
      title: "Admin Villa | Wisata Berastagi",
      noindex: true
    }),
    items
  });
});

router.get("/villa/new", (req, res) => {
  res.render("admin-villa-form", {
    seo: buildSeo({
      title: "Tambah Villa | Wisata Berastagi",
      noindex: true
    }),
    item: null
  });
});

router.get("/villa/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM villa WHERE id = ?").get(req.params.id);

  if (!item) return res.redirect("/admin/villa");

  res.render("admin-villa-form", {
    seo: buildSeo({
      title: "Edit Villa | Wisata Berastagi",
      noindex: true
    }),
    item
  });
});

router.post("/villa/save", villaUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;
  const title = String(req.body.title || "").trim();
  const content = String(req.body.content || "").trim();
  const slug = makeSlug(req.body.slug || title);
  const image = req.file
    ? fileUrl("villa", req.file.filename)
    : String(req.body.current_image || "").trim();

  const payload = {
    id,
    title,
    slug,
    excerpt: String(req.body.excerpt || excerpt(content, 150)).trim(),
    content,
    image,
    price: String(req.body.price || "").trim(),
    location: String(req.body.location || "").trim(),
    facilities: String(req.body.facilities || "").trim(),
    booking_url: String(req.body.booking_url || "").trim(),
    contact_phone: String(req.body.contact_phone || "").trim(),
    maps_url: String(req.body.maps_url || "").trim(),
    meta_title: String(req.body.meta_title || `${title} | Villa Berastagi`).trim(),
    meta_description: String(req.body.meta_description || excerpt(content, 150)).trim(),
    is_featured: req.body.is_featured ? 1 : 0
  };

  if (id) {
    db.prepare(`
      UPDATE villa
      SET
        title = @title,
        slug = @slug,
        excerpt = @excerpt,
        content = @content,
        image = @image,
        price = @price,
        location = @location,
        facilities = @facilities,
        booking_url = @booking_url,
        contact_phone = @contact_phone,
        maps_url = @maps_url,
        meta_title = @meta_title,
        meta_description = @meta_description,
        is_featured = @is_featured,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run(payload);
  } else {
    db.prepare(`
      INSERT INTO villa (
        title, slug, excerpt, content, image, price, location, facilities, booking_url, contact_phone, maps_url,
        meta_title, meta_description, is_featured
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @price, @location, @facilities, @booking_url, @contact_phone, @maps_url,
        @meta_title, @meta_description, @is_featured
      )
    `).run(payload);
  }

  res.redirect("/admin/villa");
});

router.post("/villa/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM villa WHERE id = ?").run(req.params.id);
  res.redirect("/admin/villa");
});

/* =========================
   KULINER
========================= */
router.get("/kuliner", (req, res) => {
  const items = getDb().prepare("SELECT * FROM kuliner ORDER BY id DESC").all();

  res.render("admin-kuliner", {
    seo: buildSeo({
      title: "Admin Kuliner | Wisata Berastagi",
      noindex: true
    }),
    items
  });
});

router.get("/kuliner/new", (req, res) => {
  res.render("admin-kuliner-form", {
    seo: buildSeo({
      title: "Tambah Kuliner | Wisata Berastagi",
      noindex: true
    }),
    item: null
  });
});

router.get("/kuliner/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM kuliner WHERE id = ?").get(req.params.id);

  if (!item) return res.redirect("/admin/kuliner");

  res.render("admin-kuliner-form", {
    seo: buildSeo({
      title: "Edit Kuliner | Wisata Berastagi",
      noindex: true
    }),
    item
  });
});

router.post("/kuliner/save", kulinerUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;
  const title = String(req.body.title || "").trim();
  const content = String(req.body.content || "").trim();
  const slug = makeSlug(req.body.slug || title);
  const image = req.file
    ? fileUrl("kuliner", req.file.filename)
    : String(req.body.current_image || "").trim();

  const payload = {
    id,
    title,
    slug,
    excerpt: String(req.body.excerpt || excerpt(content, 150)).trim(),
    content,
    image,
    location: String(req.body.location || "").trim(),
    price_range: String(req.body.price_range || "").trim(),
    open_hours: String(req.body.open_hours || "").trim(),
    maps_url: String(req.body.maps_url || "").trim(),
    contact_phone: String(req.body.contact_phone || "").trim(),
    meta_title: String(req.body.meta_title || `${title} | Kuliner Berastagi`).trim(),
    meta_description: String(req.body.meta_description || excerpt(content, 150)).trim(),
    is_featured: req.body.is_featured ? 1 : 0
  };

  if (id) {
    db.prepare(`
      UPDATE kuliner
      SET
        title = @title,
        slug = @slug,
        excerpt = @excerpt,
        content = @content,
        image = @image,
        location = @location,
        price_range = @price_range,
        open_hours = @open_hours,
        maps_url = @maps_url,
        contact_phone = @contact_phone,
        meta_title = @meta_title,
        meta_description = @meta_description,
        is_featured = @is_featured,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run(payload);
  } else {
    db.prepare(`
      INSERT INTO kuliner (
        title, slug, excerpt, content, image, location, price_range, open_hours, maps_url,
        contact_phone, meta_title, meta_description, is_featured
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @location, @price_range, @open_hours, @maps_url,
        @contact_phone, @meta_title, @meta_description, @is_featured
      )
    `).run(payload);
  }

  res.redirect("/admin/kuliner");
});

router.post("/kuliner/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM kuliner WHERE id = ?").run(req.params.id);
  res.redirect("/admin/kuliner");
});

/* =========================
   BERITA
   tetap pakai tabel articles
========================= */
router.get("/berita", (req, res) => {
  const items = getDb().prepare("SELECT * FROM articles ORDER BY id DESC").all();

  res.render("admin-articles", {
    seo: buildSeo({
      title: "Admin Berita | Wisata Berastagi",
      noindex: true
    }),
    items
  });
});

router.get("/berita/new", (req, res) => {
  res.render("admin-article-form", {
    seo: buildSeo({
      title: "Tambah Berita | Wisata Berastagi",
      noindex: true
    }),
    item: null
  });
});

router.get("/berita/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM articles WHERE id = ?").get(req.params.id);

  if (!item) return res.redirect("/admin/berita");

  res.render("admin-article-form", {
    seo: buildSeo({
      title: "Edit Berita | Wisata Berastagi",
      noindex: true
    }),
    item
  });
});

router.post("/berita/save", beritaUpload.single("image"), (req, res) => {
  const db = getDb();
  const id = req.body.id ? Number(req.body.id) : null;
  const title = String(req.body.title || "").trim();
  const content = String(req.body.content || "").trim();
  const slug = makeSlug(req.body.slug || title);
  const image = req.file
    ? fileUrl("berita", req.file.filename)
    : String(req.body.current_image || "").trim();

  const payload = {
    id,
    title,
    slug,
    excerpt: String(req.body.excerpt || excerpt(content, 150)).trim(),
    content,
    image,
    category: String(req.body.category || "berita").trim(),
    meta_title: String(req.body.meta_title || `${title} | Berita Wisata Berastagi`).trim(),
    meta_description: String(req.body.meta_description || excerpt(content, 150)).trim()
  };

  if (id) {
    db.prepare(`
      UPDATE articles
      SET
        title = @title,
        slug = @slug,
        excerpt = @excerpt,
        content = @content,
        image = @image,
        category = @category,
        meta_title = @meta_title,
        meta_description = @meta_description,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run(payload);
  } else {
    db.prepare(`
      INSERT INTO articles (
        title, slug, excerpt, content, image, category, meta_title, meta_description
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @category, @meta_title, @meta_description
      )
    `).run(payload);
  }

  res.redirect("/admin/berita");
});

router.post("/berita/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM articles WHERE id = ?").run(req.params.id);
  res.redirect("/admin/berita");
});

/* =========================
   OPTIONAL BACKWARD COMPATIBILITY
   kalau masih ada link lama /admin/articles
========================= */
router.get("/articles", (req, res) => res.redirect("/admin/berita"));
router.get("/articles/new", (req, res) => res.redirect("/admin/berita/new"));
router.get("/articles/edit/:id", (req, res) => res.redirect(`/admin/berita/edit/${req.params.id}`));
router.post("/articles/save", beritaUpload.single("image"), (req, res, next) => next());
router.post("/articles/delete/:id", (req, res) => res.redirect(307, `/admin/berita/delete/${req.params.id}`));

/* =========================
   COMMENTS
========================= */
router.get("/comments", (req, res) => {
  const items = getDb().prepare("SELECT * FROM comments ORDER BY id DESC").all();

  res.render("admin-comments", {
    seo: buildSeo({
      title: "Komentar Pengunjung | Wisata Berastagi",
      noindex: true
    }),
    items
  });
});

router.post("/comments/approve/:id", (req, res) => {
  getDb().prepare("UPDATE comments SET status = 'approved' WHERE id = ?").run(req.params.id);
  res.redirect("/admin/comments");
});

router.post("/comments/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
  res.redirect("/admin/comments");
});

/* =========================
   SETTINGS
========================= */
router.get("/settings", (req, res) => {
  res.render("admin-settings", {
    seo: buildSeo({
      title: "Pengaturan Website | Wisata Berastagi",
      noindex: true
    }),
    settings: settingsRow()
  });
});

router.post("/settings", (req, res) => {
  getDb().prepare(`
    UPDATE settings
    SET
      site_name = ?,
      site_tagline = ?,
      contact_phone = ?,
      contact_email = ?,
      address = ?,
      footer_text = ?,
      homepage_title = ?,
      homepage_meta_description = ?,
      hero_title = ?,
      hero_subtitle = ?,
      hero_background = ?
    WHERE id = 1
  `).run(
    req.body.site_name,
    req.body.site_tagline,
    req.body.contact_phone,
    req.body.contact_email,
    req.body.address,
    req.body.footer_text,
    req.body.homepage_title,
    req.body.homepage_meta_description,
    req.body.hero_title,
    req.body.hero_subtitle,
    req.body.hero_background
  );

  res.redirect("/admin/settings");
});

module.exports = router;
