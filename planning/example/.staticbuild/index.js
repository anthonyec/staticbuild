const { getCollectionFromFS } = require('staticbuild');

module.exports = async () => {
  const pages = [
    {
      slug: 'index.html',
      path: '/',
      content: fs.readFileSync('./src/index.html', 'utf8')
    }
  ];

  const projects = await getCollectionFromFS(
    'projects',
    'project',
    './src/_projects',
    '/{{slug}}'
  );

  return [...pages, ...projects.reverse()];
};
