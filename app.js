const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const path = require("path");
const fs = require("fs");

const { initDb, getDb } = require("./lib/db");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const { siteSeoDefaults } = require("./lib/seo");

const app = express();

/* =========================
   ENV
========================= */
const PORT = Number(process.env.PORT) || 3000;
const RAW_BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const BASE_URL = String(RAW_BASE_URL).replace(/\/+$/, "");
const SESSION_SECRET = process.env.SESSION_SECRET || "wisata-secret";
const IS_PROD = process.env.NODE_ENV === "production";

/* =========================
   DIR
========================= */
const DATA_DIR =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : path.join(__dirname, "data");

const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");
const DB_PATH = path.join(DATA_DIR, "database.sqlite");
const SESSION_DB_PATH = path.join(DATA_DIR, "sessions.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(VIEWS_DIR, { recursive: true });

initDb(DB_PATH);

app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);
app.set("trust proxy", 1);
app.disable("x-powered-by");

/* =========================
   HELPERS
========================= */
function normalizeUrlPath(urlPath = "/") {
  if (!urlPath || urlPath === "/") return "/";
  return urlPath.replace(/\/+$/, "") || "/";
}

function getRequestBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function cleanCanonical(baseUrl, req) {
  const pathname = normalizeUrlPath(req.path);
  return `${baseUrl}${pathname === "/" ? "/" : pathname}`;
}

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function lastmod(value) {
  try {
    return new Date(value).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/* =========================
   SECURITY HEADERS
========================= */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

/* =========================
   CANONICAL FIX + REDIRECT
========================= */
app.use((req, res, next) => {
  const requestBase = getRequestBaseUrl(req);

  if (IS_PROD && requestBase !== BASE_URL) {
    return res.redirect(301, BASE_URL + req.originalUrl);
  }

  if (req.path.length > 1 && req.path.endsWith("/")) {
    return res.redirect(301, req.path.replace(/\/+$/, ""));
  }

  next();
});

/* =========================
   BODY
========================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* =========================
   STATIC
========================= */
app.use(express.static(PUBLIC_DIR));

/* =========================
   SESSION
========================= */
app.use(
  session({
    store: new SQLiteStore({
      db: path.basename(SESSION_DB_PATH),
      dir: path.dirname(SESSION_DB_PATH)
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: IS_PROD,
      httpOnly: true,
      sameSite: "lax"
    }
  })
);

/* =========================
   GLOBAL SEO LOCALS
========================= */
app.use((req, res, next) => {
  const canonical = cleanCanonical(BASE_URL, req);

  res.locals.baseUrl = BASE_URL;
  res.locals.canonical = canonical;

  res.locals.seo = {
    title: "Wisata Berastagi Terlengkap",
    description: "Tempat wisata, villa, kuliner, berita Berastagi terbaru",
    canonical,
    image: `${BASE_URL}/images/cover.jpg`,
    noindex: false
  };

  next();
});

/* =========================
   ROBOTS
========================= */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
`User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${BASE_URL}/sitemap.xml`
  );
});

/* =========================
   SITEMAP
========================= */
app.get("/sitemap.xml", (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();

  const tables = [
    { name: "wisata", path: "wisata" },
    { name: "villa", path: "villa" },
    { name: "kuliner", path: "kuliner" },
    { name: "articles", path: "berita" }
  ];

  let urls = `
<url>
<loc>${BASE_URL}/</loc>
<lastmod>${now}</lastmod>
</url>`;

  tables.forEach((t) => {
    const rows = db
      .prepare(`SELECT slug, COALESCE(updated_at, created_at) as updated_at FROM ${t.name}`)
      .all();

    rows.forEach((r) => {
      urls += `
<url>
<loc>${xmlEscape(`${BASE_URL}/${t.path}/${r.slug}`)}</loc>
<lastmod>${lastmod(r.updated_at)}</lastmod>
</url>`;
    });
  });

  res.header("Content-Type", "application/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`);
});

/* =========================
   ROUTES
========================= */
app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).render("about", {
    seo: {
      title: "404 Halaman Tidak Ditemukan",
      description: "Halaman tidak ditemukan",
      canonical: BASE_URL + req.path,
      noindex: true
    }
  });
});

/* =========================
   ERROR
========================= */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("about", {
    seo: {
      title: "Error Server",
      description: "Terjadi kesalahan",
      canonical: BASE_URL + req.path,
      noindex: true
    }
  });
});

app.listen(PORT, () => {
  console.log("RUNNING:", BASE_URL);
});
