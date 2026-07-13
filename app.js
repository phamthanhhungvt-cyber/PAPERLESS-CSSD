// =========================================================================
// 1. KHỞI TẠO HỆ THỐNG & CẤU HÌNH BIẾN TOÀN CỤC
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
    "ADMIN": ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'],
    "CSSD": ['thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','dashboard_tv'], 
    "KHOA": ['khoaphong','quanlykho','lichsuluanchuyen'], 
    "GUEST": ['quanlykho','danhmuc','lichsuluanchuyen','performance','dashboard_tv']
};

let currentRole = "", loginUserCode = "";
let danhSachKhoa = [], listGiaoDich = [], gioHangTam = [], danhSachKtvCssd = [], databaseExcel = [];
let html5QrCode = null; let targetInputIdForScan = ""; let idDangDongGoi = null;
let activeTab = 'thugom'; let renderTimeout = null;
let duLieuAnhBiTamBase64 = ""; let maLoTruyVetToanCuc = ""; 
let gioHangXuatKho = []; let gioKhaySuDungTam = []; 

const cauHinhMayHap = { "Hấp hơi nước": ["A1", "A2", "A3", "A4"], "Hấp H2O2 (Plasma)": ["P1", "P2"], "Khử khuẩn EO": ["EO1", "EO2"] };

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
    ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].forEach(x => {
        document.getElementById('menu-' + x)?.classList.add('hidden');
    });
}

function apDungPhanQuyenGiaoDien(role) {
    anTatCaHeadersVaMenus();
    if (role === "ADMIN") {
        ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].forEach(tab => {
            document.getElementById('menu-' + tab)?.classList.remove('hidden');
        });
        document.getElementById('header-lamsang')?.classList.remove('hidden');
        document.getElementById('header-vanhanh')?.classList.remove('hidden');
        document.getElementById('header-dulieu')?.classList.remove('hidden');
        return;
    }
    let tabsDuocPhep = cauHinhGiaoDien[role] || [];
    tabsDuocPhep.forEach(tab => { document.getElementById('menu-' + tab)?.classList.remove('hidden'); });
    if (tabsDuocPhep.includes('khoaphong')) document.getElementById('header-lamsang')?.classList.remove('hidden');
    if (['thugom','donggoi','mayhap','khovokhuan'].some(t => tabsDuocPhep.includes(t))) document.getElementById('header-vanhanh')?.classList.remove('hidden');
    if (['quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].some(t => tabsDuocPhep.includes(t))) document.getElementById('header-dulieu')?.classList.remove('hidden');
}

function switchTab(t) { 
    if (currentRole !== "ADMIN") {
        let tabsDuocPhep = cauHinhGiaoDien[currentRole] || [];
        if(!tabsDuocPhep.includes(t)) { return showToast("Tài khoản không có quyền truy cập!", "error"); }
    }
    ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].forEach(x => { 
        document.getElementById('tab-'+x)?.classList.add('hidden'); document.getElementById('menu-'+x)?.classList.remove('sidebar-item-active'); 
    }); 
    document.getElementById('tab-'+t)?.classList.remove('hidden'); document.getElementById('menu-'+t)?.classList.add('sidebar-item-active'); 
    activeTab = t; 
    if (t === 'mayhap') { setTimeout(() => { tuDongTaoMaLoMeHap(); }, 50); }
    callRender(); 
}

// =========================================================================
// 4. TRẠM 1: CỔNG LÂM SÀNG & BÁO TRẢ ĐỒ BẨN
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
    document.getElementById("bangGioHang").innerHTML = gioHangTam.map(i => `<tr><td class="p-2.5 font-bold text-sky-700 text-[11px]">${i.bo}</td></tr>`).join(''); 
}

function clearGioHang() { gioHangTam = []; renderGioHang(); }

