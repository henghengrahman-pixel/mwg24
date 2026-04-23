const express = require("express");
const { getDb } = require("../lib/db");
const { makeSlug, excerpt } = require("../lib/helpers");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

function normalizeImageInput(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function parseMultiUrls(value) {
  return String(value || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

router.use(requireAdmin);

router.get("/", (req, res) => {
  res.render("admin-dashboard", { seo: { noindex: true } });
});

/* ================== WISATA ================== */
router.post("/wisata/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = req.body.title.trim();
  const slug = makeSlug(req.body.slug || title);

  const data = {
    title,
    slug,
    excerpt: req.body.excerpt || excerpt(req.body.content, 150),
    content: req.body.content,
    image: normalizeImageInput(req.body.image, "/images/wisata-berastagi-cover.jpg"),
    location: req.body.location,
    ticket_price: req.body.ticket_price,
    open_hours: req.body.open_hours,
    maps_url: req.body.maps_url,
    meta_title: req.body.meta_title || title,
    meta_description: req.body.meta_description || excerpt(req.body.content,150),
    is_featured: req.body.is_featured ? 1 : 0
  };

  if (id) {
    db.prepare(`UPDATE wisata SET 
      title=@title, slug=@slug, excerpt=@excerpt, content=@content,
      image=@image, location=@location, ticket_price=@ticket_price,
      open_hours=@open_hours, maps_url=@maps_url,
      meta_title=@meta_title, meta_description=@meta_description,
      is_featured=@is_featured
      WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO wisata 
      (title,slug,excerpt,content,image,location,ticket_price,open_hours,maps_url,meta_title,meta_description,is_featured)
      VALUES (@title,@slug,@excerpt,@content,@image,@location,@ticket_price,@open_hours,@maps_url,@meta_title,@meta_description,@is_featured)
    `).run(data);
  }

  res.redirect("/admin/wisata");
});

/* ================== KULINER ================== */
router.post("/kuliner/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = req.body.title.trim();
  const slug = makeSlug(req.body.slug || title);

  const data = {
    title,
    slug,
    excerpt: req.body.excerpt || excerpt(req.body.content,150),
    content: req.body.content,
    image: normalizeImageInput(req.body.image, "/images/wisata-berastagi-cover.jpg"),
    location: req.body.location,
    price_range: req.body.price_range,
    open_hours: req.body.open_hours,
    contact_phone: req.body.contact_phone,
    maps_url: req.body.maps_url,
    meta_title: req.body.meta_title || title,
    meta_description: req.body.meta_description || excerpt(req.body.content,150),
    is_featured: req.body.is_featured ? 1 : 0
  };

  if (id) {
    db.prepare(`UPDATE kuliner SET 
      title=@title,slug=@slug,excerpt=@excerpt,content=@content,
      image=@image,location=@location,price_range=@price_range,
      open_hours=@open_hours,contact_phone=@contact_phone,maps_url=@maps_url,
      meta_title=@meta_title,meta_description=@meta_description,
      is_featured=@is_featured
      WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO kuliner 
      (title,slug,excerpt,content,image,location,price_range,open_hours,contact_phone,maps_url,meta_title,meta_description,is_featured)
      VALUES (@title,@slug,@excerpt,@content,@image,@location,@price_range,@open_hours,@contact_phone,@maps_url,@meta_title,@meta_description,@is_featured)
    `).run(data);
  }

  res.redirect("/admin/kuliner");
});

/* ================== VILLA ================== */
router.post("/villa/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = req.body.title.trim();
  const slug = makeSlug(req.body.slug || title);

  const image = normalizeImageInput(req.body.image);
  const images = parseMultiUrls(req.body.images);

  const data = {
    title,
    slug,
    excerpt: req.body.excerpt || excerpt(req.body.content,150),
    content: req.body.content,
    image,
    images: JSON.stringify(images),
    price: req.body.price,
    location: req.body.location,
    facilities: req.body.facilities,
    booking_url: req.body.booking_url,
    contact_phone: req.body.contact_phone,
    maps_url: req.body.maps_url,
    meta_title: req.body.meta_title || title,
    meta_description: req.body.meta_description || excerpt(req.body.content,150),
    is_featured: req.body.is_featured ? 1 : 0
  };

  if (id) {
    db.prepare(`UPDATE villa SET 
      title=@title,slug=@slug,excerpt=@excerpt,content=@content,
      image=@image,images=@images,price=@price,location=@location,
      facilities=@facilities,booking_url=@booking_url,contact_phone=@contact_phone,
      maps_url=@maps_url,meta_title=@meta_title,meta_description=@meta_description,
      is_featured=@is_featured
      WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO villa 
      (title,slug,excerpt,content,image,images,price,location,facilities,booking_url,contact_phone,maps_url,meta_title,meta_description,is_featured)
      VALUES (@title,@slug,@excerpt,@content,@image,@images,@price,@location,@facilities,@booking_url,@contact_phone,@maps_url,@meta_title,@meta_description,@is_featured)
    `).run(data);
  }

  res.redirect("/admin/villa");
});

/* ================== BERITA ================== */
router.post("/berita/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);
  const title = req.body.title.trim();
  const slug = makeSlug(req.body.slug || title);

  const data = {
    title,
    slug,
    category: req.body.category || "berita",
    excerpt: req.body.excerpt || excerpt(req.body.content,150),
    content: req.body.content,
    image: normalizeImageInput(req.body.image),
    meta_title: req.body.meta_title || title,
    meta_description: req.body.meta_description || excerpt(req.body.content,150)
  };

  if (id) {
    db.prepare(`UPDATE articles SET 
      title=@title,slug=@slug,excerpt=@excerpt,content=@content,
      image=@image,category=@category,
      meta_title=@meta_title,meta_description=@meta_description
      WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO articles 
      (title,slug,excerpt,content,image,category,meta_title,meta_description)
      VALUES (@title,@slug,@excerpt,@content,@image,@category,@meta_title,@meta_description)
    `).run(data);
  }

  res.redirect("/admin/berita");
});

/* ================== GALLERY ================== */
router.post("/gallery/save", (req, res) => {
  const db = getDb();
  const id = Number(req.body.id || 0);

  const data = {
    title: req.body.title,
    slug: makeSlug(req.body.slug || req.body.title),
    image: normalizeImageInput(req.body.image),
    alt_text: req.body.alt_text,
    caption: req.body.caption,
    sort_order: Number(req.body.sort_order || 0),
    is_active: req.body.is_active ? 1 : 0
  };

  if (id) {
    db.prepare(`UPDATE gallery SET 
      title=@title,slug=@slug,image=@image,alt_text=@alt_text,
      caption=@caption,sort_order=@sort_order,is_active=@is_active
      WHERE id=@id`).run({ id, ...data });
  } else {
    db.prepare(`INSERT INTO gallery 
      (title,slug,image,alt_text,caption,sort_order,is_active)
      VALUES (@title,@slug,@image,@alt_text,@caption,@sort_order,@is_active)
    `).run(data);
  }

  res.redirect("/admin/gallery");
});

module.exports = router;
