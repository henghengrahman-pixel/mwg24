const express = require("express");
const { getDb } = require("../lib/db");
const { requireAdmin } = require("../middleware/auth");
const { makeSlug } = require("../lib/helpers");
const { buildSeo } = require("../lib/seo");

const router = express.Router();

function clean(v) { return String(v || "").trim(); }
function isValidHttps(url) {
  try { const u = new URL(url); return u.protocol === "https:" && !!u.hostname && !u.username && !u.password; } catch { return false; }
}
function safeId(value) {
  const n = Number(value);
  return /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(n) ? n : null;
}
function optionalId(db, table, value) {
  if (!value) return null;
  const id = safeId(value);
  if (!id || !db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id)) throw new Error('Referensi data tidak ditemukan');
  return id;
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

/* PUBLIC CATALOG: parameterized filters, stable pagination, active products only. */
router.get("/rekomendasi", (req, res) => {
  const db = getDb();
  const q = clean(req.query.q).slice(0, 100);
  const categoryId = safeId(req.query.category);
  const partnerId = safeId(req.query.partner);
  const sort = ["newest", "name", "price_asc", "price_desc"].includes(req.query.sort) ? req.query.sort : "newest";
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = 24;
  const clauses = ["p.is_active = 1"];
  const params = [];
  if (q) { clauses.push("(p.name LIKE ? OR p.description LIKE ?)"); const term = `%${q}%`; params.push(term,term); }
  if (categoryId) { clauses.push("p.category_id = ?"); params.push(categoryId); }
  if (partnerId) { clauses.push("p.partner_id = ?"); params.push(partnerId); }
  const where = clauses.join(" AND ");
  const ordering = {newest:"p.is_featured DESC, p.updated_at DESC, p.id DESC",name:"p.name COLLATE NOCASE ASC, p.id DESC",price_asc:"CAST(REPLACE(REPLACE(p.price, 'Rp', ''), '.', '') AS REAL) ASC, p.id DESC",price_desc:"CAST(REPLACE(REPLACE(p.price, 'Rp', ''), '.', '') AS REAL) DESC, p.id DESC"}[sort];
  const total = db.prepare(`SELECT COUNT(*) AS n FROM affiliate_products p WHERE ${where}`).get(...params).n;
  const totalPages = Math.max(1, Math.ceil(total/limit));
  const currentPage = Math.min(page,totalPages);
  const products = db.prepare(`SELECT p.*, pt.name AS partner_name, ct.name AS category_name
    FROM affiliate_products p LEFT JOIN affiliate_partners pt ON p.partner_id=pt.id
    LEFT JOIN affiliate_categories ct ON p.category_id=ct.id
    WHERE ${where} ORDER BY ${ordering} LIMIT ? OFFSET ?`).all(...params,limit,(currentPage-1)*limit);
  const categories = db.prepare("SELECT id,name FROM affiliate_categories ORDER BY name").all();
  const partners = db.prepare("SELECT id,name FROM affiliate_partners WHERE is_active=1 ORDER BY name").all();
  res.render("affiliate-catalog", {
    seo: buildSeo({title:"Rekomendasi Belanja | Wisata Berastagi",canonical:"/rekomendasi"}),
    products, categories, partners, q, categoryId, partnerId, sort, page:currentPage, totalPages, total,
    settings:res.locals.settings || {}
  });
});

