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

fs.mkdirSync(dataDir, { recursive: true });

function storageFor(folderName) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(dataDir, folderName);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || ".jpg").toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  });
}

const uploadOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024
  }
};

const wisataUpload = multer({
  storage: storageFor("wisata"),
  ...uploadOptions
});

const villaUpload = multer({
  storage: storageFor("villa"),
  ...uploadOptions
});

const kulinerUpload = multer({
  storage: storageFor("kuliner"),
  ...uploadOptions
});

const beritaUpload = multer({
  storage: storageFor("berita"),
  ...uploadOptions
});

const articleEditorUpload = multer({
  storage: storageFor("berita"),
  ...uploadOptions
});

const galleryUpload = multer({
  storage: storageFor("gallery"),
  ...uploadOptions
});

function fileUrl(folder, filename) {
  return `/uploads/${folder}/${filename}`;
}

function settingsRow() {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get();
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanHtml(value) {
  return String(value || "").trim();
}

function plainTextFromHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function fallbackImage(currentImage, file, folder) {
  if (file?.filename) return fileUrl(folder, file.filename);
  return cleanText(currentImage);
}

function requireBasicContent(title, content, res, viewName, seoTitle, item = null) {
  const plainContent = plainTextFromHtml(content);

  if (!title || !plainContent) {
    return res.status(400).render(viewName, {
      seo: buildSeo({
        title: seoTitle,
        noindex: true
      }),
      item,
      error: "Judul dan konten wajib diisi."
    });
  }
  return null;
}

function deleteUploadedFileByUrl(filePathUrl) {
  if (!filePathUrl) return;

  const relativePath = String(filePathUrl).replace(/^\/+/, "");
  const absolutePath = path.join(dataDir, "..", relativePath);

  if (absolutePath.includes(path.join("uploads", "")) && fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (error) {
      console.error("Gagal menghapus file:", absolutePath, error.message);
    }
  }
}

function normalizePublishedAt(value) {
  const raw = cleanText(value);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return `${raw.replace("T", " ")}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  return null;
}

function uniqueSlug(tableName, slug, currentId = null) {
  const db = getDb();
  let baseSlug = cleanText(slug);

  if (!baseSlug) {
    baseSlug = `item-${Date.now()}`;
  }

  let finalSlug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = currentId
      ? db.prepare(`SELECT id FROM ${tableName} WHERE slug = ? AND id != ? LIMIT 1`).get(finalSlug, currentId)
      : db.prepare(`SELECT id FROM ${tableName} WHERE slug = ? LIMIT 1`).get(finalSlug);

    if (!existing) return finalSlug;

    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }
}

function renderFormError(res, viewName, seoTitle, error, item = null, status = 400) {
  return res.status(status).render(viewName, {
    seo: buildSeo({
      title: seoTitle,
      noindex: true
    }),
    item,
    error
  });
}

function safeParseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function villaImagesFromFiles(files = []) {
  return files.map((file) => fileUrl("villa", file.filename));
}

function deleteManyFiles(urls = []) {
  for (const url of urls) {
    deleteUploadedFileByUrl(url);
  }
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
  const username = cleanText(req.body.username);
  const password = cleanText(req.body.password);

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
   UPLOAD IMAGE UNTUK EDITOR
========================= */
router.post("/upload-image", articleEditorUpload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "Gambar tidak ditemukan"
    });
  }

  return res.json({
    location: fileUrl("berita", req.file.filename)
  });
});

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
      gallery: db.prepare("SELECT COUNT(*) as total FROM gallery").get().total,
      comments: db.prepare("SELECT COUNT(*) as total FROM comments").get().total
    }
  });
});

/* =========================
   GALLERY
========================= */
router.get("/gallery", (req, res) => {
  const items = getDb()
    .prepare("SELECT * FROM gallery ORDER BY sort_order ASC, id DESC")
    .all();

  res.render("admin-gallery", {
    seo: buildSeo({
      title: "Kelola Galeri | Wisata Berastagi",
      noindex: true
    }),
    items,
    item: null,
    error: null
  });
});

router.get("/gallery/edit/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM gallery WHERE id = ?").get(req.params.id);
  const items = db.prepare("SELECT * FROM gallery ORDER BY sort_order ASC, id DESC").all();

  if (!item) return res.redirect("/admin/gallery");

  res.render("admin-gallery", {
    seo: buildSeo({
      title: "Edit Galeri | Wisata Berastagi",
      noindex: true
    }),
    items,
    item,
    error: null
  });
});

router.post("/gallery/save", galleryUpload.single("image"), (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id ? Number(req.body.id) : null;
    const title = cleanText(req.body.title);
    const oldItem = id ? db.prepare("SELECT * FROM gallery WHERE id = ?").get(id) : null;
    const image = fallbackImage(req.body.current_image, req.file, "gallery");

    if (!image) {
      const items = db.prepare("SELECT * FROM gallery ORDER BY sort_order ASC, id DESC").all();
      return res.status(400).render("admin-gallery", {
        seo: buildSeo({
          title: id ? "Edit Galeri | Wisata Berastagi" : "Kelola Galeri | Wisata Berastagi",
          noindex: true
        }),
        items,
        item: req.body,
        error: "Gambar galeri wajib diisi."
      });
    }

    const payload = {
      id,
      title,
      slug: uniqueSlug("gallery", makeSlug(req.body.slug || title || `gallery-${Date.now()}`), id),
      image,
      alt_text: cleanText(req.body.alt_text || title),
      caption: cleanText(req.body.caption),
      sort_order: Number(req.body.sort_order || 0),
      is_active: boolToInt(req.body.is_active)
    };

    if (id) {
      db.prepare(`
        UPDATE gallery
        SET
          title = @title,
          slug = @slug,
          image = @image,
          alt_text = @alt_text,
          caption = @caption,
          sort_order = @sort_order,
          is_active = @is_active,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run(payload);

      if (req.file && oldItem?.image && oldItem.image !== image) {
        deleteUploadedFileByUrl(oldItem.image);
      }
    } else {
      db.prepare(`
        INSERT INTO gallery (
          title, slug, image, alt_text, caption, sort_order, is_active
        ) VALUES (
          @title, @slug, @image, @alt_text, @caption, @sort_order, @is_active
        )
      `).run(payload);
    }

    res.redirect("/admin/gallery");
  } catch (error) {
    console.error("GAGAL SIMPAN GALLERY:", error);
    res.redirect("/admin/gallery");
  }
});

