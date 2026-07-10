const firebaseConfig = { apiKey: "AIzaSyCxjdCTKHQlpm7SYbWCEws1HhcOaFp0LBA", authDomain: "cssd-system-2878c.firebaseapp.com", projectId: "cssd-system-2878c", storageBucket: "cssd-system-2878c.firebasestorage.app", messagingSenderId: "662377321937", appId: "1:662377321937:web:001c092e10319547623cf0" };
firebase.initializeApp(firebaseConfig); const db = firebase.firestore();

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
let duLieuAnhBiTamBase64 = ""; 
let maLoTruyVetToanCuc = ""; 
let gioHangXuatKho = [];

// [NÂNG CẤP TRẠM 2] Biến lưu trữ đối tượng khay đang thực hiện đối soát checklist trong Modal popup
let currentKiemDemData = null;

function getTodayDateStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

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

const cauHinhMayHap = { "Hấp hơi nước": ["A1", "A2", "A3", "A4"], "Hấp H2O2 (Plasma)": ["P1", "P2"], "Khử khuẩn EO": ["EO1", "EO2"] };

// --- LISTENERS REALTIME ---
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
    listGiaoDich = []; snap.forEach(doc => { let d = doc.data(); d.firestoreId = doc.id; listGiaoDich.push(d); }); 
    callRender();
});

// --- HÀM TẢI VÀ HIỂN THỊ DANH MỤC LINH KIỆN ---
function taiDanhMucLinhKienChuan() {
    const tbody = document.getElementById("bangDanhMucLinhKien");
    if (!tbody) return; tbody.innerHTML = "";
    
    if (!databaseExcel || databaseExcel.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">Chưa có dữ liệu cấu hình bộ linh kiện. Vui lòng nạp file Excel.</td></tr>`;
        return;
    }

    let gopBoExcel = {};
    databaseExcel.forEach(x => {
        let tenBo = x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || x['NAME'] || x['name'];
        if (!tenBo) return;
        tenBo = String(tenBo).trim().toUpperCase();
        if (!gopBoExcel[tenBo]) gopBoExcel[tenBo] = [];
        gopBoExcel[tenBo].push(x);
    });

    for (let tenBo in gopBoExcel) {
        let linhKienHtml = `<div class="flex flex-wrap gap-1">`;
        let tongSl = 0;
        gopBoExcel[tenBo].forEach(item => {
            let tenDc = item['Tên Dụng Cụ Chi Tiết'] || item['Tên dụng cụ'] || item['Chi tiết'] || item['Dụng cụ'] || item['Tên Chi Tiết'] || "Dụng cụ";
            let sl = parseInt(item['Số lượng'] || item['SL'] || item['Số Lượng'] || 1);
            let hanHap = item['Tuổi thọ mẻ hấp'] || item['Tuổi thọ'] || 100;
            tongSl += sl;
            linhKienHtml += `<span class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">${tenDc} (${sl}) <span class="text-amber-600 font-bold">[Max: ${hanHap}]</span></span>`;
        });
        linhKienHtml += `</div>`;

        const tr = document.createElement("tr"); tr.className = "hover:bg-slate-50 transition-colors border-b";
        tr.innerHTML = `<td class="p-3 font-bold text-slate-800 text-xs">${tenBo}</td><td class="p-3">${linhKienHtml}</td><td class="p-3 text-center font-black text-sky-700 bg-sky-50/30">${tongSl}</td>`;
        tbody.appendChild(tr);
    }
}

function callRender() { clearTimeout(renderTimeout); renderTimeout = setTimeout(() => { renderTheoTabHienTai(); }, 100); }

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
            document.getElementById("khoa_selKhoa").value = khoaSelect; document.getElementById("khoa_selKhoa").disabled = true; document.body.classList.remove('guest-mode');
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

function switchTab(t) { 
    if (currentRole !== "ADMIN") {
        let tabsDuocPhep = cauHinhGiaoDien[currentRole] || [];
        if(!tabsDuocPhep.includes(t)) { return showToast("Tài khoản của bạn không có quyền truy cập chức năng này!", "error"); }
    }
    ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','lichsuluanchuyen','tracuu','performance','dashboard_tv'].forEach(x => { 
        document.getElementById('tab-'+x)?.classList.add('hidden'); document.getElementById('menu-'+x)?.classList.remove('sidebar-item-active'); 
    }); 
    document.getElementById('tab-'+t)?.classList.remove('hidden'); document.getElementById('menu-'+t)?.classList.add('sidebar-item-active'); 
    activeTab = t; 
    if (t === 'mayhap') { setTimeout(() => { tuDongTaoMaLoMeHap(); }, 50); }
    callRender(); 
}

function updateGiaoDienMatrix(role, tabId, checkboxElement) {
    if(!cauHinhGiaoDien[role]) cauHinhGiaoDien[role] = [];
    if(checkboxElement.checked) { if(!cauHinhGiaoDien[role].includes(tabId)) cauHinhGiaoDien[role].push(tabId); } 
    else { cauHinhGiaoDien[role] = cauHinhGiaoDien[role].filter(x => x !== tabId); }
    db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ cauHinhGiaoDien: cauHinhGiaoDien })
    .then(() => showToast(`Đã cập nhật quyền truy cập cho nhóm: ${role}`, "success"));
}

function renderAdminInterface() {
    if (document.getElementById("cfg_pinAdmin")) document.getElementById("cfg_pinAdmin").value = thongTinMatKhauAdmin.adminPIN || "";
    if (document.getElementById("cfg_pinCSSD")) document.getElementById("cfg_pinCSSD").value = thongTinMatKhauAdmin.cssdPIN || "";
    if (document.getElementById("cfg_pinGuest")) document.getElementById("cfg_pinGuest").value = thongTinMatKhauAdmin.guestPIN || "";
    
    const MatrixRoles = ["CSSD", "KHOA", "GUEST"];
    const MatrixTabs = [
        { id: "khoaphong", name: "1. Cổng Báo Trả Đồ" },
        { id: "thugom", name: "2. Xe Thu Gom" },
        { id: "donggoi", name: "3. Làm Sạch & Gói" },
        { id: "mayhap", name: "4. Quản Lý Mẻ Hấp" },
        { id: "khovokhuan", name: "5. Kho Vô Khuẩn" },
        { id: "quanlykho", name: "6. Tồn Kho Toàn Viện" },
        { id: "danhmuc", name: "7. Giám Sát Tuổi Thọ" },
        { id: "lichsuluanchuyen", name: "8. Nhật Ký Luân Chuyển" },
        { id: "tracuu", name: "9. Cấu Hình Hệ Thống" },
        { id: "performance", name: "10. Hiệu Suất KPI" },
        { id: "dashboard_tv", name: "11. Màn Hình Tivi" }
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

    const tbodyMatrix = document.getElementById("bodyMaTranGiaoDien");
    if (tbodyMatrix) tbodyMatrix.innerHTML = htmlMatrix;

    const trKhoa = document.getElementById("bangPhanQuyenKhoa");
    if(trKhoa) {
        if(danhSachKhoa.length === 0) { trKhoa.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-rose-500 font-bold italic">Danh sách Khoa trống.</td></tr>`; } 
        else { trKhoa.innerHTML = danhSachKhoa.map((k, index) => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-black text-slate-700 text-[11px]">${k.ten}</td><td class="p-3 text-center border-x border-slate-200 font-mono font-black text-rose-600 text-sm bg-rose-50/50">${k.pin || '123'}</td><td class="p-3 text-center"><div class="flex items-center justify-center gap-2"><input type="text" id="pin-khoa-${index}" placeholder="PIN" class="w-24 p-1.5 text-center border border-slate-300 rounded text-xs font-bold"><button onclick="updatePINTrựcTiep(${index}, '${k.ten}')" class="bg-sky-600 text-white font-bold py-1.5 px-3 rounded shadow text-[10px]">ĐỔI PIN</button></div></td></tr>`).join(''); }
    }
    
    const tbKtv = document.getElementById("bangNhanVienCssd");
    if(tbKtv) {
        if(danhSachKtvCssd.length === 0) { tbKtv.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Chưa có Nhân viên.</td></tr>`; }
        else { tbKtv.innerHTML = danhSachKtvCssd.map((nv, index) => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-black text-sky-700 text-xs">${nv.code}</td><td class="p-3 font-bold text-slate-700 text-[11px]">${nv.ten}</td><td class="p-3 text-center border-x border-slate-200 font-mono font-black text-sky-600 text-sm bg-sky-50/50">${nv.pin}</td><td class="p-3 text-center"><button onclick="xoaKtvCssd('${nv.code}')" class="text-rose-600 font-bold text-[10px]"><i class="fa-solid fa-trash-can mr-1"></i>XÓA</button></td></tr>`).join(''); }
    }
}

function xuatKhoXoayVong() { 
    const k = document.getElementById("xuat_selKhoa").value; 
    let ma = document.getElementById("xuat_inpMaBo").value.trim().toUpperCase(); 
    if(!k) { playSound('error'); return showToast("Vui lòng Chọn Khoa nhận trước khi quét mã!", "error"); } 
    if(!ma) return;
    if(gioHangXuatKho.some(x => x.maMacDinh === ma)) { playSound('error'); document.getElementById("xuat_inpMaBo").value = ""; return showToast("Mã này đã được quét vào danh sách xuất!", "error"); }
    let khayThucTe = listGiaoDich.find(x => x.maMacDinh === ma && x.status === "CHO_XUAT"); 
    if(!khayThucTe) { playSound('error'); document.getElementById("xuat_inpMaBo").value = ""; return showToast(`Mã ID ${ma} không có sẵn ở Kho Vô Khuẩn.`, "error"); } 
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
            gioHangXuatKho.forEach((item, index) => { html += `<div class="bg-white border border-sky-300 px-2 py-1 rounded flex items-center gap-2 shadow-sm animate-pulse"><span class="text-[11px] font-bold text-slate-700">${item.bo.split(" [ID:")[0]}</span><span class="text-[10px] font-mono text-sky-700 bg-sky-100 px-1 rounded font-bold">${item.maMacDinh}</span><i class="fa-solid fa-xmark text-rose-500 cursor-pointer ml-1 text-xs hover:text-rose-700" onclick="xoaKhoiGioXuat(${index})"></i></div>`; });
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
                status: "HOAN_TAT", 
                khoa: k, 
                ngayHoanTat: getTodayDateStr(), 
                timeHoanTat: new Date().toLocaleTimeString('vi-VN'), 
                nvXuatKho: loginUserCode || "CSSD_CHUNG" 
            }).then(() => {
                dongBoSangMicrosoft365("XAC_NHAL_XUAT_KHO", { ...khay, status: "HOAN_TAT", khoa: k });
            })
        ); 
    });
    Promise.all(p).then(() => { playSound('success'); setTimeout(() => playSound('success'), 200); showToast(`Đã bàn giao hoàn tất ${gioHangXuatKho.length} mâm đồ cho Khoa ${k}!`, "success"); gioHangXuatKho = []; if (document.getElementById("xuat_inpMaBo")) document.getElementById("xuat_inpMaBo").value = ""; renderGioHangXuat(); callRender(); });
}

