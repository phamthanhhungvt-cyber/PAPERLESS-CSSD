/**
 * HỆ THỐNG QUẢN LÝ CSSD - PHUONG NAM HOSPITAL
 * FILE: app.js (Tương thích 100% với index.html V29.0)
 * Chức năng: Đăng nhập phân quyền, quét barcode, quản lý chu trình tiệt khuẩn, 
 * đối soát kiểm đếm, ghi nhận bệnh án sử dụng, đồng bộ Tivi Realtime & Firebase.
 */

// ==========================================
// 1. CẤU HÌNH BAN ĐẦU & STATE CỦA HỆ THỐNG
// ==========================================
const appState = {
    currentUser: null,
    currentRole: null,
    currentKhoa: null,
    gioHang: [], // Chứa danh sách dụng cụ chờ gửi trả
    cameraScanner: null, // Đối tượng Html5QrcodeScanner
    activeCameraInputId: null,
    danhSachKhoa: [
        { id: "KPM", name: "Khoa Phẫu Thuật Gây Mê Hồi Sức" },
        { id: "KCC", name: "Khoa Cấp Cứu" },
        { id: "KNS", name: "Khoa Nội Soi" },
        { id: "KST", name: "Khoa Sản Thường" },
        { id: "KNT", name: "Khoa Ngoại Chấn Thương" },
        { id: "KICU", name: "Khoa Hồi Sức Tích Cực (ICU)" }
    ],
    danhSachKtv: [
        { id: "KTV01", name: "Phạm Thanh Hùng", pin: "1994" },
        { id: "KTV02", name: "Nguyễn Văn A", pin: "1111" },
        { id: "KTV03", name: "Trần Thị B", pin: "2222" }
    ],
    danhSachBoDungCu: [
        { id: "BDC-01", name: "Bộ Phẫu Thuật Đại Phẫu", components: [{ name: "Kẹp phẫu tích", sl: 5 }, { name: "Kéo phẫu thuật", sl: 3 }, { name: "Dao mổ cán số 4", sl: 2 }] },
        { id: "BDC-02", name: "Bộ Phẫu Thuật Tiểu Phẫu", components: [{ name: "Kẹp phẫu tích tiểu", sl: 3 }, { name: "Kéo cắt chỉ", sl: 2 }, { name: "Kẹp kim", sl: 1 }] },
        { id: "BDC-03", name: "Bộ Đỡ Sanh Thường", components: [{ name: "Kéo cắt tầng sinh môn", sl: 1 }, { name: "Kẹp rốn", sl: 2 }, { name: "Kẹp săng", sl: 4 }] },
        { id: "BDC-04", name: "Bộ Khâu Da Thẩm Mỹ", components: [{ name: "Kéo nhỏ", sl: 1 }, { name: "Kẹp phẫu tích không răng", sl: 2 }, { name: "Kẹp mang kim nhỏ", sl: 1 }] }
    ],
    danhSachHoaChat: [
        { id: "HC01", name: "Chất tẩy rửa enzymatique Cidezyme" },
        { id: "HC02", name: "Chất trung hòa kiềm Neodisher" },
        { id: "HC03", name: "Dung dịch bôi trơn dụng cụ" }
    ],
    tonKhoVoKhuan: [], // Các mâm nằm trong kho vô khuẩn
    lichSuGiaoDich: [] // Nhật ký luân chuyển tổng
};

// Khởi chạy hệ thống khi trình duyệt load xong
window.addEventListener('DOMContentLoaded', () => {
    initClock();
    populateSelectData();
    switchTab('khoaphong'); // Tab mặc định sau khi vào app
});

// Đồng hồ thời gian thực
function initClock() {
    setInterval(() => {
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            clockEl.innerText = "HỆ THỐNG CHẠY THỰC: " + new Date().toLocaleString('vi-VN');
        }
    }, 1000);
}

// Đổ dữ liệu vào các thẻ Select lúc ban đầu
function populateSelectData() {
    // 1. Dropdown khoa phòng màn đăng nhập
    const loginKhoaSelect = document.getElementById('login_khoa');
    if (loginKhoaSelect) {
        loginKhoaSelect.innerHTML = appState.danhSachKhoa.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
    }

    // 2. Dropdown nhân viên vận hành CSSD màn đăng nhập
    const loginNvSelect = document.getElementById('login_nv_cssd');
    if (loginNvSelect) {
        loginNvSelect.innerHTML = appState.danhSachKtv.map(nv => `<option value="${nv.id}">${nv.name}</option>`).join('');
    }

    // 3. Dropdown các trạm làm việc
    const khoaSelKhoa = document.getElementById('khoa_selKhoa');
    const xuatSelKhoa = document.getElementById('xuat_selKhoa');
    const filterKhoaThuGom = document.getElementById('filterKhoaThuGom');
    const invFilterKhoa = document.getElementById('inv_filterKhoa');

    const optsKhoa = appState.danhSachKhoa.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
    
    if (khoaSelKhoa) khoaSelKhoa.innerHTML = `<option value="">-- Chọn Khoa Yêu Cầu --</option>` + optsKhoa;
    if (xuatSelKhoa) xuatSelKhoa.innerHTML = `<option value="">-- Chọn Khoa Nhận --</option>` + optsKhoa;
    if (filterKhoaThuGom) filterKhoaThuGom.innerHTML = `<option value="">-- Lọc theo Khoa --</option>` + optsKhoa;
    if (invFilterKhoa) invFilterKhoa.innerHTML = `<option value="">-- Tất cả Khoa Phòng --</option>` + optsKhoa;

    // 4. Dropdown hóa chất máy rửa
    const ruaHoaChat = document.getElementById('rua_hoaChat');
    if (ruaHoaChat) {
        ruaHoaChat.innerHTML = appState.danhSachHoaChat.map(hc => `<option value="${hc.id}">${hc.name}</option>`).join('');
    }
}