function khoaGuiPhieuTraBatches() { 
    const k = currentRole === "KHOA" ? loginUserCode : document.getElementById("khoa_selKhoa").value; 
    if(!k) return showToast("Vui lòng chọn Khoa trước!"); 
    if(gioHangTam.length === 0) return showToast("Không có dụng cụ trong danh sách!"); 
    let p=[]; 
    gioHangTam.forEach((i,idx) => p.push(db.collection("phieuGiaoNhan").add({ id: Date.now()+idx, ngayTao: getTodayDateStr(), time: new Date().toLocaleTimeString('vi-VN'), khoa: k, bo: i.bo, maMacDinh: i.maMacDinh, slYeuCau: 1, slThucTe: 1, status: "CHO_THU" }))); 
    Promise.all(p).then(() => { clearGioHang(); showToast("Đã gửi lệnh thu gom!", "success"); callRender(); }); 
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
        let boName = x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || x['NAME'] || x['name']; 
        return String(boName).trim().toUpperCase() === String(currentKiemDemData.tenBoDungCu).trim().toUpperCase(); 
    });

    let checklistSoBo = [];
    if(itemsInBo.length > 0) {
        checklistSoBo = itemsInBo.map(ct => {
            let tenDc = ct['Tên Dụng Cụ Chi Tiết'] || ct['Tên dụng cụ'] || ct['Chi tiết'] || ct['Dụng cụ'] || ct['TÊN BỘ'] || ct['Tên Chi Tiết'] || ct['NAME'] || "Dụng cụ";
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

// =========================================================================
// 6. TRẠM 3: LÀM SẠCH VÀ ĐÓNG GÓI
// =========================================================================
function moPopupDongGoi(id) { idDangDongGoi = id; let item = listGiaoDich.find(x => x.firestoreId === id); if(item) { document.getElementById("popDG_Bo").innerText = item.bo; tinhHanSuDung(); document.getElementById("popupDongGoi").classList.remove("hidden"); } }
function closePopupDongGoi() { document.getElementById("popupDongGoi").classList.add("hidden"); }
function tinhHanSuDung() { let val = document.getElementById("popDG_Loai").value.split("|"); let days = parseInt(val[1]); let dateHSD = new Date(); dateHSD.setDate(dateHSD.getDate() + days); let p = document.getElementById("popDG_Han"); p.innerText = dateHSD.toLocaleDateString('vi-VN'); p.dataset.dateDB = dateHSD.toISOString().split('T')[0]; }
function chotDongGoi() { if(!idDangDongGoi) return; let chatLieuTen = document.getElementById("popDG_Loai").value.split("|")[0]; db.collection("phieuGiaoNhan").doc(idDangDongGoi).update({ status: "CHO_HAP", chatLieu: chatLieuTen, hsd: document.getElementById("popDG_Han").dataset.dateDB }).then(() => { showToast("Đã đóng gói, chuyển chờ hấp!", "success"); closePopupDongGoi(); callRender(); }); }

// =========================================================================
// 7. TRẠM 4: VẬN HÀNH MẺ HẤP & DUYỆT NHẬP KHO VÔ KHUẨN
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
    let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm dụng cụ!", "error"); 
    let loaiHap = document.getElementById("hap_loaiHap").value; let maMay = document.getElementById("hap_maySo").value; let batchCode = document.getElementById("hap_batchId").value; let chuKyNhiet = document.getElementById("hap_nhietDo").value; let apSuat = document.getElementById("hap_apSuat").value || "N/A"; 
    let coKemBI = document.getElementById("hap_hasBI") ? document.getElementById("hap_hasBI").checked : false;
    const ngayHomNay = getTodayDateStr(); let bayGio = new Date(); let thoiGianDuKienXong = new Date(bayGio.getTime() + 45 * 60 * 1000);

    let p = []; 
    checkboxes.forEach(cb => { 
        if(cb.id === 'selectAllHap') return; 
        let itemData = listGiaoDich.find(x => x.firestoreId === cb.value);
        let thongTinLo = { 
            loaiHap: loaiHap, maMay: maMay, chuKyNhiet: chuKyNhiet, apSuat: apSuat, thoiGianBatDau: bayGio.toLocaleTimeString('vi-VN'), 
            giamSatChatLuong: { chiThiHoaHoc: "ĐẠT", laMeTestSinhHocGoc: coKemBI, ketQuaSinhHoc: coKemBI ? "ĐANG CHỜ MÁY Ủ ĐỌC BI (20 PHÚT)" : "KẾ THỪA ĐẦU NGÀY" } 
        };
        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({ 
                status: "DANG_HAP", batchCode: batchCode, ngayHapRealtime: ngayHomNay, hasBI: coKemBI, thoiGianKetThucChuTrinh: thoiGianDuKienXong.toISOString(), thongTinLoHap: thongTinLo 
            }).then(() => { if(itemData) dongBoSangMicrosoft365("KICH_HOAT_ME_HAP", { ...itemData, batchCode: batchCode, hasBI: coKemBI, thongTinLoHap: thongTinLo }); })
        ); 
    }); 
    Promise.all(p).then(() => { 
        showToast(`Kích hoạt lò thành công! Lô: ${batchCode}`, "success"); 
        if(document.getElementById("hap_hasBI")) document.getElementById("hap_hasBI").checked = false; 
        duLieuAnhBiTamBase64 = ""; tuDongTaoMaLoMeHap(); callRender(); 
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
        nutDuyetDat.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded text-xs shadow-md flex items-center justify-center gap-2";
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

        let capNhatGiamSat = {
            ...itemData.thongTinLoHap?.giamSatChatLuong,
            ketQuaSinhHoc: coKemBI ? "ÂM TÍNH (ĐẠT)" : "KẾ THỪA ĐẦU NGÀY",
            minChungAnhBase64: coKemBI ? duLieuAnhBiTamBase64 : (itemData.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64 || "")
        };

        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({
                status: "CHO_XUAT", thoiGianKetLuan: bayGio.toISOString(), thoiGianDocTestBiPhut: soPhutThucTe, 
                thoiGianTinhKpiPhut: soPhutTinhKPI, ketQuaGiamSatKpi: trangThaiKPI, "thongTinLoHap.giamSatChatLuong": capNhatGiamSat
            }).then(() => {
                dongBoSangMicrosoft365("NGHIEM_THU_DAT_VOHUAN", { 
                    ...itemData, status: "CHO_XUAT", thoiGianDocTestBiPhut: soPhutThucTe, thoiGianTinhKpiPhut: soPhutTinhKPI,
                    ketQuaGiamSatKpi: trangThaiKPI, thongTinLoHap: { ...itemData.thongTinLoHap, giamSatChatLuong: capNhatGiamSat }
                });
            })
        ); 
    }); 
     
    Promise.all(p).then(() => { 
        showToast("Đã duyệt mâm đạt chuẩn Vô Khuẩn!", "success"); 
        duLieuAnhBiTamBase64 = ""; const fileInp = document.getElementById("input_anhBI"); if(fileInp) fileInp.value = ""; 
        callRender(); 
    }); 
}

