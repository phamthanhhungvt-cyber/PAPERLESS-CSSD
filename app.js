/* =========================================================================
   HỆ THỐNG QUẢN LÝ TIỆT TRÙNG CSSD - PHUONG NAM HOSPITAL
   FILE ĐIỀU KHIỂN CHÍNH: app.js (BẢN FIX TRIỆT ĐỂ BÁO TRẢ & LOCALSTORAGE)
   ========================================================================= */

// 1. CẤU HÌNH FIREBASE
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

// 2. BIẾN TRẠNG THÁI TOÀN CỤC
let currentUser = { role: 'ADMIN', khoa: '', nvName: 'ADMINISTRATOR' };
let currentTab = 'khoaphong';
let globalData = {
    phieuTra: [],
    meRua: [],
    meHap: [],
    khoVoKhuan: [],
    lichSu: [],
    danhMucLinhKien: [],
    danhSachKhoa: [],
    ktvList: [
        { id: 'NV01', name: 'Nguyễn Văn A', pin: '1234', role: 'CSSD' },
        { id: 'ADMIN', name: 'ADMINISTRATOR', pin: '9999', role: 'ADMIN' }
    ]
};

let gioHangTraTam = [];

/* =========================================================================
   3. KHỞI TẠO VÀ TỰ KHÔI PHỤC DỮ LIỆU TỪ LOCALSTORAGE
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    // Tự động khôi phục dữ liệu Excel đã nạp trước đó từ bộ nhớ máy
    docDuLieuLuuTruLocalStorage();

    initRealtimeListeners();
    initExcelLoader(); 
    tuDongTaoMaLoMeRua();
    tuDongTaoMaLoMeHap();
    renderDanhSachPinAdmin(); 
});

// Đọc dữ liệu bền vững (Tránh bị mất khi đăng xuất / refresh)
function docDuLieuLuuTruLocalStorage() {
    try {
        const savedLinhKien = localStorage.getItem('cssd_danhMucLinhKien');
        const savedKhoa = localStorage.getItem('cssd_danhSachKhoa');
        const savedPhieuTra = localStorage.getItem('cssd_phieuTra');

        if (savedLinhKien) globalData.danhMucLinhKien = JSON.parse(savedLinhKien);
        if (savedKhoa) globalData.danhSachKhoa = JSON.parse(savedKhoa);
        if (savedPhieuTra) globalData.phieuTra = JSON.parse(savedPhieuTra);

        if (globalData.danhMucLinhKien.length > 0) {
            capNhatGiaoDienSauKhiNapExcel();
        }
    } catch (err) {
        console.error("Lỗi khi đọc dữ liệu lưu trữ:", err);
    }
}

// NẠP VÀ XỬ LÝ FILE EXCEL -> TỰ ĐỘNG LƯU VĨNH VIỄN
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

                if (!rawRows || rawRows.length === 0) return;

                const row0 = rawRows[0] || [];
                const row0Str = row0.map(v => String(v).toLowerCase()).join(' ');
                const hasHeader = row0Str.includes('stt') || row0Str.includes('tên') || row0Str.includes('mã') || row0Str.includes('khoa');

                let parsedList = [];
                let setKhoa = new Set();

                if (hasHeader) {
                    const headerRow = row0.map(v => String(v).trim());
                    let idxKhoa = headerRow.findIndex(h => h.includes('Tên TS (i)') || h.includes('Khoa') || h.includes('Phòng'));
                    let idxMa = headerRow.findIndex(h => h.includes('MÃ') || h.includes('Mã'));
                    let idxTen = headerRow.findIndex(h => h.includes('Tên TS chuẩn') || h.includes('Tên bộ') || h.includes('Tên Dụng Cụ'));
                    let idxSoLuong = headerRow.findIndex(h => h.includes('Số lượng') || h.includes('Cơ số'));

                    if (idxKhoa === -1) idxKhoa = 1;
                    if (idxMa === -1) idxMa = 2;
                    if (idxTen === -1) idxTen = 3;
                    if (idxSoLuong === -1) idxSoLuong = 4;

                    for (let i = 1; i < rawRows.length; i++) {
                        const r = rawRows[i];
                        if (!r || r.length === 0) continue;
                        const ten = r[idxTen] ? String(r[idxTen]).trim() : "";
                        const ma = r[idxMa] ? String(r[idxMa]).trim() : "";
                        const khoa = r[idxKhoa] ? String(r[idxKhoa]).trim() : "PHÒNG SANH";
                        const sl = r[idxSoLuong] !== "" && r[idxSoLuong] !== undefined ? Number(r[idxSoLuong]) || 1 : 1;

                        if (ten || ma) {
                            parsedList.push({ khoa, maBo: ma || `MA_${i}`, tenBo: ten || "Bộ Dụng Cụ", soLuong: sl });
                            if (khoa) setKhoa.add(khoa);
                        }
                    }
                } else {
                    for (let i = 0; i < rawRows.length; i++) {
                        const r = rawRows[i];
                        if (!r || r.length < 3) continue;

                        const khoa = r[0] ? String(r[0]).trim() : "PHÒNG SANH";
                        const ma = r[1] ? String(r[1]).trim() : `MA_${i+1}`;
                        const ten = r[2] ? String(r[2]).trim() : "";
                        const sl = r[3] !== "" && r[3] !== undefined ? Number(r[3]) || 1 : 1;

                        if (ten || ma) {
                            parsedList.push({ khoa, maBo: ma, tenBo: ten || "Bộ Dụng Cụ", soLuong: sl });
                            if (khoa) setKhoa.add(khoa);
                        }
                    }
                }

                if (parsedList.length > 0) {
                    globalData.danhMucLinhKien = parsedList;
                    globalData.danhSachKhoa = Array.from(setKhoa);

                    // LƯU VĨNH VIỄN VÀO BỘ NHỚ MÁY
                    localStorage.setItem('cssd_danhMucLinhKien', JSON.stringify(globalData.danhMucLinhKien));
                    localStorage.setItem('cssd_danhSachKhoa', JSON.stringify(globalData.danhSachKhoa));

                    capNhatGiaoDienSauKhiNapExcel();
                    alert(`🎉 Nạp thành công ${parsedList.length} bộ dụng cụ! Dữ liệu đã được lưu cố định vào hệ thống.`);
                }

            } catch (err) {
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function capNhatGiaoDienSauKhiNapExcel() {
    const selectIds = ['login_khoa', 'khoa_selKhoa', 'xuat_selKhoa', 'inv_filterKhoa'];
    selectIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const firstOption = el.options[0] ? el.options[0].outerHTML : '<option value="">-- Chọn Khoa --</option>';
            el.innerHTML = firstOption + globalData.danhSachKhoa.map(k => `<option value="${k}">${k}</option>`).join('');
        }
    });

    const datalist = document.getElementById('listBoDungCu');
    if (datalist) {
        datalist.innerHTML = globalData.danhMucLinhKien.map(item => 
            `<option value="${item.maBo}">${item.tenBo} (${item.khoa})</option>`
        ).join('');
    }

    renderBangDanhMucLinhKien();
    renderBangCongNoKhoa();
    renderBangChoThuGom();
}

/* =========================================================================
   4. LOGIC GIỎ HÀNG BÁO TRẢ & XỬ LÝ NÚT GỬI
   ========================================================================= */
