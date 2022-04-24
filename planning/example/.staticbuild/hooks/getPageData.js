const path = require('path');

module.exports = async (site, page) => {
  const formattedTitle = page.title
    ? `${page.title} — ${site.title}`
    : site.title;
  const url = page.slug ? path.join(site.url, page.slug) : site.url;

  return {
    formattedTitle,
    url,
    twitterSocialImage: page.twitterSocialImage ? path.join(site.url, page.path, page.twitterSocialImage) : path.join(site.url, './assets/images/twitter_social_image.png')
  };
};