function tuChoiHapHangLoat() { 
    let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn mâm dụng cụ!", "error"); 
    let p = []; 
    checkboxes.forEach(cb => { if(cb.id !== 'selectAllNghiemThu') p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({status: "DANG_RUA", ghiChu: "Không đạt hấp, trả về rửa lại"})); }); 
    Promise.all(p).then(() => { showToast("Đã trả các mâm không đạt về Trạm làm sạch!", "success"); callRender(); }); 
}

// =========================================================================
// 8. TRẠM 5: KHO VÔ KHUẨN & PHỐI HỢP XUẤT KHO XOAY VÒNG (FIFO)
// =========================================================================
function xuatKhoXoayVong() { 
    const k = document.getElementById("xuat_selKhoa").value; let ma = document.getElementById("xuat_inpMaBo").value.trim().toUpperCase(); 
    if(!k) { playSound('error'); return showToast("Vui lòng Chọn Khoa nhận trước khi quét mã!", "error"); } 
    if(!ma) return;
    if(gioHangXuatKho.some(x => x.maMacDinh === ma)) { playSound('error'); document.getElementById("xuat_inpMaBo").value = ""; return showToast("Mã này đã có trong danh sách xuất!", "error"); }
    
    let khayThucTe = listGiaoDich.find(x => x.maMacDinh === ma && x.status === "CHO_XUAT"); 
    if(!khayThucTe) { playSound('error'); document.getElementById("xuat_inpMaBo").value = ""; return showToast(`Mã ID ${ma} không sẵn sàng ở Kho Vô Khuẩn.`, "error"); } 
    
    gioHangXuatKho.push(khayThucTe); playSound('success'); document.getElementById("xuat_inpMaBo").value = ""; renderGioHangXuat();
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
            }).then(() => { dongBoSangMicrosoft365("XAC_NHAN_XUAT_KHO", { ...khay, status: "ĐANG_VAN_CHUYEN", khoa: k }); })
        ); 
    });
    Promise.all(p).then(() => { 
        playSound('success'); showToast(`Đã xuất kho bàn giao về Khoa ${k}!`, "success"); 
        gioHangXuatKho = []; if (document.getElementById("xuat_inpMaBo")) document.getElementById("xuat_inpMaBo").value = ""; 
        renderGioHangXuat(); callRender(); 
    });
}

