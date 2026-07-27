/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js
   ========================================================================= */

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

// DỮ LIỆU CẤU HÌNH GỐC & DANH MỤC DỤNG CỤ
let databaseCoSo = [
    { maBo: "KD-101", tenBo: "Bộ Mâm Phẫu Thuật Đại Phẫu", khoa: "Khoa Phẫu Thuật GMHS", trangThai: "Sẵn sàng (Vô khuẩn)", maLoHap: "STEAM_20260725_01", hanDung: "30/08/2026", tongMe: 12 },
    { maBo: "KD-102", tenBo: "Bộ Mâm Phẫu Thuật Đại Phẫu", khoa: "Khoa Phẫu Thuật GMHS", trangThai: "Sẵn sàng (Vô khuẩn)", maLoHap: "STEAM_20260725_01", hanDung: "30/08/2026", tongMe: 15 },
    { maBo: "KD-103", tenBo: "Bộ Mâm Phẫu Thuật Đại Phẫu", khoa: "Khoa Phẫu Thuật GMHS", trangThai: "Chờ rửa (Mâm bẩn)", maLoHap: "---", hanDung: "---", tongMe: 8 },
    { maBo: "TP-201", tenBo: "Bộ Mâm Phẫu Thuật Tiểu Phẫu", khoa: "Khoa Cấp Cứu", trangThai: "Sẵn sàng (Vô khuẩn)", maLoHap: "STEAM_20260726_02", hanDung: "26/08/2026", tongMe: 22 },
    { maBo: "TP-202", tenBo: "Bộ Mâm Phẫu Thuật Tiểu Phẫu", khoa: "Khoa Cấp Cứu", trangThai: "Chờ hấp tiệt trùng", maLoHap: "---", hanDung: "---", tongMe: 19 },
    { maBo: "NS-301", tenBo: "Bộ Dụng Cụ Phẫu Thuật Nội Soi", khoa: "Khoa Ngoại Tổng Hợp", trangThai: "Sẵn sàng (Vô khuẩn)", maLoHap: "PLASMA_20260727_01", hanDung: "27/10/2026", tongMe: 5 },
    { maBo: "CT-401", tenBo: "Bộ Dụng Cụ Chấn Thương Chỉnh Hình", khoa: "Khoa Phẫu Thuật GMHS", trangThai: "Đang trong buồng rửa", maLoHap: "---", hanDung: "---", tongMe: 31 }
];

let databaseLinhKienAesculap = [
    { tenBo: "Bộ Mâm Phẫu Thuật Đại Phẫu", chiTiet: "Cán dao #4 (2), Kéo Mayo 17cm (1), Kéo Metzenbaum (1), Pince Hemostatic (12), Nhíp có răng/không răng (4)", tongCoSo: 5, gioiHanMeMax: 500 },
    { tenBo: "Bộ Mâm Phẫu Thuật Tiểu Phẫu", chiTiet: "Cán dao #3 (1), Kéo cắt chỉ (1), Pince Halstead Mosquito (6), Kẹp mang kim (1), Nhíp phẫu thuật (2)", tongCoSo: 8, gioiHanMeMax: 300 },
    { tenBo: "Bộ Dụng Cụ Phẫu Thuật Nội Soi", chiTiet: "Trocar 10mm/5mm (4), Kìm kẹp kim nội soi (2), Kéo nội soi (1), Ống nhòm Laparoscope 10mm 30 deg (1)", tongCoSo: 3, gioiHanMeMax: 200 },
    { tenBo: "Bộ Dụng Cụ Chấn Thương Chỉnh Hình", chiTiet: "Đục xương các cỡ (4), Búa đục xương (1), Kìm tuốt màng xương (2), Kìm cắt xương Heavy (1)", tongCoSo: 4, gioiHanMeMax: 600 }
];

let currentUser = {
    role: 'ADMIN',
    khoa: '',
    nvName: 'PHẠM THANH HÙNG'
};

