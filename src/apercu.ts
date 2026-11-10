// Petit serveur local pour voir le site généré : http://localhost:4000
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve("dist");
const PORT = Number(process.env.PORT ?? 4000);
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8" };

http
  .createServer((req, res) => {
    const demande = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    let fichier = path.resolve(RACINE, "." + demande);
    if (!fichier.startsWith(RACINE)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(fichier) && fs.statSync(fichier).isDirectory()) fichier = path.join(fichier, "index.html");
    if (!fs.existsSync(fichier)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Page introuvable");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fichier)] ?? "application/octet-stream" });
    fs.createReadStream(fichier).pipe(res);
  })
  .listen(PORT, () => console.log(`Aperçu du site : http://localhost:${PORT}`));
