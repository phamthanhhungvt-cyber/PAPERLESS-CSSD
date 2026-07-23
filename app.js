// =========================================================================
// 1. KHỞI TẠO HỆ THỐNG & CẤU HÌNH BIẾN TOÀN CỤC (PN HOSPITAL)
// =========================================================================
const firebaseConfig = { 
    apiKey: "AIzaSyCxjdCTKHQlpm7SYbWCEws1HhcOaFp0LBA", 
    authDomain: "cssd-system-2878c.firebaseapp.com", 
    projectId: "cssd-system-2878c", 
    storageBucket: "cssd-system-2878c.firebasestorage.app", 
    messagingSenderId: "662377321937", 
    appId: "1:662377321937:web:001c092e10319547623cf0" 
};
firebase.initializeApp(firebaseConfig); 
const db = firebase.firestore();

let thongTinMatKhauAdmin = { adminPIN: "admin2026", cssdPIN: "cssd2026", guestPIN: "guest2026" };
let cauHinhGiaoDien = {
    "ADMIN": ['khoaphong','thugom','mayrua','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv','admin'],
    "CSSD": ['thugom','mayrua','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','dashboard_tv'], 
    "KHOA": ['khoaphong','quanlykho','lichsuluanchuyen','tracuu'], 
    "GUEST": ['quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv']
};

// Danh sách tất cả các ID Tab trong hệ thống
const ALL_SYSTEM_TABS = ['khoaphong','thugom','mayrua','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv','admin'];

let currentRole = "", loginUserCode = "";
let danhSachKhoa = [], listGiaoDich = [], gioHangTam = [], danhSachKtvCssd = [], databaseExcel = [];
let html5QrCode = null; let targetInputIdForScan = ""; let idDangDongGoi = null;
let activeTab = 'thugom'; let renderTimeout = null;
let duLieuAnhBiTamBase64 = ""; let maLoTruyVetToanCuc = ""; 
let gioHangXuatKho = []; let gioKhaySuDungTam = []; 
let currentKiemDemData = null;

// Biến hỗ trợ vẽ chữ ký điện tử
let canvasSignature = null;
let ctxSignature = null;
let isDrawingSignature = false;
let dsIdKhayChoKyNhan = [];

// Cấu hình máy hấp & máy rửa (Belimed WD250)
const cauHinhMayHap = { "Hấp hơi nước": ["A1", "A2", "A3", "A4"], "Hấp H2O2 (Plasma)": ["P1", "P2"], "Khử khuẩn EO": ["EO1", "EO2"] };
const cauHinhMayRua = {
    "Máy rửa khử khuẩn tự động": ["Belimed WD250"],
    "Máy rửa sóng siêu âm": ["US1"],
    "Bồn rửa thủ công": ["MAN1"]
};
const danhMucHoaChatRua = [
    { ten: "Cidezyme (Enzym phân hủy protein)", lieuLuong: "8 ml/L" },
    { ten: "Sekusept Active (Khử khuẩn mức độ cao)", lieuLuong: "10 ml/L" },
    { ten: "Smeg (Nước rửa trung tính chuyên dụng)", lieuLuong: "5 ml/L" },
    { ten: "Aniosyme DD1 (Làm sạch & khử trùng sơ bộ)", lieuLuong: "5 ml/L" }
];

function getTodayDateStr() { 
    const d = new Date(); 
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; 
}

function playSound(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (type === 'success') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.start(); osc.stop(ctx.currentTime + 0.15);
        } else {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(250, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
        }
    } catch(e) {}
}

// =========================================================================
// 2. REALTIME LISTENER (FIRESTORE SYNC)
// =========================================================================
db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").onSnapshot(doc => { 
    try {
        if (doc.exists) { 
            let res = doc.data(); 
            danhSachKhoa = res.danhSachKhoa || []; 
            danhSachKtvCssd = res.danhSachKtvCssd || []; 
            databaseExcel = res.databaseExcel || []; 
            if(res.thongTinMatKhauAdmin) thongTinMatKhauAdmin = Object.assign(thongTinMatKhauAdmin, res.thongTinMatKhauAdmin); 
            if(res.cauHinhGiaoDien) cauHinhGiaoDien = Object.assign(cauHinhGiaoDien, res.cauHinhGiaoDien);
        } 
        initSelects();
        if(activeTab === 'khoaphong') loadBoDungCuTheoKhoa(); 
        renderAdminInterface(); 
        if(currentRole) apDungPhanQuyenGiaoDien(currentRole);
        taiDanhMucLinhKienChuan();
        callRender();
    } catch(err) { console.error("Lỗi đồng bộ danh mục:", err); }
});

db.collection("phieuGiaoNhan").orderBy("id", "desc").limit(1000).onSnapshot(snap => { 
    listGiaoDich = []; 
    snap.forEach(doc => { let d = doc.data(); d.firestoreId = doc.id; listGiaoDich.push(d); }); 
    callRender();
});

function callRender() { clearTimeout(renderTimeout); renderTimeout = setTimeout(() => { renderTheoTabHienTai(); }, 100); }

// =========================================================================
// 3. XỬ LÝ ĐĂNG NHẬP & PHÂN QUYỀN HỆ THỐNG
// =========================================================================
function toggleLoginFields() {
    const r = document.getElementById("login_role").value;
    document.getElementById("field_khoa").classList.toggle("hidden", r !== "KHOA");
    document.getElementById("field_nhanvien_cssd").classList.toggle("hidden", r !== "CSSD");
}

function checkLogin() {
    const role = document.getElementById("login_role").value; 
    const pass = document.getElementById("login_pass").value; 
    let pA = thongTinMatKhauAdmin.adminPIN || "admin2026"; 
    let pC = thongTinMatKhauAdmin.cssdPIN || "cssd2026"; 
    let pG = thongTinMatKhauAdmin.guestPIN || "guest2026"; 
     
    if (role === "ADMIN" && pass === pA) { 
        currentRole = "ADMIN"; loginUserCode = "ADMIN"; document.getElementById("nav_user_info").innerText = "ADMINISTRATOR";
        document.getElementById("khoa_selKhoa").disabled = false; document.body.classList.remove('guest-mode');
        apDungPhanQuyenGiaoDien("ADMIN");
        switchTab('lichsuluanchuyen');
    } else if (role === "KHOA") { 
        const khoaSelect = document.getElementById("login_khoa").value; 
        let found = danhSachKhoa.find(x => x.ten === khoaSelect); 
        if (pass === (found ? found.pin : "123")) { 
            currentRole = "KHOA"; loginUserCode = khoaSelect; document.getElementById("nav_user_info").innerText = khoaSelect; 
            if (document.getElementById("khoa_selKhoa")) {
                document.getElementById("khoa_selKhoa").value = khoaSelect;
                document.getElementById("khoa_selKhoa").disabled = true;
            }
            document.body.classList.remove('guest-mode');
            apDungPhanQuyenGiaoDien("KHOA");
            switchTab('khoaphong');
        } else { return showToast("Sai mã PIN Khoa!", "error"); } 
    } else if (role === "CSSD") {
        const nvCode = document.getElementById("login_nv_cssd").value;
        if(!nvCode && pass === pC) { currentRole = "CSSD"; loginUserCode = "CSSD_CHUNG"; document.getElementById("nav_user_info").innerText = "CSSD GENERAL"; } 
        else if (nvCode) {
            let nv = danhSachKtvCssd.find(x => x.code === nvCode);
            if (nv && pass === nv.pin) { currentRole = "CSSD"; loginUserCode = nv.ten; document.getElementById("nav_user_info").innerText = `${nvCode} - ${nv.ten}`; }
            else { return showToast("Sai mã PIN của nhân viên này!", "error"); }
        } else { return showToast("Vui lòng chọn Nhân viên hoặc nhập PIN Backup!", "error"); }
        document.getElementById("khoa_selKhoa").disabled = false; document.body.classList.remove('guest-mode');
        apDungPhanQuyenGiaoDien("CSSD");
        let tabsDuocPhep = cauHinhGiaoDien["CSSD"] || [];
        if(tabsDuocPhep.includes('thugom')) switchTab('thugom');
        else if (tabsDuocPhep.length > 0) switchTab(tabsDuocPhep[0]);
    } else if (role === "GUEST") {
        if(pass === pG) {
            currentRole = "GUEST"; loginUserCode = "GUEST"; document.getElementById("nav_user_info").innerText = "KHÁCH THAM QUAN";
            document.body.classList.add('guest-mode'); 
            apDungPhanQuyenGiaoDien("GUEST");
            switchTab('quanlykho');
        } else { return showToast("Sai mã PIN Khách tham quan!", "error"); }
    } else { return showToast("Sai thông tin đăng nhập!", "error"); }
    document.getElementById("login-screen").classList.add("hidden"); document.getElementById("main-app").classList.remove("hidden");
}

function anTatCaHeadersVaMenus() {
    document.getElementById('header-lamsang')?.classList.add('hidden');
    document.getElementById('header-vanhanh')?.classList.add('hidden');
    document.getElementById('header-dulieu')?.classList.add('hidden');
    document.getElementById('header-hethong')?.classList.add('hidden');
    ALL_SYSTEM_TABS.forEach(x => {
        document.getElementById('menu-' + x)?.classList.add('hidden');
    });
}