let currentTab = 'worklist';
let currentWorklistSubtab = 'baotra';

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

// KHỞI TẠO HỆ THỐNG
document.addEventListener('DOMContentLoaded', () => {
    initRealtimeListeners();
    initCanvasSignature();
    tuDongTaoMaLoMeRua();
    tuDongTaoMaLoMeHap();
    renderAllData(); // Render toàn bộ dữ liệu ban đầu

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
    if (!db) return;

    db.collection("lich_su_luan_chuyen").orderBy("timestamp", "desc").limit(100)
        .onSnapshot((snapshot) => {
            globalData.lichSu = [];
            snapshot.forEach((doc) => {
                globalData.lichSu.push({ id: doc.id, ...doc.data() });
            });
            renderBangLichSuLuanChuyen();
        }, (error) => {});

    db.collection("me_rua_belimed").orderBy("timestamp", "desc").limit(50)
        .onSnapshot((snapshot) => {
            globalData.meRua = [];
            snapshot.forEach((doc) => {
                globalData.meRua.push({ id: doc.id, ...doc.data() });
            });
            renderBangLichSuRua();
        });
}

// HÀM RENDER TẤT CẢ CÁC BẢNG DỤNG CỤ
function renderAllData() {
    renderBangLinhKien();
    renderBangDanhMucTong();
    renderBangTonKho();
    renderDataListOption();
}

function renderBangLinhKien() {
    const tbody = document.getElementById('bangDanhMucLinhKien');
    if (!tbody) return;
    tbody.innerHTML = databaseLinhKienAesculap.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-teal-800">${item.tenBo}</td>
            <td class="p-3 text-slate-600">${item.chiTiet} <br><span class="text-[10px] text-amber-700 font-bold">(Hạn mức mẻ hấp: ${item.gioiHanMeMax} mẻ)</span></td>
            <td class="p-3 text-center font-extrabold text-slate-800">${item.tongCoSo} Bộ</td>
        </tr>
    `).join('');
}

function renderBangDanhMucTong() {
    const tbody = document.getElementById('bangDanhMucTong');
    if (!tbody) return;
    tbody.innerHTML = databaseCoSo.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-slate-800">${item.maBo}</td>
            <td class="p-3 font-bold">${item.tenBo}</td>
            <td class="p-3 text-center"><span class="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold text-[10px]">${item.trangThai}</span></td>
            <td class="p-3 text-center font-mono font-bold text-purple-700">${item.tongMe} Mẻ</td>
        </tr>
    `).join('');
}

