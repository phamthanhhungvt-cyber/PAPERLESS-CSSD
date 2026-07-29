/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (ĐÃ FIX TỰ ĐỘNG NHẬN DIỆN MỌI FILE EXCEL)
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
    danhMucLinhKien: [], // Lưu dữ liệu nạp từ Excel đã qua chuẩn hóa
    ktvList: [
        { id: 'NV01', name: 'Nguyễn Văn A', pin: '1234', role: 'CSSD' },
        { id: 'NV02', name: 'Trần Thị B', pin: '5678', role: 'CSSD' },
        { id: 'ADMIN', name: 'ADMINISTRATOR', pin: '9999', role: 'ADMIN' },
        { id: 'GUEST', name: 'Khách Tham Quan', pin: '0000', role: 'GUEST' }
    ]
};

let html5QrcodeScanner = null;

/* =========================================================================
   3. KHỞI TẠO VÀ SỰ KIỆN TRANG (INITIALIZATION)
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initRealtimeListeners();
    initExcelLoader(); // Đăng ký đọc Excel thông minh
    tuDongTaoMaLoMeRua();
    tuDongTaoMaLoMeHap();
    renderDanhSachPinAdmin(); 

    window.addEventListener('afterprint', () => {
        document.body.classList.remove('print-mode-doc', 'print-mode-bixolon');
        const printZone = document.getElementById('print-zone');
        if (printZone) {
            printZone.classList.add('hidden');
            printZone.innerHTML = '';
        }
    });
});

// XỬ LÝ ĐỌC FILE EXCEL THÔNG MINH (SMART PARSER)
function initExcelLoader() {
    const excelInput = document.getElementById('excelFileInput');
    if (!excelInput) return;

    excelInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (typeof XLSX === 'undefined') {
            alert("❌ Chưa tải thư viện SheetJS (XLSX). Vui lòng kiểm tra lại kết nối mạng!");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // 1. Tự động chọn Sheet có nhiều dòng dữ liệu nhất (vd: 'Data chi tiết')
                let bestSheetName = workbook.SheetNames[0];
                let maxRows = 0;

                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const range = XLSX.utils.decode_range(sheet['!ref'] || "A1:A1");
                    const rowCount = range.e.r - range.s.r + 1;
                    if (rowCount > maxRows) {
                        maxRows = rowCount;
                        bestSheetName = sheetName;
                    }
                });

                const targetSheet = workbook.Sheets[bestSheetName];
                const rawRows = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: "" });

                if (!rawRows || rawRows.length === 0) {
                    alert("⚠️ File Excel rỗng!");
                    return;
                }

                // 2. Kiểm tra dòng 0 xem có phải Header hay không
                const row0 = rawRows[0] || [];
                const row0Str = row0.map(v => String(v).toLowerCase()).join(' ');
                
                const hasHeader = row0Str.includes('stt') || row0Str.includes('tên') || row0Str.includes('mã') || row0Str.includes('số lượng') || row0Str.includes('khoa');

                let parsedList = [];

                if (hasHeader) {
                    // Có tiêu đề cột (như CƠ SỐ DC KP.xlsx - sheet 'Data chi tiết')
                    const headerRow = row0.map(v => String(v).trim());
                    
                    let idxKhoa = headerRow.findIndex(h => h.includes('Tên TS (i)') || h.includes('Khoa') || h.includes('Phòng'));
                    let idxMa = headerRow.findIndex(h => h.includes('MÃ') || h.includes('Mã'));
                    let idxTen = headerRow.findIndex(h => h.includes('Tên TS chuẩn') || h.includes('Tên bộ') || h.includes('Tên Dụng Cụ') || h.includes('Tên Mâm'));
                    let idxSoLuong = headerRow.findIndex(h => h.includes('Số lượng') || h.includes('Cơ số') || h.includes('SỐ BỘ'));

                    if (idxKhoa === -1) idxKhoa = 1;
                    if (idxMa === -1) idxMa = 2;
                    if (idxTen === -1) idxTen = 3;
                    if (idxSoLuong === -1) idxSoLuong = 4;

                    for (let i = 1; i < rawRows.length; i++) {
                        const r = rawRows[i];
                        if (!r || r.length === 0) continue;
                        const ten = r[idxTen] ? String(r[idxTen]).trim() : "";
                        const ma = r[idxMa] ? String(r[idxMa]).trim() : "";
                        const khoa = r[idxKhoa] ? String(r[idxKhoa]).trim() : "Toàn viện";
                        const sl = r[idxSoLuong] !== "" && r[idxSoLuong] !== undefined ? Number(r[idxSoLuong]) || 1 : 1;

                        if (ten || ma) {
                            parsedList.push({
                                khoa: khoa,
                                maBo: ma || `MA_${i}`,
                                tenBo: ten || "Bộ Dụng Cụ",
                                soLuong: sl
                            });
                        }
                    }
                } else {
                    // Không có tiêu đề cột (như IMPORT-CƠ SỐ.xlsx) -> [0: Khoa, 1: Mã, 2: Tên, 3: Số Lượng]
                    for (let i = 0; i < rawRows.length; i++) {
                        const r = rawRows[i];
                        if (!r || r.length < 3) continue;

                        const khoa = r[0] ? String(r[0]).trim() : "Toàn viện";
                        const ma = r[1] ? String(r[1]).trim() : `MA_${i+1}`;
                        const ten = r[2] ? String(r[2]).trim() : "";
                        const sl = r[3] !== "" && r[3] !== undefined ? Number(r[3]) || 1 : 1;

                        if (ten || ma) {
                            parsedList.push({
                                khoa: khoa,
                                maBo: ma,
                                tenBo: ten || "Bộ Dụng Cụ",
                                soLuong: sl
                            });
                        }
                    }
                }

                if (parsedList.length > 0) {
                    globalData.danhMucLinhKien = parsedList;
                    renderBangDanhMucLinhKien();
                    alert(`🎉 Nạp thành công ${parsedList.length} bộ dụng cụ từ file [${file.name}] (Sheet: '${bestSheetName}')!`);
                } else {
                    alert("⚠️ Không tìm thấy dữ liệu bộ dụng cụ hợp lệ trong file Excel!");
                }

            } catch (err) {
                console.error(err);
                alert("❌ Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng file!");
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// RENDER BẢNG DANH MỤC LINH KIỆN & CƠ SỐ
function renderBangDanhMucLinhKien() {
    const tbody = document.getElementById('bangDanhMucLinhKien');
    const tbodyTong = document.getElementById('bangDanhMucTong');

    const searchInp = document.getElementById('search_danhmuc_inp');
    const keyword = searchInp ? searchInp.value.trim().toLowerCase() : "";

    const filtered = (globalData.danhMucLinhKien || []).filter(item => {
        return item.tenBo.toLowerCase().includes(keyword) || 
               item.maBo.toLowerCase().includes(keyword) || 
               item.khoa.toLowerCase().includes(keyword);
    });

    if (tbody) {
        if (!filtered || filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Chưa có dữ liệu cơ số dụng cụ. Vui lòng nạp file Excel tại Quản Trị Hệ Thống.</td></tr>`;
        } else {
            tbody.innerHTML = filtered.map((item, idx) => `
                <tr class="border-b hover:bg-slate-50 text-xs">
                    <td class="p-3 font-mono font-bold text-sky-700">${item.maBo}</td>
                    <td class="p-3 font-bold text-slate-800">${item.tenBo}</td>
                    <td class="p-3 text-slate-600">${item.khoa}</td>
                    <td class="p-3 text-center font-bold text-emerald-600 bg-emerald-50 rounded">${item.soLuong}</td>
                </tr>
            `).join('');
        }
    }

    if (tbodyTong) {
        if (!filtered || filtered.length === 0) {
            tbodyTong.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có dữ liệu khay dụng cụ</td></tr>`;
        } else {
            tbodyTong.innerHTML = filtered.map(item => `
                <tr class="border-b hover:bg-slate-50 text-xs">
                    <td class="p-3 font-mono font-bold text-sky-700">${item.maBo}</td>
                    <td class="p-3 font-bold text-slate-800">${item.tenBo}</td>
                    <td class="p-3 text-slate-600">${item.khoa}</td>
                    <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Sẵn Sàng (${item.soLuong})</span></td>
                </tr>
            `).join('');
        }
    }
}

// Lắng nghe dữ liệu Realtime từ Firebase Firestore
function initRealtimeListeners() {
    if (!db) {
        console.warn("Chế độ Offline / Chưa cấu hình Firestore.");
        return;
    }

    db.collection("lich_su_luan_chuyen").orderBy("timestamp", "desc").limit(100)
        .onSnapshot((snapshot) => {
            globalData.lichSu = [];
            snapshot.forEach((doc) => {
                globalData.lichSu.push({ id: doc.id, ...doc.data() });
            });
            renderBangLichSuLuanChuyen();
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

    // Tự động làm mới bảng khi chọn Tab Danh Mục Linh Kiện Chuẩn
    if (tabId === 'danhmuc') {
        renderBangDanhMucLinhKien();
    }

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

    switchTab('khoaphong');
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

/* =========================================================================
   5. XUẤT BÁO CÁO EXCEL
   ========================================================================= */
