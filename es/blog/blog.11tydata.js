const { isFuturePublishDate } = require("../../scripts/blog-dates");

module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      if (!data.page || !data.page.inputPath.endsWith(".md")) {
        return data.permalink;
      }
      if (isFuturePublishDate(data.date)) {
        return false;
      }
      return data.permalink;
    },
  },
};
