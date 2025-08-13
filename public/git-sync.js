// Git synchronization functionality
TodoApp.prototype.validateGitConfig = function() {
  return (
    this.gitConfig.repoUrl &&
    this.gitConfig.gitToken &&
    this.gitConfig.gitBranch
  );
};

// Git sync functionality
TodoApp.prototype.pullFromGit = async function(silent = false) {
  if (!this.validateGitConfig()) {
    if (!silent)
      this.showSyncStatus("Please configure git settings first", "error");
    return;
  }

  // Prevent concurrent sync operations
  if (this.syncInProgress) {
    if (!silent) this.showSyncStatus("Sync already in progress...", "loading");
    return;
  }
  this.syncInProgress = true;

  // Normalize and validate repository format
  let repoUrl = this.gitConfig.repoUrl.trim();
  
  // Handle full GitHub URLs and convert to owner/repo format
  if (repoUrl.includes('github.com/')) {
    const match = repoUrl.match(/github\.com\/([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)/);
    if (match) {
      repoUrl = match[1].replace(/\.git$/, ''); // Remove .git suffix if present
    }
  }
  
  // Remove trailing .git if present
  repoUrl = repoUrl.replace(/\.git$/, '');
  
  // Validate final format: username/repository
  const repoFormat = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
  if (!repoFormat.test(repoUrl)) {
    if (!silent) this.showSyncStatus(`Invalid repository format. Current: "${this.gitConfig.repoUrl}"
    Expected: "username/repository-name"
    Examples: "johndoe/my-todos" or "https://github.com/johndoe/my-todos"`, "error");
    return;
  }
  
  // Update the config with normalized repo URL
  if (repoUrl !== this.gitConfig.repoUrl) {
    this.gitConfig.repoUrl = repoUrl;
    this.saveGitConfig({repoUrl});
  }

  if (!silent)
    this.showSyncStatus("Pulling todos from git repository...", "loading");

  try {
    const files = await this.getExistingFiles();
    const todoFiles = files.filter(
      (f) => f.startsWith("todo-") && f.endsWith(".md")
    );

    if (todoFiles.length > 0) {
      const todos = [];
      for (const filename of todoFiles) {
        const todo = await this.fetchTodoFile(filename);
        if (todo) todos.push(todo);
      }

      const validTodos = todos.filter((t) => t !== null);
      if (validTodos.length > 0) {
        // Merge with existing todos, preferring remote version for conflicts
        this.mergeTodos(validTodos);
        this.saveTodos();
        this.render();

        if (!silent) {
          this.showSyncStatus(
            `Successfully pulled ${validTodos.length} todos from repository`,
            "success"
          );
        }
      } else {
        if (!silent)
          this.showSyncStatus("No valid todo files could be parsed", "error");
      }
    } else {
      if (!silent)
        this.showSyncStatus("No valid todo files could be parsed", "error");
    }
  } catch (error) {
    console.error("Git pull error:", error);
    if (!silent)
      this.showSyncStatus(`Pull failed: ${error.message}`, "error");
  } finally {
    this.syncInProgress = false;
  }
};

TodoApp.prototype.mergeTodos = function(remoteTodos) {
  const localTodoMap = new Map(this.todos.map((todo) => [todo.id, todo]));
  const remoteTodoMap = new Map(remoteTodos.map((todo) => [todo.id, todo]));

  // Start with remote todos (they take precedence for updates)
  const mergedTodos = [...remoteTodos];

  // Add local todos that don't exist remotely (newly created locally)
  for (const localTodo of this.todos) {
    if (!remoteTodoMap.has(localTodo.id)) {
      mergedTodos.push(localTodo);
    }
  }

  // Store the list of todos that existed locally before the merge
  // This prevents deleted todos from being re-added during quick push/pull
  const localTodoIds = new Set(this.todos.map(t => t.id));
  
  // If a todo exists remotely but was recently deleted locally, remove it
  const recentlyDeleted = this.getRecentlyDeletedTodos();
  const finalTodos = mergedTodos.filter(todo => !recentlyDeleted.has(todo.id));

  // Sort by creation date (newest first)
  finalTodos.sort((a, b) => new Date(b.created) - new Date(a.created));

  this.todos = finalTodos;
};

TodoApp.prototype.syncToGit = async function() {
  if (!this.validateGitConfig()) {
    this.showSyncStatus("Please configure git settings first", "error");
    return;
  }

  // Prevent concurrent sync operations
  if (this.syncInProgress) {
    this.showSyncStatus("Sync already in progress...", "loading");
    return;
  }
  this.syncInProgress = true;

  // Normalize and validate repository format
  let repoUrl = this.gitConfig.repoUrl.trim();
  
  // Handle full GitHub URLs and convert to owner/repo format
  if (repoUrl.includes('github.com/')) {
    const match = repoUrl.match(/github\.com\/([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)/);
    if (match) {
      repoUrl = match[1].replace(/\.git$/, ''); // Remove .git suffix if present
    }
  }
  
  // Remove trailing .git if present
  repoUrl = repoUrl.replace(/\.git$/, '');
  
  // Validate final format: username/repository
  const repoFormat = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
  if (!repoFormat.test(repoUrl)) {
    this.showSyncStatus(`Invalid repository format. Current: "${this.gitConfig.repoUrl}"
    Expected: "username/repository-name"
    Examples: "johndoe/my-todos" or "https://github.com/johndoe/my-todos"`, "error");
    return;
  }
  
  // Log the repository URL for debugging
  console.log(`Syncing to repository: ${repoUrl}`);
  
  // Update the config with normalized repo URL
  if (repoUrl !== this.gitConfig.repoUrl) {
    this.gitConfig.repoUrl = repoUrl;
    this.saveGitConfig({repoUrl});
  }

  this.showSyncStatus("Syncing to git repository...", "loading");

  try {
    // Get current files in the repo directory to clean up deleted todos
    const existingFiles = await this.getExistingFiles();

    // Generate markdown files for current todos
    const files = this.generateMarkdown(true);

    // Delete files first to avoid conflicts
    const currentFilenames = new Set(files.map((f) => f.filename));
    const filesToDelete = existingFiles
      .filter(
        (filename) => filename.startsWith("todo-") && filename.endsWith(".md")
      )
      .filter((filename) => !currentFilenames.has(filename));
    
    console.log(`Files to delete: ${filesToDelete.length}`, filesToDelete);
    console.log(`Current files: ${files.length}`, files.map(f => f.filename));
    
    // Process deletions first
    if (filesToDelete.length > 0) {
      await Promise.all(filesToDelete.map((filename) => this.deleteFile(filename)));
      // Wait for deletions to propagate
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Then create/update files sequentially to avoid conflicts
    for (const file of files) {
      try {
        await this.createOrUpdateFile(file.filename, file.content);
        // Small delay between updates to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to sync ${file.filename}:`, error);
        throw error;
      }
    }

    this.showSyncStatus(
      `Successfully synced ${files.length} todos to git repository`,
      "success"
    );
    
    // Longer delay to ensure GitHub API consistency for deletions
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.error("Git sync error:", error);
    // Only show user-friendly errors, not API noise
    if (error.message.includes('Repository or path not found')) {
      this.showSyncStatus(`Sync failed: ${error.message}`, "error");
    } else if (error.message.includes('Authentication failed')) {
      this.showSyncStatus(`Sync failed: ${error.message}`, "error");
    } else {
      this.showSyncStatus(`Sync failed: Please check your git configuration`, "error");
    }
  } finally {
    this.syncInProgress = false;
  }
};

TodoApp.prototype.getExistingFiles = async function() {
  const { repoUrl, gitToken, gitBranch, gitPath } = this.gitConfig;
  const path = gitPath || "";

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoUrl}/contents/${path}?ref=${gitBranch}`,
      {
        headers: {
          Authorization: `token ${gitToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log("Directory doesn't exist yet, will be created");
        return [];
      }
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const files = await response.json();
    return Array.isArray(files) ? files.map(f => f.name) : [];
  } catch (error) {
    console.warn("Could not list existing files:", error);
    return [];
  }
};

// ... (rest of the Git API methods will be added separately)