import { glob } from "glob";
import micromatch from "micromatch";
import fs from "node:fs";
import path from "node:path";

/**
 * Scan directory for markdown, epub and pdf files synchronously
 * @param {string} dirPath - Directory path to scan
 * @param {object} options - Scanner options
 * @param {string[]} options.exclude - Patterns to exclude
 * @param {boolean} options.recursive - Whether to scan recursively
 * @returns {string[]} Array of absolute file paths
 */
export function scanDirectorySync(dirPath, { exclude = ["node_modules", ".git"], recursive = true } = {}) {
  const absolutePath = path.resolve(dirPath);

  // Check if path exists
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Path does not exist: ${dirPath}`);
  }

  // Check if it's a directory
  const stats = fs.statSync(absolutePath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }

  // Build glob pattern
  const pattern = recursive
    ? `${absolutePath}/**/*.{md,markdown,epub,pdf}`
    : `${absolutePath}/*.{md,markdown,epub,pdf}`;

  // Find all matching files synchronously
  const files = glob.sync(pattern, {
    ignore: exclude.map(ex => {
      // If exclude pattern is absolute, use it as-is
      if (path.isAbsolute(ex)) return ex;
      // Otherwise, make it relative to the scan directory
      return path.join(absolutePath, ex);
    }),
    nodir: true,
    absolute: true,
  });

  // Additional filtering with micromatch for more complex patterns
  const filtered = files.filter(file => {
    const relativePath = path.relative(absolutePath, file);
    // Check if any exclude pattern matches
    return !exclude.some(pattern => micromatch.isMatch(relativePath, pattern));
  });

  return filtered;
}

/**
 * Check if a path is a file or directory
 * @param {string} targetPath - Path to check
 * @returns {{ isFile: boolean, isDirectory: boolean, exists: boolean }}
 */
export function getPathType(targetPath) {
  try {
    const absolutePath = path.resolve(targetPath);
    if (!fs.existsSync(absolutePath)) {
      return { isFile: false, isDirectory: false, exists: false };
    }
    const stats = fs.statSync(absolutePath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      exists: true,
    };
  } catch (error) {
    return { isFile: false, isDirectory: false, exists: false };
  }
}

/**
 * Get file extension
 * @param {string} filePath - File path
 * @returns {string} Extension without dot (e.g., 'md', 'epub')
 */
export function getFileExtension(filePath) {
  return path.extname(filePath).slice(1).toLowerCase();
}
