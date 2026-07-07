const modalName = document.getElementById('modalName');
const modalPhone = document.getElementById('modalPhone');
const modalQty = document.getElementById('modalQty');
const modalUnit = document.getElementById('modalUnit');
const API_URL = 'http://localhost:3000/api';

const formatMoney = (a) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(a);

let revChartInstance = null;
let bestChartInstance = null;
let allOrders = [];
let editingId = null;

let editType = null;
let editId = null;

// ================= TAB =================
function switchTab(tab, el) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`tab-${tab}`).classList.add('active');
    if (el) el.classList.add('active');

    if (tab === 'dashboard') loadDashboard();
    if (tab === 'orders') loadOrders();
    if (tab === 'products') loadProducts();
    if (tab === 'inventory') loadInventory();
    if (tab === 'customers') loadCustomers();
}

// ================= DASHBOARD =================
async function loadDashboard() {
    const res = await fetch(`${API_URL}/orders`);
    const orders = await res.json();

    const completed = orders.filter(o => o.status === 'completed');

    const total = completed.reduce((s, o) => s + o.total, 0);
    document.getElementById('totalRevenueDisplay').innerText = formatMoney(total);

    const rev = {};
    const items = {};

    completed.forEach(o => {
        const date = o.date?.toString().split(',')[0] || '';
        rev[date] = (rev[date] || 0) + o.total;

        o.items.forEach(i => {
            items[i.name] = (items[i.name] || 0) + i.qty;
        });
    });

    drawCharts(rev, items);
}

function drawCharts(rev, items) {
    if (revChartInstance) revChartInstance.destroy();

    revChartInstance = new Chart(document.getElementById('revenueChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(rev),
            datasets: [{ label: 'Doanh thu', data: Object.values(rev) }]
        }
    });

    if (bestChartInstance) bestChartInstance.destroy();

    const top = Object.entries(items).sort((a,b)=>b[1]-a[1]).slice(0,5);

    bestChartInstance = new Chart(document.getElementById('bestsellerChart'), {
        type: 'doughnut',
        data: {
            labels: top.map(x=>x[0]),
            datasets: [{ data: top.map(x=>x[1]) }]
        }
    });
}

// ================= ORDERS =================
async function loadOrders() {
    const res = await fetch(`${API_URL}/orders`);
    allOrders = await res.json();

    document.getElementById('tblOrders').innerHTML = allOrders.map(o => `
    <tr>
        <td>#${o.id}</td>
        <td>${o.phone || 'Khách lẻ'}</td>
        <td>${o.items.map(i => `${i.qty}x ${i.name}`).join('<br>')}</td>
        <td>${formatMoney(o.total)}</td>
        <td>${o.status === 'completed' ? '✔' : 'Đang xử lý'}</td>
        <td>
            <button onclick="printOrder('${o.id}')">🖨 In</button>
        </td>
    </tr>
`).join('');
}