function docAnhBiUpTaiCho(inputElement) { const file = inputElement.files[0]; if (!file) return; const reader = new FileReader(); reader.onloadend = function() { duLieuAnhBiTamBase64 = reader.result; showToast("Đã ghi nhận ảnh test BI thành công!", "success"); }; reader.readAsDataURL(file); }

function tuDongTaoMaLoMeHap() {
    const maMay = document.getElementById("hap_maySo")?.value || "A1"; const now = new Date(); const yy = String(now.getFullYear()).slice(-2); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0'); const ngayChuoi = `${yy}${mm}${dd}`;
    let cacMeTrongNgay = listGiaoDich.filter(x => x.batchCode && x.batchCode.startsWith(maMay + ngayChuoi)); let soMeMax = 0;
    cacMeTrongNgay.forEach(x => { let phanDuoi = x.batchCode.split("_")[1]; if (phanDuoi) { let num = parseInt(phanDuoi); if (num > soMeMax) soMeMax = num; } });
    let meTiepTheo = soMeMax + 1; if (meTiepTheo > 99) meTiepTheo = 1; const chuoiMe = String(meTiepTheo).padStart(2, '0'); const soLanDone = `${ngayChuoi}_${chuoiMe}`; const batchIdHoanChinh = `${maMay}${soLanDone}`;
    if (document.getElementById("hap_meSo")) document.getElementById("hap_meSo").value = chuoiMe;
    if (document.getElementById("hap_batchId")) document.getElementById("hap_batchId").value = batchIdHoanChinh;
    const vungUpAnh = document.getElementById("khuVucUploadBI");
    if (vungUpAnh) { if (soMeMax === 0) { vungUpAnh.classList.remove("hidden"); duLieuAnhBiTamBase64 = ""; } else { vungUpAnh.classList.add("hidden"); duLieuAnhBiTamBase64 = ""; } }
}

function xacNhanMeHap() { 
    let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm dụng cụ!", "error"); 
    let loaiHap = document.getElementById("hap_loaiHap").value; let maMay = document.getElementById("hap_maySo").value; let batchCode = document.getElementById("hap_batchId").value; let chuKyNhiet = document.getElementById("hap_nhietDo").value; let apSuat = document.getElementById("hap_apSuat").value || "N/A"; 
    const ngayHomNay = getTodayDateStr(); let cacMeCuaMayTrongNgay = listGiaoDich.filter(x => x.batchCode && x.batchCode.startsWith(maMay) && x.ngayHapRealtime === ngayHomNay); let laMeDauTien = cacMeCuaMayTrongNgay.length === 0;
    if (laMeDauTien && !duLieuAnhBiTamBase64) { return showToast("Mẻ đầu tiên trong ngày! Vui lòng chụp/đính kèm ảnh test sinh học BI.", "error"); }
    let p = []; 
    checkboxes.forEach(cb => { 
        if(cb.id === 'selectAllHap') return; 
        let itemData = listGiaoDich.find(x => x.firestoreId === cb.value);
        let thongTinLo = { loaiHap: loaiHap, maMay: maMay, chuKyNhiet: chuKyNhiet, apSuat: apSuat, thoiGianBatDau: new Date().toLocaleTimeString('vi-VN'), giamSatChatLuong: { chiThiHoaHoc: "ĐẠT", laMeTestSinhHocGoc: laMeDauTien, keThuaTuMaLo: laMeDauTien ? batchCode : (cacMeCuaMayTrongNgay[cacMeCuaMayTrongNgay.length - 1]?.batchCode || batchCode), ketQuaSinhHoc: laMeDauTien ? "ÂM TÍNH (ĐẠT)" : "KẾ THỪA ĐẦU NGÀY", minhChungAnhBase64: laMeDauTien ? duLieuAnhBiTamBase64 : "" } };
        
        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({ 
                status: "DANG_HAP", 
                batchCode: batchCode, 
                ngayHapRealtime: ngayHomNay, 
                thongTinLoHap: thongTinLo 
            }).then(() => {
                if(itemData) {
                    dongBoSangMicrosoft365("KICH_HOAT_ME_HAP", { ...itemData, batchCode: batchCode, thongTinLoHap: thongTinLo });
                }
            })
        ); 
    }); 
    Promise.all(p).then(() => { showToast(`Kích hoạt lò thành công! Lô: ${batchCode}`, "success"); duLieuAnhBiTamBase64 = ""; tuDongTaoMaLoMeHap(); callRender(); }); 
}

function hanhDongXemAnhBiMoi(firestoreId) {
    let item = listGiaoDich.find(x => x.firestoreId === firestoreId); if (!item) return showToast("Không tìm thấy thông tin giao dịch dụng cụ này", "error");
    let loGoc = listGiaoDich.find(m => m.batchCode === item.batchCode && m.thongTinLoHap?.giamSatChatLuong?.laMeTestSinhHocGoc === true); let chuoiAnhBase64 = loGoc?.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64 || item.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64;
    if (!chuoiAnhBase64) return showToast("Mẻ này kế thừa kết quả sinh học, không đính kèm file ảnh trực tiếp.", "error");
    let w = window.open(); w.document.write(`<html><head><title>MINH CHỨNG ẢNH BI - LÔ ${item.batchCode}</title></head><body style='margin:0; background:#000; display:flex; justify-content:center; align-items:center;'><img src='${chuoiAnhBase64}' style='max-width:100%; max-height:100vh; object-fit:contain;'/></body></html>`);
}