/* Public product detail: active catalog items, canonical slug, and related items. */
router.get("/rekomendasi/:slug", (req, res) => {
  const slug = String(req.params.slug || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) return res.status(404).send("Produk tidak ditemukan");
  const db = getDb();
  const item = db.prepare(`SELECT p.*, pt.name AS partner_name, ct.name AS category_name
      FROM affiliate_products p LEFT JOIN affiliate_partners pt ON pt.id=p.partner_id
      LEFT JOIN affiliate_categories ct ON ct.id=p.category_id
      WHERE p.slug=? AND p.is_active=1`).get(slug);
  if (!item) return res.status(404).send("Produk tidak ditemukan");
  let gallery = [];
  try { const raw = JSON.parse(item.images || "[]"); if (Array.isArray(raw)) gallery = raw; } catch (_) {}
  gallery = [item.image, ...gallery].filter(url => typeof url === "string" && isValidHttps(url));
  gallery = [...new Set(gallery)].slice(0, 16);
  // Prioritize same category, but fill empty slots with other active products.
  // A single-category inventory must not make recommendations disappear.
  const related = db.prepare(`SELECT p.id,p.name,p.slug,p.image,p.price,
      pt.name AS partner_name, ct.name AS category_name
      FROM affiliate_products p
      LEFT JOIN affiliate_partners pt ON pt.id=p.partner_id
      LEFT JOIN affiliate_categories ct ON ct.id=p.category_id
      WHERE p.is_active=1 AND p.id<>? AND p.slug IS NOT NULL AND p.slug<>''
      ORDER BY CASE WHEN p.category_id IS ? THEN 0 ELSE 1 END,
               p.is_featured DESC,p.updated_at DESC,p.id DESC LIMIT 8`).all(item.id,item.category_id);
  const base = String(res.locals.baseUrl || '').replace(/\/$/, '');
  const productPath = `/rekomendasi/${encodeURIComponent(item.slug)}`;
  const priceValue = Number(String(item.price || '').replace(/[^\d]/g, ''));
  const jsonLd = {
    '@type':'Product', name:item.name, description:(item.meta_description || item.description || item.name).slice(0,500),
    url:base+productPath,
    ...(gallery.length ? {image:gallery} : {}),
    ...(item.partner_name ? {brand:{'@type':'Brand',name:item.partner_name}} : {}),
    ...(priceValue > 0 ? {offers:{'@type':'Offer',priceCurrency:'IDR',price:priceValue.toString(),url:base+`/go/${item.id}?p=detail`,seller:{'@type':'Organization',name:item.partner_name||'Marketplace'}}} : {})
  };
  return res.render('affiliate-detail', {
    settings:res.locals.settings || {}, item,gallery,related,
    seo:buildSeo({title:item.meta_title||item.name,description:item.meta_description||item.description||item.name,
      canonical:productPath,image:gallery[0]||undefined,type:'product',jsonLd}),
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
  const db = getDb();
  const items = db.prepare("SELECT * FROM affiliate_products ORDER BY updated_at DESC").all();
  const partners = db.prepare("SELECT * FROM affiliate_partners WHERE is_active=1 ORDER BY name").all();
  const categories = db.prepare("SELECT * FROM affiliate_categories ORDER BY name").all();
  res.render("admin-affiliate-products", { seo: buildSeo({ title: "Affiliate Products", noindex: true }), items, item: null, partners, categories });
});

router.post("/admin/affiliate/products/save", (req, res) => {
  const db = getDb();
  const id = req.body.id ? safeId(req.body.id) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1 || !db.prepare("SELECT id FROM affiliate_products WHERE id=?").get(id))) return res.status(404).send("Produk tidak ditemukan");
  const name = clean(req.body.name);
  const affiliate_url = clean(req.body.affiliate_url);
  if (!name || !isValidHttps(affiliate_url)) {
    return res.redirect("/admin/affiliate/products?error=invalid");
  }
  if (req.body.image && !isValidHttps(clean(req.body.image))) return res.status(400).send("URL gambar wajib HTTPS valid");
  const images = clean(req.body.images || "").split(/[\n,]/).map(clean).filter(Boolean);
  if (images.some(x => !isValidHttps(x))) return res.status(400).send("Semua URL galeri wajib HTTPS valid");
  let partner_id, category_id;
  try {
    partner_id = optionalId(db, "affiliate_partners", req.body.partner_id);
    category_id = optionalId(db, "affiliate_categories", req.body.category_id);
  } catch (error) { return res.status(400).send(error.message); }
  const payload = {
    id, name,
    slug: makeSlug(req.body.slug || name),
    description: clean(req.body.description),
    partner_id,
    category_id,
    image: clean(req.body.image),
    images: JSON.stringify(images),
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
  res.render("admin-affiliate-partners", { seo: buildSeo({ title: "Partners", noindex: true }), items, item: null });
});

router.get("/admin/affiliate/products/edit/:id", (req, res) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM affiliate_products WHERE id=?").get(req.params.id);
  if (!item) return res.status(404).send("Produk tidak ditemukan");
  res.render("admin-affiliate-products", {seo: buildSeo({title:"Edit Product",noindex:true}), item,
    items:db.prepare("SELECT * FROM affiliate_products ORDER BY updated_at DESC").all(),
    partners:db.prepare("SELECT * FROM affiliate_partners WHERE is_active=1 ORDER BY name").all(),
    categories:db.prepare("SELECT * FROM affiliate_categories ORDER BY name").all()});
});
router.post("/admin/affiliate/products/archive/:id", (req,res) => {
  const result=getDb().prepare("UPDATE affiliate_products SET is_active=0 WHERE id=?").run(req.params.id);
  if (!result.changes) return res.status(404).send("Produk tidak ditemukan");
  res.redirect("/admin/affiliate/products");
});
router.get("/admin/affiliate/partners/edit/:id", (req,res) => {
  const db=getDb(), item=db.prepare("SELECT * FROM affiliate_partners WHERE id=?").get(req.params.id);
  if (!item) return res.status(404).send("Partner tidak ditemukan");
  res.render("admin-affiliate-partners", {seo:buildSeo({title:"Edit Partner",noindex:true}),item,items:db.prepare("SELECT * FROM affiliate_partners ORDER BY name").all()});
});
router.post("/admin/affiliate/partners/save", (req, res) => {
  const db=getDb(), id=req.body.id ? safeId(req.body.id) : null, name=clean(req.body.name);
  const website=clean(req.body.website), logo=clean(req.body.logo);
  if ((req.body.id && !id) || !name || (website && !isValidHttps(website)) || (logo && !isValidHttps(logo)) || (req.body.affiliate_base_url && !isValidHttps(clean(req.body.affiliate_base_url)))) return res.status(400).send("Data partner tidak valid");
  const data={id,name,slug:makeSlug(req.body.slug||name),type:clean(req.body.type)||"custom",website,affiliate_base_url:clean(req.body.affiliate_base_url),is_active:req.body.is_active?1:0,logo};
  if (id) {
    if (!Number.isSafeInteger(id) || id<1) return res.status(400).send("ID tidak valid");
    const r=db.prepare(`UPDATE affiliate_partners SET name=@name,slug=@slug,type=@type,website=@website,affiliate_base_url=@affiliate_base_url,is_active=@is_active,logo=@logo WHERE id=@id`).run(data);
    if (!r.changes) return res.status(404).send("Partner tidak ditemukan");
  } else db.prepare(`INSERT INTO affiliate_partners(name,slug,type,website,affiliate_base_url,is_active,logo) VALUES(@name,@slug,@type,@website,@affiliate_base_url,@is_active,@logo)`).run(data);
  res.redirect("/admin/affiliate/partners");
});
router.post("/admin/affiliate/partners/archive/:id", (req,res) => {
  const r=getDb().prepare("UPDATE affiliate_partners SET is_active=0 WHERE id=?").run(req.params.id);
  if(!r.changes) return res.status(404).send("Partner tidak ditemukan");
  res.redirect("/admin/affiliate/partners");
});

