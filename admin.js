// admin.js
// This script powers the admin portal for the inventory checkout system.
// It provides login functionality for approvers and the superadmin, displays
// requests assigned to the logged‑in user, allows approvers to approve
// or reject requests, lets the superadmin manage users and view analytics,
// and supports exporting a flattened CSV of all requests.

document.addEventListener('DOMContentLoaded', () => {
  // ----- DOM references -----
  // Login section elements
  const adminLoginSection = document.getElementById('adminLoginSection');
  const adminLoginUsername = document.getElementById('adminLoginUsername');
  const adminLoginPassword = document.getElementById('adminLoginPassword');
  const adminLoginButton = document.getElementById('adminLoginButton');
  const adminLoginError = document.getElementById('adminLoginError');
  // Main section
  const adminMainSection = document.getElementById('adminMainSection');
  const requestsNav = document.getElementById('requestsNav');
  const usersNav = document.getElementById('usersNav');
  const analyticsNav = document.getElementById('analyticsNav');
  const adminLogoutButton = document.getElementById('adminLogoutButton');
  // Sections
  const requestsSection = document.getElementById('requestsSection');
  const usersSection = document.getElementById('usersSection');
  const analyticsSection = document.getElementById('analyticsSection');
  // Tables for requests
  const pendingBody = document.getElementById('pendingBody');
  const approvedBody = document.getElementById('approvedBody');
  const rejectedBody = document.getElementById('rejectedBody');
  // Export button
  const exportCsvButton = document.getElementById('exportCsvButton');
  // User management elements
  const addUserForm = document.getElementById('addUserForm');
  const newUsernameInput = document.getElementById('newUsername');
  const newNameInput = document.getElementById('newName');
  const newPasswordInput = document.getElementById('newPassword');
  const newRoleSelect = document.getElementById('newRole');
  const usersBody = document.getElementById('usersBody');
  // Analytics charts
  const statusChartCanvas = document.getElementById('statusChart');
  const purposeChartCanvas = document.getElementById('purposeChart');

  // Chart instances
  let statusChart = null;
  let purposeChart = null;

  // Edit modal elements
  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const editWarehouseInput = document.getElementById('editWarehouse');
  const editProjectInput = document.getElementById('editProject');
  const editPOInput = document.getElementById('editPO');
  const editNotesInput = document.getElementById('editNotes');
  const saveEditButton = document.getElementById('saveEditButton');
  // Modal cancel button (distinct from user management cancel)
  const modalCancelButton = document.getElementById('modalCancelButton');

  // Currently editing request ID
  let editingRequestId = null;

  // QR code elements
  const qrNav = document.getElementById('qrNav');
  const qrSection = document.getElementById('qrSection');
  const qrCodeContainer = document.getElementById('qrCodeContainer');

  // State for editing users
  let editingUsername = null;

  // ----- Session management -----
  function getCurrentAdmin() {
    const data = localStorage.getItem('currentAdmin');
    return data ? JSON.parse(data) : null;
  }
  function setCurrentAdmin(username) {
    localStorage.setItem('currentAdmin', JSON.stringify({ username }));
  }
  function clearCurrentAdmin() {
    localStorage.removeItem('currentAdmin');
  }

  // ----- User utilities -----
  function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
  }
  function setUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
  }
  function getCurrentAdminUser() {
    const session = getCurrentAdmin();
    if (!session) return null;
    const users = getUsers();
    return users.find(u => u.username === session.username) || null;
  }

  // ----- Request utilities -----
  function getRequests() {
    return JSON.parse(localStorage.getItem('inventoryRequests') || '[]');
  }
  function setRequests(reqs) {
    localStorage.setItem('inventoryRequests', JSON.stringify(reqs));
  }

  /**
   * Generate a detailed HTML snippet for a request. This is used in the
   * expandable rows on the requests tables. It includes all of the
   * additional metadata that doesn't fit neatly into the condensed table
   * view such as notes, total price, and the full list of items. If a
   * field is empty or undefined it will display an empty string.
   *
   * @param {Object} req The request object
   * @returns {string} HTML string for the details row
   */
  function generateDetails(req) {
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
        <p><strong>Purpose:</strong> ${capitalize(req.purpose) || ''}</p>
        <p><strong>Warehouse:</strong> ${req.warehouse || ''}</p>
        <p><strong>Project/Job #:</strong> ${req.projectNumber || ''}</p>
        <p><strong>PO #:</strong> ${req.poNumber || ''}</p>
        <p><strong>Notes:</strong> ${req.notes || ''}</p>
        <p><strong>Total Price:</strong> ${req.totalPrice || ''}</p>
        <p><strong>Requested Approver:</strong> ${req.approver || ''}</p>
        <p><strong>Actual Approver:</strong> ${req.approvedBy || ''}</p>
        <p><strong>Status:</strong> ${req.status || ''}</p>
        <p><strong>Items:</strong></p>
        <ul>${itemsHtml}</ul>
      </div>
    `;
  }

  // Capitalize first letter
  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // ----- Login handling -----
  adminLoginButton.addEventListener('click', () => {
    const username = adminLoginUsername.value.trim();
    const password = adminLoginPassword.value;
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      adminLoginError.textContent = 'Invalid username or password.';
      adminLoginError.classList.remove('hidden');
      return;
    }
    if (user.role !== 'approver' && user.role !== 'superadmin') {
      adminLoginError.textContent = 'Access denied. Only approvers or superadmins can use this portal.';
      adminLoginError.classList.remove('hidden');
      return;
    }
    // Save session
    setCurrentAdmin(user.username);
    // Clear fields
    adminLoginUsername.value = '';
    adminLoginPassword.value = '';
    adminLoginError.classList.add('hidden');
    loadAdminUI();
  });

  adminLogoutButton.addEventListener('click', () => {
    clearCurrentAdmin();
    // Reload page to reset state
    window.location.reload();
  });

  // ----- Edit modal handlers -----
  function openEditModal(req) {
    // Set editing ID and populate fields
    editingRequestId = req.id;
    editWarehouseInput.value = req.warehouse || '';
    editProjectInput.value = req.projectNumber || '';
    editPOInput.value = req.poNumber || '';
    editNotesInput.value = req.notes || '';
    // Show modal
    if (editModal) editModal.classList.remove('hidden');
  }

  function closeEditModal() {
    editingRequestId = null;
    if (editModal) editModal.classList.add('hidden');
  }

  if (saveEditButton) {
    saveEditButton.addEventListener('click', () => {
      if (editingRequestId == null) return;
      const reqs = getRequests();
      const index = reqs.findIndex(r => r.id === editingRequestId);
      if (index >= 0) {
        reqs[index].warehouse = editWarehouseInput.value.trim();
        reqs[index].projectNumber = editProjectInput.value.trim();
        reqs[index].poNumber = editPOInput.value.trim();
        reqs[index].notes = editNotesInput.value.trim();
        setRequests(reqs);
        loadRequests();
        updateAnalytics();
      }
      closeEditModal();
    });
  }

  if (modalCancelButton) {
    modalCancelButton.addEventListener('click', () => {
      closeEditModal();
    });
  }

  // ----- Navigation -----
  requestsNav.addEventListener('click', () => {
    showSection('requests');
  });
  usersNav.addEventListener('click', () => {
    showSection('users');
  });
  analyticsNav.addEventListener('click', () => {
    showSection('analytics');
  });
  if (qrNav) {
    qrNav.addEventListener('click', () => {
      showSection('qr');
    });
  }

  function showSection(name) {
    // Always hide all sections first
    requestsSection.classList.add('hidden');
    usersSection.classList.add('hidden');
    analyticsSection.classList.add('hidden');
    if (qrSection) qrSection.classList.add('hidden');
    // Remove active classes on nav buttons
    requestsNav.classList.remove('active');
    usersNav.classList.remove('active');
    analyticsNav.classList.remove('active');
    if (qrNav) qrNav.classList.remove('active');
    if (name === 'requests') {
      requestsSection.classList.remove('hidden');
      requestsNav.classList.add('active');
    } else if (name === 'users') {
      usersSection.classList.remove('hidden');
      usersNav.classList.add('active');
    } else if (name === 'analytics') {
      analyticsSection.classList.remove('hidden');
      analyticsNav.classList.add('active');
    } else if (name === 'qr') {
      if (qrSection) {
        qrSection.classList.remove('hidden');
        if (qrNav) qrNav.classList.add('active');
        generateQrCode();
      }
    }
  }

  // ----- Load admin UI based on role -----
  function loadAdminUI() {
    const adminUser = getCurrentAdminUser();
    if (!adminUser) {
      // Not logged in, show login section
      adminLoginSection.classList.remove('hidden');
      adminMainSection.classList.add('hidden');
      return;
    }
    // Hide login, show main
    adminLoginSection.classList.add('hidden');
    adminMainSection.classList.remove('hidden');
    // Determine role
    const isSuper = adminUser.role === 'superadmin';
    // Show or hide nav buttons and sections
    if (isSuper) {
      usersNav.classList.remove('hidden');
      analyticsNav.classList.remove('hidden');
      if (qrNav) qrNav.classList.remove('hidden');
    } else {
      // Approvers should not see user management or analytics
      usersNav.classList.add('hidden');
      analyticsNav.classList.add('hidden');
      // Approvers can still see QR code for employees
      if (qrNav) qrNav.classList.remove('hidden');
    }
    // Default to requests view
    showSection('requests');
    // Load data
    loadRequests();
    if (isSuper) {
      updateUsersTable();
      updateAnalytics();
      exportCsvButton.classList.remove('hidden');
    } else {
      // Hide export button for approvers
      exportCsvButton.classList.add('hidden');
    }
  }

  // Generate QR code pointing to the employee form
  function generateQrCode() {
    if (!qrCodeContainer) return;
    // Determine the URL for the employee page based on current location
    let url = window.location.href;
    // Replace admin.html with employee.html
    url = url.replace(/admin\.html(?:#.*)?$/, 'employee.html');
    // Clear any existing QR code
    qrCodeContainer.innerHTML = '';
    // eslint-disable-next-line no-undef
    new QRCode(qrCodeContainer, {
      text: url,
      width: 256,
      height: 256
    });
  }

  // ----- Request rendering -----
  function loadRequests() {
    const adminUser = getCurrentAdminUser();
    if (!adminUser) return;
    const allRequests = getRequests();
    const isSuper = adminUser.role === 'superadmin';
    // Clear existing table bodies
    pendingBody.innerHTML = '';
    approvedBody.innerHTML = '';
    rejectedBody.innerHTML = '';
    // Filter and sort requests
    const displayReqs = isSuper ? allRequests : allRequests.filter(r => r.approver === adminUser.username);
    displayReqs.sort((a, b) => new Date(b.date) - new Date(a.date));
    displayReqs.forEach(req => {
      // Flatten items for table rows
      req.items.forEach((item, index) => {
        if (req.status === 'Pending') {
          addPendingRow(req, item, index === 0, isSuper || req.approver === adminUser.username);
        } else if (req.status === 'Approved') {
          addApprovedRow(req, item, index === 0);
        } else if (req.status === 'Rejected') {
          addRejectedRow(req, item, index === 0);
        }
      });
    });
  }

  // Delete a request by ID
  function handleDelete(requestId) {
    const reqs = getRequests();
    const index = reqs.findIndex(r => r.id === requestId);
    if (index >= 0) {
      if (!confirm('Are you sure you want to delete this request?')) return;
      reqs.splice(index, 1);
      setRequests(reqs);
      loadRequests();
      updateAnalytics();
    }
  }

  function addPendingRow(req, item, isFirstItem, allowActions) {
    const tr = document.createElement('tr');
    tr.classList.add('animate-row');
    // Determine strings for cells
    const warehouse = req.warehouse || '';
    const project = req.projectNumber || '';
    const po = req.poNumber || '';
    const notes = req.notes || '';
    const itemPrice = item.price ? item.price : '';
    // Build row HTML with expand column
    const expandSign = isFirstItem ? '+' : '';
    tr.innerHTML = `
      <td class="expand-btn">${expandSign}</td>
      <td>${req.id}</td>
      <td>${req.name}</td>
      <td>${req.date}</td>
      <td>${capitalize(req.purpose)}</td>
      <td>${warehouse}</td>
      <td>${project}</td>
      <td>${po}</td>
      <td>${item.part}</td>
      <td>${item.qty}</td>
      <td>${itemPrice}</td>
      <td>${notes}</td>
      <td>${req.approver}</td>
      <td class="status-${req.status.toLowerCase()}">${req.status}</td>
    `;
    // Build actions column
    const actionsTd = document.createElement('td');
    if (isFirstItem) {
      // Approve/Reject actions only if allowed
      if (allowActions) {
        const approveBtn = document.createElement('button');
        approveBtn.textContent = 'Approve';
        approveBtn.className = 'btn-secondary';
        approveBtn.addEventListener('click', () => {
          handleAction(req.id, 'Approved');
        });
        const rejectBtn = document.createElement('button');
        rejectBtn.textContent = 'Reject';
        rejectBtn.className = 'btn-secondary';
        rejectBtn.addEventListener('click', () => {
          handleAction(req.id, 'Rejected');
        });
        actionsTd.appendChild(approveBtn);
        actionsTd.appendChild(rejectBtn);
      }
      // Edit button
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'btn-secondary';
      editBtn.addEventListener('click', () => {
        openEditModal(req);
      });
      actionsTd.appendChild(editBtn);
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn-secondary';
      deleteBtn.addEventListener('click', () => {
        handleDelete(req.id);
      });
      actionsTd.appendChild(deleteBtn);
    }
    tr.appendChild(actionsTd);
    // Create details row only on first item
    let detailsTr = null;
    if (isFirstItem) {
      detailsTr = document.createElement('tr');
      detailsTr.classList.add('details-row', 'hidden');
      const detailsTd = document.createElement('td');
      // colspan equals number of columns in the main row (including expand + id + ... + actions)
      detailsTd.colSpan = tr.children.length;
      detailsTd.innerHTML = generateDetails(req);
      detailsTr.appendChild(detailsTd);
    }
    // Attach expand click handler
    if (isFirstItem) {
      const expandCell = tr.querySelector('.expand-btn');
      expandCell.style.cursor = 'pointer';
      expandCell.addEventListener('click', () => {
        if (!detailsTr) return;
        const isHidden = detailsTr.classList.contains('hidden');
        if (isHidden) {
          detailsTr.classList.remove('hidden');
          expandCell.textContent = '-';
        } else {
          detailsTr.classList.add('hidden');
          expandCell.textContent = '+';
        }
      });
    }
    // Append to table
    pendingBody.appendChild(tr);
    if (isFirstItem && detailsTr) {
      pendingBody.appendChild(detailsTr);
    }
  }

  function addApprovedRow(req, item, isFirstItem) {
    const tr = document.createElement('tr');
    tr.classList.add('animate-row');
    const warehouse = req.warehouse || '';
    const project = req.projectNumber || '';
    const po = req.poNumber || '';
    const notes = req.notes || '';
    const itemPrice = item.price ? item.price : '';
    // Add expand cell
    const expandSign = isFirstItem ? '+' : '';
    tr.innerHTML = `
      <td class="expand-btn">${expandSign}</td>
      <td>${req.id}</td>
      <td>${req.name}</td>
      <td>${req.date}</td>
      <td>${capitalize(req.purpose)}</td>
      <td>${warehouse}</td>
      <td>${project}</td>
      <td>${po}</td>
      <td>${item.part}</td>
      <td>${item.qty}</td>
      <td>${itemPrice}</td>
      <td>${notes}</td>
      <td>${req.approver}</td>
      <td>${req.approvedBy || ''}</td>
      <td class="status-${req.status.toLowerCase()}">${req.status}</td>
    `;
    // Actions
    const actionsTd = document.createElement('td');
    if (isFirstItem) {
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'btn-secondary';
      editBtn.addEventListener('click', () => {
        openEditModal(req);
      });
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn-secondary';
      deleteBtn.addEventListener('click', () => {
        handleDelete(req.id);
      });
      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
    }
    tr.appendChild(actionsTd);
    // Create details row for first item
    let detailsTr = null;
    if (isFirstItem) {
      detailsTr = document.createElement('tr');
      detailsTr.classList.add('details-row', 'hidden');
      const detailsTd = document.createElement('td');
      detailsTd.colSpan = tr.children.length;
      detailsTd.innerHTML = generateDetails(req);
      detailsTr.appendChild(detailsTd);
    }
    // Expand button handler
    if (isFirstItem) {
      const expandCell = tr.querySelector('.expand-btn');
      expandCell.style.cursor = 'pointer';
      expandCell.addEventListener('click', () => {
        if (!detailsTr) return;
        const isHidden = detailsTr.classList.contains('hidden');
        if (isHidden) {
          detailsTr.classList.remove('hidden');
          expandCell.textContent = '-';
        } else {
          detailsTr.classList.add('hidden');
          expandCell.textContent = '+';
        }
      });
    }
    approvedBody.appendChild(tr);
    if (isFirstItem && detailsTr) {
      approvedBody.appendChild(detailsTr);
    }
  }

  function addRejectedRow(req, item, isFirstItem) {
    const tr = document.createElement('tr');
    tr.classList.add('animate-row');
    const warehouse = req.warehouse || '';
    const project = req.projectNumber || '';
    const po = req.poNumber || '';
    const notes = req.notes || '';
    const itemPrice = item.price ? item.price : '';
    const expandSign = isFirstItem ? '+' : '';
    tr.innerHTML = `
      <td class="expand-btn">${expandSign}</td>
      <td>${req.id}</td>
      <td>${req.name}</td>
      <td>${req.date}</td>
      <td>${capitalize(req.purpose)}</td>
      <td>${warehouse}</td>
      <td>${project}</td>
      <td>${po}</td>
      <td>${item.part}</td>
      <td>${item.qty}</td>
      <td>${itemPrice}</td>
      <td>${notes}</td>
      <td>${req.approver}</td>
      <td>${req.approvedBy || ''}</td>
      <td class="status-${req.status.toLowerCase()}">${req.status}</td>
    `;
    const actionsTd = document.createElement('td');
    if (isFirstItem) {
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'btn-secondary';
      editBtn.addEventListener('click', () => {
        openEditModal(req);
      });
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn-secondary';
      deleteBtn.addEventListener('click', () => {
        handleDelete(req.id);
      });
      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
    }
    tr.appendChild(actionsTd);
    // Create details row for first item
    let detailsTr = null;
    if (isFirstItem) {
      detailsTr = document.createElement('tr');
      detailsTr.classList.add('details-row', 'hidden');
      const detailsTd = document.createElement('td');
      detailsTd.colSpan = tr.children.length;
      detailsTd.innerHTML = generateDetails(req);
      detailsTr.appendChild(detailsTd);
    }
    if (isFirstItem) {
      const expandCell = tr.querySelector('.expand-btn');
      expandCell.style.cursor = 'pointer';
      expandCell.addEventListener('click', () => {
        if (!detailsTr) return;
        const isHidden = detailsTr.classList.contains('hidden');
        if (isHidden) {
          detailsTr.classList.remove('hidden');
          expandCell.textContent = '-';
        } else {
          detailsTr.classList.add('hidden');
          expandCell.textContent = '+';
        }
      });
    }
    rejectedBody.appendChild(tr);
    if (isFirstItem && detailsTr) {
      rejectedBody.appendChild(detailsTr);
    }
  }

  // Handle approve/reject action
  function handleAction(requestId, newStatus) {
    const adminUser = getCurrentAdminUser();
    if (!adminUser) return;
    const reqs = getRequests();
    const index = reqs.findIndex(r => r.id === requestId);
    if (index >= 0) {
      reqs[index].status = newStatus;
      reqs[index].approvedBy = adminUser.username;
      setRequests(reqs);
      loadRequests();
      updateAnalytics();
    }
  }

  // ----- Export CSV -----
  if (exportCsvButton) {
    exportCsvButton.addEventListener('click', () => {
      const adminUser = getCurrentAdminUser();
      if (!adminUser || adminUser.role !== 'superadmin') return;
      const requests = getRequests();
      if (!requests.length) {
        alert('There are no requests to export.');
        return;
      }
      // Prepare header. We flatten items; each item row is separate.
      const header = [
        'ID', 'RequesterName', 'RequesterUsername', 'Date', 'Purpose', 'Warehouse',
        'Project/Job #', 'PO #', 'Item', 'Quantity', 'Price', 'Notes',
        'Requested Approver', 'Actual Approver', 'Status'
      ];
      const rows = [];
      requests.forEach(req => {
        req.items.forEach(item => {
          rows.push([
            req.id,
            req.name,
            req.requester,
            req.date,
            req.purpose,
            req.warehouse || '',
            req.projectNumber || '',
            req.poNumber || '',
            item.part,
            item.qty,
            item.price || '',
            (req.notes || '').replace(/\n/g, ' '),
            req.approver || '',
            req.approvedBy || '',
            req.status
          ]);
        });
      });
      let csvContent = '';
      csvContent += header.join(',') + '\n';
      rows.forEach(row => {
        const escaped = row.map(field => {
          const str = String(field).replace(/"/g, '""');
          if (str.includes(',') || str.includes('\n')) {
            return '"' + str + '"';
          }
          return str;
        });
        csvContent += escaped.join(',') + '\n';
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'inventory_requests.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // ----- User management -----
  if (addUserForm) {
    addUserForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = newUsernameInput.value.trim();
      const name = newNameInput.value.trim();
      const password = newPasswordInput.value;
      const role = newRoleSelect.value;
      if (!username || !name || !password || !role) {
        alert('Please fill out all required fields.');
        return;
      }
      const users = getUsers();
      if (editingUsername) {
        // Update existing user
        const idx = users.findIndex(u => u.username === editingUsername);
        if (idx >= 0) {
          // Prevent changing username to one that already exists unless unchanged
          if (username !== editingUsername && users.some(u => u.username === username)) {
            alert('A user with that username already exists.');
            return;
          }
          users[idx].username = username;
          users[idx].name = name;
          users[idx].password = password;
          users[idx].role = role;
          setUsers(users);
          // If editing our own account, update session
          const current = getCurrentAdmin();
          if (current && current.username === editingUsername) {
            setCurrentAdmin(username);
          }
          editingUsername = null;
          addUserForm.querySelector('button[type="submit"]').textContent = 'Add User';
          cancelEditUser();
        }
      } else {
        // Add new user
        if (users.some(u => u.username === username)) {
          alert('A user with that username already exists.');
          return;
        }
        users.push({ username, name, password, role });
        setUsers(users);
      }
      // Clear form
      newUsernameInput.value = '';
      newNameInput.value = '';
      newPasswordInput.value = '';
      newRoleSelect.value = 'employee';
      updateUsersTable();
      // Update analytics and requests because roles might change
      loadRequests();
      updateAnalytics();
    });
  }

  function cancelEditUser() {
    // Reset editing state and clear form
    editingUsername = null;
    newUsernameInput.value = '';
    newNameInput.value = '';
    newPasswordInput.value = '';
    newRoleSelect.value = 'employee';
    // Reset submit button text
    const submitBtn = addUserForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Add User';
    // Hide cancel button if present
    const cancelBtn = document.getElementById('cancelUserButton');
    if (cancelBtn) cancelBtn.remove();
  }

  function updateUsersTable() {
    const adminUser = getCurrentAdminUser();
    if (!adminUser || adminUser.role !== 'superadmin') return;
    const users = getUsers();
    usersBody.innerHTML = '';
    users.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.username}</td>
        <td>${user.name}</td>
        <td>${capitalize(user.role)}</td>
      `;
      const actionsTd = document.createElement('td');
      // Edit button
      if (user.username !== 'superadmin') {
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'btn-secondary';
        editBtn.addEventListener('click', () => {
          // Populate form with user data for editing
          editingUsername = user.username;
          newUsernameInput.value = user.username;
          newNameInput.value = user.name;
          newPasswordInput.value = user.password;
          newRoleSelect.value = user.role;
          const submitBtn = addUserForm.querySelector('button[type="submit"]');
          submitBtn.textContent = 'Save Changes';
          // Add cancel button if not present
          let cancelBtn = document.getElementById('cancelUserButton');
          if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancelUserButton';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'btn-secondary mt-2';
            cancelBtn.addEventListener('click', () => {
              cancelEditUser();
            });
            addUserForm.appendChild(cancelBtn);
          }
        });
        actionsTd.appendChild(editBtn);
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'btn-secondary';
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Are you sure you want to delete user ${user.username}?`)) {
            const usersList = getUsers();
            const idx = usersList.findIndex(u => u.username === user.username);
            if (idx >= 0) {
              usersList.splice(idx, 1);
              setUsers(usersList);
              // If deleting currently logged-in admin, logout
              const current = getCurrentAdmin();
              if (current && current.username === user.username) {
                clearCurrentAdmin();
                window.location.reload();
                return;
              }
              updateUsersTable();
              loadRequests();
              updateAnalytics();
            }
          }
        });
        actionsTd.appendChild(deleteBtn);
      }
      tr.appendChild(actionsTd);
      usersBody.appendChild(tr);
    });
  }

  // ----- Analytics -----
  function updateAnalytics() {
    const adminUser = getCurrentAdminUser();
    if (!adminUser || adminUser.role !== 'superadmin') return;
    const requests = getRequests();
    // Count requests by status and purpose
    const statusCounts = { Pending: 0, Approved: 0, Rejected: 0 };
    const purposeCounts = { Stocking: 0, Service: 0 };
    requests.forEach(req => {
      statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
      const pKey = capitalize(req.purpose);
      if (purposeCounts[pKey] !== undefined) {
        purposeCounts[pKey] += 1;
      } else {
        purposeCounts[pKey] = 1;
      }
    });
    // Destroy existing charts if they exist
    if (statusChart) {
      statusChart.destroy();
    }
    if (purposeChart) {
      purposeChart.destroy();
    }
    // Create status chart
    statusChart = new Chart(statusChartCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          label: 'Number of Requests',
          data: Object.values(statusCounts),
          backgroundColor: ['#f1c40f', '#27ae60', '#e74c3c']
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Status'
            }
          }
        },
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Requests by Status' }
        }
      }
    });
    // Create purpose chart
    purposeChart = new Chart(purposeChartCanvas.getContext('2d'), {
      type: 'pie',
      data: {
        labels: Object.keys(purposeCounts),
        datasets: [{
          label: 'Number of Requests',
          data: Object.values(purposeCounts),
          backgroundColor: ['#2980b9', '#8e44ad']
        }]
      },
      options: {
        plugins: {
          title: { display: true, text: 'Requests by Purpose' }
        }
      }
    });
  }

  // ----- Initialisation -----
  // Check if there is an existing session and load UI accordingly
  const current = getCurrentAdmin();
  if (current) {
    loadAdminUI();
  } else {
    // Show login section by default
    adminLoginSection.classList.remove('hidden');
    adminMainSection.classList.add('hidden');
  }
});