function renderTheoTabHienTai() {
    if(activeTab === 'khoaphong') {
        const k = document.getElementById("khoa_selKhoa").value;
        let arrHtml = []; let noK = listGiaoDich.filter(x => x.khoa === k && x.status !== "HOAN_TAT" && x.status !== "CHO_XUAT");
        let gopNo = {}; noK.forEach(x => { let ten = x.bo.split(" [ID:")[0]; gopNo[ten] = (gopNo[ten]||0) + 1; });
        for (let key in gopNo) { arrHtml.push(`<tr class="border-b"><td class="p-3 font-bold text-slate-800">${key}</td><td class="p-3 text-center">-</td><td class="p-3 text-center">-</td><td class="p-3 text-center text-rose-600 font-bold">Nợ ${gopNo[key]}</td></tr>`); }
        document.getElementById("bangDonGiaoNhan").innerHTML = arrHtml.length ? arrHtml.join('') : `<tr><td colspan="4" class="p-8 text-center text-slate-400 italic">Khoa chưa phát sinh công nợ trả đồ.</td></tr>`;
    }
    else if(activeTab === 'thugom') {
        let fK = document.getElementById("filterKhoaThuGom")?.value || ""; let lsTG = listGiaoDich.filter(x => x.status === "CHO_THU"); 
        if (document.getElementById("filterKhoaThuGom")) {
            let danhSachKhoaCoDon = [...new Set(lsTG.map(x => x.khoa))].filter(Boolean); let htmlOpts = '<option value="">-- Lọc theo Khoa --</option>';
            danhSachKhoaCoDon.forEach(k => { let selectedAttr = (k === fK) ? "selected" : ""; htmlOpts += `<option value="${k}" ${selectedAttr}>${k}</option>`; });
            document.getElementById("filterKhoaThuGom").innerHTML = htmlOpts; fK = document.getElementById("filterKhoaThuGom").value || "";
        }
        if (fK) lsTG = lsTG.filter(x => x.khoa === fK);
        if (document.getElementById("badgeSoCho")) document.getElementById("badgeSoCho").innerText = `${lsTG.length} Lệnh`;
        document.getElementById("bangChoThuGom").innerHTML = lsTG.map(i => {
            let tenBo = i.bo.split(" [ID:")[0]; let itemsInBo = databaseExcel.filter(x => { let boName = x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ'] || x['NAME'] || x['name']; return String(boName).trim().toUpperCase() === String(tenBo).trim().toUpperCase(); });
            let checklistHtml = itemsInBo.length > 0 ? `<div class="max-h-24 overflow-y-auto pr-1">` + itemsInBo.map(item => { let tenDc = item['Tên Dụng Cụ Chi Tiết'] || item['Tên dụng cụ'] || item['Chi tiết'] || item['Dụng cụ'] || item['TÊN BỘ'] || item['Tên Chi Tiết'] || item['NAME'] || "Dụng cụ"; let sl = item['Số lượng'] || item['SL'] || item['Số Lượng'] || 1; return `<div class="flex justify-between border-b border-dashed border-slate-200 py-1 text-[10px] text-slate-600"><span>- ${tenDc}</span><span class="font-bold text-sky-700">x${sl}</span></div>`; }).join('') + `</div>` : `<span class="italic text-[10px] text-slate-400">Không có cấu hình chi tiết linh kiện</span>`;
            return `<tr class="border-b border-slate-50"><td class="p-3"><div class="font-bold text-slate-700 text-[11px] uppercase">${i.khoa}</div>${i.ghiChu ? `<div class="text-[10px] text-rose-600 font-medium italic mt-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${i.ghiChu}</div>` : ''}</td><td class="p-3"><div class="font-bold text-sky-700 text-[12px] uppercase">${tenBo}</div><div class="text-[10px] font-mono text-slate-400 mb-2">ID: ${i.maMacDinh}</div><div class="bg-slate-50 p-2 rounded border border-slate-100">${checklistHtml}</div></td><td class="p-3 text-center text-[10px] text-slate-500 font-bold">${i.time}</td><td class="p-3 text-center action-col"><button onclick="moPopupKiemDem('${i.firestoreId}')" class="bg-sky-600 text-white hover:bg-sky-700 px-3 py-1.5 rounded shadow font-black text-[11px]">KIỂM ĐẾM</button></td></tr>`;
        }).join('');
    }
    else if(activeTab === 'donggoi') {
        let lsDG = listGiaoDich.filter(x => x.status === "DANG_RUA"); document.getElementById("badgeDongGoi").innerText = lsDG.length;
        document.getElementById("gridDongGoi").innerHTML = lsDG.map(i => `<div class="bg-white p-3 rounded border border-slate-200 mb-2 flex justify-between items-center"><div class="flex-1"><div class="font-bold text-sky-700 text-[13px]">${i.bo}</div><div class="text-[10px] text-slate-500">Từ khoa: ${i.khoa}</div></div><button onclick="moPopupDongGoi('${i.firestoreId}')" class="bg-sky-50 text-sky-700 border border-sky-300 px-3 py-1.5 rounded text-[11px] font-black">ĐÓNG GÓI</button></div>`).join('');
    }
    else if(activeTab === 'mayhap') {
        let lsCH = listGiaoDich.filter(x => x.status === "CHO_HAP"); document.getElementById("badgeChoHap").innerText = `${lsCH.length} Mục`;
        document.getElementById("bangChoHap").innerHTML = lsCH.map(i => `<tr class="border-b"><td class="p-3 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="hap-checkbox"></td><td class="p-3 font-bold">${i.bo}</td><td class="p-3 text-right font-mono">${i.maMacDinh}</td></tr>`).join('');
        let lsNT = listGiaoDich.filter(x => x.status === "DANG_HAP"); document.getElementById("bangChoNghiệmThu").innerHTML = lsNT.map(i => `<tr class="border-b"><td class="p-2 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="nghiemthu-checkbox"></td><td class="p-2 font-bold text-xs">${i.bo} <span class="text-slate-400 font-normal">(${i.batchCode || 'Chưa có lô'})</span></td></tr>`).join('');
        if(document.getElementById("bangLichSuHap")) {
            const homNayMoiStr = getTodayDateStr(); let tatCaMucCoLo = listGiaoDich.filter(x => x.batchCode && (x.ngayHapRealtime === homNayMoiStr || x.ngayTao === homNayMoiStr)); let cacMeHapGop = {};
            tatCaMucCoLo.forEach(x => {
                if(!cacMeHapGop[x.batchCode]) { cacMeHapGop[x.batchCode] = { batchCode: x.batchCode, loaiHap: x.thongTinLoHap?.loaiHap || "Hấp hơi nước", chuKyNhiet: x.thongTinLoHap?.chuKyNhiet || "134°C - 4 phút", apSuat: x.thongTinLoHap?.apSuat || "2.1", thoiGian: x.thongTinLoHap?.thoiGianBatDau || x.time || "--:--", ngay: x.ngayHapRealtime || x.ngayTao || "", soLuongKhay: 0, trangThaiMe: x.status === "DANG_HAP" ? "Đang chạy lò" : "Đã hoàn thành" }; }
                cacMeHapGop[x.batchCode].soLuongKhay += 1;
            });
            let danhSachMeHapSapXep = Object.values(cacMeHapGop).sort((a, b) => String(b.batchCode).localeCompare(String(a.batchCode)));
            if(danhSachMeHapSapXep.length === 0) { document.getElementById("bangLichSuHap").innerHTML = `<tr><td colspan="2" class="p-4 text-center text-slate-400 italic">Hôm nay chưa có mẻ hấp nào được kích hoạt</td></tr>`; } 
            else { document.getElementById("bangLichSuHap").innerHTML = danhSachMeHapSapXep.map(me => { let colorStatus = me.trangThaiMe === "Đang chạy lò" ? "text-purple-600 bg-purple-50 border border-purple-200" : "text-emerald-600 bg-emerald-50 border border-emerald-200"; return `<tr class="hover:bg-slate-50 transition-colors"><td class="p-3"><div class="flex items-center gap-2"><span class="font-mono font-black text-rose-700 text-sm tracking-wider">${me.batchCode}</span><span class="px-2 py-0.5 text-[9px] font-black uppercase rounded ${colorStatus}">${me.trangThaiMe}</span></div><div class="text-[11px] text-slate-500 font-medium mt-1"><i class="fa-solid fa-gear text-slate-400 mr-1"></i> ${me.loaiHap} | ${me.chuKyNhiet} | Áp suất: ${me.apSuat} Bar</div><div class="text-[10px] text-slate-400 font-mono mt-0.5"><i class="fa-solid fa-clock text-slate-300 mr-1"></i> Bắt đầu: ${me.thoiGian} (${me.ngay})</div></td><td class="p-3 text-right pr-4"><span class="font-black text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-xs">${me.soLuongKhay} khay</span></td></tr>`; }).join(''); }
        }
    }
    else if(activeTab === 'khovokhuan') {
        let uniqueKhoaSanCo = [...new Set(listGiaoDich.map(x=>x.khoa))].filter(Boolean);
        if(document.getElementById("xuat_selKhoa") && document.getElementById("xuat_selKhoa").options.length <= 1) { document.getElementById("xuat_selKhoa").innerHTML = '<option value="">-- Chọn Khoa --</option>' + uniqueKhoaSanCo.map(k=>`<option value="${k}">${k}</option>`).join(''); }
        let lsXK = listGiaoDich.filter(x => x.status === "CHO_XUAT");
        document.getElementById("bangKhoVoKhuan").innerHTML = lsXK.map(i => `<tr class="border-b"><td class="p-3 font-bold text-slate-800 text-[11px]">${i.bo.split(" [ID:")[0]}</td><td class="p-3 font-mono text-sky-700 font-bold">${i.maMacDinh}</td><td class="p-3 text-center font-bold text-slate-500 text-[11px]">Kệ 01</td><td class="p-3 text-center text-[10px] text-emerald-700 font-bold">${i.hsd ? new Date(i.hsd).toLocaleDateString('vi-VN') : 'An toàn'}</td></tr>`).join('');
        renderGioHangXuat();
    }
    else if(activeTab === 'quanlykho') {
        let fK = document.getElementById("inv_filterKhoa").value; let uniqueKhoa = [...new Set(listGiaoDich.map(x=>x.khoa))].filter(Boolean); document.getElementById("inv_filterKhoa").innerHTML = '<option value="">-- Tất cả --</option>' + uniqueKhoa.map(k=>`<option value="${k}" ${k===fK?'selected':''}>${k}</option>`).join('');
        let uniqueIDs = [...new Set(listGiaoDich.map(x=>x.maMacDinh))]; let arrHtml = []; const ngayHomNay = new Date(); ngayHomNay.setHours(0,0,0,0); 
        uniqueIDs.forEach(ma => {
            let allTrans = listGiaoDich.filter(x => x.maMacDinh === ma); let currentTrans = allTrans.sort((a,b) => b.id - a.id)[0]; if(!currentTrans || !ma) return;
            let viTriCode = currentTrans.status; let khoaGiữ = currentTrans.khoa; if (fK && khoaGiữ !== fK) return;
            let viTriText = "Kho vô khuẩn"; let viTriColor = "bg-teal-100 text-teal-800";
            if(viTriCode === "HOAN_TAT") { viTriText = `Sẵn sàng tại Khoa`; viTriColor = "bg-emerald-100 text-emerald-800"; } 
            else if (viTriCode === "DA_SU_DUNG") { viTriText = `Đã sử dụng (BN)`; viTriColor = "bg-rose-100 text-rose-800"; }
            else if(viTriCode !== "CHO_XUAT") { viTriText = "Xử lý tại CSSD"; viTriColor = "bg-amber-100 text-amber-800"; }
            let hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">An toàn</span>`; let dongColorClass = ""; 
            if (currentTrans.hsd && (viTriCode === "CHO_XUAT" || viTriCode === "HOAN_TAT")) {
                const ngayHsd = new Date(currentTrans.hsd); ngayHsd.setHours(0,0,0,0); const soNgayConLai = Math.ceil((ngayHsd.getTime() - ngayHomNay.getTime()) / (1000 * 60 * 60 * 24));
                if (soNgayConLai < 0) { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">QUÁ HẠN</span>`; dongColorClass = "bg-rose-50/70 border-l-4 border-l-rose-500 font-bold"; } 
                else if (soNgayConLai <= 3) { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white">HẠN < ${soNgayConLai} NGÀY</span>`; dongColorClass = "bg-amber-50/40 border-l-4 border-l-amber-500"; } 
                else { hsdBadget = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Hạn ${soNgayConLai} ngày</span>`; }
            }
            arrHtml.push(`<tr class="border-b border-slate-100 ${dongColorClass}"><td class="p-3 font-mono text-sky-700 font-bold">${ma}</td><td class="p-3 font-bold text-slate-800">${currentTrans.bo.split(" [ID:")[0]}</td><td class="p-3 text-slate-500 text-[11px]">${khoaGiữ}</td><td class="p-3 text-center"><span class="px-2.5 py-1 rounded text-[10px] font-bold ${viTriColor}">${viTriText}</span></td><td class="p-3 text-center font-mono font-bold text-slate-400">${currentTrans.batchCode || 'N/A'}</td><td class="p-3 text-center">${hsdBadget}</td></tr>`);
        });
        document.getElementById("bangTonKhoTe").innerHTML = arrHtml.join('');
    }
    else if(activeTab === 'danhmuc') {
        const tbody = document.getElementById("bangDanhMucTong"); if (!tbody) return;
        let uniqueIDs = [...new Set(listGiaoDich.map(x => x.maMacDinh))].filter(Boolean); let arrHtml = [];
        uniqueIDs.forEach(ma => {
            let allTrans = listGiaoDich.filter(x => x.maMacDinh === ma); let currentTrans = allTrans.sort((a, b) => b.id - a.id)[0]; if (!currentTrans) return;
            let viTriCode = currentTrans.status; let viTriText = "Kho vô khuẩn"; let viTriColor = "bg-teal-100 text-teal-800";
            if (viTriCode === "HOAN_TAT") { viTriText = `Tại Khoa`; viTriColor = "bg-emerald-100 text-emerald-800"; } 
            else if (viTriCode === "DA_SU_DUNG") { viTriText = `Đã dùng (BN)`; viTriColor = "bg-rose-100 text-rose-800"; }
            else if (viTriCode !== "CHO_XUAT") { viTriText = "Xử lý tại CSSD"; viTriColor = "bg-amber-100 text-amber-800"; }
            let chuKyLo = listGiaoDich.filter(x => x.maMacDinh === ma && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT" || x.status === "DA_SU_DUNG")).length;
            arrHtml.push(`<tr class="border-b border-slate-100 font-medium"><td class="p-3 font-mono text-sky-700 font-bold">${ma}</td><td class="p-3 font-bold text-slate-800">${currentTrans.bo.split(" [ID:")[0]}</td><td class="p-3 text-center"><span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${viTriColor}">${viTriText}</span></td><td class="p-3 text-center font-black text-amber-700 bg-amber-50/50">${chuKyLo} lần</td></tr>`);
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
                
                let minhChungHtml = ""; let loGoc = listGiaoDich.find(m => m.batchCode === x.batchCode && m.thongTinLoHap?.giamSatChatLuong?.laMeTestSinhHocGoc === true); let anhBase64 = loGoc?.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64 || x.thongTinLoHap?.giamSatChatLuong?.minhChungAnhBase64;
                if (anhBase64) { minhChungHtml = `<br><span onclick="hanhDongXemAnhBiMoi('${x.firestoreId}')" class="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-300 rounded px-1 cursor-pointer font-bold mt-1 inline-block"><i class="fa-solid fa-image mr-1"></i>Xem ảnh BI</span>`; }
                
                let thongTinKemTheo = x.nvXuatKho || '<span class="text-slate-300 font-normal">Chưa xuất</span>';
                if(x.status === "DA_SU_DUNG" && x.thongTinBenhNhan) {
                    thongTinKemTheo = `<span class="text-teal-700 font-black">BN: ${x.thongTinBenhNhan.thongTinTimKiemBN}</span>`;
                }

                return `<tr class="border-b text-xs hover:bg-slate-50 transition-colors"><td class="p-3 font-mono font-bold text-sky-700">${x.maMacDinh || 'N/A'}</td><td class="p-3 font-bold text-slate-800">${x.bo ? x.bo.split(" [ID:")[0] : 'N/A'}</td><td class="p-3 font-semibold text-slate-500">${x.khoa || 'N/A'}</td><td class="p-3 text-center">${statusBadge}</td><td class="p-3 text-center font-mono font-bold text-rose-700 bg-rose-50/30">${x.batchCode || 'N/A'}${minhChungHtml}</td><td class="p-3 text-center font-bold text-sky-800 bg-sky-50/40">${thongTinKemTheo}</td><td class="p-3 text-center text-slate-400 font-mono text-[11px]">${x.ngayTao || ''} ${x.time || ''}</td></tr>`;
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
                    tableWrapper.innerHTML = `<h3 class="font-black text-slate-800 text-sm mb-3 text-sky-800"><i class="fa-solid fa-list-check mr-2"></i>DANH SÁCH MÂM DỤNG CỤ TRONG MẺ TRUY VẾT</h3><div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead><tr class="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b"><th class="p-3">Mã ID Khay</th><th class="p-3">Tên Bộ Dụng Cụ</th><th class="p-3">Khoa Sử Dụng</th><th class="p-3">Trạng Thái</th><th class="p-3 text-center">Mã Lô Hấp</th><th class="p-3 text-center">Thời Gian Kích Hoạt</th></tr></thead><tbody id="bangLichSuTruyXuatAdmin"></tbody></table></div>`;
                    parentContainer.appendChild(tableWrapper); safeTbody = document.getElementById("bangLichSuTruyXuatAdmin");
                }
            }
        }
        let searchInp = maLoTruyVetToanCuc || "";
        if (!searchInp && document.getElementById("inp_searchBatch")) { searchInp = document.getElementById("inp_searchBatch").value.trim(); }
        if(safeTbody) {
            if (!searchInp) { safeTbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Vui lòng nhập mã mẻ hấp và nhấn "TRA CỨU KHẨN CẤP" để hiển thị dữ liệu...</td></tr>`; return; }
            let dataFiltered = listGiaoDich.filter(x => x.batchCode && String(x.batchCode).toUpperCase().includes(searchInp.toUpperCase()));
            if(dataFiltered.length === 0) { safeTbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500 italic font-bold">Không tìm thấy dữ liệu mâm dụng cụ thuộc mẻ: ${searchInp}</td></tr>`; } 
            else {
                safeTbody.innerHTML = dataFiltered.map(x => {
                    let cleanBo = x.bo ? x.bo.split(" [ID:")[0] : "N/A"; let badgeColor = "bg-slate-100 text-slate-700";
                    if(x.status === "HOAN_TAT") badgeColor = "bg-emerald-100 text-emerald-800 font-bold";
                    else if(x.status === "CHO_XUAT") badgeColor = "bg-teal-100 text-teal-800 font-bold";
                    else if(x.status === "DANG_HAP") badgeColor = "bg-purple-100 text-purple-800 font-bold";
                    else if(x.status === "DA_SU_DUNG") badgeColor = "bg-rose-600 text-white font-bold";
                    return `<tr class="border-b text-xs hover:bg-slate-50 font-medium"><td class="p-3 font-mono font-bold text-sky-700">${x.maMacDinh || 'N/A'}</td><td class="p-3 font-bold text-slate-800">${cleanBo}</td><td class="p-3 font-semibold text-slate-500">${x.khoa || 'N/A'}</td><td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] ${badgeColor}">${x.status}</span></td><td class="p-3 text-center font-mono font-black text-rose-700 bg-rose-50/40">${x.batchCode || 'N/A'}</td><td class="p-3 text-center text-slate-400 font-mono">${x.ngayTao || ''} ${x.time || ''}</td></tr>`;
                }).join('');
            }
        }
    }
    else if(activeTab === 'performance') { if(typeof renderKpiPerformanceGoc === 'function') renderKpiPerformanceGoc(); }
    else if(activeTab === 'dashboard_tv') { renderDashboardTiviRealtime(); }
}

function renderDashboardTiviRealtime() {
    const homNayChuoi = getTodayDateStr(); let slDangRua = listGiaoDich.filter(x => x.status === "DANG_RUA").length; let slDangHap = listGiaoDich.filter(x => x.status === "DANG_HAP").length; let slChoXuat = listGiaoDich.filter(x => x.status === "CHO_XUAT").length;
    let uniqueMeRuaHomNay = new Set(listGiaoDich.filter(x => x.status === "DANG_RUA" && x.ngayTao === homNayChuoi).map(x => x.time?.substring(0,5))); let uniqueMeHapHomNay = new Set(listGiaoDich.filter(x => x.ngayHapRealtime === homNayChuoi && x.batchCode).map(x => x.batchCode));
    let countQuadHan = 0; const ngayHomNay = new Date(); ngayHomNay.setHours(0,0,0,0);
    listGiaoDich.forEach(x => { if(x.hsd && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT")) { let nd = new Date(x.hsd); nd.setHours(0,0,0,0); if(nd.getTime() - ngayHomNay.getTime() < 0) countQuadHan++; } });
    if(document.getElementById("tv_meRua")) document.getElementById("tv_meRua").innerText = uniqueMeRuaHomNay.size;
    if(document.getElementById("tv_meHap")) document.getElementById("tv_meHap").innerText = uniqueMeHapHomNay.size;
    if(document.getElementById("tv_dangRua")) document.getElementById("tv_dangRua").innerText = slDangRua;
    if(document.getElementById("tv_dangHap")) document.getElementById("tv_dangHap").innerText = slDangHap;
    if(document.getElementById("tv_khoVoKhuan")) document.getElementById("tv_khoVoKhuan").innerText = slChoXuat;
    if(document.getElementById("tv_canhBaoHsd")) { document.getElementById("tv_canhBaoHsd").innerText = countQuadHan; }
}

// =========================================================================
// [SỬA LỖI TỰ ĐỘNG XỔ GỢI Ý] HÀM NẠP DANH MỤC MÂM RA DATALIST THEO KHOA SỞ HỮU
// =========================================================================
function loadBoDungCuTheoKhoa() { 
    let k = document.getElementById("khoa_selKhoa").value; 
    let list = document.getElementById("listBoDungCu"); 
    if(!list) return;
    list.innerHTML = ""; // Làm sạch danh sách gợi ý cũ để nạp mới
    
    let f = danhSachKhoa.find(x => x.ten === k); 
    if (f && f.danhSachBo) {
        let htmlOptions = "";
        f.danhSachBo.forEach(x => {
            // Tách chuỗi thô để lấy Tên bộ riêng biệt (Ví dụ: từ "BỘ MAY TẦNG SINH MÔN [ID:PS002]" -> "BỘ MAY TẦNG SINH MÔN")
            let tenBoThuanTuy = x.includes(" [ID:") ? x.split(" [ID:")[0] : x;
            
            // Render 2 Option song song: giúp nhân viên nhập theo Mã ID hoặc gõ Tên mâm đều tự động bung gợi ý
            htmlOptions += `<option value="${x}">`;
            htmlOptions += `<option value="${tenBoThuanTuy}">`;
        });
        list.innerHTML = htmlOptions; 
    }
}
// =========================================================================

function themVaoGio() { let val = document.getElementById("khoa_inpMaBo").value.trim().toUpperCase(); if(!val) return; if (gioHangTam.some(x => x.maMacDinh === val)) { document.getElementById("khoa_inpMaBo").value = ""; return showToast("Mã này đã có trong danh sách chờ!", "error"); } let tenGoc = val.includes("[ID:") ? val.split(" [ID:")[0] : val; gioHangTam.push({bo: tenGoc, maMacDinh: val, slYeuCau: 1}); document.getElementById("khoa_inpMaBo").value = ""; renderGioHang(); }
function renderGioHang() { let khuVuc = document.getElementById("khuVucGioHang"); if(khuVuc) khuVuc.classList.toggle("hidden", gioHangTam.length===0); document.getElementById("bangGioHang").innerHTML = gioHangTam.map(i => `<tr><td class="p-2.5 font-bold text-sky-700 text-[11px]">${i.bo}</td></tr>`).join(''); }
function clearGioHang() { gioHangTam = []; renderGioHang(); }
function khoaGuiPhieuTraBatches() { const k = document.getElementById("khoa_selKhoa").value; if(!k) return showToast("Vui lòng chọn Khoa trước!"); if(gioHangTam.length === 0) return showToast("Không có dụng cụ trong danh sách!"); let p=[]; gioHangTam.forEach((i,idx) => p.push(db.collection("phieuGiaoNhan").add({ id: Date.now()+idx, ngayTao: getTodayDateStr(), time: new Date().toLocaleTimeString('vi-VN'), khoa: k, bo: i.bo, maMacDinh: i.maMacDinh, slYeuCau: 1, slThucTe: 1, status: "CHO_THU" }))); Promise.all(p).then(() => { clearGioHang(); showToast("Đã gửi lệnh thu gom!", "success"); callRender(); }); }
function inHoaDonGiaoNhan() { const k = document.getElementById("khoa_selKhoa").value; if (!k) return showToast("Vui lòng chọn Khoa/Phòng trước khi in!", "error"); let printHtml = `<div style="font-family: Arial, sans-serif; color: #000; padding: 10px;"><div style="text-align:center; margin-bottom: 20px;"><h2 style="font-size: 18px; margin-bottom: 5px;">BIÊN BẢN GIAO NHẬN DỤCO CỤ CSSD</h2><p style="font-size: 13px; margin: 0;">Khoa/Phòng: <strong style="font-size: 14px;">${k}</strong> - Ngày xuất phiếu: <strong>${new Date().toLocaleDateString('vi-VN')}</strong></p></div><table style="width:100%; border-collapse: collapse; text-align: left; font-size: 13px; font-family: Arial, sans-serif;"><thead><tr style="background-color: #f8fafc;"><th style="border: 1px solid #000; padding: 10px; font-weight: bold;">Phân Loại Mâm / Loại Dụng Cụ</th><th style="border: 1px solid #000; padding: 10px; text-align: center; font-weight: bold;">Đã Trả Bẩn</th><th style="border: 1px solid #000; padding: 10px; text-align: center; font-weight: bold;">Nhận Sạch</th><th style="border: 1px solid #000; padding: 10px; text-align: center; font-weight: bold;">CSSD Nợ Khoa</th></tr></thead><tbody>${document.getElementById("bangDonGiaoNhan").innerHTML}</tbody></table></div>`; const pZone = document.getElementById("print-zone"); pZone.innerHTML = printHtml; pZone.classList.remove("hidden"); window.print(); pZone.classList.add("hidden"); }

// =========================================================================
// [NÂNG CẤP TRẠM 2] LOGIC KIỂM ĐẾM LINH KIỆN CHI TIẾT ĐẦU VÀO VÀ KHÓA LỖI ĐỐI SOÁT
// =========================================================================
function moPopupKiemDem(id) { 
    let item = listGiaoDich.find(x => x.firestoreId === id); 
    if(!item) return showToast("Không tìm thấy thông tin dòng chỉ định!", "error");

    currentKiemDemData = {
        id: id,
        tenBoDungCu: item.bo ? item.bo.split(" [ID:")[0] : "Chưa rõ mâm",
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

    let checklistSơBộ = [];
    if(itemsInBo.length > 0) {
        checklistSơBộ = itemsInBo.map(ct => {
            let tenDc = ct['Tên Dụng Cụ Chi Tiết'] || ct['Tên dụng cụ'] || ct['Chi tiết'] || ct['Dụng cụ'] || ct['TÊN BỘ'] || ct['Tên Chi Tiết'] || ct['NAME'] || "Dụng cụ";
            let sl = parseInt(ct['Số lượng'] || ct['SL'] || ct['Số Lượng'] || 1);
            return { ten: tenDc, slChuan: sl, slThuc: sl, tinhTrang: "ĐỦ" };
        });
    } else {
        checklistSơBộ = [{ ten: "Dụng cụ nguyên bộ (Chưa phân rã cấu hình)", slChuan: 1, slThuc: 1, tinhTrang: "ĐỦ" }];
    }

    currentKiemDemData.linhKienKiemDem = checklistSơBộ;
    renderChecklistLinhKien();
    document.getElementById('popupKiemDem').classList.remove('hidden'); 
}

function renderChecklistLinhKien() {
    const container = document.getElementById('popKiemDemChecklist');
    if(!container) return;
    container.innerHTML = ""; 

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
        if (item.slThuc < item.slChuan) {
            item.tinhTrang = "THIẾU";
        } else if (item.slThuc === item.slChuan) {
            item.tinhTrang = "ĐỦ";
        }
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

function closePopupKiemDem() { 
    document.getElementById("popupKiemDem").classList.add("hidden"); 
    currentKiemDemData = null;
}

async function saveKiemDem() { 
    if(!currentKiemDemData) return; 
    const ghiChuValue = document.getElementById("popGhiChu").value.trim();

    let coSuCoChenhLech = false;
    currentKiemDemData.linhKienKiemDem.forEach(item => {
        if (item.tinhTrang === "THIẾU" || item.tinhTrang === "HỎNG" || item.slThuc < item.slChuan) {
            coSuCoChenhLech = true;
        }
    });

    if (coSuCoChenhLech && ghiChuValue === "") {
        playSound('error');
        alert("⚠️ PHÁT HIỆN SỰ CỐ CHÊNH LỆCH LINH KIỆN!\nAnh/Chị bắt buộc phải nhập lý do chênh lệch hoặc số biên bản sự cố từ khoa lâm sàng trước khi 'Chốt và Chuyển Rửa'.");
        document.getElementById('popGhiChu').focus();
        document.getElementById('popGhiChu').classList.add('border-rose-500', 'ring-2', 'ring-rose-200');
        return;
    }

    try {
        await db.collection("phieuGiaoNhan").doc(currentKiemDemData.id).update({ 
            status: "DANG_RUA", 
            ghiChu: ghiChuValue,
            ktvThuGom: loginUserCode || "CSSD_CHUNG",
            thoiGianDoiSoat: new Date().toLocaleTimeString('vi-VN'),
            coSuCoChenhLech: coSuCoChenhLech,
            chiTietChecklistLinhKien: currentKiemDemData.linhKienKiemDem
        });
        
        showToast("Đã đối soát xong! Mâm đồ đã chuyển sang Trạm Làm Sạch & Rửa.", "success"); 
        closePopupKiemDem(); 
        callRender(); 
    } catch(err) {
        console.error("Lỗi cập nhật Firestore:", err);
        showToast("Lỗi kết nối Firebase nội bộ viện!", "error");
    }
}
// =========================================================================

function moPopupDongGoi(id) { idDangDongGoi = id; let item = listGiaoDich.find(x => x.firestoreId === id); if(item) { document.getElementById("popDG_Bo").innerText = item.bo; tinhHanSuDung(); document.getElementById("popupDongGoi").classList.remove("hidden"); } }
function closePopupDongGoi() { document.getElementById("popupDongGoi").classList.add("hidden"); }
function tinhHanSuDung() { let val = document.getElementById("popDG_Loai").value.split("|"); let days = parseInt(val[1]); let dateHSD = new Date(); dateHSD.setDate(dateHSD.getDate() + days); let p = document.getElementById("popDG_Han"); p.innerText = dateHSD.toLocaleDateString('vi-VN'); p.dataset.dateDB = dateHSD.toISOString().split('T')[0]; }
function chotDongGoi() { if(!idDangDongGoi) return; let chatLieuTen = document.getElementById("popDG_Loai").value.split("|")[0]; db.collection("phieuGiaoNhan").doc(idDangDongGoi).update({ status: "CHO_HAP", chatLieu: chatLieuTen, hsd: document.getElementById("popDG_Han").dataset.dateDB }).then(() => { showToast("Đã đóng gói, chuyển chờ hấp!", "success"); closePopupDongGoi(); callRender(); }); }
function toggleSelectAllHap() { let checked = document.getElementById('selectAllHap').checked; document.querySelectorAll('.hap-checkbox').forEach(cb => cb.checked = checked); }
function capNhatDanhSachMaMay() { const loaiHap = document.getElementById("hap_loaiHap")?.value; const selectMay = document.getElementById("hap_maySo"); if (!selectMay || !loaiHap) return; selectMay.innerHTML = ""; if (cauHinhMayHap[loaiHap]) { cauHinhMayHap[loaiHap].forEach(may => { selectMay.innerHTML += `<option value="${may}">${may}</option>`; }); } tuDongTaoMaLoMeHap(); }
function inTemTongHangLoat() { let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm để in tem!", "error"); let batchCode = document.getElementById("hap_batchId")?.value || "A1000000_01"; let container = document.createElement('div'); container.className = "print-label-container"; container.style.display = "flex"; container.style.flexWrap = "wrap"; container.style.width = "100%"; container.style.gap = "4px"; let stylePrint = document.createElement('style'); stylePrint.innerHTML = `@media print { body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: absolute; left: 0; top: 0; width: 100%; } .print-label-container { display: flex !important; flex-wrap: wrap !important; width: 100% !important; } .single-tem { width: 49% !important; page-break-inside: avoid; break-inside: avoid; } }`; container.appendChild(stylePrint); checkboxes.forEach((cb) => { let item = listGiaoDich.find(x => x.firestoreId === cb.value); if(item) { let cleanBo = item.bo ? item.bo.split(" [ID:")[0] : "N/A"; let dateHapStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-'); let dateHsdStr = item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN').replace(/\//g, '-') : dateHapStr; container.innerHTML += `<div class="single-tem" style="width: 49%; border: 1px solid #000; padding: 6px; font-family: Arial; font-size: 11px; color: #000; box-sizing: border-box; background: #fff; margin-bottom: 6px;"><div style="text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cleanBo}</div><div style="text-align: center;"><svg id="barcode-lo-${item.firestoreId}"></svg></div><div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; font-size: 10px;"><span>SL: ${item.slThucTe || 1}</span></div><div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px dashed #000; padding-top: 3px; font-size: 10px;"><span>${dateHapStr}</span><strong>HSD: ${dateHsdStr}</strong></div><div style="text-align: center; font-size: 9px; margin-top: 2px; font-family: monospace; font-weight: bold;">Lô: ${batchCode}</div></div>`; } }); const pZone = document.getElementById("print-zone"); pZone.innerHTML = ""; pZone.appendChild(container); pZone.classList.remove("hidden"); checkboxes.forEach(cb => { let item = listGiaoDich.find(x => x.firestoreId === cb.value); if(item) { let cleanId = item.maMacDinh ? item.maMacDinh.replace(/[^a-zA-Z0-9]/g, "") : "0000"; JsBarcode(`#barcode-lo-${item.firestoreId}`, cleanId, { format: "CODE128", width: 1.2, height: 30, displayValue: true, fontSize: 10, margin: 2 }); } }); setTimeout(() => { window.print(); pZone.classList.add("hidden"); }, 300); }
function toggleSelectAllNghiemThu() { let checked = document.getElementById('selectAllNghiemThu').checked; document.querySelectorAll('.nghiemthu-checkbox').forEach(cb => cb.checked = checked); }
function nhapKhoHangLoat() { 
    let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!"); 
    let p = []; 
    checkboxes.forEach(cb => { 
        if(cb.id === 'selectAllNghiemThu') return; 
        let itemData = listGiaoDich.find(x => x.firestoreId === cb.value);
        
        p.push(
            db.collection("phieuGiaoNhan").doc(cb.value).update({status: "CHO_XUAT"}).then(() => {
                if(itemData) {
                    dongBoSangMicrosoft365("NGHIEM_THU_DAT_VOHUAN", { ...itemData, status: "CHO_XUAT" });
                }
            })
        ); 
    }); 
    Promise.all(p).then(() => { showToast("Đã duyệt mâm đạt nhập kho Vô Khuẩn!", "success"); callRender(); }); 
}
function inTemNghiemThuHangLoat() { let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn mâm dụng cụ!", "error"); let container = document.createElement('div'); container.className = "print-label-container"; container.style.display = "flex"; container.style.flexWrap = "wrap"; container.style.width = "100%"; container.style.gap = "4px"; let stylePrint = document.createElement('style'); stylePrint.innerHTML = `@media print { body * { visibility: hidden; } #print-zone, #print-zone * { visibility: visible; } #print-zone { position: absolute; left: 0; top: 0; width: 100%; } .print-label-container { display: flex !important; flex-wrap: wrap !important; width: 100% !important; } .single-tem { width: 49% !important; page-break-inside: avoid; break-inside: avoid; } }`; container.appendChild(stylePrint); checkboxes.forEach((cb) => { let item = listGiaoDich.find(x => x.firestoreId === cb.value); if(item) { let cleanBo = item.bo ? item.bo.split(" [ID:")[0] : "N/A"; let dateHapStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-'); let dateHsdStr = item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN').replace(/\//g, '-') : dateHapStr; container.innerHTML += `<div class="single-tem" style="width: 49%; border: 1px solid #000; padding: 6px; font-family: Arial; font-size: 11px; color: #000; box-sizing: border-box; background: #fff; margin-bottom: 6px;"><div style="text-align: center; font-size: 9px; font-weight: bold;">PN HOSPITAL - CSSD</div><div style="text-align: center; font-weight: bold; font-size: 12px; margin: 2px 0;">${cleanBo}</div><div style="text-align: center;"><svg id="barcode-nt-${item.firestoreId}"></svg></div><div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px; font-size: 10px;"><span>SL: ${item.slThucTe || 1}</span><span style="color: green;">ĐẠT VÔ KHUẨN</span></div><div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; font-size: 10px;"><span>${dateHapStr}</span><strong>HSD: ${dateHsdStr}</strong></div><div style="text-align: center; font-size: 8px; font-weight: bold; margin-top: 2px; font-family: monospace;">BATCH: ${item.batchCode || 'N/A'}</div></div>`; } }); const pZone = document.getElementById("print-zone"); pZone.innerHTML = ""; pZone.appendChild(container); pZone.classList.remove("hidden"); checkboxes.forEach(cb => { let item = listGiaoDich.find(x => x.firestoreId === cb.value); if(item) { let cleanId = item.maMacDinh ? item.maMacDinh.replace(/[^a-zA-Z0-9]/g, "") : "0000"; JsBarcode(`#barcode-nt-${item.firestoreId}`, cleanId, { format: "CODE128", width: 1.2, height: 30, displayValue: true, fontSize: 10, margin: 2 }); } }); setTimeout(() => { window.print(); pZone.classList.add("hidden"); }, 300); }

function tuChoiHapHangLoat() { 
    let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); 
    if(checkboxes.length === 0) return showToast("Chọn mâm dụng cụ!", "error"); 
    let p = []; 
    checkboxes.forEach(cb => { 
        if(cb.id === 'selectAllNghiemThu') return; 
        p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({status: "DANG_RUA", ghiChu: "Không đạt hấp, trả về rửa lại"})); 
    }); 
    Promise.all(p).then(() => { 
        showToast("Đã trả các mâm không đạt về Trạm làm sạch!", "success"); 
        callRender(); 
    }); 
}

function resetDuLieuKet() { if(confirm("Dọn dẹp mâm kẹt?")) { let p = []; listGiaoDich.forEach(doc => { if(doc.status !== "HOAN_TAT") { p.push(db.collection("phieuGiaoNhan").doc(doc.firestoreId).update({ status: "HOAN_TAT", ghiChu: "Dọn kẹt" })); } }); Promise.all(p).then(() => callRender()); } }

function switchAdminSubtab(sub) { 
    document.getElementById('subtab-database')?.classList.add('hidden'); 
    document.getElementById('subtab-security')?.classList.add('hidden'); 
    document.getElementById('subbtn-database')?.classList.replace('admin-subtab-active', 'text-slate-600'); 
    document.getElementById('subbtn-security')?.classList.replace('admin-subtab-active', 'text-slate-600'); 
    document.getElementById('subtab-' + sub)?.classList.remove('hidden'); 
    document.getElementById('subbtn-' + sub)?.classList.add('admin-subtab-active'); 
}

function saveAdminPIN(type) { let newVal = document.getElementById(`cfg_pin${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}`).value.trim(); if(type === 'ADMIN') thongTinMatKhauAdmin.adminPIN = newVal; if(type === 'CSSD') thongTinMatKhauAdmin.cssdPIN = newVal; if(type === 'GUEST') thongTinMatKhauAdmin.guestPIN = newVal; db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ thongTinMatKhauAdmin: thongTinMatKhauAdmin }).then(() => showToast("Đã lưu PIN!", "success")); }
function themKtvCssd() { let code = prompt("Mã NV:"); let ten = prompt("Tên:"); let pin = prompt("PIN:"); if(code && ten && pin) { danhSachKtvCssd.push({ code: code.toUpperCase(), ten: ten, pin: pin }); db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKtvCssd: danhSachKtvCssd }); } }
function xoaKtvCssd(code) { if(confirm("Xóa?")) { danhSachKtvCssd = danhSachKtvCssd.filter(x => x.code !== code); db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKtvCssd: danhSachKtvCssd }); } }

function themKhoaThuCong() { 
    let t = prompt("Nhập Tên Khoa/Phòng mới cần thêm vào hệ thống:"); 
    if(t) { 
        danhSachKhoa.push({ ten: t.toUpperCase(), pin: "123", danhSachBo: [] }); 
        db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa })
        .then(() => showToast(`Đã thêm Khoa ${t.toUpperCase()} thành công!`, "success")); 
    } 
}

function khaiSinhKhayVangLai() {
    if(danhSachKhoa.length === 0) return showToast("Hệ thống chưa có Khoa nào để cấp phát khay!", "error");
    
    let tenKhay = prompt("Nhập Tên Mâm/Khay dụng cụ mới (Ví dụ: BỘ PHẪU THUẬT NỘI SOI):");
    if(!tenKhay) return;
    
    let maId = prompt("Nhập Mã ID định hình khay (Ví dụ: PC-8888):");
    if(!maId) return;
    maId = maId.toUpperCase().trim();

    let dsTenKhoa = danhSachKhoa.map((k, idx) => `${idx + 1}. ${k.ten}`).join("\n");
    let luaChon = prompt(`Chọn số thứ tự Khoa sở hữu khay này:\n${dsTenKhoa}`);
    if(!luaChon) return;
    
    let idxKhoa = parseInt(luaChon) - 1;
    if(isNaN(idxKhoa) || idxKhoa < 0 || idxKhoa >= danhSachKhoa.length) {
        return showToast("Lựa chọn Khoa không hợp lệ!", "error");
    }
    
    let khoaChon = danhSachKhoa[idxKhoa];
    let chuoiKhayDinhDang = `${tenKhay.toUpperCase().trim()} [ID:${maId}]`;
    
    if(!khoaChon.danhSachBo) khoaChon.danhSachBo = [];
    if(khoaChon.danhSachBo.includes(chuoiKhayDinhDang)) {
        return showToast("Mã khay dụng cụ này đã tồn tại ở khoa này rồi!", "error");
    }
    
    khoaChon.danhSachBo.push(chuoiKhayDinhDang);
    
    db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa })
    .then(() => {
        showToast(`Khai sinh thành công khay ${maId} thuộc quyền sở hữu khoa ${khoaChon.ten}!`, "success");
        callRender();
    }).catch(err => {
        console.error(err);
        showToast("Lỗi đồng bộ khay lên hệ thống!", "error");
    });
}

function updatePINTrựcTiep(idx, tenKhoa) { let p = document.getElementById(`pin-khoa-${idx}`).value.trim(); if(p) { danhSachKhoa.find(x => x.ten === tenKhoa).pin = p; db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa }).then(() => showToast("Đổi PIN thành công", "success")); } }