function apDungPhanQuyenGiaoDien(role) {
    anTatCaHeadersVaMenus();
    if (role === "ADMIN") {
        ALL_SYSTEM_TABS.forEach(tab => {
            document.getElementById('menu-' + tab)?.classList.remove('hidden');
        });
        document.getElementById('header-lamsang')?.classList.remove('hidden');
        document.getElementById('header-vanhanh')?.classList.remove('hidden');
        document.getElementById('header-dulieu')?.classList.remove('hidden');
        document.getElementById('header-hethong')?.classList.remove('hidden');
        return;
    }
    let tabsDuocPhep = cauHinhGiaoDien[role] || [];
    tabsDuocPhep.forEach(tab => { document.getElementById('menu-' + tab)?.classList.remove('hidden'); });
    if (tabsDuocPhep.includes('khoaphong')) document.getElementById('header-lamsang')?.classList.remove('hidden');
    if (['thugom','mayrua','donggoi','mayhap','khovokhuan'].some(t => tabsDuocPhep.includes(t))) document.getElementById('header-vanhanh')?.classList.remove('hidden');
    if (['quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].some(t => tabsDuocPhep.includes(t))) document.getElementById('header-dulieu')?.classList.remove('hidden');
    if (tabsDuocPhep.includes('admin')) document.getElementById('header-hethong')?.classList.remove('hidden');
}

// =========================================================================
// CHUYỂN TAB & SỬA LỖI 2 THANH ACTIVE MÀU XANH
// =========================================================================
function switchTab(t) { 
    if (currentRole !== "ADMIN") {
        let tabsDuocPhep = cauHinhGiaoDien[currentRole] || [];
        if(!tabsDuocPhep.includes(t)) { return showToast("Tài khoản không có quyền truy cập!", "error"); }
    }
    
    // 1. Ẩn toàn bộ các khu vực nội dung màn hình Tab
    const allTabElements = document.querySelectorAll('[id^="tab-"]');
    allTabElements.forEach(tabEl => tabEl.classList.add('hidden'));

    // 2. Gỡ bỏ class 'sidebar-item-active' khỏi TẤT CẢ các nút Menu trên Sidebar
    const allMenuButtons = document.querySelectorAll('#sidebar_menu button, #sidebar_menu a');
    allMenuButtons.forEach(btn => btn.classList.remove('sidebar-item-active')); 

    // 3. Hiển thị đúng Tab nội dung được chọn
    const targetTabEl = document.getElementById('tab-' + t);
    if (targetTabEl) {
        targetTabEl.classList.remove('hidden');
    }

    // 4. Kích hoạt đúng 1 thanh active màu xanh cho nút Menu được chọn
    const targetMenuBtn = document.getElementById('menu-' + t);
    if (targetMenuBtn) {
        targetMenuBtn.classList.add('sidebar-item-active');
    }

    activeTab = t; 
    if (t === 'mayrua') { setTimeout(() => { capNhatDanhSachMaMayRua(); }, 50); }
    if (t === 'mayhap') { setTimeout(() => { tuDongTaoMaLoMeHap(); }, 50); }
    callRender(); 
}

// =========================================================================
// 4. TRẠM 1: CỔNG LÂM SÀNG & HÀNH ĐỘNG ĐỘC LẬP (TRẢ ĐỒ BẨN / YÊU CẦU ĐỒ SẠCH)
// =========================================================================
function loadBoDungCuTheoKhoa() { 
    let k = currentRole === "KHOA" ? loginUserCode : document.getElementById("khoa_selKhoa").value; 
    let list = document.getElementById("listBoDungCu"); 
    if(!list) return; list.innerHTML = ""; 
    let f = danhSachKhoa.find(x => (x.ten || "").toString().trim().toUpperCase() === (k || "").toString().trim().toUpperCase()); 
    if (f && f.danhSachBo) {
        let htmlOptions = "";
        f.danhSachBo.forEach(x => {
            if (x) {
                let chuoiX = String(x);
                let tenBoThuanTuy = chuoiX.includes(" [ID:") ? chuoiX.split(" [ID:")[0] : chuoiX;
                htmlOptions += `<option value="${chuoiX}"><option value="${tenBoThuanTuy}">`;
            }
        });
        list.innerHTML = htmlOptions; 
    }
}

function themVaoGio() { 
    let val = document.getElementById("khoa_inpMaBo").value.trim().toUpperCase(); if(!val) return; 
    if (gioHangTam.some(x => x.maMacDinh === val)) { document.getElementById("khoa_inpMaBo").value = ""; return showToast("Mã này đã có trong danh sách chờ!", "error"); } 
    let tenGoc = val.includes("[ID:") ? val.split(" [ID:")[0] : val; 
    gioHangTam.push({bo: tenGoc, maMacDinh: val, slYeuCau: 1}); 
    document.getElementById("khoa_inpMaBo").value = ""; 
    renderGioHang(); 
}

function renderGioHang() { 
    let khuVuc = document.getElementById("khuVucGioHang"); if(khuVuc) khuVuc.classList.toggle("hidden", gioHangTam.length===0); 
    let bHang = document.getElementById("bangGioHang");
    if(bHang) {
        bHang.innerHTML = gioHangTam.map(i => `<tr><td class="p-2.5 font-bold text-sky-700 text-[11px]">${i.bo}</td></tr>`).join(''); 
    }
    let badge = document.getElementById("badgeGioHang");
    if(badge) badge.innerText = `${gioHangTam.length} món`;
}

function khoaGuiPhieuTraBatches() { 
    const k = currentRole === "KHOA" ? loginUserCode : document.getElementById("khoa_selKhoa").value; 
    if(!k) return showToast("Vui lòng chọn Khoa trước!"); 
    if(gioHangTam.length === 0) return showToast("Vui lòng quét hoặc chọn mâm bẩn muốn trả trước!", "error"); 
     
    let p=[]; 
    gioHangTam.forEach((i, idx) => {
        p.push(
            db.collection("phieuGiaoNhan").add({ 
                id: Date.now() + idx, 
                ngayTao: getTodayDateStr(), 
                time: new Date().toLocaleTimeString('vi-VN'), 
                khoa: k, 
                bo: i.bo, 
                maMacDinh: i.maMacDinh, 
                slYeuCau: 1, 
                slThucTe: 1, 
                status: "CHO_THU" 
            })
        );
    }); 
     
    Promise.all(p).then(() => { 
        clearGioHang(); 
        playSound('success');
        showToast("Đã gửi lệnh báo trả đồ bẩn về CSSD!", "success"); 
        callRender(); 
    }); 
}

function khoaGuiYeuCauCapPhat() {
    const k = currentRole === "KHOA" ? loginUserCode : document.getElementById("khoa_selKhoa").value;
    if(!k) return showToast("Vui lòng chọn Khoa/Phòng gửi yêu cầu!", "error");
    
    const tenBoChon = document.getElementById("khoa_inpMaBo")?.value.trim().toUpperCase();
    if(!tenBoChon) return showToast("Vui lòng chọn hoặc nhập tên mâm cần cấp mới!", "error");
    
    let tenMâmSạch = tenBoChon.split(" [ID:")[0];
    
    db.collection("phieuGiaoNhan").add({
        id: Date.now(),
        ngayTao: getTodayDateStr(),
        time: new Date().toLocaleTimeString('vi-VN'),
        khoa: k,
        bo: tenMâmSạch,
        maMacDinh: "CHO_CAP_PHAT", 
        slYeuCau: 1,
        status: "CHO_CAP_PHAT", 
        nvYeuCau: loginUserCode || "Điều dưỡng khoa"
    }).then(() => {
        playSound('success');
        showToast(`Đã gửi yêu cầu cấp phát mâm ${tenMâmSạch} thành công!`, "success");
        if(document.getElementById("khoa_inpMaBo")) document.getElementById("khoa_inpMaBo").value = "";
        callRender();
    });
}

// =========================================================================
// 5. TRẠM 2: XE THU GOM & KIỂM ĐẾM CHI TIẾT LINH KIỆN
// =========================================================================
function moPopupKiemDem(id) { 
    let item = listGiaoDich.find(x => x.firestoreId === id); 
    if(!item) return showToast("Không tìm thấy thông tin dòng chỉ định!", "error");

    currentKiemDemData = {
        id: id,
        tenBoDungCu: item.bo ? String(item.bo).split(" [ID:")[0] : "Chưa rõ mâm",
        khoaYeuCau: item.khoa || "Chưa rõ khoa",
        ghiChuLamSang: item.ghiChu || ""
    }; 

    document.getElementById('popBo').innerText = currentKiemDemData.tenBoDungCu;
    document.getElementById('popKhoa').innerText = currentKiemDemData.khoaYeuCau;
    document.getElementById('popGhiChu').value = currentKiemDemData.ghiChuLamSang;
    document.getElementById('popGhiChu').classList.remove('border-rose-500', 'ring-2', 'ring-rose-200');

    let itemsInBo = databaseExcel.filter(x => { 
        let boName = x['Tên TS (i)'] || x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || x['NAME'] || x['name']; 
        return String(boName).trim().toUpperCase() === String(currentKiemDemData.tenBoDungCu).trim().toUpperCase(); 
    });

    let checklistSoBo = [];
    if(itemsInBo.length > 0) {
        checklistSoBo = itemsInBo.map(ct => {
            let tenDc = ct['Tên TS chuẩn'] || ct['Tên Dụng Cụ Chi Tiết'] || ct['Tên dụng cụ chi tiết'] || ct['Tên dụng cụ'] || ct['Chi tiết'] || ct['Dụng cụ'] || ct['Tên Chi Tiết'] || ct['NAME'] || "Dụng cụ";
             
            if (String(tenDc).trim().toUpperCase() === "NGUYÊN BỘ CẤU HÌNH CƠ SỐ") {
                tenDc = "Dụng cụ chuẩn mâm";
            }
             
            let sl = parseInt(ct['Số lượng'] || ct['SL'] || ct['Số Lượng'] || 1) || 0;
            return { ten: tenDc, slChuan: sl, slThuc: sl, tinhTrang: "ĐỦ" };
        }).filter(line => line.slChuan > 0); 
    } else {
        checklistSoBo = [{ ten: "Dụng cụ nguyên bộ (Chưa phân rã cấu hình)", slChuan: 1, slThuc: 1, tinhTrang: "ĐỦ" }];
    }

    currentKiemDemData.linhKienKiemDem = checklistSoBo;
    renderChecklistLinhKien();
    document.getElementById('popupKiemDem').classList.remove('hidden'); 
}

function renderChecklistLinhKien() {
    const container = document.getElementById('popKiemDemChecklist');
    if(!container) return; container.innerHTML = ""; 

    currentKiemDemData.linhKienKiemDem.forEach((item, index) => {
        let bgBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (item.tinhTrang === "THIẾU") bgBadge = "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
        if (item.tinhTrang === "HỎNG") bgBadge = "bg-amber-50 text-amber-700 border-amber-200";

        const row = document.createElement('div');
        row.className = "flex items-center justify-between py-3 px-2 transition-all hover:bg-slate-50";
        row.innerHTML = `
            <div class="flex-1 pr-2">
                <p class="text-xs font-bold text-slate-700">${item.ten}</p>
                <p class="text-[10px] text-slate-400 font-medium mt-0.5">Cơ số chuẩn: <span class="font-bold text-slate-600">${item.slChuan}</span></p>
            </div>
            <div class="flex items-center gap-3 mr-4">
                <button type="button" onclick="thayDoiSoLuongLinhKien(${index}, -1)" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-black flex items-center justify-center text-xs transition-colors">-</button>
                <span class="w-6 text-center text-xs font-black text-slate-800">${item.slThuc}</span>
                <button type="button" onclick="thayDoiSoLuongLinhKien(${index}, 1)" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-black flex items-center justify-center text-xs transition-colors">+</button>
            </div>
            <div>
                <select onchange="thayDoiTinhTrangLinhKien(${index}, this.value)" class="text-[11px] font-black border rounded-lg px-2 py-1.5 shadow-sm transition-all ${bgBadge}">
                    <option value="ĐỦ" ${item.tinhTrang === 'ĐỦ' ? 'selected' : ''}>🟢 Đủ đồ</option>
                    <option value="THIẾU" ${item.tinhTrang === 'THIẾU' ? 'selected' : ''}>🔴 Thiếu đồ</option>
                    <option value="HỎNG" ${item.tinhTrang === 'HỎNG' ? 'selected' : ''}>🟡 Hỏng đồ</option>
                </select>
            </div>
        `;
        container.appendChild(row);
    });
}

function thayDoiSoLuongLinhKien(index, thayDoi) {
    const item = currentKiemDemData.linhKienKiemDem[index];
    const targetSl = item.slThuc + thayDoi;
    if (targetSl >= 0 && targetSl <= item.slChuan * 2) {
        item.slThuc = targetSl;
        if (item.slThuc < item.slChuan) { item.tinhTrang = "THIẾU"; } 
        else if (item.slThuc === item.slChuan) { item.tinhTrang = "ĐỦ"; }
        renderChecklistLinhKien();
    }
}

function thayDoiTinhTrangLinhKien(index, value) {
    currentKiemDemData.linhKienKiemDem[index].tinhTrang = value;
    if (value === "THIẾU" && currentKiemDemData.linhKienKiemDem[index].slThuc === currentKiemDemData.linhKienKiemDem[index].slChuan) {
        currentKiemDemData.linhKienKiemDem[index].slThuc = Math.max(0, currentKiemDemData.linhKienKiemDem[index].slChuan - 1);
    } else if (value === "ĐỦ") {
        currentKiemDemData.linhKienKiemDem[index].slThuc = currentKiemDemData.linhKienKiemDem[index].slChuan;
    }
    renderChecklistLinhKien();
}

function closePopupKiemDem() { document.getElementById("popupKiemDem").classList.add("hidden"); currentKiemDemData = null; }

async function saveKiemDem() { 
    if(!currentKiemDemData) return; 
    const ghiChuValue = document.getElementById("popGhiChu").value.trim();
    let coSuCoChenhLech = false;
    currentKiemDemData.linhKienKiemDem.forEach(item => {
        let thuc = Number(item.slThuc) || 0;
        let chuan = Number(item.slChuan) || 0;
        if (item.tinhTrang === "THIẾU" || item.tinhTrang === "HỎNG" || thuc < chuan) { coSuCoChenhLech = true; }
    });

    if (coSuCoChenhLech && ghiChuValue === "") {
        playSound('error');
        alert("⚠️ PHÁT HIỆN SỰ CỐ CHÊNH LỆCH LINH KIỆN!\nAnh/Chị bắt buộc phải nhập lý do chênh lệch hoặc số biên bản sự cố trước khi 'Chốt và Chuyển Rửa'.");
        document.getElementById('popGhiChu').focus();
        document.getElementById('popGhiChu').classList.add('border-rose-500', 'ring-2', 'ring-rose-200');
        return;
    }

    try {
        await db.collection("phieuGiaoNhan").doc(currentKiemDemData.id).update({ 
            status: "DANG_RUA", ghiChu: ghiChuValue,
            ktvThuGom: loginUserCode || "CSSD_CHUNG",
            thoiGianDoiSoat: new Date().toLocaleTimeString('vi-VN'),
            coSuCoChenhLech: coSuCoChenhLech,
            chiTietChecklistLinhKien: currentKiemDemData.linhKienKiemDem
        });
        showToast("Đã đối soát xong! Mâm đồ đã chuyển sang Trạm Rửa.", "success"); 
        closePopupKiemDem(); callRender(); 
    } catch(err) { showToast("Lỗi kết nối Firebase nội bộ!", "error"); }
}

function clearGioHang() { gioHangTam = []; renderGioHang(); }

// =========================================================================
// 6. MODULE: QUẢN LÝ MẺ RỬA KHỬ KHUẨN (BELIMED WD250)
// =========================================================================
function toggleSelectAllRua() { let checked = document.getElementById('selectAllRua').checked; document.querySelectorAll('.rua-checkbox').forEach(cb => cb.checked = checked); }
function toggleSelectAllNghiemThuRua() { let checked = document.getElementById('selectAllNghiemThuRua').checked; document.querySelectorAll('.nghiemthurua-checkbox').forEach(cb => cb.checked = checked); }

function capNhatDanhSachMaMayRua() {
    const loaiRua = document.getElementById("rua_loaiRua")?.value;
    const selectMay = document.getElementById("rua_maySo");
    if (!selectMay || !loaiRua) return;
    selectMay.innerHTML = "";
    if (cauHinhMayRua[loaiRua]) {
        cauHinhMayRua[loaiRua].forEach(may => {
            selectMay.innerHTML += `<option value="${may}">${may}</option>`;
        });
    }
    tuDongTaoMaLoMeRua();
}

function tuDongTaoMaLoMeRua() {
    const maMay = document.getElementById("rua_maySo")?.value || "Belimed WD250";
    const maMayVietTat = (maMay === "Belimed WD250") ? "BL" : maMay;
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const ngayChuoi = `${yy}${mm}${dd}`;

    let cacMeTrongNgay = listGiaoDich.filter(x => x.rua_batchCode && x.rua_batchCode.startsWith(maMayVietTat + ngayChuoi));
    let soMeMax = 0;
    cacMeTrongNgay.forEach(x => {
        let phanDuoi = x.rua_batchCode.split("_")[1];
        if (phanDuoi) {
            let num = parseInt(phanDuoi);
            if (num > soMeMax) soMeMax = num;
        }
    });
    let meTiepTheo = soMeMax + 1;
    const chuoiMe = String(meTiepTheo).padStart(2, '0');
    const batchIdHoanChinh = `${maMayVietTat}${ngayChuoi}_${chuoiMe}`;

    if (document.getElementById("rua_meSo")) document.getElementById("rua_meSo").value = chuoiMe;
    if (document.getElementById("rua_batchId")) document.getElementById("rua_batchId").value = batchIdHoanChinh;
}

function xacNhanMeRua() {
    let checkboxes = document.querySelectorAll('.rua-checkbox:checked');
    if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm dụng cụ bẩn để xếp vào máy!", "error");
    
    let loaiRua = document.getElementById("rua_loaiRua").value;
    let maMay = document.getElementById("rua_maySo").value;
    let batchCode = document.getElementById("rua_batchId").value;
    let chuKy = document.getElementById("rua_chuKy").value;
    let hoaChat = document.getElementById("rua_hoaChat").value;
    let lieuLuong = document.getElementById("rua_lieuLuong").value || "Theo chuẩn";
    const ngayHomNay = getTodayDateStr();

    let p = [];
    checkboxes.forEach(cb => {
        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({
                status: "TRONG_BUONG_RUA",
                rua_batchCode: batchCode,
                rua_ngayRua: ngayHomNay,
                rua_mayRua: maMay,
                rua_chuKy: chuKy,
                rua_hoaChat: hoaChat,
                rua_lieuLuong: lieuLuong,
                rua_timeBatDau: new Date().toLocaleTimeString('vi-VN')
            })
        );
    });
    Promise.all(p).then(() => {
        playSound('success');
        showToast(`Bắt đầu chạy mẻ máy rửa: ${batchCode}`, "success");
        tuDongTaoMaLoMeRua();
        callRender();
    });
}

function duyetSachMeRuaHangLoat() {
    let checkboxes = document.querySelectorAll('.nghiemthurua-checkbox:checked');
    if(checkboxes.length === 0) return showToast("Chọn mâm đã rửa sạch để nghiệm thu!", "error");
    
    let ketQuaTest = document.getElementById("rua_testDoSach").value;
    let p = [];
    checkboxes.forEach(cb => {
        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({
                status: "CHO_DONG_GOI",
                rua_ketQuaTestSach: ketQuaTest,
                rua_timeKetThuc: new Date().toLocaleTimeString('vi-VN')
            })
        );
    });
    Promise.all(p).then(() => {
        playSound('success');
        showToast("Xác nhận nghiệm thu đạt chất lượng làm sạch!", "success");
        callRender();
    });
}

function tuChoiMeRuaHangLoat() {
    let checkboxes = document.querySelectorAll('.nghiemthurua-checkbox:checked');
    if(checkboxes.length === 0) return showToast("Chọn mâm không đạt!", "error");
    
    let p = [];
    checkboxes.forEach(cb => {
        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({
                status: "DANG_RUA",
                rua_batchCode: firebase.firestore.FieldValue.delete(),
                ghiChu: "Làm sạch chưa đạt, yêu cầu rửa lại."
            })
        );
    });
    Promise.all(p).then(() => {
        playSound('error');
        showToast("Đã trả các mâm không đạt về hàng đợi chờ rửa lại!", "error");
        callRender();
    });
}

// =========================================================================
// 7. TRẠM 4: LÀM SẠCH VÀ ĐÓNG GÓI
// =========================================================================
function moPopupDongGoi(id) { idDangDongGoi = id; let item = listGiaoDich.find(x => x.firestoreId === id); if(item) { document.getElementById("popDG_Bo").innerText = item.bo; tinhHanSuDung(); document.getElementById("popupDongGoi").classList.remove("hidden"); } }
function closePopupDongGoi() { document.getElementById("popupDongGoi").classList.add("hidden"); }
function tinhHanSuDung() { let val = document.getElementById("popDG_Loai").value.split("|"); let days = parseInt(val[1]); let dateHSD = new Date(); dateHSD.setDate(dateHSD.getDate() + days); let p = document.getElementById("popDG_Han"); p.innerText = dateHSD.toLocaleDateString('vi-VN'); p.dataset.dateDB = dateHSD.toISOString().split('T')[0]; }
function chotDongGoi() { if(!idDangDongGoi) return; let chatLieuTen = document.getElementById("popDG_Loai").value.split("|")[0]; db.collection("phieuGiaoNhan").doc(idDangDongGoi).update({ status: "CHO_HAP", chatLieu: chatLieuTen, hsd: document.getElementById("popDG_Han").dataset.dateDB }).then(() => { showToast("Đã đóng gói, chuyển chờ hấp!", "success"); closePopupDongGoi(); callRender(); }); }

// =========================================================================
// 8. TRẠM 5: VẬN HÀNH MẺ HẤP & DUYỆT NHẬP KHO VÔ KHUẨN
// =========================================================================
function toggleSelectAllHap() { let checked = document.getElementById('selectAllHap').checked; document.querySelectorAll('.hap-checkbox').forEach(cb => cb.checked = checked); }
function capNhatDanhSachMaMay() { const loaiHap = document.getElementById("hap_loaiHap")?.value; const selectMay = document.getElementById("hap_maySo"); if (!selectMay || !loaiHap) return; selectMay.innerHTML = ""; if (cauHinhMayHap[loaiHap]) { cauHinhMayHap[loaiHap].forEach(may => { selectMay.innerHTML += `<option value="${may}">${may}</option>`; }); } tuDongTaoMaLoMeHap(); }

