const firebaseConfig = { apiKey: "AIzaSyCxjdCTKHQlpm7SYbWCEws1HhcOaFp0LBA", authDomain: "cssd-system-2878c.firebaseapp.com", projectId: "cssd-system-2878c", storageBucket: "cssd-system-2878c.firebasestorage.app", messagingSenderId: "662377321937", appId: "1:662377321937:web:001c092e10319547623cf0" };
firebase.initializeApp(firebaseConfig); const db = firebase.firestore();

let thongTinMatKhauAdmin = { adminPIN: "admin2026", cssdPIN: "cssd2026", guestPIN: "guest2026" };
let currentRole = "", loginUserCode = "";
let danhSachKhoa = [], listGiaoDich = [], gioHangTam = [], danhSachKtvCssd = [], databaseExcel = [];

let html5QrCode = null; let targetInputIdForScan = ""; let idDangKiemDem = null; let idDangDongGoi = null;
let activeTab = 'thugom'; let renderTimeout = null;

function getTodayDateStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// --- KHU VỰC CÁC HÀM LẮNG NGHE DỮ LIỆU TỪ FIREBASE (REALTIME LISTENERS) ---

db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").onSnapshot(doc => { 
    if (doc.exists) { 
        let res = doc.data(); 
        danhSachKhoa = res.danhSachKhoa || []; 
        danhSachKtvCssd = res.danhSachKtvCssd || []; 
        databaseExcel = res.databaseExcel || []; 
        if(res.thongTinMatKhauAdmin) thongTinMatKhauAdmin = Object.assign(thongTinMatKhauAdmin, res.thongTinMatKhauAdmin); 
    } 
    initSelects();
    if(activeTab === 'khoaphong') loadBoDungCuTheoKhoa(); 
    renderAdminInterface(); 
    callRender();
});

db.collection("phieuGiaoNhan").orderBy("id", "desc").limit(1000).onSnapshot(snap => { 
    listGiaoDich = []; snap.forEach(doc => { let d = doc.data(); d.firestoreId = doc.id; listGiaoDich.push(d); }); 
    callRender();
});

function taiDanhMucLinhKienChuand() {
    db.collection("danhMucLinhKien").orderBy("tenLoaiBo").onSnapshot((snapshot) => {
        const tbody = document.getElementById("bangDanhMucLinhKien");
        const badge = document.getElementById("badgeDanhMucLinhKien");
        if (!tbody) return; tbody.innerHTML = "";
        if (badge) badge.innerText = `${snapshot.size} Loại bộ`;
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400 italic">Chưa có dữ liệu cấu hình bộ linh kiện. Vui lòng nạp Excel ở Tab 8.</td></tr>`;
            return;
        }
        snapshot.forEach((doc) => {
            const data = doc.data();
            let linhKienHtml = `<div class="flex flex-wrap gap-1">`;
            if (data.chiTiet && Array.isArray(data.chiTiet)) {
                data.chiTiet.forEach(item => {
                    linhKienHtml += `<span class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">${item.tenBaoCao || item.tenChiTiet} (${item.soLuong})</span>`;
                });
            } else { linhKienHtml += `<span class="text-slate-400 italic">Không có chi tiết</span>`; }
            linhKienHtml += `</div>`;
            const tr = document.createElement("tr"); tr.className = "hover:bg-slate-50 transition-colors";
            tr.innerHTML = `<td class="p-3 font-bold text-slate-800">${data.tenLoaiBo}</td><td class="p-3">${linhKienHtml}</td><td class="p-3 text-center font-black text-sky-700 bg-sky-50/30">${data.tongSoLuong || 0}</td>`;
            tbody.appendChild(tr);
        });
    });
}

// --- KHU VỰC CÁC HÀM LOGIC VẬN HÀNH ỨNG DỤNG ---

function callRender() { clearTimeout(renderTimeout); renderTimeout = setTimeout(() => { renderTheoTabHienTai(); }, 100); }

function anTatCaHeadersVaMenus() {
    document.getElementById('header-lamsang')?.classList.add('hidden');
    document.getElementById('header-vanhanh')?.classList.add('hidden');
    document.getElementById('header-dulieu')?.classList.add('hidden');
    ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','tracuu','performance'].forEach(x => {
        document.getElementById('menu-' + x)?.classList.add('hidden');
    });
}

