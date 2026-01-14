import fetch from 'node-fetch';

app.get('/api/proxy', async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    // ✅ Validate URL
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // ❌ Block unsafe protocols
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return res.status(400).json({ error: 'Unsupported protocol' });
    }

    console.log('Proxying:', targetUrl.href);

    const response = await fetch(targetUrl.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*'
      },
      redirect: 'follow'
    });

    const contentType = response.headers.get('content-type') || '';

    // 🚫 Headers that CRASH Vercel
    const blockedHeaders = [
      'x-frame-options',
      'content-security-policy',
      'content-security-policy-report-only',
      'content-encoding',
      'transfer-encoding',
      'connection'
    ];

    response.headers.forEach((value, key) => {
      if (!blockedHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // ✅ Allow iframe + CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');

    // ===== HTML =====
    if (contentType.includes('text/html')) {
      let html = await response.text();

      // Remove CSP meta tags
      html = html.replace(
        /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
        ''
      );

      const baseUrl = targetUrl.href;

      // Rewrite links
      html = html.replace(
        /(href|src|action)=["']([^"']+)["']/gi,
        (match, attr, link) => {
          try {
            if (
              link.startsWith('data:') ||
              link.startsWith('javascript:') ||
              link.startsWith('mailto:') ||
              link.startsWith('#')
            ) {
              return match;
            }

            const absolute = new URL(link, baseUrl).href;
            return `${attr}="/api/proxy?url=${encodeURIComponent(absolute)}"`;
          } catch {
            return match;
          }
        }
      );

      // Rewrite CSS url()
      html = html.replace(
        /url\(["']?([^"')]+)["']?\)/gi,
        (match, link) => {
          try {
            if (link.startsWith('data:')) return match;
            const absolute = new URL(link, baseUrl).href;
            return `url("/api/proxy?url=${encodeURIComponent(absolute)}")`;
          } catch {
            return match;
          }
        }
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // ===== NON-HTML =====
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.send(buffer);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({
      error: 'Proxy failed',
      message: err.message
    });
  }
});
