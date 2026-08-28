#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { isFuturePublishDate } = require("./blog-dates");

const root = path.join(__dirname, "..");
const site = path.join(root, "_site");

let failed = false;

function listingFiles() {
  const fromArgs = process.argv.slice(2);
  if (fromArgs.length) return fromArgs;
  return [
    path.join(site, "blog", "index.html"),
    path.join(site, "es", "blog", "index.html"),
  ];
}

for (const file of listingFiles()) {
  if (!fs.existsSync(file)) {
    console.error(`Missing build output: ${file}`);
    failed = true;
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  const dates = [
    ...html.matchAll(
      /<span\b[^>]*\bclass="[^"]*\bcard-date\b[^"]*"[^>]*>\s*([^<]+?)\s*</gi
    ),
  ];
  const future = dates
    .map((m) => m[1].trim())
    .filter((ymd) => isFuturePublishDate(ymd));
  if (future.length) {
    console.error(`${file} still lists future dates: ${future.join(", ")}`);
    failed = true;
  } else {
    console.log(`${file}: no future-dated cards`);
  }
}

for (const dir of ["blog", "es/blog"]) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs)) {
    if (!name.endsWith(".md")) continue;
    const text = fs.readFileSync(path.join(abs, name), "utf8");
    const dateMatch = text.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
    const permalinkMatch = text.match(/^permalink:\s*(\S+)/m);
    if (!dateMatch || !permalinkMatch) continue;
    if (!isFuturePublishDate(dateMatch[1])) continue;
    const permalink = permalinkMatch[1].replace(/^\/+|\/+$/g, "");
    const out = path.join(site, permalink, "index.html");
    if (!fs.existsSync(out)) {
      console.error(`Scheduled post missing (site-health 404): ${out}`);
      failed = true;
      continue;
    }
    const page = fs.readFileSync(out, "utf8");
    if (!/name=["']robots["'][^>]*content=["']noindex/i.test(page) &&
        !/content=["']noindex[^"']*["'][^>]*name=["']robots["']/i.test(page)) {
      console.error(`Scheduled post is missing noindex: ${out}`);
      failed = true;
    } else {
      console.log(`reachable + noindex until ${dateMatch[1]}: /${permalink}/`);
    }
  }
}

if (failed) process.exit(1);
