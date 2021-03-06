var fs = require('fs'),
    cheerio = require('cheerio'),
    gulp = require('gulp'),
    gutil = require('gulp-util'),
    cleanCSS = require('gulp-clean-css'),
    concat = require('gulp-concat'),
    htmlmin = require('gulp-htmlmin'),
    rimraf = require('gulp-rimraf'),
    rename = require('gulp-rename'),
    replace = require('gulp-replace'),
    webserver = require('gulp-webserver'),
    uglify = require('gulp-uglify'),
    unzip = require('gulp-unzip'),
    zip = require('gulp-zip'),
    exclude_min = ['js/lib/jsfxr.min.js'],
    config = { js: [] };

var PluginError = gutil.PluginError;

gulp.task('build', ['initbuild', 'jsconcat', 'minifyjs', 'addcss', 'addjs', 'zip', 'unzip', 'clean', 'report']);


gulp.task('serve', function() {
  gulp.src('.')
    .pipe(webserver({
      livereload: false,
      host: '0.0.0.0',
      port: 8013,
      open: true
    }));
});


gulp.task('initbuild', function() {

  var stream, html, $, src, js = [];

  // delete prev files
  stream = gulp.src('dist/')
        .pipe(rimraf());

  // get a list of all js scripts from our dev file
  html = fs.readFileSync('index.html', 'utf-8', function(e, data) {
    return data;
  });

  $ = cheerio.load(html);

  $('script').each(function() {
    src = $(this).attr('src');
    if (exclude_min.indexOf(src) === -1) {
      js.push(src);
    }
  });

  config.js = js;

});

gulp.task('jsconcat', ['initbuild'], function() {
  var stream = gulp.src(config.js)
    .pipe(concat('dist/g.js'))
    .pipe(gulp.dest('.'));

  return stream;
});

gulp.task('addcss', function() {
    var stream = gulp.src('game.css')
      .pipe(cleanCSS())
      .pipe(rename('g.css'))
      .pipe(gulp.dest('./tmp'));

    return stream;
});

gulp.task('minifyjs', ['jsconcat'], function() {
  var through = require('through2');
  var minifier = require('./minifier');

  var transform = through.obj(function(file, encoding, callback) {
    if (file.isStream()) {
      this.emit('error', new PluginError({
        plugin: 'MinifyJs',
        message: 'Streams are not supported.'
      }));
      callback();
    }

    if (file.isBuffer()) {
      file.path = file.path.replace(/\.js$/, '.min.js');
      file.contents = minifier(file.contents);
    }
    this.push(file);
    return callback();
  });

  return gulp.src('dist/g.js')
    .pipe(transform)
    .pipe(gulp.dest('dist/'));
});

gulp.task('addjs', ['minifyjs'], function() {

    var js = fs.readFileSync('dist/g.min.js', 'utf-8', function(e, data) {
      return data;
    });

    var i, tmp, extra_js = '';

    for (i = 0; i < exclude_min.length; i += 1) {
      console.log(exclude_min[i])
      extra_js += fs.readFileSync(exclude_min[i], 'utf-8', function(e, data) {
        return data;
      });
    }
    console.log(extra_js.length, 'OK', exclude_min);

    var stream = gulp.src('index.html')
      .pipe(replace(/<.*?script.*?>.*?<\/.*?script.*?>/igm, ''))
      .pipe(replace(/<\/body>/igm, '<script>'+extra_js+' '+js+'</script></body>'))
      .pipe(replace(/game.css/igm, 'g.css'))
      .pipe(htmlmin({collapseWhitespace: true}))
      .pipe(rename('index.html'))
      .pipe(gulp.dest('./tmp'));

    return stream;

});

gulp.task('zip', ['addjs', 'addcss'], function() {
  var stream = gulp.src(['tmp/index.html', 'tmp/g.css'])
      .pipe(zip('game.zip'))
      .pipe(gulp.dest('dist/'));

  return stream;
});


gulp.task('unzip', ['zip'], function() {
  var stream = gulp.src('dist/game.zip')
      .pipe(unzip())
      .pipe(gulp.dest('dist/'));

  return stream;
});


gulp.task('clean', ['unzip'], function() {
  var stream = gulp.src('tmp/')
        .pipe(rimraf());


  return stream;
});

gulp.task('report', ['clean'], function() {
  var stat = fs.statSync('dist/game.zip'),
      limit = 1024 * 13,
      size = stat.size,
      remaining = limit - size,
      percentage = (remaining / limit) * 100;

  percentage = Math.round(percentage * 100) / 100

  console.log('\n\n-------------');
  console.log('BYTES USED: ' + stat.size);
  console.log('BYTES REMAINING: ' + remaining);
  console.log(percentage +'%');
  console.log('-------------\n\n');
});


gulp.task('encode', function()  {
  var files = fs.readdirSync('./a'),
      gifs = [],
      n, parts, base64;

  for ( n in files) {
    if (files[n].indexOf('.gif') !== -1) {
      gifs.push(files[n]);
    }
  }

  for (n = 0; n < gifs.length; n += 1) {

    fs.readFileSync('.a/'+gifs[n], function(err, data) {
     console.log(err, data);
    });
    parts = gifs[n].split('.');
    console.log(parts[0], gifs[n], base64);
  }

});
