const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { makeSlug, excerpt } = require("./helpers");

let db;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false; // legacy plain
  const [salt, hash] = stored.split(":");
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}

function initDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wisata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      images TEXT,
      location TEXT,
      ticket_price TEXT,
      open_hours TEXT,
      maps_url TEXT,
      meta_title TEXT,
      meta_description TEXT,
      is_featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'publish',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS villa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      images TEXT,
      price TEXT,
      location TEXT,
      facilities TEXT,
      capacity TEXT,
      booking_url TEXT,
      contact_phone TEXT,
      maps_url TEXT,
      meta_title TEXT,
      meta_description TEXT,
      is_featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'publish',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kuliner (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      images TEXT,
      location TEXT,
      price_range TEXT,
      open_hours TEXT,
      contact_phone TEXT,
      maps_url TEXT,
      meta_title TEXT,
      meta_description TEXT,
      is_featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'publish',
      category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      images TEXT,
      category TEXT DEFAULT 'berita',
      status TEXT DEFAULT 'publish',
      meta_title TEXT,
      meta_description TEXT,
      published_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      comment TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT,
      rating INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      site_name TEXT DEFAULT 'Wisata Berastagi',
      site_tagline TEXT DEFAULT 'Panduan wisata Berastagi terlengkap',
      contact_phone TEXT DEFAULT '0812-0000-0000',
      contact_email TEXT DEFAULT 'info@wisataberastagi.com',
      address TEXT DEFAULT 'Berastagi, Kabupaten Karo, Sumatera Utara',
      footer_text TEXT DEFAULT 'Portal panduan wisata Berastagi yang informatif, rapi, dan mudah dipahami.',
      homepage_title TEXT DEFAULT 'Wisata Berastagi Terlengkap | Tempat Wisata, Villa, Hotel & Kuliner Terbaik',
      homepage_meta_description TEXT DEFAULT 'Temukan tempat wisata di Berastagi, villa dan hotel nyaman, kuliner favorit, berita terbaru, serta panduan liburan lengkap di Kabupaten Karo, Sumatera Utara.',
      hero_title TEXT DEFAULT 'Wisata Berastagi Terlengkap untuk Liburan Keluarga, Healing, dan Jelajah Alam',
      hero_subtitle TEXT DEFAULT 'Cari tempat wisata Berastagi populer, villa dan hotel nyaman, kuliner khas Karo, serta panduan liburan lengkap dalam satu website yang rapi dan mudah digunakan.',
      hero_background TEXT DEFAULT '/images/wisata-berastagi-cover.jpg',
      logo TEXT DEFAULT '/favicon/favicon-512x512.png',
      favicon TEXT DEFAULT '/favicon/favicon.ico',
      whatsapp TEXT,
      social_facebook TEXT,
      social_instagram TEXT,
      social_twitter TEXT,
      google_analytics TEXT
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      slug TEXT,
      image TEXT NOT NULL,
      alt_text TEXT,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  runMigrations();

  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD;
if (!adminPass) {
    console.error("FATAL: ADMIN_PASSWORD must be set in environment.");
    process.exit(1);
  } // better default, force change

  const userExists = db.prepare("SELECT id, password FROM users WHERE username = ?").get(adminUser);
  if (!userExists) {
    const hashed = hashPassword(adminPass);
    db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(adminUser, hashed);
    console.log(`[DB] Created admin user: ${adminUser}`);
  } else if (userExists.password && !userExists.password.includes(":")) {
    // migrate plain to hash
    const hashed = hashPassword(userExists.password);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashed, userExists.id);
    console.log(`[DB] Migrated plain password for ${adminUser}`);
  }

  db.prepare(`
    INSERT OR IGNORE INTO settings (
      id, site_name, site_tagline, contact_phone, contact_email, address, footer_text,
      homepage_title, homepage_meta_description, hero_title, hero_subtitle, hero_background, logo, favicon
    ) VALUES (
      1,
      'Wisata Berastagi',
      'Panduan wisata Berastagi terlengkap',
      '0812-0000-0000',
      'info@wisataberastagi.com',
      'Berastagi, Kabupaten Karo, Sumatera Utara',
      'Portal panduan wisata Berastagi yang informatif, rapi, dan mudah dipahami.',
      'Wisata Berastagi Terlengkap | Tempat Wisata, Villa, Hotel & Kuliner Terbaik',
      'Temukan tempat wisata di Berastagi, villa dan hotel nyaman, kuliner favorit, berita terbaru, serta panduan liburan lengkap di Kabupaten Karo, Sumatera Utara.',
      'Wisata Berastagi Terlengkap untuk Liburan Keluarga, Healing, dan Jelajah Alam',
      'Cari tempat wisata Berastagi populer, villa dan hotel nyaman, kuliner khas Karo, serta panduan liburan lengkap dalam satu website yang rapi dan mudah digunakan.',
      '/images/wisata-berastagi-cover.jpg',
      '/favicon/favicon-512x512.png',
      '/favicon/favicon.ico'
    )
  `).run();

  seedData();
  ensureAffiliateTables();
  return db;
}

