module.exports = {
  url: 'https://anthonycossins.com/archive',
  title: 'Archive',
  description:
    'Archive of projects Ive done',
  keywords: 'just, a, great, archive',
  timestamp: () => Date.now(),
  date: () => new Date(),
  baseUrl: process.env.NODE_ENV === 'dev' ? '' : 'https://anthonycossins.com/archive',

  // TODO: I could not find a better way to do this with Netlify redirects : (
  assetsBaseUrl: process.env.NODE_ENV === 'dev' ? '' : 'https://hopeful-galileo-dc893b.netlify.app'
};