function checkLogin() {
    const role = document.getElementById("login_role").value; 
    const pass = document.getElementById("login_pass").value; 
    let pA = thongTinMatKhauAdmin.adminPIN || "admin2026"; 
    let pC = thongTinMatKhauAdmin.cssdPIN || "cssd2026"; 
    let pG = thongTinMatKhauAdmin.guestPIN || "guest2026"; 
    
    anTatCaHeadersVaMenus();

    if (role === "ADMIN" && pass === pA) { 
        currentRole = "ADMIN"; loginUserCode = "ADMIN"; document.getElementById("nav_user_info").innerText = "ADMINISTRATOR";
        document.getElementById("khoa_selKhoa").disabled = false; document.body.classList.remove('guest-mode');
        
        document.getElementById('header-lamsang').classList.remove('hidden'); 
        document.getElementById('header-vanhanh').classList.remove('hidden'); 
        document.getElementById('header-dulieu').classList.remove('hidden');
        ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','tracuu','performance'].forEach(x => document.getElementById('menu-'+x).classList.remove('hidden'));
        switchTab('tracuu');
    } else if (role === "KHOA") { 
        const khoaSelect = document.getElementById("login_khoa").value; 
        let found = danhSachKhoa.find(x => x.ten === khoaSelect); 
        if (pass === (found ? found.pin : "123")) { 
            currentRole = "KHOA"; loginUserCode = khoaSelect; document.getElementById("nav_user_info").innerText = khoaSelect; 
            document.getElementById("khoa_selKhoa").value = khoaSelect; document.getElementById("khoa_selKhoa").disabled = true; document.body.classList.remove('guest-mode');
            
            document.getElementById('header-lamsang').classList.remove('hidden'); 
            document.getElementById('header-dulieu').classList.remove('hidden');
            document.getElementById('menu-khoaphong').classList.remove('hidden'); 
            document.getElementById('menu-quanlykho').classList.remove('hidden');
            switchTab('khoaphong');
        } else { return showToast("Sai mã PIN Khoa!", "error"); } 
    } else if (role === "CSSD") {
        const nvCode = document.getElementById("login_nv_cssd").value;
        if(!nvCode && pass === pC) { currentRole = "CSSD"; loginUserCode = "CSSD_CHUNG"; document.getElementById("nav_user_info").innerText = "CSSD GENERAL"; } 
        else if (nvCode) {
            let nv = danhSachKtvCssd.find(x => x.code === nvCode);
            if (nv && pass === nv.pin) { currentRole = "CSSD"; loginUserCode = nvCode; document.getElementById("nav_user_info").innerText = `${nvCode} - ${nv.ten}`; }
            else { return showToast("Sai mã PIN của nhân viên này!", "error"); }
        } else { return showToast("Vui lòng chọn Nhân viên hoặc nhập PIN Backup!", "error"); }
        
        document.getElementById("khoa_selKhoa").disabled = false; document.body.classList.remove('guest-mode');
        
        document.getElementById('header-vanhanh').classList.remove('hidden'); 
        document.getElementById('header-dulieu').classList.remove('hidden');
        ['thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','tracuu'].forEach(x => document.getElementById('menu-'+x).classList.remove('hidden'));
        switchTab('thugom');
    } else if (role === "GUEST") {
        if(pass === pG) {
            currentRole = "GUEST"; loginUserCode = "GUEST"; document.getElementById("nav_user_info").innerText = "KHÁCH THAM QUAN";
            document.body.classList.add('guest-mode'); 
            document.getElementById('header-dulieu').classList.remove('hidden');
            ['quanlykho','danhmuc','performance'].forEach(x => document.getElementById('menu-'+x).classList.remove('hidden'));
            switchTab('quanlykho');
        } else { return showToast("Sai mã PIN Khách tham quan!", "error"); }
    } else { return showToast("Sai thông tin đăng nhập!", "error"); }
    document.getElementById("login-screen").classList.add("hidden"); document.getElementById("main-app").classList.remove("hidden");
}

function switchTab(t) { 
    ['khoaphong','thugom','donggoi','mayhap','khovokhuan','quanlykho','danhmuc','tracuu','performance'].forEach(x => { 
        document.getElementById('tab-'+x)?.classList.add('hidden'); document.getElementById('menu-'+x)?.classList.remove('sidebar-item-active'); 
    }); 
    document.getElementById('tab-'+t)?.classList.remove('hidden'); document.getElementById('menu-'+t)?.classList.add('sidebar-item-active'); 
    activeTab = t; callRender(); 
}

// --- TAB 1 : CHỨC NĂNG IN BIÊN BẢN ---
function loadBoDungCuTheoKhoa() { let k = document.getElementById("khoa_selKhoa").value; let list = document.getElementById("listBoDungCu"); let f = danhSachKhoa.find(x => x.ten === k); list.innerHTML = (f && f.danhSachBo) ? f.danhSachBo.map(x => `<option value="${x}">`).join('') : ""; }
function themVaoGio() { let val = document.getElementById("khoa_inpMaBo").value.trim().toUpperCase(); if(!val) return; if (gioHangTam.some(x => x.maMacDinh === val)) { document.getElementById("khoa_inpMaBo").value = ""; return showToast("Mã này đã có trong danh sách chờ!", "error"); } let tenGoc = val.includes("[ID:") ? val.split(" [ID:")[0] : val; gioHangTam.push({bo: tenGoc, maMacDinh: val, slYeuCau: 1}); document.getElementById("khoa_inpMaBo").value = ""; renderGioHang(); }
function renderGioHang() { let khuVuc = document.getElementById("khuVucGioHang"); if(khuVuc) khuVuc.classList.toggle("hidden", gioHangTam.length===0); document.getElementById("bangGioHang").innerHTML = gioHangTam.map(i => `<tr><td class="p-2.5 font-bold text-sky-700 text-[11px]">${i.bo}</td></tr>`).join(''); }
function clearGioHang() { gioHangTam = []; renderGioHang(); }
function khoaGuiPhieuTraBatches() { const k = document.getElementById("khoa_selKhoa").value; if(!k) return showToast("Vui lòng chọn Khoa trước!"); if(gioHangTam.length === 0) return showToast("Không có dụng cụ trong danh sách!"); let p=[]; gioHangTam.forEach((i,idx) => p.push(db.collection("phieuGiaoNhan").add({ id: Date.now()+idx, ngayTao: getTodayDateStr(), time: new Date().toLocaleTimeString('vi-VN'), khoa: k, bo: i.bo, maMacDinh: i.maMacDinh, slYeuCau: 1, slThucTe: 1, status: "CHO_THU" }))); Promise.all(p).then(() => { clearGioHang(); showToast("Đã gửi lệnh thu gom đến CSSD!", "success"); callRender(); }); }

function inHoaDonGiaoNhan() {
    const k = document.getElementById("khoa_selKhoa").value; if (!k) return showToast("Vui lòng chọn Khoa/Phòng trước khi in!", "error");
    let printHtml = `<div style="text-align:center; margin-bottom: 20px;"><h2>BIÊN BẢN GIAO NHẬN DỤNG CỤ CSSD</h2><p>Khoa/Phòng: <strong>${k}</strong> - Ngày xuất phiếu: <strong>${new Date().toLocaleDateString('vi-VN')}</strong></p></div><table style="width:100%; border-collapse: collapse; text-align: left; font-size: 13px;"><thead><tr><th style="border: 1px solid #000; padding: 10px;">Phân Loại Mâm / Loại Dụng Cụ</th><th style="border: 1px solid #000; padding: 10px; text-align: center;">Đã Trả Bẩn</th><th style="border: 1px solid #000; padding: 10px; text-align: center;">Nhận Sạch</th><th style="border: 1px solid #000; padding: 10px; text-align: center;">CSSD Nợ Khoa</th></tr></thead><tbody>${document.getElementById("bangHoaDonGiaoNhan").innerHTML}</tbody></table>`;
    const pZone = document.getElementById("print-zone"); pZone.innerHTML = printHtml; pZone.classList.remove("hidden"); window.print(); pZone.classList.add("hidden");
}