function tuDongTaoMaLoMeHap() {
    const maMay = document.getElementById("hap_maySo")?.value || "A1"; const now = new Date(); const yy = String(now.getFullYear()).slice(-2); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0'); const ngayChuoi = `${yy}${mm}${dd}`;
    let cacMeTrongNgay = listGiaoDich.filter(x => x.batchCode && x.batchCode.startsWith(maMay + ngayChuoi)); let soMeMax = 0;
    cacMeTrongNgay.forEach(x => { let phanDuoi = x.batchCode.split("_")[1]; if (phanDuoi) { let num = parseInt(phanDuoi); if (num > soMeMax) soMeMax = num; } });
    let meTiepTheo = soMeMax + 1; if (meTiepTheo > 99) meTiepTheo = 1; const chuoiMe = String(meTiepTheo).padStart(2, '0'); const soLanDone = `${ngayChuoi}_${chuoiMe}`; const batchIdHoanChinh = `${maMay}${soLanDone}`;
    if (document.getElementById("hap_meSo")) document.getElementById("hap_meSo").value = chuoiMe;
    if (document.getElementById("hap_batchId")) document.getElementById("hap_batchId").value = batchIdHoanChinh;
}

function xacNhanMeHap() { 
    let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); 
    if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!", "error"); 
    
    let loaiHap = document.getElementById("hap_loaiHap").value; 
    let maMay = document.getElementById("hap_maySo").value; 
    let batchCode = document.getElementById("hap_batchId").value; 
    let chuKyNhiet = document.getElementById("hap_nhietDo").value; 
    let apSuat = document.getElementById("hap_apSuat").value || "N/A"; 
    let coKemBI = document.getElementById("hap_hasBI") ? document.getElementById("hap_hasBI").checked : false;
    const ngayHomNay = getTodayDateStr(); 
    let bayGio = new Date(); 
    let thoiGianDuKienXong = new Date(bayGio.getTime() + 45 * 60 * 1000);

    let p = []; 
    checkboxes.forEach(cb => { 
        if(cb.id === 'selectAllHap') return; 
        
        let thongTinLo = { 
            loaiHap: loaiHap, 
            maMay: maMay, 
            chuKyNhiet: chuKyNhiet, 
            apSuat: apSuat, 
            thoiGianBatDau: bayGio.toLocaleTimeString('vi-VN'), 
            giamSatChatLuong: { 
                chiThiHoaHoc: "ĐẠT", 
                laMeTestSinhHocGoc: coKemBI, 
                ketQuaSinhHoc: coKemBI ? "ĐANG CHỜ MÁY Ủ ĐỌC BI (20 PHÚT)" : "KẾ THỪA ĐẦU NGÀY" 
            } 
        };
        
        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({ 
                status: "DANG_HAP", 
                batchCode: batchCode, 
                ngayHapRealtime: ngayHomNay, 
                hasBI: coKemBI, 
                thoiGianKetThucChuTrinh: thoiGianDuKienXong.toISOString(), 
                thongTinLoHap: thongTinLo 
            })
        ); 
    }); 

    Promise.all(p).then(() => { 
        playSound('success');
        showToast(`Kích hoạt lò thành công! Lô: ${batchCode}`, "success"); 
        if(document.getElementById("hap_hasBI")) document.getElementById("hap_hasBI").checked = false; 
        duLieuAnhBiTamBase64 = ""; 
        const fileInp = document.getElementById("input_anhBI"); 
        if(fileInp) fileInp.value = ""; 
        tuDongTaoMaLoMeHap(); 
        callRender(); 
    }).catch(err => {
        showToast("Lỗi khi cập nhật mẻ hấp: " + err.message, "error");
    }); 
}

function toggleSelectAllNghiemThu() { let checked = document.getElementById('selectAllNghiemThu').checked; document.querySelectorAll('.nghiemthu-checkbox').forEach(cb => cb.checked = checked); }

function kiemTraQuyenDuyetMeHap() {
    const nutDuyetDat = document.querySelector("button[onclick='nhapKhoHangLoat()']"); if (!nutDuyetDat) return;
    let checkboxesNghiemThu = document.querySelectorAll('.nghiemthu-checkbox:checked'); let phaiChoKetQuaBI = false;
    checkboxesNghiemThu.forEach(cb => { if (cb.getAttribute('data-hasbi') === 'true') phaiChoKetQuaBI = true; });

    if (phaiChoKetQuaBI && !duLieuAnhBiTamBase64) {
        nutDuyetDat.disabled = true;
        nutDuyetDat.className = "w-full bg-slate-300 text-slate-500 font-black py-2.5 rounded text-xs shadow-md cursor-not-allowed flex items-center justify-center gap-2";
        nutDuyetDat.innerHTML = `<i class="fa-solid fa-lock text-slate-400"></i> CHỜ MINH CHỨNG BI (MÁY Ủ ĐỌC 20 PHÚT)`;
    } else {
        nutDuyetDat.disabled = false;
        nutDuyetDat.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer";
        nutDuyetDat.innerHTML = `<i class="fa-solid fa-check-double mr-1"></i> DUYỆT ĐẠT & CHO VÀO KHO LƯU TRỮ CHUNG`;
    }
}

function nhapKhoHangLoat() { 
    let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!"); 
    const bayGio = new Date(); let p = []; 
     
    checkboxes.forEach(cb => { 
        if(cb.id === 'selectAllNghiemThu') return; 
        let itemData = listGiaoDich.find(x => x.firestoreId === cb.value); if(!itemData) return;
        let coKemBI = itemData.hasBI === true;
        let thoiGianHapXong = itemData.thoiGianKetThucChuTrinh ? new Date(itemData.thoiGianKetThucChuTrinh) : new Date(bayGio.getTime() - 45 * 60 * 1000);
        let soPhutThucTe = Math.floor((bayGio - thoiGianHapXong) / (1000 * 60)); 
        let soPhutTinhKPI = coKemBI ? Math.max(0, soPhutThucTe - 20) : soPhutThucTe;
        let trangThaiKPI = (soPhutTinhKPI > 30) ? "KHÔNG ĐẠT" : "ĐẠT";

        let bgGiamSat = itemData.thongTinLoHap?.giamSatChatLuong || {};
        let updateGiamSat = {
            ...bgGiamSat,
            ketQuaSinhHoc: coKemBI ? "ÂM TÍNH (ĐẠT)" : "KẾ THỪA ĐẦU NGÀY",
            minhChungAnhBase64: coKemBI ? duLieuAnhBiTamBase64 : (bgGiamSat.minhChungAnhBase64 || "")
        };

        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({
                status: "CHO_XUAT", thoiGianKetLuan: bayGio.toISOString(), thoiGianDocTestBiPhut: soPhutThucTe, 
                thoiGianTinhKpiPhut: soPhutTinhKPI, ketQuaGiamSatKpi: trangThaiKPI, "thongTinLoHap.giamSatChatLuong": updateGiamSat
            })
        ); 
    }); 
     
    Promise.all(p).then(() => { 
        playSound('success');
        showToast("Đã duyệt mâm đạt chuẩn Vô Khuẩn!", "success"); 
        duLieuAnhBiTamBase64 = ""; const fileInp = document.getElementById("input_anhBI"); if(fileInp) fileInp.value = ""; 
        callRender(); 
    }); 
}

function tuChoiHapHangLoat() { 
    let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn mâm dụng cụ!", "error"); 
    let p = []; 
    checkboxes.forEach(cb => { if(cb.id !== 'selectAllNghiemThu') p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({status: "DANG_RUA", ghiChu: "Không đạt hấp, trả về rửa lại"})); }); 
    Promise.all(p).then(() => { playSound('error'); showToast("Đã trả các mâm không đạt về Trạm làm sạch!", "success"); callRender(); }); 
}

// =========================================================================
// 9. TRẠM 6: KHO VÔ KHUẨN & PHỐI HỢP CẤP PHÁT ĐIỀU PHỐI XOAY VÒNG (FIFO)
// =========================================================================
function xuatKhoXoayVong(maTrucTiep) { 
    const k = document.getElementById("xuat_selKhoa") ? document.getElementById("xuat_selKhoa").value : ""; 
    let ma = maTrucTiep || (document.getElementById("xuat_inpMaBo") ? document.getElementById("xuat_inpMaBo").value.trim().toUpperCase() : ""); 
    
    if(!k) { playSound('error'); return showToast("Vui lòng Chọn Khoa nhận trước khi xuất!", "error"); } 
    if(!ma) return;
    if(gioHangXuatKho.some(x => x.maMacDinh === ma)) { playSound('error'); if(document.getElementById("xuat_inpMaBo")) document.getElementById("xuat_inpMaBo").value = ""; return showToast("Mã này đã có trong danh sách xuất!", "error"); }
    
    let khayThucTe = listGiaoDich.find(x => x.maMacDinh === ma && x.status === "CHO_XUAT"); 
    if(!khayThucTe) { playSound('error'); if(document.getElementById("xuat_inpMaBo")) document.getElementById("xuat_inpMaBo").value = ""; return showToast(`Mã ID ${ma} không sẵn sàng ở Kho Vô Khuẩn.`, "error"); } 
    
    gioHangXuatKho.push(khayThucTe); playSound('success'); if(document.getElementById("xuat_inpMaBo")) document.getElementById("xuat_inpMaBo").value = ""; renderGioHangXuat();
}

function renderGioHangXuat() {
    let listContainer = document.getElementById("danhSachXuatTam");
    if (!listContainer) {
        let bangKho = document.getElementById("bangKhoVoKhuan");
        if (bangKho && bangKho.closest('table')) {
            let wrapper = document.createElement("div"); wrapper.id = "danhSachXuatTam";
            wrapper.className = "mb-4 bg-sky-50 border border-sky-200 rounded p-3 hidden shadow-inner";
            bangKho.closest('table').parentNode.insertBefore(wrapper, bangKho.closest('table')); listContainer = wrapper;
        }
    }
    if(listContainer) {
        if(gioHangXuatKho.length === 0) { listContainer.classList.add("hidden"); } 
        else {
            listContainer.classList.remove("hidden");
            let html = `<div class="flex justify-between items-center mb-2 pb-2 border-b border-sky-200"><h3 class="font-bold text-sky-800 text-[13px]"><i class="fa-solid fa-cart-flatbed mr-2"></i>Đang quét xuất kho: <span class="bg-rose-500 text-white px-2 py-0.5 rounded ml-1">${gioHangXuatKho.length} mâm</span></h3><button onclick="xacNhanXuatKhoHangLoat()" class="bg-emerald-600 text-white px-4 py-1.5 rounded shadow font-black text-xs hover:bg-emerald-700 transition-colors uppercase"><i class="fa-solid fa-check-double mr-1"></i>Chốt Bàn Giao</button></div><div class="flex flex-wrap gap-2">`;
            gioHangXuatKho.forEach((item, index) => { 
                let tenBoGoc = item.bo ? String(item.bo).split(" [ID:")[0] : "Dụng cụ";
                html += `<div class="bg-white border border-sky-300 px-2 py-1 rounded flex items-center gap-2 shadow-sm animate-pulse"><span class="text-[11px] font-bold text-slate-700">${tenBoGoc}</span><span class="text-[10px] font-mono text-sky-700 bg-sky-100 px-1 rounded font-bold">${item.maMacDinh}</span><i class="fa-solid fa-xmark text-rose-500 cursor-pointer ml-1 text-xs hover:text-rose-700" onclick="xoaKhoiGioXuat(${index})"></i></div>`; 
            });
            html += `</div>`; listContainer.innerHTML = html;
        }
    }
}

function xoaKhoiGioXuat(index) { gioHangXuatKho.splice(index, 1); renderGioHangXuat(); }

function xacNhanXuatKhoHangLoat() {
    const k = document.getElementById("xuat_selKhoa").value; if(!k || gioHangXuatKho.length === 0) return;
    let p = []; 
    gioHangXuatKho.forEach(khay => { 
        p.push(
            db.collection("phieuGiaoNhan").doc(khay.firestoreId).update({ 
                status: "ĐANG_VAN_CHUYEN", khoa: k, ngayHoanTat: getTodayDateStr(), timeHoanTat: new Date().toLocaleTimeString('vi-VN'), nvXuatKho: loginUserCode || "CSSD_CHUNG" 
            })
        ); 
    });
    Promise.all(p).then(() => { 
        playSound('success'); showToast(`Đã xuất kho bàn giao về Khoa ${k}!`, "success"); 
        gioHangXuatKho = []; if (document.getElementById("xuat_inpMaBo")) document.getElementById("xuat_inpMaBo").value = ""; 
        renderGioHangXuat(); callRender(); 
    });
}

function duyetCapPhatTậpTrung(yeuCauId, tenBo, khoaNhan) {
    let khaySẵnCo = listGiaoDich.find(x => x.status === "CHO_XUAT" && x.bo.split(" [ID:")[0].trim().toUpperCase() === tenBo.trim().toUpperCase());
    
    if (!khaySẵnCo) {
        playSound('error');
        return alert(`⚠️ KHÔNG CÓ KHAY SẴN SÀNG TRONG KHO!\nHiện tại trong Kho vô khuẩn CSSD không có khay "${tenBo}" nào sẵn sàng để cấp phát.`);
    }

    if (confirm(`Xác nhận cấp phát khay ${khaySẵnCo.maMacDinh} để đáp ứng yêu cầu của khoa ${khoaNhan}?`)) {
        let bayGio = new Date();
        let batch = db.batch();
        
        let refKhay = db.collection("phieuGiaoNhan").doc(khaySẵnCo.firestoreId);
        batch.update(refKhay, {
            status: "ĐANG_VAN_CHUYEN",
            khoa: khoaNhan,
            ngayHoanTat: getTodayDateStr(),
            timeHoanTat: bayGio.toLocaleTimeString('vi-VN'),
            nvXuatKho: loginUserCode || "CSSD_CHUNG"
        });

        let refYeuCau = db.collection("phieuGiaoNhan").doc(yeuCauId);
        batch.delete(refYeuCau);

        batch.commit().then(() => {
            playSound('success');
            showToast(`Đã cấp phát thành công khay ${khaySẵnCo.maMacDinh} cho khoa ${khoaNhan}!`, "success");
            callRender();
        });
    }
}

// =========================================================================
// XỬ LÝ KÝ CHỮ KÝ ĐIỆN TỬ TRỰC TIẾP TRÊN CANVAS & CẬP NHẬT KHOA
// =========================================================================
function khoiTaoCanvasKyDienTu() {
    canvasSignature = document.getElementById("canvasKyDienTu");
    if (!canvasSignature) return;
    ctxSignature = canvasSignature.getContext("2d");

    const rect = canvasSignature.getBoundingClientRect();
    canvasSignature.width = rect.width || 380;
    canvasSignature.height = rect.height || 160;

    ctxSignature.lineWidth = 2.5;
    ctxSignature.lineCap = "round";
    ctxSignature.strokeStyle = "#0284c7";

    // Chuột
    canvasSignature.onmousedown = (e) => {
        isDrawingSignature = true;
        ctxSignature.beginPath();
        const pos = getCanvasPos(e);
        ctxSignature.moveTo(pos.x, pos.y);
    };
    canvasSignature.onmousemove = (e) => {
        if (!isDrawingSignature) return;
        const pos = getCanvasPos(e);
        ctxSignature.lineTo(pos.x, pos.y);
        ctxSignature.stroke();
    };
    canvasSignature.onmouseup = () => { isDrawingSignature = false; };

    // Cảm ứng Tablet/Phone
    canvasSignature.ontouchstart = (e) => {
        isDrawingSignature = true;
        ctxSignature.beginPath();
        const pos = getCanvasPos(e.touches[0]);
        ctxSignature.moveTo(pos.x, pos.y);
    };
    canvasSignature.ontouchmove = (e) => {
        if (!isDrawingSignature) return;
        e.preventDefault();
        const pos = getCanvasPos(e.touches[0]);
        ctxSignature.lineTo(pos.x, pos.y);
        ctxSignature.stroke();
    };
    canvasSignature.ontouchend = () => { isDrawingSignature = false; };
}