function initSelects() { 
    let opts = '<option value="">-- Chọn Khoa --</option>' + danhSachKhoa.map(k=>`<option value="${k.ten}">${k.ten}</option>`).join('');
    if(document.getElementById("login_khoa")) document.getElementById("login_khoa").innerHTML = opts; 
    if(document.getElementById("khoa_selKhoa")) document.getElementById("khoa_selKhoa").innerHTML = opts; 
    if(document.getElementById("login_nv_cssd")) document.getElementById("login_nv_cssd").innerHTML = '<option value="">-- Chọn KTV CSSD --</option>' + danhSachKtvCssd.map(k=>`<option value="${k.code}">${k.code} - ${k.ten}</option>`).join(''); 
    if (document.getElementById("hap_loaiHap")) { capNhatDanhSachMaMay(); }

    // --- TỰ ĐỘNG LẮNG NGHE SỰ KIỆN ĐỔI KHOA PHÒNG ---
    const selKhoaTraba = document.getElementById("khoa_selKhoa");
    if(selKhoaTraba) {
        // Xóa bám listener cũ nếu có tránh lặp sự kiện trước khi gán
        selKhoaTraba.removeEventListener("change", loadBoDungCuTheoKhoa);
        selKhoaTraba.addEventListener("change", loadBoDungCuTheoKhoa);
    }
}

