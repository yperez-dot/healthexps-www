module.exports = {
  eleventyComputed: {
    permalink: (data) => {
      if (!data.page || !data.page.inputPath.endsWith(".md")) {
        return data.permalink;
      }
      if (data.date && new Date(data.date) > new Date()) {
        return false;
      }
      return data.permalink;
    },
  },
};