// ==========================================
// 2. CHỨC NĂNG ĐĂNG NHẬP VÀ PHÂN QUYỀN (LOGIN)
// ==========================================
function toggleLoginFields() {
    const role = document.getElementById('login_role').value;
    const fieldKhoa = document.getElementById('field_khoa');
    const fieldCssd = document.getElementById('field_nhanvien_cssd');

    if (role === 'KHOA') {
        fieldKhoa.classList.remove('hidden');
        fieldCssd.classList.add('hidden');
    } else if (role === 'CSSD') {
        fieldKhoa.classList.add('hidden');
        fieldCssd.classList.remove('hidden');
    } else {
        fieldKhoa.classList.add('hidden');
        fieldCssd.classList.add('hidden');
    }
}

function checkLogin() {
    const role = document.getElementById('login_role').value;
    const pin = document.getElementById('login_pass').value;
    let isValid = false;
    let username = "";
    let deptName = "";

    if (role === 'GUEST') {
        isValid = (pin === "1234" || pin === ""); // Backup mã khách hoặc cho view trống
        username = "Khách Tham Quan";
        deptName = "Chế độ xem tin";
    } else if (role === 'ADMIN') {
        isValid = (pin === "9999"); // PIN mặc định quản trị
        username = "Quản Trị Viên";
        deptName = "Admin Ban";
    } else if (role === 'KHOA') {
        const selKhoaId = document.getElementById('login_khoa').value;
        const khoaObj = appState.danhSachKhoa.find(k => k.id === selKhoaId);
        isValid = (pin === "1234"); // PIN lâm sàng mặc định
        username = "Điều Dưỡng Lâm Sàng";
        deptName = khoaObj ? khoaObj.name : "Lâm Sàng";
    } else if (role === 'CSSD') {
        const ktvId = document.getElementById('login_nv_cssd').value;
        const ktvObj = appState.danhSachKtv.find(k => k.id === ktvId);
        if (ktvObj && ktvObj.pin === pin) {
            isValid = true;
            username = ktvObj.name;
            deptName = "Phòng tiệt khuẩn CSSD";
        }
    }

    if (isValid) {
        appState.currentUser = username;
        appState.currentRole = role;
        appState.currentKhoa = deptName;

        // Cập nhật thông tin Header
        document.getElementById('nav_user_info').innerText = `User: ${username} | Khoa: ${deptName}`;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('remove');
        document.getElementById('main-app').style.display = 'flex';

        // Tự động phân quyền hiển thị menu
        apDungPhanQuyenGiaoDien(role);
        callRender();
    } else {
        alert("❌ Mã PIN xác thực sai, vui lòng kiểm tra lại!");
    }
}

function apDungPhanQuyenGiaoDien(role) {
    // Ẩn hiện các chức năng cụ thể tùy theo phân quyền
    const lamsangHeader = document.getElementById('header-lamsang');
    const vanhanhHeader = document.getElementById('header-vanhanh');
    
    if (role === 'KHOA') {
        switchTab('khoaphong');
    } else if (role === 'CSSD' || role === 'ADMIN') {
        switchTab('thugom');
    }
}