// --- TAB 2 : BẢNG CHECKLIST CHI TIẾT THEO MÂM & POPUP KIỂM ĐẾM ---
function moPopupKiemDem(id) { 
    idDangKiemDem = id; let item = listGiaoDich.find(x => x.firestoreId === id); 
    if(item) { 
        document.getElementById("popBo").innerText = item.bo; document.getElementById("popKhoa").innerText = item.khoa; 
        let tenBo = item.bo.split(" [ID:")[0];
        let itemsInBo = databaseExcel.filter(x => { let boName = x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ']; return String(boName).trim().toUpperCase() === String(tenBo).trim().toUpperCase(); });
        let chkList = document.getElementById("popKiemDemChecklist");
        if(itemsInBo.length > 0) { chkList.innerHTML = itemsInBo.map((ct, idx) => { let tenDc = ct['Tên Dụng Cụ Chi Tiết'] || ct['Tên dụng cụ'] || ct['Chi tiết'] || ct['Dụng cụ'] || ct['TÊN DỤNG CỤ'] || ct['Tên Chi Tiết'] || "Dụng cụ"; let sl = ct['Số lượng'] || ct['SL'] || ct['Số Lượng'] || 1; return `<label class="flex items-center justify-between py-2 border-b border-slate-200 cursor-pointer hover:bg-slate-100 px-2 rounded"><div class="flex items-center gap-2"><input type="checkbox" class="w-4 h-4 rounded text-sky-600"><span class="text-[12px] font-bold text-slate-700">${tenDc}</span></div><span class="text-[12px] font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded">SL: ${sl}</span></label>`; }).join(''); } 
        else { chkList.innerHTML = `<p class="italic text-center text-[11px] text-slate-400 py-4">Hệ thống chưa có cấu hình chi tiết bộ dụng cụ này. Vui lòng tự kiểm đếm.</p>`; }
        document.getElementById("popGhiChu").value = ""; document.getElementById("popupKiemDem").classList.remove("hidden"); 
    } 
}
function closePopupKiemDem() { document.getElementById("popupKiemDem").classList.add("hidden"); }
function saveKiemDem() { if(!idDangKiemDem) return; db.collection("phieuGiaoNhan").doc(idDangKiemDem).update({ status: "DANG_RUA", ghiChu: document.getElementById("popGhiChu").value }).then(() => { showToast("Đã chuyển mâm sang Trạm Làm Sạch!", "success"); closePopupKiemDem(); callRender(); }); }

function moPopupDongGoi(id) { 
    idDangDongGoi = id; let item = listGiaoDich.find(x => x.firestoreId === id); 
    if(item) { 
        document.getElementById("popDG_Bo").innerText = item.bo; 
        
        // CẬP NHẬT CHUẨN: Đồng bộ chính xác danh mục vật liệu và số ngày HSD bệnh viện quy định
        const selectChatLieu = document.getElementById("popDG_Loai");
        if (selectChatLieu) {
            selectChatLieu.innerHTML = `
                <option value="Vải|7">Vải - 7 Ngày</option>
                <option value="Túi ép nhiệt độ cao|30">Túi ép nhiệt độ cao - 30 Ngày</option>
                <option value="Giấy gói chuyên dụng (vải không dệt)|30">Giấy gói chuyên dụng (vải không dệt) - 30 Ngày</option>
                <option value="Hộp chuyên dụng|90">Hộp chuyên dụng - 90 Ngày</option>
                <option value="Túi ép nhiệt độ thấp (Tyvek)|90">Túi ép nhiệt độ thấp (Tyvek) - 90 Ngày</option>
            `;
        }
        tinhHanSuDung(); 
        document.getElementById("popupDongGoi").classList.remove("hidden"); 
    } 
}
function closePopupDongGoi() { document.getElementById("popupDongGoi").classList.add("hidden"); }
function tinhHanSuDung() { let val = document.getElementById("popDG_Loai").value.split("|"); let days = parseInt(val[1]); let dateHSD = new Date(); dateHSD.setDate(dateHSD.getDate() + days); let p = document.getElementById("popDG_Han"); p.innerText = dateHSD.toLocaleDateString('vi-VN'); p.dataset.dateDB = dateHSD.toISOString().split('T')[0]; }
function chotDongGoi() { if(!idDangDongGoi) return; let chatLieuTen = document.getElementById("popDG_Loai").value.split("|")[0]; db.collection("phieuGiaoNhan").doc(idDangDongGoi).update({ status: "CHO_HAP", chatLieu: chatLieuTen, hsd: document.getElementById("popDG_Han").dataset.dateDB }).then(() => { showToast("Đã đóng gói, chuyển chờ hấp!", "success"); closePopupDongGoi(); callRender(); }); }

function toggleSelectAllHap() { let checked = document.getElementById('selectAllHap').checked; document.querySelectorAll('.hap-checkbox').forEach(cb => cb.checked = checked); }

function inTemTongHangLoat() { 
    let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); 
    if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm để in tem!", "error"); 
    let batchCode = document.getElementById("hap_maySo").value;
    let contentIn = `<h3>DANH SÁCH TEM MẺ HẤP (LÔ: ${batchCode})</h3><hr/>`;
    checkboxes.forEach(cb => {
        let item = listGiaoDich.find(x => x.firestoreId === cb.value);
        if(item) {
            contentIn += `<div style="border:1px dashed #000; padding:10px; margin-bottom:10px; font-family:monospace; width:300px;">
                <strong>MÂM: ${item.bo}</strong><br/>
                ID: ${item.maMacDinh}<br/>
                Lô hấp: ${batchCode}<br/>
                Ngày hấp: ${new Date().toLocaleDateString('vi-VN')}<br/>
                HSD: ${item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN') : 'N/A'}<br/>
            </div>`;
        }
    });
    const pZone = document.getElementById("print-zone"); pZone.innerHTML = contentIn; pZone.classList.remove("hidden"); window.print(); pZone.classList.add("hidden");
    showToast("Đã kết xuất và xuất lệnh in tem mẻ hấp!", "success"); 
}

function xacNhanMeHap() { 
    let checkboxes = document.querySelectorAll('.hap-checkbox:checked'); 
    if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!", "error"); 
    
    let mayInp = document.getElementById("hap_maySo").value; // Lấy "Máy 01" hoặc "Máy 02"
    let soMe = document.getElementById("hap_meSo").value.padStart(2, '0'); // Lấy số chu kỳ ví dụ "01"
    
    // Tự động sinh mã lô chuẩn y tế (Ví dụ: Máy 01 ngày 2026-06-27 mẻ 01 -> A1260627_01)
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    let mayKyHieu = mayInp.includes("02") ? "2" : "1";
    let batchCode = `A${mayKyHieu}${yy}${mm}${dd}_${soMe}`;

    let p = []; 
    checkboxes.forEach(cb => { 
        if(cb.id === 'selectAllHap') return; 
        p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({ status: "DANG_HAP", batchCode: batchCode })); 
    }); 
    Promise.all(p).then(() => { 
        showToast(`Đã kích hoạt lò hấp thành công! Mã Lô: ${batchCode}`, "success"); 
        callRender(); 
    }); 
}