function printOrder(id){
    const o = allOrders.find(x => String(x.id) === String(id));

    if(!o){
        alert("Không tìm thấy đơn!");
        return;
    }

    const printWindow = window.open('', '_blank');

    let content = `
        <html>
        <head>
            <title>Hóa đơn</title>
        </head>
        <body style="font-family: monospace; padding:15px;">
            
            <h2 style="text-align:center;">HONGKONG MILK TEA</h2>
            <p style="text-align:center;">--------------------------</p>

            <p><b>Mã đơn:</b> ${o.id}</p>
            <p><b>Ngày:</b> ${o.date || new Date().toLocaleString('vi-VN')}</p>
            <p><b>Khách:</b> ${o.name || 'Khách lẻ'}</p>
            <p><b>SĐT:</b> ${o.phone || 'Không có'}</p>

            <hr>
    `;

    o.items.forEach(i=>{
        content += `
            <div style="display:flex; justify-content:space-between;">
                <span>${i.qty}x ${i.name}</span>
                <span>${formatMoney((i.price || 0) * i.qty)}</span>
            </div>
        `;
    });

    content += `
            <hr>
            <h3 style="text-align:right;">Tổng: ${formatMoney(o.total)}</h3>

            <p style="text-align:center;">Cảm ơn quý khách!</p>

        </body>
        </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();

    printWindow.onload = function(){
        printWindow.print();
    };
}

    // 👉 Tạo iframe ẩn để in (KHÔNG bị chặn popup)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Đợi render xong rồi in
    iframe.onload = function(){
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Xóa iframe sau khi in
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    };


// ================= PRODUCTS =================
async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const data = await res.json();
        
        const container = document.getElementById('tblProducts');
        if (!container) return;

        container.innerHTML = data.map(p => {
            // Fix lỗi dấu nháy cho tên sản phẩm
            const safeName = p.name.replace(/'/g, "\\'"); 
            return `
                <div class="product-card">
                    <img src="${p.img ? p.img : 'https://placehold.co/150'}">
                    <h4>${p.name}</h4>
                    <p>${formatMoney(p.price)}</p>
                    <div style="display:flex; gap:5px; margin-top:10px;">
                        <button onclick="openEditProductModal(${p.id}, '${safeName}', ${p.price})">Sửa</button>
                        <button onclick="deleteItem('products', ${p.id}, loadProducts)">Xóa</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) { console.error("Lỗi load sản phẩm:", err); }
}

function openEditProductModal(id, name, price) {
    currentEditProductId = id; // Bây giờ biến này đã được khởi tạo ở đầu file nên sẽ không lỗi
    
    const modal = document.getElementById('productEditModal');
    if (modal) {
        document.getElementById('editProdName').value = name;
        document.getElementById('editProdPrice').value = price;
        document.getElementById('editProdImg').value = ''; 
        modal.style.display = 'flex';
    }
}

function closeProductModal() {
    const modal = document.getElementById('productEditModal');
    if (modal) modal.style.display = 'none';
}

async function confirmEditProduct() {
    if (!currentEditProductId) return;

    const name = document.getElementById('editProdName').value.trim();
    const price = document.getElementById('editProdPrice').value.trim();
    const file = document.getElementById('editProdImg').files[0];

    if (!name || !price) return alert("Vui lòng điền đủ tên và giá!");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("price", price);
    if (file) formData.append("image", file);

    try {
        const res = await fetch(`${API_URL}/products/${currentEditProductId}`, {
            method: 'PUT',
            body: formData
        });

        if (res.ok) {
            alert("Cập nhật thành công!");
            closeProductModal();
            loadProducts();
        }
    } catch (err) { alert("Lỗi kết nối server!"); }
}

// ================= INVENTORY =================
// ================= LOAD DỮ LIỆU KHO =================
async function loadInventory() {
    try {
        const res = await fetch(`${API_URL}/inventory`);
        const data = await res.json();
        const tbody = document.getElementById('tblInventory');
        if (!tbody) return;

        tbody.innerHTML = data.map(i => `
            <tr>
                <td>${i.name}</td>
                <td>${i.qty}</td>
                <td>${i.unit}</td>
                <td>
                    <button onclick="openModal('inventory', '${encodeURIComponent(JSON.stringify(i))}')">Sửa</button>
                    <button onclick="deleteItem('inventory', ${i.id}, loadInventory)">Xóa</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Không lấy được dữ liệu kho:", err);
    }
}

// ================= THÊM KHO (FIXED) =================
async function addInventory() {
    const name = document.getElementById('invName').value.trim();
    const qty = document.getElementById('invQty').value;
    const unit = document.getElementById('invUnit').value.trim();

    if (!name || !qty) return alert("Nhập đủ tên và số lượng!");

    try {
        const res = await fetch(`${API_URL}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, qty, unit })
        });
        if (res.ok) {
            alert("Thêm thành công!");
            document.getElementById('invName').value = '';
            document.getElementById('invQty').value = '';
            document.getElementById('invUnit').value = '';
            loadInventory();
        }
    } catch (err) { alert("Lỗi kết nối Server!"); }
}

