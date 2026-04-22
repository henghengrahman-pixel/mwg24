const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();
const { getDb } = require("../lib/db");
const { requireAdmin } = require("../middleware/auth");
const { makeSlug, excerpt } = require("../lib/helpers");
const { buildSeo } = require("../lib/seo");

/* =========================
   PATH SETUP
========================= */
const baseUploadDir =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : path.join(__dirname, "..");

const dataDir = path.join(baseUploadDir, "uploads");
fs.mkdirSync(dataDir, { recursive: true });

/* =========================
   HELPERS
========================= */
function isValidUrl(url) {
  return /^https?:\/\/.+/i.test(String(url || "").trim());
}

function cleanText(v) {
  return String(v || "").trim();
}

function cleanHtml(v) {
  return String(v || "").trim();
}

function plainTextFromHtml(v) {
  return String(v || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function boolToInt(v) {
  return v ? 1 : 0;
}

function safeExcerpt(content) {
  return excerpt(plainTextFromHtml(content), 155);
}

function ensureMeta(title, metaTitle) {
  return cleanText(metaTitle || `${title} | Wisata Berastagi`);
}

function ensureMetaDesc(content, metaDesc) {
  return cleanText(metaDesc || safeExcerpt(content));
}

function deleteUploadedFileByUrl(fileUrlPath) {
  if (!fileUrlPath) return;

  try {
    const cleanPath = fileUrlPath.replace(/^\/+/, "");
    const absolute = path.join(baseUploadDir, cleanPath);

    if (absolute.includes("uploads") && fs.existsSync(absolute)) {
      fs.unlinkSync(absolute);
    }
  } catch (err) {
    console.error("Gagal hapus file:", err.message);
  }
}

function uniqueSlug(table, slug, id = null) {
  const db = getDb();
  let base = cleanText(slug) || `item-${Date.now()}`;
  let final = base;
  let i = 2;

  while (true) {
    const exist = id
      ? db.prepare(`SELECT id FROM ${table} WHERE slug=? AND id!=?`).get(final, id)
      : db.prepare(`SELECT id FROM ${table} WHERE slug=?`).get(final);

    if (!exist) return final;
    final = `${base}-${i++}`;
  }
}

/* =========================
   LOGIN
========================= */
router.get("/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin");

  res.render("login", {
    seo: buildSeo({ title: "Login Admin", noindex: true }),
    error: null
  });
});