function toggleSelectAllNghiemThu() { let checked = document.getElementById('selectAllNghiemThu').checked; document.querySelectorAll('.nghiemthu-checkbox').forEach(cb => cb.checked = checked); }
function nhapKhoHangLoat() { let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!"); let p = []; checkboxes.forEach(cb => { if(cb.id === 'selectAllNghiemThu') return; p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({status: "CHO_XUAT"})); }); Promise.all(p).then(() => { showToast("Đã nhập kho Vô Khuẩn!", "success"); callRender(); }); }

function inTemNghiemThuHangLoat() { 
    let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); 
    if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm để in tem nghiệm thu!", "error"); 
    let contentIn = `<h3>TEM NGHIỆM THU ĐẠT VÔ KHUẨN</h3><hr/>`;
    checkboxes.forEach(cb => {
        let item = listGiaoDich.find(x => x.firestoreId === cb.value);
        if(item) {
            contentIn += `<div style="border:2px solid #000; padding:12px; margin-bottom:10px; font-family:sans-serif; width:320px; text-align:center;">
                <h4 style="margin:0 0 5px 0;">P.NAM HOSPITAL - CSSD</h4>
                <span style="font-size:14px; font-weight:bold;">${item.bo}</span><br/>
                <small>Mã ID: ${item.maMacDinh}</small><br/>
                <table style="width:100%; font-size:11px; margin-top:5px; text-align:left;">
                    <tr><td>Lô hấp (Batch):</td><td><strong>${item.batchCode || 'N/A'}</strong></td></tr>
                    <tr><td>Trạng thái:</td><td><strong style="color:green;">ĐẠT VÔ KHUẨN</strong></td></tr>
                    <tr><td>Hạn sử dụng:</td><td><strong>${item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN') : 'N/A'}</strong></td></tr>
                </table>
            </div>`;
        }
    });
    const pZone = document.getElementById("print-zone"); pZone.innerHTML = contentIn; pZone.classList.remove("hidden"); window.print(); pZone.classList.add("hidden");
    showToast("Đang kết xuất tem nghiệm thu vô khuẩn...", "success"); 
}

function tuChoiHapHangLoat() { let checkboxes = document.querySelectorAll('.nghiemthu-checkbox:checked'); if(checkboxes.length === 0) return showToast("Chọn ít nhất 1 mâm!", "error"); let p = []; checkboxes.forEach(cb => { if(cb.id === 'selectAllNghiemThu') return; p.push(db.collection("phieuGiaoNhan").doc(cb.value).update({status: "DANG_RUA", ghiChu: "Không đạt hấp, trả về rửa lại"})); }); Promise.all(p).then(() => { showToast("Đã trả các mâm không đạt về Trạm làm sạch!", "success"); callRender(); }); }
function xuatKhoXoayVong() { const k = document.getElementById("xuat_selKhoa").value; const ma = document.getElementById("xuat_inpMaBo").value.trim().toUpperCase(); if(!k || !ma) return showToast("Vui lòng Chọn Khoa và Quét Mã!", "error"); let khayThucTe = listGiaoDich.find(x => x.maMacDinh === ma && x.status === "CHO_XUAT"); if(!khayThucTe) { document.getElementById("xuat_inpMaBo").value = ""; return showToast(`Mã ID ${ma} không có ở Kho Vô Khuẩn.`, "error"); } db.collection("phieuGiaoNhan").doc(khayThucTe.firestoreId).update({ status: "HOAN_TAT", khoa: k, ngayHoanTat: getTodayDateStr() }).then(() => { showToast(`Đã xuất cho Khoa ${k}!`, "success"); document.getElementById("xuat_inpMaBo").value = ""; callRender(); }); }

