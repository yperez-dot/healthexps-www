#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  todayYmdET,
  publishYmd,
  isFuturePublishDate,
  isBlogListingOutput,
  stripFutureBlogCards,
} = require("./blog-dates");

const now = new Date("2026-08-26T15:00:00Z"); // 11:00 AM ET on Aug 26

assert.strictEqual(todayYmdET(now), "2026-08-26");
assert.strictEqual(publishYmd("2026-09-02"), "2026-09-02");
assert.strictEqual(publishYmd(new Date("2026-08-26T00:00:00.000Z")), "2026-08-26");
assert.strictEqual(isFuturePublishDate("2026-08-26", now), false);
assert.strictEqual(isFuturePublishDate("2026-09-02", now), true);
assert.strictEqual(isFuturePublishDate("2026-09-09", now), true);
assert.strictEqual(isFuturePublishDate(new Date("2026-08-26T00:00:00.000Z"), now), false);

const beforeMidnightET = new Date("2026-08-26T03:59:00Z"); // Aug 25, 11:59 PM ET
assert.strictEqual(todayYmdET(beforeMidnightET), "2026-08-25");
assert.strictEqual(isFuturePublishDate("2026-08-26", beforeMidnightET), true);

assert.ok(isBlogListingOutput("/workspace/_site/blog/index.html"));
assert.ok(isBlogListingOutput("/workspace/_site/es/blog/index.html"));
assert.ok(!isBlogListingOutput("/workspace/_site/blog/what-is-life-insurance-florida/index.html"));

const listingPath = path.join(__dirname, "..", "blog", "index.html");
const listing = fs.readFileSync(listingPath, "utf8");
assert.ok(
  listing.includes("2026-09-02") && listing.includes("2026-09-09"),
  "source listing should keep scheduled Sep cards in the pipeline"
);
assert.ok(listing.includes("2026-08-26"), "source listing should include the Aug 26 card");

const gated = stripFutureBlogCards(listing, now);
assert.ok(!gated.includes("2026-09-02"), "Sep 2 card must be stripped before publish day");
assert.ok(!gated.includes("2026-09-09"), "Sep 9 card must be stripped before publish day");
assert.ok(
  !gated.includes("/blog/how-to-pick-aca-marketplace-plan-florida/"),
  "Sep 2 href must not ship"
);
assert.ok(
  !gated.includes("/blog/private-health-insurance-miami-guide/"),
  "Sep 9 href must not ship"
);
assert.ok(gated.includes("2026-08-26"), "Aug 26 card must stay");
assert.ok(
  gated.includes("/blog/term-vs-whole-vs-final-expense-life-insurance/"),
  "Aug 26 href must stay"
);
assert.ok(
  gated.includes("/blog/what-is-life-insurance-florida/"),
  "already-live cards must stay"
);

const afterSep2 = stripFutureBlogCards(listing, new Date("2026-09-02T13:00:00Z"));
assert.ok(afterSep2.includes("2026-09-02"), "Sep 2 card appears on publish day");
assert.ok(!afterSep2.includes("2026-09-09"), "Sep 9 card stays hidden on Sep 2");

const afterSep9 = stripFutureBlogCards(listing, new Date("2026-09-09T13:00:00Z"));
assert.ok(afterSep9.includes("2026-09-09"), "Sep 9 card appears on publish day");

console.log("blog date gate tests passed");
