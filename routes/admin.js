const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const { getDb } = require("../lib/db");
const { requireAdmin } = require("../middleware/auth");
const { makeSlug, excerpt } = require("../lib/helpers");
const { buildSeo } = require("../lib/seo");

/* =========================
   HELPER
========================= */

function cleanText(v) {
  return String(v || "").trim();
}

function cleanHtml(v) {
  return String(v || "").trim();
}

function plainTextFromHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function boolToInt(v) {
  return v ? 1 : 0;
}

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

function requireBasic(title, content, res, view, titleSeo, item = null) {
  if (!title || !plainTextFromHtml(content)) {
    return res.render(view, {
      seo: buildSeo({ title: titleSeo, noindex: true }),
      item,
      error: "Judul & konten wajib"
    });
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
  const user = db.prepare("SELECT * FROM users WHERE username=? AND password=?")
    .get(req.body.username, req.body.password);

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
   DASHBOARD
========================= */

router.get("/", (req, res) => {
  const db = getDb();
  res.render("admin-dashboard", {
    seo: buildSeo({ title: "Dashboard", noindex: true }),
    stats: {
      wisata: db.prepare("SELECT COUNT(*) as total FROM wisata").get().total,
      villa: db.prepare("SELECT COUNT(*) as total FROM villa").get().total,
      kuliner: db.prepare("SELECT COUNT(*) as total FROM kuliner").get().total,
      berita: db.prepare("SELECT COUNT(*) as total FROM articles").get().total
    }
  });
});

/* =========================
   WISATA (URL IMAGE)
========================= */

router.post("/wisata/save", (req, res) => {
  try {
    const db = getDb();
    const id = req.body.id || null;
    const title = cleanText(req.body.title);
    const content = cleanHtml(req.body.content);

    const err = requireBasic(title, content, res, "admin-wisata-form", "Form Wisata", req.body);
    if (err) return;

    const payload = {
      id,
      title,
      slug: uniqueSlug("wisata", makeSlug(req.body.slug || title), id),
      excerpt: excerpt(plainTextFromHtml(content), 150),
      content,
      image: cleanText(req.body.image), // 🔥 URL
      location: cleanText(req.body.location),
      ticket_price: cleanText(req.body.ticket_price),
      open_hours: cleanText(req.body.open_hours),
      maps_url: cleanText(req.body.maps_url),
      meta_title: cleanText(req.body.meta_title || title),
      meta_description: cleanText(req.body.meta_description),
      is_featured: boolToInt(req.body.is_featured)
    };

    if (id) {
      db.prepare(`
        UPDATE wisata SET
        title=@title, slug=@slug, excerpt=@excerpt, content=@content,
        image=@image, location=@location, ticket_price=@ticket_price,
        open_hours=@open_hours, maps_url=@maps_url,
        meta_title=@meta_title, meta_description=@meta_description,
        is_featured=@is_featured
        WHERE id=@id
      `).run(payload);
    } else {
      db.prepare(`
        INSERT INTO wisata
        (title,slug,excerpt,content,image,location,ticket_price,open_hours,maps_url,meta_title,meta_description,is_featured)
        VALUES
        (@title,@slug,@excerpt,@content,@image,@location,@ticket_price,@open_hours,@maps_url,@meta_title,@meta_description,@is_featured)
      `).run(payload);
    }

    res.redirect("/admin/wisata");
  } catch (e) {
    res.send(e.message);
  }
});

/* =========================
   KULINER
========================= */

router.post("/kuliner/save", (req, res) => {
  const db = getDb();

  const payload = {
    id: req.body.id || null,
    title: cleanText(req.body.title),
    slug: uniqueSlug("kuliner", makeSlug(req.body.slug || req.body.title), req.body.id),
    excerpt: excerpt(req.body.content, 150),
    content: req.body.content,
    image: cleanText(req.body.image), // 🔥 URL
    location: req.body.location,
    price_range: req.body.price_range,
    open_hours: req.body.open_hours
  };

  if (payload.id) {
    db.prepare("UPDATE kuliner SET title=@title,slug=@slug,content=@content,image=@image WHERE id=@id").run(payload);
  } else {
    db.prepare("INSERT INTO kuliner (title,slug,content,image) VALUES (@title,@slug,@content,@image)").run(payload);
  }

  res.redirect("/admin/kuliner");
});

/* =========================
   VILLA
========================= */

router.post("/villa/save", (req, res) => {
  const db = getDb();

  const payload = {
    id: req.body.id || null,
    title: req.body.title,
    slug: uniqueSlug("villa", makeSlug(req.body.slug || req.body.title), req.body.id),
    content: req.body.content,
    image: cleanText(req.body.image), // 🔥 URL
    images: JSON.stringify(req.body.gallery || [])
  };

  if (payload.id) {
    db.prepare("UPDATE villa SET title=@title,slug=@slug,content=@content,image=@image,images=@images WHERE id=@id").run(payload);
  } else {
    db.prepare("INSERT INTO villa (title,slug,content,image,images) VALUES (@title,@slug,@content,@image,@images)").run(payload);
  }

  res.redirect("/admin/villa");
});

/* =========================
   BERITA
========================= */

router.post("/berita/save", (req, res) => {
  const db = getDb();

  const payload = {
    id: req.body.id || null,
    title: req.body.title,
    slug: uniqueSlug("articles", makeSlug(req.body.slug || req.body.title), req.body.id),
    content: req.body.content,
    image: cleanText(req.body.image), // 🔥 URL
    excerpt: excerpt(req.body.content, 150)
  };

  if (payload.id) {
    db.prepare("UPDATE articles SET title=@title,slug=@slug,content=@content,image=@image WHERE id=@id").run(payload);
  } else {
    db.prepare("INSERT INTO articles (title,slug,content,image) VALUES (@title,@slug,@content,@image)").run(payload);
  }

  res.redirect("/admin/berita");
});

module.exports = router;
