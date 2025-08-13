// Additional Git API methods

TodoApp.prototype.fetchTodoFile = async function(filename) {
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
      throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = atob(data.content);

    // Parse the markdown frontmatter and content
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      console.warn(`No frontmatter found in ${filename}`);
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const text = frontmatterMatch[2].trim();

    const todo = { text };

    // Parse YAML-like frontmatter
    frontmatter.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        if (key.trim() === 'tags') {
          todo.tags = value ? value.split(',').map(t => t.trim()) : [];
        } else {
          todo[key.trim()] = value === 'true' ? true : value === 'false' ? false : value;
        }
      }
    });

    return todo;
  } catch (error) {
    console.warn(`Error parsing frontmatter in ${filename}:`, error);
    return null;
  }
};

TodoApp.prototype.generateMarkdown = function(separateFiles = false) {
  if (!separateFiles) {
    // Single file export
    let markdown = "# My Todos\n\n";
    
    const groupedTodos = {
      'High Priority': this.todos.filter(t => t.priority === 'high' && !t.completed),
      'Medium Priority': this.todos.filter(t => t.priority === 'medium' && !t.completed),
      'Low Priority': this.todos.filter(t => t.priority === 'low' && !t.completed),
      'Completed': this.todos.filter(t => t.completed)
    };

    Object.entries(groupedTodos).forEach(([section, todos]) => {
      if (todos.length > 0) {
        markdown += `## ${section}\n\n`;
        todos.forEach(todo => {
          const checkbox = todo.completed ? "[x]" : "[ ]";
          const tags = todo.tags?.length ? ` (${todo.tags.join(', ')})` : '';
          markdown += `- ${checkbox} ${todo.text}${tags}\n`;
        });
        markdown += "\n";
      }
    });

    return [{ filename: 'todos.md', content: markdown }];
  }

  // Separate files for git sync
  return this.todos.map(todo => {
    const frontmatter = [
      `id: ${todo.id}`,
      `completed: ${todo.completed}`,
      `priority: ${todo.priority}`,
      `created: ${todo.created}`,
      `lastModified: ${todo.lastModified}`,
      `tags: ${todo.tags?.join(',') || ''}`
    ].join('\n');

    const content = `---\n${frontmatter}\n---\n\n${todo.text}`;
    const filename = `todo-${todo.id}.md`;
    
    return { filename, content };
  });
};

TodoApp.prototype.createOrUpdateFile = async function(filename, content) {
  const { repoUrl, gitToken, gitBranch, gitPath } = this.gitConfig;
  const path = `${gitPath || ""}${filename}`;

  // Check if file exists to get SHA for update
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
      const existingData = await existingResponse.json();
      sha = existingData.sha;
    }
  } catch (error) {
    // File doesn't exist, will create new
  }

  const body = {
    message: sha ? `Update ${filename}` : `Create ${filename}`,
    content: btoa(unescape(encodeURIComponent(content))),
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
    const error = await response.json();
    const errorMessage = error.message || "Unknown error";
    
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
};

TodoApp.prototype.deleteFile = async function(filename) {
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
};

TodoApp.prototype.showSyncStatus = function(message, type) {
  const statusEl = document.getElementById("syncStatus");
  const setupStatusEl = document.getElementById("setupStatus");
  
  const targetEl = statusEl || setupStatusEl;
  if (!targetEl) return;

  targetEl.style.display = "block";
  targetEl.className = `sync-status ${type}`;
  targetEl.textContent = message;

  if (type === "success" || type === "error") {
    setTimeout(() => {
      targetEl.style.display = "none";
    }, 5000);
  }
};

TodoApp.prototype.showSetupStatus = function(message, type) {
  const statusEl = document.getElementById("setupStatus");
  if (!statusEl) return;

  statusEl.style.display = "block";
  statusEl.className = `sync-status ${type}`;
  statusEl.textContent = message;

  if (type === "success" || type === "error") {
    setTimeout(() => {
      statusEl.style.display = "none";
    }, 5000);
  }
};