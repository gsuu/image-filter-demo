'use strict';

// Environment Variable
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Dependencies
const gulp = require('gulp');
const $ = require('gulp-load-plugins')();
const del = require('del');
const runSequence = require('run-sequence');
const autoprefixer = require('autoprefixer');
const postcssClean = require('postcss-clean');
const spritesmith = require('gulp.spritesmith-multi');
const browserSync = require('browser-sync').create();
const buffer = require('vinyl-buffer');
const merge = require('merge-stream');
const webpack = require('webpack');
const webpackStream = require('webpack-stream');
const webpackConfig = require('./webpack.config');

// Delete generated files
gulp.task('webpack', function() {
  return gulp
    .src('src/*.js')
    .pipe(webpackStream(webpackConfig, webpack))
    .pipe(gulp.dest('demo/js'));
});

// Process CSS Files
gulp.task('css', function() {
  return (
    gulp
      .src('src/css/*.less')
      .pipe($.plumberNotifier())
      .pipe($.if(!IS_PRODUCTION, $.sourcemaps.init()))
      // Less
      .pipe($.less())
      // CSS Lint
      .pipe($.csslint('./.csslintrc'))
      .pipe($.csslint.formatter())
      .pipe($.csslint.formatter('fail'))
      // Autoprefixer
      .pipe(
        $.postcss([
          autoprefixer({
            browsers: ['last 2 version', '> 1%', 'ie >=9']
          })
        ])
      )
      .pipe(
        $.if(
          IS_PRODUCTION,
          $.postcss([
            postcssClean({
              compatibility: 'ie7',
              aggressiveMerging: false,
              restructuring: false,
              format: 'keep-breaks'
            })
          ])
        )
      )
      .pipe($.if(!IS_PRODUCTION, $.sourcemaps.write()))
      .pipe(browserSync.stream({ reloadAllStylesheetIfNotFound: false }))
      .pipe(gulp.dest('demo/css'))
  );
});

gulp.task('css:sprite', function(cb) {
  runSequence(['css'], cb);
});

// Copy HTML files to demo directory
gulp.task('html', function() {
  return gulp
    .src(['src/**/*.html', '!src/**/_*/**/*.html'])
    .pipe($.plumberNotifier())
    .pipe($.changed('demo'))
    .pipe(
      $.fileInclude({
        prefix: '@@',
        basepath: './src/',
        indent: true
      })
    )
    .pipe(
      $.htmlhint({
        htmlhintrc: '.htmlhintrc'
      })
    )
    .pipe($.htmlhint.reporter())
    .pipe(gulp.dest('demo'));
});

// Optimize image files and copy it to build directory
gulp.task('img', function() {
  return gulp
    .src(['src/**/*.{png,gif,svg,jpg,jpeg}', '!src/css/sprites/**/*.png'])
    .pipe($.plumberNotifier())
    .pipe($.changed('demo'))
    .pipe(gulp.dest('demo'));
});

// Optimize image files and copy it to build directory
gulp.task('copy', function() {
  return gulp
    .src('src/**/*.{swf,mp4,mp3}')
    .pipe($.plumberNotifier())
    .pipe($.changed('demo'))
    .pipe(gulp.dest('demo'));
});

gulp.task('font', function() {
  return gulp
    .src('src/**/*.{eot,ttf,woff,woff2}')
    .pipe($.plumberNotifier())
    .pipe($.flatten())
    .pipe($.changed('demo/fonts/'))
    .pipe(gulp.dest('demo/fonts/'));
});

gulp.task('build', function(cb) {
  runSequence(['html', 'css:sprite', 'img', 'font', 'copy'], cb);
});

gulp.task('browser-sync', ['build'], function() {
  gulp.watch('src/**/*.html', ['html']);
  gulp.watch(['src/**/*.less', '!src/css/sprites/**/*.less'], ['css']);
  gulp.watch(
    ['src/**/*.{png,gif,jpg,svg,jpeg}', '!src/css/sprites/**/*.png'],
    ['img']
  );
  gulp.watch(['src/**/*.{eot,ttf,woff,woff2}'], ['font']);
  gulp.watch(['src/**/*.{swf,mp4,mp3}'], ['copy']);

  browserSync.watch(['demo/**/*']).on('change', browserSync.reload);

  browserSync.init({
    server: {
      baseDir: './demo',
      directory: true
    },
    // startPath: '/demo/',
    ghostMode: false,
    notify: false,
    cors: true
  });
});

gulp.task('default', ['build', 'webpack']);
gulp.task('serve', ['browser-sync', 'webpack']);
