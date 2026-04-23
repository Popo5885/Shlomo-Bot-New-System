const { spawn } = require('child_process');
const chokidar = require('chokidar');

const commitMessage = process.env.AUTO_PUSH_MESSAGE || 'chore: auto sync local changes';
const watcher = chokidar.watch('.', {
  ignored: [
    /(^|[\/\\])\../,
    /node_modules/,
    /server-.*\.log$/,
    /server\.log$/,
    /server\.err\.log$/,
    /package-lock\.json$/
  ],
  ignoreInitial: true
});

let timer = null;
let running = false;

watcher.on('all', () => {
  if (timer) {
    clearTimeout(timer);
  }

  timer = setTimeout(async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      await run('git', ['add', '.']);
      await run('git', ['commit', '-m', commitMessage], true);
      await run('git', ['push', '-u', 'origin', 'main']);
      process.stdout.write('[auto-push] synchronized changes to origin/main\n');
    } catch (error) {
      process.stderr.write(`[auto-push] ${error.message}\n`);
    } finally {
      running = false;
    }
  }, 2000);
});

function run(command, args, allowEmptyCommit = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      if (allowEmptyCommit && code === 1) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}