function showToast(msg, type="error") { const t = document.createElement('div'); t.className = `fixed top-6 right-6 ${type==="error"?"bg-rose-600":"bg-emerald-600"} text-white px-5 py-3.5 rounded-lg shadow-2xl z-[100] font-bold text-sm`; t.innerHTML = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }
function toggleMobileMenu() { document.getElementById("sidebar_menu").classList.toggle("-translate-x-full"); document.getElementById("mobile-overlay").classList.toggle("hidden"); }

function toggleLoginFields() {
    const r = document.getElementById("login_role").value;
    document.getElementById("field_khoa").classList.toggle("hidden", r !== "KHOA");
    document.getElementById("field_nhanvien_cssd").classList.toggle("hidden", r !== "CSSD");
}

function moCamera(inputId) { targetInputIdForScan = inputId; document.getElementById("popupScanner").classList.remove("hidden"); html5QrCode = new Html5Qrcode("reader"); Html5Qrcode.getCameras().then(devices => { let cid = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id; html5QrCode.start(cid, { fps: 15, qrbox: { width: 260, height: 180 } }, (txt) => { document.getElementById(targetInputIdForScan).value = txt.trim().toUpperCase(); if(targetInputIdForScan==='khoa_inpMaBo') themVaoGio(); if(targetInputIdForScan==='xuat_inpMaBo') xuatKhoXoayVong(); if(targetInputIdForScan==='sd_maKhayInp') scanKhayVaoSuDung(); }).catch(e=>{}) }); }
function dongCamera() { if(html5QrCode) html5QrCode.stop().then(() => html5QrCode.clear()); document.getElementById("popupScanner").classList.add("hidden"); }
function xoaSachDuLieuGiaoDichRealtime() { if(prompt("Nhập PIN ADMIN để xóa:") === (thongTinMatKhauAdmin.adminPIN||"admin2026")) { db.collection("phieuGiaoNhan").get().then(snap => { let b = db.batch(); snap.forEach(d => b.delete(d.ref)); b.commit().then(() => location.reload()); }); } }

