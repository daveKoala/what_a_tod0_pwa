// Service Worker registration with update handling
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      console.log("Service Worker registered successfully", reg);
      
      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available
            showUpdateNotification();
          }
        });
      });
    })
    .catch((err) => {
      console.error("Service Worker registration failed:", err);
      console.log("Attempting to fetch sw.js directly to debug...");
      fetch("/sw.js").then(r => console.log("sw.js fetch status:", r.status)).catch(e => console.log("sw.js fetch error:", e));
    });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data.type === 'UPDATE_AVAILABLE') {
      showUpdateNotification();
    }
  });
}

function showUpdateNotification() {
  const updateBanner = document.createElement('div');
  updateBanner.className = 'update-notification';
  updateBanner.innerHTML = `
    <div class="update-content">
      <span>New version available!</span>
      <button onclick="updateApp()">Update Now</button>
      <button onclick="dismissUpdate(this)">×</button>
    </div>
  `;
  document.body.appendChild(updateBanner);
}

function updateApp() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({type: 'SKIP_WAITING'});
  }
  window.location.reload();
}

function dismissUpdate(btn) {
  btn.closest('.update-notification').remove();
}

// Todo storage and management
class TodoApp {
  constructor() {
    this.todos = this.loadTodos();
    this.currentFilter = "all";
    this.gitConfig = this.loadGitConfig();

    // Check if setup is needed
    if (this.needsSetup()) {
      this.showSetupPage();
    } else {
      this.showMainPage();
      this.autoSync();
    }
  }

  needsSetup() {
    return !this.gitConfig.repoUrl || !this.gitConfig.gitToken;
  }

  showSetupPage() {
    document.getElementById("setupPage").classList.add("active");
    document.getElementById("mainPage").classList.remove("active");
    this.loadSetupConfigUI();
  }

  showMainPage() {
    document.getElementById("setupPage").classList.remove("active");
    document.getElementById("mainPage").classList.add("active");
    this.render();
  }

  loadSetupConfigUI() {
    if (this.gitConfig.repoUrl)
      document.getElementById("setupRepoUrl").value = this.gitConfig.repoUrl;
    if (this.gitConfig.gitToken)
      document.getElementById("setupGitToken").value = this.gitConfig.gitToken;
    if (this.gitConfig.gitBranch)
      document.getElementById("setupGitBranch").value =
        this.gitConfig.gitBranch;
    if (this.gitConfig.gitPath)
      document.getElementById("setupGitPath").value = this.gitConfig.gitPath;
  }

  async autoSync() {
    if (this.validateGitConfig()) {
      try {
        await this.pullFromGit(true); // Silent sync
      } catch (error) {
        console.warn("Auto-sync failed:", error);
      }
    }
  }

  loadTodos() {
    const stored = localStorage.getItem("todos");
    return stored ? JSON.parse(stored) : [];
  }

  saveTodos() {
    localStorage.setItem("todos", JSON.stringify(this.todos));
  }

  loadGitConfig() {
    const stored = localStorage.getItem("gitConfig");
    return stored ? JSON.parse(stored) : {};
  }

  saveGitConfig(config) {
    this.gitConfig = { ...this.gitConfig, ...config };
    localStorage.setItem("gitConfig", JSON.stringify(this.gitConfig));
    this.updateGitButtonStates();
  }

  loadGitConfigUI() {
    if (this.gitConfig.repoUrl)
      document.getElementById("repoUrl").value = this.gitConfig.repoUrl;
    if (this.gitConfig.gitToken)
      document.getElementById("gitToken").value = this.gitConfig.gitToken;
    if (this.gitConfig.gitBranch)
      document.getElementById("gitBranch").value = this.gitConfig.gitBranch;
    if (this.gitConfig.gitPath)
      document.getElementById("gitPath").value = this.gitConfig.gitPath;
  }

  addTodo(text, tags = [], priority = "medium") {
    if (!text.trim()) return;

    const todo = {
      id: Date.now(),
      text: text.trim(),
      completed: false,
      created: new Date().toISOString(),
      tags: tags.filter((t) => t.trim()).map((t) => t.trim().toLowerCase()),
      priority,
      lastModified: new Date().toISOString(),
    };

    this.todos.unshift(todo);
    this.saveTodos();
    this.render();
  }

