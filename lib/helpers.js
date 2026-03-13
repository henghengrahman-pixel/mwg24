const slugify = require("slugify");

function makeSlug(text = "") {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: "id",
    trim: true
  });
}

function formatCurrency(value = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function excerpt(text = "", max = 160) {
  const clean = String(text).replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}...`;
}

function avgRating(rows = []) {
  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + Number(row.rating || 0), 0);
  return Number((total / rows.length).toFixed(1));
}

module.exports = {
  makeSlug,
  formatCurrency,
  excerpt,
  avgRating
};