// ================= CUSTOMERS =================
async function loadCustomers() {
    const res = await fetch(`${API_URL}/customers`);
    const json = await res.json();
    const data = json.data || json;
    document.getElementById('tblCustomers').innerHTML = data.map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.phone}</td>
            <td>${new Intl.NumberFormat('vi-VN').format(c.points)}</td>
            <td>
                <button onclick="openModal('customers', '${encodeURIComponent(JSON.stringify(c))}')">Sửa</button>
                <button onclick="deleteCustomer(${c.id})">Xóa</button>
            </td>
        </tr>
    `).join('');
}

async function deleteCustomer(id) {
    if (!confirm("Xóa khách?")) return;
    await fetch(`${API_URL}/customers/${id}`, { method: 'DELETE' });
    loadCustomers();
}

// ================= MODAL =================
function openModal(type, dataRaw) {
    try {
        const data = JSON.parse(decodeURIComponent(dataRaw));
        
        // Gán giá trị vào biến toàn cục để confirmEdit sử dụng
        editType = type;
        editId = data.id; 

        document.getElementById('editModal').style.display = 'flex';

        // Điền dữ liệu vào các ô input
        document.getElementById('modalName').value = data.name || '';
        document.getElementById('modalPhone').value = data.phone || '';
        document.getElementById('modalQty').value = data.qty || '';
        document.getElementById('modalUnit').value = data.unit || '';

        // Hiển thị các ô tương ứng với từng loại
        const mPhone = document.getElementById('modalPhone');
        const mQty = document.getElementById('modalQty');
        const mUnit = document.getElementById('modalUnit');

        if (type === 'inventory') {
            mPhone.style.display = 'none';
            mQty.style.display = 'block';
            mUnit.style.display = 'block';
        } else if (type === 'customers') {
            mPhone.style.display = 'block';
            mQty.style.display = 'none';
            mUnit.style.display = 'none';
        }
    } catch (e) {
        console.error("Lỗi khi mở modal:", e);
    }
}   

function closeModal(){
    document.getElementById('editModal').style.display = 'none';
}

async function confirmEdit() {
    // 1. Kiểm tra xem có đang trong trạng thái sửa không
    if (!editId || !editType) {
        alert("Lỗi: Không xác định được đối tượng cần sửa!");
        return;
    }

    // 2. Thu thập dữ liệu từ các input
    const name = document.getElementById('modalName').value.trim();
    const phone = document.getElementById('modalPhone').value.trim();
    const qty = document.getElementById('modalQty').value;
    const unit = document.getElementById('modalUnit').value.trim();

    // 3. Chuẩn bị dữ liệu gửi đi tùy theo loại
    let bodyData = {};
    if (editType === 'inventory') {
        bodyData = { name, qty, unit };
    } else if (editType === 'customers') {
        if (!name || !phone) return alert("Không được để trống tên và SĐT!");
        bodyData = { name, phone };
    }

    try {
        const response = await fetch(`${API_URL}/${editType}/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        if (response.ok) {
            alert("Cập nhật thành công!");
            closeModal();
            // Load lại đúng bảng
            if (editType === 'inventory') loadInventory();
            if (editType === 'customers') loadCustomers();
        } else {
            const errResult = await response.json();
            alert("Lỗi từ server: " + (errResult.message || "Không thể cập nhật"));
        }
    } catch (error) {
        console.error("Lỗi fetch:", error);
        alert("Lỗi kết nối server!");
    }
}

// ================= COMMON =================
async function deleteItem(type, id, reloadFunc) {
    if (!confirm("Bạn có chắc chắn muốn xóa?")) return;
    try {
        const res = await fetch(`${API_URL}/${type}/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert("Xóa thành công!");
            if (typeof reloadFunc === 'function') reloadFunc();
        } else {
            alert("Lỗi khi xóa từ phía server!");
        }
    } catch (err) {
        console.error("Lỗi kết nối:", err);
    }
}

// ================= INIT =================
// Thay đổi phần INIT ở cuối file
document.getElementById('currentTime').innerText = new Date().toLocaleDateString('vi-VN');

// Tải dữ liệu ban đầu
loadDashboard();
loadOrders();
loadProducts();
loadInventory();
loadCustomers();