function getCanvasPos(evt) {
    const rect = canvasSignature.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function xoaChuKyCanvas() {
    if (ctxSignature && canvasSignature) {
        ctxSignature.clearRect(0, 0, canvasSignature.width, canvasSignature.height);
    }
}

function khoaKyNhanDoSachDienTu() {
    const checkboxes = document.querySelectorAll("#bangChoNhanTaiKhoa input[type='checkbox']:checked");
    dsIdKhayChoKyNhan = [];
    checkboxes.forEach(chk => dsIdKhayChoKyNhan.push(chk.value));

    if (dsIdKhayChoKyNhan.length === 0) {
        playSound('error');
        return showToast("Vui lòng tích chọn ít nhất 1 khay để ký nhận!", "error");
    }

    const inpName = document.getElementById("ky_tenNguoiNhan");
    if (inpName) inpName.value = loginUserCode || "";

    const pop = document.getElementById("popupKyDienTu");
    if (pop) {
        pop.classList.remove("hidden");
        setTimeout(() => {
            khoiTaoCanvasKyDienTu();
            xoaChuKyCanvas();
        }, 100);
    } else {
        const khoaDangNhap = currentRole === "KHOA" ? loginUserCode : (document.getElementById("khoa_selKhoa") ? document.getElementById("khoa_selKhoa").value : "");
        if (confirm(`Xác nhận nhận ${dsIdKhayChoKyNhan.length} mâm về khoa ${khoaDangNhap}?`)) {
            let p = [];
            dsIdKhayChoKyNhan.forEach(idDoc => {
                p.push(
                    db.collection("phieuGiaoNhan").doc(idDoc).update({
                        status: "HOAN_TAT", nguoiKyNhanKhoa: loginUserCode || "Điều dưỡng khoa", timeKhoaNhanThucTe: new Date().toLocaleTimeString('vi-VN'), ngayKhoaNhanThucTe: getTodayDateStr()
                    })
                );
            });
            Promise.all(p).then(() => { playSound('success'); showToast(`Đã tiếp nhận vào tủ khoa thành công!`, "success"); callRender(); });
        }
    }
}

function dongPopupKyDienTu() {
    document.getElementById("popupKyDienTu")?.classList.add("hidden");
    dsIdKhayChoKyNhan = [];
}

function luuXacNhanKyNhan() {
    const tenNguoiNhan = document.getElementById("ky_tenNguoiNhan")?.value.trim();
    if (!tenNguoiNhan) {
        playSound('error');
        return showToast("Vui lòng nhập tên người nhận!", "error");
    }

    const chuoiAnhChuKy = canvasSignature ? canvasSignature.toDataURL("image/png") : "";
    const currentKhoa = currentRole === "KHOA" ? loginUserCode : (document.getElementById("khoa_selKhoa")?.value || "KHOA_LAM_SANG");
    const thoiGianKy = new Date().toLocaleString('vi-VN');

    // 1. Lưu chữ ký gần nhất vào localStorage theo Khoa
    const dataSignature = {
        tenNguoiNhan: tenNguoiNhan,
        chuKyImg: chuoiAnhChuKy,
        timeKy: thoiGianKy
    };
    localStorage.setItem(`signature_${currentKhoa}`, JSON.stringify(dataSignature));

    // 2. Cập nhật trạng thái từng mâm vào Cloud Firestore
    let p = [];
    dsIdKhayChoKyNhan.forEach(idDoc => {
        p.push(
            db.collection("phieuGiaoNhan").doc(idDoc).update({
                status: "HOAN_TAT",
                nguoiKyNhanKhoa: tenNguoiNhan,
                anhChuKyNhanBase64: chuoiAnhChuKy,
                timeKhoaNhanThucTe: new Date().toLocaleTimeString('vi-VN'),
                ngayKhoaNhanThucTe: getTodayDateStr()
            })
        );
    });

    Promise.all(p).then(() => {
        playSound('success');
        showToast(`Đã ký nhận thành công ${dsIdKhayChoKyNhan.length} mâm vào tủ khoa!`, "success");
        dongPopupKyDienTu();
        callRender();
    });
}

// =========================================================================
// 10. GHI NHẬN SỬ DỤNG BỘ DỤNG CỤ TRÊN BỆNH NHÂN
// =========================================================================
function moPopupSuDungBoDungCu() {
    gioKhaySuDungTam = []; document.getElementById("sd_bangKhayChon").innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Vui lòng quét hoặc nhập mã khay...</td></tr>`;
    document.getElementById("sd_ngaySuDung").value = getTodayDateStr(); document.getElementById("sd_nhanChung").value = loginUserCode || "ADMIN";
    if(document.getElementById("sd_khoaBenhNhan")) document.getElementById("sd_khoaBenhNhan").value = (currentRole === "KHOA") ? loginUserCode : "";
    if(document.getElementById("sd_yTaPhongMo")) document.getElementById("sd_yTaPhongMo").value = "";
    if(document.getElementById("sd_yTaVongNgoai")) document.getElementById("sd_yTaVongNgoai").value = "";
    if(document.getElementById("sd_searchBN")) document.getElementById("sd_searchBN").value = "";
    if(document.getElementById("sd_ghiChu")) document.getElementById("sd_ghiChu").value = "";
    if(document.getElementById("sd_maKhayInp")) document.getElementById("sd_maKhayInp").value = "";
    document.getElementById("popupSuDungBoDungCu").classList.remove("hidden");
}

function closePopupSuDung() { document.getElementById("popupSuDungBoDungCu").classList.add("hidden"); }

function scanKhayVaoSuDung() {
    let ma = document.getElementById("sd_maKhayInp").value.trim().toUpperCase(); if(!ma) return;
    document.getElementById("sd_maKhayInp").value = "";
    if(gioKhaySuDungTam.some(x => x.maMacDinh === ma)) { playSound('error'); return showToast("Mã khay này đã được quét!", "error"); }

    let khayThucTe = listGiaoDich.find(x => x.maMacDinh === ma && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT"));
    if(!khayThucTe) { playSound('error'); return showToast(`Mã ID ${ma} không hợp lệ hoặc chưa vô khuẩn!`, "error"); }

    gioKhaySuDungTam.push(khayThucTe); playSound('success'); renderBangKhaySuDung();
}

function renderBangKhaySuDung() {
    const tbody = document.getElementById("sd_bangKhayChon"); if(!tbody) return;
    if(gioKhaySuDungTam.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Chưa chọn khay...</td></tr>`; return; }
    tbody.innerHTML = gioKhaySuDungTam.map((item, index) => {
        let tenBoGoc = item.bo ? String(item.bo).split(" [ID:")[0] : "N/A";
        return `<tr class="border-b font-medium hover:bg-slate-50 text-xs">
            <td class="p-2 text-center"><i class="fa-solid fa-square-check text-teal-600 text-sm"></i></td>
            <td class="p-2 font-mono font-bold text-sky-700">${item.maMacDinh}</td>
            <td class="p-2 font-bold text-slate-800">${tenBoGoc}</td>
            <td class="p-2 text-center font-mono font-bold text-rose-600 bg-rose-50/30">${item.batchCode || 'N/A'}</td>
            <td class="p-2 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">${item.status}</span></td>
            <td class="p-2 text-center"><i class="fa-solid fa-trash-can text-rose-500 cursor-pointer hover:text-rose-700" onclick="xoaKhayKhoiListSuDung(${index})"></i></td>
        </tr>`;
    }).join('');
}

function xoaKhayKhoiListSuDung(index) {
    gioKhaySuDungTam.splice(index, 1);
    renderBangKhaySuDung();
}

// =========================================================================
// 11. THIẾT LẬP MÁY IN BIXOLON SLP-TX403 (80mm x 50mm) & BIÊN BẢN HÀNG LOẠT
// =========================================================================

// In tem đơn Bixolon 80mm x 50mm
function inTemBixolonChuan(itemData) {
    const pZone = document.getElementById("print-zone");
    if (!pZone) return;

    const tenBo = itemData.bo ? itemData.bo.split(" [ID:")[0] : "DỤNG CỤ VÔ KHUẨN";
    const maID = itemData.maMacDinh || itemData.idKhay || "000000";
    const ngayNSX = itemData.ngayHapRealtime || itemData.ngayTao || getTodayDateStr();
    const ngayHSD = itemData.hsd ? new Date(itemData.hsd).toLocaleDateString('vi-VN') : "Theo quy định";
    const maBatch = itemData.batchCode || itemData.batchId || "N/A";
    const tenKhoa = itemData.khoa || "TẬP TRUNG";

    pZone.innerHTML = `
        <div class="bixolon-label" style="font-family: Arial, sans-serif;">
            <div style="text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
                <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">PHUONG NAM HOSPITAL - CSSD</div>
                <div style="font-size: 12px; font-weight: 900; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tenBo}</div>
            </div>

            <div style="text-align: center; margin: 3px 0; display: flex; justify-content: center;">
                <svg id="bixolon-single-barcode"></svg>
            </div>

            <div style="font-size: 9px; border-top: 1px dashed #000; padding-top: 2px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold;">
                    <span>LÔ: ${maBatch}</span>
                    <span>KHOA: ${tenKhoa}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 1px;">
                    <span>NSX: ${ngayNSX}</span>
                    <span style="font-size: 10px; font-weight: 900;">HSD: ${ngayHSD}</span>
                </div>
            </div>
        </div>
    `;

    JsBarcode("#bixolon-single-barcode", maID, {
        format: "CODE128",
        width: 1.6,
        height: 36,
        displayValue: true,
        fontSize: 10,
        fontOptions: "bold",
        margin: 0
    });

    document.body.classList.remove("print-mode-doc");
    document.body.classList.add("print-mode-bixolon");
    pZone.classList.remove("hidden");

    setTimeout(() => {
        window.print();
        pZone.classList.add("hidden");
        document.body.classList.remove("print-mode-bixolon");
    }, 250);
}

function inTemTongHangLoat() { 
    let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!", "error"); 
    let batchCode = document.getElementById("hap_batchId")?.value || "A1000000_01"; 
    let container = document.createElement('div'); container.className = "print-label-container"; container.style.width = "100%"; 

    checkboxes.forEach((cb) => { 
        let item = listGiaoDich.find(x => x.firestoreId === cb.value); 
        if(item) { 
            let cleanBo = item.bo ? String(item.bo).split(" [ID:")[0] : "N/A"; let dateHapStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-'); let dateHsdStr = item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN').replace(/\//g, '-') : dateHapStr; 
            container.innerHTML += `<div class="bixolon-label" style="font-family: Arial; font-size: 11px; color: #000; background: #fff;"><div style="text-align: center; font-weight: bold; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cleanBo}</div><div style="text-align: center; margin: 2px 0;"><svg id="barcode-lo-${item.firestoreId}"></svg></div><div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px;"><span>SL: ${item.slThucTe || 1}</span></div><div style="display: flex; justify-content: space-between; border-top: 1px dashed #000; padding-top: 3px; font-size: 10px; margin-top: 2px;"><span>NSX: ${dateHapStr}</span><strong>HSD: ${dateHsdStr}</strong></div><div style="text-align: center; font-size: 9px; font-family: monospace; font-weight: bold; margin-top: 1px;">Lô: ${batchCode}</div></div>`; 
        } 
    }); 

    const pZone = document.getElementById("print-zone"); pZone.innerHTML = ""; pZone.appendChild(container); 
    document.body.classList.remove("print-mode-doc");
    document.body.classList.add("print-mode-bixolon");
    pZone.classList.remove("hidden"); 

    checkboxes.forEach(cb => { 
        let item = listGiaoDich.find(x => x.firestoreId === cb.value); 
        if(item) { let cleanId = item.maMacDinh ? item.maMacDinh.replace(/[^a-zA-Z0-9]/g, "") : "0000"; JsBarcode(`#barcode-lo-${item.firestoreId}`, cleanId, { format: "CODE128", width: 1.4, height: 32, displayValue: true, fontSize: 10, margin: 2 }); } 
    }); 

    setTimeout(() => { 
        window.print(); 
        pZone.classList.add("hidden"); 
        document.body.classList.remove("print-mode-bixolon");
    }, 300); 
}

function inTemNghiemThuHangLoat() { 
    let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn mâm dụng cụ!", "error"); 
    let container = document.createElement('div'); container.className = "print-label-container"; container.style.width = "100%"; 

    checkboxes.forEach((cb) => { 
        let item = listGiaoDich.find(x => x.firestoreId === cb.value); 
        if(item) { 
            let cleanBo = item.bo ? String(item.bo).split(" [ID:")[0] : "N/A"; let dateHapStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-'); let dateHsdStr = item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN').replace(/\//g, '-') : dateHapStr; 
            container.innerHTML += `<div class="bixolon-label" style="font-family: Arial; font-size: 11px; color: #000; background: #fff;"><div style="text-align: center; font-size: 9px; font-weight: bold; letter-spacing: 0.5px;">PN HOSPITAL - CSSD</div><div style="text-align: center; font-weight: bold; font-size: 12px; margin: 1px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cleanBo}</div><div style="text-align: center; margin: 2px 0;"><svg id="barcode-nt-${item.firestoreId}"></svg></div><div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px;"><span>SL: ${item.slThucTe || 1}</span><span style="color: green;">ĐẠT VÔ KHUẨN</span></div><div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 3px; font-size: 10px; margin-top: 2px;"><span>NSX: ${dateHapStr}</span><strong>HSD: ${dateHsdStr}</strong></div><div style="text-align: center; font-size: 8px; font-weight: bold; font-family: monospace; margin-top: 1px;">BATCH: ${item.batchCode || 'N/A'}</div></div>`; 
        } 
    }); 

    const pZone = document.getElementById("print-zone"); pZone.innerHTML = ""; pZone.appendChild(container); 
    document.body.classList.remove("print-mode-doc");
    document.body.classList.add("print-mode-bixolon");
    pZone.classList.remove("hidden"); 

    checkboxes.forEach(cb => { 
        let item = listGiaoDich.find(x => x.firestoreId === cb.value); 
        if(item) { let cleanId = item.maMacDinh ? item.maMacDinh.replace(/[^a-zA-Z0-9]/g, "") : "0000"; JsBarcode(`#barcode-nt-${item.firestoreId}`, cleanId, { format: "CODE128", width: 1.4, height: 32, displayValue: true, fontSize: 10, margin: 2 }); } 
    }); 

    setTimeout(() => { 
        window.print(); 
        pZone.classList.add("hidden"); 
        document.body.classList.remove("print-mode-bixolon");
    }, 300); 
}

