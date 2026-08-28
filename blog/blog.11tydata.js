const { isFuturePublishDate } = require("../scripts/blog-dates");

// Future-dated .md posts still build as pages (site-health expects HTTP 200)
// but stay off /blog/ until publish day and are noindexed so they don't rank.
module.exports = {
  eleventyComputed: {
    noindex: (data) => {
      if (!data.page || !data.page.inputPath.endsWith(".md")) return false;
      return isFuturePublishDate(data.date);
    },
  },
};
