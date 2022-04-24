const fs = require('fs');
const path = require('path');

module.exports = async (sourcePath, destinationPath) => {
  fs.cpSync(path.join(sourcePath, 'assets'), path.join(destinationPath, 'assets'), {
    recursive: true
  });
};