function khoaKyNhanDoSachDienTu() {
    const khoaDangNhap = currentRole === "KHOA" ? loginUserCode : (document.getElementById("khoa_selKhoa") ? document.getElementById("khoa_selKhoa").value : "");
    const nameNguoiDung = loginUserCode || "Điều dưỡng khoa";
    const checkboxes = document.querySelectorAll("#bangChoNhanTaiKhoa input[type='checkbox']:checked");
    const dsIdDuocChon = []; checkboxes.forEach(chk => dsIdDuocChon.push(chk.value));

    if (dsIdDuocChon.length === 0) { playSound('error'); return showToast("Vui lòng tích chọn khay để nhận!", "error"); }

    if (confirm(`Xác nhận ký điện tử nhận ${dsIdDuocChon.length} mâm về khoa ${khoaDangNhap}?`)) {
        let p = [];
        dsIdDuocChon.forEach(idDoc => {
            let itemData = listGiaoDich.find(x => x.firestoreId === idDoc);
            p.push(
                db.collection("phieuGiaoNhan").doc(idDoc).update({
                    status: "HOAN_TAT", nguoiKyNhanKhoa: nameNguoiDung, timeKhoaNhanThucTe: new Date().toLocaleTimeString('vi-VN'), ngayKhoaNhanThucTe: getTodayDateStr()
                }).then(() => { if(itemData) dongBoSangMicrosoft365("KHOA_KY_NHAN_DO_SACH", { ...itemData, status: "HOAN_TAT" }); })
            );
        });
        Promise.all(p).then(() => { playSound('success'); showToast(`Đã nhận đồ vô khuẩn vào tủ khoa!`, "success"); callRender(); });
    }
}

// =========================================================================
// 9. MODULE MỚI: LIÊN KẾT MÂM DỤNG CỤ VÀO HỒ SƠ BỆNH ÁN CHI TIẾT
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

function xoaKhayKhoiListSuDung(index) { gioKhaySuDungTam.splice(index, 1); renderBangKhaySuDung(); }

