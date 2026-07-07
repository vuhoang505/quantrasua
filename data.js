// Khởi tạo menu mặc định nếu chưa có
const defaultProducts = [
    { id: 1, name: "Trà Sữa Uyên Ương (Yuen Yeung)", price: 55000, img: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=500" },
    { id: 2, name: "Hồng Trà Chanh Hong Kong", price: 45000, img: "https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=500" }
];

if (!localStorage.getItem('hk_products')) {
    localStorage.setItem('hk_products', JSON.stringify(defaultProducts));
}
if (!localStorage.getItem('hk_orders')) {
    localStorage.setItem('hk_orders', JSON.stringify([])); // Nơi chứa tất cả đơn hàng
}

function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function getOrders() {
    return JSON.parse(localStorage.getItem('hk_orders')) || [];
}

function saveOrders(orders) {
    localStorage.setItem('hk_orders', JSON.stringify(orders));
    // Tự động kích hoạt sự kiện storage cho tab hiện tại (để giao diện tự update)
    window.dispatchEvent(new Event('storage'));
}