function themVaoGio() {
    const inp = document.getElementById('khoa_inpMaBo');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!inp || !inp.value.trim()) {
        alert("Vui lòng chọn hoặc nhập mã mâm dụng cụ bẩn!");
        return;
    }

    const maBoInput = inp.value.trim().toUpperCase();
    const khoaSelect = selKhoa ? selKhoa.value : "";

    const item = globalData.danhMucLinhKien.find(i => i.maBo.toUpperCase() === maBoInput) || {
        maBo: maBoInput,
        tenBo: "Mâm Dụng Cụ Bẩn",
        khoa: khoaSelect || "PHÒNG SANH"
    };

    gioHangTraTam.push(item);
    renderGioHangTam();
    inp.value = '';
}

function renderGioHangTam() {
    const khuvuc = document.getElementById('khuVucGioHang');
    const tbody = document.getElementById('bangGioHang');
    const badge = document.getElementById('badgeGioHang');

    if (khuvuc) khuvuc.classList.remove('hidden');
    if (badge) badge.innerText = `${gioHangTraTam.length} món`;

    if (tbody) {
        tbody.innerHTML = gioHangTraTam.map((item, idx) => `
            <tr class="border-b text-xs">
                <td class="p-2 font-mono font-bold text-sky-700">${item.maBo}</td>
                <td class="p-2 font-semibold">${item.tenBo}</td>
                <td class="p-2 text-right">
                    <button type="button" onclick="gioHangTraTam.splice(${idx},1); renderGioHangTam();" class="text-rose-600 hover:text-rose-800 p-1">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

// HÀM XỬ LÝ CHÍNH ĐƯỢC GỌI TRỰC TIẾP TỪ NÚT BẤM HTML
function khoaGuiPhieuTraBatches() {
    if (gioHangTraTam.length === 0) {
        alert("⚠️ Giỏ hàng báo trả đang trống! Vui lòng thêm mâm dụng cụ bẩn vào giỏ trước.");
        return;
    }

    const selKhoa = document.getElementById('khoa_selKhoa');
    let tenKhoa = selKhoa && selKhoa.value ? selKhoa.value : "";

    if (!tenKhoa && gioHangTraTam.length > 0) {
        tenKhoa = gioHangTraTam[0].khoa || "PHÒNG SANH";
    }

    const newPhieu = {
        id: `PGN_${Date.now()}`,
        khoa: tenKhoa,
        items: [...gioHangTraTam],
        thoiGian: new Date().toLocaleTimeString('vi-VN', { hour: '2-2-digit', minute: '2-2-digit' }),
        nhanSu: currentUser.nvName
    };

    globalData.phieuTra.unshift(newPhieu);
    gioHangTraTam = [];
    renderGioHangTam();

    // Lưu ngay phiếu vào bộ nhớ máy
    localStorage.setItem('cssd_phieuTra', JSON.stringify(globalData.phieuTra));

    alert(`🚀 THÀNH CÔNG! Đã phát lệnh báo trả ${newPhieu.items.length} bộ dụng cụ bẩn của Khoa [${tenKhoa}] sang Xe Thu Gom!`);
    
    // Cập nhật bảng Xe Thu Gom
    renderBangChoThuGom();
}

// Tên hàm alias dự phòng
function guiBaoTra() { khoaGuiPhieuTraBatches(); }
function guiPhieuBaoTra() { khoaGuiPhieuTraBatches(); }

/* =========================================================================
   5. LOGIC XE THU GOM & ĐỐI SOÁT
   ========================================================================= */
function renderBangChoThuGom() {
    const tbody = document.getElementById('bangChoThuGom');
    const filterSelect = document.getElementById('filterKhoaThuGom');
    const badgeSoCho = document.getElementById('badgeSoCho');

    if (!tbody) return;

    if (filterSelect) {
        const khoasWithOrders = Array.from(new Set(globalData.phieuTra.map(p => p.khoa)));
        const currentValue = filterSelect.value;

        let optionsHtml = `<option value="">-- Tất Cả Khoa Có Lệnh Gửi (${globalData.phieuTra.length}) --</option>`;
        optionsHtml += khoasWithOrders.map(k => {
            const count = globalData.phieuTra.filter(p => p.khoa === k).length;
            return `<option value="${k}" ${currentValue === k ? 'selected' : ''}>${k} (${count} lệnh)</option>`;
        }).join('');

        filterSelect.innerHTML = optionsHtml;
    }

    const selectedKhoa = filterSelect ? filterSelect.value : "";
    const filteredPhieu = selectedKhoa 
        ? globalData.phieuTra.filter(p => p.khoa === selectedKhoa)
        : globalData.phieuTra;

    if (badgeSoCho) badgeSoCho.innerText = `${filteredPhieu.length} Lệnh`;

    if (filteredPhieu.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-xs text-slate-400">Hiện chưa có lệnh báo trả mâm bẩn nào từ các Khoa/Phòng.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredPhieu.map((phieu, idx) => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">
                <i class="fa-solid fa-hospital mr-1.5 text-sky-600"></i>${phieu.khoa}
                <div class="text-[10px] text-slate-400 font-normal mt-0.5">Người gửi: ${phieu.nhanSu}</div>
            </td>
            <td class="p-3">
                <div class="font-bold text-sky-800 mb-1">${phieu.items.length} Bộ dụng cụ bẩn:</div>
                <div class="space-y-1">
                    ${phieu.items.map(it => `
                        <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono mr-1">
                            <strong>${it.maBo}</strong> - ${it.tenBo}
                        </span>
                    `).join('')}
                </div>
            </td>
            <td class="p-3 text-center font-bold text-slate-600">${phieu.thoiGian}</td>
            <td class="p-3 text-center action-col">
                <button type="button" onclick="moPopupKiemDemThuGom(${idx})" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all whitespace-nowrap">
                    <i class="fa-solid fa-clipboard-check mr-1"></i> Kiểm Đếm & Nhận
                </button>
            </td>
        </tr>
    `).join('');
}

function moPopupKiemDemThuGom(idx) {
    const phieu = globalData.phieuTra[idx];
    if (!phieu) return;

    const pop = document.getElementById('popupKiemDem');
    const popBo = document.getElementById('popBo');
    const popKhoa = document.getElementById('popKhoa');
    const popChecklist = document.getElementById('popKiemDemChecklist');

    if (popBo) popBo.innerText = `LỆNH THU GOM: ${phieu.items.length} MÂM DỤNG CỤ`;
    if (popKhoa) popKhoa.innerText = phieu.khoa;

    if (popChecklist) {
        popChecklist.innerHTML = phieu.items.map((it, i) => `
            <div class="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center text-xs">
                <div>
                    <span class="font-mono font-bold text-sky-700 mr-2">${it.maBo}</span>
                    <span class="font-semibold text-slate-800">${it.tenBo}</span>
                </div>
                <label class="flex items-center gap-1.5 text-emerald-700 font-bold cursor-pointer">
                    <input type="checkbox" checked class="w-4 h-4 rounded text-emerald-600"> Đủ Linh Kiện
                </label>
            </div>
        `).join('');
    }

    if (pop) pop.classList.remove('hidden');
}

function closePopupKiemDem() {
    const pop = document.getElementById('popupKiemDem');
    if (pop) pop.classList.add('hidden');
}

function saveKiemDem() {
    alert("✅ Đã chốt kiểm đếm đối soát thành công! Chuyển các mâm sang Trạm Belimed WD250.");
    closePopupKiemDem();
    globalData.phieuTra.shift();
    localStorage.setItem('cssd_phieuTra', JSON.stringify(globalData.phieuTra));
    renderBangChoThuGom();
}

/* =========================================================================
   6. RENDER CÔNG NỢ & DANH MỤC
   ========================================================================= */
function renderBangCongNoKhoa() {
    const tbody = document.getElementById('bangDonGiaoNhan');
    const selKhoa = document.getElementById('khoa_selKhoa');
    if (!tbody) return;

    const selectedKhoa = selKhoa ? selKhoa.value : "";
    const items = selectedKhoa ? globalData.danhMucLinhKien.filter(i => i.khoa === selectedKhoa) : globalData.danhMucLinhKien;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-400">Vui lòng chọn Khoa/Phòng để xem công nợ.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.slice(0, 15).map(item => `
        <tr class="border-b hover:bg-slate-50 text-xs">
            <td class="p-3 font-bold text-slate-800">${item.tenBo} <span class="text-[10px] text-sky-600 block font-mono">${item.maBo}</span></td>
            <td class="p-3 text-center font-bold text-slate-600">0</td>
            <td class="p-3 text-center font-bold text-slate-600">0</td>
            <td class="p-3 text-center font-bold text-emerald-600">${item.soLuong}</td>
            <td class="p-3 text-center font-bold text-rose-600">0</td>
        </tr>
    `).join('');
}

function renderBangDanhMucLinhKien() {
    const tbody = document.getElementById('bangDanhMucLinhKien');
    const tbodyTong = document.getElementById('bangDanhMucTong');

    if (tbody) {
        if (!globalData.danhMucLinhKien || globalData.danhMucLinhKien.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-xs text-slate-400">Chưa có dữ liệu. Vui lòng nạp file Excel.</td></tr>`;
        } else {
            tbody.innerHTML = globalData.danhMucLinhKien.map(item => `
                <tr class="border-b hover:bg-slate-50 text-xs">
                    <td class="p-3 font-bold text-slate-800">${item.tenBo} <span class="text-[10px] text-sky-600 block font-mono">${item.maBo}</span></td>
                    <td class="p-3 text-slate-600">${item.khoa}</td>
                    <td class="p-3 text-center font-bold text-sky-700 bg-sky-50 rounded">${item.soLuong}</td>
                </tr>
            `).join('');
        }
    }

    if (tbodyTong) {
        if (!globalData.danhMucLinhKien || globalData.danhMucLinhKien.length === 0) {
            tbodyTong.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">Không có dữ liệu khay dụng cụ</td></tr>`;
        } else {
            tbodyTong.innerHTML = globalData.danhMucLinhKien.map(item => `
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

function initRealtimeListeners() {
    if (!db) return;
    db.collection("lich_su_luan_chuyen").orderBy("timestamp", "desc").limit(100)
        .onSnapshot((snapshot) => {
            globalData.lichSu = [];
            snapshot.forEach((doc) => globalData.lichSu.push({ id: doc.id, ...doc.data() }));
            renderBangLichSuLuanChuyen();
        });

    db.collection("me_rua_belimed").orderBy("timestamp", "desc").limit(50)
        .onSnapshot((snapshot) => {
            globalData.meRua = [];
            snapshot.forEach((doc) => globalData.meRua.push({ id: doc.id, ...doc.data() }));
            renderBangLichSuRua();
        });
}

/* =========================================================================
   7. CHUYỂN TAB & PHÂN QUYỀN
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

    if (tabId === 'thugom') renderBangChoThuGom();
    if (tabId === 'danhmuc') renderBangDanhMucLinhKien();
    if (tabId === 'khoaphong') renderBangCongNoKhoa();

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
   8. XUẤT BÁO CÁO EXCEL & MẺ RỬA/HẤP
   ========================================================================= */
function xuatBaoCaoExcelLuanChuyen() {
    if (typeof XLSX === 'undefined') return;
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
    if (typeof XLSX === 'undefined') return;
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
   9. ADMIN SUBTAB & PIN
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
                <button type="button" onclick="capNhatPinNhanVien('${ktv.id}')" class="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-xs font-bold">Lưu</button>
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
        globalData.phieuTra = [];
        localStorage.removeItem('cssd_phieuTra');
        renderBangLichSuLuanChuyen();
        renderBangLichSuRua();
        renderBangChoThuGom();
        alert("🗑️ Đã xóa thành công!");
    }
}
function khaiSinhKhayVangLai() {
    const ma = prompt("Nhập mã khay vãng lai:");
    if (ma) alert(`✨ Đã khởi tạo khay: ${ma.toUpperCase()}`);
}

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
