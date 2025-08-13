// Todo CRUD operations
TodoApp.prototype.addTodo = function() {
  const input = document.getElementById("todoInput");
  const tagsInput = document.getElementById("tagsInput");
  const prioritySelect = document.getElementById("prioritySelect");

  const text = input.value.trim();
  if (!text) return;

  const tags = tagsInput.value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t);

  const todo = {
    id: Date.now().toString(),
    text,
    completed: false,
    priority: prioritySelect.value,
    tags,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };

  this.todos.unshift(todo);
  this.saveTodos();
  this.render();

  // Clear inputs
  input.value = "";
  tagsInput.value = "";
  prioritySelect.value = "medium";
};

TodoApp.prototype.toggleTodo = function(id) {
  const todo = this.todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    todo.lastModified = new Date().toISOString();
    this.saveTodos();
    this.render();
  }
};

TodoApp.prototype.deleteTodo = function(id) {
  this.todos = this.todos.filter((t) => t.id !== id);
  this.recordDeletedTodo(id);
  this.saveTodos();
  this.render();
};

TodoApp.prototype.editTodo = function(id, newText) {
  const todo = this.todos.find((t) => t.id === id);
  if (todo && newText.trim()) {
    todo.text = newText.trim();
    todo.lastModified = new Date().toISOString();
    this.saveTodos();
    this.render();
  }
};

TodoApp.prototype.filterTodos = function(filter) {
  this.currentFilter = filter;
  
  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  this.render();
};

// Deletion tracking for Git sync
TodoApp.prototype.getRecentlyDeletedTodos = function() {
  // Get recently deleted todos (within last 5 minutes)
  const recentlyDeleted = JSON.parse(localStorage.getItem('recently_deleted_todos') || '[]');
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  
  // Clean up old deletions
  const validDeleted = recentlyDeleted.filter(item => item.deletedAt > fiveMinutesAgo);
  localStorage.setItem('recently_deleted_todos', JSON.stringify(validDeleted));
  
  return new Set(validDeleted.map(item => item.id));
};

TodoApp.prototype.recordDeletedTodo = function(todoId) {
  const recentlyDeleted = JSON.parse(localStorage.getItem('recently_deleted_todos') || '[]');
  recentlyDeleted.push({ id: todoId, deletedAt: Date.now() });
  localStorage.setItem('recently_deleted_todos', JSON.stringify(recentlyDeleted));
};