function renderTheoTabHienTai() {
    if(activeTab === 'khoaphong') {
        const k = document.getElementById("khoa_selKhoa").value;
        let arrHtml = []; let noK = listGiaoDich.filter(x => x.khoa === k && x.status !== "HOAN_TAT" && x.status !== "CHO_XUAT");
        let gopNo = {}; noK.forEach(x => { let ten = x.bo.split(" [ID:")[0]; gopNo[ten] = (gopNo[ten]||0) + 1; });
        for (let key in gopNo) { arrHtml.push(`<tr class="border-b"><td class="p-3 font-bold text-slate-800">${key}</td><td class="p-3 text-center">-</td><td class="p-3 text-center">-</td><td class="p-3 text-center text-rose-600 font-bold">Nợ ${gopNo[key]}</td></tr>`); }
        document.getElementById("bangHoaDonGiaoNhan").innerHTML = arrHtml.length ? arrHtml.join('') : `<tr><td colspan="4" class="p-8 text-center text-slate-400 italic">Khoa chưa phát sinh nợ/trả.</td></tr>`;
    }
    else if(activeTab === 'thugom') {
        let lsTG = listGiaoDich.filter(x => x.status === "CHO_THU"); 
        document.getElementById("bangChoThuGom").innerHTML = lsTG.map(i => {
            let tenBo = i.bo.split(" [ID:")[0];
            let itemsInBo = databaseExcel.filter(x => { let boName = x['Tên Bộ Dụng Cụ'] || x['Bộ dụng cụ'] || x['Dụng cụ'] || x['TÊN BỘ'] || x['Tên Bộ']; return String(boName).trim().toUpperCase() === String(tenBo).trim().toUpperCase(); });
            let checklistHtml = itemsInBo.length > 0 ? `<div class="max-h-24 overflow-y-auto pr-1">` + itemsInBo.map(item => { let tenDc = item['Tên Dụng Cụ Chi Tiết'] || item['Tên dụng cụ'] || item['Chi tiết'] || item['Dụng cụ'] || item['TÊN DỤNG CỤ'] || item['Tên Chi Tiết'] || "Dụng cụ"; let sl = item['Số lượng'] || item['SL'] || item['Số Lượng'] || 1; return `<div class="flex justify-between border-b border-dashed border-slate-200 py-1 text-[10px] text-slate-600"><span>- ${tenDc}</span><span class="font-bold text-sky-700">x${sl}</span></div>`; }).join('') + `</div>` : `<span class="italic text-[10px] text-slate-400">Không có cấu hình chi tiết</span>`;
            return `<tr class="border-b border-slate-50"><td class="p-3"><div class="font-bold text-slate-700 text-[11px] uppercase">${i.khoa}</div>${i.ghiChu ? `<div class="text-[10px] text-rose-600 font-medium italic mt-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${i.ghiChu}</div>` : ''}</td><td class="p-3"><div class="font-bold text-sky-700 text-[12px] uppercase">${tenBo}</div><div class="text-[10px] font-mono text-slate-400 mb-2">Mã ID: ${i.maMacDinh}</div><div class="bg-slate-50 p-2 rounded border border-slate-100">${checklistHtml}</div></td><td class="p-3 text-center text-[10px] text-slate-500 font-bold">${i.time}</td><td class="p-3 text-center action-col"><button onclick="moPopupKiemDem('${i.firestoreId}')" class="bg-sky-600 text-white hover:bg-sky-700 px-3 py-1.5 rounded shadow font-black text-[11px]">KIỂM ĐẾM</button></td></tr>`;
        }).join('');
    }
    else if(activeTab === 'donggoi') {
        let lsDG = listGiaoDich.filter(x => x.status === "DANG_RUA"); document.getElementById("badgeDongGoi").innerText = lsDG.length;
        document.getElementById("gridDongGoi").innerHTML = lsDG.map(i => `<div class="bg-white p-3 rounded border border-slate-200 mb-2 flex justify-between items-center"><div class="flex-1"><div class="font-bold text-sky-700 text-[13px]">${i.bo}</div><div class="text-[10px] text-slate-500">Từ khoa: ${i.khoa}</div></div><button onclick="moPopupDongGoi('${i.firestoreId}')" class="bg-sky-50 text-sky-700 border border-sky-300 px-3 py-1.5 rounded text-[11px] font-black">ĐÓNG GÓI</button></div>`).join('');
    }
    else if(activeTab === 'mayhap') {
        let lsCH = listGiaoDich.filter(x => x.status === "CHO_HAP"); document.getElementById("bangChoHap").innerHTML = lsCH.map(i => `<tr class="border-b"><td class="p-3 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="hap-checkbox"></td><td class="p-3 font-bold">${i.bo}</td><td class="p-3 text-right font-mono">${i.maMacDinh}</td></tr>`).join('');
        let lsNT = listGiaoDich.filter(x => x.status === "DANG_HAP"); document.getElementById("bangChoNghiệmThu").innerHTML = lsNT.map(i => `<tr class="border-b"><td class="p-2 text-center action-col"><input type="checkbox" value="${i.firestoreId}" class="nghiemthu-checkbox"></td><td class="p-2 font-bold text-xs">${i.bo} <span class="text-slate-400 font-normal">(${i.batchCode || 'Chưa có lô'})</span></td></tr>`).join('');
    }
    else if(activeTab === 'khovokhuan') {
        let fK = document.getElementById("xuat_selKhoa").value; let kList = [...new Set(listGiaoDich.map(x=>x.khoa))].filter(Boolean);
        if(document.getElementById("xuat_selKhoa").options.length <= 1) { document.getElementById("xuat_selKhoa").innerHTML = '<option value="">-- Chọn Khoa --</option>' + kList.map(k=>`<option value="${k}">${k}</option>`).join(''); }
        let lsXK = listGiaoDich.filter(x => x.status === "CHO_XUAT");
        document.getElementById("bangKhoVoKhuan").innerHTML = lsXK.map(i => `<tr class="border-b"><td class="p-3 font-bold text-slate-800 text-[11px]">${i.bo.split(" [ID:")[0]}</td><td class="p-3 font-mono text-sky-700 font-bold">${i.maMacDinh}</td><td class="p-3 text-center font-bold text-slate-500 text-[11px]">Kệ 01</td><td class="p-3 text-center text-[10px] text-emerald-700 font-bold">${i.hsd ? new Date(i.hsd).toLocaleDateString('vi-VN') : 'An toàn'}</td></tr>`).join('') || `<tr><td colspan="4" class="p-8 text-center text-slate-400 italic">Kho Vô Khuẩn trống.</td></tr>`;
    }
    else if(activeTab === 'quanlykho') {
        let fK = document.getElementById("inv_filterKhoa").value; let uniqueKhoa = [...new Set(listGiaoDich.map(x=>x.khoa))].filter(Boolean);
        document.getElementById("inv_filterKhoa").innerHTML = '<option value="">-- Tất cả Khoa --</option>' + uniqueKhoa.map(k=>`<option value="${k}" ${k===fK?'selected':''}>${k}</option>`).join('');
        let uniqueIDs = [...new Set(listGiaoDich.map(x=>x.maMacDinh))]; let arrHtml = [];
        uniqueIDs.forEach(ma => {
            let allTrans = listGiaoDich.filter(x => x.maMacDinh === ma); let currentTrans = allTrans.sort((a,b) => b.id - a.id)[0];
            if(!currentTrans || !ma) return;
            let viTriCode = currentTrans.status; let khoaGiữ = currentTrans.khoa; if (fK && khoaGiữ !== fK) return;
            let viTriText = "Kho vô khuẩn"; let viTriColor = "bg-teal-100 text-teal-800";
            if(viTriCode === "HOAN_TAT") { viTriText = `Sẵn sàng tại Khoa`; viTriColor = "bg-emerald-100 text-emerald-800"; }
            else if(viTriCode !== "CHO_XUAT") { viTriText = "Đang xử lý tại CSSD"; viTriColor = "bg-amber-100 text-amber-800"; }
            let tenLoai = currentTrans.bo.split(" [ID:")[0] || currentTrans.bo;
            arrHtml.push(`<tr class="border-b border-slate-100 hover:bg-slate-50 font-medium"><td class="p-3 font-mono text-sky-700 font-bold">${ma}</td><td class="p-3 font-bold text-slate-800">${tenLoai}</td><td class="p-3 text-slate-500 font-semibold text-[11px]">${khoaGiữ}</td><td class="p-3 text-center"><span class="px-2.5 py-1 rounded text-[10px] font-bold ${viTriColor}">${viTriText}</span></td><td class="p-3 text-center font-mono font-bold text-slate-400 text-[10px]">${currentTrans.batchCode || 'N/A'}</td></tr>`);
        });
        document.getElementById("bangTonKhoThucTe").innerHTML = arrHtml.length ? arrHtml.join('') : `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">Chưa có giao dịch nào được lưu.</td></tr>`;
    }
    else if(activeTab === 'danhmuc') {
        const tbody = document.getElementById("bangDanhMucTong"); const badge = document.getElementById("badgeTuoiThoKhay");
        if (tbody) {
            let uniqueIDs = [...new Set(listGiaoDich.map(x => x.maMacDinh))].filter(Boolean);
            if (badge) badge.innerText = `${uniqueIDs.length} Khay`;
            let arrHtml = [];
            uniqueIDs.forEach(ma => {
                let allTrans = listGiaoDich.filter(x => x.maMacDinh === ma); let currentTrans = allTrans.sort((a, b) => b.id - a.id)[0];
                if (!currentTrans) return;
                let viTriCode = currentTrans.status; let viTriText = "Kho vô khuẩn"; let viTriColor = "bg-teal-100 text-teal-800";
                if (viTriCode === "HOAN_TAT") { viTriText = `Tại Khoa`; viTriColor = "bg-emerald-100 text-emerald-800"; }
                else if (viTriCode !== "CHO_XUAT") { viTriText = "Xử lý tại CSSD"; viTriColor = "bg-amber-100 text-amber-800"; }
                let chuKyLo = listGiaoDich.filter(x => x.maMacDinh === ma && (x.status === "CHO_XUAT" || x.status === "HOAN_TAT")).length;
                let tenLoai = currentTrans.bo.split(" [ID:")[0];
                arrHtml.push(`<tr class="border-b border-slate-100 hover:bg-slate-50 font-medium"><td class="p-3 font-mono text-sky-700 font-bold">${ma}</td><td class="p-3 font-bold text-slate-800">${tenLoai}</td><td class="p-3 text-center"><span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${viTriColor}">${viTriText}</span></td><td class="p-3 text-center font-black text-amber-700 bg-amber-50/50">${chuKyLo} lần</td></tr>`);
            });
            tbody.innerHTML = arrHtml.length ? arrHtml.join('') : `<tr><td colspan="4" class="p-8 text-center text-slate-400 italic">Chưa có dữ liệu khay vận hành.</td></tr>`;
        }
    }
    else if(activeTab === 'tracuu') {
        const tbody = document.getElementById("bangLichSuTruyXuat");
        const searchInp = document.getElementById("inp_searchBatch")?.value.trim();
        const badge = document.getElementById("badgeLichSu");
        
        if(tbody) {
            let dataFiltered = listGiaoDich;
            if (searchInp) {
                // Nếu điền mã lô, thực hiện bộ lọc tìm kiếm khẩn cấp để truy vết
                dataFiltered = listGiaoDich.filter(x => x.batchCode && x.batchCode.toUpperCase() === searchInp.toUpperCase());
                if(badge) badge.innerHTML = `<span class="text-rose-600">Tìm thấy ${dataFiltered.length} mâm đi chung lô lỗi</span>`;
            } else {
                if(badge) badge.innerText = `Tổng số: ${listGiaoDich.length} bản ghi`;
            }

            tbody.innerHTML = dataFiltered.map(x => `
                <tr class="border-b text-xs hover:bg-slate-50">
                    <td class="p-2.5 font-mono font-bold text-sky-700">${x.maMacDinh || 'N/A'}</td>
                    <td class="p-2.5 font-bold text-slate-800">${x.bo}</td>
                    <td class="p-2.5 font-semibold text-slate-500">${x.khoa}</td>
                    <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">${x.status}</span></td>
                    <td class="p-2.5 text-center font-mono font-black text-rose-700 bg-rose-50/40">${x.batchCode || 'N/A'}</td>
                    <td class="p-2.5 text-center text-slate-400 font-medium">${x.ngayTao || ''} - ${x.time || ''}</td>
                </tr>
            `).join('') || `<tr><td colspan="6" class="p-8 text-center italic text-slate-400">Không tìm thấy dữ liệu luân chuyển nào khớp với mã lô này.</td></tr>`;
        }
    }
}