const modules = {
 categories:{table:"affiliate_categories",title:"Categories",fields:["name","slug"]},
 placements:{table:"affiliate_placements",title:"Placements",fields:["product_id","placement_key","priority","is_active"]},
 campaigns:{table:"affiliate_campaigns",title:"Campaigns",fields:["name","banner_image","partner_id","affiliate_url","placement_key","priority","start_date","end_date","is_active"]}
};
for(const [key, config] of Object.entries(modules)) {
 const base=`/admin/affiliate/${key}`;
 const render=(req,res,item=null)=>{
   const db=getDb();
   res.render("admin-affiliate-generic",{seo:buildSeo({title:config.title,noindex:true}),moduleKey:key,config,item,
     items:db.prepare(`SELECT * FROM ${config.table} ORDER BY id DESC LIMIT 200`).all(),
     products:db.prepare("SELECT id,name FROM affiliate_products ORDER BY name").all(),
     partners:db.prepare("SELECT id,name FROM affiliate_partners ORDER BY name").all()});
 };
 router.get(base,(req,res)=>render(req,res));
 router.get(`${base}/edit/:id`,(req,res)=>{
  const item=getDb().prepare(`SELECT * FROM ${config.table} WHERE id=?`).get(req.params.id);
  if(!item) return res.status(404).send("Data tidak ditemukan");
  render(req,res,item);
 });
 router.post(`${base}/save`,(req,res)=>{
  const db=getDb(), id=req.body.id?safeId(req.body.id):null;
  if(req.body.id && !id) return res.status(400).send("ID tidak valid");
  const payload={id};
  for(const field of config.fields){
   let value=clean(req.body[field]);
   if (["is_active","priority","product_id","partner_id"].includes(field)) {
     value=field==="is_active"?(req.body[field]?1:0):(value?Number(value):field==="priority"?0:null);
     if(field!=="is_active" && value!==null && (!Number.isSafeInteger(value)||value<0)) return res.status(400).send("Nilai angka tidak valid");
   }
   if(["banner_image","affiliate_url"].includes(field) && value && !isValidHttps(value)) return res.status(400).send("URL wajib HTTPS");
   payload[field]=field==="slug"?makeSlug(value||req.body.name):value;
  }
  if(config.fields.includes("name") && !payload.name) return res.status(400).send("Nama wajib diisi");
  if(config.fields.includes("placement_key") && !payload.placement_key) return res.status(400).send("Placement wajib diisi");
  for (const field of ["product_id", "partner_id"]) {
    if (config.fields.includes(field) && payload[field]) {
      const table = field === "product_id" ? "affiliate_products" : "affiliate_partners";
      if (!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(payload[field])) return res.status(400).send("Referensi tidak ditemukan");
    }
  }
  const cols=config.fields;
  if(id){const stmt=db.prepare(`UPDATE ${config.table} SET ${cols.map(x=>`${x}=@${x}`).join(",")} WHERE id=@id`);
    if(!stmt.run(payload).changes) return res.status(404).send("Data tidak ditemukan");
  }else db.prepare(`INSERT INTO ${config.table} (${cols.join(",")}) VALUES (${cols.map(x=>`@${x}`).join(",")})`).run(payload);
  res.redirect(base);
 });
 router.post(`${base}/delete/:id`,(req,res)=>{
  const db=getDb();
  const result=config.fields.includes("is_active")?db.prepare(`UPDATE ${config.table} SET is_active=0 WHERE id=?`).run(req.params.id):db.prepare(`DELETE FROM ${config.table} WHERE id=?`).run(req.params.id);
  if(!result.changes) return res.status(404).send("Data tidak ditemukan");
  res.redirect(base);
 });
}
router.get("/admin/affiliate/clicks",(req,res)=>{
  const items=getDb().prepare("SELECT * FROM affiliate_clicks ORDER BY id DESC LIMIT 500").all();
  res.render("admin-affiliate-reports",{seo:buildSeo({title:"Click Analytics",noindex:true}),items,title:"Click Analytics"});
});
router.get("/admin/affiliate/conversions",(req,res)=>{
  const items=getDb().prepare("SELECT * FROM affiliate_conversions ORDER BY id DESC LIMIT 500").all();
  res.render("admin-affiliate-reports",{seo:buildSeo({title:"Conversions",noindex:true}),items,title:"Conversions (verified imports only)"});
});
module.exports = router;
