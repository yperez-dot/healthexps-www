// Prevent future-dated posts from being output as pages.
// Only applies to .md files; existing .html files are unaffected.
module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      if (!data.page || !data.page.inputPath.endsWith(".md")) {
        return data.permalink;
      }
      if (data.date && new Date(data.date) > new Date()) {
        return false; // suppress until publish date
      }
      return data.permalink;
    },
  },
};
