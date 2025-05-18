import * as fs from "fs";
import * as path from "path";

/**
 * Utility script to clean up test wallet directories
 * This can be used to remove any leftover test wallet directories that might be
 * created by tests or development processes.
 */

// List of directory patterns to clean
const directoriesToClean = [
  'test-wallets',
  'test-wallets-class',
  'test-wallets-advanced',
  'dev-wallets'
];

// Optional parameters
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const includeDevWallets = args.includes('--include-dev');

// Get workspace root
const workspaceRoot = process.cwd();

console.log('Wallet Directory Cleanup');
console.log('========================');
console.log(`Workspace: ${workspaceRoot}`);
console.log(`Mode: ${dryRun ? 'Dry run (no deletion)' : 'Delete'}`);

let directoriesRemoved = 0;
let keyFilesRemoved = 0;

// Function to recursively find and delete .key files
function findAndCleanKeyFiles(dir: string, dryRun: boolean): number {
  let keyFilesFound = 0;
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and .git directories
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          keyFilesFound += findAndCleanKeyFiles(fullPath, dryRun);
        }
      } else if (entry.isFile() && entry.name.endsWith('.key')) {
        keyFilesFound++;
        console.log(`${dryRun ? 'Would delete' : 'Deleting'} key file: ${fullPath}`);
        
        if (!dryRun) {
          fs.unlinkSync(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}: ${error}`);
  }
  
  return keyFilesFound;
}

// Clean up wallet directories
for (const pattern of directoriesToClean) {
  // Skip dev wallets unless specifically included
  if (pattern === 'dev-wallets' && !includeDevWallets) {
    console.log(`Skipping ${pattern} (use --include-dev to include)`);
    continue;
  }
  
  const matches = fs.readdirSync(workspaceRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name.includes(pattern))
    .map(dirent => path.join(workspaceRoot, dirent.name));
  
  for (const dir of matches) {
    console.log(`${dryRun ? 'Would delete' : 'Deleting'} directory: ${dir}`);
    if (!dryRun) {
      fs.rmSync(dir, { recursive: true, force: true });
      directoriesRemoved++;
    } else {
      directoriesRemoved++;
    }
  }
}

// Find and clean .key files
console.log('\nSearching for key files...');
keyFilesRemoved = findAndCleanKeyFiles(workspaceRoot, dryRun);

console.log('\nCleanup Summary');
console.log('---------------');
console.log(`Directories ${dryRun ? 'found' : 'removed'}: ${directoriesRemoved}`);
console.log(`Key files ${dryRun ? 'found' : 'removed'}: ${keyFilesRemoved}`);
console.log(`Done!${dryRun ? ' (Dry run - no files were actually deleted)' : ''}`);

if (dryRun) {
  console.log('\nThis was a dry run. No files were deleted.');
  console.log('Run without --dry-run to perform actual deletion.');
}

if (!includeDevWallets) {
  console.log('\nDevelopment wallets were not included in this cleanup.');
  console.log('Use --include-dev to also clean development wallet directories.');
} 