function savePopupSuDung() {
    let khoaBN = document.getElementById("sd_khoaBenhNhan").value.trim();
    let yTaPM = document.getElementById("sd_yTaPhongMo").value.trim();
    let searchBN = document.getElementById("sd_searchBN").value.trim();
    if(!khoaBN || !yTaPM || !searchBN) return showToast("Vui lòng điền đủ trường bắt buộc (*)", "error");
    if(gioKhaySuDungTam.length === 0) return showToast("Danh sách khay trống!", "error");

    let batchUpdates = []; let ngaySuDung = document.getElementById("sd_ngaySuDung").value;
    let yTaVN = document.getElementById("sd_yTaVongNgoai").value.trim(); let ghiChu = document.getElementById("sd_ghiChu").value.trim();
    let nhanChung = document.getElementById("sd_nhanChung").value;

    gioKhaySuDungTam.forEach(khay => {
        let thongTinMoi = {
            status: "DA_SU_DUNG",
            thongTinBenhNhan: { khoaBenhNhan: khoaBN, yTaPhongMo: yTaPM, yTaVongNgoai: yTaVN || "N/A", thongTinTimKiemBN: searchBN, ngaySuDung: ngaySuDung, timeSuDung: new Date().toLocaleTimeString('vi-VN'), nhanChungYTe: nhanChung, ghiChuLamSang: ghiChu }
        };
        batchUpdates.push(db.collection("phieuGiaoNhan").doc(khay.firestoreId).update(thongTinMoi).then(() => {
            dongBoSangMicrosoft365("GHI_NHAN_SU_DUNG_BN", { ...khay, status: "DA_SU_DUNG", khoa: khoaBN, thongTinLoHap: { ...khay.thongTinLoHap, giamSatChatLuong: { ketQuaSinhHoc: `Sử dụng BN: ${searchBN}` } } });
        }));
    });

    Promise.all(batchUpdates).then(() => { playSound('success'); showToast(`Đã liên kết bệnh án thành công!`, "success"); closePopupSuDung(); callRender(); });
}

// =========================================================================
// 10. THIẾT LẬP MÁY IN BIXOLON SLP-TX403 & BIÊN BẢN HÀNG LOẠT
// =========================================================================
function inTemTongHangLoat() { 
    let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!", "error"); 
    let batchCode = document.getElementById("hap_batchId")?.value || "A1000000_01"; 
    let container = document.createElement('div'); container.className = "print-label-container"; container.style.width = "100%"; 
    let stylePrint = document.createElement('style'); 
    stylePrint.innerHTML = `@media print { body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; background: white; } @page { size: 80mm 50mm; margin: 0; } .single-tem { width: 100% !important; height: 50mm !important; page-break-inside: avoid; break-inside: avoid; page-break-after: always; margin: 0 !important; padding: 6px !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; } }`; 
    container.appendChild(stylePrint); 

    checkboxes.forEach((cb) => { 
        let item = listGiaoDich.find(x => x.firestoreId === cb.value); 
        if(item) { 
            let cleanBo = item.bo ? String(item.bo).split(" [ID:")[0] : "N/A"; let dateHapStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-'); let dateHsdStr = item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN').replace(/\//g, '-') : dateHapStr; 
            container.innerHTML += `<div class="single-tem" style="font-family: Arial; font-size: 11px; color: #000; background: #fff; border: 1px solid #000;"><div style="text-align: center; font-weight: bold; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cleanBo}</div><div style="text-align: center; margin: 2px 0;"><svg id="barcode-lo-${item.firestoreId}"></svg></div><div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px;"><span>SL: ${item.slThucTe || 1}</span></div><div style="display: flex; justify-content: space-between; border-top: 1px dashed #000; padding-top: 3px; font-size: 10px; margin-top: 2px;"><span>NSX: ${dateHapStr}</span><strong>HSD: ${dateHsdStr}</strong></div><div style="text-align: center; font-size: 9px; font-family: monospace; font-weight: bold; margin-top: 1px;">Lô: ${batchCode}</div></div>`; 
        } 
    }); 
    const pZone = document.getElementById("print-zone"); pZone.innerHTML = ""; pZone.appendChild(container); pZone.classList.remove("hidden"); 
    checkboxes.forEach(cb => { 
        let item = listGiaoDich.find(x => x.firestoreId === cb.value); 
        if(item) { let cleanId = item.maMacDinh ? item.maMacDinh.replace(/[^a-zA-Z0-9]/g, "") : "0000"; JsBarcode(`#barcode-lo-${item.firestoreId}`, cleanId, { format: "CODE128", width: 1.4, height: 32, displayValue: true, fontSize: 10, margin: 2 }); } 
    }); 
    setTimeout(() => { window.print(); pZone.classList.add("hidden"); }, 300); 
}