function resetDuLieuKet() {
    if(confirm("CẢNH BÁO: Thao tác này sẽ đánh dấu HOÀN TẤT cho tất cả mâm đang bị kẹt trong Trạm Rửa, Gói, Hấp. Bạn có chắc chắn?")) {
        let p = []; listGiaoDich.forEach(doc => { if(doc.status !== "HOAN_TAT") { p.push(db.collection("phieuGiaoNhan").doc(doc.firestoreId).update({ status: "HOAN_TAT", ghiChu: "Admin dọn kẹt" })); } });
        Promise.all(p).then(() => { showToast("Đã dọn dẹp thành công!", "success"); callRender(); });
    }
}

function moCamera(inputId) { targetInputIdForScan = inputId; document.getElementById("popupScanner").classList.remove("hidden"); let camStatus = document.getElementById("camStatus"); camStatus.innerText = "Đang xin quyền Camera..."; html5QrCode = new Html5Qrcode("reader"); Html5Qrcode.getCameras().then(devices => { if (devices && devices.length) { let cameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id; camStatus.innerText = "Đã bật Camera sau. Hãy quét mã!"; html5QrCode.start(cameraId, { fps: 10, qrbox: { width: 250, height: 250 } }, (decodedText) => { document.getElementById(targetInputIdForScan).value = decodedText.trim(); dongCamera(); if(targetInputIdForScan === 'khoa_inpMaBo') themVaoGio(); }).catch(err => camStatus.innerText = "Lỗi khởi động: " + err); } else { camStatus.innerText = "Không tìm thấy ống kính Camera!"; } }).catch(err => camStatus.innerText = "Cần cấp quyền Camera trong trình duyệt!"); }
function dongCamera() { if(html5QrCode) { html5QrCode.stop().then(() => html5QrCode.clear()).catch(err => {}); } document.getElementById("popupScanner").classList.add("hidden"); }