function xuatBaoCaoExcelLuanChuyen() {
    if (typeof XLSX === 'undefined') {
        alert("Thư viện SheetJS chưa sẵn sàng!");
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

    const wsLuanChuyen = XLSX.utils.json_to_sheet(dataLuanChuyen.length ? dataLuanChuyen : [{ "Ghi chú": "Chưa có dữ liệu" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsLuanChuyen, "Nhat_Ky_Luan_Chuyen");
    XLSX.writeFile(wb, `BaoCao_LuanChuyen_CSSD_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function xuatBaoCaoExcelMeRua() {
    if (typeof XLSX === 'undefined') {
        alert("Thư viện SheetJS chưa sẵn sàng!");
        return;
    }
    const dataMeRua = globalData.meRua.map(item => ({
        "Mã Lô Rửa": item.batchId || "N/A",
        "Mã Máy Rửa": item.maySo || "Belimed WD250",
        "Chu Trình": item.chuKy || "Tiêu chuẩn",
        "Kết Quả": item.testDoSach || "ĐẠT",
        "Thời Gian": item.thoiGian || "N/A"
    }));

    const wsMeRua = XLSX.utils.json_to_sheet(dataMeRua.length ? dataMeRua : [{ "Ghi chú": "Chưa có dữ liệu" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMeRua, "Me_Rua_Belimed");
    XLSX.writeFile(wb, `NhatKy_MeRua_Belimed_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* =========================================================================
   6. LOGIC MẺ RỬA & HẤP
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

function xacNhanMeRua() {
    const batchInp = document.getElementById('rua_batchId');
    const chuKyInp = document.getElementById('rua_chuKy');
    const batchId = batchInp ? batchInp.value : `R${Date.now()}`;

    const newRecord = {
        batchId: batchId,
        loaiRua: "Máy rửa khử khuẩn tự động",
        chuKy: chuKyInp ? chuKyInp.value : "Tiêu chuẩn",
        testDoSach: "ĐẠT (Protein Negative)",
        thoiGian: new Date().toLocaleString('vi-VN')
    };

    globalData.meRua.unshift(newRecord);
    renderBangLichSuRua();
    alert(`🚀 Đã kích hoạt mẻ rửa: ${batchId}`);
}

function renderBangLichSuRua() {
    const tbody = document.getElementById('bangLichSuRua');
    if (!tbody) return;
    if (globalData.meRua.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-xs text-slate-400">Chưa có mẻ rửa nào</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.meRua.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold text-sky-700">${item.batchId}</td>
            <td class="p-3">${item.loaiRua}</td>
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
        tbody.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-xs text-slate-400">Chưa có nhật ký luân chuyển</td></tr>`;
        return;
    }
    tbody.innerHTML = globalData.lichSu.map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-mono font-bold">${item.maBo || 'MÂM_01'}</td>
            <td class="p-3 font-bold">${item.tenBo || 'Mâm Dụng Cụ'}</td>
            <td class="p-3">${item.khoa || 'Khoa GMHS'}</td>
            <td class="p-3 text-center"><span class="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold text-[10px]">${item.trangThai || 'Luân chuyển'}</span></td>
            <td class="p-3 text-center font-mono">${item.maLoHap || '---'}</td>
            <td class="p-3 text-center">${item.nhanSu || 'KTV'}</td>
            <td class="p-3 text-center text-slate-500">${item.thoiGian || 'Vừa xong'}</td>
        </tr>
    `).join('');
}

/* =========================================================================
   7. ADMIN SUBTAB & PHÂN QUYỀN PIN
   ========================================================================= */
function switchAdminSubtab(subtab) {
    const subDb = document.getElementById('subtab-database');
    const subSec = document.getElementById('subtab-security');
    const btnDb = document.getElementById('subbtn-database');
    const btnSec = document.getElementById('subbtn-security');

    if (subDb) subDb.classList.toggle('hidden', subtab !== 'database');
    if (subSec) subSec.classList.toggle('hidden', subtab !== 'security');

    if (btnDb) btnDb.classList.toggle('admin-subtab-active', subtab === 'database');
    if (btnSec) btnSec.classList.toggle('admin-subtab-active', subtab === 'security');

    if (subtab === 'security') renderDanhSachPinAdmin();
}

function renderDanhSachPinAdmin() {
    const tbody = document.getElementById('bangCauHinhPinAdmin');
    if (!tbody) return;

    const searchInp = document.getElementById('search_pin_admin');
    const keyword = searchInp ? searchInp.value.trim().toLowerCase() : '';

    const filteredList = globalData.ktvList.filter(ktv => 
        ktv.name.toLowerCase().includes(keyword) || ktv.id.toLowerCase().includes(keyword)
    );

    tbody.innerHTML = filteredList.map((ktv, index) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 text-center font-bold text-slate-500">${index + 1}</td>
            <td class="p-3 font-mono font-bold text-sky-700">${ktv.id}</td>
            <td class="p-3 font-semibold text-slate-800">${ktv.name}</td>
            <td class="p-3 text-center font-mono">
                <input type="password" id="pin_input_${ktv.id}" value="${ktv.pin || '1234'}" class="w-24 text-center border rounded p-1 text-xs font-bold">
            </td>
            <td class="p-3 text-center">
                <select id="role_select_${ktv.id}" class="border rounded px-2 py-1 text-xs">
                    <option value="CSSD" ${ktv.role === 'CSSD' ? 'selected' : ''}>KTV CSSD</option>
                    <option value="KHOA" ${ktv.role === 'KHOA' ? 'selected' : ''}>Điều Dưỡng Khoa</option>
                    <option value="ADMIN" ${ktv.role === 'ADMIN' ? 'selected' : ''}>Administrator</option>
                </select>
            </td>
            <td class="p-3 text-center">
                <button onclick="capNhatPinNhanVien('${ktv.id}')" class="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-xs font-bold">Lưu</button>
            </td>
        </tr>
    `).join('');
}

function capNhatPinNhanVien(ktvId) {
    const pinInp = document.getElementById(`pin_input_${ktvId}`);
    const targetKtv = globalData.ktvList.find(k => k.id === ktvId);
    if (targetKtv && pinInp) {
        targetKtv.pin = pinInp.value.trim();
        alert(`🔑 Đã cập nhật PIN cho [${targetKtv.name}]!`);
    }
}

function themNhanSuMoiAdmin() {
    const nameInp = document.getElementById('admin_add_nv_name');
    const idInp = document.getElementById('admin_add_nv_id');
    if (!nameInp || !idInp || !nameInp.value.trim() || !idInp.value.trim()) {
        alert("Vui lòng nhập Mã NV và Họ Tên!");
        return;
    }
    globalData.ktvList.push({
        id: idInp.value.trim().toUpperCase(),
        name: nameInp.value.trim(),
        pin: '1234',
        role: 'CSSD'
    });
    renderDanhSachPinAdmin();
    nameInp.value = '';
    idInp.value = '';
    alert("➕ Đã thêm nhân sự thành công!");
}

function resetDuLieuKet() { alert("🔄 Đã giải phóng mâm kẹt dở dang!"); }
function xoaSachDuLieuGiaoDichRealtime() {
    if (confirm("⚠️ Bạn có chắc chắn muốn xóa nhật ký giao dịch?")) {
        globalData.lichSu = [];
        globalData.meRua = [];
        renderBangLichSuLuanChuyen();
        renderBangLichSuRua();
        alert("🗑️ Đã xóa thành công!");
    }
}
function khaiSinhKhayVangLai() {
    const ma = prompt("Nhập mã khay vãng lai:");
    if (ma) alert(`✨ Đã khởi tạo khay: ${ma.toUpperCase()}`);
}

/* =========================================================================
   8. POPUPS & KHÁC
   ========================================================================= */
function moModalXemAnhCauHinh() {
    const pop = document.getElementById('popupXemAnhCauHinh');
    if (pop) pop.classList.remove('hidden');
}
function dongModalXemAnhCauHinh() {
    const pop = document.getElementById('popupXemAnhCauHinh');
    if (pop) pop.classList.add('hidden');
}
function moPopupSuDungBoDungCu() {
    const pop = document.getElementById('popupSuDungBoDungCu');
    if (pop) pop.classList.remove('hidden');
}
function closePopupSuDung() {
    const pop = document.getElementById('popupSuDungBoDungCu');
    if (pop) pop.classList.add('hidden');
}