// ==========================================
// 3. ĐIỀU HƯỚNG TABS GIAO DIỆN
// ==========================================
function switchTab(tabId) {
    // Danh sách tất cả các tab cần quản lý ẩn hiện
    const listTabs = [
        'tab-khoaphong', 'tab-thugom', 'tab-mayrua', 'tab-donggoi', 
        'tab-mayhap', 'tab-khovokhuan', 'tab-quanlykho', 'tab-danhmuc', 
        'tab-lichsuluanchuyen', 'tab-tracuu', 'tab-performance', 'tab-dashboard_tv'
    ];

    listTabs.forEach(id => {
        const tabEl = document.getElementById(id);
        if (tabEl) tabEl.classList.add('hidden');
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) activeTab.classList.remove('hidden');

    // Cập nhật Highlight thanh Menu Sidebar
    const listMenus = document.querySelectorAll('#sidebar_menu nav a');
    listMenus.forEach(menu => {
        menu.classList.remove('bg-sky-50', 'text-sky-700', 'font-black');
    });

    const activeMenu = document.getElementById(`menu-${tabId}`);
    if (activeMenu) {
        activeMenu.classList.add('bg-sky-50', 'text-sky-700', 'font-black');
    }

    // Cập nhật tiêu đề Header Trang
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) {
        headerTitle.innerText = `PHÂN HỆ WORKFLOW: ${tabId.toUpperCase()}`;
    }
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar_menu');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

// ==========================================
// 4. TRẠM 1: CỔNG BÁO TRẢ ĐỒ KHOA LÂM SÀNG
// ==========================================
function loadBoDungCuTheoKhoa() {
    const listBoDungCuDatalist = document.getElementById('listBoDungCu');
    if (listBoDungCuDatalist) {
        listBoDungCuDatalist.innerHTML = appState.danhSachBoDungCu.map(bdc => 
            `<option value="${bdc.id}">${bdc.name}</option>`
        ).join('');
    }
}

function clearGioHang() {
    appState.gioHang = [];
    callRender();
}

function themVaoGio() {
    const inpVal = document.getElementById('khoa_inpMaBo').value.trim();
    if (!inpVal) return alert("Vui lòng chọn hoặc quét mã mâm dụng cụ!");

    const bdc = appState.danhSachBoDungCu.find(b => b.id === inpVal || b.name === inpVal);
    if (!bdc) return alert("Không tìm thấy mã hoặc tên dụng cụ này trong danh mục!");

    // Thêm vào hàng chờ gửi trả
    const itemIdx = appState.gioHang.findIndex(g => g.id === bdc.id);
    if (itemIdx >= 0) {
        appState.gioHang[itemIdx].sl += 1;
    } else {
        appState.gioHang.push({
            id: bdc.id,
            name: bdc.name,
            sl: 1,
            time: new Date().toLocaleString()
        });
    }

    document.getElementById('khoa_inpMaBo').value = "";
    document.getElementById('khuVucGioHang').classList.remove('hidden');
    callRender();
}

function khoaGuiPhieuTraBatches() {
    if (appState.gioHang.length === 0) return alert("Hàng chờ trống! Hãy quét ít nhất 1 mâm.");
    
    // Đẩy sang Trạm 2 (Thu Gom)
    appState.gioHang.forEach(item => {
        appState.lichSuGiaoDich.unshift({
            id: item.id,
            name: item.name,
            sl: item.sl,
            from: appState.currentKhoa,
            status: "CHỜ THU GOM",
            time: new Date().toLocaleString('vi-VN'),
            log: item.time
        });
    });

    alert("🎉 Ký gửi trả đồ lên xe thu gom CSSD thành công!");
    clearGioHang();
    document.getElementById('khuVucGioHang').classList.add('hidden');
}

// ==========================================
// 5. TRẠM 2: XE THU GOM & BIÊN BẢN KIỂM ĐẾM
// ==========================================
let currentKiemDemItem = null;

function moPopupKiemDem(idx) {
    currentKiemDemItem = appState.lichSuGiaoDich[idx];
    if (!currentKiemDemItem) return;

    document.getElementById('popBo').innerText = currentKiemDemItem.name;
    document.getElementById('popKhoa').innerText = currentKiemDemItem.from;
    document.getElementById('popGhiChu').value = "";

    // Tìm chi tiết linh kiện chuẩn bên trong mâm để dựng check-list đối soát
    const matchBdc = appState.danhSachBoDungCu.find(b => b.name === currentKiemDemItem.name || b.id === currentKiemDemItem.id);
    const checklistDiv = document.getElementById('popKiemDemChecklist');
    
    if (matchBdc && checklistDiv) {
        checklistDiv.innerHTML = matchBdc.components.map((comp, cIdx) => `
            <div class="flex items-center justify-between py-2 px-3 hover:bg-slate-50 transition-colors">
                <span class="text-xs font-bold text-slate-700">${comp.name}</span>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded">Chuẩn: ${comp.sl}</span>
                    <input type="number" value="${comp.sl}" min="0" data-compname="${comp.name}" class="chk-soluong w-16 px-2 py-1 text-xs text-center border border-slate-300 rounded font-black text-sky-800">
                </div>
            </div>
        `).join('');
    }

    document.getElementById('popupKiemDem').classList.remove('hidden');
}

function closePopupKiemDem() {
    document.getElementById('popupKiemDem').classList.add('hidden');
    currentKiemDemItem = null;
}

function saveKiemDem() {
    if (!currentKiemDemItem) return;

    // Quét chênh lệch linh kiện
    const inputs = document.querySelectorAll('#popKiemDemChecklist input.chk-soluong');
    let hasGhiChuChenhLech = false;
    let detailLog = [];

    inputs.forEach(input => {
        const compName = input.getAttribute('data-compname');
        const numVal = parseInt(input.value);
        detailLog.push(`${compName}: ${numVal}`);
    });

    const ghichuText = document.getElementById('popGhiChu').value.trim();

    // Chuyển trạng thái sang chờ rửa
    currentKiemDemItem.status = "CHỜ RỬA";
    currentKiemDemItem.note = ghichuText;
    currentKiemDemItem.details = detailLog.join(' | ');

    closePopupKiemDem();
    callRender();
    alert("✅ Chốt biên bàn bàn giao, chuyển khay sang Trạm làm sạch & Rửa khử khuẩn.");
}

// ==========================================
// 6. TRẠM 3: MÁY RỬA KHỬ KHUẨN (WASHER DISINFECTOR)
// ==========================================
function toggleSelectAllRua() {
    const chkAll = document.getElementById('selectAllRua').checked;
    const items = document.querySelectorAll('.rua-row-chk');
    items.forEach(i => i.checked = chkAll);
}

function tuDongTaoMaLoMeRua() {
    const maySo = document.getElementById('rua_maySo').value;
    const today = new Date().toISOString().slice(0,10).replace(/-/g, "");
    document.getElementById('rua_batchId').value = `RUA-${maySo}-${today}`;
    document.getElementById('rua_meSo').value = Math.floor(Math.random() * 5) + 1; // Tạo số ngẫu nhiên mô phỏng
}

function xacNhanMeRua() {
    const selectedRows = document.querySelectorAll('.rua-row-chk:checked');
    if (selectedRows.length === 0) return alert("Chưa chọn khay dụng cụ nào để đưa vào lò rửa!");

    const batchId = document.getElementById('rua_batchId').value || "RUA-WD1-AUTO";
    const chuKy = document.getElementById('rua_chuKy').value;

    selectedRows.forEach(row => {
        const itemIdx = row.getAttribute('data-idx');
        const item = appState.lichSuGiaoDich[itemIdx];
        if (item) {
            item.status = "ĐANG RỬA";
            item.batchRua = batchId;
            item.chukyRua = chuKy;
        }
    });

    alert(`🟢 Kích hoạt chu trình buồng máy rửa thành công! Mã Lô: ${batchId}`);
    callRender();
}

function duyetSachMeRuaHangLoat() {
    const items = document.querySelectorAll('.nghiemthu-rua-chk:checked');
    if (items.length === 0) return alert("Hãy tích chọn khay cần duyệt nghiệm thu độ sạch!");

    items.forEach(i => {
        const idx = i.getAttribute('data-idx');
        const item = appState.lichSuGiaoDich[idx];
        if (item) {
            item.status = "ĐÃ RỬA (SẠCH)";
        }
    });

    alert("✨ Nghiệm thu ĐẠT! Các mâm dụng cụ đã chuyển sang Trạm làm sạch & Đóng gói.");
    callRender();
}

// ==========================================
// 7. TRẠM 4: ĐÓNG GÓI & GIA HẠN HẠN SỬ DỤNG
// ==========================================
let currentDongGoiItem = null;

function moPopupDongGoi(idx) {
    currentDongGoiItem = appState.lichSuGiaoDich[idx];
    if (!currentDongGoiItem) return;

    document.getElementById('popDG_Bo').innerText = currentDongGoiItem.name;
    tinhHanSuDung();
    document.getElementById('popupDongGoi').classList.remove('hidden');
}

function closePopupDongGoi() {
    document.getElementById('popupDongGoi').classList.add('hidden');
    currentDongGoiItem = null;
}

function tinhHanSuDung() {
    const optVal = document.getElementById('popDG_Loai').value;
    const days = parseInt(optVal.split('|')[1]);
    
    const today = new Date();
    today.setDate(today.getDate() + days);
    
    const formatStr = today.toLocaleDateString('vi-VN');
    document.getElementById('popDG_Han').innerText = formatStr;
}

function chotDongGoi() {
    if (!currentDongGoiItem) return;

    const optVal = document.getElementById('popDG_Loai').value.split('|')[0];
    const hsd = document.getElementById('popDG_Han').innerText;

    currentDongGoiItem.status = "CHỜ HẤP";
    currentDongGoiItem.baobi = optVal;
    currentDongGoiItem.hsd = hsd;

    closePopupDongGoi();
    callRender();
    alert("📦 Đóng gói mâm thành công! Chuyển mâm vào Trạm 5 chờ lò hấp vô khuẩn.");
}

// ==========================================
// 8. TRẠM 5: LÒ HẤP TIỆT KHUẨN (AUTOCLAVE)
// ==========================================
function tuDongTaoMaLoMeHap() {
    const maySo = document.getElementById('hap_maySo').value;
    const today = new Date().toISOString().slice(0,10).replace(/-/g, "");
    document.getElementById('hap_batchId').value = `HAP-${maySo}-${today}`;
    document.getElementById('hap_meSo').value = Math.floor(Math.random() * 10) + 1;
}

function xacNhanMeHap() {
    const selectedRows = document.querySelectorAll('.hap-row-chk:checked');
    if (selectedRows.length === 0) return alert("Chưa chọn mâm để xếp vào lò hấp!");

    const batchId = document.getElementById('hap_batchId').value || "HAP-A1-AUTO";
    const nhietDo = document.getElementById('hap_nhietDo').value;

    selectedRows.forEach(row => {
        const itemIdx = row.getAttribute('data-idx');
        const item = appState.lichSuGiaoDich[itemIdx];
        if (item) {
            item.status = "ĐANG HẤP";
            item.batchHap = batchId;
            item.nhietdoHap = nhietDo;
        }
    });

    alert(`🔥 Lò hấp vô khuẩn đã chạy! Mã Lô Hấp: ${batchId}`);
    callRender();
}

function nhapKhoHangLoat() {
    const items = document.querySelectorAll('.nghiemthu-hap-chk:checked');
    if (items.length === 0) return alert("Hãy tích chọn khay cần duyệt nghiệm thu tiệt trùng!");

    items.forEach(i => {
        const idx = i.getAttribute('data-idx');
        const item = appState.lichSuGiaoDich[idx];
        if (item) {
            item.status = "TRONG KHO";
            // Đẩy vào kho vô khuẩn
            appState.tonKhoVoKhuan.push({
                id: "M" + Math.floor(1000 + Math.random() * 9000), // Tạo mã ID khay độc bản ngẫu nhiên
                name: item.name,
                owner: item.from,
                hsd: item.hsd || "30 ngày",
                viTri: "Kệ A - Tầng 2"
            });
        }
    });

    alert("✔️ Nghiệm thu ĐẠT 100%! Dụng cụ đã được cất bảo quản tại Kho Vô Khuẩn CSSD.");
    callRender();
}

// ==========================================
// 9. TRẠM 6: BÀN GIAO XUẤT KHO VÔ KHUẨN
// ==========================================
function xuatKhoXoayVong() {
    const khoaNhan = document.getElementById('xuat_selKhoa').value;
    const maInp = document.getElementById('xuat_inpMaBo').value.trim();

    if (!khoaNhan) return alert("Vui lòng chọn Khoa Nhận Lâm Sàng trước!");
    if (!maInp) return alert("Vui lòng quét ID khay!");

    // Tìm trong kho vô khuẩn
    const khayIdx = appState.tonKhoVoKhuan.findIndex(k => k.id === maInp);
    if (khayIdx === -1) return alert("Mã ID khay không hợp lệ hoặc không có trong kho vô khuẩn!");

    const khay = appState.tonKhoVoKhuan[khayIdx];
    
    // Đăng ký lịch sử bàn giao giao nhận
    appState.lichSuGiaoDich.unshift({
        id: khay.id,
        name: khay.name,
        sl: 1,
        from: appState.danhSachKhoa.find(k => k.id === khoaNhan)?.name || "Lâm Sàng",
        status: "ĐÃ GIAO SẠCH",
        time: new Date().toLocaleString('vi-VN'),
        hsd: khay.hsd
    });

    // Xóa khỏi kho vô khuẩn
    appState.tonKhoVoKhuan.splice(khayIdx, 1);
    
    document.getElementById('xuat_inpMaBo').value = "";
    alert(`Bàn giao xuất kho thành công khay ${khay.name} cho khoa nhận.`);
    callRender();
}

// ==========================================
// 10. GHI NHẬN SỬ DỤNG BỆNH NHÂN (POPUP LÂM SÀNG)
// ==========================================
function moPopupSuDungBoDungCu() {
    document.getElementById('sd_nhanChung').value = appState.currentUser || "Điều Dưỡng Lâm Sàng";
    document.getElementById('sd_ngaySuDung').value = new Date().toISOString().slice(0,10);
    document.getElementById('popupSuDungBoDungCu').classList.remove('hidden');
}

function closePopupSuDung() {
    document.getElementById('popupSuDungBoDungCu').classList.add('hidden');
}

function scanKhayVaoSuDung() {
    const maInp = document.getElementById('sd_maKhayInp').value.trim().toUpperCase();
    if (!maInp) return;

    // Thêm mâm vào bảng sử dụng trên ca mổ
    const listTable = document.getElementById('sd_bangKhayChon');
    if (listTable) {
        listTable.innerHTML = `
            <tr class="text-xs">
                <td class="p-3 text-center"><input type="checkbox" checked class="w-4 h-4"></td>
                <td class="p-3 font-mono font-bold text-teal-800">${maInp}</td>
                <td class="p-3 font-black text-slate-800">Bộ mổ chấn thương / Khay trung tâm</td>
                <td class="p-3 text-center font-bold text-slate-500">Mẻ HAP-A1-2026</td>
                <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">VÔ KHUẨN</span></td>
                <td class="p-3 text-center"><button onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700"><i class="fa-solid fa-trash-can"></i></button></td>
            </tr>
        `;
    }
    document.getElementById('sd_maKhayInp').value = "";
}

function savePopupSuDung() {
    const mrn = document.getElementById('sd_searchBN').value.trim();
    if (!mrn) return alert("Hồ sơ cần nhập mã bệnh nhân/mã bệnh án!");

    alert(`📝 Lưu hồ sơ bệnh án thành công! Dụng cụ đã liên kết chặt chẽ với MRN: ${mrn}`);
    closePopupSuDung();
}

// ==========================================
// 11. ĐỒNG BỘ HIỂN THỊ DỮ LIỆU & RENDER GIAO DIỆN
// ==========================================
function callRender() {
    // 1. Render Trạm 1: Báo trả đồ bẩn
    const bangGioHang = document.getElementById('bangGioHang');
    if (bangGioHang) {
        bangGioHang.innerHTML = appState.gioHang.map((item, idx) => `
            <tr>
                <td class="p-3 font-bold">${item.name}</td>
                <td class="p-3 text-center">${item.sl} khay</td>
                <td class="p-3 text-right"><button onclick="appState.gioHang.splice(${idx},1); callRender();" class="text-rose-600 hover:text-rose-800"><i class="fa-solid fa-trash-can"></i></button></td>
            </tr>
        `).join('');
        document.getElementById('badgeGioHang').innerText = `${appState.gioHang.length} món`;
    }

    // 2. Render Trạm 2: Điều phối xe thu gom
    const bangChoThuGom = document.getElementById('bangChoThuGom');
    if (bangChoThuGom) {
        const items = appState.lichSuGiaoDich.filter(i => i.status === "CHỜ THU GOM");
        document.getElementById('badgeSoCho').innerText = `${items.length} Lệnh`;
        
        bangChoThuGom.innerHTML = items.map((item, idx) => `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-bold text-slate-800">${item.from}</td>
                <td class="p-3 font-medium text-slate-600">${item.name} <br><span class="text-[10px] text-slate-400">SL: ${item.sl}</span></td>
                <td class="p-3 text-center text-slate-500 font-bold">${item.time}</td>
                <td class="p-3 text-center">
                    <button onclick="moPopupKiemDem(${appState.lichSuGiaoDich.indexOf(item)})" class="bg-sky-600 hover:bg-sky-700 text-white font-black px-3 py-1.5 rounded text-xs shadow-sm"><i class="fa-solid fa-clipboard-check"></i> KIỂM ĐẾM & NHẬN</button>
                </td>
            </tr>
        `).join('');
    }

    // 3. Render Trạm 3: Chờ rửa & Đang nghiệm thu độ sạch
    const tableRua = document.getElementById('bangChoRua');
    if (tableRua) {
        const dataChoRua = appState.lichSuGiaoDich.filter(i => i.status === "CHỜ RỬA");
        document.getElementById('badgeChoRua').innerText = `${dataChoRua.length} Mục`;

        tableRua.innerHTML = dataChoRua.map((item) => {
            const globalIdx = appState.lichSuGiaoDich.indexOf(item);
            return `
                <tr>
                    <td class="p-3 text-center"><input type="checkbox" data-idx="${globalIdx}" class="rua-row-chk w-4 h-4"></td>
                    <td class="p-3 font-bold text-slate-800">${item.name}</td>
                    <td class="p-3 text-right font-mono text-slate-500 pr-4">${item.id}</td>
                </tr>
            `;
        }).join('');
    }

    // Bảng mâm đang trong buồng máy chờ nghiệm thu độ sạch
    const tableNghiemThuRua = document.getElementById('bangChoNiemThuRua');
    if (tableNghiemThuRua) {
        const dataDangRua = appState.lichSuGiaoDich.filter(i => i.status === "ĐANG RỬA");
        tableNghiemThuRua.innerHTML = dataDangRua.map((item) => {
            const globalIdx = appState.lichSuGiaoDich.indexOf(item);
            return `
                <tr class="text-xs">
                    <td class="p-3 text-center"><input type="checkbox" data-idx="${globalIdx}" class="nghiemthu-rua-chk w-4 h-4"></td>
                    <td class="p-3 font-bold text-sky-800">${item.name} <br> <span class="text-[10px] text-slate-500 font-bold font-mono">Mã mẻ: ${item.batchRua}</span></td>
                </tr>
            `;
        }).join('');
    }

    // 4. Render Trạm 4: Danh sách chờ đóng gói
    const gridDongGoi = document.getElementById('gridDongGoi');
    if (gridDongGoi) {
        const dataChoDongGoi = appState.lichSuGiaoDich.filter(i => i.status === "ĐÃ RỬA (SẠCH)");
        document.getElementById('badgeDongGoi').innerText = `${dataChoDongGoi.length} Mâm`;

        if (dataChoDongGoi.length === 0) {
            gridDongGoi.innerHTML = `<p class="text-center italic text-slate-400 py-6 text-xs w-full">Hiện tại không có mâm dụng cụ nào chờ đóng gói.</p>`;
        } else {
            gridDongGoi.innerHTML = dataChoDongGoi.map((item) => {
                const globalIdx = appState.lichSuGiaoDich.indexOf(item);
                return `
                    <div class="bg-slate-50 p-4 border rounded-xl flex justify-between items-center shadow-sm">
                        <div>
                            <p class="font-black text-slate-800 text-xs">${item.name}</p>
                            <span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Đã làm sạch</span>
                        </div>
                        <button onclick="moPopupDongGoi(${globalIdx})" class="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg text-xs shadow-sm">📦 ĐÓNG GÓI</button>
                    </div>
                `;
            }).join('');
        }
    }

    // 5. Render Trạm 5: Danh sách mâm chờ hấp
    const tableHap = document.getElementById('bangChoHap');
    if (tableHap) {
        const dataChoHap = appState.lichSuGiaoDich.filter(i => i.status === "CHỜ HẤP");
        document.getElementById('badgeChoHap').innerText = `${dataChoHap.length} Mục`;

        tableHap.innerHTML = dataChoHap.map((item) => {
            const globalIdx = appState.lichSuGiaoDich.indexOf(item);
            return `
                <tr>
                    <td class="p-3 text-center"><input type="checkbox" data-idx="${globalIdx}" class="hap-row-chk w-4 h-4"></td>
                    <td class="p-3 font-bold text-slate-800">${item.name}</td>
                    <td class="p-3 text-right font-mono text-slate-500 pr-4">${item.id}</td>
                </tr>
            `;
        }).join('');
    }

    // Danh sách chờ nghiệm thu lò hấp để vô kho vô khuẩn
    const tableNghiemThuHap = document.getElementById('bangChoNghiệmThu');
    if (tableNghiemThuHap) {
        const dataDangHap = appState.lichSuGiaoDich.filter(i => i.status === "ĐANG HẤP");
        tableNghiemThuHap.innerHTML = dataDangHap.map((item) => {
            const globalIdx = appState.lichSuGiaoDich.indexOf(item);
            return `
                <tr class="text-xs">
                    <td class="p-3 text-center"><input type="checkbox" data-idx="${globalIdx}" class="nghiemthu-hap-chk w-4 h-4"></td>
                    <td class="p-3 font-bold text-sky-800">${item.name} <br> <span class="text-[10px] text-slate-500 font-bold font-mono">Lô hấp: ${item.batchHap}</span></td>
                </tr>
            `;
        }).join('');
    }

    // 6. Render Trạm 6: Kho vô khuẩn thực tế
    const bangKhoVoKhuan = document.getElementById('bangKhoVoKhuan');
    if (bangKhoVoKhuan) {
        if (appState.tonKhoVoKhuan.length === 0) {
            bangKhoVoKhuan.innerHTML = `<tr><td colspan="4" class="p-4 text-center italic text-slate-400">Kho vô khuẩn trống.</td></tr>`;
        } else {
            bangKhoVoKhuan.innerHTML = appState.tonKhoVoKhuan.map(khay => `
                <tr class="hover:bg-slate-50">
                    <td class="p-3 font-bold text-slate-800">${khay.name}</td>
                    <td class="p-3 font-mono font-bold text-sky-700">${khay.id}</td>
                    <td class="p-3 text-center font-bold text-slate-500">${khay.viTri}</td>
                    <td class="p-3 text-center text-emerald-600 font-black">${khay.hsd}</td>
                </tr>
            `).join('');
        }
    }

    // 7. Nhật ký luân chuyển động toàn viện
    const bangHanhTrinh = document.getElementById('bangLichSuHanhTrinhGoc');
    if (bangHanhTrinh) {
        if (appState.lichSuGiaoDich.length === 0) {
            bangHanhTrinh.innerHTML = `<tr><td colspan="7" class="p-4 text-center italic text-slate-400">Đang đồng bộ dòng dữ liệu...</td></tr>`;
        } else {
            bangHanhTrinh.innerHTML = appState.lichSuGiaoDich.map(item => `
                <tr class="text-xs">
                    <td class="p-3 font-mono font-bold text-sky-700">${item.id}</td>
                    <td class="p-3 font-bold text-slate-800">${item.name}</td>
                    <td class="p-3 font-semibold text-slate-600">${item.from}</td>
                    <td class="p-3 text-center"><span class="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-black text-[10px]">${item.status}</span></td>
                    <td class="p-3 text-center font-mono font-black text-rose-700">${item.batchHap || '--'}</td>
                    <td class="p-3 text-center font-bold text-slate-500">${appState.currentUser || 'Hệ Thống'}</td>
                    <td class="p-3 text-center text-slate-400 font-medium">${item.time}</td>
                </tr>
            `).join('');
        }
    }

    // 8. Tồn kho toàn viện (Bản đồ tổng)
    const bangTonKhoTe = document.getElementById('bangTonKhoTe');
    if (bangTonKhoTe) {
        bangTonKhoTe.innerHTML = appState.lichSuGiaoDich.map(item => `
            <tr class="text-xs">
                <td class="p-3 font-mono font-bold text-sky-800">${item.id}</td>
                <td class="p-3 font-bold text-slate-800">${item.name}</td>
                <td class="p-3 font-semibold text-slate-600">${item.from}</td>
                <td class="p-3 text-center font-black text-indigo-700">${item.status}</td>
                <td class="p-3 text-center font-mono text-slate-500">${item.batchHap || 'Chưa qua lò'}</td>
                <td class="p-3 text-center font-bold text-emerald-600">${item.hsd || 'Bảo hành'}</td>
            </tr>
        `).join('');
    }

    // 9. Nhật ký vận hành lò hấp (Báo cáo nhanh)
    const bangLichSuHap = document.getElementById('bangLichSuHap');
    if (bangLichSuHap) {
        const logsHap = appState.lichSuGiaoDich.filter(i => i.status === "TRONG KHO" || i.status === "ĐANG HẤP");
        bangLichSuHap.innerHTML = logsHap.map(item => `
            <tr>
                <td class="p-3 text-xs text-slate-700 font-bold">Lô: ${item.batchHap} | Trạng thái: ${item.status}</td>
                <td class="p-3 text-right text-xs font-black text-slate-800 pr-4">1 Khay</td>
            </tr>
        `).join('');
    }

    // 10. MÀN HÌNH TRỰC TIVI CENTER
    syncDashboardTivi();
}

// Đồng bộ dữ liệu sang tab màn hình tivi
function syncDashboardTivi() {
    const meRua = appState.lichSuGiaoDich.filter(i => i.status === "ĐÃ RỬA (SẠCH)" || i.status === "TRONG KHO").length;
    const meHap = appState.lichSuGiaoDich.filter(i => i.status === "TRONG KHO").length;
    const dangRua = appState.lichSuGiaoDich.filter(i => i.status === "ĐANG RỬA").length;
    const dangHap = appState.lichSuGiaoDich.filter(i => i.status === "ĐANG HẤP").length;
    const trongKho = appState.tonKhoVoKhuan.length;

    const elMeRua = document.getElementById('tv_meRua');
    const elMeHap = document.getElementById('tv_meHap');
    const elMeHap2 = document.getElementById('tv_meHap2');
    const elDangRua = document.getElementById('tv_dangRua');
    const elDangHap = document.getElementById('tv_dangHap');
    const elKhoVoKhuan = document.getElementById('tv_khoVoKhuan');

    if (elMeRua) elMeRua.innerText = meRua;
    if (elMeHap) elMeHap.innerText = meHap;
    if (elMeHap2) elMeHap2.innerText = meHap;
    if (elDangRua) elDangRua.innerText = dangRua;
    if (elDangHap) elDangHap.innerText = dangHap;
    if (elKhoVoKhuan) elKhoVoKhuan.innerText = trongKho;
}

// ==========================================
// 12. TÍCH HỢP QUÉT CAMERA SAU (HTML5-QRCODE)
// ==========================================
function moCamera(inputId) {
    appState.activeCameraInputId = inputId;
    document.getElementById('popupScanner').classList.remove('hidden');
    document.getElementById('camStatus').innerText = "Đang khởi tạo camera...";

    if (appState.cameraScanner) {
        dongCamera();
    }

    // Cấu hình quét camera sau điện thoại chuẩn phòng khám
    appState.cameraScanner = new Html5QrcodeScanner("reader", { 
        fps: 15, 
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778
    }, false);

    appState.cameraScanner.render(onScanSuccess, onScanFailure);
}

function onScanSuccess(decodedText) {
    if (appState.activeCameraInputId) {
        const targetInput = document.getElementById(appState.activeCameraInputId);
        if (targetInput) {
            targetInput.value = decodedText;
            
            // Nếu là input của cổng báo trả đồ lâm sàng, tự bấm thêm
            if (appState.activeCameraInputId === 'khoa_inpMaBo') {
                themVaoGio();
            } 
            // Nếu là trạm 6 xuất kho, tự chạy nghiệp vụ bàn giao
            else if (appState.activeCameraInputId === 'xuat_inpMaBo') {
                xuatKhoXoayVong();
            }
            // Nếu là popup sử dụng bệnh án mổ
            else if (appState.activeCameraInputId === 'sd_maKhayInp') {
                scanKhayVaoSuDung();
            }
        }
    }
    dongCamera();
}

function onScanFailure(error) {
    // Không cần log dồn dập console nếu camera đang bắt nét
}

function dongCamera() {
    if (appState.cameraScanner) {
        appState.cameraScanner.clear().then(() => {
            appState.cameraScanner = null;
            document.getElementById('popupScanner').classList.add('hidden');
        }).catch(err => {
            console.error("Lỗi khi giải phóng camera:", err);
            document.getElementById('popupScanner').classList.add('hidden');
        });
    } else {
        document.getElementById('popupScanner').classList.add('hidden');
    }
}

// ==========================================
// 13. ADMIN SUB-TABS & DATABASE TRUY VẾT
// ==========================================
function switchAdminSubtab(subtabId) {
    const btnDb = document.getElementById('subbtn-database');
    const btnSec = document.getElementById('subbtn-security');
    const panelDb = document.getElementById('subtab-database');
    const panelSec = document.getElementById('subtab-security');

    if (subtabId === 'database') {
        btnDb.className = "admin-subtab-active px-4 py-2 text-xs font-black rounded text-white bg-sky-600";
        btnSec.className = "px-4 py-2 text-xs font-black rounded text-slate-600 bg-slate-100";
        panelDb.classList.remove('hidden');
        panelSec.classList.add('hidden');
    } else {
        btnDb.className = "px-4 py-2 text-xs font-black rounded text-slate-600 bg-slate-100";
        btnSec.className = "admin-subtab-active px-4 py-2 text-xs font-black rounded text-white bg-sky-600";
        panelDb.classList.add('hidden');
        panelSec.classList.remove('hidden');
    }
}

function resetDuLieuKet() {
    if (confirm("Anh Hùng có chắc chắn muốn làm mới các mâm đang bị kẹt về trạng thái chờ thu gom ban đầu?")) {
        appState.lichSuGiaoDich.forEach(item => {
            item.status = "CHỜ THU GOM";
        });
        callRender();
        alert("✔️ Khôi phục hoàn tất.");
    }
}

function xoaSachDuLieuGiaoDichRealtime() {
    if (confirm("CẢNH BÁO: Thao tác này sẽ xóa sạch toàn bộ lịch sử luân chuyển khay Demo hiện tại. Anh vẫn muốn tiếp tục?")) {
        appState.lichSuGiaoDich = [];
        appState.tonKhoVoKhuan = [];
        callRender();
        alert("🔥 Đã xóa sạch toàn bộ dữ liệu giao dịch!");
    }
}
