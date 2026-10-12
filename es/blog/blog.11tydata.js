const { isFuturePublishDate } = require("../../scripts/blog-dates");

module.exports = {
  eleventyComputed: {
    noindex: (data) => {
      if (!data.page || !data.page.inputPath.endsWith(".md")) return false;
      // Drafts under review build (for deploy previews) but are never indexed.
      if (data.draft === true) return true;
      return isFuturePublishDate(data.date);
    },
  },
};
