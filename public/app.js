// Main TodoApp class
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
    
    // Display version info
    this.displayVersion();
  }

  needsSetup() {
    return !this.gitConfig.repoUrl || !this.gitConfig.gitToken;
  }

  displayVersion() {
    const versionEl = document.getElementById('versionDisplay');
    if (versionEl && window.APP_CONFIG) {
      const { version, buildHash, environment } = window.APP_CONFIG;
      const envIcon = environment === 'development' ? '🛠️' : '🚀';
      versionEl.textContent = `${envIcon} v${version} (${buildHash})`;
      versionEl.title = `Environment: ${environment}\nBuild: ${buildHash}\nVersion: ${version}`;
    }
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

  // Storage methods
  loadTodos() {
    const stored = localStorage.getItem("todos");
    return stored ? JSON.parse(stored) : [];
  }

  saveTodos() {
    localStorage.setItem("todos", JSON.stringify(this.todos));
  }

  loadGitConfig() {
    const stored = localStorage.getItem("gitConfig");
    return stored
      ? JSON.parse(stored)
      : { repoUrl: "", gitToken: "", gitBranch: "main", gitPath: "" };
  }

  saveGitConfig(updates) {
    this.gitConfig = { ...this.gitConfig, ...updates };
    localStorage.setItem("gitConfig", JSON.stringify(this.gitConfig));
  }

  autoSync() {
    if (this.validateGitConfig()) {
      this.pullFromGit(true);
    }
  }

  render() {
    const todoList = document.getElementById("todoList");
    const filteredTodos = this.getFilteredTodos();

    if (filteredTodos.length === 0) {
      todoList.innerHTML = `
        <div class="empty-state">
          <p>No ${this.currentFilter === "all" ? "" : this.currentFilter} todos yet.</p>
        </div>
      `;
      return;
    }

    todoList.innerHTML = filteredTodos
      .map((todo) => this.createTodoHTML(todo))
      .join("");
  }

  createTodoHTML(todo) {
    const priorityClass = `priority-${todo.priority}`;
    const completedClass = todo.completed ? "completed" : "";
    const tagsHTML = todo.tags
      ?.map((tag) => `<span class="tag">${tag}</span>`)
      .join("");

    return `
      <div class="todo-item ${priorityClass} ${completedClass}" data-id="${todo.id}">
        <div class="todo-content">
          <div class="todo-checkbox">
            <input type="checkbox" ${todo.completed ? "checked" : ""} 
                   onchange="app.toggleTodo('${todo.id}')">
          </div>
          <div class="todo-text" onclick="app.startEdit('${todo.id}')">
            <div class="todo-main-text">${todo.text}</div>
            <div class="todo-tags">${tagsHTML || ""}</div>
            <div class="todo-meta">
              <span class="priority-indicator">${todo.priority}</span>
              <span class="todo-date">${new Date(todo.created).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div class="todo-actions">
          <button class="edit-btn" onclick="app.startEdit('${todo.id}')" title="Edit">✏️</button>
          <button class="delete-btn" onclick="app.deleteTodo('${todo.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  getFilteredTodos() {
    return this.todos.filter((todo) => {
      switch (this.currentFilter) {
        case "completed":
          return todo.completed;
        case "pending":
          return !todo.completed;
        case "high":
          return todo.priority === "high";
        default:
          return true;
      }
    });
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TodoApp();
});