/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (BẢN TỐI ƯU 2026)
   ========================================================================= */

// 1. CẤU HÌNH KHỞI TẠO FIREBASE (v8)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "phuongnam-cssd.firebaseapp.com",
    projectId: "phuongnam-cssd",
    storageBucket: "phuongnam-cssd.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;

// 2. BIẾN TRẠNG THÁI TOÀN CỤC (GLOBAL STATES)
let currentUser = {
    role: 'ADMIN',
    khoa: '',
    nvName: 'ADMINISTRATOR'
};

let currentTab = 'khoaphong';
let globalData = {
    phieuTra: [],
    meRua: [],
    meHap: [],
    khoVoKhuan: [],
    lichSu: [],
    ktvList: [
        { id: 'NV01', name: 'Nguyễn Văn A' },
        { id: 'NV02', name: 'Trần Thị B' }
    ]
};

let gioHangTraTam = [];
let html5QrcodeScanner = null;

/* =========================================================================
   3. KHỞI TẠO VÀ SỰ KIỆN TRANG
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initRealtimeListeners();
    tuDongTaoMaLoMeRua();
    tuDongTaoMaLoMeHap();

    // Dọn dẹp giao diện in ấn
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('print-mode-doc', 'print-mode-bixolon');
        const printZone = document.getElementById('print-zone');
        if (printZone) {
            printZone.classList.add('hidden');
            printZone.innerHTML = '';
        }
    });
});

function initRealtimeListeners() {
    if (!db) {
        console.warn("Chế độ Offline / Chưa cấu hình Firestore. Sử dụng dữ liệu local.");
        return;
    }

    db.collection("lich_su_luan_chuyen").orderBy("timestamp", "desc").limit(100)
        .onSnapshot((snapshot) => {
            globalData.lichSu = [];
            snapshot.forEach((doc) => {
                globalData.lichSu.push({ id: doc.id, ...doc.data() });
            });
            renderBangLichSuLuanChuyen();
        }, (error) => {
            console.warn("Offline Firestore.");
        });

    db.collection("me_rua_belimed").orderBy("timestamp", "desc").limit(50)
        .onSnapshot((snapshot) => {
            globalData.meRua = [];
            snapshot.forEach((doc) => {
                globalData.meRua.push({ id: doc.id, ...doc.data() });
            });
            renderBangLichSuRua();
        });
}

/* =========================================================================
   4. CHUYỂN TAB & PHÂN QUYỀN
   ========================================================================= */
function switchTab(tabId) {
    currentTab = tabId;
    const allTabs = ['khoaphong', 'thugom', 'mayrua', 'donggoi', 'mayhap', 'khovokhuan', 'quanlykho', 'danhmuc', 'lichsuluanchuyen', 'tracuu', 'performance', 'dashboard_tv', 'admin'];
    
    allTabs.forEach(id => {
        const el = document.getElementById(`tab-${id}`);
        if (el) el.classList.add('hidden');
        
        const menuBtn = document.getElementById(`menu-${id}`);
        if (menuBtn) menuBtn.classList.remove('sidebar-item-active');
    });

    const activeEl = document.getElementById(`tab-${tabId}`);
    if (activeEl) activeEl.classList.remove('hidden');

    const activeMenu = document.getElementById(`menu-${tabId}`);
    if (activeMenu) activeMenu.classList.add('sidebar-item-active');

    const sidebar = document.getElementById('sidebar_menu');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        toggleMobileMenu();
    }
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar_menu');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

function checkLogin() {
    const roleEl = document.getElementById('login_role');
    const passEl = document.getElementById('login_pass');
    
    const role = roleEl ? roleEl.value : 'ADMIN';
    const pin = passEl ? passEl.value : '';

    if (!pin) {
        alert("Vui lòng nhập Mã PIN xác thực!");
        return;
    }

    currentUser.role = role;
    currentUser.nvName = role === 'ADMIN' ? 'ADMINISTRATOR' : (role === 'CSSD' ? 'KTV CSSD' : 'ĐIỀU DƯỠNG');

    const userInfoEl = document.getElementById('nav_user_info');
    if (userInfoEl) userInfoEl.innerText = currentUser.nvName;

    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    if (role === 'GUEST') {
        document.body.classList.add('guest-mode');
    } else {
        document.body.classList.remove('guest-mode');
    }

    switchTab('khoaphong');
}

