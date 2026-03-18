const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const path = require("path");
const fs = require("fs");

const { initDb } = require("./lib/db");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const { siteSeoDefaults } = require("./lib/seo");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const RAW_BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const BASE_URL = String(RAW_BASE_URL).replace(/\/+$/, "");
const SESSION_SECRET = process.env.SESSION_SECRET || "wisata-berastagi-secret";
const IS_PROD = process.env.NODE_ENV === "production";

const DATA_DIR =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : path.join(__dirname, "data");

const UPLOADS_DIR =
  process.env.DATA_DIR && fs.existsSync(process.env.DATA_DIR)
    ? path.join(process.env.DATA_DIR, "uploads")
    : path.join(__dirname, "uploads");

const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");
const DB_PATH = path.join(DATA_DIR, "database.sqlite");
const SESSION_DB_PATH = path.join(DATA_DIR, "sessions.sqlite");

const REQUIRED_DIRS = [
  DATA_DIR,
  UPLOADS_DIR,
  PUBLIC_DIR,
  VIEWS_DIR,
  path.join(PUBLIC_DIR, "css"),
  path.join(PUBLIC_DIR, "js"),
  path.join(PUBLIC_DIR, "images"),
  path.join(PUBLIC_DIR, "favicon"),
  path.join(UPLOADS_DIR, "wisata"),
  path.join(UPLOADS_DIR, "villa"),
  path.join(UPLOADS_DIR, "kuliner"),
  path.join(UPLOADS_DIR, "berita"),
  path.join(UPLOADS_DIR, "general")
];

for (const dir of REQUIRED_DIRS) {
  fs.mkdirSync(dir, { recursive: true });
}

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
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto ? String(forwardedProto).split(",")[0].trim() : req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function shouldRedirectToBase(req) {
  if (!IS_PROD) return false;
  const requestBase = getRequestBaseUrl(req);
  return requestBase !== BASE_URL;
}

function cleanCanonical(baseUrl, req) {
  const pathname = normalizeUrlPath(req.path);
  const queryString = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";
  return `${baseUrl}${pathname === "/" ? "/" : pathname}${queryString}`;
}

function defaultSettingsFallback() {
  return {
    site_name: "Wisata Berastagi",
    site_tagline: "Panduan wisata Berastagi terlengkap"
  };
}

/* =========================
   BASIC SECURITY / PERFORMANCE HEADERS
========================= */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});

/* =========================
   CANONICAL HOST + TRAILING SLASH REDIRECT
========================= */
app.use((req, res, next) => {
  if (shouldRedirectToBase(req)) {
    const target = `${BASE_URL}${req.originalUrl}`;
    return res.redirect(301, target);
  }

  if (
    req.path.length > 1 &&
    req.path.endsWith("/") &&
    !req.path.startsWith("/admin")
  ) {
    const query = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
      : "";
    const normalizedPath = req.path.replace(/\/+$/, "");
    return res.redirect(301, `${normalizedPath}${query}`);
  }

  next();
});

app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.json({ limit: "20mb" }));

/* =========================
   STATIC FILES
========================= */
app.use(
  express.static(PUBLIC_DIR, {
    etag: true,
    lastModified: true,
    maxAge: IS_PROD ? "7d" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css; charset=UTF-8");
      }

      if (/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(filePath)) {
        res.setHeader("Cache-Control", IS_PROD ? "public, max-age=604800, stale-while-revalidate=86400" : "no-cache");
      }
    }
  })
);

app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    etag: true,
    lastModified: true,
    maxAge: IS_PROD ? "7d" : 0,
    fallthrough: true,
    setHeaders(res) {
      res.setHeader(
        "Cache-Control",
        IS_PROD ? "public, max-age=604800, stale-while-revalidate=86400" : "no-cache"
      );
    }
  })
);

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
    rolling: true,
    proxy: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD
    }
  })
);

/* =========================
   APP LOCALS
========================= */
app.locals.baseUrl = BASE_URL;
app.locals.site = siteSeoDefaults();
app.locals.currentYear = new Date().getFullYear();

/* =========================
   GLOBAL LOCALS
========================= */
app.use((req, res, next) => {
  const normalizedPath = normalizeUrlPath(req.path);

  res.locals.baseUrl = BASE_URL;
  res.locals.path = normalizedPath;
  res.locals.query = req.query;
  res.locals.session = req.session;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.requestUrl = `${BASE_URL}${req.originalUrl}`;
  res.locals.canonicalUrl = cleanCanonical(BASE_URL, req);

  res.locals.seoDefaults = {
    title: "Wisata Berastagi Terlengkap – Tempat Wisata, Villa, Hotel, Kuliner & Panduan Liburan",
    description:
      "Wisata Berastagi adalah panduan lengkap tempat wisata di Berastagi Sumatera Utara, mulai dari destinasi populer, villa dan hotel, kuliner, berita, hingga tips liburan terbaik.",
    canonical: `${BASE_URL}${normalizedPath === "/" ? "/" : normalizedPath}`
  };

  next();
});

/* =========================
   ROUTES
========================= */
app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

/* =========================
   SYSTEM ROUTES
========================= */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain; charset=UTF-8").send(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /cari

Sitemap: ${BASE_URL}/sitemap.xml`
  );
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    site: "Wisata Berastagi",
    baseUrl: BASE_URL,
    uploadsDir: UPLOADS_DIR,
    environment: process.env.NODE_ENV || "development"
  });
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).render("about", {
    settings: defaultSettingsFallback(),
    seo: {
      title: "Halaman Tidak Ditemukan | Wisata Berastagi",
      description: "Halaman yang kamu cari tidak tersedia di website Wisata Berastagi.",
      canonical: `${BASE_URL}${normalizeUrlPath(req.path)}`,
      noindex: true
    },
    pageTitle: "404 - Halaman Tidak Ditemukan",
    pageContent:
      "Maaf, halaman yang kamu cari tidak tersedia atau mungkin sudah dipindahkan."
  });
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("APP ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).render("about", {
    settings: defaultSettingsFallback(),
    seo: {
      title: "Terjadi Kesalahan | Wisata Berastagi",
      description: "Terjadi kendala pada website Wisata Berastagi.",
      canonical: `${BASE_URL}${normalizeUrlPath(req.path)}`,
      noindex: true
    },
    pageTitle: "500 - Terjadi Kesalahan",
    pageContent:
      "Maaf, sedang terjadi kendala pada sistem. Silakan coba lagi beberapa saat."
  });
});

app.listen(PORT, () => {
  console.log(`WisataBerastagi running on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log(`Uploads dir: ${UPLOADS_DIR}`);
});
