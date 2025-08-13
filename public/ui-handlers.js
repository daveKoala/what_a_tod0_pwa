// UI event handlers and utility functions

// Global functions called from HTML
function addTodo() {
  app.addTodo();
}

function pullFromGit() {
  app.pullFromGit();
}

function syncToGit() {
  app.syncToGit();
}

function filterTodos(filter) {
  app.filterTodos(filter);
}

function completeSetup() {
  const repoUrl = document.getElementById("setupRepoUrl").value.trim();
  const gitToken = document.getElementById("setupGitToken").value.trim();
  const gitBranch = document.getElementById("setupGitBranch").value.trim() || "main";
  const gitPath = document.getElementById("setupGitPath").value.trim();

  if (!repoUrl || !gitToken) {
    app.showSetupStatus("Please enter both repository URL and access token", "error");
    return;
  }

  app.saveGitConfig({
    repoUrl,
    gitToken, 
    gitBranch,
    gitPath: gitPath ? (gitPath.endsWith('/') ? gitPath : gitPath + '/') : ''
  });

  app.showSetupStatus("Configuration saved. Attempting initial sync...", "loading");

  setTimeout(async () => {
    try {
      await app.pullFromGit();
      app.showMainPage();
      app.showSyncStatus("Setup complete! Your todos are now synced with Git.", "success");
    } catch (error) {
      app.showSetupStatus("Setup saved but initial sync failed. You can try syncing manually.", "warning");
      setTimeout(() => app.showMainPage(), 2000);
    }
  }, 500);
}

function skipSetup() {
  app.showMainPage();
}

function exportToMarkdown() {
  app.exportToMarkdown();
}

function exportSeparateFiles() {
  app.exportSeparateFiles();
}

function previewMarkdown() {
  app.previewMarkdown();
}

function clearAllTodos() {
  if (confirm("Are you sure you want to delete all todos? This cannot be undone.")) {
    app.clearAllTodos();
  }
}

// Add the missing methods to TodoApp
TodoApp.prototype.clearAllTodos = function() {
  this.todos = [];
  this.saveTodos();
  this.render();
};

TodoApp.prototype.exportToMarkdown = function() {
  const files = this.generateMarkdown(false);
  if (files.length > 0) {
    const blob = new Blob([files[0].content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = files[0].filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

TodoApp.prototype.exportSeparateFiles = function() {
  const files = this.generateMarkdown(true);
  if (files.length === 0) {
    alert('No todos to export');
    return;
  }
  
  // Create a zip-like structure by downloading each file
  files.forEach((file, index) => {
    setTimeout(() => {
      const blob = new Blob([file.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    }, index * 200); // Stagger downloads
  });
};

TodoApp.prototype.previewMarkdown = function() {
  const files = this.generateMarkdown(false);
  if (files.length > 0) {
    const preview = document.getElementById('markdownPreview');
    preview.innerHTML = `<pre>${files[0].content}</pre>`;
    preview.style.display = preview.style.display === 'block' ? 'none' : 'block';
  }
};

// Editing functionality
let editingStates = new Map();

TodoApp.prototype.startEdit = function(id) {
  if (editingStates.has(id)) return; // Already editing
  
  const todo = this.todos.find(t => t.id === id);
  if (!todo) return;
  
  const todoElement = document.querySelector(`[data-id="${id}"] .todo-main-text`);
  if (!todoElement) return;
  
  const originalText = todo.text;
  editingStates.set(id, originalText);
  
  const input = document.createElement('textarea');
  input.value = originalText;
  input.className = 'edit-input';
  input.style.cssText = 'width: 100%; min-height: 60px; font-family: inherit; font-size: inherit; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; resize: vertical;';
  
  todoElement.innerHTML = '';
  todoElement.appendChild(input);
  input.focus();
  input.select();
  
  const finishEdit = () => {
    const newText = input.value.trim();
    if (newText && newText !== originalText) {
      this.editTodo(id, newText);
    }
    todoElement.innerHTML = newText || originalText;
    editingStates.delete(id);
  };
  
  const cancelEdit = () => {
    todoElement.innerHTML = originalText;
    editingStates.delete(id);
  };
  
  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      finishEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
};

function toggleAccordion() {
  const content = document.getElementById('accordionContent');
  const toggle = document.querySelector('.accordion-toggle');
  const icon = toggle.querySelector('.accordion-icon');
  
  content.classList.toggle('open');
  icon.textContent = content.classList.contains('open') ? '▼' : '▶';
}

function openSettings() {
  app.showSetupPage();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const todoInput = document.getElementById('todoInput');
    if (document.activeElement === todoInput) {
      addTodo();
    }
  }
});

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', () => {
  const todoInput = document.getElementById('todoInput');
  if (todoInput) {
    todoInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });
  }
});