router.post("/login", (req, res) => {
  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE username=? AND password=?")
    .get(cleanText(req.body.username), cleanText(req.body.password));

  if (!user) {
    return res.render("login", {
      seo: buildSeo({ title: "Login Admin", noindex: true }),
      error: "Login gagal"
    });
  }

  req.session.isAdmin = true;
  res.redirect("/admin");
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

router.use(requireAdmin);

/* =========================
   WISATA (URL MODE)
========================= */
router.get("/wisata", (req, res) => {
  const items = getDb().prepare("SELECT * FROM wisata ORDER BY id DESC").all();

  res.render("admin-wisata", {
    seo: buildSeo({ title: "Admin Wisata", noindex: true }),
    items
  });
});

router.get("/wisata/new", (req, res) => {
  res.render("admin-wisata-form", {
    seo: buildSeo({ title: "Tambah Wisata", noindex: true }),
    item: null,
    error: null
  });
});

router.get("/wisata/edit/:id", (req, res) => {
  const item = getDb().prepare("SELECT * FROM wisata WHERE id=?").get(req.params.id);
  if (!item) return res.redirect("/admin/wisata");

  res.render("admin-wisata-form", {
    seo: buildSeo({ title: "Edit Wisata", noindex: true }),
    item,
    error: null
  });
});

router.post("/wisata/save", (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id ? Number(req.body.id) : null;

    const title = cleanText(req.body.title);
    const content = cleanHtml(req.body.content);
    const image = cleanText(req.body.image);

    if (!title || !plainTextFromHtml(content)) {
      return res.render("admin-wisata-form", {
        seo: buildSeo({ title: "Error", noindex: true }),
        item: req.body,
        error: "Judul & konten wajib"
      });
    }

    if (!isValidUrl(image)) {
      return res.render("admin-wisata-form", {
        seo: buildSeo({ title: "Error", noindex: true }),
        item: req.body,
        error: "URL gambar wajib valid (https://...)"
      });
    }

    const slug = uniqueSlug("wisata", makeSlug(req.body.slug || title), id);

    const payload = {
      id,
      title,
      slug,
      excerpt: cleanText(req.body.excerpt || safeExcerpt(content)),
      content,
      image,
      location: cleanText(req.body.location),
      ticket_price: cleanText(req.body.ticket_price),
      open_hours: cleanText(req.body.open_hours),
      maps_url: cleanText(req.body.maps_url),
      meta_title: ensureMeta(title, req.body.meta_title),
      meta_description: ensureMetaDesc(content, req.body.meta_description),
      is_featured: boolToInt(req.body.is_featured)
    };

    if (id) {
      db.prepare(`
        UPDATE wisata SET
        title=@title, slug=@slug, excerpt=@excerpt, content=@content,
        image=@image, location=@location, ticket_price=@ticket_price,
        open_hours=@open_hours, maps_url=@maps_url,
        meta_title=@meta_title, meta_description=@meta_description,
        is_featured=@is_featured, updated_at=CURRENT_TIMESTAMP
        WHERE id=@id
      `).run(payload);
    } else {
      db.prepare(`
        INSERT INTO wisata (
          title, slug, excerpt, content, image,
          location, ticket_price, open_hours, maps_url,
          meta_title, meta_description, is_featured
        ) VALUES (
          @title, @slug, @excerpt, @content, @image,
          @location, @ticket_price, @open_hours, @maps_url,
          @meta_title, @meta_description, @is_featured
        )
      `).run(payload);
    }

    res.redirect("/admin/wisata");
  } catch (e) {
    console.error(e);
    res.redirect("/admin/wisata");
  }
});

router.post("/wisata/delete/:id", (req, res) => {
  getDb().prepare("DELETE FROM wisata WHERE id=?").run(req.params.id);
  res.redirect("/admin/wisata");
});

/* =========================
   VILLA (URL MODE)
========================= */
router.post("/villa/save", (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id ? Number(req.body.id) : null;

    const title = cleanText(req.body.title);
    const content = cleanHtml(req.body.content);
    const image = cleanText(req.body.image);

    if (!isValidUrl(image)) throw new Error("URL gambar tidak valid");

    const slug = uniqueSlug("villa", makeSlug(req.body.slug || title), id);

    const gallery = req.body.gallery_urls
      ? req.body.gallery_urls.split(",").map(x => x.trim()).filter(isValidUrl)
      : [];

    const payload = {
      id,
      title,
      slug,
      excerpt: safeExcerpt(content),
      content,
      image,
      images: JSON.stringify(gallery),
      price: cleanText(req.body.price),
      location: cleanText(req.body.location),
      facilities: cleanText(req.body.facilities),
      booking_url: cleanText(req.body.booking_url),
      contact_phone: cleanText(req.body.contact_phone),
      maps_url: cleanText(req.body.maps_url),
      meta_title: ensureMeta(title, req.body.meta_title),
      meta_description: ensureMetaDesc(content, req.body.meta_description),
      is_featured: boolToInt(req.body.is_featured)
    };

    if (id) {
      db.prepare(`UPDATE villa SET
        title=@title, slug=@slug, excerpt=@excerpt, content=@content,
        image=@image, images=@images, price=@price,
        location=@location, facilities=@facilities,
        booking_url=@booking_url, contact_phone=@contact_phone,
        maps_url=@maps_url, meta_title=@meta_title,
        meta_description=@meta_description,
        is_featured=@is_featured,
        updated_at=CURRENT_TIMESTAMP
        WHERE id=@id`).run(payload);
    } else {
      db.prepare(`INSERT INTO villa (
        title, slug, excerpt, content, image, images,
        price, location, facilities, booking_url,
        contact_phone, maps_url,
        meta_title, meta_description, is_featured
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @images,
        @price, @location, @facilities, @booking_url,
        @contact_phone, @maps_url,
        @meta_title, @meta_description, @is_featured
      )`).run(payload);
    }

    res.redirect("/admin/villa");
  } catch (e) {
    console.error(e);
    res.redirect("/admin/villa");
  }
});

module.exports = router;