function renderBangTonKho() {
    const tbody = document.getElementById('bangTonKhoTe');
    if (!tbody) return;
    tbody.innerHTML = databaseCoSo.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-teal-800">${item.maBo}</td>
            <td class="p-3 font-bold text-slate-800">${item.tenBo}</td>
            <td class="p-3 text-slate-600 font-medium">${item.khoa}</td>
            <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold text-[10px]">${item.trangThai}</span></td>
            <td class="p-3 text-center font-mono text-xs font-bold text-slate-700">${item.maLoHap}</td>
            <td class="p-3 text-center font-bold text-slate-600">${item.hanDung}</td>
        </tr>
    `).join('');
}

function renderDataListOption() {
    const list = document.getElementById('listBoDungCu');
    if (!list) return;
    list.innerHTML = databaseCoSo.map(item => `<option value="${item.maBo}">${item.tenBo} - (${item.khoa})</option>`).join('');
}

// 1. HÀM CHUYỂN TAB MAIN CHÍNH
function switchTab(tabId) {
    currentTab = tabId;
    const allTabs = ['danhmuc', 'tonkho', 'worklist', 'sudung', 'admin'];
    
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

// 2. HÀM CHUYỂN SUBTAB NGANG TRONG WORKLIST
function switchWorklistSubtab(subId) {
    currentWorklistSubtab = subId;
    const allSubtabs = ['baotra', 'thugom', 'mayrua', 'mayhap', 'khovokhuan', 'nhatky', 'tv'];

    allSubtabs.forEach(id => {
        const subEl = document.getElementById(`worksub-${id}`);
        if (subEl) subEl.classList.add('hidden');

        const btnEl = document.getElementById(`workbtn-${id}`);
        if (btnEl) btnEl.classList.remove('subtab-active');
    });

    const activeSub = document.getElementById(`worksub-${subId}`);
    if (activeSub) activeSub.classList.remove('hidden');

    const activeBtn = document.getElementById(`workbtn-${subId}`);
    if (activeBtn) {
        activeBtn.classList.add('subtab-active');
        if (typeof activeBtn.scrollIntoView === 'function') {
            activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
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
    currentUser.nvName = role === 'ADMIN' ? 'PHẠM THANH HÙNG' : (role === 'CSSD' ? 'KTV CSSD' : 'ĐIỀU DƯỠNG');

    const userInfoEl = document.getElementById('nav_user_info');
    if (userInfoEl) userInfoEl.innerText = currentUser.nvName;

    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    switchTab('worklist');
    switchWorklistSubtab('baotra');
}

function toggleLoginFields() {
    const roleEl = document.getElementById('login_role');
    if (!roleEl) return;
    const role = roleEl.value;
    
    const fieldKhoa = document.getElementById('field_khoa');
    const fieldNv = document.getElementById('field_nhanvien_cssd');
    
    if (fieldKhoa) fieldKhoa.classList.toggle('hidden', role !== 'KHOA');
    if (fieldNv) fieldNv.classList.toggle('hidden', role !== 'CSSD');
}

function xuatBaoCaoExcelLuanChuyen() {
    if (typeof XLSX === 'undefined') {
        alert("Thư viện SheetJS (XLSX) chưa được tải thành công!");
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

    const wsLuanChuyen = XLSX.utils.json_to_sheet(dataLuanChuyen);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsLuanChuyen, "Nhat_Ky_Luan_Chuyen");

    const nowStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `BaoCao_LuanChuyen_KPI_CSSD_PhuongNam_${nowStr}.xlsx`);
}

function xuatBaoCaoExcelMeRua() {
    if (typeof XLSX === 'undefined') {
        alert("Thư viện SheetJS chưa được tải!");
        return;
    }

    const dataMeRua = globalData.meRua.map(item => ({
        "Mã Lô Rửa": item.batchId || "N/A",
        "Mã Máy Rửa": item.maySo || "Belimed WD250 #1",
        "Số Mẻ Ngày": item.meSo || "01",
        "Phương Thức": item.loaiRua || "Tự động",
        "Chu Trình Làm Sạch": item.chuKy || "Tiêu chuẩn (93°C - 10 phút)",
        "Kết Quả Test Protein": item.testDoSach || "ĐẠT (Protein Negative)",
        "Nhân Viên Vận Hành": item.nhanSu || currentUser.nvName,
        "Thời Gian Kích Hoạt": item.thoiGian || "N/A"
    }));

    const wsMeRua = XLSX.utils.json_to_sheet(dataMeRua);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMeRua, "Nhat_Ky_Me_Rua_Belimed");

    const nowStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `NhatKy_MeRua_Belimed_WD250_${nowStr}.xlsx`);
}

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

function xacNhanMeRua() {
    const batchInp = document.getElementById('rua_batchId');
    const chuKyInp = document.getElementById('rua_chuKy');
    const batchId = batchInp ? batchInp.value : `R${Date.now()}`;
    const chuKy = chuKyInp ? chuKyInp.value : "Tiêu chuẩn (93°C - 10 phút)";

    const newRecord = {
        batchId: batchId,
        maySo: "Belimed WD250 #01",
        meSo: "01",
        loaiRua: "Máy rửa khử khuẩn tự động",
        chuKy: chuKy,
        testDoSach: "ĐẠT (Protein Test Negative)",
        nhanSu: currentUser.nvName,
        thoiGian: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
    };

    globalData.meRua.unshift(newRecord);
    renderBangLichSuRua();
    alert(`🚀 Đã kích hoạt chạy mẻ rửa mã lô: ${batchId}`);
}

function renderBangLichSuRua() {
    const tbody = document.getElementById('bangLichSuRua');
    if (!tbody) return;

    if (globalData.meRua.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có mẻ rửa nào trong ngày</td></tr>`;
        return;
    }

    tbody.innerHTML = globalData.meRua.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-teal-800">${item.batchId}</td>
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
            <td class="p-3 text-center"><span class="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold text-[10px]">${item.trangThai || 'Luân chuyển'}</span></td>
            <td class="p-3 text-center font-mono">${item.maLoHap || '---'}</td>
            <td class="p-3 text-center font-semibold">${item.nhanSu || 'KTV CSSD'}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGian || 'Vừa xong'}</td>
        </tr>
    `).join('');
}

function initCanvasSignature() {
    const canvas = document.getElementById('canvasKyDienTu');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 360;
    canvas.height = 150;

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
        ctx.strokeStyle = '#0f766e';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function stopDrawing() { isDrawing = false; }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

function xoaChuKyCanvas() {
    const canvas = document.getElementById('canvasKyDienTu');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function khoaKyNhanDoSachDienTu() {
    const popup = document.getElementById('popupKyDienTu');
    if (popup) popup.classList.remove('hidden');
}

function dongPopupKyDienTu() {
    const popup = document.getElementById('popupKyDienTu');
    if (popup) popup.classList.add('hidden');
}

function luuXacNhanKyNhan() {
    alert("✍️ Đã xác nhận chữ ký điện tử!");
    dongPopupKyDienTu();
}

function inHoaDonGiaoNhan() {
    document.body.className = "print-mode-doc";
    const printZone = document.getElementById('print-zone');
    if (!printZone) return;

    printZone.classList.remove('hidden');
    printZone.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; color: #000; padding: 10px;">
            <div style="text-align: center; font-weight: 800; font-size: 16px; text-transform: uppercase; margin-bottom: 4px;">BỆNH VIỆN ĐA KHOA PHƯƠNG NAM</div>
            <div style="text-align: center; font-weight: 700; font-size: 14px; text-transform: uppercase; margin-bottom: 20px;">BIÊN BẢN GIAO NHẬN VÀ CÔNG NỢ DỤNG CỤ TIỆT TRÙNG</div>
            <div style="font-size: 12px; margin-bottom: 15px; line-height: 1.6;">
                <p style="margin: 0;"><strong>Khoa / Phòng:</strong> Khoa Phẫu Thuật Gây Mê Hồi Sức</p>
                <p style="margin: 0;"><strong>Ngày lập:</strong> ${new Date().toLocaleString('vi-VN')}</p>
                <p style="margin: 0;"><strong>Nhân viên CSSD lập phiếu:</strong> ${currentUser.nvName}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px;">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 40px;">STT</th>
                        <th style="border: 1px solid #000; padding: 8px; text-align: left;">Tên Bộ Dụng Cụ</th>
                        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 90px;">Đã Trả Bẩn</th>
                        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 100px;">Nhận Vô Khuẩn</th>
                        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 100px;">CSSD Nợ Khoa</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">1</td>
                        <td style="border: 1px solid #000; padding: 8px; font-weight: 600;">Mâm Phẫu Thuật Đại Phẫu Aesculap</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">05</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">05</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">00</td>
                    </tr>
                </tbody>
            </table>
            <div style="display: flex; justify-content: space-between; text-align: center; font-size: 12px; margin-top: 40px;">
                <div style="width: 45%;">
                    <p style="font-weight: 700; text-transform: uppercase; margin-bottom: 60px;">ĐẠI DIỆN KHOA PHÒNG</p>
                    <p style="font-style: italic; color: #555;">(Ký và ghi rõ họ tên)</p>
                </div>
                <div style="width: 45%;">
                    <p style="font-weight: 700; text-transform: uppercase; margin-bottom: 60px;">NHÂN VIÊN CSSD</p>
                    <p style="font-style: italic; color: #555;">(Ký và ghi rõ họ tên)</p>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => { window.print(); }, 100);
}

function inTemNghiemThuHangLoat() {
    document.body.className = "print-mode-bixolon";
    const printZone = document.getElementById('print-zone');
    if (!printZone) return;

    printZone.classList.remove('hidden');
    printZone.innerHTML = `
        <div class="bixolon-label" style="padding: 5px; text-align: center; font-family: sans-serif;">
            <div style="font-size: 10px; font-weight: 800; border-bottom: 1px solid #000; padding-bottom: 2px;">PHUONG NAM HOSPITAL - CSSD</div>
            <div style="font-size: 12px; font-weight: 800; margin: 4px 0;">MÂM ĐẠI PHẪU AESCULAP</div>
            <div style="display: flex; justify-content: center; margin: 2px 0;"><svg id="barcode-demo"></svg></div>
            <div style="font-size: 9px; font-weight: 600; line-height: 1.3;">
                <div>Mã Lô: STEAM_20260727_01 | HSD: 30 Ngày</div>
                <div>NVKH: ${currentUser.nvName}</div>
            </div>
        </div>
    `;

    if (typeof JsBarcode !== 'undefined') {
        JsBarcode("#barcode-demo", "A1260328_01", {
            format: "CODE128", height: 28, displayValue: true, fontSize: 9, margin: 0
        });
    }

    setTimeout(() => { window.print(); }, 100);
}

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

function switchAdminSubtab(subtab) {
    const subDb = document.getElementById('subtab-database');
    const subSec = document.getElementById('subtab-security');
    const btnDb = document.getElementById('subbtn-database');
    const btnSec = document.getElementById('subbtn-security');

    if (subDb) subDb.classList.toggle('hidden', subtab !== 'database');
    if (subSec) subSec.classList.toggle('hidden', subtab !== 'security');

    if (btnDb) btnDb.classList.toggle('admin-subtab-active', subtab === 'database');
    if (btnSec) btnSec.classList.toggle('admin-subtab-active', subtab === 'security');
}

function callRender() {}
function resetDuLieuKet() { alert("🔄 Đã giải phóng mâm kẹt!"); }
function xoaSachDuLieuGiaoDichRealtime() {
    if (confirm("⚠️ Xóa nhật ký giao dịch?")) {
        globalData.lichSu = []; globalData.meRua = [];
        renderBangLichSuLuanChuyen(); renderBangLichSuRua();
        alert("🗑️ Đã xóa!");
    }
}

function scanKhayVaoSuDung() {
    const inp = document.getElementById('sd_maKhayInp');
    if (!inp || !inp.value.trim()) return;

    const maKhay = inp.value.trim().toUpperCase();
    const tbody = document.getElementById('sd_bangKhayChon');

    if (tbody) {
        const rowCount = tbody.rows.length + 1;
        const tr = document.createElement('tr');
        tr.className = "border-b text-xs hover:bg-slate-50";
        tr.innerHTML = `
            <td class="p-2 text-center font-bold text-slate-500">${rowCount}</td>
            <td class="p-2 font-mono font-bold text-teal-800">${maKhay}</td>
            <td class="p-2 font-semibold">Mâm Dụng Cụ Tiệt Trùng</td>
            <td class="p-2 text-center font-mono">STEAM_20260727_01</td>
            <td class="p-2 text-center"><span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Vô Khuẩn</span></td>
            <td class="p-2 text-center"><button onclick="this.closest('tr').remove()" class="text-rose-600 hover:text-rose-800"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    }
    inp.value = '';
}