// In Biên bản giao nhận khổ A4 máy in văn phòng (Có hỗ trợ chữ ký điện tử)
function inHoaDonGiaoNhan() {
    const k = currentRole === "KHOA" ? loginUserCode : document.getElementById("khoa_selKhoa").value; 
    if (!k) return showToast("Chọn Khoa trước!", "error");
    
    // Tìm chữ ký điện tử mới nhất từ Firestore hoặc localStorage
    const itemKyGầnNhat = listGiaoDich.find(x => x.khoa === k && x.anhChuKyNhanBase64);
    const savedSignature = JSON.parse(localStorage.getItem(`signature_${k}`) || "null");

    let htmlChuKyDieuDuong = `<p style="font-weight:normal; font-style:italic; color:#64748b; margin-top:60px;">(Ký và ghi rõ họ tên)</p>`;
    
    if (itemKyGầnNhat && itemKyGầnNhat.anhChuKyNhanBase64) {
        htmlChuKyDieuDuong = `
            <div style="text-align:center; margin-top:10px;">
                <img src="${itemKyGầnNhat.anhChuKyNhanBase64}" style="max-height:75px; margin:0 auto; display:block;" alt="Chữ ký"/>
                <p style="font-weight:bold; margin-top:5px; text-transform:uppercase; color:#0f172a;">${itemKyGầnNhat.nguoiKyNhanKhoa}</p>
                <p style="font-size:10px; color:#64748b; font-weight:normal;">Xác nhận: ${itemKyGầnNhat.ngayKhoaNhanThucTe || ''} ${itemKyGầnNhat.timeKhoaNhanThucTe || ''}</p>
            </div>
        `;
    } else if (savedSignature && savedSignature.chuKyImg) {
        htmlChuKyDieuDuong = `
            <div style="text-align:center; margin-top:10px;">
                <img src="${savedSignature.chuKyImg}" style="max-height:75px; margin:0 auto; display:block;" alt="Chữ ký"/>
                <p style="font-weight:bold; margin-top:5px; text-transform:uppercase; color:#0f172a;">${savedSignature.tenNguoiNhan}</p>
                <p style="font-size:10px; color:#64748b; font-weight:normal;">Xác nhận: ${savedSignature.timeKy}</p>
            </div>
        `;
    }

    let htmlBang = `
        <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:13px; text-align:left; font-family:Arial, sans-serif;">
            <thead>
                <tr style="background-color:#f1f5f9;">
                    <th style="padding:10px; border:1px solid #334155; width:35%; text-align:left; color:#0f172a;">PHÂN LOẠI MÂM / LOẠI DỤNG CỤ</th>
                    <th style="padding:10px; border:1px solid #334155; text-align:center; width:15%; color:#0f172a;">ĐÃ TRẢ BẨN</th>
                    <th style="padding:10px; border:1px solid #334155; text-align:center; width:15%; color:#0f172a;">ĐÃ NHẬN SẠCH</th>
                    <th style="padding:10px; border:1px solid #334155; text-align:center; width:15%; color:#0f172a;">NHẬN VÔ KHUẨN</th>
                    <th style="padding:10px; border:1px solid #334155; text-align:center; width:20%; color:#0f172a;">CSSD NỢ KHOA</th>
                </tr>
            </thead>
            <tbody>`;

    const rows = document.querySelectorAll('#bangDonGiaoNhan tr');
    if (rows.length === 0 || (rows.length === 1 && rows[0].cells.length === 1)) { 
        htmlBang += `<tr><td colspan="5" style="padding:15px; border:1px solid #334155; text-align:center; font-style:italic;">Không có dữ liệu công nợ.</td></tr>`; 
    } else {
        rows.forEach(row => {
            const cells = row.cells;
            if (cells.length >= 5) { 
                htmlBang += `
                    <tr>
                        <td style="padding:10px; border:1px solid #334155; font-weight:bold; color:#0f172a;">${cells[0].innerText}</td>
                        <td style="padding:10px; border:1px solid #334155; text-align:center; font-weight:bold; color:#e11d48;">${cells[1].innerText}</td>
                        <td style="padding:10px; border:1px solid #334155; text-align:center; font-weight:bold; color:#0284c7;">${cells[2].innerText}</td>
                        <td style="padding:10px; border:1px solid #334155; text-align:center; font-weight:bold; color:#7c3aed;">${cells[3].innerText}</td>
                        <td style="padding:10px; border:1px solid #334155; text-align:center; font-weight:bold; color:#d97706;">${cells[4].innerText}</td>
                    </tr>`; 
            }
        });
    }
    htmlBang += `</tbody></table>`;

    const pZone = document.getElementById("print-zone");
    pZone.innerHTML = `
        <div style="width:100%; font-family:Arial, sans-serif; padding:10px; color:#000;">
            <div style="text-align:center; margin-bottom:25px;">
                <h2 style="margin:0; font-size:18px; font-weight:900; text-transform:uppercase;">BIÊN BẢN GIAO NHẬN DỤNG CỤ CSSD</h2>
                <p style="margin:8px 0 0 0; font-size:13px; font-weight:bold;">Khoa/Phòng: <span style="text-transform:uppercase; color:#0284c7;">${k}</span> - Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</p>
            </div>
            ${htmlBang}
            <div style="margin-top:40px; display:flex; justify-content:space-between; font-size:12px; font-weight:bold; padding:0 30px;">
                <div style="text-align:center; width:45%;">
                    <p style="margin-bottom:10px; text-transform:uppercase;">ĐIỀU DƯỠNG LÂM SÀNG</p>
                    ${htmlChuKyDieuDuong}
                </div>
                <div style="text-align:center; width:45%;">
                    <p style="margin-bottom:10px; text-transform:uppercase;">CHUYÊN VIÊN CSSD</p>
                    <p style="font-weight:normal; font-style:italic; color:#64748b; margin-top:60px;">(Ký và ghi rõ họ tên)</p>
                </div>
            </div>
        </div>`;

    document.body.classList.remove("print-mode-bixolon");
    document.body.classList.add("print-mode-doc");
    pZone.classList.remove("hidden");

    setTimeout(() => { 
        window.print(); 
        pZone.classList.add("hidden"); 
        document.body.classList.remove("print-mode-doc");
    }, 200);
}

// =========================================================================
// 12. HÀM PHỤ TRỢ: CHỨC NĂNG QUẢN TRỊ ADMIN & TIỆN ÍCH
// =========================================================================
function taiDanhMucLinhKienChuan() {
    const tbody = document.getElementById("bangDanhMucLinhKien"); if (!tbody) return; tbody.innerHTML = "";
    if (!databaseExcel || databaseExcel.length === 0) { tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">Chưa có dữ liệu. Vui lòng nạp file Excel.</td></tr>`; return; }
    let gopBoExcel = {};
    databaseExcel.forEach(x => {
        let tenBo = x['Tên TS (i)'] || x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || x['NAME'] || x['name']; if (!tenBo) return;
        tenBo = String(tenBo).trim().toUpperCase(); if (!gopBoExcel[tenBo]) gopBoExcel[tenBo] = []; gopBoExcel[tenBo].push(x);
    });
    for (let tenBo in gopBoExcel) {
        let linhKienHtml = `<div class="flex flex-wrap gap-1">`; let tongSl = 0;
        gopBoExcel[tenBo].forEach(item => {
            let tenDc = item['Tên TS chuẩn'] || item['Tên Dụng Cụ Chi Tiết'] || item['Tên dụng cụ chi tiết'] || item['Tên dụng cụ'] || item['Chi tiết'] || item['Dụng cụ'] || item['Tên Chi Tiết'] || "Dụng cụ Chi Tiết";
            
            if (String(tenDc).trim().toUpperCase() === "NGUYÊN BỘ CẤU HÌNH CƠ SỐ") {
                tenDc = "Dụng cụ chuẩn mâm";
            }
            
            let sl = parseInt(item['Số lượng'] || item['SL'] || item['Số Lượng'] || 1) || 0; let hanHap = item['Tuổi thọ mẻ hấp'] || item['Tuổi thọ'] || 100;
            tongSl += sl; linhKienHtml += `<span class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">${tenDc} (${sl}) <span class="text-amber-600 font-bold">[Max: ${hanHap}]</span></span>`;
        });
        linhKienHtml += `</div>`; const tr = document.createElement("tr"); tr.className = "hover:bg-slate-50 transition-colors border-b";
        tr.innerHTML = `<td class="p-3 font-bold text-slate-800 text-xs">${tenBo}</td><td class="p-3">${linhKienHtml}</td><td class="p-3 text-center font-black text-sky-700 bg-sky-50/30">${tongSl}</td>`;
        tbody.appendChild(tr);
    }
}

function updateGiaoDienMatrix(role, tabId, checkboxElement) {
    if(!cauHinhGiaoDien[role]) cauHinhGiaoDien[role] = [];
    if(checkboxElement.checked) { if(!cauHinhGiaoDien[role].includes(tabId)) cauHinhGiaoDien[role].push(tabId); } 
    else { cauHinhGiaoDien[role] = cauHinhGiaoDien[role].filter(x => x !== tabId); }
    db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ cauHinhGiaoDien: cauHinhGiaoDien }).then(() => showToast("Đã cập nhật quyền truy cập!", "success"));
}

function handleViewAnhBiMoi(firestoreId) { hanhDongXemAnhBiMoi(firestoreId); }
function hanhDongXemAnhBiMoi(firestoreId) {
    let item = listGiaoDich.find(x => x.firestoreId === firestoreId); if (!item) return showToast("Không tìm thấy thông tin!", "error");
    let loGoc = listGiaoDich.find(m => m.batchCode === item.batchCode && m.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64); 
    let chuoiAnhBase64 = loGoc?.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64 || item.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64;
    if (!chuoiAnhBase64) return showToast("Mẻ này chưa tải ảnh minh chứng hoặc kế thừa.", "error");
    let w = window.open(); w.document.write(`<html><head><title>MINH CHỨNG BI - LÔ ${item.batchCode}</title></head><body style='margin:0; background:#000; display:flex; justify-content:center; align-items:center;'><img src='${chuoiAnhBase64}' style='max-width:100%; max-height:100vh; object-fit:contain;'/></body></html>`);
}

function switchAdminSubtab(sub) { 
    document.getElementById('subtab-database')?.classList.add('hidden'); document.getElementById('subtab-security')?.classList.add('hidden'); 
    document.getElementById('subbtn-database')?.classList.replace('admin-subtab-active', 'text-slate-600'); document.getElementById('subbtn-security')?.classList.replace('admin-subtab-active', 'text-slate-600'); 
    document.getElementById('subtab-' + sub)?.classList.remove('hidden'); document.getElementById('subbtn-' + sub)?.classList.add('admin-subtab-active'); 
}

function saveAdminPIN(type) { let newVal = document.getElementById(`cfg_pin${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}`).value.trim(); if(type === 'ADMIN') thongTinMatKhauAdmin.adminPIN = newVal; if(type === 'CSSD') thongTinMatKhauAdmin.cssdPIN = newVal; if(type === 'GUEST') thongTinMatKhauAdmin.guestPIN = newVal; db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ thongTinMatKhauAdmin: thongTinMatKhauAdmin }).then(() => showToast("Đã lưu PIN!", "success")); }
function themKtvCssd() { let code = prompt("Mã NV:"); let ten = prompt("Tên:"); let pin = prompt("PIN:"); if(code && ten && pin) { danhSachKtvCssd.push({ code: code.toUpperCase(), ten: ten, pin: pin }); db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKtvCssd: danhSachKtvCssd }); } }
function xaoKtvCssd(code) { if(confirm("Xóa?")) { danhSachKtvCssd = danhSachKtvCssd.filter(x => x.code !== code); db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKtvCssd: danhSachKtvCssd }); } }
function themKhoaThuCong() { let t = prompt("Nhập Tên Khoa/Phòng:"); if(t) { danhSachKhoa.push({ ten: t.toUpperCase(), pin: "123", danhSachBo: [] }); db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa }).then(() => showToast("Thêm Khoa thành công!", "success")); } }

function khaiSinhKhayVangLai() {
    if(danhSachKhoa.length === 0) return showToast("Hệ thống chưa có Khoa nào!", "error");
    let tenKhay = prompt("Nhập Tên Mâm/Khay dụng cụ:"); if(!tenKhay) return;
    let maId = prompt("Nhập Mã ID khay:"); if(!maId) return; maId = maId.toUpperCase().trim();
    let dsTenKhoa = danhSachKhoa.map((k, idx) => `${idx + 1}. ${k.ten}`).join("\n");
    let luaChon = prompt(`Chọn số thứ tự Khoa sở hữu:\n${dsTenKhoa}`); if(!luaChon) return;
    let idxKhoa = parseInt(luaChon) - 1; if(idxKhoa < 0 || idxKhoa >= danhSachKhoa.length) return showToast("Lựa chọn không hợp lệ!", "error");
    let khoaChon = danhSachKhoa[idxKhoa]; let chuoiKhayDinhDang = `${tenKhay.toUpperCase().trim()} [ID:${maId}]`;
    if(!khoaChon.danhSachBo) khoaChon.danhSachBo = []; if(khoaChon.danhSachBo.includes(chuoiKhayDinhDang)) return showToast("Khay đã tồn tại!", "error");
    khoaChon.danhSachBo.push(chuoiKhayDinhDang);
    db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa }).then(() => { showToast(`Khai sinh khay ${maId} thành công!`, "success"); callRender(); });
}

function updatePINTrựcTiep(idx, tenKhoa) { let p = document.getElementById(`pin-khoa-${idx}`).value.trim(); if(p) { danhSachKhoa.find(x => x.ten === tenKhoa).pin = p; db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa }).then(() => showToast("Đổi PIN thành công", "success")); } }

function initSelects() { 
    let opts = '<option value="">-- Chọn Khoa --</option>' + danhSachKhoa.map(k=>`<option value="${k.ten}">${k.ten}</option>`).join('');
    if(document.getElementById("login_khoa")) document.getElementById("login_khoa").innerHTML = opts; 
    if(document.getElementById("khoa_selKhoa")) document.getElementById("khoa_selKhoa").innerHTML = opts; 
    if(document.getElementById("login_nv_cssd")) document.getElementById("login_nv_cssd").innerHTML = '<option value="">-- Chọn KTV CSSD --</option>' + danhSachKtvCssd.map(k=>`<option value="${k.code}">${k.code} - ${k.ten}</option>`).join(''); 
     
    if (document.getElementById("rua_hoaChat")) {
        document.getElementById("rua_hoaChat").innerHTML = danhMucHoaChatRua.map(hc => `<option value="${hc.ten}">${hc.ten}</option>`).join('');
        document.getElementById("rua_lieuLuong").value = danhMucHoaChatRua[0].lieuLuong;
        document.getElementById("rua_hoaChat").addEventListener("change", (e) => {
            let selectedHc = danhMucHoaChatRua.find(hc => hc.ten === e.target.value);
            if(selectedHc) document.getElementById("rua_lieuLuong").value = selectedHc.lieuLuong;
        });
    }
    if (document.getElementById("rua_loaiRua")) { capNhatDanhSachMaMayRua(); }
    if (document.getElementById("hap_loaiHap")) { capNhatDanhSachMaMay(); }
     
    const selKhoaTraba = document.getElementById("khoa_selKhoa"); if(selKhoaTraba) { selKhoaTraba.removeEventListener("change", loadBoDungCuTheoKhoa); selKhoaTraba.addEventListener("change", loadBoDungCuTheoKhoa); }
}

function showToast(msg, type="error") { const t = document.createElement('div'); t.className = `fixed top-6 right-6 ${type==="error"?"bg-rose-600":"bg-emerald-600"} text-white px-5 py-3.5 rounded-lg shadow-2xl z-[100] font-bold text-sm`; t.innerHTML = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }
function toggleMobileMenu() { document.getElementById("sidebar_menu").classList.toggle("-translate-x-full"); document.getElementById("mobile-overlay").classList.toggle("hidden"); }

function moCamera(inputId) { targetInputIdForScan = inputId; document.getElementById("popupScanner").classList.remove("hidden"); html5QrCode = new Html5Qrcode("reader"); Html5Qrcode.getCameras().then(devices => { let cid = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id; html5QrCode.start(cid, { fps: 15, qrbox: { width: 260, height: 180 } }, (txt) => { document.getElementById(targetInputIdForScan).value = txt.trim().toUpperCase(); if(targetInputIdForScan==='khoa_inpMaBo') themVaoGio(); if(targetInputIdForScan==='xuat_inpMaBo') xuatKhoXoayVong(); if(targetInputIdForScan==='sd_maKhayInp') scanKhayVaoSuDung(); }).catch(e=>{}) }); }
function dongCamera() { if(html5QrCode) html5QrCode.stop().then(() => html5QrCode.clear()); document.getElementById("popupScanner").classList.add("hidden"); }
function xoaSachDuLieuGiaoDichRealtime() { if(prompt("Nhập PIN ADMIN:") === (thongTinMatKhauAdmin.adminPIN||"admin2026")) { db.collection("phieuGiaoNhan").get().then(snap => { let b = db.batch(); snap.forEach(d => b.delete(d.ref)); b.commit().then(() => location.reload()); }); } }

function docAnhBiUpTaiCho(inputElement) { 
    const file = inputElement.files[0]; if (!file) return; 
    const reader = new FileReader(); reader.onloadend = function() { duLieuAnhBiTamBase64 = reader.result; showToast("Tải ảnh minh chứng BI thành công!", "success"); kiemTraQuyenDuyetMeHap(); }; 
    reader.readAsDataURL(file); 
}