function getDb() {
  if (!db) throw new Error("Database belum diinisialisasi.");
  return db;
}

function hasColumn(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((col) => col.name === columnName);
}

function addColumnIfNotExists(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function runSafeUpdate(sql) {
  try {
    db.exec(sql);
  } catch (error) {
    console.error("Migration warning:", error.message);
  }
}

function runMigrations() {
  addColumnIfNotExists("wisata", "images", "TEXT");
  addColumnIfNotExists("wisata", "status", "TEXT DEFAULT 'publish'");
  addColumnIfNotExists("villa", "images", "TEXT");
  addColumnIfNotExists("villa", "capacity", "TEXT");
  addColumnIfNotExists("villa", "status", "TEXT DEFAULT 'publish'");
  addColumnIfNotExists("kuliner", "images", "TEXT");
  addColumnIfNotExists("kuliner", "status", "TEXT DEFAULT 'publish'");
  addColumnIfNotExists("kuliner", "category", "TEXT");
  addColumnIfNotExists("articles", "images", "TEXT");
  addColumnIfNotExists("settings", "favicon", "TEXT DEFAULT '/favicon/favicon.ico'");
  addColumnIfNotExists("settings", "whatsapp", "TEXT");
  addColumnIfNotExists("settings", "social_facebook", "TEXT");
  addColumnIfNotExists("settings", "social_instagram", "TEXT");
  addColumnIfNotExists("settings", "social_twitter", "TEXT");
  addColumnIfNotExists("settings", "google_analytics", "TEXT");
  addColumnIfNotExists("gallery", "slug", "TEXT");
  addColumnIfNotExists("gallery", "alt_text", "TEXT");
  addColumnIfNotExists("gallery", "caption", "TEXT");
  addColumnIfNotExists("gallery", "sort_order", "INTEGER DEFAULT 0");
  addColumnIfNotExists("gallery", "is_active", "INTEGER DEFAULT 1");

  runSafeUpdate(`UPDATE wisata SET images = '[]' WHERE images IS NULL OR TRIM(images) = ''`);
  runSafeUpdate(`UPDATE villa SET images = '[]' WHERE images IS NULL OR TRIM(images) = ''`);
  runSafeUpdate(`UPDATE kuliner SET images = '[]' WHERE images IS NULL OR TRIM(images) = ''`);
  runSafeUpdate(`UPDATE articles SET images = '[]' WHERE images IS NULL OR TRIM(images) = ''`);
  runSafeUpdate(`UPDATE articles SET category = 'berita' WHERE category IS NULL OR TRIM(category) = ''`);
  runSafeUpdate(`UPDATE articles SET status = 'publish' WHERE status IS NULL OR TRIM(status) = ''`);
  runSafeUpdate(`UPDATE articles SET published_at = created_at WHERE (published_at IS NULL OR TRIM(published_at) = '') AND created_at IS NOT NULL`);
  runSafeUpdate(`UPDATE articles SET updated_at = created_at WHERE (updated_at IS NULL OR TRIM(updated_at) = '') AND created_at IS NOT NULL`);
  runSafeUpdate(`UPDATE settings SET logo = '/favicon/favicon-512x512.png' WHERE logo IS NULL OR TRIM(logo) = ''`);
  runSafeUpdate(`UPDATE settings SET favicon = '/favicon/favicon.ico' WHERE favicon IS NULL OR TRIM(favicon) = ''`);
}

function seedData() {
  const _db = getDb();
  const defaultImage = "/images/wisata-berastagi-cover.jpg";

  const wisataCount = _db.prepare("SELECT COUNT(*) as total FROM wisata").get().total;
  if (!wisataCount) {
    const insert = _db.prepare(`
      INSERT INTO wisata (
        title, slug, excerpt, content, image, images, location, ticket_price, open_hours, maps_url,
        meta_title, meta_description, is_featured, status
      ) VALUES (
        @title, @slug, @excerpt, @content, @image, @images, @location, @ticket_price, @open_hours, @maps_url,
        @meta_title, @meta_description, @is_featured, @status
      )
    `);

    [
      {
        title: "Gunung Sibayak",
        content: "Gunung Sibayak adalah salah satu tempat wisata Berastagi paling populer untuk pendaki pemula, pemburu sunrise, dan wisatawan yang ingin menikmati panorama pegunungan dataran tinggi Karo.",
        image: defaultImage,
        images: "[]",
        location: "Berastagi, Kabupaten Karo",
        ticket_price: "25000",
        open_hours: "24 jam",
        maps_url: "https://maps.google.com",
        is_featured: 1,
        status: "publish"
      },
      {
        title: "Bukit Gundaling",
        content: "Bukit Gundaling menjadi destinasi wisata Berastagi favorit untuk menikmati udara sejuk, panorama pegunungan, dan suasana santai yang cocok untuk keluarga maupun pasangan.",
        image: defaultImage,
        images: "[]",
        location: "Berastagi, Kabupaten Karo",
        ticket_price: "15000",
        open_hours: "08.00 - 18.00",
        maps_url: "https://maps.google.com",
        is_featured: 1,
        status: "publish"
      }
    ].forEach((item) => {
      const slug = makeSlug(item.title);
      insert.run({
        ...item,
        slug,
        excerpt: excerpt(item.content, 150),
        meta_title: item.title + " | Wisata Berastagi",
        meta_description: excerpt(item.content, 160)
      });
    });
  }

  // similar seed for others if empty - abbreviated for brevity, original had more
  const villaCount = _db.prepare("SELECT COUNT(*) as total FROM villa").get().total;
  if (!villaCount) {
    // seed one sample
    const slug = makeSlug("Villa Contoh Berastagi");
    _db.prepare(`INSERT INTO villa (title, slug, excerpt, content, image, images, price, location, is_featured, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'publish')`)
      .run("Villa Contoh Berastagi", slug, "Villa nyaman", "Deskripsi villa contoh", defaultImage, "[]", "500000", "Berastagi");
  }

  const kulinerCount = _db.prepare("SELECT COUNT(*) as total FROM kuliner").get().total;
  if (!kulinerCount) {
    const slug = makeSlug("Kuliner Contoh");
    _db.prepare(`INSERT INTO kuliner (title, slug, excerpt, content, image, images, location, price_range, is_featured, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'publish')`)
      .run("Kuliner Contoh", slug, "Makanan khas", "Deskripsi", defaultImage, "[]", "Berastagi", "20000-50000");
  }

  const articleCount = _db.prepare("SELECT COUNT(*) as total FROM articles").get().total;
  if (!articleCount) {
    const slug = makeSlug("Berita Contoh");
    _db.prepare(`INSERT INTO articles (title, slug, excerpt, content, image, images, status, meta_title) VALUES (?, ?, ?, ?, ?, ?, 'publish', ?)`)
      .run("Berita Contoh", slug, "Berita", "Konten berita", defaultImage, "[]", "Berita Contoh | MWG24");
  }
}

module.exports = { initDb, getDb, hashPassword, verifyPassword };
// Affiliate tables (idempotent)
function ensureAffiliateTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT UNIQUE,
      type TEXT DEFAULT 'custom',
      website TEXT,
      affiliate_base_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS affiliate_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS affiliate_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      partner_id INTEGER,
      category_id INTEGER,
      image TEXT,
      images TEXT,
      affiliate_url TEXT NOT NULL,
      price TEXT,
      currency TEXT DEFAULT 'IDR',
      product_type TEXT,
      is_active INTEGER DEFAULT 1,
      is_featured INTEGER DEFAULT 0,
      meta_title TEXT,
      meta_description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(partner_id) REFERENCES affiliate_partners(id),
      FOREIGN KEY(category_id) REFERENCES affiliate_categories(id)
    );

    CREATE TABLE IF NOT EXISTS affiliate_placements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      placement_key TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES affiliate_products(id)
    );

    CREATE TABLE IF NOT EXISTS affiliate_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      banner_image TEXT,
      partner_id INTEGER,
      affiliate_url TEXT,
      placement_key TEXT,
      priority INTEGER DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(partner_id) REFERENCES affiliate_partners(id)
    );

    CREATE TABLE IF NOT EXISTS affiliate_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      placement_key TEXT,
      referrer TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES affiliate_products(id)
    );

    CREATE TABLE IF NOT EXISTS affiliate_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER,
      transaction_id TEXT UNIQUE,
      transaction_date TEXT,
      commission TEXT,
      currency TEXT DEFAULT 'IDR',
      status TEXT DEFAULT 'pending',
      source TEXT,
      import_batch TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(partner_id) REFERENCES affiliate_partners(id)
    );
  `);
  addColumnIfNotExists("affiliate_partners", "logo", "TEXT");
  console.log("[DB] Affiliate tables ensured");
}

// Call after main init
const originalInit = initDb;
// Re-export with wrapper if needed; for simplicity call from app or here
module.exports.ensureAffiliateTables = ensureAffiliateTables;
