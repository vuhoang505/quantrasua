let products = [];
let cart = [];
let allOrders = [];

let currentOrderId = null;
let currentOrderTotal = 0;

const API_URL = 'http://localhost:3000/api';

// ================= FORMAT TIỀN =================
function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// ================= LOAD PRODUCTS =================
async function fetchProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        products = await res.json();
        renderProducts();
    } catch (err) {
        console.error("Lỗi load products:", err);
    }
}

// ================= RENDER PRODUCTS =================
function renderProducts() {
    const box = document.getElementById('productList');
    if (!box) return;

    box.innerHTML = '';

    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card';

        div.onclick = () => addToCart(p.id);

        div.innerHTML = `
            <img src="${p.img || ''}">
            <h4>${p.name}</h4>
            <div>${formatMoney(p.price)}</div>
        `;

        box.appendChild(div);
    });
}

// ================= CART =================
function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const item = cart.find(i => i.id === id);

    if (item) {
        item.qty++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            qty: 1
        });
    }

    renderCart();
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    item.qty += delta;

    if (item.qty <= 0) {
        cart = cart.filter(i => i.id !== id);
    }

    renderCart();
}

// ================= RENDER CART =================
function renderCart() {
    const box = document.getElementById('cartItems');
    const totalBox = document.getElementById('cartTotal');
    const countBox = document.getElementById('cartCount');

    if (!box) return;

    box.innerHTML = '';

    let total = 0;
    let count = 0;

    cart.forEach(i => {
        total += i.price * i.qty;
        count += i.qty;

        const div = document.createElement('div');
        div.className = 'cart-item';

        div.innerHTML = `
            <div>
                <b>${i.name}</b><br>
                <small>${formatMoney(i.price)}</small>
            </div>

            <div>
                <button onclick="changeQty(${i.id},-1)">-</button>
                <span>${i.qty}</span>
                <button onclick="changeQty(${i.id},1)">+</button>
            </div>
        `;

        box.appendChild(div);
    });

    if (totalBox) totalBox.innerText = formatMoney(total);
    if (countBox) countBox.innerText = count;
}

// ================= CHECKOUT =================
async function checkout() {
    if (cart.length === 0) {
        alert("Giỏ hàng trống!");
        return;
    }

    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

    const orderData = {
        id: 'HK' + Date.now().toString().slice(-6),
        total: total,
        items: cart.map(i => ({
            id: i.id,
            qty: i.qty,
            price: i.price
        }))
    };

    try {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(orderData)
        });

        const data = await res.json();

        if (data.ok) {
            alert("Đặt hàng thành công!");

            cart = [];
            renderCart();
        } else {
            alert("Lỗi tạo đơn!");
        }

    } catch (err) {
        console.error(err);
        alert("Không kết nối server!");
    }
}

// ================= LOAD ORDERS =================
async function loadPOS() {
    try {
        const res = await fetch(`${API_URL}/orders`);
        allOrders = await res.json();

        const pending = allOrders.filter(o => o.status === 'pending');

        const box = document.getElementById('pendingOrders');

        if (!pending.length) {
            box.innerHTML = "<div>Không có đơn</div>";
            return;
        }

        box.innerHTML = pending.map(o => `
            <div class="ticket">
                <b>#${o.id}</b>

                ${o.items.map(i => `
                    <div>${i.qty}x ${i.name}</div>
                `).join('')}

                <div><b>${formatMoney(o.total)}</b></div>

                <button onclick="openModal('${o.id}',${o.total})">
                    💳 Thu tiền
                </button>

                <button onclick="printBill('${o.id}')">
                    🖨 In bill
                </button>
            </div>
        `).join('');

    } catch (err) {
        console.error("Load POS error:", err);
    }
}

// ================= MODAL =================
function openModal(id, total) {
    currentOrderId = id;
    currentOrderTotal = total;

    document.getElementById('modalTotal').innerText = formatMoney(total);

    const modal = document.getElementById('modal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
    modal.style.display = 'none';

    document.getElementById('cusName').value = '';
    document.getElementById('cusPhone').value = '';
}

// ================= THANH TOÁN =================
async function processPayment() {
    if (!currentOrderId) return;

    const phone = document.getElementById('cusPhone').value;

    try {
        const res = await fetch(`${API_URL}/orders/${currentOrderId}/pay`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone
            })
        });

        const data = await res.json();

        if (data.ok) {
            alert("Thanh toán thành công!");
            closeModal();
            loadPOS();
        } else {
            alert(data.message || "Thanh toán thất bại!");
        }

    } catch (err) {
        console.error(err);
        alert("Lỗi server!");
    }
}

// ================= PRINT BILL =================
function printBill(id) {
    const o = allOrders.find(x => x.id == id);
    if (!o) return;

    const win = window.open('', '', 'width=300,height=500');

    win.document.write(`
        <body style="font-family:monospace">
            <h3 style="text-align:center">HONGKONG POS</h3>
            <p>Mã: ${o.id}</p>
            <hr>

            ${o.items.map(i => `
                <div style="display:flex;justify-content:space-between">
                    <span>${i.qty}x ${i.name}</span>
                    <span>${formatMoney(i.qty*i.price)}</span>
                </div>
            `).join('')}

            <hr>
            <h3>Tổng: ${formatMoney(o.total)}</h3>
        </body>
    `);

    win.print();
}

// ================= INIT =================
fetchProducts();
loadPOS();
setInterval(loadPOS, 5000);