  toggleTodo(id) {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      todo.lastModified = new Date().toISOString();
      if (todo.completed) {
        todo.completedDate = new Date().toISOString();
      } else {
        delete todo.completedDate;
      }
      this.saveTodos();
      this.render();
    }
  }

  deleteTodo(id) {
    this.todos = this.todos.filter((t) => t.id !== id);
    this.recordDeletedTodo(id);
    this.saveTodos();
    this.render();
  }

  editTodo(id, newText) {
    const todo = this.todos.find((t) => t.id === id);
    if (todo && newText.trim()) {
      todo.text = newText.trim();
      todo.lastModified = new Date().toISOString();
      this.saveTodos();
      this.render();
    }
  }

  getFilteredTodos() {
    switch (this.currentFilter) {
      case "pending":
        return this.todos.filter((t) => !t.completed);
      case "completed":
        return this.todos.filter((t) => t.completed);
      case "high":
        return this.todos.filter((t) => t.priority === "high");
      default:
        return this.todos;
    }
  }

  render() {
    const todoList = document.getElementById("todoList");
    const filteredTodos = this.getFilteredTodos();

    if (filteredTodos.length === 0) {
      todoList.innerHTML =
        '<div class="empty-state"><p>No todos match the current filter.</p></div>';
      return;
    }

    todoList.innerHTML = filteredTodos
      .map(
        (todo) => `
                    <div class="todo-item ${todo.completed ? "completed" : ""}">
                        <input type="checkbox" class="todo-checkbox" 
                               ${todo.completed ? "checked" : ""} 
                               onchange="app.toggleTodo(${todo.id})">
                        <div class="todo-content">
                            <div class="todo-title">${this.escapeHtml(
                              todo.text
                            )}</div>
                            <div class="todo-meta">
                                Created: ${new Date(
                                  todo.created
                                ).toLocaleDateString()} | 
                                Priority: ${todo.priority}
                                ${
                                  todo.completedDate
                                    ? ` | Completed: ${new Date(
                                        todo.completedDate
                                      ).toLocaleDateString()}`
                                    : ""
                                }
                            </div>
                            ${
                              todo.tags.length > 0
                                ? `
                                <div class="todo-tags">
                                    ${todo.tags
                                      .map(
                                        (tag) =>
                                          `<span class="tag">#${tag}</span>`
                                      )
                                      .join("")}
                                </div>
                            `
                                : ""
                            }
                        </div>
                        <div class="todo-actions">
                            <button onclick="startEditTodo(${
                              todo.id
                            })" class="edit-btn">Edit</button>
                            <button onclick="app.deleteTodo(${
                              todo.id
                            })" class="delete-btn">Delete</button>
                        </div>
                    </div>
                `
      )
      .join("");

    this.updateGitButtonStates();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  updateGitButtonStates() {
    const hasGitConfig = this.validateGitConfig();
    const pullButton = document.querySelector(
      'button[onclick="pullFromGit()"]'
    );
    const pushButton = document.querySelector('button[onclick="syncToGit()"]');

    if (pullButton) {
      pullButton.disabled = !hasGitConfig;
    }
    if (pushButton) {
      pushButton.disabled = !hasGitConfig;
    }
  }

  generateMarkdown(separateFiles = false) {
    if (separateFiles) {
      return this.todos.map((todo) => ({
        filename: `todo-${todo.id}.md`,
        content: this.generateSingleTodoMarkdown(todo),
      }));
    } else {
      return this.generateAllTodosMarkdown();
    }
  }

  generateSingleTodoMarkdown(todo) {
    const frontmatter = {
      id: todo.id,
      title: todo.text,
      completed: todo.completed,
      created: todo.created,
      lastModified: todo.lastModified,
      priority: todo.priority,
      tags: todo.tags,
    };

    if (todo.completedDate) {
      frontmatter.completedDate = todo.completedDate;
    }

    const yamlFrontmatter = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
        }
        return `${key}: ${typeof value === "string" ? `"${value}"` : value}`;
      })
      .join("\n");

    return `---
${yamlFrontmatter}
---

# ${todo.text}

Status: ${todo.completed ? "✅ Completed" : "⏳ Pending"}
Priority: ${todo.priority}
${
  todo.tags.length > 0 ? `Tags: ${todo.tags.map((t) => `#${t}`).join(" ")}` : ""
}

Created: ${new Date(todo.created).toLocaleDateString()}
${
  todo.completedDate
    ? `Completed: ${new Date(todo.completedDate).toLocaleDateString()}`
    : ""
}

---

<!-- Add additional notes or descriptions here -->
`;
  }

  generateAllTodosMarkdown() {
    const frontmatter = {
      title: "Todo List",
      generated: new Date().toISOString(),
      totalTodos: this.todos.length,
      completedTodos: this.todos.filter((t) => t.completed).length,
      pendingTodos: this.todos.filter((t) => !t.completed).length,
    };

    const yamlFrontmatter = Object.entries(frontmatter)
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === "string" ? `"${value}"` : value}`
      )
      .join("\n");

    const pendingTodos = this.todos.filter((t) => !t.completed);
    const completedTodos = this.todos.filter((t) => t.completed);

    let content = `---
