import { JSDOM } from "jsdom";

export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing ?url=");

  let url;
  try {
    url = new URL(target);
  } catch {
    return res.status(400).send("Invalid URL");
  }

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    redirect: "follow",
  });

  const contentType = response.headers.get("content-type") || "";

  // 🔥 Non-HTML (images, fonts, etc.)
  if (!contentType.includes("text/html")) {
    res.setHeader("content-type", contentType);
    res.setHeader("access-control-allow-origin", "*");
    return res.send(Buffer.from(await response.arrayBuffer()));
  }

  // 🔥 HTML rewrite
  const html = await response.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const rewrite = (attr, el) => {
    const val = el.getAttribute(attr);
    if (!val) return;

    try {
      const abs = new URL(val, url).toString();
      el.setAttribute(
        attr,
        `/api/proxy?url=${encodeURIComponent(abs)}`
      );
    } catch {}
  };

  document.querySelectorAll("img").forEach(el => rewrite("src", el));
  document.querySelectorAll("script").forEach(el => rewrite("src", el));
  document.querySelectorAll("link").forEach(el => rewrite("href", el));

  document.querySelectorAll("style").forEach(style => {
    style.textContent = style.textContent.replace(
      /url\((.*?)\)/g,
      (match, p1) => {
        const clean = p1.replace(/['"]/g, "");
        try {
          const abs = new URL(clean, url).toString();
          return `url(/api/proxy?url=${encodeURIComponent(abs)})`;
        } catch {
          return match;
        }
      }
    );
  });

  res.setHeader("content-type", "text/html");
  res.setHeader("access-control-allow-origin", "*");
  res.send(dom.serialize());
}
