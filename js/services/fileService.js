/**
 * File Service - Handles File System Access API operations
 */

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.html', '.htm', '.md', '.markdown', '.txt', '.css', '.js'];

/**
 * Check if browser supports File System Access API
 */
export function isSupported() {
  return 'showDirectoryPicker' in window;
}

/**
 * Open directory picker dialog
 */
export async function openDirectory() {
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') {
      return null; // User cancelled
    }
    throw err;
  }
}

/**
 * Read file content
 */
export async function readFile(fileHandle) {
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Write content to file
 */
export async function writeFile(fileHandle, content) {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Create new file in directory
 */
export async function createFile(dirHandle, fileName) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  // Write empty content or template based on extension
  const ext = fileName.split('.').pop().toLowerCase();
  let template = '';

  if (ext === 'html' || ext === 'htm') {
    template = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>

</body>
</html>`;
  } else if (ext === 'md' || ext === 'markdown') {
    template = `# Title

Content here...
`;
  }

  await writeFile(fileHandle, template);
  return fileHandle;
}

/**
 * Get file handle by path
 */
export async function getFileHandle(rootHandle, path) {
  const parts = path.split('/');
  let currentHandle = rootHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
  }

  return await currentHandle.getFileHandle(parts[parts.length - 1]);
}

/**
 * Get directory handle by path
 */
export async function getDirHandle(rootHandle, path) {
  if (!path) return rootHandle;

  const parts = path.split('/');
  let currentHandle = rootHandle;

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part);
  }

  return currentHandle;
}

/**
 * Build file tree recursively
 */
export async function buildFileTree(dirHandle, path = '', filter = SUPPORTED_EXTENSIONS) {
  const entries = [];

  for await (const [name, handle] of dirHandle) {
    // Skip hidden files/folders
    if (name.startsWith('.')) continue;

    const entryPath = path ? `${path}/${name}` : name;

    if (handle.kind === 'directory') {
      const children = await buildFileTree(handle, entryPath, filter);
      // Only include directories that have matching files
      if (children.length > 0 || filter.length === 0) {
        entries.push({
          name,
          path: entryPath,
          type: 'directory',
          handle,
          children
        });
      }
    } else {
      // Check if file matches filter
      const ext = name.substring(name.lastIndexOf('.'));
      if (filter.length === 0 || filter.includes(ext.toLowerCase())) {
        entries.push({
          name,
          path: entryPath,
          type: 'file',
          handle
        });
      }
    }
  }

  // Sort: folders first, then alphabetically
  return entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get file language from extension
 */
export function getLanguage(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'html';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'css':
      return 'css';
    case 'js':
      return 'javascript';
    default:
      return 'text';
  }
}

/**
 * Rename file
 */
export async function renameFile(dirHandle, oldName, newName) {
  // File System Access API doesn't support rename directly
  // We need to read, create new, delete old
  const oldHandle = await dirHandle.getFileHandle(oldName);
  const content = await readFile(oldHandle);

  const newHandle = await dirHandle.getFileHandle(newName, { create: true });
  await writeFile(newHandle, content);

  await dirHandle.removeEntry(oldName);

  return newHandle;
}

/**
 * Search files in tree
 */
export function searchFiles(tree, query) {
  if (!query) return tree;

  const lowerQuery = query.toLowerCase();
  const results = [];

  function search(nodes) {
    for (const node of nodes) {
      if (node.type === 'file' && node.name.toLowerCase().includes(lowerQuery)) {
        results.push(node);
      } else if (node.type === 'directory' && node.children) {
        search(node.children);
      }
    }
  }

  search(tree);
  return results;
}