${yamlFrontmatter}
---

# Todo List

Generated on: ${new Date().toLocaleDateString()}

## Summary
- **Total Todos**: ${this.todos.length}
- **Pending**: ${pendingTodos.length}
- **Completed**: ${completedTodos.length}

`;

    if (pendingTodos.length > 0) {
      content += `## 📋 Pending Todos

`;
      pendingTodos.forEach((todo) => {
        content += `### ${todo.text}
- **Priority**: ${todo.priority}
- **Created**: ${new Date(todo.created).toLocaleDateString()}
${
  todo.tags.length > 0
    ? `- **Tags**: ${todo.tags.map((t) => `#${t}`).join(" ")}\n`
    : ""
}
---

`;
      });
    }

    if (completedTodos.length > 0) {
      content += `## ✅ Completed Todos

`;
      completedTodos.forEach((todo) => {
        content += `### ~~${todo.text}~~
- **Priority**: ${todo.priority}
- **Created**: ${new Date(todo.created).toLocaleDateString()}
- **Completed**: ${new Date(todo.completedDate).toLocaleDateString()}
${
  todo.tags.length > 0
    ? `- **Tags**: ${todo.tags.map((t) => `#${t}`).join(" ")}\n`
    : ""
}
---

`;
      });
    }

    return content;
  }

  exportMarkdown(separateFiles = false) {
    if (separateFiles) {
      const files = this.generateMarkdown(true);
      files.forEach((file) => {
        this.downloadFile(file.content, file.filename);
      });
    } else {
      const markdown = this.generateMarkdown(false);
      this.downloadFile(markdown, "todos.md");
    }
  }

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearAll() {
    if (
      confirm(
        "Are you sure you want to delete all todos? This cannot be undone."
      )
    ) {
      this.todos = [];
      this.saveTodos();
      this.render();
    }
  }

  // Git sync functionality
  async pullFromGit(silent = false) {
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
        (filename) => filename.startsWith("todo-") && filename.endsWith(".md")
      );

      if (todoFiles.length === 0) {
        if (!silent)
          this.showSyncStatus("No todo files found in repository", "success");
        return;
      }

      // Fetch and parse each todo file
      const fetchPromises = todoFiles.map((filename) =>
        this.fetchTodoFile(filename)
      );
      const todos = await Promise.all(fetchPromises);

      // Filter out any failed fetches
      const validTodos = todos.filter((todo) => todo !== null);

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
    } catch (error) {
      console.error("Git pull error:", error);
      if (!silent)
        this.showSyncStatus(`Pull failed: ${error.message}`, "error");
    } finally {
      this.syncInProgress = false;
    }
  }

  async fetchTodoFile(filename) {
    const { repoUrl, gitToken, gitBranch, gitPath } = this.gitConfig;
    const path = `${gitPath || ""}${filename}`;

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
        console.warn(`Failed to fetch ${filename}: ${response.statusText}`);
        return null;
      }

      const fileData = await response.json();
      const content = decodeURIComponent(escape(atob(fileData.content)));

      return this.parseMarkdownTodo(content, filename);
    } catch (error) {
      console.warn(`Error parsing ${filename}:`, error);
      return null;
    }
  }

  parseMarkdownTodo(content, filename) {
    try {
      // Extract YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        console.warn(`No frontmatter found in ${filename}`);
        return null;
      }

      const frontmatter = frontmatterMatch[1];
      const todo = {};

      // Parse YAML frontmatter (simple parser for our specific format)
      const lines = frontmatter.split("\n");
      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) continue;

        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        if (key === "tags") {
          // Handle tags array
          todo.tags = [];
          continue;
        } else if (line.startsWith("  - ") && todo.tags !== undefined) {
          // Handle tag array items
          todo.tags.push(line.substring(4).trim());
        } else if (value === "true") {
          todo[key] = true;
        } else if (value === "false") {
          todo[key] = false;
        } else if (value.startsWith('"') && value.endsWith('"')) {
          todo[key] = value.slice(1, -1);
        } else if (!isNaN(value)) {
          todo[key] = parseInt(value);
        } else {
          todo[key] = value;
        }
      }

      // Validate required fields
      if (!todo.id || !todo.title) {
        console.warn(`Invalid todo structure in ${filename}`);
        return null;
      }

      // Map title to text for consistency with our data structure
      todo.text = todo.title;
      delete todo.title;

      // Ensure tags is an array
      if (!Array.isArray(todo.tags)) {
        todo.tags = [];
      }

      return todo;
    } catch (error) {
      console.warn(`Error parsing frontmatter in ${filename}:`, error);
      return null;
    }
  }

  mergeTodos(remoteTodos) {
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
  }

  getRecentlyDeletedTodos() {
    // Get recently deleted todos (within last 5 minutes)
    const recentlyDeleted = JSON.parse(localStorage.getItem('recently_deleted_todos') || '[]');
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    // Clean up old deletions
    const validDeleted = recentlyDeleted.filter(item => item.deletedAt > fiveMinutesAgo);
    localStorage.setItem('recently_deleted_todos', JSON.stringify(validDeleted));
    
    return new Set(validDeleted.map(item => item.id));
  }

  recordDeletedTodo(todoId) {
    const recentlyDeleted = JSON.parse(localStorage.getItem('recently_deleted_todos') || '[]');
    recentlyDeleted.push({ id: todoId, deletedAt: Date.now() });
    localStorage.setItem('recently_deleted_todos', JSON.stringify(recentlyDeleted));
  }

  async syncToGit() {
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

      // Create/update files
      const updatePromises = files.map((file) =>
        this.createOrUpdateFile(file.filename, file.content)
      );

      // Delete files for todos that no longer exist
      const currentFilenames = new Set(files.map((f) => f.filename));
      const filesToDelete = existingFiles
        .filter(
          (filename) => filename.startsWith("todo-") && filename.endsWith(".md")
        )
        .filter((filename) => !currentFilenames.has(filename));
      
      console.log(`Files to delete: ${filesToDelete.length}`, filesToDelete);
      console.log(`Current files: ${files.length}`, files.map(f => f.filename));
      
      const deletePromises = filesToDelete.map((filename) => this.deleteFile(filename));

      await Promise.all([...updatePromises, ...deletePromises]);

      this.showSyncStatus(
        `Successfully synced ${files.length} todos to git repository`,
        "success"
      );
      
      // Longer delay to ensure GitHub API consistency for deletions
      await new Promise(resolve => setTimeout(resolve, 2000));
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
  }

  validateGitConfig() {
    return (
      this.gitConfig.repoUrl &&
      this.gitConfig.gitToken &&
      this.gitConfig.gitBranch
    );
  }

  async getExistingFiles() {
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

      if (response.status === 404) {
        return []; // Directory doesn't exist yet
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch existing files: ${response.statusText}`
        );
      }

      const files = await response.json();
      return files.map((file) => file.name);
    } catch (error) {
      console.warn("Could not fetch existing files:", error);
      return [];
    }
  }

  async createOrUpdateFile(filename, content) {
    const { repoUrl, gitToken, gitBranch, gitPath } = this.gitConfig;
    const path = `${gitPath || ""}${filename}`;

    // Check if file exists to get SHA for updates
    let sha = null;
    try {
      const existingResponse = await fetch(
        `https://api.github.com/repos/${repoUrl}/contents/${path}?ref=${gitBranch}`,
        {
          headers: {
            Authorization: `token ${gitToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (existingResponse.ok) {
        const existingFile = await existingResponse.json();
        sha = existingFile.sha;
      }
    } catch (error) {
      // File doesn't exist, will create new
    }

    const body = {
      message: sha ? `Update ${filename}` : `Create ${filename}`,
      content: btoa(unescape(encodeURIComponent(content))), // Base64 encode UTF-8
      branch: gitBranch,
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${repoUrl}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${gitToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (e) {
        // Response might not be JSON
      }
      
      // Provide more specific error messages
      if (response.status === 404) {
        throw new Error(`Repository or path not found. Please check:
        • Repository: ${repoUrl}
        • Branch: ${gitBranch}
        • Path: ${path}
        • Token permissions`);
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed. Please check your Personal Access Token has the required permissions (repo scope).`);
      } else {
        throw new Error(`Failed to ${sha ? "update" : "create"} ${filename}: ${errorMessage}`);
      }
    }

    return response.json();
  }

  async deleteFile(filename) {
    const { repoUrl, gitToken, gitBranch, gitPath } = this.gitConfig;
    const path = `${gitPath || ""}${filename}`;

    try {
      console.log(`Attempting to delete file: ${filename}`);
      
      // Get file SHA
      const fileResponse = await fetch(
        `https://api.github.com/repos/${repoUrl}/contents/${path}?ref=${gitBranch}`,
        {
          headers: {
            Authorization: `token ${gitToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!fileResponse.ok) {
        console.log(`File ${filename} doesn't exist remotely, skipping deletion`);
        return; // File doesn't exist
      }

      const fileData = await fileResponse.json();

      const response = await fetch(
        `https://api.github.com/repos/${repoUrl}/contents/${path}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `token ${gitToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Delete ${filename}`,
            sha: fileData.sha,
            branch: gitBranch,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error(`Failed to delete ${filename}:`, error);
        throw new Error(`Failed to delete ${filename}: ${error.message}`);
      } else {
        console.log(`Successfully deleted file: ${filename}`);
      }
    } catch (error) {
      console.warn(`Could not delete ${filename}:`, error);
    }
  }

  showSyncStatus(message, type) {
    const statusEl = document.getElementById("syncStatus");
    
    // Don't show intermediate errors during sync - only final results
    if (type === "error" && message.includes("Failed to")) {
      console.warn("Sync warning:", message);
      return; // Don't display API errors to user
    }
    
    statusEl.textContent = message;
    statusEl.className = `sync-status ${type}`;
    statusEl.style.display = "block";

    if (type === "success" || type === "error") {
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 5000);
    }
  }

  showSetupStatus(message, type) {
    const statusEl = document.getElementById("setupStatus");
    statusEl.textContent = message;
    statusEl.className = `sync-status ${type}`;
    statusEl.style.display = "block";

    if (type === "success" || type === "error") {
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 5000);
    }
  }
}

// Initialize app
const app = new TodoApp();

// UI Functions
function addTodo() {
  const todoInput = document.getElementById("todoInput");
  const tagsInput = document.getElementById("tagsInput");
  const prioritySelect = document.getElementById("prioritySelect");

  const text = todoInput.value.trim();
  const tags = tagsInput.value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t);
  const priority = prioritySelect.value;

  if (text) {
    app.addTodo(text, tags, priority);
    todoInput.value = "";
    tagsInput.value = "";
    prioritySelect.value = "medium";
  }
}

function filterTodos(filter) {
  // Update active filter button
  document
    .querySelectorAll(".filter-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  app.currentFilter = filter;
  app.render();
}

function exportToMarkdown() {
  app.exportMarkdown(false);
}

function exportSeparateFiles() {
  app.exportMarkdown(true);
}

function previewMarkdown() {
  const preview = document.getElementById("markdownPreview");
  const markdown = app.generateMarkdown(false);

  if (preview.style.display === "none") {
    preview.textContent = markdown;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }
}

function clearAllTodos() {
  app.clearAll();
}

function saveGitConfig() {
  const config = {
    repoUrl: document.getElementById("repoUrl").value.trim(),
    gitToken: document.getElementById("gitToken").value.trim(),
    gitBranch: document.getElementById("gitBranch").value.trim() || "main",
    gitPath: document.getElementById("gitPath").value.trim(),
  };

  app.saveGitConfig(config);
  app.showSyncStatus("Git configuration saved", "success");
}

function syncToGit() {
  app.syncToGit();
}

function pullFromGit() {
  app.pullFromGit();
}

// Setup page functions
async function completeSetup() {
  const config = {
    repoUrl: document.getElementById("setupRepoUrl").value.trim(),
    gitToken: document.getElementById("setupGitToken").value.trim(),
    gitBranch: document.getElementById("setupGitBranch").value.trim() || "main",
    gitPath: document.getElementById("setupGitPath").value.trim(),
  };

  if (!config.repoUrl || !config.gitToken) {
    app.showSetupStatus(
      "Please fill in repository URL and access token",
      "error"
    );
    return;
  }

  app.saveGitConfig(config);
  app.showSetupStatus(
    "Configuration saved. Syncing with repository...",
    "loading"
  );

  try {
    await app.pullFromGit(true);
    app.showSetupStatus("Setup complete! Redirecting to app...", "success");
    setTimeout(() => {
      app.showMainPage();
    }, 1500);
  } catch (error) {
    app.showSetupStatus(
      "Configuration saved, but initial sync failed. You can try again later.",
      "error"
    );
    setTimeout(() => {
      app.showMainPage();
    }, 3000);
  }
}

function skipSetup() {
  app.showMainPage();
}

function openSettings() {
  app.showSetupPage();
}

// Keyboard shortcuts
document.getElementById("todoInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addTodo();
  }
});

// Accordion functionality
function toggleAccordion() {
  const toggle = document.querySelector('.accordion-toggle');
  const content = document.getElementById('accordionContent');
  
  toggle.classList.toggle('active');
  content.classList.toggle('active');
}

// Todo editing functionality
let editingStates = new Map(); // Store original states

function startEditTodo(id) {
  const todo = app.todos.find(t => t.id === id);
  if (!todo) return;

  // Find the todo item
  const allItems = document.querySelectorAll('.todo-item');
  let todoItem = null;
  
  for (let item of allItems) {
    const editBtn = item.querySelector('.edit-btn');
    if (editBtn && editBtn.getAttribute('onclick').includes(id)) {
      todoItem = item;
      break;
    }
  }
  
  if (!todoItem) return;

  const todoContent = todoItem.querySelector('.todo-content');
  
  // Store the original HTML for cancel
  editingStates.set(id, todoContent.innerHTML);
  
  todoContent.innerHTML = `
    <div class="todo-edit-mode">
      <textarea class="todo-edit-textarea" id="editTextarea_${id}" rows="15">${todo.text}</textarea>
      <div class="todo-edit-actions">
        <button onclick="saveEditTodo(${id})" class="save-btn">Save</button>
        <button onclick="cancelEditTodo(${id})" class="cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  
  // Focus and select the textarea
  const textarea = document.getElementById(`editTextarea_${id}`);
  textarea.focus();
  textarea.select();
}

function saveEditTodo(id) {
  const textarea = document.getElementById(`editTextarea_${id}`);
  if (!textarea) return;
  
  const newText = textarea.value.trim();
  if (newText) {
    app.editTodo(id, newText);
  } else {
    cancelEditTodo(id); // Cancel if empty
  }
  
  // Clean up stored state
  editingStates.delete(id);
}

function cancelEditTodo(id) {
  const originalContent = editingStates.get(id);
  if (!originalContent) {
    // Fallback: just re-render everything
    app.render();
    return;
  }
  
  // Find the todo item and restore original content
  const allItems = document.querySelectorAll('.todo-item');
  for (let item of allItems) {
    const editMode = item.querySelector('.todo-edit-mode');
    if (editMode) {
      const textarea = editMode.querySelector(`#editTextarea_${id}`);
      if (textarea) {
        const todoContent = item.querySelector('.todo-content');
        todoContent.innerHTML = originalContent;
        break;
      }
    }
  }
  
  // Clean up stored state
  editingStates.delete(id);
}