// =========================================================================
// 13. HÀM CORE RENDER DỮ LIỆU ĐA TAB LUỒNG HỆ THỐNG
// =========================================================================
function renderTheoTabHienTai() {
    if(activeTab === 'khoaphong') {
        const k = currentRole === "KHOA" ? loginUserCode : document.getElementById("khoa_selKhoa").value;
        let tatCaDonCuaKhoa = listGiaoDich.filter(x => (x.khoa || "").toString().trim().toUpperCase() === (k || "").toString().trim().toUpperCase());
        
        // 1. TÍNH TOÁN CÔNG NỢ LUÂN CHUYỂN THỰC TẾ
        let gopCongNo = {};
        tatCaDonCuaKhoa.forEach(x => {
            if (x.status === "CHO_CAP_PHAT") return;

            let tenLoaiMâm = x.bo ? String(x.bo).split(" [ID:")[0] : "Chưa rõ mâm";
            if (!gopCongNo[tenLoaiMâm]) gopCongNo[tenLoaiMâm] = { daTraBan: 0, nhanSach: 0, nhanVoKhuan: 0, cssdNo: 0 };
            
            if (x.status !== "CHO_THU") gopCongNo[tenLoaiMâm].daTraBan += 1; 
            if (["DANG_RUA", "TRONG_BUONG_RUA", "CHO_DONG_GOI", "CHO_HAP", "DANG_HAP", "CHO_XUAT", "ĐANG_VAN_CHUYEN", "HOAN_TAT", "DA_SU_DUNG"].includes(x.status)) gopCongNo[tenLoaiMâm].nhanSach += 1;
            if (x.status === "HOAN_TAT" || x.status === "DA_SU_DUNG") gopCongNo[tenLoaiMâm].nhanVoKhuan += 1; 
            gopCongNo[tenLoaiMâm].cssdNo = gopCongNo[tenLoaiMâm].daTraBan - gopCongNo[tenLoaiMâm].nhanVoKhuan;
        });
        
        let arrHtml = [];
        for (let key in gopCongNo) {
            let item = gopCongNo[key];
            arrHtml.push(`<tr class="border-b hover:bg-slate-50 transition-colors font-medium text-[11px]"><td class="p-3 font-bold text-slate-800 border-r">${key}</td><td class="p-3 text-center text-rose-600 font-bold bg-rose-50/20 border-r">${item.daTraBan}</td><td class="p-3 text-center text-sky-600 font-bold bg-sky-50/20 border-r">${item.nhanSach}</td><td class="p-3 text-center text-purple-600 font-bold bg-purple-50/20 border-r">${item.nhanVoKhuan}</td><td class="p-3 text-center text-amber-600 font-black bg-amber-50/20">${item.cssdNo > 0 ? 'Nợ ' + item.cssdNo : '-'}</td></tr>`);
        }
        if(document.getElementById("bangDonGiaoNhan")) {
            document.getElementById("bangDonGiaoNhan").innerHTML = arrHtml.length ? arrHtml.join('') : `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">Khoa chưa phát sinh công nợ luân chuyển đồ.</td></tr>`;
        }
        
        // 2. DANH SÁCH CHỜ NHẬN ĐỒ SẠCH (Từ xe trung chuyển CSSD bàn giao lên)
        const tbodyChoNhan = document.getElementById("bangChoNhanTaiKhoa"); const badgeChoNhan = document.getElementById("badgeChoNhanKhoa"); const txtNguoiXacNhan = document.getElementById("txtNguoiDungNhanHienTai");
        if(txtNguoiXacNhan) txtNguoiXacNhan.innerText = `PM-ĐD: ${loginUserCode || "Chưa Đăng Nhập"}`;
        
        let dsDangVanChuyen = tatCaDonCuaKhoa.filter(x => x.status === "ĐANG_VAN_CHUYEN"); if(badgeChoNhan) badgeChoNhan.innerText = `${dsDangVanChuyen.length} khay`;
        if(tbodyChoNhan) {
            if(dsDangVanChuyen.length === 0) { tbodyChoNhan.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400 italic">Hiện không có dụng cụ nào đang chuyển về khoa.</td></tr>`; } 
            else { tbodyChoNhan.innerHTML = dsDangVanChuyen.map(khay => `<tr class="hover:bg-slate-50 transition-colors"><td class="p-2 text-center"><input type="checkbox" value="${khay.firestoreId}" class="w-3.5 h-3.5 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"></td><td class="p-2 font-mono font-bold text-slate-700">${khay.maMacDinh || 'N/A'}</td><td class="p-2 font-semibold text-slate-800">${khay.bo ? String(khay.bo).split(" [ID:")[0] : 'N/A'}</td><td class="p-2 text-slate-500 font-medium">${khay.nvXuatKho || '--'}</td><td class="p-2 text-center"><span class="bg-purple-50 text-purple-700 font-mono text-[10px] px-1.5 py-0.5 rounded font-bold">${khay.batchCode || 'N/A'}</span></td></tr>`).join(''); }
        }

        // 3. THEO DÕI YÊU CẦU ĐANG CHỜ CSSD CẤP PHÁT
        let dsChoCapPhat = tatCaDonCuaKhoa.filter(x => x.status === "CHO_CAP_PHAT");
        const tbodyChoCapPhat = document.getElementById("bangChoCapPhatTaiKhoa");
        if (tbodyChoCapPhat) {
            if (dsChoCapPhat.length === 0) {
                tbodyChoCapPhat.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400 italic">Không có yêu cầu mượn khay mới nào đang chờ duyệt.</td></tr>`;
            } else {
                tbodyChoCapPhat.innerHTML = dsChoCapPhat.map(yc => `
                    <tr class="border-b text-xs hover:bg-amber-50/10 font-medium">
                        <td class="p-2.5 font-bold text-amber-800">${yc.bo}</td>
                        <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">Chờ CSSD cấp khay</span></td>
                        <td class="p-2.5 text-center font-mono text-slate-400">${yc.time}</td>
                        <td class="p-2.5 text-center text-slate-500">${yc.nvYeuCau || 'ĐD'}</td>
                    </tr>
                `).join('');
            }
        }
    }
    else if(activeTab === 'thugom') {
        let fK = document.getElementById("filterKhoaThuGom")?.value || ""; 
        let lsTG = listGiaoDich.filter(x => x.status === "CHO_THU"); 
        
        if (document.getElementById("filterKhoaThuGom")) {
            let danhSachKhoaCoDon = [...new Set(lsTG.map(x => x.khoa))].filter(Boolean); 
            let htmlOpts = '<option value="">-- Lọc theo Khoa --</option>';
            danhSachKhoaCoDon.forEach(k => { 
                htmlOpts += `<option value="${k}" ${(k === fK) ? "selected" : ""}>${k}</option>`; 
            });
            document.getElementById("filterKhoaThuGom").innerHTML = htmlOpts; 
            fK = document.getElementById("filterKhoaThuGom").value || "";
        }
        
        if (fK) lsTG = lsTG.filter(x => (x.khoa || "").toString().trim().toUpperCase() === fK.toString().trim().toUpperCase());
        if (document.getElementById("badgeSoCho")) document.getElementById("badgeSoCho").innerText = `${lsTG.length} Lệnh`;
        
        let bodyThuGom = document.getElementById("bangChoThuGom");
        if(bodyThuGom) {
            bodyThuGom.innerHTML = lsTG.map(i => {
                let tenBo = i.bo ? String(i.bo).split(" [ID:")[0].trim() : ""; 
                
                let itemsInBo = databaseExcel.filter(x => {
                    let boName = x['Tên TS (i)'] || x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || '';
                    return String(boName).trim().toUpperCase() === String(tenBo).toUpperCase();
                });
                
                let checklistHtml = "";
                if (itemsInBo.length > 0) {
                    checklistHtml = `<div class="max-h-32 overflow-y-auto pr-1 border border-slate-200/60 rounded bg-slate-50/50 p-1.5 mt-1 flex flex-col gap-1">`;
                    itemsInBo.forEach(item => {
                        let tenDc = item['Tên TS chuẩn'] || item['Tên Dụng Cụ Chi Tiết'] || item['Tên dụng cụ chi tiết'] || item['Tên dụng cụ'] || item['Chi tiết'] || "Dụng cụ chi tiết";
                        let sl = item['Số lượng'] || item['SL'] || item['Số Lượng'] || 1;
                        
                        if (String(tenDc).trim().toUpperCase() === "NGUYÊN BỘ CẤU HÌNH CƠ SỐ") {
                            tenDc = "Dụng cụ chuẩn mâm";
                        }

                        checklistHtml += `
                            <div class="flex justify-between items-center border-b border-dashed border-slate-200 pb-0.5 last:border-none text-[11px]">
                                <span class="text-slate-700 font-semibold"><i class="fa-solid fa-circle text-[4px] text-sky-400 mr-1.5 align-middle"></i>${tenDc}</span>
                                <span class="font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 text-[10px]">x${sl}</span>
                            </div>`;
                    });
                    checklistHtml += `</div>`;
                } else {
                    checklistHtml = `<div class="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 p-1.5 rounded font-medium mt-1"><i class="fa-solid fa-circle-check mr-1"></i>Dụng cụ lẻ (Cơ số: 1 chiếc)</div>`;
                }
                
                return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                        <td class="p-3 align-top">
                            <div class="font-black text-slate-700 text-[11px] uppercase tracking-wide">${i.khoa}</div>
                            ${i.ghiChu ? `<div class="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded mt-1.5 inline-block"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${i.ghiChu}</div>` : ''}
                        </td>
                        <td class="p-3 align-top">
                            <div class="font-black text-sky-800 text-[13px] uppercase tracking-tight">${tenBo}</div>
                            <div class="text-[10px] font-mono text-slate-400 font-bold mt-0.5">MÃ SỐ ID: ${i.maMacDinh}</div>
                            ${checklistHtml}
                        </td>
                        <td class="p-3 text-center align-top font-mono font-bold text-slate-500 text-[11px]">${i.time}</td>
                        <td class="p-3 text-center align-top action-col">
                            <button onclick="moPopupKiemDem('${i.firestoreId}')" class="bg-sky-600 hover:bg-sky-700 text-white font-black px-3.5 py-2 rounded-lg shadow-sm text-[11px] uppercase tracking-wider transition-all"><i class="fa-solid fa-clipboard-check mr-1"></i>Kiểm Đếm</button>
                        </td>
                    </tr>`;
            }).join('');
        }
    }
    else if(activeTab === 'mayrua') {
        let lsCR = listGiaoDich.filter(x => x.status === "DANG_RUA");
        if(document.getElementById("badgeChoRua")) document.getElementById("badgeChoRua").innerText = `${lsCR.length} Mục`;
        
        let bodyChoRua = document.getElementById("bangChoRua");
        if(bodyChoRua) {
            bodyChoRua.innerHTML = lsCR.map(i => `<tr class="border-b"><td class="p-3 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="rua-checkbox"></td><td class="p-3 font-bold">${i.bo}</td><td class="p-3 text-right font-mono">${i.maMacDinh}</td></tr>`).join('');
        }
        
        let lsTR = listGiaoDich.filter(x => x.status === "TRONG_BUONG_RUA");
        let bodyChoNghiemThuRua = document.getElementById("bangChoNiemThuRua");
        if(bodyChoNghiemThuRua) {
            bodyChoNghiemThuRua.innerHTML = lsTR.map(i => `<tr class="border-b"><td class="p-2.5 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="nghiemthurua-checkbox"></td><td class="p-2 text-xs font-bold">${i.bo} <span class="text-slate-400 font-mono">(${i.rua_batchCode || 'Mẻ Rửa'})</span></td></tr>`).join('');
        }
        
        let bodyLichSuRua = document.getElementById("bangLichSuRua");
        if(bodyLichSuRua) {
            const homNayMoiStr = getTodayDateStr();
            let tatCaMucCoLoRua = listGiaoDich.filter(x => x.rua_batchCode && (x.rua_ngayRua === homNayMoiStr || x.ngayTao === homNayMoiStr));
            let cacMeRuaGop = {};
            tatCaMucCoLoRua.forEach(x => {
                if(!cacMeRuaGop[x.rua_batchCode]) {
                    cacMeRuaGop[x.rua_batchCode] = {
                        batchCode: x.rua_batchCode,
                        mayRua: x.rua_mayRua || "Belimed WD250",
                        chuKy: x.rua_chuKy || "Chu trình tiêu chuẩn",
                        hoaChat: x.rua_hoaChat || "Smeg",
                        timeBatDau: x.rua_timeBatDau || "--:--",
                        ngay: x.rua_ngayRua || "",
                        soLuong: 0,
                        trangThaiMe: x.status === "TRONG_BUONG_RUA" ? "Đang rửa" : "Hoàn tất sạch"
                    };
                }
                cacMeRuaGop[x.rua_batchCode].soLuong += 1;
            });
            let danhSachMeRuaSapXep = Object.values(cacMeRuaGop).sort((a, b) => String(b.batchCode).localeCompare(String(a.batchCode)));
            if(danhSachMeRuaSapXep.length === 0) {
                bodyLichSuRua.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-slate-400 italic">Hôm nay chưa chạy mẻ rửa nào</td></tr>`;
            } else {
                bodyLichSuRua.innerHTML = danhSachMeRuaSapXep.map(me => `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-3">
                            <div class="flex items-center gap-2">
                                <span class="font-mono font-black text-sky-700 text-sm tracking-wider">${me.batchCode}</span>
                                <span class="px-2 py-0.5 text-[9px] font-black uppercase rounded ${me.trangThaiMe === "Đang rửa" ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"}">${me.trangThaiMe}</span>
                            </div>
                            <div class="text-[11px] text-slate-500 font-medium mt-1">${me.mayRua} | ${me.chuKy}</div>
                            <div class="text-[10px] text-slate-400 font-mono mt-0.5">Hoá chất: ${me.hoaChat} | Bắt đầu: ${me.timeBatDau} (${me.ngay})</div>
                        </td>
                        <td class="p-3 text-right pr-4">
                            <span class="font-black text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-xs">${me.soLuong} khay</span>
                        </td>
                    </tr>`).join('');
            }
        }
    }
    else if(activeTab === 'donggoi') {
        let lsDG = listGiaoDich.filter(x => x.status === "CHO_DONG_GOI"); 
        if(document.getElementById("badgeDongGoi")) document.getElementById("badgeDongGoi").innerText = lsDG.length;
        let gDongGoi = document.getElementById("gridDongGoi");
        if(gDongGoi) {
            gDongGoi.innerHTML = lsDG.map(i => `<div class="bg-white p-3 rounded border border-slate-200 mb-2 flex justify-between items-center"><div class="flex-1"><div class="font-bold text-sky-700 text-[13px]">${i.bo}</div><div class="text-[10px] text-slate-500">Từ khoa: ${i.khoa}</div></div><button onclick="moPopupDongGoi('${i.firestoreId}')" class="bg-sky-50 text-sky-700 border border-sky-300 px-3 py-1.5 rounded text-[11px] font-black">ĐÓNG GÓI</button></div>`).join('');
        }
    }
    else if(activeTab === 'mayhap') {
        let lsCH = listGiaoDich.filter(x => x.status === "CHO_HAP"); 
        if(document.getElementById("badgeChoHap")) document.getElementById("badgeChoHap").innerText = `${lsCH.length} Mục`;
        let bodyChoHap = document.getElementById("bangChoHap");
        if(bodyChoHap) { 
            bodyChoHap.innerHTML = lsCH.map(i => `<tr class="border-b"><td class="p-3 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="hap-checkbox"></td><td class="p-3 font-bold text-xs">${i.bo}</td><td class="p-3 text-right font-mono text-xs font-bold text-sky-700">${i.maMacDinh}</td></tr>`).join(''); 
        }

        let lsNT = listGiaoDich.filter(x => x.status === "DANG_HAP"); 
        let bodyChoNghiemThu = document.getElementById("bangChoNghiệmThu") || document.getElementById("bangChoNghiemThu");
        
        if(bodyChoNghiemThu) { 
            if (lsNT.length === 0) {
                bodyChoNghiemThu.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-slate-400 italic">Không có mâm/mẻ nào đang trong lò chờ duyệt.</td></tr>`;
            } else {
                bodyChoNghiemThu.innerHTML = lsNT.map(i => {
                    let tenBoClean = i.bo ? String(i.bo).split(" [ID:")[0] : "Chưa rõ mâm";
                    return `
                        <tr class="border-b hover:bg-amber-50/40 transition-colors">
                            <td class="p-2.5 text-center action-col">
                                <input type="checkbox" value="${i.firestoreId}" class="nghiemthu-checkbox w-4 h-4 text-amber-600 rounded cursor-pointer" data-hasbi="${i.hasBI ? 'true' : 'false'}" onchange="kiemTraQuyenDuyetMeHap()">
                            </td>
                            <td class="p-2 text-xs">
                                <div class="font-black text-slate-800">${tenBoClean} <span class="text-[10px] font-mono text-sky-700">(${i.maMacDinh || 'N/A'})</span></div>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-1 rounded border border-rose-100">Lô: ${i.batchCode || 'N/A'}</span>
                                    ${i.hasBI ? '<span class="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black border border-amber-300 flex items-center gap-1"><i class="fa-solid fa-flask"></i> CHỜ BI</span>' : ''}
                                </div>
                            </td>
                        </tr>`;
                }).join(''); 
            }
        }
        kiemTraQuyenDuyetMeHap();

        if(document.getElementById("bangLichSuHap")) {
            const homNayMoiStr = getTodayDateStr(); 
            let tatCaMucCoLo = listGiaoDich.filter(x => x.batchCode && (x.ngayHapRealtime === homNayMoiStr || x.ngayTao === homNayMoiStr)); 
            let cacMeHapGop = {};
            tatCaMucCoLo.forEach(x => {
                if(!cacMeHapGop[x.batchCode]) { 
                    cacMeHapGop[x.batchCode] = { 
                        batchCode: x.batchCode, 
                        loaiHap: x.thongTinLoHap?.loaiHap || "Hấp hơi nước", 
                        chuKyNhiet: x.thongTinLoHap?.chuKyNhiet || "134°C - 4 phút", 
                        apSuat: x.thongTinLoHap?.apSuat || "N/A", 
                        thoiGian: x.thongTinLoHap?.thoiGianBatDau || x.time || "--:--", 
                        ngay: x.ngayHapRealtime || x.ngayTao || "", 
                        soLuongKhay: 0, 
                        trangThaiMe: x.status === "DANG_HAP" ? "ĐANG CHẠY LÒ" : "HOÀN THÀNH" 
                    }; 
                }
                cacMeHapGop[x.batchCode].soLuongKhay += 1;
            });
            let danhSachMeHapSapXep = Object.values(cacMeHapGop).sort((a, b) => String(b.batchCode).localeCompare(String(a.batchCode)));
            if(danhSachMeHapSapXep.length === 0) { 
                document.getElementById("bangLichSuHap").innerHTML = `<tr><td colspan="2" class="p-4 text-center text-slate-400 italic">Hôm nay chưa có mẻ hấp nào</td></tr>`; 
            } else { 
                document.getElementById("bangLichSuHap").innerHTML = danhSachMeHapSapXep.map(me => `
                    <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                        <td class="p-3">
                            <div class="flex items-center gap-2">
                                <span class="font-mono font-black text-rose-700 text-sm tracking-wider">${me.batchCode}</span>
                                <span class="px-2 py-0.5 text-[9px] font-black uppercase rounded ${me.trangThaiMe === "ĐANG CHẠY LÒ" ? "text-purple-700 bg-purple-100 border border-purple-200 animate-pulse" : "text-emerald-700 bg-emerald-100 border border-emerald-200"}">${me.trangThaiMe}</span>
                            </div>
                            <div class="text-[11px] text-slate-600 font-medium mt-1">${me.loaiHap} | ${me.chuKyNhiet} | Áp suất: ${me.apSuat} Bar</div>
                            <div class="text-[10px] text-slate-400 font-mono mt-0.5">Bắt đầu: ${me.thoiGian} (${me.ngay})</div>
                        </td>
                        <td class="p-3 text-right pr-4">
                            <span class="font-black text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-xs">${me.soLuongKhay} khay</span>
                        </td>
                    </tr>`).join(''); 
            }
        }
    }
    else if(activeTab === 'khovokhuan') {
        let uniqueKhoaSanCo = [...new Set(listGiaoDich.map(x => x.khoa))].filter(Boolean); const selKhoaXuat = document.getElementById("xuat_selKhoa");
        if(selKhoaXuat) {
            let currentSelected = selKhoaXuat.value; let htmlOpts = '<option value="">-- Chọn Khoa Muốn Trả Đồ --</option>';
            uniqueKhoaSanCo.forEach(k => { htmlOpts += `<option value="${k}" ${k === currentSelected ? 'selected' : ''}>${k}</option>`; });
            selKhoaXuat.innerHTML = htmlOpts;
        }

        let lsXK = listGiaoDich.filter(x => x.status === "CHO_XUAT").sort((a, b) => a.id - b.id);
        renderKhoVoKhuan(lsXK);

        let dsYeuCau = listGiaoDich.filter(x => x.status === "CHO_CAP_PHAT");
        let vungYeuCau = document.getElementById("vungYeuCauCapPhat");
        if (!vungYeuCau) {
            let parentContainer = document.getElementById("tab-khovokhuan");
            if (parentContainer) {
                let divYc = document.createElement("div");
                divYc.id = "vungYeuCauCapPhat";
                divYc.className = "mb-6 bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-sm";
                parentContainer.insertBefore(divYc, parentContainer.firstChild);
                vungYeuCau = divYc;
            }
        }
        
        if (vungYeuCau) {
            if (dsYeuCau.length === 0) {
                vungYeuCau.innerHTML = `<h3 class="font-black text-amber-950 text-xs flex items-center gap-1.5"><i class="fa-solid fa-bell-slash"></i> HIỆN KHÔNG CÓ YÊU CẤP PHÁT ĐANG CHỜ</h3>`;
            } else {
                vungYeuCau.innerHTML = `
                    <h3 class="font-black text-amber-900 text-xs mb-2.5 flex items-center gap-1.5 animate-pulse">
                        <i class="fa-solid fa-bell text-rose-500 animate-bounce"></i> CÓ ${dsYeuCau.length} YÊU CẦU CẤP PHÁT TỪ CÁC KHOA LÂM SÀNG
                    </h3>
                    <div class="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        ${dsYeuCau.map(yc => `
                            <div class="bg-white p-3 rounded-lg border border-amber-200 shadow-sm flex justify-between items-center text-xs">
                                <div>
                                    <span class="font-black text-amber-800 uppercase">[KHOA: ${yc.khoa}]</span> 
                                    Yêu cầu mâm: <span class="font-bold text-slate-800">${yc.bo}</span>
                                    <span class="text-[10px] text-slate-400 block mt-0.5">Thời gian: ${yc.time} - Người yêu cầu: ${yc.nvYeuCau || 'ĐD'}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button onclick="duyetCapPhatTậpTrung('${yc.firestoreId}', '${yc.bo}', '${yc.khoa}')" class="bg-amber-600 hover:bg-amber-700 text-white font-black px-3 py-2 rounded-lg text-[10px] uppercase shadow-sm flex items-center gap-1.5 transition-all">
                                        <i class="fa-solid fa-truck-ramp-box"></i>Cấp phát khay
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`;
            }
        }
        renderGioHangXuat();
    }
    else if(activeTab === 'quanlykho') {
        let fK = document.getElementById("inv_filterKhoa") ? document.getElementById("inv_filterKhoa").value : ""; 
        let uniqueKhoa = [...new Set(listGiaoDich.map(x=>x.khoa))].filter(Boolean);
        if(document.getElementById("inv_filterKhoa")) { document.getElementById("inv_filterKhoa").innerHTML = '<option value="">-- Tất cả --</option>' + uniqueKhoa.map(k=>`<option value="${k}" ${k===fK?'selected':''}>${k}</option>`).join(''); }
        let uniqueIDs = [...new Set(listGiaoDich.map(x=>x.maMacDinh))]; let arrHtml = []; const ngayHomNay = new Date(); ngayHomNay.setHours(0,0,0,0); 
        uniqueIDs.forEach(ma => {
            let allTrans = listGiaoDich.filter(x => x.maMacDinh === ma); let currentTrans = allTrans.sort((a,b) => b.id - a.id)[0]; if(!currentTrans || !ma) return;
            let viTriCode = currentTrans.status; let khoaGiữ = currentTrans.khoa; if (fK && (khoaGiữ || "").toString().trim().toUpperCase() !== fK.toString().trim().toUpperCase()) return;
            let viTriText = "Kho vô khuẩn"; let viTriColor = "bg-teal-100 text-teal-800";
            if(viTriCode === "HOAN_TAT") { viTriText = `Sẵn sàng tại Khoa`; viTriColor = "bg-emerald-100 text-emerald-800"; } 
            else if (viTriCode === "DA_SU_DUNG") { viTriText = `Đã sử dụng (BN)`; viTriColor = "bg-rose-100 text-rose-800"; }
            else if (viTriCode === "ĐANG_VAN_CHUYEN") { viTriText = `Đang vận chuyển`; viTriColor = "bg-purple-100 text-purple-800 animate-pulse"; }
            else if(viTriCode !== "CHO_XUAT") { viTriText = "Xử lý tại CSSD"; viTriColor = "bg-amber-100 text-amber-800"; }
            let hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">An toàn</span>`; let dongColorClass = ""; 
            if (currentTrans.hsd && (viTriCode === "CHO_XUAT" || viTriCode === "HOAN_TAT")) {
                const ngayHsd = new Date(currentTrans.hsd); ngayHsd.setHours(0,0,0,0); const soNgayConLai = Math.ceil((ngayHsd.getTime() - ngayHomNay.getTime()) / (1000 * 60 * 60 * 24));
                if (soNgayConLai < 0) { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">QUÁ HẠN</span>`; dongColorClass = "bg-rose-50/70 border-l-4 border-l-rose-500 font-bold"; } 
                else if (soNgayConLai <= 3) { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white">HẠN < ${soNgayConLai} NGÀY</span>`; dongColorClass = "bg-amber-50/40 border-l-4 border-l-amber-500"; } 
                else { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Hạn ${soNgayConLai} ngày</span>`; }
            }
            arrHtml.push(`<tr class="border-b border-slate-100 ${dongColorClass}"><td class="p-3 font-mono text-sky-700 font-bold">${ma}</td><td class="p-3 font-bold text-slate-800">${currentTrans.bo ? String(currentTrans.bo).split(" [ID:")[0] : "N/A"}</td><td class="p-3 text-slate-500 text-[11px]">${khoaGiữ}</td><td class="p-3 text-center"><span class="px-2.5 py-1 rounded text-[10px] font-bold ${viTriColor}">${viTriText}</span></td><td class="p-3 text-center font-mono font-bold text-slate-400">${currentTrans.batchCode || 'N/A'}</td><td class="p-3 text-center">${hsdBadget}</td></tr>`);
        });
        if(document.getElementById("bangTonKhoTe")) document.getElementById("bangTonKhoTe").innerHTML = arrHtml.join('');
    }
    else if(activeTab === 'danhmuc') {
        const tbody = document.getElementById("bangDanhMucTong"); if (!tbody) return;
        let uniqueIDs = [...new Set(listGiaoDich.map(x => x.maMacDinh))].filter(Boolean); let arrHtml = [];
        uniqueIDs.forEach(ma => {
            let allTrans = listGiaoDich.filter(x => x.maMacDinh === ma); let currentTrans = allTrans.sort((a, b) => b.id - a.id)[0]; if (!currentTrans) return;
            let viTriCode = currentTrans.status; let viTriText = "Kho vô khuẩn"; let viTriColor = "bg-teal-100 text-teal-800";
            if (viTriCode === "HOAN_TAT") { viTriText = `Tại Khoa`; viTriColor = "bg-emerald-100 text-emerald-800"; } 
            else if (viTriCode === "DA_SU_DUNG") { viTriText = `Đã dùng (BN)`; viTriColor = "bg-rose-100 text-rose-800"; }
            else if (viTriCode === "ĐANG_VAN_CHUYEN") { viTriText = `Đang đi đường`; viTriColor = "bg-purple-100 text-purple-800"; }
            else if (viTriCode !== "CHO_XUAT") { viTriText = "Xử lý tại CSSD"; viTriColor = "bg-amber-100 text-amber-800"; }
            let chuKyLo = listGiaoDich.filter(x => x.maMacDinh === ma && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT" || x.status === "DA_SU_DUNG" || x.status === "ĐANG_VAN_CHUYEN")).length;
            arrHtml.push(`<tr class="border-b border-slate-100 font-medium"><td class="p-3 font-mono text-sky-700 font-bold">${ma}</td><td class="p-3 font-bold text-slate-800">${currentTrans.bo ? String(currentTrans.bo).split(" [ID:")[0] : "N/A"}</td><td class="p-3 text-center"><span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${viTriColor}">${viTriText}</span></td><td class="p-3 text-center font-black text-amber-700 bg-amber-50/50">${chuKyLo} lần lễ</td></tr>`);
        });
        tbody.innerHTML = arrHtml.join('');
    }
    else if(activeTab === 'lichsuluanchuyen') {
        const tbody = document.getElementById("bangLichSuHanhTrinhGoc");
        if(tbody) {
            tbody.innerHTML = listGiaoDich.map(x => {
                let statusBadge = `<span class="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px]">${x.status}</span>`;
                if(x.status === "HOAN_TAT") statusBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded text-[10px]">ĐÃ BÀN GIAO</span>`;
                else if(x.status === "CHO_XUAT") statusBadge = `<span class="px-2 py-0.5 bg-teal-100 text-teal-800 font-bold rounded text-[10px]">KHO VÔ KHUẨN</span>`;
                else if(x.status === "DANG_HAP") statusBadge = `<span class="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-[10px]">ĐANG HẤP LÒ</span>`;
                else if(x.status === "DA_SU_DUNG") statusBadge = `<span class="px-2 py-0.5 bg-rose-600 text-white font-black rounded text-[10px]">SỬ DỤNG BN</span>`;
                else if(x.status === "ĐANG_VAN_CHUYEN") statusBadge = `<span class="px-2 py-0.5 bg-purple-500 text-white font-bold rounded text-[10px] animate-pulse">ĐANG VẬN CHUYỂN</span>`;
                else if(x.status === "DANG_RUA") statusBadge = `<span class="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded text-[10px]">HÀNG ĐỢI RỬA</span>`;
                else if(x.status === "TRONG_BUONG_RUA") statusBadge = `<span class="px-2 py-0.5 bg-cyan-600 text-white font-bold rounded text-[10px]">ĐANG RỬA MÁY</span>`;
                else if(x.status === "CHO_CAP_PHAT") statusBadge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] border border-amber-200">CHỜ CẤP PHÁT</span>`;
                
                let fontColor = ""; let loGoc = listGiaoDich.find(m => m.batchCode === x.batchCode && m.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64); 
                let anhBase64 = loGoc?.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64 || x.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64;
                if (anhBase64) fontColor = `<br><span onclick="handleViewAnhBiMoi('${x.firestoreId}')" class="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-300 rounded px-1 cursor-pointer font-bold mt-1 inline-block"><i class="fa-solid fa-image mr-1"></i>Xem ảnh BI</span>`;
                
                let kpiHtml = x.ketQuaGiamSatKpi ? `<br><span class="text-[9px] px-1 rounded font-black border mt-1 inline-block ${x.ketQuaGiamSatKpi === "ĐẠT" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}">KPI: ${x.ketQuaGiamSatKpi} (${x.thoiGianTinhKpiPhut}m)</span>` : "";
                let thongTinKemTheo = x.nvXuatKho || '<span class="text-slate-300 font-normal">Chưa xuất</span>';
                if (x.nguoiKyNhanKhoa) thongTinKemTheo += ` ➔ <span class="text-emerald-700 font-semibold">[ĐD: ${x.nguoiKyNhanKhoa}]</span>`;
                if (x.status === "DA_SU_DUNG" && x.thongTinBenhNhan) thongTinKemTheo = `<span class="text-teal-700 font-black">BN: ${x.thongTinBenhNhan.thongTinTimKiemBN}</span>`;

                return `<tr class="border-b text-xs hover:bg-slate-50 transition-colors"><td class="p-3 font-mono font-bold text-sky-700">${x.maMacDinh || 'N/A'}</td><td class="p-3 font-bold text-slate-800">${x.bo ? String(x.bo).split(" [ID:")[0] : 'N/A'}</td><td class="p-3 font-semibold text-slate-500">${x.khoa || 'N/A'}</td><td class="p-3 text-center">${statusBadge}${kpiHtml}</td><td class="p-3 text-center font-mono font-black text-rose-700 bg-rose-50/30">${x.batchCode || 'N/A'}${fontColor}</td><td class="p-3 text-center font-bold text-sky-800 bg-sky-50/40">${thongTinKemTheo}</td><td class="p-3 text-center text-slate-400 font-mono text-[11px]">${x.ngayTao || ''} ${x.time || ''}</td></tr>`;
            }).join('');
        }
    }
    else if(activeTab === 'tracuu') {
        let safeTbody = document.getElementById("bangLichSuTruyXuatAdmin");
        if (!safeTbody) {
            let parentContainer = document.getElementById("tab-tracuu") || document.querySelector('.bg-white.p-6.rounded-xl.shadow-md');
            if(parentContainer) {
                let existingTableZone = document.getElementById("vung-ket-qua-tu-dong");
                if(!existingTableZone) {
                    let tableWrapper = document.createElement("div"); tableWrapper.id = "vung-ket-qua-tu-dong"; tableWrapper.className = "mt-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm";
                    tableWrapper.innerHTML = `<h3 class="font-black text-slate-800 text-sm mb-3 text-sky-800"><i class="fa-solid fa-list-check mr-2"></i>DANH SÁCH MÂM DỤNG CỤ TRONG MẺ TRUY VẾT</h3><div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead><tr class="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b"><th class="p-3">Mã ID Khay</th><th class="p-3">Tên Bộ Dụng Cụ</th><th class="p-3">Khoa Sử Dụng</th><th class="p-3">Trạng thái</th><th class="p-3 text-center">Mã Lô Hấp</th><th class="p-3 text-center">Thời Gian Kích Hoạt</th></tr></thead><tbody id="bangLichSuTruyXuatAdmin"></tbody></table></div>`;
                    parentContainer.appendChild(tableWrapper); safeTbody = document.getElementById("bangLichSuTruyXuatAdmin");
                }
            }
        }
        let searchInp = maLoTruyVetToanCuc || ""; if (!searchInp && document.getElementById("inp_searchBatch")) { searchInp = document.getElementById("inp_searchBatch").value.trim(); }
        if(safeTbody) {
            if (!searchInp) { safeTbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Vui lòng nhập mã mẻ hấp và nhấn "TRA CỨU KHẨN CẤP"...</td></tr>`; return; }
            let dataFiltered = listGiaoDich.filter(x => x.batchCode && String(x.batchCode).toUpperCase().includes(searchInp.toUpperCase()));
            if(dataFiltered.length === 0) { safeTbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500 italic font-bold">Không tìm thấy dữ liệu: ${searchInp}</td></tr>`; } 
            else { safeTbody.innerHTML = dataFiltered.map(x => `<tr class="border-b text-xs hover:bg-slate-50 font-medium"><td class="p-3 font-mono font-bold text-sky-700">${x.maMacDinh || 'N/A'}</td><td class="p-3 font-bold text-slate-800">${x.bo ? String(x.bo).split(" [ID:")[0] : "N/A"}</td><td class="p-3 font-semibold text-slate-500">${x.khoa || 'N/A'}</td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] ${x.status === "HOAN_TAT" ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-teal-100 text-teal-800"}">${x.status}</span></td><td class="p-3 text-center font-mono font-black text-rose-700 bg-rose-50/40">${x.batchCode || 'N/A'}</td><td class="p-3 text-center text-slate-400 font-mono">${x.ngayTao || ''} ${x.time || ''}</td></tr>`).join(''); }
        }
    }
    else if(activeTab === 'performance') { renderKpiPerformanceGoc(); }
    else if(activeTab === 'dashboard_tv') { renderDashboardTiviRealtime(); }
}

function renderKhoVoKhuan(listData) {
    const tbody = document.getElementById("bangKhoVoKhuan");
    if (!tbody) return;

    if (!listData || listData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Kho vô khuẩn hiện tại trống.</td></tr>`;
        return;
    }

    tbody.innerHTML = listData.map(item => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3.5 font-bold text-slate-800 text-xs">${item.bo ? String(item.bo).split(" [ID:")[0] : 'N/A'}</td>
            <td class="p-3.5 font-mono font-black text-sky-700 text-xs">${item.maMacDinh || '--'}</td>
            <td class="p-3.5 text-center font-semibold text-slate-600 text-xs">${item.khoa || 'Tập trung'}</td>
            <td class="p-3.5 text-center"><span class="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[11px]">${item.viTriKe || 'Kệ A1'}</span></td>
            <td class="p-3.5 text-center font-mono font-bold text-xs text-rose-600">${item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN') : 'An toàn'}</td>
            <td class="p-2 text-center">
                <button onclick="xuatKhoXoayVong('${item.maMacDinh}')" 
                        class="min-h-[44px] px-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm inline-flex items-center gap-1.5 transition-transform active:scale-95">
                    <i class="fa-solid fa-cart-flatbed"></i>
                    <span>Xuất Khay</span>
                </button>
            </td>
        </tr>
    `).join('');
}

// =========================================================================
// VÁ LỖI CÁC HÀM TRUY VẾT & ĐỒNG BỘ HIỆU SUẤT TV MÀN HÌNH
// =========================================================================
function truyVetTheoMaBatch() {
    const inp = document.getElementById("inp_searchBatch");
    if (inp) {
        maLoTruyVetToanCuc = inp.value.trim();
        playSound('success');
        callRender();
    }
}

function clearTruyVetBatch() {
    const inp = document.getElementById("inp_searchBatch");
    if (inp) inp.value = "";
    maLoTruyVetToanCuc = "";
    callRender();
}

function resetDuLieuKet() {
    if (confirm("Anh Hùng có chắc chắn muốn giải phóng các mâm đang xử lý dở dang (chưa Hoàn tất / Chưa dùng) về trạng thái Chờ thu gom?")) {
        let p = [];
        listGiaoDich.forEach(x => {
            if (x.status !== "HOAN_TAT" && x.status !== "DA_SU_DUNG") {
                p.push(db.collection("phieuGiaoNhan").doc(x.firestoreId).update({ status: "CHO_THU" }));
            }
        });
        Promise.all(p).then(() => {
            playSound('success');
            showToast("Đã giải phóng dữ liệu mâm kẹt thành công!", "success");
            callRender();
        });
    }
}

function renderKpiPerformanceGoc() {
    const tbody = document.getElementById("bangHieuSuatKTV");
    if (!tbody) return;
    let kpiGop = {};
    listGiaoDich.forEach(x => {
        let ktv = x.ktvThuGom || x.nvXuatKho || "CSSD_CHUNG";
        if (!kpiGop[ktv]) kpiGop[ktv] = { code: ktv, ten: ktv, dat: 0, tong: 0 };
        if (x.ketQuaGiamSatKpi === "ĐẠT") kpiGop[ktv].dat += 1;
        if (x.ketQuaGiamSatKpi) kpiGop[ktv].tong += 1;
    });
    let sortedKpi = Object.values(kpiGop).sort((a,b) => b.dat - a.dat);
    if(sortedKpi.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center italic text-slate-400">Hôm nay chưa có dữ liệu mẻ KPI nào.</td></tr>`;
    } else {
        tbody.innerHTML = sortedKpi.map((item, idx) => `
            <tr class="border-b text-xs hover:bg-slate-50 font-medium">
                <td class="p-3 text-center font-bold">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-sky-700">${item.code}</td>
                <td class="p-3 font-bold text-slate-800">${item.ten}</td>
                <td class="p-3 text-center"><span class="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-black">${item.dat}/${item.tong} Mẻ Đạt KPI</span></td>
            </tr>
        `).join('');
    }
}

function renderDashboardTiviRealtime() {
    let meRuaInDay = listGiaoDich.filter(x => x.rua_batchCode).length;
    let meHapInDay = listGiaoDich.filter(x => x.batchCode).length;
    let dangRua = listGiaoDich.filter(x => x.status === "TRONG_BUONG_RUA").length;
    let dangHap = listGiaoDich.filter(x => x.status === "DANG_HAP").length;
    let sanSangXuat = listGiaoDich.filter(x => x.status === "CHO_XUAT").length;
    
    const today = new Date(); today.setHours(0,0,0,0);
    let quaHan = 0;
    listGiaoDich.forEach(x => {
        if (x.hsd && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT")) {
            if (new Date(x.hsd) < today) quaHan++;
        }
    });

    if (document.getElementById('tv_meRua')) document.getElementById('tv_meRua').innerText = meRuaInDay;
    if (document.getElementById('tv_meHap')) document.getElementById('tv_meHap').innerText = meHapInDay;
    if (document.getElementById('tv_meHap2')) document.getElementById('tv_meHap2').innerText = meHapInDay;
    if (document.getElementById('tv_dangRua')) document.getElementById('tv_dangRua').innerText = dangRua;
    if (document.getElementById('tv_dangHap')) document.getElementById('tv_dangHap').innerText = dangHap;
    if (document.getElementById('tv_khoVoKhuan')) document.getElementById('tv_khoVoKhuan').innerText = sanSangXuat;
    if (document.getElementById('tv_canhBaoHsd')) document.getElementById('tv_canhBaoHsd').innerText = quaHan;
}

function renderAdminInterface() {
    if (document.getElementById("cfg_pinAdmin")) document.getElementById("cfg_pinAdmin").value = thongTinMatKhauAdmin.adminPIN || "";
    if (document.getElementById("cfg_pinCSSD")) document.getElementById("cfg_pinCSSD").value = thongTinMatKhauAdmin.cssdPIN || "";
    if (document.getElementById("cfg_pinGuest")) document.getElementById("cfg_pinGuest").value = thongTinMatKhauAdmin.guestPIN || "";
    
    const MatrixRoles = ["CSSD", "KHOA", "GUEST"];
    
    const MatrixTabs = [
        { id: "khoaphong", name: "Cổng Báo Trả Đồ" },
        { id: "thugom", name: "Xe Thu Gom" },
        { id: "mayrua", name: "Quản Lý Mẻ Rửa" },
        { id: "donggoi", name: "Làm Sạch & Đóng Gói" },
        { id: "mayhap", name: "Quản Lý Mẻ Hấp" },
        { id: "khovokhuan", name: "Kho Vô Khuẩn" },
        { id: "quanlykho", name: "Tồn Kho Toàn Viện" },
        { id: "danhmuc", name: "Giám Sát Tuổi Thọ Dụng Cụ" },
        { id: "lichsuluanchuyen", name: "Nhật Ký Luân Chuyển" },
        { id: "tracuu", name: "Truy xuất mẻ tiệt trùng" },
        { id: "performance", name: "Hiệu Suất KPI" },
        { id: "dashboard_tv", name: "Màn Hình Tivi" },
        { id: "admin", name: "Quản Trị Hệ Thống" }
    ];
    
    let htmlMatrix = "";
    MatrixTabs.forEach(tab => {
        htmlMatrix += `<tr class="border-b font-medium text-xs hover:bg-slate-50"><td class="p-3 font-bold text-slate-700">${tab.name}</td>`;
        MatrixRoles.forEach(role => {
            let isChecked = (cauHinhGiaoDien[role] && cauHinhGiaoDien[role].includes(tab.id)) ? "checked" : "";
            htmlMatrix += `<td class="p-3 text-center"><input type="checkbox" ${isChecked} onchange="updateGiaoDienMatrix('${role}', '${tab.id}', this)" class="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"></td>`;
        });
        htmlMatrix += `</tr>`;
    });
    const tbodyMatrix = document.getElementById("bodyMaTranGiaoDien"); if (tbodyMatrix) tbodyMatrix.innerHTML = htmlMatrix;
    const trKhoa = document.getElementById("bangPhanQuyenKhoa");
    if(trKhoa) {
        if(danhSachKhoa.length === 0) { trKhoa.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-rose-500 font-bold italic">Danh sách Khoa trống.</td></tr>`; } 
        else { trKhoa.innerHTML = danhSachKhoa.map((k, index) => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-black text-slate-700 text-[11px]">${k.ten}</td><td class="p-3 text-center border-x border-slate-200 font-mono font-black text-rose-600 text-sm bg-rose-50/50">${k.pin || '123'}</td><td class="p-3 text-center"><div class="flex items-center justify-center gap-2"><input type="text" id="pin-khoa-${index}" placeholder="PIN" class="w-24 p-1.5 text-center border border-slate-300 rounded text-xs font-bold"><button onclick="updatePINTrựcTiep(${index}, '${k.ten}')" class="bg-sky-600 text-white font-bold py-1.5 px-3 rounded shadow text-[10px]">ĐỔI PIN</button></div></td></tr>`).join(''); }
    }
    const tbKtv = document.getElementById("bangNhanVienCssd");
    if(tbKtv) {
        if(danhSachKtvCssd.length === 0) { tbKtv.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Chưa có Nhân viên.</td></tr>`; }
        else { tbKtv.innerHTML = danhSachKtvCssd.map((nv, index) => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-black text-sky-700 text-xs">${nv.code}</td><td class="p-3 font-bold text-slate-700 text-[11px]">${nv.ten}</td><td class="p-3 text-center border-x border-slate-200 font-mono font-black text-sky-600 text-sm bg-sky-50/50">${nv.pin}</td><td class="p-3 text-center"><button onclick="xaoKtvCssd('${nv.code}')" class="text-rose-600 font-bold text-[10px]"><i class="fa-solid fa-trash-can mr-1"></i>XÓA</button></td></tr>`).join(''); }
    }
}

// =========================================================================
// 14. XỬ LÝ ĐỌC FILE EXCEL ĐA SHEET
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("excelFileInput");
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    let updateData = {};
                    let logs = [];

                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet);
                        if (jsonData.length === 0) return;

                        const firstRow = jsonData[0];
                        const keys = Object.keys(firstRow).map(k => k.trim().toUpperCase());

                        const coCotMaDC = keys.includes("MÃ DC");
                        if (coCotMaDC) {
                            let mapKhoa = {};
                            danhSachKhoa.forEach(k => {
                                mapKhoa[k.ten.trim().toUpperCase()] = {
                                    ten: k.ten.trim().toUpperCase(),
                                    pin: k.pin || "123",
                                    danhSachBo: []
                                };
                            });

                            jsonData.forEach(row => {
                                let rawKeyKhoa = Object.keys(row).find(k => k.trim().toUpperCase() === "TÊN TS (I)");
                                let rawKeyBo = Object.keys(row).find(k => k.trim().toUpperCase() === "TÊN TS CHUẨN");
                                let rawKeyMa = Object.keys(row).find(k => k.trim().toUpperCase() === "MÃ DC");

                                let tenKhoa = rawKeyKhoa ? row[rawKeyKhoa] : null;
                                let tenBo = rawKeyBo ? row[rawKeyBo] : null;
                                let maKhay = rawKeyMa ? row[rawKeyMa] : null;

                                if (tenKhoa && tenBo) {
                                    let keyKhoa = String(tenKhoa).trim().toUpperCase();
                                    let cleanBo = String(tenBo).trim().toUpperCase();
                                    let cleanMa = maKhay ? String(maKhay).trim().toUpperCase() : "CHUA_CO_ID";
                                    let chuoiDinhDangKhay = `${cleanBo} [ID:${cleanMa}]`;

                                    if (!mapKhoa[keyKhoa]) {
                                        mapKhoa[keyKhoa] = { ten: keyKhoa, pin: "123", danhSachBo: [] };
                                    }
                                    if (!mapKhoa[keyKhoa].danhSachBo.includes(chuoiDinhDangKhay)) {
                                        mapKhoa[keyKhoa].danhSachBo.push(chuoiDinhDangKhay);
                                    }
                                }
                            });

                            updateData.danhSachKhoa = Object.values(mapKhoa);
                            logs.push(`Cập nhật định biên cơ số cho ${updateData.danhSachKhoa.length} Khoa/Phòng`);
                        }

                        const coCotMaAesculap = keys.includes("AB 120/12");
                        if (coCotMaAesculap) {
                            updateData.databaseExcel = jsonData;
                            logs.push(`Nạp thành công ${jsonData.length} linh kiện chi tiết mâm Aesculap`);
                        }
                    });

                    if (Object.keys(updateData).length === 0) {
                        return showToast("Không tìm thấy cấu trúc dữ liệu phù hợp (Cột 'MÃ DC' hoặc 'AB 120/12') trong file Excel up lên!", "error");
                    }

                    db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update(updateData)
                    .then(() => {
                        playSound('success');
                        showToast(`Đồng bộ thành công: ${logs.join(" | ")}!`, "success");
                        fileInput.value = ""; 
                        callRender();
                    }).catch(err => {
                        console.error("Lỗi cập nhật Firestore:", err);
                        showToast("Thất bại khi đẩy dữ liệu lên Cloud Firestore!", "error");
                    });

                } catch (err) {
                    console.error("Lỗi FileReader:", err);
                    showToast("Định dạng file không được hỗ trợ hoặc bị lỗi!", "error");
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
});