/* =========================================================================
   5. XUẤT BÁO CÁO EXCEL (SHEETJS)
   ========================================================================= */
function xuatBaoCaoExcelLuanChuyen() {
    if (typeof XLSX === 'undefined') {
        alert("Thư viện SheetJS chưa được tải!");
        return;
    }

    const dataLuanChuyen = globalData.lichSu.map(item => ({
        "Mã ID Khay": item.maBo || "N/A",
        "Tên Bộ Dụng Cụ": item.tenBo || "N/A",
        "Khoa / Phòng": item.khoa || "N/A",
        "Trạng Thái": item.trangThai || "N/A",
        "Mã Lô Tiệt Trùng": item.maLoHap || "N/A",
        "Nhân Sự Xử Lý": item.nhanSu || "N/A",
        "Thời Gian Ghi Nhận": item.thoiGian || "N/A"
    }));

    const wsLuanChuyen = XLSX.utils.json_to_sheet(dataLuanChuyen.length ? dataLuanChuyen : [{ "Mã ID Khay": "DEMO_001", "Tên Bộ Dụng Cụ": "Mâm Phẫu Thuật", "Trạng Thái": "Vô Khuẩn", "Thời Gian Ghi Nhận": new Date().toLocaleString('vi-VN') }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsLuanChuyen, "Nhat_Ky_Luan_Chuyen");

    const nowStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `BaoCao_LuanChuyen_CSSD_PhuongNam_${nowStr}.xlsx`);
}

/* =========================================================================
   6. LOGIC TRẠM RỬA & HẤP
   ========================================================================= */
function tuDongTaoMaLoMeRua() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const batchInp = document.getElementById('rua_batchId');
    const meInp = document.getElementById('rua_meSo');
    if (batchInp && meInp) {
        meInp.value = "01";
        batchInp.value = `R${today}_01`;
    }
}

function tuDongTaoMaLoMeHap() {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const batchInp = document.getElementById('hap_batchId');
    const meInp = document.getElementById('hap_meSo');
    if (batchInp && meInp) {
        meInp.value = "01";
        batchInp.value = `H${today}_01`;
    }
}

function renderBangLichSuRua() {
    const tbody = document.getElementById('bangLichSuRua');
    if (!tbody) return;

    if (globalData.meRua.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có mẻ rửa nào được ghi nhận</td></tr>`;
        return;
    }

    tbody.innerHTML = globalData.meRua.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-sky-700">${item.batchId}</td>
            <td class="p-3 font-semibold">${item.loaiRua || 'Máy rửa tự động'}</td>
            <td class="p-3">${item.chuKy}</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.testDoSach}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGian}</td>
        </tr>
    `).join('');
}

