const { isFuturePublishDate } = require("../scripts/blog-dates");

// Prevent future-dated posts from being output as pages.
// Only applies to .md files; existing .html files are unaffected.
module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      if (!data.page || !data.page.inputPath.endsWith(".md")) {
        return data.permalink;
      }
      if (isFuturePublishDate(data.date)) {
        return false; // suppress until publish date (America/New_York)
      }
      return data.permalink;
    },
  },
};