function inTemNghiemThuHangLoat() { 
    let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn mâm dụng cụ!", "error"); 
    let container = document.createElement('div'); container.className = "print-label-container"; container.style.width = "100%"; 
    let stylePrint = document.createElement('style'); 
    stylePrint.innerHTML = `@media print { body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; background: white; } @page { size: 80mm 50mm; margin: 0; } .single-tem { width: 100% !important; height: 50mm !important; page-break-inside: avoid; break-inside: avoid; page-break-after: always; margin: 0 !important; padding: 6px !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; } }`; 
    container.appendChild(stylePrint); 

    checkboxes.forEach((cb) => { 
        let item = listGiaoDich.find(x => x.firestoreId === cb.value); 
        if(item) { 
            let cleanBo = item.bo ? String(item.bo).split(" [ID:")[0] : "N/A"; let dateHapStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-'); let dateHsdStr = item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN').replace(/\//g, '-') : dateHapStr; 
            container.innerHTML += `<div class="single-tem" style="font-family: Arial; font-size: 11px; color: #000; background: #fff; border: 1px solid #000;"><div style="text-align: center; font-size: 9px; font-weight: bold; letter-spacing: 0.5px;">PN HOSPITAL - CSSD</div><div style="text-align: center; font-weight: bold; font-size: 12px; margin: 1px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cleanBo}</div><div style="text-align: center; margin: 2px 0;"><svg id="barcode-nt-${item.firestoreId}"></svg></div><div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px;"><span>SL: ${item.slThucTe || 1}</span><span style="color: green;">ĐẠT VÔ KHUẨN</span></div><div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 3px; font-size: 10px; margin-top: 2px;"><span>NSX: ${dateHapStr}</span><strong>HSD: ${dateHsdStr}</strong></div><div style="text-align: center; font-size: 8px; font-weight: bold; font-family: monospace; margin-top: 1px;">BATCH: ${item.batchCode || 'N/A'}</div></div>`; 
        } 
    }); 
    const pZone = document.getElementById("print-zone"); pZone.innerHTML = ""; pZone.appendChild(container); pZone.classList.remove("hidden"); 
    checkboxes.forEach(cb => { 
        let item = listGiaoDich.find(x => x.firestoreId === cb.value); 
        if(item) { let cleanId = item.maMacDinh ? item.maMacDinh.replace(/[^a-zA-Z0-9]/g, "") : "0000"; JsBarcode(`#barcode-nt-${item.firestoreId}`, cleanId, { format: "CODE128", width: 1.4, height: 32, displayValue: true, fontSize: 10, margin: 2 }); } 
    }); 
    setTimeout(() => { window.print(); pZone.classList.add("hidden"); }, 300); 
}