function renderBangLichSuLuanChuyen() {
    const tbody = document.getElementById('bangLichSuHanhTrinhGoc');
    if (!tbody) return;

    if (globalData.lichSu.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-xs text-slate-400">Chưa có dữ liệu nhật ký luân chuyển</td></tr>`;
        return;
    }

    tbody.innerHTML = globalData.lichSu.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-slate-800">${item.maBo || 'MÂM_01'}</td>
            <td class="p-3 font-bold">${item.tenBo || 'Mâm Dụng Cụ Phẫu Thuật'}</td>
            <td class="p-3 text-slate-600">${item.khoa || 'Khoa GMHS'}</td>
            <td class="p-3 text-center"><span class="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold text-[10px]">${item.trangThai || 'Luân chuyển'}</span></td>
            <td class="p-3 text-center font-mono">${item.maLoHap || '---'}</td>
            <td class="p-3 text-center font-semibold">${item.nhanSu || 'KTV CSSD'}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGian || 'Vừa xong'}</td>
        </tr>
    `).join('');
}

/* =========================================================================
   7. CHỮ KÝ ĐIỆN TỬ (TỐI ƯU KHỞI TẠO ĐÚNG THỜI ĐIỂM)
   ========================================================================= */
function khoaKyNhanDoSachDienTu() {
    const popup = document.getElementById('popupKyDienTu');
    if (popup) {
        popup.classList.remove('hidden');
        setTimeout(initCanvasSignature, 50); // Khởi tạo nét vẽ khi canvas hiển thị
    }
}

function initCanvasSignature() {
    const canvas = document.getElementById('canvasKyDienTu');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 360;
    canvas.height = 150;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let isDrawing = false;

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startDrawing(e) {
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0284c7';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function stopDrawing() { isDrawing = false; }

    canvas.onmousedown = startDrawing;
    canvas.onmousemove = draw;
    canvas.onmouseup = stopDrawing;

    canvas.ontouchstart = (e) => startDrawing(e);
    canvas.ontouchmove = (e) => draw(e);
    canvas.ontouchend = stopDrawing;
}

function xoaChuKyCanvas() {
    const canvas = document.getElementById('canvasKyDienTu');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function dongPopupKyDienTu() {
    const popup = document.getElementById('popupKyDienTu');
    if (popup) popup.classList.add('hidden');
    xoaChuKyCanvas();
}

function luuXacNhanKyNhan() {
    alert("✍️ Đã xác nhận chữ ký điện tử và nhập tủ đồ sạch tại khoa thành công!");
    dongPopupKyDienTu();
}

/* =========================================================================
   8. HỆ THỐNG IN ẤN DỘNG (DYNAMIC PRINTING)
   ========================================================================= */
function inTemNghiemThuHangLoat(tenBo = "MÂM ĐẠI PHẪU AESCULAP", maLo = "STEAM_20260725_01", maBarcode = "A1260328_01") {
    document.body.className = "print-mode-bixolon";
    const printZone = document.getElementById('print-zone');
    if (!printZone) return;

    printZone.classList.remove('hidden');
    printZone.innerHTML = `
        <div class="bixolon-label" style="padding: 5px; text-align: center; font-family: sans-serif;">
            <div style="font-size: 10px; font-weight: 800; border-bottom: 1px solid #000; padding-bottom: 2px;">
                PHUONG NAM HOSPITAL - CSSD
            </div>
            <div style="font-size: 11px; font-weight: 800; margin: 4px 0;">
                ${tenBo}
            </div>
            <div style="display: flex; justify-content: center; margin: 2px 0;">
                <svg id="barcode-demo"></svg>
            </div>
            <div style="font-size: 9px; font-weight: 600; line-height: 1.3;">
                <div>Mã Lô: ${maLo} | HSD: 30 Ngày</div>
                <div>NVKH: ${currentUser.nvName}</div>
            </div>
        </div>
    `;

    if (typeof JsBarcode !== 'undefined') {
        JsBarcode("#barcode-demo", maBarcode, {
            format: "CODE128",
            height: 28,
            displayValue: true,
            fontSize: 9,
            margin: 0
        });
    }

    setTimeout(() => { window.print(); }, 120);
}

/* =========================================================================
   9. QUÉT CAMERA QR / BARCODE
   ========================================================================= */
function moCamera(targetInputId) {
    const popup = document.getElementById('popupScanner');
    if (popup) popup.classList.remove('hidden');

    if (typeof Html5QrcodeScanner !== 'undefined') {
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
        html5QrcodeScanner.render((decodedText) => {
            const inputEl = document.getElementById(targetInputId);
            if (inputEl) inputEl.value = decodedText;
            dongCamera();
        }, (error) => {});
    }
}

function dongCamera() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(() => {});
    }
    const popup = document.getElementById('popupScanner');
    if (popup) popup.classList.add('hidden');
}