function truyVetTheoMaBatch() {
    let maMẻKhẩnCấp = "";
    let inputs = document.querySelectorAll('input[placeholder*="A126"], input[id="inp_searchBatch"], input[placeholder*="Mẻ hấp"]');
    for (let inp of inputs) { if (inp.value && inp.value.trim()) { maMẻKhẩnCấp = inp.value.trim(); break; } }
    if(!maMẻKhẩnCấp) { return showToast("Vui lòng nhập mã mẻ hấp cần truy vết khẩn cấp!", "error"); }
    maLoTruyVetToanCuc = maMẻKhẩnCấp.toUpperCase();
    switchTab('tracuu');
    if (typeof switchAdminSubtab === 'function') { try { switchAdminSubtab('database'); } catch(e){} }
    document.querySelectorAll('input[id="inp_searchBatch"]').forEach(inp => { inp.value = maLoTruyVetToanCuc; });
    renderTheoTabHienTai();
    showToast(`Hệ thống đã khoanh vùng khẩn cấp mẻ: ${maLoTruyVetToanCuc}`, "success");
}

function clearTruyVetBatch() { 
    maLoTruyVetToanCuc = ""; 
    document.querySelectorAll('input[id="inp_searchBatch"]').forEach(inp => { inp.value = ""; });
    const dynamicTable = document.getElementById("vung-ket-qua-tu-dong");
    if (dynamicTable) dynamicTable.remove();
    callRender(); 
}

