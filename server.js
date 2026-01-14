app.get('/api/proxy', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    console.log('Proxying:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow'
    });

    const contentType = response.headers.get('content-type') || '';

    // Remove blocking headers
    const blockedHeaders = [
      'x-frame-options',
      'content-security-policy',
      'content-security-policy-report-only'
    ];

    response.headers.forEach((value, key) => {
      if (!blockedHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Allow iframe + CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');

    // ===== HTML HANDLING =====
    if (contentType.includes('text/html')) {
      let html = await response.text();

      // Remove CSP meta tags
      html = html.replace(
        /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
        ''
      );

      const baseUrl = new URL(url);

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

            const absoluteUrl = new URL(link, baseUrl).href;
            return `${attr}="/api/proxy?url=${encodeURIComponent(
              absoluteUrl
            )}"`;
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
            const absoluteUrl = new URL(link, baseUrl).href;
            return `url("/api/proxy?url=${encodeURIComponent(absoluteUrl)}")`;
          } catch {
            return match;
          }
        }
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // ===== NON-HTML (images, js, css) =====
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.send(buffer);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch URL',
      message: error.message
    });
  }
});
