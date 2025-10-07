import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, setDoc, doc, addDoc, deleteDoc,
  query, orderBy, updateDoc, increment, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ---------- Firebase Config ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyD8-AhyflwKBlLaQg0kPgTRs9b8xH5bfgM",
  authDomain: "store-management-84948.firebaseapp.com",
  projectId: "store-management-84948",
  storageBucket: "store-management-84948.firebasestorage.app",
  messagingSenderId: "97089595999",
  appId: "1:97089595999:web:41774b502573e3462c49ea"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- Utility ---------- */
function createBadge(status) {
  if (!status) return `<span class="badge badge-in">Unknown</span>`;
  return status.toLowerCase().includes('low')
    ? `<span class="badge badge-low">Low Stock</span>`
    : `<span class="badge badge-in">In Stock</span>`;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

/* ---------- Inventory page ---------- */
export async function loadInventory() {
  const tbody = document.getElementById('inventoryTable');
  if (!tbody) return;
  tbody.innerHTML = '';
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, orderBy('sku'));
  const snap = await getDocs(q);
  let total = 0, count = 0;
  const rows = [];

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const qty = Number(data.qty || 0);
    total += qty;
    count++;
    rows.push(`
      <tr>
        <td>${data.sku || docSnap.id}</td>
        <td><strong>${data.name || ''}</strong></td>
        <td>${data.category || ''}</td>
        <td>${qty}</td>
        <td>${createBadge(data.status || (qty <= 5 ? 'Low Stock' : 'In Stock'))}</td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join('');
  document.getElementById('totalItems').innerText = total;
  document.getElementById('productCount').innerText = `Across ${count} products`;

  // 🔍 Search Filter
  const s = document.getElementById('searchInventory');
  if (s) {
    s.addEventListener('input', () => {
      const term = s.value.toLowerCase();
      const tr = tbody.getElementsByTagName('tr');
      Array.from(tr).forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }
}

/* ---------- Items page ---------- */
export async function initItemsPage() {
  const form = document.getElementById('addItemForm');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editModeInput = document.getElementById('editMode');
  const submitBtn = document.getElementById('submitItemBtn');
  const tableBody = document.getElementById('allItemsTable');

  let editSKU = null;

  async function loadItems() {
    tableBody.innerHTML = '';
    const q = query(collection(db, 'items'), orderBy('sku'));
    const snap = await getDocs(q);
    snap.forEach(d => {
      const data = d.data();
      tableBody.innerHTML += `
        <tr>
          <td>${data.sku}</td>
          <td>${data.name}</td>
          <td>${data.category}</td>
          <td>${data.qty || 0}</td>
          <td>
            <button class="btn btn-sm btn-warning edit-btn" data-sku="${data.sku}">✏️ Edit</button>
            <button class="btn btn-sm btn-danger delete-btn" data-sku="${data.sku}">🗑️ Delete</button>
          </td>
        </tr>`;
    });
    attachActionHandlers();
  }

  function attachActionHandlers() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sku = btn.dataset.sku;
        const docRef = doc(db, 'items', sku);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return alert('Item not found!');
        const data = snap.data();
        editModeInput.value = "true";
        editSKU = sku;
        submitBtn.textContent = "Update Item";
        cancelEditBtn.classList.remove('d-none');

        document.getElementById('sku').value = data.sku;
        document.getElementById('name').value = data.name;
        document.getElementById('category').value = data.category;
        document.getElementById('currentStock').value = data.qty || 0;
        document.getElementById('sku').disabled = true;
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sku = btn.dataset.sku;
        if (!confirm(`Are you sure you want to delete ${sku}?`)) return;
        await deleteDoc(doc(db, 'items', sku));
        alert('Item deleted successfully.');
        loadItems();
      });
    });
  }

  cancelEditBtn.addEventListener('click', () => {
    form.reset();
    editModeInput.value = "false";
    editSKU = null;
    submitBtn.textContent = "Add Item";
    cancelEditBtn.classList.add('d-none');
    document.getElementById('sku').disabled = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sku = document.getElementById('sku').value.trim();
    const name = document.getElementById('name').value.trim();
    const category = document.getElementById('category').value.trim();
    const currentStock = parseInt(document.getElementById('currentStock').value || '0', 10);
    if (!sku || !name || !category) return alert('Please fill SKU, Item Name and Category.');

    const itemData = {
      sku,
      name,
      category,
      qty: currentStock,
      status: currentStock <= 5 ? 'Low Stock' : 'In Stock'
    };

    if (editModeInput.value === "true" && editSKU) {
      await updateDoc(doc(db, 'items', editSKU), itemData);
      alert('Item updated successfully!');
    } else {
      await setDoc(doc(db, 'items', sku), itemData);
      alert('Item added successfully!');
    }

    form.reset();
    editModeInput.value = "false";
    editSKU = null;
    submitBtn.textContent = "Add Item";
    cancelEditBtn.classList.add('d-none');
    document.getElementById('sku').disabled = false;
    loadItems();
  });

  loadItems();
}

/* ---------- Transactions page ---------- */
export async function initTransactionsPage() {
  const form = document.getElementById('addTransactionForm');
  const skuInput = document.getElementById('txSku');
  const itemNameInput = document.getElementById('txItemName');
  const categoryInput = document.getElementById('txCategory');
  const modalTitle = document.getElementById('modalTitle');
  const txIdInput = document.getElementById('txId');
  const saveBtn = document.getElementById('saveTransactionBtn');

  let editMode = false;

  /* 🆕 SKU SUGGESTION DROPDOWN */
  const suggestionBox = document.createElement('div');
  suggestionBox.className = 'sku-suggestions border rounded bg-white position-absolute w-100 shadow-sm';
  suggestionBox.style.zIndex = 1000;
  suggestionBox.style.maxHeight = '180px';
  suggestionBox.style.overflowY = 'auto';
  suggestionBox.style.display = 'none';
  skuInput.parentNode.style.position = 'relative';
  skuInput.parentNode.appendChild(suggestionBox);

  // Load all SKUs once
  let allItems = [];
  try {
    const q = query(collection(db, 'items'), orderBy('sku'));
    const snap = await getDocs(q);
    allItems = snap.docs.map(d => d.data());
  } catch (err) {
    console.error("Failed to load items:", err);
  }

  // Show suggestions while typing
  skuInput.addEventListener('input', () => {
    const term = skuInput.value.trim().toLowerCase();
    suggestionBox.innerHTML = '';

    if (!term) {
      suggestionBox.style.display = 'none';
      return;
    }

    const matches = allItems.filter(it => it.sku.toLowerCase().includes(term));
    if (matches.length === 0) {
      suggestionBox.style.display = 'none';
      return;
    }

    matches.slice(0, 8).forEach(item => {
      const div = document.createElement('div');
      div.className = 'p-2 suggestion-item';
      div.style.cursor = 'pointer';
      div.innerHTML = `<strong>${item.sku}</strong> — ${item.name || ''} (${item.category || ''})`;
      div.addEventListener('click', () => {
        skuInput.value = item.sku;
        itemNameInput.value = item.name || '';
        categoryInput.value = item.category || '';
        suggestionBox.style.display = 'none';
      });
      suggestionBox.appendChild(div);
    });

    suggestionBox.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!suggestionBox.contains(e.target) && e.target !== skuInput) {
      suggestionBox.style.display = 'none';
    }
  });

  /* --------------------------------------- */

  // Auto-fill item details by SKU
  if (skuInput) {
    skuInput.addEventListener('change', async () => {
      const sku = skuInput.value.trim();
      const found = allItems.find(i => i.sku === sku);
      if (found) {
        itemNameInput.value = found.name || '';
        categoryInput.value = found.category || '';
      } else {
        itemNameInput.value = 'Not found';
        categoryInput.value = '';
      }
    });
  }

  // Add or Update transaction
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sku = skuInput.value.trim();
      const type = document.getElementById('txType').value;
      const qty = Math.max(0, parseInt(document.getElementById('txQty').value || '0', 10));
      const notes = document.getElementById('txNotes').value || '';
      const itemName = itemNameInput.value.trim();
      const category = categoryInput.value.trim();

      if (!sku || qty <= 0) return alert('Please provide SKU and valid quantity.');

      if (!editMode) {
        // Add New
        const change = type === 'in' ? qty : -qty;
        const itemRef = doc(db, 'items', sku);
        try {
          await updateDoc(itemRef, { qty: increment(change) });
          const snap = await getDoc(itemRef);
          const newQty = (snap.data()?.qty ?? 0);
          const newStatus = newQty <= 5 ? 'Low Stock' : 'In Stock';
          await updateDoc(itemRef, { status: newStatus });
        } catch {
          alert('Failed to update item. Make sure item exists.');
          return;
        }
        await addDoc(collection(db, 'transactions'), {
          sku, itemName, category,
          type: type === 'in' ? 'Stock In' : 'Stock Out',
          qtyChange: change,
          notes,
          timestamp: serverTimestamp()
        });
        alert('Transaction added!');
      } else {
        // Update existing
        const id = txIdInput.value;
        await updateDoc(doc(db, 'transactions', id), {
          sku, itemName, category,
          type: type === 'in' ? 'Stock In' : 'Stock Out',
          qtyChange: type === 'in' ? qty : -qty,
          notes
        });
        alert('Transaction updated!');
      }

      editMode = false;
      modalTitle.textContent = "Add Transaction";
      form.reset();
      const modal = bootstrap.Modal.getInstance(document.getElementById('addTxModal'));
      modal.hide();
      loadTransactions();
    });
  }

  // Load Transactions
  async function loadTransactions() {
    const tbody = document.getElementById('transactionsTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    snap.forEach(d => {
      const data = d.data();
      tbody.innerHTML += `
        <tr data-id="${d.id}">
          <td>${fmtDate(data.timestamp)}</td>
          <td>${data.type || ''}</td>
          <td>${data.sku || ''}</td>
          <td>${data.itemName || ''}</td>
          <td>${data.category || ''}</td>
          <td>${(data.qtyChange > 0 ? '+' : '') + data.qtyChange} </td>
          <td> ${data.notes || ''}</td>
          <td>
            <button class="btn btn-sm btn-warning edit-tx">✏️</button>
            <button class="btn btn-sm btn-danger delete-tx">🗑️</button>
          </td>
        </tr>`;
    });

    attachTxHandlers();
  }

  // Attach Edit/Delete
  function attachTxHandlers() {
    document.querySelectorAll('.edit-tx').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tr = e.target.closest('tr');
        const id = tr.dataset.id;
        const snap = await getDoc(doc(db, 'transactions', id));
        if (!snap.exists()) return alert('Transaction not found.');
        const data = snap.data();
        editMode = true;
        txIdInput.value = id;
        modalTitle.textContent = "Edit Transaction";

        skuInput.value = data.sku || '';
        itemNameInput.value = data.itemName || '';
        categoryInput.value = data.category || '';
        document.getElementById('txType').value = data.type?.includes('In') ? 'in' : 'out';
        document.getElementById('txQty').value = Math.abs(data.qtyChange || 0);
        document.getElementById('txNotes').value = data.notes || '';

        const modal = new bootstrap.Modal(document.getElementById('addTxModal'));
        modal.show();
      });
    });

    document.querySelectorAll('.delete-tx').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tr = e.target.closest('tr');
        const id = tr.dataset.id;
        if (!confirm('Are you sure you want to delete this transaction?')) return;
        await deleteDoc(doc(db, 'transactions', id));
        alert('Transaction deleted!');
        loadTransactions();
      });
    });
  }

  // Search
  const s = document.getElementById('searchTransactions');
  if (s) {
    s.addEventListener('input', () => {
      const term = s.value.toLowerCase();
      document.querySelectorAll('#transactionsTable tr').forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  loadTransactions();
}

/* ---------- Export to Excel ---------- */
function exportTableToExcel(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return alert('No table found to export.');
  const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/* ---------- Export buttons ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const exportInventory = document.getElementById('exportInventory');
  if (exportInventory) exportInventory.addEventListener('click', () => exportTableToExcel('inventoryTableContainer', 'Inventory'));

  const exportItems = document.getElementById('exportItems');
  if (exportItems) exportItems.addEventListener('click', () => exportTableToExcel('allItemsTableContainer', 'Items'));

  const exportTransactions = document.getElementById('exportTransactions');
  if (exportTransactions) exportTransactions.addEventListener('click', () => exportTableToExcel('transactionsTableContainer', 'Transactions'));
});

/* ---------- Upload Items from Excel ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const uploadBtn = document.getElementById('uploadItems');
  const fileInput = document.getElementById('fileInput');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const items = XLSX.utils.sheet_to_json(firstSheet);

        let count = 0;
        for (const item of items) {
          const sku = item.SKU || item.sku;
          if (!sku) continue;

          const docRef = doc(db, 'items', sku);
          await setDoc(docRef, {
            sku,
            name: item['Item Name'] || item.name || '',
            category: item['Category'] || item.category || '',
            qty: Number(item['Current Stock'] || item['Quantity'] || 0),
            status: Number(item['Current Stock'] || item['Quantity'] || 0) <= 5
              ? 'Low Stock'
              : 'In Stock'
          });
          count++;
        }

        alert(`${count} items uploaded successfully!`);
        window.location.reload();
      };

      reader.readAsArrayBuffer(file);
    });
  }
});

/* ---------- Auto-run ---------- */
(function runPageInit() {
  if (document.getElementById('inventoryTable')) loadInventory();
  if (document.getElementById('addItemForm')) initItemsPage();
  if (document.getElementById('addTransactionForm')) initTransactionsPage();
})();