function switchAdminSubtab(sub) { 
    document.getElementById('subtab-database').classList.add('hidden'); document.getElementById('subtab-security').classList.add('hidden');
    document.getElementById('subbtn-database').classList.replace('admin-subtab-active', 'text-slate-600'); document.getElementById('subbtn-security').classList.replace('admin-subtab-active', 'text-slate-600');
    document.getElementById('subtab-' + sub).classList.remove('hidden'); document.getElementById('subbtn-' + sub).classList.add('admin-subtab-active');
}

function renderAdminInterface() {
    document.getElementById("cfg_pinAdmin").value = thongTinMatKhauAdmin.adminPIN || "";
    document.getElementById("cfg_pinCSSD").value = thongTinMatKhauAdmin.cssdPIN || "";
    document.getElementById("cfg_pinGuest").value = thongTinMatKhauAdmin.guestPIN || "";
    const tbKhoa = document.getElementById("bangPhanQuyenKhoa");
    if(tbKhoa) {
        if(danhSachKhoa.length === 0) { tbKhoa.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-rose-500 font-bold italic">Danh sách Khoa đang trống. Vui lòng nạp Excel.</td></tr>`; } 
        else { tbKhoa.innerHTML = danhSachKhoa.map((k, index) => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-black text-slate-700 text-[11px]">${k.ten}</td><td class="p-3 text-center border-x border-slate-200 font-mono font-black text-rose-600 text-sm bg-rose-50/50">${k.pin || '123'}</td><td class="p-3 text-center"><div class="flex items-center justify-center gap-2"><input type="text" id="pin-khoa-${index}" placeholder="Nhập PIN mới" class="w-24 p-1.5 text-center border border-slate-300 rounded font-mono font-bold text-sky-700 text-xs"><button onclick="updatePINTrựcTiep(${index}, '${k.ten}')" class="bg-sky-600 text-white font-bold py-1.5 px-3 rounded shadow hover:bg-sky-700 text-[10px]">ĐỔI PIN</button></div></td></tr>`).join(''); }
    }
    const tbKtv = document.getElementById("bangNhanVienCssd");
    if(tbKtv) {
        if(danhSachKtvCssd.length === 0) { tbKtv.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Chưa có Nhân viên nào. Bấm nút Thêm để tạo mới.</td></tr>`; }
        else { tbKtv.innerHTML = danhSachKtvCssd.map((nv, index) => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-black text-sky-700 text-xs">${nv.code}</td><td class="p-3 font-bold text-slate-700 text-[11px]">${nv.ten}</td><td class="p-3 text-center border-x border-slate-200 font-mono font-black text-sky-600 text-sm bg-sky-50/50">${nv.pin}</td><td class="p-3 text-center"><button onclick="xoaKtvCssd('${nv.code}')" class="text-rose-600 hover:text-rose-800 font-bold text-[10px]"><i class="fa-solid fa-trash-can mr-1"></i>XÓA NV</button></td></tr>`).join(''); }
    }
}

function saveAdminPIN(type) {
    let newVal = document.getElementById(`cfg_pin${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}`).value.trim();
    if(!newVal) return showToast("Mã PIN không được để trống!", "error");
    if(type === 'ADMIN') thongTinMatKhauAdmin.adminPIN = newVal;
    if(type === 'CSSD') thongTinMatKhauAdmin.cssdPIN = newVal;
    if(type === 'GUEST') thongTinMatKhauAdmin.guestPIN = newVal;
    db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ thongTinMatKhauAdmin: thongTinMatKhauAdmin }).then(() => { showToast(`Đã cập nhật PIN cho ${type} thành công!`, "success"); });
}