function nhanFileExcelDanhMuc(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            if (rawRows.length === 0) return showToast("File Excel trống hoặc cấu trúc sai!", "error");

            let tapHopKhoa = new Set();
            let danhSachBoTheoKhoa = {}; 
            let duLieuExcelChuanHoa = [];

            for (let i = 0; i < rawRows.length; i++) {
                let row = rawRows[i];
                if (!row || row.length === 0) continue;

                if (String(row[0]).toUpperCase().includes("KHOA") && String(row[2]).toUpperCase().includes("BỘ")) continue;

                let tenKhoa = row[0] ? String(row[0]).trim().toUpperCase() : "";
                let maBo = row[1] ? String(row[1]).trim().toUpperCase() : "";
                let tenBo = row[2] ? String(row[2]).trim() : "";
                let soLuong = parseInt(row[3]) || 1;

                if (tenKhoa && tenBo) {
                    tapHopKhoa.add(tenKhoa);
                    if (!danhSachBoTheoKhoa[tenKhoa]) danhSachBoTheoKhoa[tenKhoa] = new Set();
                    
                    danhSachBoTheoKhoa[tenKhoa].add(`${tenBo.toUpperCase()} [ID:${maBo}]`);

                    duLieuExcelChuanHoa.push({ 
                        "Tên Bộ Dụng Cụ": tenBo.toUpperCase(), 
                        "Tên Dụng Cụ Chi Tiết": "Nguyên bộ cấu hình cơ số", 
                        "Số lượng": soLuong,
                        "Tuổi thọ mẻ hấp": 100 
                    });
                }
            }

            let mangDanhSachKhoaMoi = Array.from(tapHopKhoa).map(khoaName => {
                return { ten: khoaName, pin: "123", danhSachBo: Array.from(danhSachBoTheoKhoa[khoaName]) };
            });

            if (duLieuExcelChuanHoa.length === 0) return showToast("Không tìm thấy hàng dữ liệu hợp lệ!", "error");

            db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({
                danhSachKhoa: mangDanhSachKhoaMoi,
                databaseExcel: duLieuExcelChuanHoa
            }).then(() => {
                showToast(`Thành công! Đã cập nhật ${mangDanhSachKhoaMoi.length} Khoa/Phòng lên hệ thống.`, "success");
                inputElement.value = ""; 
            }).catch(err => {
                showToast("Lỗi đẩy dữ liệu lên Firestore!", "error");
            });
        } catch (err) {
            showToast("Lỗi phân tích file Excel!", "error");
        }
    };
    reader.readAsArrayBuffer(file);
}

