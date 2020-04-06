const path = require("path");

module.exports = {
  target: "node",
  mode: "production",
  entry: "./lib/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    library: "@microsoft/task-scheduler",
    libraryTarget: "umd",
  },
};
