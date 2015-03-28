var prompt = require('prompt');
var fs = require('fs');
var spawn = require('child_process').spawn;
var color = require('cli-color');
var semver = require('semver')
var cyan = color.cyan;
var yellow = color.yellow;

module.exports = function(finish){
  var oldVersion = require('./package.json').version
  var names = ['major', 'minor', 'patch']
    , tagName, tagged, committed, pushed, cleaning;

  tagged = committed = false;

  var schema = {
    properties: {
      version: {
        description: 'version? (old is '+ oldVersion +')',
        conform: function(value){
          return names.indexOf(value) > -1 || semver.valid(value)
        },
        message: 'Must be a valid semver string i.e. 1.0.2, 2.3.0-beta.1',
        required: true,
        before: function(value){
          return names.indexOf(value) > -1 
            ? semver.inc(oldVersion, value)
            : value
        }
      }
    }
  };

  prompt.start();

  prompt.get(schema, function(err, result) {
    if (err) throw err;

    var rawVersion = result.version;
    var version = 'v'+ rawVersion;

    updateJSON('package', rawVersion);
    updateJSON('bower', rawVersion);

    run('npm test', function() {
      commit(version, function() {
        tag(rawVersion, function() {
          publish(version, finish);
        });
      });
    });

  });

  function commit(version, cb) {
    run('git add -A && git commit -m "release ' + version + '"', function(){
      committed = true; cb()
    });
  }

  function tag(version, cb) {
    tagName = 'v' + version;

    run('git tag -am ' + version + ' ' + tagName, function(){
      tagged = true; 
      cb()
    });
  }

  function publish(version, cb) {
    run('git push origin master --follow-tags', function() {
      pushed = true
      run('npm publish', cb);
    });
  }

  function run(command, cb) {
    log(cyan('exec:'), yellow(command));

    spawnCmd(command, function(err) {
      if (err) {
        return cleanUp(function(){ finish(err) })
      }

      cb();
    });
  }

  function cleanUp(cb){
    if (cleaning) return;
    cleaning = true;

    var working = 1 + tagged + committed;

    if ( pushed ){
      log('An error occured after the tag and commit were pushed to origin, ' +
        'because teh code is not in a public space, no actions were taken to roll back on error ' + 
        'to undo the work, you will need to manually delete the tag, commit, and version bump in the manifest files')
      return cb();
    }
    updateJSON('package', oldVersion)
    updateJSON('bower', oldVersion)

    committed && spawnCmd('git reset HEAD~1 --soft ', tryDone)
    tagged && spawnCmd('git tag -d ' + tagName, tryDone)
    
    tryDone()
    function tryDone(){ 
      if (--working <= 0) cb() 
    } 
  }
}

function updateJSON(pkg, version) {
  var path = pkg + '.json', json;

  if (!fs.existsSync(path)) 
    return
  
  json = readJSON(path);
  json.version = version;
  writeJSON(path, json);
  log(cyan('updated'), path);
}

function readJSON(path) {
  return JSON.parse(fs.readFileSync(path).toString());
}

function writeJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function log() {
  var args = [].slice.call(arguments, 0);
  console.log.apply(console, [cyan('release:')].concat(args));
}

function spawnCmd(cmd, cb){
  var spa  = spawnArgs(cmd)
    , child = spawn(spa.file, spa.args, spa.options)
    , stderr = ''
    , err, exited;

  child.stdout.on('data', function (data) {
    process.stdout.write(data.toString('utf8'))
  });

  child.stderr.on('data', function (data) {
    stderr += data.toString('utf8')
    process.stdout.write(data.toString('utf8'))
  });

  child.on('close', onExit)
  child.on('error', function (error) {
    err = error
    child.stdout.destroy();
    child.stderr.destroy();
    onExit()
  });

  function onExit(code) {
    if (exited) return;
    exited = true;

    if ( code === 0 ) cb(null)
    else cb(err || new Error('Command failed: ' + cmd + '\n' + stderr))
  }
}

function spawnArgs(cmd){
  var file, args, options;

  if (process.platform === 'win32') {
    file = process.env.comspec || 'cmd.exe';
    args = ['/s', '/c', '"' + cmd + '"'];
    options = {}
    options.windowsVerbatimArguments = true;
  }
  else {
    file = '/bin/sh';
    args = ['-c', cmd];
  }
  return { file: file, args: args, options: options};
}
