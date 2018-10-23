var webpack = require("webpack");
var path = require("path");
var fs = require("fs");

var ROOT_PATH = path.resolve(process.cwd());
var SRC_PATH = path.resolve(ROOT_PATH, "src");
var DIST_PATH = path.resolve(ROOT_PATH, "demo");
var IS_PRODUCTION = process.env.NODE_ENV === "production";

function getEntry() {
  var jsPath = path.resolve(SRC_PATH, 'js');
  var dirs = fs.readdirSync(jsPath);
  var matchs = [],
    files = {};
  dirs.forEach(function(item) {
    matchs = item.match(/(.+)\.js$/);
    if (matchs) {
      files[matchs[1]] = path.resolve(jsPath, item);
    }
  });
  return files;
}

function addVendor() {
  var files = getEntry();
  //files['vendor'] = ['jquery'];
  return files;
}

var config = {
  entry: addVendor(),
  watch: false,
  output: {
    path: DIST_PATH,
    //path.join(DIST_PATH, 'js'),
    publicPath: "/demo/js/",
    filename: "[name].js"
  },
  module: {
    rules: [
      {
        enforce: "pre",
        test: /\.js$/,
        exclude: [/node_modules/],
        loader: "eslint-loader"
      },
      {
        test: /\.js$/,
        exclude: [/node_modules/],
        loader: "babel-loader"
      },
      {
        test: /\.hbs$/,
        exclude: [/node_modules/],
        loader: "handlebars-loader"
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: IS_PRODUCTION ? '"production"' : '"development"'
      }
    })
  ],
  performance: {
    hints: false
  }
};

if (IS_PRODUCTION) {
  config.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: false,
      compress: {
        warnings: false
      }
    })
  );
} else {
  config.watch = true;
  config.devtool = "inline-source-map";
}

module.exports = config;