function themKtvCssd() {
    let code = prompt("Nhập Mã Nhân Viên (Ví dụ: NV01):"); if(!code) return;
    let ten = prompt("Nhập Họ & Tên Nhân Viên:"); if(!ten) return;
    let pin = prompt("Nhập mã PIN đăng nhập (Ví dụ: 1234):"); if(!pin) return;
    code = code.trim().toUpperCase();
    if(danhSachKtvCssd.find(x => x.code === code)) return showToast("Mã nhân viên này đã tồn tại!", "error");
    danhSachKtvCssd.push({ code: code, ten: ten.trim(), pin: pin.trim() });
    db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKtvCssd: danhSachKtvCssd }).then(() => { showToast("Đã thêm KTV thành công!", "success"); });
}

function xoaKtvCssd(code) {
    if(confirm(`Bạn có chắc chắn muốn xóa nhân viên ${code} không?`)) {
        danhSachKtvCssd = danhSachKtvCssd.filter(x => x.code !== code);
        db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKtvCssd: danhSachKtvCssd }).then(() => { showToast("Đã xóa nhân viên!", "success"); });
    }
}

function themKhoaThuCong() {
    let tenKhoaMoi = prompt("Nhập Tên Khoa/Phòng mới:");
    if(tenKhoaMoi && tenKhoaMoi.trim() !== "") {
        tenKhoaMoi = tenKhoaMoi.trim().toUpperCase();
        let checkExists = danhSachKhoa.find(x => x.ten === tenKhoaMoi);
        if(checkExists) return showToast("Khoa này đã có trong danh sách!", "error");
        danhSachKhoa.push({ ten: tenKhoaMoi, pin: "123", danhSachBo: [] });
        db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa }).then(() => showToast(`Đã thêm Khoa ${tenKhoaMoi}!`, "success"));
    }
}

function updatePINTrựcTiep(idx, tenKhoa) {
    let userInp = document.getElementById(`pin-khoa-${idx}`).value.trim();
    if(userInp === "") return showToast("Vui lòng nhập mã PIN mới vào ô trống!", "error");
    let found = danhSachKhoa.find(x => x.ten === tenKhoa);
    if(found) {
        found.pin = userInp;
        db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: danhSachKhoa }).then(() => { document.getElementById(`pin-khoa-${idx}`).value = ""; showToast(`Đã đổi PIN cho Khoa ${tenKhoa}!`, "success"); });
    }
}

function processExcelUpload() {
    let fileInput = document.getElementById('excelFileInput'); let file = fileInput.files[0];
    if (!file) return showToast("Vui lòng chọn file Excel!", "error");
    let reader = new FileReader();
    reader.onload = function(e) {
        let data = e.target.result; let workbook = XLSX.read(data, {type: 'binary'});
        let excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        let khoaMap = {};
        excelData.forEach(row => {
            let keys = Object.keys(row);
            let kKey = keys.find(k => k.toLowerCase().includes('khoa') || k.toLowerCase().includes('phòng'));
            let boKey = keys.find(k => k.toLowerCase().includes('bộ') || k.toLowerCase().includes('mâm') || k.toLowerCase().includes('dụng'));
            let k = kKey ? row[kKey] : null; let bo = boKey ? row[boKey] : null;
            if(k && bo) { k = String(k).trim().toUpperCase(); bo = String(bo).trim(); if(!khoaMap[k]) khoaMap[k] = []; if(!khoaMap[k].includes(bo)) khoaMap[k].push(bo); }
        });
        let newDanhSachKhoa = Object.keys(khoaMap).map(k => ({ ten: k, pin: danhSachKhoa.find(old => old.ten === k)?.pin || "123", danhSachBo: khoaMap[k] }));
        if(newDanhSachKhoa.length === 0) return showToast("Lỗi định dạng. Cần cột KHOA và BỘ DỤNG CỤ!", "error");
        db.collection("heThongDanhMuc").doc("danhMucTongPhuongNam").update({ danhSachKhoa: newDanhSachKhoa, databaseExcel: excelData }).then(() => { showToast("Đã nạp thành công Database!", "success"); fileInput.value = ""; });
    };
    reader.readAsBinaryString(file);
}

function initSelects() { 
    let opts = '<option value="">-- Chọn Khoa --</option>' + danhSachKhoa.map(k=>`<option value="${k.ten}">${k.ten}</option>`).join(''); 
    document.getElementById("login_khoa").innerHTML = opts; document.getElementById("khoa_selKhoa").innerHTML = opts; 
    let optsKtv = '<option value="">-- Chọn KTV CSSD --</option>' + danhSachKtvCssd.map(k=>`<option value="${k.code}">${k.code} - ${k.ten}</option>`).join(''); 
    if(document.getElementById("login_nv_cssd")) document.getElementById("login_nv_cssd").innerHTML = optsKtv;
}
function showToast(msg, type="error") { const t = document.createElement('div'); t.className = `fixed top-6 right-6 ${type==="error"?"bg-rose-600":"bg-emerald-600"} text-white px-5 py-3.5 rounded-lg shadow-2xl z-[100] font-bold text-sm`; t.innerHTML = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }
function toggleMobileMenu() { const sb = document.getElementById("sidebar_menu"), ov = document.getElementById("mobile-overlay"); sb.classList.toggle("-translate-x-full"); ov.classList.toggle("hidden"); }
function toggleLoginFields() { const r = document.getElementById("login_role").value; document.getElementById("field_khoa").style.display = (r === "KHOA") ? "block" : "none"; document.getElementById("field_nhanvien_cssd").style.display = (r === "CSSD") ? "block" : "none"; }

taiDanhMucLinhKienChuand();
function truyVetTheoMaBatch() { callRender(); }
function clearTruyVetBatch() { 
    const inp = document.getElementById("inp_searchBatch"); 
    if(inp) inp.value = ""; 
    callRender(); 
}