router.post("/gallery/toggle/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM gallery WHERE id = ?").get(req.params.id);

  if (item) {
    db.prepare(`
      UPDATE gallery
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(item.is_active ? 0 : 1, req.params.id);
  }

  res.redirect("/admin/gallery");
});

router.post("/gallery/delete/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM gallery WHERE id = ?").get(req.params.id);

  if (item) {
    deleteUploadedFileByUrl(item.image);
    db.prepare("DELETE FROM gallery WHERE id = ?").run(req.params.id);
  }

  res.redirect("/admin/gallery");
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
    item: null,
    error: null
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
    item,
    error: null
  });
});

router.post("/wisata/save", wisataUpload.single("image"), (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id ? Number(req.body.id) : null;
    const title = cleanText(req.body.title);
    const content = cleanHtml(req.body.content);
    const oldItem = id ? db.prepare("SELECT * FROM wisata WHERE id = ?").get(id) : null;

    const validationError = requireBasicContent(
      title,
      content,
      res,
      "admin-wisata-form",
      id ? "Edit Wisata | Wisata Berastagi" : "Tambah Wisata | Wisata Berastagi",
      req.body
    );
    if (validationError) return;

    const slug = uniqueSlug("wisata", makeSlug(req.body.slug || title), id);
    const image = fallbackImage(req.body.current_image, req.file, "wisata");

    const payload = {
      id,
      title,
      slug,
      excerpt: cleanText(req.body.excerpt || excerpt(plainTextFromHtml(content), 150)),
      content,
      image,
      location: cleanText(req.body.location),
      ticket_price: cleanText(req.body.ticket_price),
      open_hours: cleanText(req.body.open_hours),
      maps_url: cleanText(req.body.maps_url),
      meta_title: cleanText(req.body.meta_title || `${title} | Wisata Berastagi`),
      meta_description: cleanText(req.body.meta_description || excerpt(plainTextFromHtml(content), 150)),
      is_featured: boolToInt(req.body.is_featured)
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

      if (req.file && oldItem?.image && oldItem.image !== image) {
        deleteUploadedFileByUrl(oldItem.image);
      }
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
  } catch (error) {
    console.error("GAGAL SIMPAN WISATA:", error);
    return renderFormError(
      res,
      "admin-wisata-form",
      req.body.id ? "Edit Wisata | Wisata Berastagi" : "Tambah Wisata | Wisata Berastagi",
      error.message || "Data wisata gagal disimpan.",
      req.body,
      500
    );
  }
});

router.post("/wisata/delete/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM wisata WHERE id = ?").get(req.params.id);

  if (item?.image) {
    deleteUploadedFileByUrl(item.image);
  }

  db.prepare("DELETE FROM wisata WHERE id = ?").run(req.params.id);
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
    item: null,
    error: null
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
    item,
    error: null
  });
});

router.post(
  "/villa/save",
  (req, res, next) => {
    const uploader = villaUpload.fields([
      { name: "image", maxCount: 1 },
      { name: "gallery_images", maxCount: 10 }
    ]);

    uploader(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return renderFormError(
          res,
          "admin-villa-form",
          req.body?.id ? "Edit Villa | Wisata Berastagi" : "Tambah Villa | Wisata Berastagi",
          err.message || "Upload gambar gagal.",
          req.body,
          400
        );
      }

      if (err) {
        return renderFormError(
          res,
          "admin-villa-form",
          req.body?.id ? "Edit Villa | Wisata Berastagi" : "Tambah Villa | Wisata Berastagi",
          err.message || "Upload file gagal.",
          req.body,
          400
        );
      }

      next();
    });
  },
  (req, res) => {
    try {
      const db = getDb();
      const id = req.body.id ? Number(req.body.id) : null;
      const title = cleanText(req.body.title);
      const content = cleanHtml(req.body.content);
      const oldItem = id ? db.prepare("SELECT * FROM villa WHERE id = ?").get(id) : null;

      const validationError = requireBasicContent(
        title,
        content,
        res,
        "admin-villa-form",
        id ? "Edit Villa | Wisata Berastagi" : "Tambah Villa | Wisata Berastagi",
        req.body
      );
      if (validationError) return;

      const slug = uniqueSlug("villa", makeSlug(req.body.slug || title), id);

      const mainImageFile = req.files?.image?.[0] || null;
      const image = fallbackImage(req.body.current_image, mainImageFile, "villa");

      const oldGalleryImages = safeParseJsonArray(req.body.current_gallery_images);
      const newGalleryImages = villaImagesFromFiles(req.files?.gallery_images || []);
      const mergedGalleryImages = [...oldGalleryImages, ...newGalleryImages];

      const payload = {
        id,
        title,
        slug,
        excerpt: cleanText(req.body.excerpt || excerpt(plainTextFromHtml(content), 150)),
        content,
        image,
        images: JSON.stringify(mergedGalleryImages),
        price: cleanText(req.body.price),
        location: cleanText(req.body.location),
        facilities: cleanText(req.body.facilities),
        booking_url: cleanText(req.body.booking_url),
        contact_phone: cleanText(req.body.contact_phone),
        maps_url: cleanText(req.body.maps_url),
        meta_title: cleanText(req.body.meta_title || `${title} | Villa Berastagi`),
        meta_description: cleanText(req.body.meta_description || excerpt(plainTextFromHtml(content), 150)),
        is_featured: boolToInt(req.body.is_featured)
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
            images = @images,
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

        if (mainImageFile && oldItem?.image && oldItem.image !== image) {
          deleteUploadedFileByUrl(oldItem.image);
        }
      } else {
        db.prepare(`
          INSERT INTO villa (
            title, slug, excerpt, content, image, images, price, location, facilities, booking_url, contact_phone, maps_url,
            meta_title, meta_description, is_featured
          ) VALUES (
            @title, @slug, @excerpt, @content, @image, @images, @price, @location, @facilities, @booking_url, @contact_phone, @maps_url,
            @meta_title, @meta_description, @is_featured
          )
        `).run(payload);
      }

      res.redirect("/admin/villa");
    } catch (error) {
      console.error("GAGAL SIMPAN VILLA:", error);
      return renderFormError(
        res,
        "admin-villa-form",
        req.body.id ? "Edit Villa | Wisata Berastagi" : "Tambah Villa | Wisata Berastagi",
        error.message || "Data villa gagal disimpan.",
        req.body,
        500
      );
    }
  }
);

router.post("/villa/delete/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM villa WHERE id = ?").get(req.params.id);

  if (item?.image) {
    deleteUploadedFileByUrl(item.image);
  }

  if (item?.images) {
    deleteManyFiles(safeParseJsonArray(item.images));
  }

  db.prepare("DELETE FROM villa WHERE id = ?").run(req.params.id);
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
    item: null,
    error: null
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
    item,
    error: null
  });
});

router.post("/kuliner/save", kulinerUpload.single("image"), (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id ? Number(req.body.id) : null;
    const title = cleanText(req.body.title);
    const content = cleanHtml(req.body.content);
    const oldItem = id ? db.prepare("SELECT * FROM kuliner WHERE id = ?").get(id) : null;

    const validationError = requireBasicContent(
      title,
      content,
      res,
      "admin-kuliner-form",
      id ? "Edit Kuliner | Wisata Berastagi" : "Tambah Kuliner | Wisata Berastagi",
      req.body
    );
    if (validationError) return;

    const slug = uniqueSlug("kuliner", makeSlug(req.body.slug || title), id);
    const image = fallbackImage(req.body.current_image, req.file, "kuliner");

    const payload = {
      id,
      title,
      slug,
      excerpt: cleanText(req.body.excerpt || excerpt(plainTextFromHtml(content), 150)),
      content,
      image,
      location: cleanText(req.body.location),
      price_range: cleanText(req.body.price_range),
      open_hours: cleanText(req.body.open_hours),
      maps_url: cleanText(req.body.maps_url),
      contact_phone: cleanText(req.body.contact_phone),
      meta_title: cleanText(req.body.meta_title || `${title} | Kuliner Berastagi`),
      meta_description: cleanText(req.body.meta_description || excerpt(plainTextFromHtml(content), 150)),
      is_featured: boolToInt(req.body.is_featured)
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

      if (req.file && oldItem?.image && oldItem.image !== image) {
        deleteUploadedFileByUrl(oldItem.image);
      }
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
  } catch (error) {
    console.error("GAGAL SIMPAN KULINER:", error);
    return renderFormError(
      res,
      "admin-kuliner-form",
      req.body.id ? "Edit Kuliner | Wisata Berastagi" : "Tambah Kuliner | Wisata Berastagi",
      error.message || "Data kuliner gagal disimpan.",
      req.body,
      500
    );
  }
});

router.post("/kuliner/delete/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM kuliner WHERE id = ?").get(req.params.id);

  if (item?.image) {
    deleteUploadedFileByUrl(item.image);
  }

  db.prepare("DELETE FROM kuliner WHERE id = ?").run(req.params.id);
  res.redirect("/admin/kuliner");
});

/* =========================
   BERITA
   tetap pakai tabel articles
========================= */
function saveBeritaHandler(req, res) {
  try {
    const db = getDb();
    const id = req.body.id ? Number(req.body.id) : null;
    const title = cleanText(req.body.title);
    const content = cleanHtml(req.body.content);
    const oldItem = id ? db.prepare("SELECT * FROM articles WHERE id = ?").get(id) : null;

    const validationError = requireBasicContent(
      title,
      content,
      res,
      "admin-article-form",
      id ? "Edit Berita | Wisata Berastagi" : "Tambah Berita | Wisata Berastagi",
      req.body
    );
    if (validationError) return;

    const slug = uniqueSlug("articles", makeSlug(req.body.slug || title), id);
    const image = fallbackImage(req.body.current_image, req.file, "berita");
    const publishedAt = normalizePublishedAt(req.body.published_at);

    const payload = {
      id,
      title,
      slug,
      excerpt: cleanText(req.body.excerpt || excerpt(plainTextFromHtml(content), 150)),
      content,
      image,
      category: cleanText(req.body.category || "berita"),
      meta_title: cleanText(req.body.meta_title || `${title} | Berita Wisata Berastagi`),
      meta_description: cleanText(req.body.meta_description || excerpt(plainTextFromHtml(content), 150)),
      published_at: publishedAt
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
          published_at = COALESCE(@published_at, published_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run(payload);

      if (req.file && oldItem?.image && oldItem.image !== image) {
        deleteUploadedFileByUrl(oldItem.image);
      }
    } else {
      db.prepare(`
        INSERT INTO articles (
          title, slug, excerpt, content, image, category, meta_title, meta_description, published_at
        ) VALUES (
          @title, @slug, @excerpt, @content, @image, @category, @meta_title, @meta_description,
          COALESCE(@published_at, CURRENT_TIMESTAMP)
        )
      `).run(payload);
    }

    res.redirect("/admin/berita");
  } catch (error) {
    console.error("GAGAL SIMPAN BERITA:", error);
    return renderFormError(
      res,
      "admin-article-form",
      req.body.id ? "Edit Berita | Wisata Berastagi" : "Tambah Berita | Wisata Berastagi",
      error.message || "Berita gagal disimpan. Cek kolom tabel articles.",
      req.body,
      500
    );
  }
}

router.get("/berita", (req, res) => {
  const items = getDb()
    .prepare("SELECT * FROM articles ORDER BY datetime(COALESCE(published_at, created_at)) DESC, id DESC")
    .all();

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
    item: null,
    error: null
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
    item,
    error: null
  });
});

router.post("/berita/save", beritaUpload.single("image"), saveBeritaHandler);

router.post("/berita/delete/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM articles WHERE id = ?").get(req.params.id);

  if (item?.image) {
    deleteUploadedFileByUrl(item.image);
  }

  db.prepare("DELETE FROM articles WHERE id = ?").run(req.params.id);
  res.redirect("/admin/berita");
});

/* =========================
   OPTIONAL BACKWARD COMPATIBILITY
========================= */
router.get("/articles", (req, res) => res.redirect("/admin/berita"));
router.get("/articles/new", (req, res) => res.redirect("/admin/berita/new"));
router.get("/articles/edit/:id", (req, res) => res.redirect(`/admin/berita/edit/${req.params.id}`));
router.post("/articles/save", beritaUpload.single("image"), saveBeritaHandler);
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
    cleanText(req.body.site_name),
    cleanText(req.body.site_tagline),
    cleanText(req.body.contact_phone),
    cleanText(req.body.contact_email),
    cleanText(req.body.address),
    cleanText(req.body.footer_text),
    cleanText(req.body.homepage_title),
    cleanText(req.body.homepage_meta_description),
    cleanText(req.body.hero_title),
    cleanText(req.body.hero_subtitle),
    cleanText(req.body.hero_background)
  );

  res.redirect("/admin/settings");
});

module.exports = router;
