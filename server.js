export default async function handler(req, res) {
  const target = req.query.url;

  if (!target) {
    return res.status(400).send('Missing ?url=');
  }

  let url;
  try {
    url = new URL(target);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      redirect: 'follow',
    });

    const contentType =
      response.headers.get('content-type') || 'text/html';

    const buffer = await response.arrayBuffer();

    // Strip blocking headers
    res.setHeader('content-type', contentType);
    res.setHeader('access-control-allow-origin', '*');

    res.status(response.status).send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).send('Proxy fetch failed');
  }
}

