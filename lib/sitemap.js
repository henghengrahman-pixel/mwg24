function generateSitemap(baseUrl, articles = []) {
  const urls = [];

  urls.push(`
    <url>
      <loc>${baseUrl}</loc>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
  `);

  urls.push(`
    <url>
      <loc>${baseUrl}/berita</loc>
      <changefreq>daily</changefreq>
      <priority>0.9</priority>
    </url>
  `);

  articles.forEach(article => {
    urls.push(`
      <url>
        <loc>${baseUrl}/berita/${article.slug}</loc>
        <lastmod>${new Date(article.updated_at || article.created_at).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
    `);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join("\n")}
  </urlset>`;
}

module.exports = { generateSitemap };
