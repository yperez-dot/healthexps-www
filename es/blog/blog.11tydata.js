const { isFuturePublishDate } = require("../../scripts/blog-dates");

module.exports = {
  eleventyComputed: {
    noindex: (data) => {
      if (!data.page || !data.page.inputPath.endsWith(".md")) return false;
      return isFuturePublishDate(data.date);
    },
  },
};
