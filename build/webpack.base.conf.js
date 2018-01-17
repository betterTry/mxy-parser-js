const resolve = require('path').resolve;
const config = require('../config');
var vueLoaderConfig = require('./vue-loader.conf')

module.exports = {
  entry: {
    app: './src/main.js',
  },
  output: {
    path: config.build.assetsRoot,
    filename: '[name].js',
    publicPath: process.env.NODE_ENV === 'production' ? config.build.assetsPublicPath : config.dev.assetsPublicPath
  },
  resolve: {
    extensions: ['.js'],
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  resolveLoader: {
    moduleExtensions: [ '-loader' ],
  },
  module: {
    rules: [
      {
        test: /\.(js|vue)$/,
        loader: 'eslint',
        enforce: 'pre',
        include: [resolve('src')],
        options: {
          formatter: require('eslint-friendly-formatter')
        }
      },
      {
        test: /\.js$/,
        loader: 'babel',
        include: [resolve('src')],
      },


    ],
  }
}
