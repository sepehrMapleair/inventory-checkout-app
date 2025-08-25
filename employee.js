// employee.js
// This script powers the employee portal. It includes a simple login
// mechanism using localStorage, allows employees to submit inventory
// checkout requests, view their own request history, and handles
// dynamic item entry. Requests are stored in localStorage along with
// the requester and assigned approver. User accounts are also stored
// locally with roles (employee, approver, superadmin).

document.addEventListener('DOMContentLoaded', () => {
  // DOM references
  const loginSection = document.getElementById('loginSection');
  const mainSection = document.getElementById('mainSection');
  const loginButton = document.getElementById('loginButton');
  const loginError = document.getElementById('loginError');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const logoutButton = document.getElementById('logoutButton');
  const newRequestNav = document.getElementById('newRequestNav');
  const dashboardNav = document.getElementById('dashboardNav');
  const requestSection = document.getElementById('requestSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const dashboardBody = document.getElementById('dashboardBody');
  const form = document.getElementById('requestForm');
  const successMessage = document.getElementById('successMessage');
  const itemModeRadios = document.querySelectorAll('input[name="itemMode"]');
  const singleItemSection = document.getElementById('singleItemSection');
  const multipleItemsSection = document.getElementById('multipleItemsSection');
  const itemsBody = document.getElementById('itemsBody');
  const addItemButton = document.getElementById('addItemButton');
  const approverSelect = document.getElementById('approver');

  // Ensure there are some default users if none exist
  function initializeUsers() {
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.length === 0) {
      users = [
        { username: 'employee1', password: 'password', name: 'Employee One', role: 'employee' },
        { username: 'employee2', password: 'password', name: 'Employee Two', role: 'employee' },
        { username: 'approver1', password: 'password', name: 'Approver One', role: 'approver' },
        { username: 'approver2', password: 'password', name: 'Approver Two', role: 'approver' },
        { username: 'superadmin', password: 'admin123', name: 'Super Admin', role: 'superadmin' }
      ];
      localStorage.setItem('users', JSON.stringify(users));
    }
  }

  // Get current user session
  function getCurrentUser() {
    const data = localStorage.getItem('currentUser');
    return data ? JSON.parse(data) : null;
  }
  function setCurrentUser(username) {
    localStorage.setItem('currentUser', JSON.stringify({ username }));
  }
  function logout() {
    localStorage.removeItem('currentUser');
    // Reload to reset state
    window.location.reload();
  }

  // Load the UI for a logged-in user
  function loadUserUI() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const session = getCurrentUser();
    if (!session) return;
    const currentUser = users.find(u => u.username === session.username);
    if (!currentUser) {
      logout();
      return;
    }
    // Populate name field and disable editing
    const nameInput = document.getElementById('name');
    if (nameInput) {
      nameInput.value = currentUser.name || currentUser.username;
    }
    // Populate approvers dropdown
    approverSelect.innerHTML = '';
    const approvers = users.filter(u => u.role === 'approver');
    approvers.forEach(ap => {
      const opt = document.createElement('option');
      opt.value = ap.username;
      opt.textContent = `${ap.name} (${ap.username})`;
      approverSelect.appendChild(opt);
    });
    // Set default date
    const dateInput = document.getElementById('date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
    // Show main, hide login
    loginSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    // Show request section by default
    showRequestSection();
    // Update dashboard
    updateDashboard();
  }

  function showRequestSection() {
    requestSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
  }
  function showDashboardSection() {
    requestSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    updateDashboard();
  }

  // Update the employee dashboard with their own requests
  function updateDashboard() {
    const current = getCurrentUser();
    if (!current) return;
    const all = JSON.parse(localStorage.getItem('inventoryRequests') || '[]');
    // Filter by requester username
    const myReqs = all.filter(r => r.requester === current.username);
    // Clear existing rows
    dashboardBody.innerHTML = '';
    myReqs.sort((a, b) => new Date(b.date) - new Date(a.date));
    myReqs.forEach(req => {
      // Row for summary
      const tr = document.createElement('tr');
      tr.classList.add('animate-row');
      const itemsSummary = req.items.map(item => `${item.part} x ${item.qty}`).join('; ');
      // Expand sign always '+' initially
      tr.innerHTML = `
        <td class="expand-btn">+</td>
        <td>${req.id}</td>
        <td>${req.date}</td>
        <td>${req.purpose.charAt(0).toUpperCase() + req.purpose.slice(1)}</td>
        <td>${req.warehouse || ''}</td>
        <td>${itemsSummary}</td>
        <td>${req.approver}</td>
        <td class="status-${req.status.toLowerCase()}">${req.status}</td>
      `;
      // Actions column
      const actionsTd = document.createElement('td');
      if (req.status === 'Pending') {
        const pushBtn = document.createElement('button');
        pushBtn.textContent = 'Push to Top';
        pushBtn.className = 'btn-secondary';
        pushBtn.addEventListener('click', () => {
          handlePushTop(req.id);
        });
        const withdrawBtn = document.createElement('button');
        withdrawBtn.textContent = 'Withdraw';
        withdrawBtn.className = 'btn-secondary';
        withdrawBtn.addEventListener('click', () => {
          handleWithdraw(req.id);
        });
        actionsTd.appendChild(pushBtn);
        actionsTd.appendChild(withdrawBtn);
      }
      tr.appendChild(actionsTd);
      // Create details row
      const detailsTr = document.createElement('tr');
      detailsTr.classList.add('details-row', 'hidden');
      const detailsTd = document.createElement('td');
      // Colspan equals number of columns in summary row (including expand + id + date + purpose + warehouse + items + approver + status + actions)
      detailsTd.colSpan = tr.children.length;
      detailsTd.innerHTML = generateEmployeeDetails(req);
      detailsTr.appendChild(detailsTd);
      // Expand/collapse functionality
      const expandCell = tr.querySelector('.expand-btn');
      expandCell.addEventListener('click', () => {
        const hidden = detailsTr.classList.contains('hidden');
        if (hidden) {
          detailsTr.classList.remove('hidden');
          expandCell.textContent = '-';
        } else {
          detailsTr.classList.add('hidden');
          expandCell.textContent = '+';
        }
      });
      // Append rows
      dashboardBody.appendChild(tr);
      dashboardBody.appendChild(detailsTr);
    });
  }

  // Withdraw a request (set status to Withdrawn)
  function handleWithdraw(requestId) {
    const reqs = JSON.parse(localStorage.getItem('inventoryRequests') || '[]');
    const idx = reqs.findIndex(r => r.id === requestId);
    if (idx >= 0) {
      reqs[idx].status = 'Withdrawn';
      localStorage.setItem('inventoryRequests', JSON.stringify(reqs));
    }
    updateDashboard();
  }

  // Push a request to the top of the list
  function handlePushTop(requestId) {
    const reqs = JSON.parse(localStorage.getItem('inventoryRequests') || '[]');
    const idx = reqs.findIndex(r => r.id === requestId);
    if (idx >= 0) {
      const [req] = reqs.splice(idx, 1);
      reqs.unshift(req);
      localStorage.setItem('inventoryRequests', JSON.stringify(reqs));
    }
    updateDashboard();
  }

  /**
   * Generate a detailed HTML snippet for a request. Used in the employee
   * dashboard to display additional information when a row is expanded.
   * @param {Object} req
   * @returns {string}
   */
  function generateEmployeeDetails(req) {
    const itemsHtml = (req.items || [])
      .map(item => {
        const priceStr = item.price ? `, Price: ${item.price}` : '';
        return `<li>${item.part} – Qty: ${item.qty}${priceStr}</li>`;
      })
      .join('');
    return `
      <div class="details-content">
        <p><strong>Requester:</strong> ${req.name || ''} (${req.requester || ''})</p>
        <p><strong>Date:</strong> ${req.date || ''}</p>
        <p><strong>Purpose:</strong> ${req.purpose.charAt(0).toUpperCase() + req.purpose.slice(1) || ''}</p>
        <p><strong>Warehouse:</strong> ${req.warehouse || ''}</p>
        <p><strong>Project/Job #:</strong> ${req.projectNumber || ''}</p>
        <p><strong>PO #:</strong> ${req.poNumber || ''}</p>
        <p><strong>Notes:</strong> ${req.notes || ''}</p>
        <p><strong>Total Price:</strong> ${req.totalPrice || ''}</p>
        <p><strong>Approver:</strong> ${req.approver || ''}</p>
        <p><strong>Status:</strong> ${req.status || ''}</p>
        <p><strong>Items:</strong></p>
        <ul>${itemsHtml}</ul>
      </div>
    `;
  }

  // Toggle required attributes for single/multiple item mode
  function handleItemModeChange(mode) {
    const singlePartInput = document.getElementById('partNumber');
    const singleQtyInput = document.getElementById('singleQuantity');
    if (mode === 'single') {
      singleItemSection.classList.remove('hidden');
      multipleItemsSection.classList.add('hidden');
      if (singlePartInput) singlePartInput.required = true;
      if (singleQtyInput) singleQtyInput.required = true;
    } else {
      singleItemSection.classList.add('hidden');
      multipleItemsSection.classList.remove('hidden');
      if (itemsBody.children.length === 0) {
        addItemRow();
      }
      // remove required from single inputs
      if (singlePartInput) singlePartInput.required = false;
      if (singleQtyInput) singleQtyInput.required = false;
    }
  }
  // Attach change listeners to item mode radios
  itemModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      handleItemModeChange(radio.value);
    });
  });
  // Helper to add dynamic item row
  function addItemRow() {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="text" class="item-part" placeholder="Part number & description" required></td>
      <td><input type="number" class="item-qty" min="1" value="1" required style="width: 80px;"></td>
      <td><input type="number" class="item-price" min="0" step="0.01" placeholder="0.00" style="width: 100px;"></td>
      <td><button type="button" class="btn-delete" title="Remove">&times;</button></td>
    `;
    row.querySelector('.btn-delete').addEventListener('click', () => {
      row.remove();
      if (itemsBody.children.length === 0) {
        addItemRow();
      }
    });
    itemsBody.appendChild(row);
  }
  addItemButton.addEventListener('click', () => {
    addItemRow();
  });

  // Gather form data
  function gatherFormData() {
    const session = getCurrentUser();
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const currentUser = users.find(u => u.username === (session ? session.username : ''));
    const formData = {};
    formData.requester = currentUser ? currentUser.username : '';
    formData.name = currentUser ? currentUser.name : '';
    formData.date = form.date.value;
    formData.purpose = form.purpose.value;
    formData.warehouse = form.warehouse.value.trim();
    formData.poNumber = form.poNumber.value.trim();
    formData.projectNumber = form.projectNumber.value.trim();
    formData.itemMode = form.itemMode.value;
    formData.approver = form.approver.value.trim();
    formData.notes = form.notes.value.trim();
    formData.totalPrice = form.totalPrice.value.trim();
    formData.confirm = form.confirm.checked;
    formData.items = [];
    let valid = true;
    if (!formData.name || !formData.date || !formData.purpose || !formData.warehouse || !formData.approver) {
      valid = false;
    }
    if (formData.purpose === 'stocking' && !formData.poNumber) {
      valid = false;
      alert('Purchase Order # is required for Stocking requests.');
    }
    if (formData.itemMode === 'single') {
      const part = form.partNumber.value.trim();
      const qty = parseInt(form.singleQuantity.value, 10);
      const price = parseFloat(form.singlePrice.value || '0');
      if (!part || isNaN(qty) || qty <= 0) {
        valid = false;
      }
      formData.items.push({ part: part, qty: qty, price: price });
    } else {
      const rows = Array.from(itemsBody.children);
      rows.forEach(row => {
        const part = row.querySelector('.item-part').value.trim();
        const qty = parseInt(row.querySelector('.item-qty').value, 10);
        const priceVal = row.querySelector('.item-price').value;
        const price = priceVal ? parseFloat(priceVal) : 0;
        if (!part || isNaN(qty) || qty <= 0) {
          valid = false;
        }
        formData.items.push({ part: part, qty: qty, price: price });
      });
    }
    if (!formData.confirm) {
      valid = false;
    }
    return { formData, valid };
  }

  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { formData, valid } = gatherFormData();
    if (!valid) {
      alert('Please fill out all required fields correctly.');
      return;
    }
    const requests = JSON.parse(localStorage.getItem('inventoryRequests') || '[]');
    const id = Date.now();
    requests.push({ id: id, status: 'Pending', approvedBy: '', ...formData });
    localStorage.setItem('inventoryRequests', JSON.stringify(requests));
    // Reset form
    form.reset();
    // Reset date to today
    const dateInput = document.getElementById('date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
    // Clear multiple items table
    itemsBody.innerHTML = '';
    addItemRow();
    // Show success
    successMessage.classList.remove('hidden');
    setTimeout(() => {
      successMessage.classList.add('hidden');
    }, 4000);
    // Switch to dashboard
    updateDashboard();
    showDashboardSection();
  });

  // Login handling
  loginButton.addEventListener('click', () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      loginError.textContent = 'Invalid username or password.';
      loginError.classList.remove('hidden');
      return;
    }
    if (user.role !== 'employee') {
      loginError.textContent = 'Access denied. Only employees can use this portal.';
      loginError.classList.remove('hidden');
      return;
    }
    // Save session and load UI
    setCurrentUser(user.username);
    loginError.classList.add('hidden');
    loadUserUI();
  });
  logoutButton.addEventListener('click', () => {
    logout();
  });
  newRequestNav.addEventListener('click', () => {
    showRequestSection();
  });
  dashboardNav.addEventListener('click', () => {
    showDashboardSection();
  });

  // Initialize default users and check session
  initializeUsers();
  const current = getCurrentUser();
  if (current) {
    loadUserUI();
  }
});