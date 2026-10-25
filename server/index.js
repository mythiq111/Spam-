import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import app from "./app.js";
import express from "express";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env file, rely on real environment variables
}

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