function inHoaDonGiaoNhan() {
    const k = currentRole === "KHOA" ? loginUserCode : document.getElementById("khoa_selKhoa").value; if (!k) return showToast("Chọn Khoa trước!", "error");
    let htmlBang = `<table style="width:100%; border-collapse:collapse; margin-top:15px; font-size:12px; text-align:left; font-family:Arial, sans-serif;"><thead><tr style="background-color:#f8fafc; border:1px solid #000;"><th style="padding:8px; border:1px solid #000; width:40%;">PHÂN LOẠI MÂM / LOẠI DỤNG CỤ</th><th style="padding:8px; border:1px solid #000; text-align:center; width:15%;">ĐÃ TRẢ BẨN</th><th style="padding:8px; border:1px solid #000; text-align:center; width:15%;">ĐÃ NHẬN SẠCH</th><th style="padding:8px; border:1px solid #000; text-align:center; width:15%;">NHẬN VÔ KHUẨN</th><th style="padding:8px; border:1px solid #000; text-align:center; width:15%;">CSSD NỢ KHOA</th></tr></thead><tbody>`;
    const rows = document.querySelectorAll('#bangDonGiaoNhan tr');
    if (rows.length === 0 || (rows.length === 1 && rows[0].cells.length === 1)) { htmlBang += `<tr><td colspan="5" style="padding:12px; border:1px solid #000; text-align:center; font-style:italic;">Không có dữ liệu công nợ.</td></tr>`; } 
    else {
        rows.forEach(row => {
            const cells = row.cells;
            if (cells.length >= 4) { htmlBang += `<tr style="border:1px solid #000;"><td style="padding:8px; border:1px solid #000; font-weight:bold;">${cells[0].innerText}</td><td style="padding:8px; border:1px solid #000; text-align:center; color:#e11d48;">${cells[1].innerText}</td><td style="padding:8px; border:1px solid #000; text-align:center; color:#0284c7;">${cells[2].innerText}</td><td style="padding:8px; border:1px solid #000; text-align:center; color:#7c3aed;">${cells[3].innerText}</td><td style="padding:8px; border:1px solid #000; text-align:center; font-weight:bold; color:#d97706;">${cells[4].innerText}</td></tr>`; }
        });
    }
    htmlBang += `</tbody></table>`;
    const pZone = document.getElementById("print-zone");
    pZone.innerHTML = `<div style="width:100%; font-family:Arial, sans-serif; padding:10px; color:#000;"><div style="text-align:center; margin-bottom:20px;"><h2 style="margin:0; font-size:16px; font-weight:900; text-transform:uppercase;">BIÊN BẢN GIAO NHẬN DỤNG CỤ CSSD</h2><p style="margin:5px 0 0 0; font-size:12px; font-weight:bold;">Khoa/Phòng: <span style="text-transform:uppercase;">${k}</span> - Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</p></div>${htmlBang}<div style="margin-top:40px; display:flex; justify-content:space-between; font-size:11px; font-weight:bold; padding:0 20px;"><div style="text-align:center; width:45%;"><p style="margin-bottom:60px; text-transform:uppercase;">ĐIỀU DƯỠNG LÂM SÀNG</p><p style="font-weight:normal; font-style:italic; color:#64748b;">(Ký và ghi rõ họ tên)</p></div><div style="text-align:center; width:45%;"><p style="margin-bottom:60px; text-transform:uppercase;">CHUYÊN VIÊN CSSD</p><p style="font-weight:normal; font-style:italic; color:#64748b;">(Ký và ghi rõ họ tên)</p></div></div></div>`;
    pZone.classList.remove("hidden"); window.print(); pZone.classList.add("hidden");
}

// =========================================================================
// 11. HÀM PHỤ TRỢ: CHỨC NĂNG QUẢN TRỊ ADMIN & TIỆN ÍCH
// =========================================================================
function taiDanhMucLinhKienChuan() {
    const tbody = document.getElementById("bangDanhMucLinhKien"); if (!tbody) return; tbody.innerHTML = "";
    if (!databaseExcel || databaseExcel.length === 0) { tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">Chưa có dữ liệu. Vui lòng nạp file Excel.</td></tr>`; return; }
    let gopBoExcel = {};
    databaseExcel.forEach(x => {
        let tenBo = x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || x['NAME'] || x['name']; if (!tenBo) return;
        tenBo = String(tenBo).trim().toUpperCase(); if (!gopBoExcel[tenBo]) gopBoExcel[tenBo] = []; gopBoExcel[tenBo].push(x);
    });
    for (let tenBo in gopBoExcel) {
        let linhKienHtml = `<div class="flex flex-wrap gap-1">`; let tongSl = 0;
        gopBoExcel[tenBo].forEach(item => {
            let tenDc = item['Tên Dụng Cụ Chi Tiết'] || item['Tên dụng cụ'] || item['Chi tiết'] || item['Dụng cụ'] || item['Tên Chi Tiết'] || "Dụng cụ Chi Tiết";
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

function renderAdminInterface() {
    if (document.getElementById("cfg_pinAdmin")) document.getElementById("cfg_pinAdmin").value = thongTinMatKhauAdmin.adminPIN || "";
    if (document.getElementById("cfg_pinCSSD")) document.getElementById("cfg_pinCSSD").value = thongTinMatKhauAdmin.cssdPIN || "";
    if (document.getElementById("cfg_pinGuest")) document.getElementById("cfg_pinGuest
