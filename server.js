// Proxy endpoint
app.get('/api/proxy', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    console.log('Proxying:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      redirect: 'follow'
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    // CRITICAL: Remove headers that block iframe embedding
    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'x-content-security-policy',
      'content-security-policy-report-only'
    ];
    
    // Copy headers but exclude blocking ones
    const allowedHeaders = {};
    response.headers.forEach((value, key) => {
      if (!headersToRemove.includes(key.toLowerCase())) {
        allowedHeaders[key] = value;
      }
    });
    
    // Set headers that allow iframe embedding
    res.set(allowedHeaders);
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Handle HTML
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      // Remove any CSP meta tags from HTML
      html = html.replace(
        /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
        ''
      );
      
      // Basic URL rewriting
      const baseUrl = new URL(url);
      
      // Rewrite absolute and relative URLs
      html = html.replace(
        /(href|src|action)=["']([^"']+)["']/gi,
        (match, attr, link) => {
          try {
            if (link.startsWith('data:') || link.startsWith('javascript:') || link.startsWith('mailto:') || link.startsWith('#')) {
              return match;
            }
            
            const absoluteUrl = new URL(link, baseUrl).href;
            return `${attr}="/api/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
          } catch (e) {
            return match;
          }
        }
      );
      
      // Rewrite CSS url() references
      html = html.replace(
        /url\(["']?([^"')]+)["']?\)/gi,
        (match, link) => {
          try {
            if (link.startsWith('data:')) return match;
            const absoluteUrl = new URL(link, baseUrl).href;
            return `url("/api/proxy?url=${encodeURIComponent(absoluteUrl)}")`;
          } catch (e) {
            return match;
          }
        }
      );
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } 
    else {
      const buffer = await response.buffer();
      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    }
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch URL', 
      message: error.message 
    });
  }
});
