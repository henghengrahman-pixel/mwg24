const express = require("express");
const { getDb } = require("../lib/db");
const { requireAdmin } = require("../middleware/auth");
const { makeSlug } = require("../lib/helpers");
const { buildSeo } = require("../lib/seo");

const router = express.Router();

function clean(v) { return String(v || "").trim(); }
function isValidHttps(url) {
  try { const u = new URL(url); return u.protocol === "https:"; } catch { return false; }
}

/* PUBLIC TRACKING REDIRECT */
router.get("/go/:id", (req, res) => {
  const db = getDb();
  const product = db.prepare("SELECT * FROM affiliate_products WHERE id = ? AND is_active = 1").get(req.params.id);
  if (!product || !product.affiliate_url || !isValidHttps(product.affiliate_url)) {
    return res.status(404).send("Produk tidak ditemukan atau link tidak valid");
  }
  // A failed analytics write must not prevent a validated outbound redirect.
  try {
    db.prepare("INSERT INTO affiliate_clicks (product_id, placement_key, referrer, ip, user_agent) VALUES (?, ?, ?, ?, ?)")
      .run(product.id, clean(req.query.p || "direct").slice(0, 80),
        (req.get("referer") || "").slice(0, 500), null,
        (req.get("user-agent") || "").slice(0, 250));
  } catch (error) {
    console.error("Affiliate analytics write failed:", error.message);
  }
  return res.redirect(302, product.affiliate_url);
});

/* PUBLIC CATALOG */
router.get("/rekomendasi", (req, res) => {
  const db = getDb();
  const products = db.prepare(`
    SELECT p.*, pt.name as partner_name FROM affiliate_products p
    LEFT JOIN affiliate_partners pt ON p.partner_id = pt.id
    WHERE p.is_active = 1 ORDER BY p.is_featured DESC, p.updated_at DESC LIMIT 50
  `).all();
  res.render("affiliate-catalog", {
    seo: buildSeo({ title: "Rekomendasi Affiliate | MWG24", canonical: "/rekomendasi" }),
    products,
    settings: res.locals.settings || {}
  });
});

/* ADMIN AFFILIATE */
router.use("/admin/affiliate", requireAdmin);

router.get("/admin/affiliate", (req, res) => {
  const db = getDb();
  const stats = {
    products: db.prepare("SELECT COUNT(*) as n FROM affiliate_products").get().n,
    partners: db.prepare("SELECT COUNT(*) as n FROM affiliate_partners").get().n,
    clicks: db.prepare("SELECT COUNT(*) as n FROM affiliate_clicks").get().n
  };
  res.render("admin-affiliate-overview", { seo: buildSeo({ title: "Affiliate Overview", noindex: true }), stats });
});

router.get("/admin/affiliate/products", (req, res) => {
  const items = getDb().prepare("SELECT * FROM affiliate_products ORDER BY updated_at DESC").all();
  res.render("admin-affiliate-products", { seo: buildSeo({ title: "Affiliate Products", noindex: true }), items });
});

router.post("/admin/affiliate/products/save", (req, res) => {
  const db = getDb();
  const id = req.body.id || null;
  const name = clean(req.body.name);
  const affiliate_url = clean(req.body.affiliate_url);
  if (!name || !isValidHttps(affiliate_url)) {
    return res.redirect("/admin/affiliate/products?error=invalid");
  }
  const payload = {
    id, name,
    slug: makeSlug(req.body.slug || name),
    description: clean(req.body.description),
    partner_id: req.body.partner_id || null,
    category_id: req.body.category_id || null,
    image: clean(req.body.image),
    images: JSON.stringify(clean(req.body.images || "").split(/[\n,]/).filter(isValidHttps)),
    affiliate_url,
    price: clean(req.body.price),
    is_active: req.body.is_active ? 1 : 0,
    is_featured: req.body.is_featured ? 1 : 0,
    meta_title: clean(req.body.meta_title || name),
    meta_description: clean(req.body.meta_description)
  };
  if (id) {
    db.prepare(`UPDATE affiliate_products SET name=@name, slug=@slug, description=@description, partner_id=@partner_id, category_id=@category_id, image=@image, images=@images, affiliate_url=@affiliate_url, price=@price, is_active=@is_active, is_featured=@is_featured, meta_title=@meta_title, meta_description=@meta_description, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run(payload);
  } else {
    db.prepare(`INSERT INTO affiliate_products (name, slug, description, partner_id, category_id, image, images, affiliate_url, price, is_active, is_featured, meta_title, meta_description) VALUES (@name, @slug, @description, @partner_id, @category_id, @image, @images, @affiliate_url, @price, @is_active, @is_featured, @meta_title, @meta_description)`).run(payload);
  }
  res.redirect("/admin/affiliate/products");
});

// Similar minimal routes for partners, etc. can be expanded
router.get("/admin/affiliate/partners", (req, res) => {
  const items = getDb().prepare("SELECT * FROM affiliate_partners ORDER BY name").all();
  res.render("admin-affiliate-partners", { seo: buildSeo({ title: "Partners", noindex: true }), items });
});

router.post("/admin/affiliate/partners/save", (req, res) => {
  const db = getDb();
  const name = clean(req.body.name);
  if (!name) return res.redirect("/admin/affiliate/partners");
  db.prepare("INSERT OR REPLACE INTO affiliate_partners (name, slug, type, website, is_active) VALUES (?, ?, ?, ?, 1)")
    .run(name, makeSlug(name), clean(req.body.type) || "custom", clean(req.body.website));
  res.redirect("/admin/affiliate/partners");
});

module.exports = router;
