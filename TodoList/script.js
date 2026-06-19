// script.js
(function() {
  const taskInput = document.getElementById('taskInput');
  const addBtn = document.getElementById('addTaskBtn');
  const taskList = document.getElementById('taskList');
  const totalSpan = document.getElementById('totalTasks');
  const completedSpan = document.getElementById('completedTasks');
  const pendingSpan = document.getElementById('pendingTasks');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const darkToggle = document.getElementById('darkModeToggle');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let tasks = [];
  let currentFilter = 'all';

  function loadTasks() {
    const stored = localStorage.getItem('todoTasks');
    if (stored) {
      try {
        tasks = JSON.parse(stored);
      } catch {
        tasks = [];
      }
    } else {
      tasks = [];
    }
    render();
  }

  function saveTasks() {
    localStorage.setItem('todoTasks', JSON.stringify(tasks));
  }

  function render() {
    let filtered = tasks;
    if (currentFilter === 'pending') {
      filtered = tasks.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
      filtered = tasks.filter(t => t.completed);
    }

    filtered.sort((a, b) => Number(a.completed) - Number(b.completed));

    if (filtered.length === 0) {
      taskList.innerHTML = `<div style="padding:1.5rem;text-align:center;opacity:0.5;font-style:italic;">✨ No tasks here</div>`;
    } else {
      let html = '';
      filtered.forEach(task => {
        const completedClass = task.completed ? 'completed' : '';
        html += `
              <li class="task-item ${completedClass}" data-id="${task.id}">
                <span class="task-text">${escapeHTML(task.text)}</span>
                <div class="task-actions">
                  <button class="complete-btn" data-action="complete"><i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i></button>
                  <button class="edit-btn" data-action="edit"><i class="fas fa-pen"></i></button>
                  <button class="delete-btn" data-action="delete"><i class="fas fa-times"></i></button>
                </div>
              </li>
            `;
      });
      taskList.innerHTML = html;
    }

    updateCounter();
    saveTasks();
    updateFilterActive();
  }

  function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateCounter() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    totalSpan.textContent = `${total} total`;
    completedSpan.textContent = `${completed} done`;
    pendingSpan.textContent = `${pending} pending`;
  }

  function updateFilterActive() {
    filterBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === currentFilter);
    });
  }

  function addTask() {
    const text = taskInput.value.trim();
    if (text === '') {
      taskInput.focus();
      return;
    }
    const newTask = {
      id: Date.now(),
      text: text,
      completed: false
    };
    tasks.push(newTask);
    taskInput.value = '';
    taskInput.focus();
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    render();
  }

  function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      render();
    }
  }

  function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const li = document.querySelector(`.task-item[data-id="${id}"]`);
    if (!li) return;
    const textSpan = li.querySelector('.task-text');
    const actionsDiv = li.querySelector('.task-actions');
    const currentText = task.text;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = currentText;
    textSpan.replaceWith(input);
    input.focus();
    input.select();

    const saveBtn = document.createElement('button');
    saveBtn.className = 'complete-btn';
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    saveBtn.title = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'delete-btn';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    cancelBtn.title = 'Cancel';

    actionsDiv.innerHTML = '';
    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(cancelBtn);

    function saveEdit() {
      const newText = input.value.trim();
      if (newText !== '') {
        task.text = newText;
      }
      render();
    }

    function cancelEdit() {
      render();
    }

    saveBtn.addEventListener('click', saveEdit);
    cancelBtn.addEventListener('click', cancelEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveEdit();
      else if (e.key === 'Escape') cancelEdit();
    });
  }

  function clearAll() {
    if (tasks.length === 0) return;
    if (confirm('Delete all tasks?')) {
      tasks = [];
      render();
    }
  }

  taskList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const li = btn.closest('.task-item');
    if (!li) return;
    const id = Number(li.dataset.id);
    const action = btn.dataset.action;

    if (action === 'delete') deleteTask(id);
    else if (action === 'complete') toggleComplete(id);
    else if (action === 'edit') editTask(id);
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const icon = darkToggle.querySelector('i');
    if (document.body.classList.contains('dark-mode')) {
      icon.className = 'fas fa-sun';
    } else {
      icon.className = 'fas fa-moon';
    }
  });

  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });
  addBtn.addEventListener('click', addTask);
  clearAllBtn.addEventListener('click', clearAll);

  loadTasks();
})();