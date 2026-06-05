const fs = require('fs');
const { execSync } = require('child_process');

try {
  console.log('Step 1: Running frontend build workspace...');
  execSync('npm run build --workspace=frontend', { stdio: 'inherit' });

  console.log('Step 2: Syncing build folder to root dist...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  fs.renameSync('frontend/dist', 'dist');
  console.log('Build process completed successfully!');
} catch (error) {
  console.error('Build process failed:', error);
  process.exit(1);
}