function dongBoSangMicrosoft365(hanhDong, duLieuGiaoDich) {
    const POWER_AUTOMATE_WEBHOOK_URL = ""; 
    
    if (!POWER_AUTOMATE_WEBHOOK_URL) {
        console.log("Module Microsoft 365 đang chạy ẩn ở chế độ chờ kích hoạt...");
        return;
    }

    const dataPayload = {
        action: hanhDong, 
        maIDKhay: duLieuGiaoDich.maMacDinh || "N/A",
        tenBoDungCu: duLieuGiaoDich.bo ? duLieuGiaoDich.bo.split(" [ID:")[0] : "N/A",
        khoaSudung: duLieuGiaoDich.khoa || "N/A",
        maLoHap: duLieuGiaoDich.batchCode || "N/A",
        ngayThucHien: getTodayDateStr(),
        thoiGian: new Date().toLocaleTimeString('vi-VN'),
        nguoiVanHanh: loginUserCode || "CSSD_CHUNG",
        loaiMayHap: duLieuGiaoDich.thongTinLoHap?.loaiHap || "N/A",
        chuKyNhiet: duLieuGiaoDich.thongTinLoHap?.chuKyNhiet || "N/A",
        ketQuaSinhHoc: duLieuGiaoDich.thongTinLoHap?.giamSatChatLuong?.ketQuaSinhHoc || "N/A"
    };

    fetch(POWER_AUTOMATE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataPayload)
    })
    .then(response => {
        if(response.ok) console.log("Đồng bộ log sang luồng dữ liệu Microsoft 365 thành công!");
    })
    .catch(err => console.error("Trạm trung chuyển Microsoft 365 ngắt kết nối hoặc sai URL:", err));
}

let gioKhaySuDungTam = []; 

function moPopupSuDungBoDungCu() {
    gioKhaySuDungTam = [];
    document.getElementById("sd_bangKhayChon").innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Vui lòng quét hoặc nhập mã khay dụng cụ để liên kết...</td></tr>`;
    
    document.getElementById("sd_ngaySuDung").value = getTodayDateStr();
    document.getElementById("sd_nhanChung").value = loginUserCode || "ADMIN";
    
    document.getElementById("sd_khoaBenhNhan").value = currentRole === "KHOA" ? loginUserCode : "";
    document.getElementById("sd_yTaPhongMo").value = "";
    document.getElementById("sd_yTaVongNgoai").value = "";
    document.getElementById("sd_searchBN").value = "";
    document.getElementById("sd_ghiChu").value = "";
    document.getElementById("sd_maKhayInp").value = "";
    
    document.getElementById("popupSuDungBoDungCu").classList.remove("hidden");
}

function closePopupSuDung() {
    document.getElementById("popupSuDungBoDungCu").classList.add("hidden");
}

function scanKhayVaoSuDung() {
    let ma = document.getElementById("sd_maKhayInp").value.trim().toUpperCase();
    if(!ma) return;
    document.getElementById("sd_maKhayInp").value = "";

    if(gioKhaySuDungTam.some(x => x.maMacDinh === ma)) {
        playSound('error');
        return showToast("Mã khay này đã được quét vào danh sách!", "error");
    }

    let khayThucTe = listGiaoDich.find(x => x.maMacDinh === ma && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT"));
    if(!khayThucTe) {
        playSound('error');
        return showToast(`Mã ID ${ma} không có sẵn hoặc chưa đạt chuẩn vô khuẩn!`, "error");
    }

    gioKhaySuDungTam.push(khayThucTe);
    playSound('success');
    renderBangKhaySuDung();
}

function renderBangKhaySuDung() {
    const tbody = document.getElementById("sd_bangKhayChon");
    if(gioKhaySuDungTam.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Vui lòng quét hoặc nhập mã khay dụng cụ để liên kết...</td></tr>`;
        return;
    }
    tbody.innerHTML = gioKhaySuDungTam.map((item, index) => {
        return `<tr class="border-b font-medium hover:bg-slate-50">
            <td class="p-2 text-center"><i class="fa-solid fa-square-check text-teal-600 text-sm"></i></td>
            <td class="p-2 font-mono font-bold text-sky-700">${item.maMacDinh}</td>
            <td class="p-2 font-bold text-slate-800">${item.bo.split(" [ID:")[0]}</td>
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

function savePopupSuDung() {
    let khoaBN = document.getElementById("sd_khoaBenhNhan").value.trim();
    let yTaPM = document.getElementById("sd_yTaPhongMo").value.trim();
    let searchBN = document.getElementById("sd_searchBN").value.trim();
    
    if(!khoaBN || !yTaPM || !searchBN) {
        return showToast("Vui lòng điền đầy đủ các trường bắt buộc (*)", "error");
    }
    if(gioKhaySuDungTam.length === 0) {
        return showToast("Danh sách khay dụng cụ trống!", "error");
    }

    let batchUpdates = [];
    let ngaySuDung = document.getElementById("sd_ngaySuDung").value;
    let yTaVN = document.getElementById("sd_yTaVongNgoai").value.trim();
    let ghiChu = document.getElementById("sd_ghiChu").value.trim();
    let nhanChung = document.getElementById("sd_nhanChung").value;

    gioKhaySuDungTam.forEach(khay => {
        let thongTinMoi = {
            status: "DA_SU_DUNG",
            thongTinBenhNhan: {
                khoaBenhNhan: khoaBN,
                yTaPhongMo: yTaPM,
                yTaVongNgoai: yTaVN || "N/A",
                thongTinTimKiemBN: searchBN,
                ngaySuDung: ngaySuDung,
                timeSuDung: new Date().toLocaleTimeString('vi-VN'),
                nhanChungYTe: nhanChung,
                ghiChuLamSang: ghiChu
            }
        };

        batchUpdates.push(db.collection("phieuGiaoNhan").doc(khay.firestoreId).update(thongTinMoi).then(() => {
            if (typeof dongBoSangMicrosoft365 === 'function') {
                dongBoSangMicrosoft365("GHI_NHAN_SU_DUNG_BN", {
                    ...khay,
                    khoa: khoaBN,
                    thongTinLoHap: {
                        ...khay.thongTinLoHap,
                        giamSatChatLuong: {
                            ketQuaSinhHoc: `Sử dụng BN: ${searchBN} | Y tá PM: ${yTaPM}`
                        }
                    }
                });
            }
        }));
    });

    Promise.all(batchUpdates).then(() => {
        playSound('success');
        showToast(`Đã liên kết thành công ${gioKhaySuDungTam.length} mâm dụng cụ vào hồ sơ bệnh án!`, "success");
        closePopupSuDung();
        callRender();
    }).catch(err => {
        console.error(err);
        showToast("Lỗi đồng bộ dữ liệu lâm sàng!", "error");
    });
}
