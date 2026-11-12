"use strict";

/**
 * MILESTONESTUDIO - Minimalist Application Logic
 * 심플 & 미니멀 LIFE OPERATING SYSTEM
 */

document.addEventListener("DOMContentLoaded", () => {

    /* ========================================================
       0. 로컬 스토리지 키 및 상태 관리
    ======================================================== */
    // 개인(프라이빗) 모드: 켜면 MILESTONES/FOOTSTEPS/INFOMAPS/BOOKMARKS/CLIPS가 별도의 개인 데이터 저장소로 바뀐다.
    // (PIN · 도시 · 테마 · 자동 내보내기 같은 설정은 두 모드가 공유) / 기본값: 꺼짐, 새로고침하면 다시 꺼진다.
    let isPrivateMode = false;
    const dataKey = (name) => (isPrivateMode ? "milestonestudio_private_" : "milestonestudio_") + name;

    const STORAGE_KEYS = {
        get MILESTONES() { return dataKey("milestones"); },
        get FOOTSTEPS() { return dataKey("footsteps"); },
        get BOOKMARKS() { return dataKey("bookmarks"); },
        get CLIPS() { return dataKey("clips"); },
        get CONTACTS() { return dataKey("contacts"); },
        get WALLETS() { return dataKey("wallets"); },
        get INFOMAPS() { return dataKey("infomaps"); },
        PIN: "milestonestudio_pin",
        CITY: "milestonestudio_selected_city",
        AUTO_BACKUP_ENABLED: "milestonestudio_autobackup_enabled",
        AUTO_BACKUP_DIRNAME: "milestonestudio_autobackup_dirname",
        THEME: "milestonestudio_theme",
        HELP_VISIBLE: "milestonestudio_help_visible"
    };

    // 이전 이름(LifeOperatingSystem)에서 쓰던 저장소 키를 새 키로 1회 이전 (기존 데이터 유지용 · 이전 후 옛 키 삭제)
    // 이전할 데이터가 필요 없다면 이 블록은 통째로 삭제해도 됩니다.
    (function migrateLegacyStorageKeys() {
        const legacyKeyMap = {
            lifeos_projects: STORAGE_KEYS.MILESTONES,
            lifeos_tasks: STORAGE_KEYS.FOOTSTEPS,
            lifeos_memos: STORAGE_KEYS.INFOMAPS,
            lifeos_bookmarks: STORAGE_KEYS.BOOKMARKS,
            lifeos_clips: STORAGE_KEYS.CLIPS,
            lifeos_pin: STORAGE_KEYS.PIN,
            lifeos_selected_city: STORAGE_KEYS.CITY,
            lifeos_autobackup_enabled: STORAGE_KEYS.AUTO_BACKUP_ENABLED,
            lifeos_autobackup_dirname: STORAGE_KEYS.AUTO_BACKUP_DIRNAME
        };
        Object.entries(legacyKeyMap).forEach(([oldKey, newKey]) => {
            try {
                const oldValue = localStorage.getItem(oldKey);
                if (oldValue === null) return;
                if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, oldValue);
                localStorage.removeItem(oldKey);
            } catch (e) { }
        });
    })();

    let userPin = localStorage.getItem(STORAGE_KEYS.PIN) || "0000";
    // 숨김 항목 표시 상태 (헤더 자물쇠 하나로 모든 영역을 함께 제어)
    let showMilestoneSecrets = false; // MILESTONES 숨김 항목 표시 여부
    let showInfomapSecrets = false;    // INFOMAPS 숨김 항목 표시 여부
    let showFootstepSecrets = false;    // FOOTSTEPS 숨김 항목 표시 여부
    let showBookmarkSecrets = false; // BOOKMARKS 숨김 항목 표시 여부
    let showClipSecrets = false;     // CLIPS 숨김 항목 표시 여부
    let showContactSecrets = false;  // CONTACTS 숨김 항목 표시 여부
    let showWalletSecrets = false;   // WALLETS 숨김 항목 표시 여부

    // 자동 내보내기 상태 (폴더 핸들은 IndexedDB에 보관, 켜짐 여부/폴더 이름은 localStorage에 보관)
    let autoBackupEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_BACKUP_ENABLED) === "1";
    let autoBackupDirHandle = null;     // 사용자가 선택한 폴더(FileSystemDirectoryHandle)
    let autoBackupDirName = localStorage.getItem(STORAGE_KEYS.AUTO_BACKUP_DIRNAME) || "";
    let autoBackupNeedsPermission = false; // 폴더 접근 권한 재승인 필요 여부
    let autoBackupLastTime = null;      // 마지막 자동 내보내기 성공 시각
    let autoBackupError = "";           // 마지막 오류 메시지
    let autoBackupTimer = null;
    let autoBackupWriting = false;
    let autoBackupPending = false;

    // FOOTSTEP 데이터 구조 정규화
    // { id, title, completed, isRoutine, isSecret, dueDate("YYYY-MM-DD" | null) }
    // (이전 일자별 구조의 date / lastDoneDate 값은 사용하지 않고 버린다)
    function normalizeFootstep(t) {
        const isRoutine = !!t.isRoutine;
        return {
            id: t.id,
            title: t.title,
            completed: !!t.completed,
            isRoutine: isRoutine,
            isSecret: !!t.isSecret,
            dueDate: (!isRoutine && typeof t.dueDate === "string" && t.dueDate) ? t.dueDate : null
        };
    }

    // 초기 샘플 데이터셋
    function initDefaultData() {
        const todayStr = formatDateKey(new Date());

        if (!localStorage.getItem(STORAGE_KEYS.MILESTONES)) {
            const defaultMilestones = [
                {
                    id: "pj_1",
                    title: "MILESTONESTUDIO 구축",
                    desc: "단순함과 지속성에 집중한 나만의 LIFE OPERATING SYSTEM 완성하기",
                    completed: true,
                    isSecret: false,
                    date: "2026-11-07 09:00"
                },
                {
                    id: "pj_2",
                    title: "새로운 서비스 기획 및 런칭",
                    desc: "핵심 기능 정의 및 MVP 프로토타입 배포",
                    completed: false,
                    isSecret: false,
                    date: "2026-11-07 09:30"
                },
                {
                    id: "pj_3",
                    title: "비공개 핵심 투자 포트폴리오",
                    desc: "중장기 자산 배분 및 포트폴리오 다각화 전략",
                    completed: false,
                    isSecret: true,
                    date: "2026-11-07 10:00"
                }
            ];
            localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(defaultMilestones));
        }

        if (!localStorage.getItem(STORAGE_KEYS.FOOTSTEPS)) {
            const defaultFootsteps = [
                {
                    id: "tk_1",
                    title: "주간 목표 및 우선순위 점검",
                    completed: true,
                    isRoutine: false,
                    isSecret: false,
                    dueDate: null
                },
                {
                    id: "tk_2",
                    title: "핵심 작업 2시간 몰입 진행",
                    completed: false,
                    isRoutine: false,
                    isSecret: false,
                    dueDate: todayStr
                },
                {
                    id: "rt_1",
                    title: "기상 후 물 500ml 마시기",
                    completed: true,
                    isRoutine: true,
                    isSecret: false,
                    dueDate: null
                },
                {
                    id: "rt_2",
                    title: "매일 독서 20분 실천",
                    completed: false,
                    isRoutine: true,
                    isSecret: false,
                    dueDate: null
                }
            ];
            localStorage.setItem(STORAGE_KEYS.FOOTSTEPS, JSON.stringify(defaultFootsteps));
        }

        if (!localStorage.getItem(STORAGE_KEYS.INFOMAPS)) {
            const defaultInfomaps = [
                {
                    id: "mm_1",
                    title: "💡 시스템 원칙",
                    content: "단순함이 궁극의 정교함이다. 매일 본질에 집중하기.",
                    completed: false,
                    isSecret: false,
                    date: "2026-11-07 10:00"
                },
                {
                    id: "mm_2",
                    title: "🛒 장보기",
                    content: "사과, 아몬드, 그릭 요거트, 비타민",
                    completed: true,
                    isSecret: false,
                    date: "2026-11-07 11:20"
                },
                {
                    id: "mm_3",
                    title: "비공개 개인 목표",
                    content: "올해 순자산 목표 달성 및 지속 가능한 성장 계획.",
                    completed: false,
                    isSecret: true,
                    date: "2026-11-07 11:30"
                }
            ];
            localStorage.setItem(STORAGE_KEYS.INFOMAPS, JSON.stringify(defaultInfomaps));
        }
    }
    initDefaultData();


    /* ========================================================
       1. 0과 1이 흐르는 매트릭스 디지털 레인 배경
    ======================================================== */
    const canvas = document.getElementById("matrixCanvas");
    const ctx = canvas.getContext("2d");

    let width, height, columns;
    const fontSize = 16;
    let drops = [];

    function initCanvas() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        columns = Math.floor(width / fontSize);

        const currentDropsLength = drops.length;
        for (let i = currentDropsLength; i < columns; i++) {
            drops[i] = 1;
        }
    }

    function isLightTheme() {
        return document.documentElement.getAttribute("data-theme") === "light";
    }

    function drawMatrix() {
        const light = isLightTheme();
        // 잔상 지우기 색 = 페이지 배경색 / 숫자 색 = 테마별 그린
        ctx.fillStyle = light ? "rgba(238, 242, 246, 0.12)" : "rgba(0, 0, 0, 0.1)";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = light ? "rgba(0, 143, 58, 0.30)" : "rgba(0, 255, 0, 0.35)";
        ctx.font = fontSize + "px monospace";

        for (let i = 0; i < columns; i++) {
            const text = Math.random() > 0.5 ? "1" : "0";
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    window.addEventListener("resize", initCanvas);
    initCanvas();
    setInterval(drawMatrix, 60);


    /* ========================================================
       1.5. 라이트 모드 토글 (해 아이콘 꺼짐 = 다크 모드(기본) / 켜짐 = 라이트 모드, 선택은 localStorage에 저장)
    ======================================================== */
    const btnToggleTheme = document.getElementById("btnToggleTheme");

    function applyTheme(theme, persist) {
        const light = theme === "light";
        document.documentElement.setAttribute("data-theme", light ? "light" : "dark");

        if (persist) {
            try { localStorage.setItem(STORAGE_KEYS.THEME, light ? "light" : "dark"); } catch (e) { }
        }

        // 해(라이트 모드) 아이콘: 켜짐 = 라이트 모드 / 꺼짐 = 다크 모드
        if (btnToggleTheme) {
            btnToggleTheme.classList.toggle("active", light);
            btnToggleTheme.setAttribute("aria-pressed", light ? "true" : "false");
            btnToggleTheme.title = light
                ? "라이트 모드 켜짐 (클릭하여 끄기)"
                : "라이트 모드 꺼짐 (클릭하여 켜기)";
        }

        // 매트릭스 배경: 이전 테마의 잔상을 지우고 새 배경색으로 다시 시작
        ctx.clearRect(0, 0, width, height);
    }

    // 초기 상태 반영 (head의 초기 스크립트가 이미 적용한 값을 기준으로 아이콘/툴팁만 동기화)
    applyTheme(isLightTheme() ? "light" : "dark", false);

    if (btnToggleTheme) {
        btnToggleTheme.addEventListener("click", () => {
            applyTheme(isLightTheme() ? "dark" : "light", true);
        });
    }


    /* ========================================================
       1.6. 도움말(물음표) 표시 토글 (헤더 자물쇠 왼쪽 물음표 아이콘)
       - 꺼짐(기본) = 로고 · MILESTONES … WALLETS 제목 옆 물음표 숨김 / 켜짐 = 모두 표시 (마우스를 올리면 설명 툴팁)
       - 선택은 localStorage에 저장되고, head의 초기 스크립트가 렌더링 전에 html[data-help]로 먼저 적용한다
    ======================================================== */
    const btnToggleHelp = document.getElementById("btnToggleHelp");

    function isHelpVisible() {
        return document.documentElement.getAttribute("data-help") === "on";
    }

    function applyHelpVisibility(visible, persist) {
        if (visible) {
            document.documentElement.setAttribute("data-help", "on");
        } else {
            document.documentElement.removeAttribute("data-help");
        }

        if (persist) {
            try {
                if (visible) localStorage.setItem(STORAGE_KEYS.HELP_VISIBLE, "on");
                else localStorage.removeItem(STORAGE_KEYS.HELP_VISIBLE);
            } catch (e) { }
        }

        if (btnToggleHelp) {
            btnToggleHelp.classList.toggle("active", visible);
            btnToggleHelp.setAttribute("aria-pressed", visible ? "true" : "false");
            btnToggleHelp.title = visible
                ? "도움말 아이콘 켜짐 (클릭하여 끄기)"
                : "도움말 아이콘 꺼짐 (클릭하여 켜기)";
        }
    }

    // 초기 상태 반영 (head의 초기 스크립트가 이미 적용한 값을 기준으로 버튼 상태만 동기화)
    applyHelpVisibility(isHelpVisible(), false);

    if (btnToggleHelp) {
        btnToggleHelp.addEventListener("click", () => {
            applyHelpVisibility(!isHelpVisible(), true);
        });
    }


    /* ========================================================
       2. 상단 헤더 정보 (실시간 시계, 날짜, 날씨)
    ======================================================== */
    const liveClock = document.getElementById("liveClock");
    const liveDate = document.getElementById("liveDate");
    const weatherInfo = document.getElementById("weatherInfo");
    const weatherIcon = document.getElementById("weatherIcon");

    const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    let lastTrackedDateKey = formatDateKey(new Date());

    function updateTime() {
        const now = new Date();
        const currentDateKey = formatDateKey(now);
        // 자정이 지나 날짜가 변경되면 FOOTSTEP 기한 경고(노랑/빨강) 상태를 다시 계산
        if (currentDateKey !== lastTrackedDateKey) {
            lastTrackedDateKey = currentDateKey;
            renderFootsteps();
        }

        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        if (liveClock) liveClock.textContent = `${hh}:${mm}:${ss}`;

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const date = String(now.getDate()).padStart(2, "0");
        const dayName = DAY_NAMES[now.getDay()];

        if (liveDate) liveDate.textContent = `${year}. ${month}. ${date} (${dayName.slice(0, 1)})`;
    }
    updateTime();
    setInterval(updateTime, 1000);

    // 날씨 정보 (오픈 API 연동 & 도시 선택 연동)
    const CITY_DATA = {
        // 특별시·광역시
        seoul: { name: "서울", lat: 37.5665, lon: 126.9780, group: "특별시·광역시" },
        busan: { name: "부산", lat: 35.1796, lon: 129.0756, group: "특별시·광역시" },
        daegu: { name: "대구", lat: 35.8714, lon: 128.6014, group: "특별시·광역시" },
        incheon: { name: "인천", lat: 37.4563, lon: 126.7052, group: "특별시·광역시" },
        gwangju: { name: "광주", lat: 35.1595, lon: 126.8526, group: "특별시·광역시" },
        daejeon: { name: "대전", lat: 36.3504, lon: 127.3845, group: "특별시·광역시" },
        ulsan: { name: "울산", lat: 35.5384, lon: 129.3114, group: "특별시·광역시" },
        sejong: { name: "세종", lat: 36.4800, lon: 127.2890, group: "특별시·광역시" },
        // 경기
        suwon: { name: "수원", lat: 37.2636, lon: 127.0286, group: "경기" },
        seongnam: { name: "성남", lat: 37.4200, lon: 127.1265, group: "경기" },
        goyang: { name: "고양", lat: 37.6584, lon: 126.8320, group: "경기" },
        yongin: { name: "용인", lat: 37.2411, lon: 127.1776, group: "경기" },
        bucheon: { name: "부천", lat: 37.5034, lon: 126.7660, group: "경기" },
        ansan: { name: "안산", lat: 37.3219, lon: 126.8309, group: "경기" },
        anyang: { name: "안양", lat: 37.3943, lon: 126.9568, group: "경기" },
        namyangju: { name: "남양주", lat: 37.6360, lon: 127.2165, group: "경기" },
        hwaseong: { name: "화성", lat: 37.1995, lon: 126.8312, group: "경기" },
        pyeongtaek: { name: "평택", lat: 36.9921, lon: 127.1129, group: "경기" },
        uijeongbu: { name: "의정부", lat: 37.7381, lon: 127.0337, group: "경기" },
        siheung: { name: "시흥", lat: 37.3800, lon: 126.8029, group: "경기" },
        paju: { name: "파주", lat: 37.7600, lon: 126.7800, group: "경기" },
        gimpo: { name: "김포", lat: 37.6152, lon: 126.7156, group: "경기" },
        gwangmyeong: { name: "광명", lat: 37.4786, lon: 126.8644, group: "경기" },
        hanam: { name: "하남", lat: 37.5393, lon: 127.2148, group: "경기" },
        // 강원
        chuncheon: { name: "춘천", lat: 37.8813, lon: 127.7298, group: "강원" },
        wonju: { name: "원주", lat: 37.3422, lon: 127.9202, group: "강원" },
        gangneung: { name: "강릉", lat: 37.7519, lon: 128.8761, group: "강원" },
        sokcho: { name: "속초", lat: 38.2070, lon: 128.5918, group: "강원" },
        // 충청
        cheongju: { name: "청주", lat: 36.6424, lon: 127.4890, group: "충청" },
        cheonan: { name: "천안", lat: 36.8151, lon: 127.1139, group: "충청" },
        asan: { name: "아산", lat: 36.7898, lon: 127.0018, group: "충청" },
        chungju: { name: "충주", lat: 36.9910, lon: 127.9259, group: "충청" },
        seosan: { name: "서산", lat: 36.7848, lon: 126.4503, group: "충청" },
        // 전라
        jeonju: { name: "전주", lat: 35.8242, lon: 127.1480, group: "전라" },
        iksan: { name: "익산", lat: 35.9483, lon: 126.9577, group: "전라" },
        gunsan: { name: "군산", lat: 35.9676, lon: 126.7369, group: "전라" },
        mokpo: { name: "목포", lat: 34.8118, lon: 126.3922, group: "전라" },
        yeosu: { name: "여수", lat: 34.7604, lon: 127.6622, group: "전라" },
        suncheon: { name: "순천", lat: 34.9506, lon: 127.4872, group: "전라" },
        // 경상
        changwon: { name: "창원", lat: 35.2280, lon: 128.6811, group: "경상" },
        pohang: { name: "포항", lat: 36.0190, lon: 129.3435, group: "경상" },
        gimhae: { name: "김해", lat: 35.2285, lon: 128.8894, group: "경상" },
        gumi: { name: "구미", lat: 36.1195, lon: 128.3446, group: "경상" },
        gyeongsan: { name: "경산", lat: 35.8251, lon: 128.7414, group: "경상" },
        yangsan: { name: "양산", lat: 35.3350, lon: 129.0372, group: "경상" },
        jinju: { name: "진주", lat: 35.1800, lon: 128.1076, group: "경상" },
        gyeongju: { name: "경주", lat: 35.8562, lon: 129.2247, group: "경상" },
        geoje: { name: "거제", lat: 34.8806, lon: 128.6211, group: "경상" },
        andong: { name: "안동", lat: 36.5684, lon: 128.7294, group: "경상" },
        // 제주
        jeju: { name: "제주", lat: 33.4996, lon: 126.5312, group: "제주" },
        seogwipo: { name: "서귀포", lat: 33.2541, lon: 126.5601, group: "제주" }
    };

    const WMO_WEATHER_CODES = {
        0: ["맑음", "☀️"], 1: ["대체로 맑음", "🌤️"], 2: ["구름 조금", "⛅"], 3: ["흐림", "☁️"],
        45: ["안개", "🌫️"], 48: ["짙은 안개", "🌫️"],
        51: ["이슬비", "🌦️"], 53: ["이슬비", "🌦️"], 55: ["이슬비", "🌦️"],
        61: ["비", "🌧️"], 63: ["비", "🌧️"], 65: ["강한 비", "🌧️"],
        71: ["눈", "❄️"], 73: ["눈", "❄️"], 75: ["강한 눈", "❄️"],
        80: ["소나기", "🌦️"], 81: ["소나기", "🌦️"], 82: ["강한 소나기", "⛈️"],
        95: ["천둥번개", "⛈️"], 96: ["우박 동반 뇌우", "⛈️"], 99: ["우박 동반 뇌우", "⛈️"]
    };

    const STORAGE_KEY_CITY = STORAGE_KEYS.CITY;

    // 저장된 도시 불러오기 (도시 변경은 설정 모달에서 처리)
    let currentCity = localStorage.getItem(STORAGE_KEY_CITY) || "seoul";
    if (!CITY_DATA[currentCity]) currentCity = "seoul";

    async function loadWeather(cityKey) {
        const city = CITY_DATA[cityKey] || CITY_DATA.seoul;
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true`;
            const res = await fetch(url);
            if (!res.ok) throw new Error();
            const data = await res.json();
            const temp = Math.round(data.current_weather.temperature);
            const wcode = data.current_weather.weathercode;
            const [desc, icon] = WMO_WEATHER_CODES[wcode] || ["맑음", "☀️"];
            if (weatherIcon) weatherIcon.textContent = icon;
            if (weatherInfo) weatherInfo.textContent = `${city.name} · ${temp}°C ${desc}`;
        } catch (e) {
            if (weatherIcon) weatherIcon.textContent = "☀️";
            if (weatherInfo) weatherInfo.textContent = `${city.name} · --°C`;
        }
    }

    loadWeather(currentCity);


    /* ========================================================
       3. 공통 모달창 UI 시스템 (추가 및 수정)
    ======================================================== */
    const appModal = document.getElementById("appModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalFieldsContainer = document.getElementById("modalFieldsContainer");
    const modalForm = document.getElementById("modalForm");
    const btnModalClose = document.getElementById("btnModalClose");
    const btnModalCancel = document.getElementById("btnModalCancel");

    let currentModalSubmitHandler = null;

    function openModal({ title, fields, onSubmit, cardClass = "" }) {
        if (!appModal) return;
        modalTitle.textContent = title;
        modalFieldsContainer.innerHTML = "";

        // 모달 종류별 크기 클래스 (열 때마다 초기화 후 필요한 것만 적용)
        const modalCard = appModal.querySelector(".modal-card");
        if (modalCard) {
            modalCard.classList.remove("infomap-edit-modal-card");
            if (cardClass) modalCard.classList.add(cardClass);
        }

        fields.forEach((f) => {
            const fieldWrap = document.createElement("div");
            fieldWrap.className = "modal-field-row";

            if (f.type === "textarea") {
                const textarea = document.createElement("textarea");
                textarea.id = f.id;
                textarea.className = "simple-textarea";
                textarea.placeholder = f.placeholder || "";
                textarea.required = !!f.required;
                if (f.value !== undefined) textarea.value = f.value;
                fieldWrap.appendChild(textarea);
            } else if (f.type === "date") {
                // 기한 선택: 버튼을 누르면 달력 UI 모달이 열리고, 선택값은 hidden input에 보관
                const hidden = document.createElement("input");
                hidden.type = "hidden";
                hidden.id = f.id;
                hidden.value = f.value || "";

                const dateBtn = document.createElement("button");
                dateBtn.type = "button";
                dateBtn.className = "modal-date-btn";

                const refreshDateBtn = () => {
                    const text = hidden.value
                        ? `${hidden.value} · ${getDueLabel(hidden.value)}`
                        : (f.placeholder || "날짜 선택");
                    dateBtn.innerHTML = `<i class="icon calendar"></i><span class="monospace">${escapeHTML(text)}</span>`;
                    dateBtn.classList.toggle("has-value", !!hidden.value);
                };
                refreshDateBtn();

                dateBtn.addEventListener("click", () => {
                    openDatePicker({
                        value: hidden.value,
                        onSelect: (picked) => {
                            hidden.value = picked;
                            refreshDateBtn();
                        }
                    });
                });

                fieldWrap.appendChild(hidden);
                fieldWrap.appendChild(dateBtn);
            } else if (f.type === "checkbox") {
                const label = document.createElement("label");
                label.className = "modal-checkbox-label";
                const checkbox = document.createElement("input");
                checkbox.id = f.id;
                checkbox.type = "checkbox";
                checkbox.className = "modal-checkbox";
                if (f.checked) checkbox.checked = true;
                const textSpan = document.createElement("span");
                textSpan.textContent = f.label || "";
                label.appendChild(checkbox);
                label.appendChild(textSpan);
                fieldWrap.appendChild(label);
            } else {
                const input = document.createElement("input");
                input.id = f.id;
                input.type = f.type || "text";
                input.className = "simple-input monospace";
                input.placeholder = f.placeholder || "";
                input.required = !!f.required;
                if (f.inputMode) input.inputMode = f.inputMode;
                if (f.maxLength) input.maxLength = f.maxLength;
                if (f.autocomplete) input.autocomplete = f.autocomplete;
                if (f.value !== undefined) input.value = f.value;
                fieldWrap.appendChild(input);
            }
            modalFieldsContainer.appendChild(fieldWrap);
        });

        currentModalSubmitHandler = (e) => {
            e.preventDefault();
            const resultData = {};
            fields.forEach(f => {
                const el = document.getElementById(f.id);
                if (!el) return;
                if (f.type === "checkbox") {
                    resultData[f.id] = el.checked;
                } else {
                    resultData[f.id] = el.value.trim();
                }
            });
            const keepOpen = onSubmit(resultData) === false; // false 반환 시 입력 내용을 유지한 채 모달 유지
            if (!keepOpen) closeModal();
        };

        appModal.style.display = "flex";

        setTimeout(() => {
            const firstInput = modalFieldsContainer.querySelector("input, textarea");
            if (firstInput && firstInput.type !== "checkbox") firstInput.focus();
        }, 50);
    }

    function closeModal() {
        if (appModal) {
            appModal.style.display = "none";
            const modalCard = appModal.querySelector(".modal-card");
            if (modalCard) modalCard.classList.remove("infomap-edit-modal-card");
        }
        modalFieldsContainer.innerHTML = "";
        currentModalSubmitHandler = null;
    }

    if (modalForm) {
        modalForm.addEventListener("submit", (e) => {
            if (currentModalSubmitHandler) currentModalSubmitHandler(e);
        });
    }

    if (btnModalClose) btnModalClose.addEventListener("click", closeModal);
    if (btnModalCancel) btnModalCancel.addEventListener("click", closeModal);

    // Ctrl + Enter 빠른 제출
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            if (appModal && appModal.style.display === "flex") {
                if (modalForm) modalForm.requestSubmit();
            }
        }
    });

    // 탭을 숨기거나 다른 창으로 이동 시 보안을 위해 숨김 항목 자동 숨김
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if (isAnySecretShown()) {
                setAllSecrets(false);
            }
        }
    });


    /* ========================================================
       3.2. 기한 선택 모달 (오늘 이후 날짜를 달력 UI로 선택)
    ======================================================== */
    const datePickerModal = document.getElementById("datePickerModal");
    const btnCloseDatePicker = document.getElementById("btnCloseDatePicker");
    const datePickerTitle = document.getElementById("datePickerTitle");
    const datePickerGrid = document.getElementById("datePickerGrid");
    const btnDatePrev = document.getElementById("btnDatePrev");
    const btnDateNext = document.getElementById("btnDateNext");
    const btnDateClear = document.getElementById("btnDateClear");

    let pickerYear = new Date().getFullYear();
    let pickerMonth = new Date().getMonth(); // 0 ~ 11
    let pickerValue = "";                    // 현재 선택된 날짜 "YYYY-MM-DD" 또는 ""
    let pickerOnSelect = null;               // 선택 결과를 돌려줄 콜백

    function isDatePickerOpen() {
        return !!datePickerModal && datePickerModal.style.display === "flex";
    }

    function openDatePicker({ value, onSelect }) {
        if (!datePickerModal) return;
        const todayKey = formatDateKey(new Date());
        pickerValue = value || "";
        pickerOnSelect = onSelect;

        // 선택된 기한이 오늘 이후면 그 달, 아니면 이번 달부터 표시
        const base = (pickerValue && pickerValue >= todayKey) ? parseDateKey(pickerValue) : new Date();
        pickerYear = base.getFullYear();
        pickerMonth = base.getMonth();

        renderDatePicker();
        datePickerModal.style.display = "flex";
    }

    function closeDatePicker() {
        if (datePickerModal) datePickerModal.style.display = "none";
        pickerOnSelect = null;
    }

    function selectPickerDate(dateKey) {
        const callback = pickerOnSelect;
        closeDatePicker();
        if (callback) callback(dateKey);
    }

    function renderDatePicker() {
        if (!datePickerGrid) return;

        const now = new Date();
        const todayKey = formatDateKey(now);
        const isCurrentMonth = pickerYear === now.getFullYear() && pickerMonth === now.getMonth();

        if (datePickerTitle) {
            datePickerTitle.textContent = `${pickerYear}. ${String(pickerMonth + 1).padStart(2, "0")}`;
        }
        // 이번 달보다 이전으로는 이동할 수 없음
        if (btnDatePrev) btnDatePrev.disabled = isCurrentMonth;

        datePickerGrid.innerHTML = "";

        const firstDayIdx = new Date(pickerYear, pickerMonth, 1).getDay();
        const totalDays = new Date(pickerYear, pickerMonth + 1, 0).getDate();
        const prevMonthTotalDays = new Date(pickerYear, pickerMonth, 0).getDate();

        // 이전 달 빈 일자
        for (let i = firstDayIdx - 1; i >= 0; i--) {
            const cell = document.createElement("div");
            cell.className = "cal-day-cell other-month";
            cell.textContent = prevMonthTotalDays - i;
            datePickerGrid.appendChild(cell);
        }

        // 현재 달 일자
        for (let d = 1; d <= totalDays; d++) {
            const dateKey = `${pickerYear}-${String(pickerMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dayOfWeek = new Date(pickerYear, pickerMonth, d).getDay();

            const cell = document.createElement("div");
            cell.className = "cal-day-cell";
            if (dayOfWeek === 0) cell.classList.add("sun");
            if (dayOfWeek === 6) cell.classList.add("sat");
            if (dateKey === todayKey) cell.classList.add("is-today");
            if (dateKey === pickerValue) cell.classList.add("is-selected");
            cell.textContent = d;

            if (dateKey < todayKey) {
                cell.classList.add("is-disabled"); // 오늘 이전 날짜는 선택 불가
            } else {
                cell.addEventListener("click", () => selectPickerDate(dateKey));
            }

            datePickerGrid.appendChild(cell);
        }
    }

    if (btnDatePrev) {
        btnDatePrev.addEventListener("click", () => {
            if (btnDatePrev.disabled) return;
            pickerMonth--;
            if (pickerMonth < 0) {
                pickerMonth = 11;
                pickerYear--;
            }
            renderDatePicker();
        });
    }

    if (btnDateNext) {
        btnDateNext.addEventListener("click", () => {
            pickerMonth++;
            if (pickerMonth > 11) {
                pickerMonth = 0;
                pickerYear++;
            }
            renderDatePicker();
        });
    }

    // 기한 해제 (날짜 없음으로 설정)
    if (btnDateClear) btnDateClear.addEventListener("click", () => selectPickerDate(""));

    if (btnCloseDatePicker) btnCloseDatePicker.addEventListener("click", closeDatePicker);

    // ESC 키: 가장 위에 열린 모달부터 하나씩 닫는다 (기한 선택 → 입력 → BOOKMARKS/CLIPS 목록)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (isDatePickerOpen()) {
            e.preventDefault();
            closeDatePicker();
        } else if (appModal && appModal.style.display === "flex") {
            e.preventDefault(); // 설정 모달 위에서 연 PIN 모달만 닫히고 설정 모달은 유지
            closeModal();
        } else if (bookmarkModal && bookmarkModal.style.display === "flex") {
            closeBookmarkModal();
        } else if (clipsModal && clipsModal.style.display === "flex") {
            closeClipsModal();
        } else if (contactModal && contactModal.style.display === "flex") {
            closeContactModal();
        } else if (walletModal && walletModal.style.display === "flex") {
            closeWalletModal();
        }
    });


    /* ========================================================
       3.5. 드래그 앤 드롭 시스템 (위치 변경 및 로컬 스토리지 보관)
    ======================================================== */
    let currentDragInfo = null; // { type: 'milestones'|'footsteps'|'infomaps'|'bookmarks'|'clips'|'contacts'|'wallets', id: string }

    function cleanupDragOverStyles() {
        document.querySelectorAll(".drag-over-top, .drag-over-bottom, .dragging").forEach(el => {
            el.classList.remove("drag-over-top", "drag-over-bottom");
        });
    }

    function reorderArray(list, draggedId, targetId, position) {
        if (!draggedId || !targetId || draggedId === targetId) return list;
        const draggedIdx = list.findIndex(item => item.id === draggedId);
        if (draggedIdx === -1) return list;

        const [draggedItem] = list.splice(draggedIdx, 1);
        const targetIdx = list.findIndex(item => item.id === targetId);
        if (targetIdx === -1) {
            list.splice(draggedIdx, 0, draggedItem);
            return list;
        }

        const insertIdx = position === "after" ? targetIdx + 1 : targetIdx;
        list.splice(insertIdx, 0, draggedItem);
        return list;
    }

    function moveToLastVisible(fullList, visibleList, draggedId) {
        if (!visibleList || visibleList.length === 0) return fullList;
        const lastVisibleItem = visibleList[visibleList.length - 1];
        if (lastVisibleItem.id === draggedId) return fullList;
        return reorderArray(fullList, draggedId, lastVisibleItem.id, "after");
    }

    function attachDragAndDrop({ element, itemId, type, onReorder }) {
        element.setAttribute("draggable", "true");
        element.dataset.dragId = itemId;
        element.dataset.dragType = type;

        element.addEventListener("dragstart", (e) => {
            // 버튼, 체크박스, 입력창 등 상호작용 요소 클릭 시 드래그 방지
            if (e.target.closest(".btn-item-action") ||
                e.target.closest(".simple-checkbox") ||
                e.target.closest("input") ||
                e.target.closest("textarea")) {
                e.preventDefault();
                return;
            }

            currentDragInfo = { type, id: itemId };
            element.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", JSON.stringify({ type, id: itemId }));
        });

        element.addEventListener("dragend", () => {
            element.classList.remove("dragging");
            currentDragInfo = null;
            cleanupDragOverStyles();
        });

        element.addEventListener("dragover", (e) => {
            if (!currentDragInfo || currentDragInfo.type !== type || currentDragInfo.id === itemId) {
                return;
            }
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";

            const rect = element.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                element.classList.add("drag-over-top");
                element.classList.remove("drag-over-bottom");
            } else {
                element.classList.add("drag-over-bottom");
                element.classList.remove("drag-over-top");
            }
        });

        element.addEventListener("dragleave", (e) => {
            if (!element.contains(e.relatedTarget)) {
                element.classList.remove("drag-over-top", "drag-over-bottom");
            }
        });

        element.addEventListener("drop", (e) => {
            if (!currentDragInfo || currentDragInfo.type !== type || currentDragInfo.id === itemId) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();

            const rect = element.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const position = e.clientY < midY ? "before" : "after";
            const draggedId = currentDragInfo.id;

            cleanupDragOverStyles();
            currentDragInfo = null;

            onReorder(draggedId, itemId, position);
        });
    }

    function setupContainerDrop(container, type, onDropToContainer) {
        if (!container) return;
        container.addEventListener("dragover", (e) => {
            if (!currentDragInfo || currentDragInfo.type !== type) return;
            if (e.target === container || e.target.closest(".btn-list-add")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
            }
        });

        container.addEventListener("drop", (e) => {
            if (!currentDragInfo || currentDragInfo.type !== type) return;
            if (e.target === container || e.target.closest(".btn-list-add")) {
                e.preventDefault();
                const draggedId = currentDragInfo.id;
                currentDragInfo = null;
                cleanupDragOverStyles();
                onDropToContainer(draggedId);
            }
        });
    }


    /* ========================================================
       3.6. 검색 (MILESTONES / FOOTSTEPS / INFOMAPS / BOOKMARKS / CLIPS 공통)
       - 숨김 처리되어 가려진 항목은 검색 대상에서 제외된다
       - 대소문자를 구분하지 않고, 제목 외에 설명·내용·URL도 함께 검색한다
    ======================================================== */
    const searchQueries = { milestones: "", footsteps: "", infomaps: "", bookmarks: "", clips: "", contacts: "", wallets: "" };
    const searchInputs = {};

    // 검색어와 일치하는지 검사 (검색어가 없으면 항상 true)
    function matchesSearch(type, ...fields) {
        const query = searchQueries[type];
        if (!query) return true;
        return fields.some(field => String(field || "").toLowerCase().includes(query));
    }

    // 검색 결과가 없을 때 안내 문구
    function appendSearchEmptyMessage(listEl) {
        const msg = document.createElement("div");
        msg.className = "search-empty-msg";
        msg.textContent = "검색 결과가 없습니다.";
        listEl.appendChild(msg);
    }

    // 검색어 초기화 (새 항목을 추가하면 바로 보이도록 호출)
    function resetSearch(type) {
        searchQueries[type] = "";
        const ref = searchInputs[type];
        if (ref) {
            ref.input.value = "";
            ref.clearBtn.hidden = true;
        }
    }

    function setupSearch(type, inputId, clearId, onChange) {
        const input = document.getElementById(inputId);
        const clearBtn = document.getElementById(clearId);
        if (!input || !clearBtn) return;
        searchInputs[type] = { input, clearBtn };

        const apply = () => {
            searchQueries[type] = input.value.trim().toLowerCase();
            clearBtn.hidden = !input.value;
            onChange();
        };

        input.addEventListener("input", apply);

        clearBtn.addEventListener("click", () => {
            input.value = "";
            apply();
            input.focus();
        });

        // ESC: 검색어가 있으면 검색어만 지우고, 모달 닫기 동작은 막는다
        input.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && input.value) {
                e.stopPropagation();
                input.value = "";
                apply();
            }
        });
    }

    setupSearch("milestones", "milestoneSearch", "milestoneSearchClear", () => renderMilestones());
    setupSearch("footsteps", "footstepSearch", "footstepSearchClear", () => renderFootsteps());
    setupSearch("infomaps", "infomapSearch", "infomapSearchClear", () => renderInfomaps());
    setupSearch("bookmarks", "bookmarkSearch", "bookmarkSearchClear", () => renderBookmarks());
    setupSearch("clips", "clipSearch", "clipSearchClear", () => renderClips());
    setupSearch("contacts", "contactSearch", "contactSearchClear", () => renderContacts());
    setupSearch("wallets", "walletSearch", "walletSearchClear", () => renderWallets());


    /* ========================================================
       4. [왼쪽] MILESTONES (완료처리/수정/삭제/숨김)
    ======================================================== */
    const milestoneList = document.getElementById("milestoneList");
    const milestoneCount = document.getElementById("milestoneCount");

    function getMilestones() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.MILESTONES)) || [];
    }

    function saveMilestones(milestones) {
        localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(milestones));
        scheduleAutoBackup();
        renderMilestones();
    }

    // 새 MILESTONE 추가 모달
    function openAddMilestoneModal() {
        openModal({
            title: "새 MILESTONE 추가",
            fields: [
                { id: "title", label: "MILESTONE 이름", type: "text", placeholder: "MILESTONE 이름을 입력하세요...", required: true },
                { id: "desc", label: "설명", type: "textarea", placeholder: "MILESTONE 설명(선택사항)...", required: false }
            ],
            onSubmit: (data) => {
                if (!data.title) return;
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

                const milestones = getMilestones();
                resetSearch("milestones");
                milestones.push({
                    id: "pj_" + Date.now(),
                    title: data.title,
                    desc: data.desc || "",
                    completed: false,
                    isSecret: false,
                    date: dateStr
                });
                saveMilestones(milestones);
            }
        });
    }

    // MILESTONE 수정 모달
    function editMilestone(milestone) {
        openModal({
            title: milestone.isSecret ? "숨김 MILESTONE 수정" : "MILESTONE 수정",
            fields: [
                { id: "title", label: "MILESTONE 이름", type: "text", value: milestone.title, required: true },
                { id: "desc", label: "설명", type: "textarea", value: milestone.desc || "", required: false }
            ],
            onSubmit: (data) => {
                if (!data.title) return;
                milestone.title = data.title;
                milestone.desc = data.desc || "";
                const milestones = getMilestones();
                const idx = milestones.findIndex(p => p.id === milestone.id);
                if (idx !== -1) {
                    milestones[idx] = milestone;
                    saveMilestones(milestones);
                }
            }
        });
    }

    // MILESTONE 렌더링
    function renderMilestones() {
        if (!milestoneList) return;
        const milestones = getMilestones();
        const visibleMilestones = milestones.filter(p => showMilestoneSecrets || !p.isSecret);

        if (milestoneCount) milestoneCount.textContent = visibleMilestones.length;

        milestoneList.innerHTML = "";
        if (visibleMilestones.length === 0) {
            appendListAddButton(milestoneList, true, "새 MILESTONE 추가", openAddMilestoneModal);
            return;
        }

        const filteredMilestones = visibleMilestones.filter(p => matchesSearch("milestones", p.title, p.desc));
        if (filteredMilestones.length === 0) {
            appendSearchEmptyMessage(milestoneList);
            appendListAddButton(milestoneList, false, "새 MILESTONE 추가", openAddMilestoneModal);
            return;
        }

        filteredMilestones.forEach(milestone => {
            const card = document.createElement("div");
            card.className = `entry-card ${milestone.completed ? "completed" : ""} ${milestone.isSecret ? "secret-card" : ""}`;

            const titleDisplay = milestone.isSecret ? `🔒 ${escapeHTML(milestone.title)}` : escapeHTML(milestone.title);

            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title ${milestone.completed ? 'completed-title' : ''}">${titleDisplay}</span>
                    <div class="item-actions">
                        <button type="button" class="btn-item-action btn-complete ${milestone.completed ? 'is-completed' : ''}" title="${milestone.completed ? '완료 취소' : '완료 처리'}">
                            <i class="icon check"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-edit" title="수정">
                            <i class="icon edit"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-secret ${milestone.isSecret ? 'is-secret' : ''}" title="${milestone.isSecret ? '숨김 해제' : '숨김 설정'}">
                            <i class="icon lock"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-delete" title="삭제">
                            <i class="icon trash"></i>
                        </button>
                    </div>
                </div>
                ${milestone.desc ? `<div class="entry-body">${escapeHTML(milestone.desc)}</div>` : ""}
                <div class="entry-date">${milestone.date || ''}</div>
            `;

            // 상호작용 버튼 클릭 시 드래그 이벤트 간섭 방지
            card.querySelectorAll(".btn-item-action").forEach(btn => {
                btn.setAttribute("draggable", "false");
                btn.addEventListener("mousedown", (e) => e.stopPropagation());
            });

            // 완료 처리 버튼 클릭
            card.querySelector(".btn-complete").addEventListener("click", () => {
                milestone.completed = !milestone.completed;
                saveMilestones(milestones);
            });

            // 수정 버튼 클릭
            card.querySelector(".btn-edit").addEventListener("click", () => editMilestone(milestone));

            // 더블클릭 수정
            card.addEventListener("dblclick", (e) => {
                if (!e.target.closest(".btn-item-action")) editMilestone(milestone);
            });

            // 숨김(자물쇠) 버튼 클릭: 숨김 설정 / 해제
            card.querySelector(".btn-secret").addEventListener("click", () => {
                milestone.isSecret = !milestone.isSecret;
                saveMilestones(milestones);
            });

            // 삭제 버튼 클릭
            card.querySelector(".btn-delete").addEventListener("click", () => {
                if (confirm("이 MILESTONE을 삭제하시겠습니까?")) {
                    const updated = milestones.filter(p => p.id !== milestone.id);
                    saveMilestones(updated);
                }
            });

            // 드래그 앤 드롭 위치 변경 등록
            attachDragAndDrop({
                element: card,
                itemId: milestone.id,
                type: "milestones",
                onReorder: (draggedId, targetId, position) => {
                    const fullList = getMilestones();
                    const updated = reorderArray(fullList, draggedId, targetId, position);
                    saveMilestones(updated);
                }
            });

            milestoneList.appendChild(card);
        });

        appendListAddButton(milestoneList, false, "새 MILESTONE 추가", openAddMilestoneModal);
    }

    // MILESTONE 리스트 하단 빈 영역 드롭 처리
    setupContainerDrop(milestoneList, "milestones", (draggedId) => {
        const fullList = getMilestones();
        const visible = fullList.filter(p => showMilestoneSecrets || !p.isSecret);
        const updated = moveToLastVisible(fullList, visible, draggedId);
        saveMilestones(updated);
    });


    /* ========================================================
       5. [가운데] FOOTSTEPS (전체 목록 / 기한 경고 / +추가 통합)
    ======================================================== */
    const footstepCount = document.getElementById("footstepCount");
    const footstepList = document.getElementById("footstepList");

    function getFootsteps() {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.FOOTSTEPS)) || [];
        return raw.map(normalizeFootstep);
    }

    function saveFootsteps(footsteps) {
        localStorage.setItem(STORAGE_KEYS.FOOTSTEPS, JSON.stringify(footsteps));
        scheduleAutoBackup();
        renderFootsteps();
    }

    // "YYYY-MM-DD" → 해당 날짜 0시의 Date
    function parseDateKey(key) {
        const [y, m, d] = String(key).split("-").map(Number);
        return new Date(y, m - 1, d);
    }

    // 기한까지 남은 일수 (오늘이면 0, 지났으면 음수)
    function getDueDiff(dateKey) {
        const today = parseDateKey(formatDateKey(new Date()));
        return Math.round((parseDateKey(dateKey) - today) / 86400000);
    }

    function getDueLabel(dateKey) {
        const diff = getDueDiff(dateKey);
        if (diff === 0) return "D-Day";
        return diff > 0 ? `D-${diff}` : `${Math.abs(diff)}일 지남`;
    }

    // 목록에 표시할 기한 문구 (올해면 MM.DD, 다른 해면 YYYY.MM.DD)
    function formatDueText(dateKey) {
        const [y, m, d] = dateKey.split("-");
        const dateText = Number(y) === new Date().getFullYear() ? `${m}.${d}` : `${y}.${m}.${d}`;
        return `~ ${dateText} · ${getDueLabel(dateKey)}`;
    }

    // 기한 상태: 완료 done / 오늘 today(노랑) / 지남 overdue(빨강) / 남음 upcoming / 기한 없음 null
    function getDueStatus(footstep) {
        if (footstep.isRoutine || !footstep.dueDate) return null;
        if (footstep.completed) return "done";
        const diff = getDueDiff(footstep.dueDate);
        if (diff < 0) return "overdue";
        return diff === 0 ? "today" : "upcoming";
    }

    // FOOTSTEP 렌더링 (모든 FOOTSTEP을 하나의 목록으로 표시)
    function renderFootsteps() {
        if (!footstepList) return;

        const allFootsteps = getFootsteps();
        const visibleFootsteps = allFootsteps.filter(t => showFootstepSecrets || !t.isSecret);

        // 총 개수: 완료한 일 / 전체 (예: 1/5)
        if (footstepCount) {
            const doneCount = visibleFootsteps.filter(t => t.completed).length;
            footstepCount.textContent = `${doneCount}/${visibleFootsteps.length}`;
        }

        footstepList.innerHTML = "";
        if (visibleFootsteps.length === 0) {
            appendListAddButton(footstepList, true, "새 FOOTSTEP 추가", openAddFootstepModal);
            return;
        }

        const filteredFootsteps = visibleFootsteps.filter(t => matchesSearch("footsteps", t.title));
        if (filteredFootsteps.length === 0) {
            appendSearchEmptyMessage(footstepList);
            appendListAddButton(footstepList, false, "새 FOOTSTEP 추가", openAddFootstepModal);
            return;
        }

        filteredFootsteps.forEach(footstep => {
            const isCompleted = !!footstep.completed;
            const dueStatus = getDueStatus(footstep);
            const dueClass = (dueStatus === "today" || dueStatus === "overdue") ? `due-${dueStatus}` : "";

            const item = document.createElement("div");
            item.className = `simple-item ${isCompleted ? "completed" : ""} ${footstep.isSecret ? "secret-item" : ""} ${dueClass}`;

            item.innerHTML = `
                <div class="simple-checkbox" title="${isCompleted ? '미완료로 변경' : '완료로 표시'}">
                    <i class="icon check"></i>
                </div>
                <div class="item-content-group">
                    <span class="item-title">${footstep.isSecret ? "🔒 " : ""}${escapeHTML(footstep.title)}</span>
                    ${footstep.isRoutine ? `<span class="tag-badge-routine">반복</span>` : ""}
                    ${dueStatus ? `<span class="footstep-due due-${dueStatus}">${escapeHTML(formatDueText(footstep.dueDate))}</span>` : ""}
                </div>
                <div class="item-actions">
                    <button type="button" class="btn-item-action btn-edit" title="수정">
                        <i class="icon edit"></i>
                    </button>
                    <button type="button" class="btn-item-action btn-routine ${footstep.isRoutine ? 'is-routine' : ''}" title="${footstep.isRoutine ? '반복 해제' : '반복 설정'}">
                        <i class="icon repeat"></i>
                    </button>
                    <button type="button" class="btn-item-action btn-secret ${footstep.isSecret ? 'is-secret' : ''}" title="${footstep.isSecret ? '숨김 해제' : '숨김 설정'}">
                        <i class="icon lock"></i>
                    </button>
                    <button type="button" class="btn-item-action btn-delete" title="삭제">
                        <i class="icon trash"></i>
                    </button>
                </div>
            `;

            // 상호작용 버튼 및 체크박스 클릭 시 드래그 이벤트 간섭 방지
            item.querySelectorAll(".btn-item-action, .simple-checkbox").forEach(el => {
                el.setAttribute("draggable", "false");
                el.addEventListener("mousedown", (e) => e.stopPropagation());
            });

            // 체크박스 클릭 (반복 FOOTSTEP도 동일하게 완료 상태 유지, 초기화는 헤더 버튼으로)
            item.querySelector(".simple-checkbox").addEventListener("click", () => {
                footstep.completed = !footstep.completed;
                saveFootsteps(allFootsteps);
            });

            // 수정
            item.querySelector(".btn-edit").addEventListener("click", () => editFootstep(footstep));
            item.querySelector(".item-content-group").addEventListener("dblclick", () => editFootstep(footstep));

            // 반복 아이콘 클릭: 반복 FOOTSTEP 설정 / 해제 (반복이면 기한 없음)
            item.querySelector(".btn-routine").addEventListener("click", () => {
                footstep.isRoutine = !footstep.isRoutine;
                if (footstep.isRoutine) footstep.dueDate = null;
                saveFootsteps(allFootsteps);
            });

            // 숨김(자물쇠) 버튼 클릭: 숨김 설정 / 해제
            item.querySelector(".btn-secret").addEventListener("click", () => {
                footstep.isSecret = !footstep.isSecret;
                saveFootsteps(allFootsteps);
            });

            // 삭제
            item.querySelector(".btn-delete").addEventListener("click", () => {
                const updated = allFootsteps.filter(t => t.id !== footstep.id);
                saveFootsteps(updated);
            });

            // 드래그 앤 드롭 위치 변경 등록
            attachDragAndDrop({
                element: item,
                itemId: footstep.id,
                type: "footsteps",
                onReorder: (draggedId, targetId, position) => {
                    const fullList = getFootsteps();
                    const updated = reorderArray(fullList, draggedId, targetId, position);
                    saveFootsteps(updated);
                }
            });

            footstepList.appendChild(item);
        });

        appendListAddButton(footstepList, false, "새 FOOTSTEP 추가", openAddFootstepModal);
    }

    // FOOTSTEP 리스트 하단 빈 영역 드롭 처리
    setupContainerDrop(footstepList, "footsteps", (draggedId) => {
        const fullList = getFootsteps();
        const visibleFootsteps = fullList.filter(t => showFootstepSecrets || !t.isSecret);
        const updated = moveToLastVisible(fullList, visibleFootsteps, draggedId);
        saveFootsteps(updated);
    });

    // FOOTSTEP 수정 모달 (내용 / 기한) - 반복 설정·해제는 목록의 반복 아이콘으로 처리
    function editFootstep(footstep) {
        const fields = [
            { id: "footstepTitle", label: "FOOTSTEP 내용", type: "text", value: footstep.title, required: true }
        ];
        // 반복 FOOTSTEP은 기한이 없으므로 일반 FOOTSTEP일 때만 기한 입력 표시
        if (!footstep.isRoutine) {
            fields.push({ id: "dueDate", label: "기한", type: "date", value: footstep.dueDate || "", placeholder: "기한 선택 (선택사항)" });
        }
        openModal({
            title: footstep.isRoutine ? "반복 FOOTSTEP 수정" : "FOOTSTEP 수정",
            fields: fields,
            onSubmit: (data) => {
                if (!data.footstepTitle) return;
                footstep.title = data.footstepTitle;
                footstep.dueDate = footstep.isRoutine ? null : (data.dueDate || null);
                const allFootsteps = getFootsteps();
                const idx = allFootsteps.findIndex(t => t.id === footstep.id);
                if (idx !== -1) {
                    allFootsteps[idx] = footstep;
                    saveFootsteps(allFootsteps);
                }
            }
        });
    }

    // FOOTSTEP 추가 모달 (오늘 이후 기한을 달력 UI로 선택 가능)
    function openAddFootstepModal() {
        openModal({
            title: "새 FOOTSTEP 추가",
            fields: [
                { id: "footstepTitle", label: "FOOTSTEP 내용", type: "text", placeholder: "FOOTSTEP 내용을 입력하세요...", required: true },
                { id: "dueDate", label: "기한", type: "date", value: "", placeholder: "기한 선택 (선택사항)" }
            ],
            onSubmit: (data) => {
                if (!data.footstepTitle) return;
                const footsteps = getFootsteps();
                resetSearch("footsteps");
                // 반복 여부는 추가 후 목록의 반복 아이콘으로 설정
                footsteps.push({
                    id: "tk_" + Date.now(),
                    title: data.footstepTitle,
                    completed: false,
                    isRoutine: false,
                    isSecret: false,
                    dueDate: data.dueDate || null
                });
                saveFootsteps(footsteps);
            }
        });
    }


    /* ========================================================
       6. [오른쪽] INFOMAPS (완료처리/수정/삭제/숨김)
    ======================================================== */
    const infomapList = document.getElementById("infomapList");
    const infomapCount = document.getElementById("infomapCount");

    function getInfomaps() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.INFOMAPS)) || [];
    }

    function saveInfomaps(infomaps) {
        localStorage.setItem(STORAGE_KEYS.INFOMAPS, JSON.stringify(infomaps));
        scheduleAutoBackup();
        renderInfomaps();
    }

    // 새 INFOMAP 작성 모달
    function openAddInfomapModal() {
        openModal({
            title: "새 INFOMAP 작성",
            cardClass: "infomap-edit-modal-card",
            fields: [
                { id: "infomapTitle", label: "INFOMAP 제목", type: "text", placeholder: "INFOMAP 제목...", required: true },
                { id: "infomapContent", label: "INFOMAP 내용", type: "textarea", placeholder: "내용을 입력하세요...", required: true }
            ],
            onSubmit: (data) => {
                if (!data.infomapTitle || !data.infomapContent) return;
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

                const infomaps = getInfomaps();
                resetSearch("infomaps");
                infomaps.push({
                    id: "mm_" + Date.now(),
                    title: data.infomapTitle,
                    content: data.infomapContent,
                    completed: false,
                    isSecret: false,
                    date: dateStr
                });
                saveInfomaps(infomaps);
            }
        });
    }

    // INFOMAP 수정 모달
    function editInfomap(infomap) {
        openModal({
            title: infomap.isSecret ? "숨김 INFOMAP 수정" : "INFOMAP 수정",
            cardClass: "infomap-edit-modal-card",
            fields: [
                { id: "infomapTitle", label: "INFOMAP 제목", type: "text", value: infomap.title, required: true },
                { id: "infomapContent", label: "INFOMAP 내용", type: "textarea", value: infomap.content, required: true }
            ],
            onSubmit: (data) => {
                if (!data.infomapTitle || !data.infomapContent) return;
                infomap.title = data.infomapTitle;
                infomap.content = data.infomapContent;
                const infomaps = getInfomaps();
                const idx = infomaps.findIndex(m => m.id === infomap.id);
                if (idx !== -1) {
                    infomaps[idx] = infomap;
                    saveInfomaps(infomaps);
                }
            }
        });
    }

    // INFOMAP 렌더링 (MILESTONE와 동일하게 완료처리 버튼 지원)
    function renderInfomaps() {
        if (!infomapList) return;
        const infomaps = getInfomaps();
        const visibleInfomaps = infomaps.filter(m => showInfomapSecrets || !m.isSecret);

        if (infomapCount) infomapCount.textContent = visibleInfomaps.length;

        infomapList.innerHTML = "";
        if (visibleInfomaps.length === 0) {
            appendListAddButton(infomapList, true, "새 INFOMAP 작성", openAddInfomapModal);
            return;
        }

        const filteredInfomaps = visibleInfomaps.filter(m => matchesSearch("infomaps", m.title, m.content));
        if (filteredInfomaps.length === 0) {
            appendSearchEmptyMessage(infomapList);
            appendListAddButton(infomapList, false, "새 INFOMAP 작성", openAddInfomapModal);
            return;
        }

        filteredInfomaps.forEach(infomap => {
            const card = document.createElement("div");
            card.className = `entry-card ${infomap.completed ? "completed" : ""} ${infomap.isSecret ? "secret-card" : ""}`;

            const titleDisplay = infomap.isSecret ? `🔒 ${escapeHTML(infomap.title)}` : escapeHTML(infomap.title);

            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title ${infomap.completed ? 'completed-title' : ''}">${titleDisplay}</span>
                    <div class="item-actions">
                        <button type="button" class="btn-item-action btn-complete ${infomap.completed ? 'is-completed' : ''}" title="${infomap.completed ? '완료 취소' : '완료 처리'}">
                            <i class="icon check"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-edit" title="수정">
                            <i class="icon edit"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-secret ${infomap.isSecret ? 'is-secret' : ''}" title="${infomap.isSecret ? '숨김 해제' : '숨김 설정'}">
                            <i class="icon lock"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-delete" title="삭제">
                            <i class="icon trash"></i>
                        </button>
                    </div>
                </div>
                <div class="entry-body">${escapeHTML(infomap.content)}</div>
                <div class="entry-date">${infomap.date || ''}</div>
            `;

            // 상호작용 버튼 클릭 시 드래그 이벤트 간섭 방지
            card.querySelectorAll(".btn-item-action").forEach(btn => {
                btn.setAttribute("draggable", "false");
                btn.addEventListener("mousedown", (e) => e.stopPropagation());
            });

            // 완료 처리 버튼 클릭 (왼쪽 MILESTONE와 동일)
            card.querySelector(".btn-complete").addEventListener("click", () => {
                infomap.completed = !infomap.completed;
                saveInfomaps(infomaps);
            });

            // 수정 버튼 클릭
            card.querySelector(".btn-edit").addEventListener("click", () => editInfomap(infomap));

            // 더블클릭 수정
            card.addEventListener("dblclick", (e) => {
                if (!e.target.closest(".btn-item-action")) editInfomap(infomap);
            });

            // 숨김(자물쇠) 버튼 클릭: 숨김 설정 / 해제
            card.querySelector(".btn-secret").addEventListener("click", () => {
                infomap.isSecret = !infomap.isSecret;
                saveInfomaps(infomaps);
            });

            // 삭제 버튼 클릭
            card.querySelector(".btn-delete").addEventListener("click", () => {
                if (confirm("이 INFOMAP을 삭제하시겠습니까?")) {
                    const updated = infomaps.filter(m => m.id !== infomap.id);
                    saveInfomaps(updated);
                }
            });

            // 드래그 앤 드롭 위치 변경 등록
            attachDragAndDrop({
                element: card,
                itemId: infomap.id,
                type: "infomaps",
                onReorder: (draggedId, targetId, position) => {
                    const fullList = getInfomaps();
                    const updated = reorderArray(fullList, draggedId, targetId, position);
                    saveInfomaps(updated);
                }
            });

            infomapList.appendChild(card);
        });

        appendListAddButton(infomapList, false, "새 INFOMAP 작성", openAddInfomapModal);
    }

    // INFOMAP 리스트 하단 빈 영역 드롭 처리
    setupContainerDrop(infomapList, "infomaps", (draggedId) => {
        const fullList = getInfomaps();
        const visible = fullList.filter(m => showInfomapSecrets || !m.isSecret);
        const updated = moveToLastVisible(fullList, visible, draggedId);
        saveInfomaps(updated);
    });


    /* ========================================================
       6.5. 설정 모달 (도시 선택 / 데이터 내보내기 · 가져오기)
    ======================================================== */
    const settingsModal = document.getElementById("settingsModal");
    const btnOpenSettings = document.getElementById("btnOpenSettings");
    const btnCloseSettingsModal = document.getElementById("btnCloseSettingsModal");
    const cityDropdown = document.getElementById("cityDropdown");
    const cityDropdownTrigger = document.getElementById("cityDropdownTrigger");
    const cityDropdownValue = document.getElementById("cityDropdownValue");
    const cityDropdownMenu = document.getElementById("cityDropdownMenu");
    const btnExportData = document.getElementById("btnExportData");
    const btnImportData = document.getElementById("btnImportData");
    const importFileInput = document.getElementById("importFileInput");

    const BACKUP_APP_NAME = "MILESTONESTUDIO";
    const BACKUP_VERSION = 1;

    /* ── 도시 드롭다운 (CITY_DATA 기준 · 지역별 그룹 / 심플 커스텀 메뉴) ─────────────────
       - 선택 즉시 저장 + 날씨 갱신 (기존 <select> change 동작과 동일)
       - 키보드: ↑ ↓ Home End 이동 / Enter · Space 선택 / Esc 메뉴만 닫기(설정 모달은 유지) / Tab 닫기
    ─────────────────────────────────────────────────────────────────────── */
    let cityOptionEls = [];    // 선택 가능한 도시 항목(.city-option) 목록
    let cityActiveIndex = -1;  // 키보드/마우스로 강조 중인 항목 번호

    function isCityMenuOpen() {
        return !!cityDropdownMenu && !cityDropdownMenu.hidden;
    }

    // 현재 도시를 트리거 글자와 목록의 선택 표시에 반영
    function syncCityDropdown() {
        if (!cityDropdownValue) return;
        const city = CITY_DATA[currentCity] || CITY_DATA.seoul;
        cityDropdownValue.textContent = city.name;
        cityOptionEls.forEach((el) => {
            el.setAttribute("aria-selected", el.dataset.city === currentCity ? "true" : "false");
        });
    }

    // 강조 항목 변경 (scroll=true면 메뉴 안에서 보이도록 스크롤 / 그룹의 첫 항목이면 그룹 제목까지 보이게)
    function setCityActive(index, scroll) {
        if (!cityOptionEls.length) return;
        cityActiveIndex = Math.max(0, Math.min(index, cityOptionEls.length - 1));
        cityOptionEls.forEach((el, i) => el.classList.toggle("is-active", i === cityActiveIndex));

        const active = cityOptionEls[cityActiveIndex];
        cityDropdownTrigger.setAttribute("aria-activedescendant", active.id);

        if (scroll) {
            const prev = active.previousElementSibling;
            const anchor = prev && prev.classList.contains("city-group-label") ? prev : active;
            const top = anchor.offsetTop - 4;
            const bottom = active.offsetTop + active.offsetHeight + 4;
            if (top < cityDropdownMenu.scrollTop) {
                cityDropdownMenu.scrollTop = top;
            } else if (bottom > cityDropdownMenu.scrollTop + cityDropdownMenu.clientHeight) {
                cityDropdownMenu.scrollTop = bottom - cityDropdownMenu.clientHeight;
            }
        }
    }

    function openCityMenu() {
        if (!cityDropdownMenu || isCityMenuOpen()) return;
        cityDropdownMenu.hidden = false;
        cityDropdown.classList.add("is-open");
        cityDropdownTrigger.setAttribute("aria-expanded", "true");

        // 현재 도시를 강조하고 메뉴 가운데쯤에 보이도록 스크롤
        const selectedIndex = Math.max(0, cityOptionEls.findIndex((el) => el.dataset.city === currentCity));
        setCityActive(selectedIndex, false);
        const selectedEl = cityOptionEls[selectedIndex];
        if (selectedEl) {
            cityDropdownMenu.scrollTop = selectedEl.offsetTop - (cityDropdownMenu.clientHeight - selectedEl.offsetHeight) / 2;
        }
    }

    function closeCityMenu() {
        if (!cityDropdownMenu || !isCityMenuOpen()) return;
        cityDropdownMenu.hidden = true;
        cityDropdown.classList.remove("is-open");
        cityDropdownTrigger.setAttribute("aria-expanded", "false");
        cityDropdownTrigger.removeAttribute("aria-activedescendant");
    }

    // 도시 선택 (바뀐 경우에만 저장 + 날씨 갱신)
    function selectCity(key) {
        if (CITY_DATA[key] && key !== currentCity) {
            currentCity = key;
            localStorage.setItem(STORAGE_KEY_CITY, currentCity);
            loadWeather(currentCity);
            scheduleAutoBackup();
        }
        syncCityDropdown();
        closeCityMenu();
    }

    if (cityDropdown && cityDropdownTrigger && cityDropdownMenu) {
        // 메뉴 항목 생성 (지역이 바뀔 때마다 그룹 제목 추가)
        let lastGroup = null;
        Object.entries(CITY_DATA).forEach(([key, city]) => {
            if (city.group && city.group !== lastGroup) {
                const label = document.createElement("div");
                label.className = "city-group-label";
                label.setAttribute("role", "presentation");
                label.textContent = city.group;
                cityDropdownMenu.appendChild(label);
                lastGroup = city.group;
            }
            const opt = document.createElement("div");
            opt.className = "city-option";
            opt.id = `cityOption-${key}`;
            opt.dataset.city = key;
            opt.setAttribute("role", "option");
            opt.textContent = city.name;
            cityDropdownMenu.appendChild(opt);
            cityOptionEls.push(opt);
        });
        syncCityDropdown();

        cityDropdownTrigger.addEventListener("click", () => {
            if (isCityMenuOpen()) closeCityMenu(); else openCityMenu();
        });

        cityDropdownTrigger.addEventListener("keydown", (e) => {
            const open = isCityMenuOpen();
            switch (e.key) {
                case "ArrowDown":
                case "ArrowUp":
                    e.preventDefault();
                    if (!open) { openCityMenu(); break; }
                    setCityActive(cityActiveIndex + (e.key === "ArrowDown" ? 1 : -1), true);
                    break;
                case "Home":
                case "End":
                    if (!open) break;
                    e.preventDefault();
                    setCityActive(e.key === "Home" ? 0 : cityOptionEls.length - 1, true);
                    break;
                case "Enter":
                case " ":
                    e.preventDefault(); // 버튼 기본 클릭(토글)과 겹치지 않게 직접 처리
                    if (open) {
                        const active = cityOptionEls[cityActiveIndex];
                        if (active) selectCity(active.dataset.city); else closeCityMenu();
                    } else {
                        openCityMenu();
                    }
                    break;
                case "Escape":
                    if (!open) break;
                    e.preventDefault();
                    e.stopPropagation(); // 메뉴만 닫고 설정 모달은 유지
                    closeCityMenu();
                    break;
                case "Tab":
                    closeCityMenu();
                    break;
            }
        });

        // Space는 keyup에서 버튼 클릭이 발생하는 브라우저가 있어 함께 막는다
        cityDropdownTrigger.addEventListener("keyup", (e) => {
            if (e.key === " ") e.preventDefault();
        });

        cityDropdownMenu.addEventListener("mouseover", (e) => {
            const opt = e.target.closest(".city-option");
            if (opt) setCityActive(cityOptionEls.indexOf(opt), false);
        });

        cityDropdownMenu.addEventListener("click", (e) => {
            const opt = e.target.closest(".city-option");
            if (!opt) return;
            selectCity(opt.dataset.city);
            cityDropdownTrigger.focus();
        });

        // 메뉴 바깥을 누르면 닫기
        document.addEventListener("click", (e) => {
            if (isCityMenuOpen() && !cityDropdown.contains(e.target)) closeCityMenu();
        });
    }

    function openSettingsModal() {
        if (!settingsModal) return;
        closeCityMenu();
        syncCityDropdown();
        updatePinSettingsUI();
        settingsModal.style.display = "flex";
    }

    function closeSettingsModal() {
        closeCityMenu();
        if (settingsModal) settingsModal.style.display = "none";
    }

    if (btnOpenSettings) btnOpenSettings.addEventListener("click", openSettingsModal);
    if (btnCloseSettingsModal) btnCloseSettingsModal.addEventListener("click", closeSettingsModal);

    // ESC 키로 설정 모달 닫기
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !e.defaultPrevented && settingsModal && settingsModal.style.display === "flex") {
            closeSettingsModal();
        }
    });

    /* ========================================================
       6.5-0. 설정 모달: PIN 비밀번호 설정 / 변경
    ======================================================== */
    // ── PIN 비밀번호 설정 / 변경 ──────────────────────────────
    const btnChangePin = document.getElementById("btnChangePin");
    const pinStatusText = document.getElementById("pinStatusText");
    const PIN_PATTERN = /^\d{4,8}$/; // 숫자 4~8자리

    // 사용자가 PIN을 직접 설정했는지 (저장된 값이 없으면 기본 PIN 0000 사용 중)
    function isCustomPinSet() {
        return localStorage.getItem(STORAGE_KEYS.PIN) !== null;
    }

    // PIN 입력창 안내 문구 (기본 PIN을 쓰는 동안에만 기본값을 안내)
    function pinPlaceholder() {
        return isCustomPinSet() ? "PIN 번호" : "PIN 번호 (기본: 0000)";
    }

    function updatePinSettingsUI() {
        const custom = isCustomPinSet();
        if (pinStatusText) {
            pinStatusText.textContent = custom ? "PIN이 설정되어 있습니다" : "기본 PIN(0000) 사용 중";
            pinStatusText.classList.toggle("has-path", custom);
        }
        if (btnChangePin) btnChangePin.textContent = custom ? "PIN 변경" : "PIN 설정";
    }

    function openChangePinModal() {
        const custom = isCustomPinSet();
        openModal({
            title: custom ? "PIN 변경" : "PIN 설정",
            fields: [
                { id: "curPin", label: "현재 PIN", type: "password", placeholder: custom ? "현재 PIN" : "현재 PIN (기본: 0000)", required: true, inputMode: "numeric", autocomplete: "off" },
                { id: "newPin", label: "새 PIN", type: "password", placeholder: "새 PIN (숫자 4~8자리)", required: true, inputMode: "numeric", maxLength: 8, autocomplete: "new-password" },
                { id: "newPinConfirm", label: "새 PIN 확인", type: "password", placeholder: "새 PIN 다시 입력", required: true, inputMode: "numeric", maxLength: 8, autocomplete: "new-password" }
            ],
            onSubmit: (data) => {
                if (data.curPin !== userPin) {
                    alert("현재 PIN 번호가 일치하지 않습니다.");
                    return false; // 모달 유지
                }
                if (!PIN_PATTERN.test(data.newPin)) {
                    alert("새 PIN은 숫자 4~8자리로 입력해 주세요.");
                    return false;
                }
                if (data.newPin !== data.newPinConfirm) {
                    alert("새 PIN과 확인 입력이 일치하지 않습니다.");
                    return false;
                }
                if (data.newPin === userPin) {
                    alert("현재 PIN과 다른 번호를 입력해 주세요.");
                    return false;
                }

                userPin = data.newPin;
                localStorage.setItem(STORAGE_KEYS.PIN, userPin);
                updatePinSettingsUI();
                scheduleAutoBackup(); // 백업 파일에도 새 PIN 반영
                alert("PIN 번호가 " + (custom ? "변경" : "설정") + "되었습니다.");
            }
        });
    }

    if (btnChangePin) btnChangePin.addEventListener("click", openChangePinModal);
    updatePinSettingsUI();

    /* ========================================================
       6.5-1. 설정 모달: 로컬 스토리지 전체 초기화 (PIN 번호 확인 필요)
    ======================================================== */
    const btnResetAllData = document.getElementById("btnResetAllData");

    async function resetAllLocalData() {
        // 초기화 직전 자동 내보내기가 빈 데이터를 덮어쓰지 않도록 예약된 백업을 취소
        clearTimeout(autoBackupTimer);
        autoBackupEnabled = false;

        // 자동 내보내기 폴더 핸들(IndexedDB)도 함께 삭제
        try { await idbDeleteBackupDir(); } catch (e) { }

        try {
            localStorage.clear();
        } catch (e) {
            alert("로컬 스토리지를 초기화하는 중 오류가 발생했습니다.");
            return;
        }

        // 기본 데이터로 다시 시작하기 위해 페이지 새로고침
        location.reload();
    }

    if (btnResetAllData) {
        btnResetAllData.addEventListener("click", () => {
            openModal({
                title: "전체 초기화 (PIN 확인)",
                fields: [
                    { id: "resetPin", label: "PIN 번호", type: "password", placeholder: pinPlaceholder(), required: true }
                ],
                onSubmit: (data) => {
                    if (data.resetPin !== userPin) {
                        alert("PIN 번호가 일치하지 않습니다.");
                        return false; // 모달 유지
                    }
                    const ok = confirm(
                        "로컬 스토리지의 모든 데이터가 삭제되고 처음 상태로 돌아갑니다.\n" +
                        "(MILESTONES · FOOTSTEPS · INFOMAPS · BOOKMARKS · CLIPS · CONTACTS · WALLETS · 개인 모드 데이터 · PIN · 설정 전부)\n\n" +
                        "삭제된 데이터는 복구할 수 없습니다. 정말 초기화하시겠습니까?"
                    );
                    if (!ok) return;
                    resetAllLocalData();
                }
            });
        });
    }

    // 백업 데이터 구성 (수동 내보내기 / 자동 내보내기 공통)
    // 현재 모드와 상관없이 일반/개인 데이터 저장소를 읽고 쓰기 위해 모드를 잠시 바꿔서 실행
    function withMode(privateOn, fn) {
        const prev = isPrivateMode;
        isPrivateMode = !!privateOn;
        try {
            return fn();
        } finally {
            isPrivateMode = prev;
        }
    }

    // 지정한 모드(일반 / 개인)의 5개 영역 데이터를 모두 읽기
    function collectDataSet(privateOn) {
        return withMode(privateOn, () => ({
            milestones: getMilestones(),
            footsteps: getFootsteps(),
            bookmarks: getBookmarks(),
            clips: getClips(),
            contacts: getContacts(),
            wallets: getWallets(),
            infomaps: getInfomaps()
        }));
    }

    // 백업 파일의 데이터 묶음 검증: 배열이 있는 항목만 반영 대상으로 사용 (없으면 null → 현재 값 유지)
    function sanitizeDataSet(src) {
        if (!src || typeof src !== "object") return null;
        return {
            milestones: Array.isArray(src.milestones) ? src.milestones : null,
            footsteps: Array.isArray(src.footsteps) ? src.footsteps.map(normalizeFootstep) : null,
            infomaps: Array.isArray(src.infomaps) ? src.infomaps : null,
            bookmarks: Array.isArray(src.bookmarks)
                ? src.bookmarks.filter(b => b && typeof b.title === "string" && typeof b.url === "string")
                : null,
            clips: Array.isArray(src.clips)
                ? src.clips.filter(cl => cl && typeof cl.title === "string" && typeof cl.content === "string")
                : null,
            contacts: Array.isArray(src.contacts)
                ? src.contacts.filter(ct => ct && typeof ct.name === "string" && typeof ct.phone === "string")
                : null,
            wallets: Array.isArray(src.wallets)
                ? src.wallets.filter(w => w && typeof w.name === "string" && typeof w.address === "string")
                : null
        };
    }

    // 검증한 데이터 묶음을 지정한 모드의 저장소에 쓰기
    function writeDataSet(privateOn, set) {
        if (!set) return;
        withMode(privateOn, () => {
            if (set.milestones) localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(set.milestones));
            if (set.footsteps) localStorage.setItem(STORAGE_KEYS.FOOTSTEPS, JSON.stringify(set.footsteps));
            if (set.infomaps) localStorage.setItem(STORAGE_KEYS.INFOMAPS, JSON.stringify(set.infomaps));
            if (set.bookmarks) localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(set.bookmarks));
            if (set.clips) localStorage.setItem(STORAGE_KEYS.CLIPS, JSON.stringify(set.clips));
            if (set.contacts) localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(set.contacts));
            if (set.wallets) localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(set.wallets));
        });
    }

    // 데이터 묶음 개수 요약 문구
    function describeDataSet(set) {
        const parts = [];
        if (set.milestones) parts.push(`MILESTONES ${set.milestones.length}개`);
        if (set.footsteps) parts.push(`FOOTSTEPS ${set.footsteps.length}개`);
        if (set.infomaps) parts.push(`INFOMAPS ${set.infomaps.length}개`);
        if (set.bookmarks) parts.push(`BOOKMARKS ${set.bookmarks.length}개`);
        if (set.clips) parts.push(`CLIPS ${set.clips.length}개`);
        if (set.contacts) parts.push(`CONTACTS ${set.contacts.length}개`);
        if (set.wallets) parts.push(`WALLETS ${set.wallets.length}개`);
        return parts.join(" / ");
    }

    // 백업 데이터 구성: 일반 데이터 + 개인 모드 데이터(data.private)를 하나의 JSON에 저장
    function buildBackupPayload(now) {
        return {
            app: BACKUP_APP_NAME,
            version: BACKUP_VERSION,
            exportedAt: now.toISOString(),
            data: {
                ...collectDataSet(false),
                pin: userPin,
                city: currentCity,
                private: collectDataSet(true)
            }
        };
    }

    // 내보내기: 모든 데이터를 JSON 파일로 다운로드
    function exportData() {
        const now = new Date();
        const timeStamp = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map(n => String(n).padStart(2, "0"))
            .join("");

        const payload = buildBackupPayload(now);

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `milestonestudio-backup-${formatDateKey(now).replace(/-/g, "")}-${timeStamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // 가져오기: JSON 파일 검증 후 현재 데이터를 덮어쓰기
    function importData(file) {
        const reader = new FileReader();

        reader.onerror = () => alert("파일을 읽는 중 오류가 발생했습니다.");

        reader.onload = () => {
            let parsed;
            try {
                parsed = JSON.parse(reader.result);
            } catch (err) {
                alert("올바른 JSON 파일이 아닙니다.");
                return;
            }

            const d = parsed && parsed.app === BACKUP_APP_NAME ? parsed.data : null;
            if (!d || !Array.isArray(d.milestones) || !Array.isArray(d.footsteps) || !Array.isArray(d.infomaps)) {
                alert("MILESTONESTUDIO 백업 파일이 아니거나 형식이 올바르지 않습니다.");
                return;
            }

            // 일반 데이터 / 개인 모드 데이터(d.private)를 각각 검증 (BOOKMARKS·CLIPS·개인 데이터는 파일에 있을 때만 교체)
            const normalSet = sanitizeDataSet(d);
            const privateSet = sanitizeDataSet(d.private);

            const ok = confirm(
                "현재 데이터(일반 · 개인 모드 데이터 포함)가 백업 파일 내용으로 덮어써집니다.\n계속하시겠습니까?\n\n" +
                "[일반] " + describeDataSet(normalSet) +
                (privateSet ? "\n[개인] " + describeDataSet(privateSet) : "")
            );
            if (!ok) return;

            writeDataSet(false, normalSet);
            writeDataSet(true, privateSet);

            if (typeof d.pin === "string" && d.pin) {
                userPin = d.pin;
                localStorage.setItem(STORAGE_KEYS.PIN, d.pin);
                updatePinSettingsUI();
            }

            if (typeof d.city === "string" && CITY_DATA[d.city]) {
                currentCity = d.city;
                localStorage.setItem(STORAGE_KEY_CITY, currentCity);
                syncCityDropdown();
                loadWeather(currentCity);
            }

            renderMilestones();
            renderFootsteps();
            renderInfomaps();
            renderBookmarks();
            renderClips();
            renderContacts();
            renderWallets();
            scheduleAutoBackup();

            closeSettingsModal();
            alert("데이터를 성공적으로 가져왔습니다.");
        };

        reader.readAsText(file);
    }

    if (btnExportData) btnExportData.addEventListener("click", exportData);

    if (btnImportData && importFileInput) {
        btnImportData.addEventListener("click", () => importFileInput.click());
        importFileInput.addEventListener("change", () => {
            const file = importFileInput.files && importFileInput.files[0];
            if (file) importData(file);
            importFileInput.value = ""; // 같은 파일을 다시 선택할 수 있도록 초기화
        });
    }


    /* ========================================================
       6.6. 헤더 자물쇠: MILESTONES/FOOTSTEPS/INFOMAPS/BOOKMARKS/CLIPS 숨김 항목 전체 표시 · 숨김
    ======================================================== */
    const btnToggleAllSecrets = document.getElementById("btnToggleAllSecrets");
    const allSecretToggleIcon = document.getElementById("allSecretToggleIcon");

    function isAnySecretShown() {
        return showMilestoneSecrets || showInfomapSecrets || showFootstepSecrets || showBookmarkSecrets || showClipSecrets || showContactSecrets || showWalletSecrets;
    }

    function updateAllSecretToggleUI() {
        if (!btnToggleAllSecrets) return;
        const unlocked = isAnySecretShown();
        btnToggleAllSecrets.classList.toggle("active", unlocked);
        btnToggleAllSecrets.title = unlocked ? "숨김 항목 숨기기" : "숨김 항목 표시 (PIN 필요)";
        if (allSecretToggleIcon) allSecretToggleIcon.className = unlocked ? "icon unlock" : "icon lock";
    }

    // 세 영역의 숨김 상태를 한꺼번에 변경하고 화면 갱신
    function setAllSecrets(show) {
        showMilestoneSecrets = show;
        showInfomapSecrets = show;
        showFootstepSecrets = show;
        showBookmarkSecrets = show;
        showClipSecrets = show;
        showContactSecrets = show;
        showWalletSecrets = show;
        updateAllSecretToggleUI();
        renderMilestones();
        renderFootsteps();
        renderInfomaps();
        renderBookmarks();
        renderClips();
        renderContacts();
        renderWallets();
    }

    if (btnToggleAllSecrets) {
        btnToggleAllSecrets.addEventListener("click", () => {
            const unlocked = isAnySecretShown();
            if (unlocked) {
                setAllSecrets(false);
                return;
            }
            openModal({
                title: "숨김 항목 잠금 해제",
                fields: [
                    { id: "pin", label: "PIN 번호", type: "password", placeholder: pinPlaceholder(), required: true }
                ],
                onSubmit: (data) => {
                    if (data.pin === userPin) {
                        setAllSecrets(true);
                    } else {
                        alert("PIN 번호가 일치하지 않습니다.");
                    }
                }
            });
        });
    }


    /* ========================================================
       6.7. 헤더 반복 초기화: 반복 FOOTSTEP의 완료 상태를 모두 해제
    ======================================================== */
    const btnResetRoutines = document.getElementById("btnResetRoutines");

    if (btnResetRoutines) {
        btnResetRoutines.addEventListener("click", () => {
            const footsteps = getFootsteps();
            const routines = footsteps.filter(t => t.isRoutine);

            if (routines.length === 0) {
                alert("등록된 반복 FOOTSTEP이 없습니다.");
                return;
            }
            if (!confirm("반복 FOOTSTEP의 완료 상태를 모두 초기화하시겠습니까?")) return;

            routines.forEach(t => { t.completed = false; });
            saveFootsteps(footsteps);
        });
    }


    /* ========================================================
       6.8. BOOKMARKS (헤더 BOOKMARKS 아이콘 → 목록 모달 / 등록·수정·완료·숨김·삭제·드래그 정렬)
    ======================================================== */
    const btnOpenBookmarks = document.getElementById("btnOpenBookmarks");
    const bookmarkModal = document.getElementById("bookmarkModal");
    const btnCloseBookmarkModal = document.getElementById("btnCloseBookmarkModal");
    const bookmarkList = document.getElementById("bookmarkList");
    const bookmarkCount = document.getElementById("bookmarkCount");

    function getBookmarks() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) || [];
    }

    function saveBookmarks(bookmarks) {
        localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
        scheduleAutoBackup();
        renderBookmarks();
    }

    // URL 검증/보정: 스킴이 없으면 https:// 를 붙이고, http/https 외에는 허용하지 않는다
    function normalizeBookmarkUrl(raw) {
        let value = String(raw || "").trim();
        if (!value) return null;
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) value = "https://" + value;
        try {
            const parsed = new URL(value);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
            return value;
        } catch (e) {
            return null;
        }
    }

    function openBookmarkModal() {
        if (!bookmarkModal) return;
        renderBookmarks();
        bookmarkModal.style.display = "flex";
    }

    function closeBookmarkModal() {
        if (bookmarkModal) bookmarkModal.style.display = "none";
    }

    if (btnOpenBookmarks) btnOpenBookmarks.addEventListener("click", openBookmarkModal);
    if (btnCloseBookmarkModal) btnCloseBookmarkModal.addEventListener("click", closeBookmarkModal);

    // BOOKMARK 등록 모달
    function openAddBookmarkModal() {
        openModal({
            title: "새 BOOKMARK 등록",
            fields: [
                { id: "bmTitle", label: "BOOKMARK 제목", type: "text", placeholder: "BOOKMARK 제목...", required: true },
                { id: "bmUrl", label: "URL", type: "text", placeholder: "URL (예: https://example.com)", required: true },
                { id: "bmDesc", label: "설명", type: "textarea", placeholder: "BOOKMARK 설명(선택사항)...", required: false }
            ],
            onSubmit: (data) => {
                if (!data.bmTitle) return false;
                const url = normalizeBookmarkUrl(data.bmUrl);
                if (!url) {
                    alert("올바른 URL(http 또는 https)을 입력해주세요.");
                    return false;
                }

                const now = new Date();
                const dateStr = `${formatDateKey(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

                const bookmarks = getBookmarks();
                resetSearch("bookmarks");
                bookmarks.push({
                    id: "bm_" + Date.now(),
                    title: data.bmTitle,
                    url: url,
                    desc: data.bmDesc || "",
                    completed: false,
                    isSecret: false,
                    date: dateStr
                });
                saveBookmarks(bookmarks);
            }
        });
    }

    // BOOKMARK 수정 모달
    function editBookmark(bookmark) {
        openModal({
            title: "BOOKMARK 수정",
            fields: [
                { id: "bmTitle", label: "BOOKMARK 제목", type: "text", value: bookmark.title, required: true },
                { id: "bmUrl", label: "URL", type: "text", value: bookmark.url, required: true },
                { id: "bmDesc", label: "설명", type: "textarea", value: bookmark.desc || "", required: false }
            ],
            onSubmit: (data) => {
                if (!data.bmTitle) return false;
                const url = normalizeBookmarkUrl(data.bmUrl);
                if (!url) {
                    alert("올바른 URL(http 또는 https)을 입력해주세요.");
                    return false;
                }

                bookmark.title = data.bmTitle;
                bookmark.url = url;
                bookmark.desc = data.bmDesc || "";
                const bookmarks = getBookmarks();
                const idx = bookmarks.findIndex(b => b.id === bookmark.id);
                if (idx !== -1) {
                    bookmarks[idx] = bookmark;
                    saveBookmarks(bookmarks);
                }
            }
        });
    }

    // BOOKMARK 렌더링 (INFOMAP 카드와 동일한 완료/수정/숨김/삭제 지원)
    function renderBookmarks() {
        if (!bookmarkList) return;
        const bookmarks = getBookmarks();
        const visibleBookmarks = bookmarks.filter(b => showBookmarkSecrets || !b.isSecret);

        if (bookmarkCount) bookmarkCount.textContent = visibleBookmarks.length;

        bookmarkList.innerHTML = "";
        if (visibleBookmarks.length === 0) {
            appendListAddButton(bookmarkList, true, "새 BOOKMARK 등록", openAddBookmarkModal);
            return;
        }

        const filteredBookmarks = visibleBookmarks.filter(b => matchesSearch("bookmarks", b.title, b.url, b.desc));
        if (filteredBookmarks.length === 0) {
            appendSearchEmptyMessage(bookmarkList);
            appendListAddButton(bookmarkList, false, "새 BOOKMARK 등록", openAddBookmarkModal);
            return;
        }

        filteredBookmarks.forEach(bookmark => {
            const card = document.createElement("div");
            card.className = `entry-card ${bookmark.completed ? "completed" : ""} ${bookmark.isSecret ? "secret-card" : ""}`;

            const lockMark = bookmark.isSecret ? "🔒 " : "";

            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title ${bookmark.completed ? 'completed-title' : ''}">
                        ${lockMark}<a class="bookmark-link" draggable="false" href="${escapeHTML(bookmark.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(bookmark.url)}">${escapeHTML(bookmark.title)}</a>
                    </span>
                    <div class="item-actions">
                        <button type="button" class="btn-item-action btn-complete ${bookmark.completed ? 'is-completed' : ''}" title="${bookmark.completed ? '완료 취소' : '완료 처리'}">
                            <i class="icon check"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-edit" title="수정">
                            <i class="icon edit"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-secret ${bookmark.isSecret ? 'is-secret' : ''}" title="${bookmark.isSecret ? '숨김 해제' : '숨김 설정'}">
                            <i class="icon lock"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-delete" title="삭제">
                            <i class="icon trash"></i>
                        </button>
                    </div>
                </div>
                <div class="bookmark-url">${escapeHTML(bookmark.url)}</div>
                ${bookmark.desc ? `<div class="entry-body">${escapeHTML(bookmark.desc)}</div>` : ""}
                <div class="entry-date">${bookmark.date || ''}</div>
            `;

            // 완료 처리
            card.querySelector(".btn-complete").addEventListener("click", () => {
                bookmark.completed = !bookmark.completed;
                saveBookmarks(bookmarks);
            });

            // 수정 (버튼 / 카드 더블클릭, 제목 링크 더블클릭 제외)
            card.querySelector(".btn-edit").addEventListener("click", () => editBookmark(bookmark));
            card.addEventListener("dblclick", (e) => {
                if (!e.target.closest(".btn-item-action") && !e.target.closest(".bookmark-link")) editBookmark(bookmark);
            });

            // 숨김(자물쇠) 설정 / 해제
            card.querySelector(".btn-secret").addEventListener("click", () => {
                bookmark.isSecret = !bookmark.isSecret;
                saveBookmarks(bookmarks);
            });

            // 삭제
            card.querySelector(".btn-delete").addEventListener("click", () => {
                if (confirm("이 BOOKMARK를 삭제하시겠습니까?")) {
                    saveBookmarks(bookmarks.filter(b => b.id !== bookmark.id));
                }
            });

            // 드래그 앤 드롭 위치 변경 등록
            attachDragAndDrop({
                element: card,
                itemId: bookmark.id,
                type: "bookmarks",
                onReorder: (draggedId, targetId, position) => {
                    const fullList = getBookmarks();
                    const updated = reorderArray(fullList, draggedId, targetId, position);
                    saveBookmarks(updated);
                }
            });

            bookmarkList.appendChild(card);
        });

        appendListAddButton(bookmarkList, false, "새 BOOKMARK 등록", openAddBookmarkModal);
    }

    // BOOKMARK 리스트 하단 빈 영역 / + 버튼 위 드롭 처리 (맨 마지막으로 이동)
    setupContainerDrop(bookmarkList, "bookmarks", (draggedId) => {
        const fullList = getBookmarks();
        const visible = fullList.filter(b => showBookmarkSecrets || !b.isSecret);
        const updated = moveToLastVisible(fullList, visible, draggedId);
        saveBookmarks(updated);
    });


    /* ========================================================
       6.8-1. CONTACTS (헤더 연락처 아이콘 → 목록 모달 / 이름 · 연락처 · 설명 / 검색 · 수정 · 숨김 · 삭제 · 드래그 정렬)
    ======================================================== */
    const btnOpenContacts = document.getElementById("btnOpenContacts");
    const contactModal = document.getElementById("contactModal");
    const btnCloseContactModal = document.getElementById("btnCloseContactModal");
    const contactList = document.getElementById("contactList");
    const contactCount = document.getElementById("contactCount");

    function getContacts() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTACTS)) || [];
    }

    function saveContacts(contacts) {
        localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
        scheduleAutoBackup();
        renderContacts();
    }

    function openContactModal() {
        if (!contactModal) return;
        renderContacts();
        contactModal.style.display = "flex";
    }

    function closeContactModal() {
        if (contactModal) contactModal.style.display = "none";
    }

    if (btnOpenContacts) btnOpenContacts.addEventListener("click", openContactModal);
    if (btnCloseContactModal) btnCloseContactModal.addEventListener("click", closeContactModal);

    // CONTACT 등록 모달
    function openAddContactModal() {
        openModal({
            title: "새 CONTACT 등록",
            fields: [
                { id: "ctName", label: "이름", type: "text", placeholder: "이름...", required: true },
                { id: "ctPhone", label: "연락처", type: "text", placeholder: "연락처 (예: 010-1234-5678)", required: true },
                { id: "ctDesc", label: "설명", type: "textarea", placeholder: "설명(선택사항)...", required: false }
            ],
            onSubmit: (data) => {
                if (!data.ctName || !data.ctPhone) return false;

                const now = new Date();
                const dateStr = `${formatDateKey(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

                const contacts = getContacts();
                resetSearch("contacts");
                contacts.push({
                    id: "ct_" + Date.now(),
                    name: data.ctName,
                    phone: data.ctPhone,
                    desc: data.ctDesc || "",
                    completed: false,
                    isSecret: false,
                    date: dateStr
                });
                saveContacts(contacts);
            }
        });
    }

    // CONTACT 수정 모달
    function editContact(contact) {
        openModal({
            title: "CONTACT 수정",
            fields: [
                { id: "ctName", label: "이름", type: "text", value: contact.name, required: true },
                { id: "ctPhone", label: "연락처", type: "text", value: contact.phone, required: true },
                { id: "ctDesc", label: "설명", type: "textarea", value: contact.desc || "", required: false }
            ],
            onSubmit: (data) => {
                if (!data.ctName || !data.ctPhone) return false;

                contact.name = data.ctName;
                contact.phone = data.ctPhone;
                contact.desc = data.ctDesc || "";
                const contacts = getContacts();
                const idx = contacts.findIndex(ct => ct.id === contact.id);
                if (idx !== -1) {
                    contacts[idx] = contact;
                    saveContacts(contacts);
                }
            }
        });
    }

    // CONTACT 렌더링 (BOOKMARK 카드와 동일한 완료/수정/숨김/삭제/드래그 지원)
    function renderContacts() {
        if (!contactList) return;
        const contacts = getContacts();
        const visibleContacts = contacts.filter(ct => showContactSecrets || !ct.isSecret);

        if (contactCount) contactCount.textContent = visibleContacts.length;

        contactList.innerHTML = "";
        if (visibleContacts.length === 0) {
            appendListAddButton(contactList, true, "새 CONTACT 등록", openAddContactModal);
            return;
        }

        // 이름 검색 (연락처 · 설명도 함께 검색)
        const filteredContacts = visibleContacts.filter(ct => matchesSearch("contacts", ct.name, ct.phone, ct.desc));
        if (filteredContacts.length === 0) {
            appendSearchEmptyMessage(contactList);
            appendListAddButton(contactList, false, "새 CONTACT 등록", openAddContactModal);
            return;
        }

        filteredContacts.forEach(contact => {
            const card = document.createElement("div");
            card.className = `entry-card ${contact.completed ? "completed" : ""} ${contact.isSecret ? "secret-card" : ""}`;

            const lockMark = contact.isSecret ? "🔒 " : "";

            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title ${contact.completed ? 'completed-title' : ''}">${lockMark}${escapeHTML(contact.name)}</span>
                    <div class="item-actions">
                        <button type="button" class="btn-item-action btn-complete ${contact.completed ? 'is-completed' : ''}" title="${contact.completed ? '완료 취소' : '완료 처리'}">
                            <i class="icon check"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-edit" title="수정">
                            <i class="icon edit"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-secret ${contact.isSecret ? 'is-secret' : ''}" title="${contact.isSecret ? '숨김 해제' : '숨김 설정'}">
                            <i class="icon lock"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-delete" title="삭제">
                            <i class="icon trash"></i>
                        </button>
                    </div>
                </div>
                <div class="contact-phone">${escapeHTML(contact.phone)}</div>
                ${contact.desc ? `<div class="entry-body">${escapeHTML(contact.desc)}</div>` : ""}
                <div class="entry-date">${contact.date || ''}</div>
            `;

            // 완료 처리
            card.querySelector(".btn-complete").addEventListener("click", () => {
                contact.completed = !contact.completed;
                saveContacts(contacts);
            });

            // 수정 (버튼 / 카드 더블클릭)
            card.querySelector(".btn-edit").addEventListener("click", () => editContact(contact));
            card.addEventListener("dblclick", (e) => {
                if (!e.target.closest(".btn-item-action")) editContact(contact);
            });

            // 숨김(자물쇠) 설정 / 해제
            card.querySelector(".btn-secret").addEventListener("click", () => {
                contact.isSecret = !contact.isSecret;
                saveContacts(contacts);
            });

            // 삭제
            card.querySelector(".btn-delete").addEventListener("click", () => {
                if (confirm("이 CONTACT를 삭제하시겠습니까?")) {
                    saveContacts(contacts.filter(ct => ct.id !== contact.id));
                }
            });

            // 드래그 앤 드롭 위치 변경 등록
            attachDragAndDrop({
                element: card,
                itemId: contact.id,
                type: "contacts",
                onReorder: (draggedId, targetId, position) => {
                    const fullList = getContacts();
                    const updated = reorderArray(fullList, draggedId, targetId, position);
                    saveContacts(updated);
                }
            });

            contactList.appendChild(card);
        });

        appendListAddButton(contactList, false, "새 CONTACT 등록", openAddContactModal);
    }

    // CONTACT 리스트 하단 빈 영역 / + 버튼 위 드롭 처리 (맨 마지막으로 이동)
    setupContainerDrop(contactList, "contacts", (draggedId) => {
        const fullList = getContacts();
        const visible = fullList.filter(ct => showContactSecrets || !ct.isSecret);
        const updated = moveToLastVisible(fullList, visible, draggedId);
        saveContacts(updated);
    });


    /* ========================================================
       6.8-2. WALLETS (헤더 지갑 아이콘 → 목록 모달 / 이름 · 계좌번호 또는 코인 주소 · 설명 / 복사 · 검색 · 수정 · 숨김 · 삭제 · 드래그 정렬)
       - CONTACTS 와 같은 구조 + CLIPS 처럼 주소를 한 번에 복사하는 버튼
    ======================================================== */
    const btnOpenWallets = document.getElementById("btnOpenWallets");
    const walletModal = document.getElementById("walletModal");
    const btnCloseWalletModal = document.getElementById("btnCloseWalletModal");
    const walletList = document.getElementById("walletList");
    const walletCount = document.getElementById("walletCount");

    function getWallets() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.WALLETS)) || [];
    }

    function saveWallets(wallets) {
        localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));
        scheduleAutoBackup();
        renderWallets();
    }

    function openWalletModal() {
        if (!walletModal) return;
        renderWallets();
        walletModal.style.display = "flex";
    }

    function closeWalletModal() {
        if (walletModal) walletModal.style.display = "none";
    }

    if (btnOpenWallets) btnOpenWallets.addEventListener("click", openWalletModal);
    if (btnCloseWalletModal) btnCloseWalletModal.addEventListener("click", closeWalletModal);

    // WALLET 등록 모달
    function openAddWalletModal() {
        openModal({
            title: "새 WALLET 등록",
            fields: [
                { id: "wlName", label: "이름", type: "text", placeholder: "이름 (예: 국민은행, 비트코인)...", required: true },
                { id: "wlAddress", label: "계좌번호 / 코인 주소", type: "text", placeholder: "계좌번호 또는 코인 주소...", required: true },
                { id: "wlDesc", label: "설명", type: "textarea", placeholder: "설명(선택사항, 예: 네트워크·예금주·메모)...", required: false }
            ],
            onSubmit: (data) => {
                if (!data.wlName || !data.wlAddress) return false;

                const now = new Date();
                const dateStr = `${formatDateKey(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

                const wallets = getWallets();
                resetSearch("wallets");
                wallets.push({
                    id: "wl_" + Date.now(),
                    name: data.wlName,
                    address: data.wlAddress,
                    desc: data.wlDesc || "",
                    completed: false,
                    isSecret: false,
                    date: dateStr
                });
                saveWallets(wallets);
            }
        });
    }

    // WALLET 수정 모달
    function editWallet(wallet) {
        openModal({
            title: wallet.isSecret ? "숨김 WALLET 수정" : "WALLET 수정",
            fields: [
                { id: "wlName", label: "이름", type: "text", value: wallet.name, required: true },
                { id: "wlAddress", label: "계좌번호 / 코인 주소", type: "text", value: wallet.address, required: true },
                { id: "wlDesc", label: "설명", type: "textarea", value: wallet.desc || "", required: false }
            ],
            onSubmit: (data) => {
                if (!data.wlName || !data.wlAddress) return false;

                wallet.name = data.wlName;
                wallet.address = data.wlAddress;
                wallet.desc = data.wlDesc || "";
                const wallets = getWallets();
                const idx = wallets.findIndex(w => w.id === wallet.id);
                if (idx !== -1) {
                    wallets[idx] = wallet;
                    saveWallets(wallets);
                }
            }
        });
    }

    // WALLET 렌더링 (CONTACT 카드와 동일한 완료/수정/숨김/삭제/드래그 + 주소 복사)
    function renderWallets() {
        if (!walletList) return;
        const wallets = getWallets();
        const visibleWallets = wallets.filter(w => showWalletSecrets || !w.isSecret);

        if (walletCount) walletCount.textContent = visibleWallets.length;

        walletList.innerHTML = "";
        if (visibleWallets.length === 0) {
            appendListAddButton(walletList, true, "새 WALLET 등록", openAddWalletModal);
            return;
        }

        // 이름 검색 (주소 · 설명도 함께 검색)
        const filteredWallets = visibleWallets.filter(w => matchesSearch("wallets", w.name, w.address, w.desc));
        if (filteredWallets.length === 0) {
            appendSearchEmptyMessage(walletList);
            appendListAddButton(walletList, false, "새 WALLET 등록", openAddWalletModal);
            return;
        }

        filteredWallets.forEach(wallet => {
            const card = document.createElement("div");
            card.className = `entry-card ${wallet.completed ? "completed" : ""} ${wallet.isSecret ? "secret-card" : ""}`;

            const lockMark = wallet.isSecret ? "🔒 " : "";

            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title ${wallet.completed ? 'completed-title' : ''}">${lockMark}${escapeHTML(wallet.name)}</span>
                    <div class="clip-header-right">
                        <button type="button" class="btn-item-action btn-copy" title="주소 복사">
                            <i class="icon copy"></i>
                        </button>
                        <div class="item-actions">
                            <button type="button" class="btn-item-action btn-complete ${wallet.completed ? 'is-completed' : ''}" title="${wallet.completed ? '완료 취소' : '완료 처리'}">
                                <i class="icon check"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-edit" title="수정">
                                <i class="icon edit"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-secret ${wallet.isSecret ? 'is-secret' : ''}" title="${wallet.isSecret ? '숨김 해제' : '숨김 설정'}">
                                <i class="icon lock"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-delete" title="삭제">
                                <i class="icon trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="wallet-address">${escapeHTML(wallet.address)}</div>
                ${wallet.desc ? `<div class="entry-body">${escapeHTML(wallet.desc)}</div>` : ""}
                <div class="entry-date">${wallet.date || ''}</div>
            `;

            // 주소 복사: 성공하면 아이콘이 잠깐 체크 표시로 바뀐다
            const btnCopy = card.querySelector(".btn-copy");
            btnCopy.addEventListener("click", async () => {
                const copied = await copyTextToClipboard(wallet.address);
                if (!copied) {
                    alert("클립보드로 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
                    return;
                }
                const icon = btnCopy.querySelector(".icon");
                btnCopy.classList.add("is-copied");
                btnCopy.title = "복사됨!";
                if (icon) icon.className = "icon check";
                setTimeout(() => {
                    btnCopy.classList.remove("is-copied");
                    btnCopy.title = "주소 복사";
                    if (icon) icon.className = "icon copy";
                }, 1200);
            });

            // 완료 처리
            card.querySelector(".btn-complete").addEventListener("click", () => {
                wallet.completed = !wallet.completed;
                saveWallets(wallets);
            });

            // 수정 (버튼 / 카드 더블클릭)
            card.querySelector(".btn-edit").addEventListener("click", () => editWallet(wallet));
            card.addEventListener("dblclick", (e) => {
                if (!e.target.closest(".btn-item-action")) editWallet(wallet);
            });

            // 숨김(자물쇠) 설정 / 해제
            card.querySelector(".btn-secret").addEventListener("click", () => {
                wallet.isSecret = !wallet.isSecret;
                saveWallets(wallets);
            });

            // 삭제
            card.querySelector(".btn-delete").addEventListener("click", () => {
                if (confirm("이 WALLET을 삭제하시겠습니까?")) {
                    saveWallets(wallets.filter(w => w.id !== wallet.id));
                }
            });

            // 드래그 앤 드롭 위치 변경 등록
            attachDragAndDrop({
                element: card,
                itemId: wallet.id,
                type: "wallets",
                onReorder: (draggedId, targetId, position) => {
                    const fullList = getWallets();
                    const updated = reorderArray(fullList, draggedId, targetId, position);
                    saveWallets(updated);
                }
            });

            walletList.appendChild(card);
        });

        appendListAddButton(walletList, false, "새 WALLET 등록", openAddWalletModal);
    }

    // WALLET 리스트 하단 빈 영역 / + 버튼 위 드롭 처리 (맨 마지막으로 이동)
    setupContainerDrop(walletList, "wallets", (draggedId) => {
        const fullList = getWallets();
        const visible = fullList.filter(w => showWalletSecrets || !w.isSecret);
        const updated = moveToLastVisible(fullList, visible, draggedId);
        saveWallets(updated);
    });


    /* ========================================================
       6.9. 자동 내보내기 (헤더 백업 아이콘 / 설정의 폴더 지정)
       - 브라우저 보안상 경로 문자열로 직접 저장할 수 없어서, 폴더 선택 창(File System Access API)으로
         폴더를 한 번 지정해 두면 그 폴더에 autobackup.json 을 계속 덮어쓴다 (Chrome / Edge 지원)
       - 데이터가 바뀔 때마다 잠시 뒤(디바운스) 자동 저장한다
       - 새로고침 후에는 브라우저가 폴더 접근 권한을 다시 확인하므로, 필요하면 백업 아이콘을 눌러 승인한다
    ======================================================== */
    const AUTO_BACKUP_FILENAME = "autobackup.json";
    const AUTO_BACKUP_DB_NAME = "milestonestudio-autobackup";
    const LEGACY_AUTO_BACKUP_DB_NAME = "lifeos-autobackup"; // 이전 이름에서 쓰던 DB — 폴더 설정 이전용
    const AUTO_BACKUP_DEBOUNCE_MS = 1500;
    const AUTO_BACKUP_UNSUPPORTED_MSG =
        "이 브라우저는 폴더를 지정한 자동 내보내기를 지원하지 않습니다.\nChrome 또는 Edge(데스크톱)에서 사용해 주세요.";

    // Chromium Edge에서 시스템 파일이 포함된 폴더를 선택할 수 없는 경우를 위해
    // 파일 자체를 고르는 Save File Picker도 지원한다. 기존 디렉터리 핸들도 계속 읽는다.
    const isAutoBackupSupported =
        (typeof window.showDirectoryPicker === "function" || typeof window.showSaveFilePicker === "function") &&
        typeof indexedDB !== "undefined";

    const btnToggleAutoBackup = document.getElementById("btnToggleAutoBackup");
    const btnChooseBackupDir = document.getElementById("btnChooseBackupDir");
    const btnClearBackupDir = document.getElementById("btnClearBackupDir");
    const autoBackupPathText = document.getElementById("autoBackupPathText");
    const autoBackupStatus = document.getElementById("autoBackupStatus");

    // ── 폴더 핸들 보관용 IndexedDB (핸들은 localStorage에 저장할 수 없음)
    function backupDbRun(mode, run, dbName = AUTO_BACKUP_DB_NAME) {
        return new Promise((resolve, reject) => {
            const openReq = indexedDB.open(dbName, 1);
            openReq.onupgradeneeded = () => openReq.result.createObjectStore("handles");
            openReq.onerror = () => reject(openReq.error);
            openReq.onsuccess = () => {
                const db = openReq.result;
                const tx = db.transaction("handles", mode);
                const req = run(tx.objectStore("handles"));
                tx.oncomplete = () => { db.close(); resolve(req.result); };
                tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
            };
        });
    }
    const idbGetBackupDir = () => backupDbRun("readonly", store => store.get("dir"));
    const idbSetBackupDir = (handle) => backupDbRun("readwrite", store => store.put(handle, "dir"));
    const idbDeleteBackupDir = () => backupDbRun("readwrite", store => store.delete("dir"));

    async function queryBackupPermission(handle) {
        try { return await handle.queryPermission({ mode: "readwrite" }); } catch (e) { return "denied"; }
    }

    async function requestBackupPermission(handle) {
        try { return await handle.requestPermission({ mode: "readwrite" }); } catch (e) { return "denied"; }
    }

    function formatBackupClock(date) {
        return [date.getHours(), date.getMinutes(), date.getSeconds()]
            .map(n => String(n).padStart(2, "0")).join(":");
    }

    // 헤더 아이콘 / 설정 모달 표시 갱신
    function updateAutoBackupUI() {
        const hasDir = !!autoBackupDirHandle;
        let state = "off";
        if (autoBackupEnabled && hasDir) {
            state = autoBackupError ? "error" : (autoBackupNeedsPermission ? "permission" : "on");
        }

        let title = "자동 내보내기 꺼짐 (클릭하여 켜기)";
        let status = "";
        if (!isAutoBackupSupported) {
            title = "자동 내보내기 (이 브라우저에서는 지원되지 않음)";
            status = "이 브라우저는 폴더 지정 자동 내보내기를 지원하지 않습니다. Chrome 또는 Edge(데스크톱)를 사용해 주세요.";
        } else if (!hasDir) {
            title = "자동 내보내기 (먼저 폴더를 설정해야 합니다)";
            status = "파일 선택을 누르고 autobackup.json을 저장할 위치를 지정하세요. Edge에서 폴더 선택이 차단되면 파일 선택 방식으로 해당 경로를 지정할 수 있습니다. 보안상 전체 경로는 표시되지 않습니다.";
        } else if (state === "on") {
            const when = autoBackupLastTime ? ` · 마지막 백업 ${formatBackupClock(autoBackupLastTime)}` : "";
            title = `자동 내보내기 켜짐${when} (클릭하여 끄기)`;
            status = `켜짐${when} · '${autoBackupDirName}' 파일로 저장 중`;
        } else if (state === "permission") {
            title = "자동 내보내기: 폴더 접근 권한 재승인이 필요합니다 (클릭하여 승인)";
            status = "폴더 접근 권한 재승인이 필요합니다. 헤더의 백업 아이콘을 눌러 승인해 주세요.";
        } else if (state === "error") {
            title = `자동 내보내기 오류: ${autoBackupError} (클릭하여 다시 시도/끄기)`;
            status = `백업 실패: ${autoBackupError}`;
        } else {
            status = "자동 내보내기가 꺼져 있습니다. 헤더의 백업 아이콘을 눌러 켜세요.";
        }

        if (btnToggleAutoBackup) {
            btnToggleAutoBackup.classList.toggle("active", state === "on");
            btnToggleAutoBackup.classList.toggle("attention", state === "permission" || state === "error");
            btnToggleAutoBackup.title = title;
        }
        if (autoBackupPathText) {
            autoBackupPathText.textContent = autoBackupDirName || "설정되지 않음";
            autoBackupPathText.title = autoBackupDirName || "";
            autoBackupPathText.classList.toggle("has-path", !!autoBackupDirName);
        }
        if (autoBackupStatus) autoBackupStatus.textContent = status;
        if (btnChooseBackupDir) btnChooseBackupDir.disabled = !isAutoBackupSupported;
        if (btnClearBackupDir) btnClearBackupDir.disabled = !autoBackupDirHandle && !autoBackupDirName;
    }

    function setAutoBackupEnabled(enabled) {
        autoBackupEnabled = enabled;
        localStorage.setItem(STORAGE_KEYS.AUTO_BACKUP_ENABLED, enabled ? "1" : "0");
        if (!enabled) {
            clearTimeout(autoBackupTimer);
            autoBackupNeedsPermission = false;
            autoBackupError = "";
        }
        updateAutoBackupUI();
    }

    // 선택한 파일 또는 폴더에 autobackup.json을 저장한다.
    async function writeAutoBackup() {
        if (!autoBackupEnabled || !autoBackupDirHandle) return;
        if (autoBackupWriting) {
            autoBackupPending = true; // 저장 중 변경분은 끝난 뒤 한 번 더 저장
            return;
        }
        autoBackupWriting = true;
        try {
            const perm = await queryBackupPermission(autoBackupDirHandle);
            if (perm !== "granted") {
                autoBackupNeedsPermission = true;
                return;
            }
            const fileHandle = autoBackupDirHandle.kind === "file"
                ? autoBackupDirHandle
                : await autoBackupDirHandle.getFileHandle(AUTO_BACKUP_FILENAME, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(buildBackupPayload(new Date()), null, 2));
            await writable.close();
            autoBackupNeedsPermission = false;
            autoBackupError = "";
            autoBackupLastTime = new Date();
        } catch (e) {
            autoBackupError = (e && e.message) ? e.message : "알 수 없는 오류";
        } finally {
            autoBackupWriting = false;
            updateAutoBackupUI();
            if (autoBackupPending) {
                autoBackupPending = false;
                writeAutoBackup();
            }
        }
    }

    // 데이터 변경 시 호출 (디바운스)
    function scheduleAutoBackup() {
        if (!autoBackupEnabled || !autoBackupDirHandle) return;
        clearTimeout(autoBackupTimer);
        autoBackupTimer = setTimeout(writeAutoBackup, AUTO_BACKUP_DEBOUNCE_MS);
    }

    // 설정 모달: 파일 선택 (Edge의 보호 폴더 선택 제한 우회)
    async function chooseAutoBackupDir() {
        if (!isAutoBackupSupported) {
            alert(AUTO_BACKUP_UNSUPPORTED_MSG);
            return;
        }
        try {
            const handle = typeof window.showSaveFilePicker === "function"
                ? await window.showSaveFilePicker({
                    id: "milestonestudio-backup-file",
                    suggestedName: AUTO_BACKUP_FILENAME,
                    types: [{ description: "JSON 백업 파일", accept: { "application/json": [".json"] } }]
                })
                : await window.showDirectoryPicker({ id: "milestonestudio-backup", mode: "readwrite" });
            autoBackupDirHandle = handle;
            autoBackupDirName = handle.kind === "file"
                ? (handle.name || AUTO_BACKUP_FILENAME).replace(/\\.json$/i, "")
                : (handle.name || "");
            localStorage.setItem(STORAGE_KEYS.AUTO_BACKUP_DIRNAME, autoBackupDirName);
            autoBackupNeedsPermission = false;
            autoBackupError = "";
            try { await idbSetBackupDir(handle); } catch (e) { /* 저장 실패 시 이번 세션에서만 유지 */ }
            updateAutoBackupUI();
            if (autoBackupEnabled) writeAutoBackup();
        } catch (e) {
            if (!e || e.name !== "AbortError") {
                alert("폴더를 선택하지 못했습니다." + (e && e.message ? `\n${e.message}` : ""));
            }
        }
    }

    // 설정 모달: 폴더 설정 해제 (자동 내보내기도 함께 꺼짐, 이미 만들어진 autobackup.json 은 삭제하지 않음)
    async function clearAutoBackupDir() {
        if (!autoBackupDirHandle && !autoBackupDirName) return;
        if (!confirm("자동 내보내기 폴더 설정을 해제하고 자동 내보내기를 끄시겠습니까?")) return;
        autoBackupDirHandle = null;
        autoBackupDirName = "";
        localStorage.removeItem(STORAGE_KEYS.AUTO_BACKUP_DIRNAME);
        try { await idbDeleteBackupDir(); } catch (e) { }
        setAutoBackupEnabled(false);
    }

    if (btnChooseBackupDir) btnChooseBackupDir.addEventListener("click", chooseAutoBackupDir);
    if (btnClearBackupDir) btnClearBackupDir.addEventListener("click", clearAutoBackupDir);

    // 저장된 폴더 핸들 복원 및 켜져 있던 자동 내보내기 재개
    const autoBackupInitPromise = (async function initAutoBackup() {
        if (isAutoBackupSupported) {
            try {
                let handle = await idbGetBackupDir();

                // 이전 이름의 DB에 저장된 폴더 설정이 있으면 새 DB로 1회 이전
                if (!handle) {
                    try {
                        const legacyHandle = await backupDbRun("readonly", store => store.get("dir"), LEGACY_AUTO_BACKUP_DB_NAME);
                        if (legacyHandle && typeof legacyHandle.queryPermission === "function") {
                            handle = legacyHandle;
                            await idbSetBackupDir(legacyHandle);
                        }
                    } catch (e) { }
                    try { indexedDB.deleteDatabase(LEGACY_AUTO_BACKUP_DB_NAME); } catch (e) { }
                }

                if (handle && typeof handle.queryPermission === "function" &&
                    (handle.kind === "file" || handle.kind === "directory")) autoBackupDirHandle = handle;
            } catch (e) { }

            if (!autoBackupDirHandle) {
                autoBackupDirName = "";
                localStorage.removeItem(STORAGE_KEYS.AUTO_BACKUP_DIRNAME);
                if (autoBackupEnabled) {
                    autoBackupEnabled = false;
                    localStorage.setItem(STORAGE_KEYS.AUTO_BACKUP_ENABLED, "0");
                }
            } else if (autoBackupEnabled) {
                const perm = await queryBackupPermission(autoBackupDirHandle);
                if (perm === "granted") {
                    await writeAutoBackup(); // 시작 시 현재 상태를 한 번 저장
                } else {
                    autoBackupNeedsPermission = true; // 사용자가 아이콘을 눌러 재승인해야 함
                }
            }
        }
        updateAutoBackupUI();
    })();

    // 헤더 백업 아이콘 클릭
    if (btnToggleAutoBackup) {
        btnToggleAutoBackup.addEventListener("click", async () => {
            if (!isAutoBackupSupported) {
                alert(AUTO_BACKUP_UNSUPPORTED_MSG);
                return;
            }
            await autoBackupInitPromise;

            // 경로가 없으면 먼저 설정하도록 안내
            if (!autoBackupDirHandle) {
                alert("자동 내보내기 위치가 설정되지 않았습니다.\n설정 > 데이터 백업에서 '파일 위치 선택'으로 저장할 위치를 먼저 지정해 주세요.");
                openSettingsModal();
                return;
            }

            // 켜져 있지만 폴더 접근 권한 재승인이 필요한 상태: 권한을 다시 요청해 재개
            if (autoBackupEnabled && autoBackupNeedsPermission) {
                const perm = await requestBackupPermission(autoBackupDirHandle);
                if (perm === "granted") {
                    autoBackupNeedsPermission = false;
                    autoBackupError = "";
                    updateAutoBackupUI();
                    await writeAutoBackup();
                } else {
                    setAutoBackupEnabled(false);
                    alert("폴더 접근 권한이 거부되어 자동 내보내기를 껐습니다.");
                }
                return;
            }

            // 켜져 있으면 끄기
            if (autoBackupEnabled) {
                setAutoBackupEnabled(false);
                return;
            }

            // 켜기: 폴더 접근 권한 확인 후 즉시 한 번 저장
            let perm = await queryBackupPermission(autoBackupDirHandle);
            if (perm !== "granted") perm = await requestBackupPermission(autoBackupDirHandle);
            if (perm !== "granted") {
                alert("폴더 접근 권한이 필요합니다. 권한을 허용해 주세요.");
                return;
            }
            setAutoBackupEnabled(true);
            await writeAutoBackup();
        });
    }


    /* ========================================================
       6.10. CLIPS (헤더 CLIPS 아이콘 → 목록 모달 / 복사 · 검색 · 완료 · 수정 · 숨김 · 삭제 · 드래그)
    ======================================================== */
    const btnOpenClips = document.getElementById("btnOpenClips");
    const clipsModal = document.getElementById("clipsModal");
    const btnCloseClipsModal = document.getElementById("btnCloseClipsModal");
    const clipList = document.getElementById("clipList");
    const clipCount = document.getElementById("clipCount");

    function getClips() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIPS)) || [];
    }

    function saveClips(clips) {
        localStorage.setItem(STORAGE_KEYS.CLIPS, JSON.stringify(clips));
        scheduleAutoBackup();
        renderClips();
    }

    // 텍스트를 시스템 클립보드로 복사 (보안 컨텍스트가 아니면 execCommand 방식으로 대체)
    async function copyTextToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) { /* 아래 대체 방식으로 진행 */ }

        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.top = "0";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, text.length);
            const ok = document.execCommand("copy");
            ta.remove();
            return !!ok;
        } catch (e) {
            return false;
        }
    }

    function openClipsModal() {
        if (!clipsModal) return;
        renderClips();
        clipsModal.style.display = "flex";
    }

    function closeClipsModal() {
        if (clipsModal) clipsModal.style.display = "none";
    }

    if (btnOpenClips) btnOpenClips.addEventListener("click", openClipsModal);
    if (btnCloseClipsModal) btnCloseClipsModal.addEventListener("click", closeClipsModal);

    // CLIP 등록 모달
    function openAddClipModal() {
        openModal({
            title: "새 CLIP 등록",
            fields: [
                { id: "clipTitle", label: "제목", type: "text", placeholder: "제목 (예: 이메일 서명, 계좌번호)...", required: true },
                { id: "clipContent", label: "복사할 텍스트", type: "textarea", placeholder: "복사해서 사용할 텍스트를 입력하세요...", required: true }
            ],
            onSubmit: (data) => {
                if (!data.clipTitle || !data.clipContent) return false;

                const now = new Date();
                const dateStr = `${formatDateKey(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

                resetSearch("clips");
                const clips = getClips();
                clips.push({
                    id: "cb_" + Date.now(),
                    title: data.clipTitle,
                    content: data.clipContent,
                    completed: false,
                    isSecret: false,
                    date: dateStr
                });
                saveClips(clips);
            }
        });
    }

    // CLIP 수정 모달
    function editClip(clip) {
        openModal({
            title: "CLIP 수정",
            fields: [
                { id: "clipTitle", label: "제목", type: "text", value: clip.title, required: true },
                { id: "clipContent", label: "복사할 텍스트", type: "textarea", value: clip.content, required: true }
            ],
            onSubmit: (data) => {
                if (!data.clipTitle || !data.clipContent) return false;
                clip.title = data.clipTitle;
                clip.content = data.clipContent;
                const clips = getClips();
                const idx = clips.findIndex(cl => cl.id === clip.id);
                if (idx !== -1) {
                    clips[idx] = clip;
                    saveClips(clips);
                }
            }
        });
    }

    // CLIP 렌더링 (INFOMAP 카드와 동일한 완료/수정/숨김/삭제/드래그 + 복사)
    function renderClips() {
        if (!clipList) return;
        const clips = getClips();
        const visibleClips = clips.filter(cl => showClipSecrets || !cl.isSecret);

        if (clipCount) clipCount.textContent = visibleClips.length;

        clipList.innerHTML = "";
        if (visibleClips.length === 0) {
            appendListAddButton(clipList, true, "새 CLIP 등록", openAddClipModal);
            return;
        }

        const filteredClips = visibleClips.filter(cl => matchesSearch("clips", cl.title, cl.content));
        if (filteredClips.length === 0) {
            appendSearchEmptyMessage(clipList);
            appendListAddButton(clipList, false, "새 CLIP 등록", openAddClipModal);
            return;
        }

        filteredClips.forEach(clip => {
            const card = document.createElement("div");
            card.className = `entry-card ${clip.completed ? "completed" : ""} ${clip.isSecret ? "secret-card" : ""}`;

            const titleDisplay = clip.isSecret ? `🔒 ${escapeHTML(clip.title)}` : escapeHTML(clip.title);

            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title ${clip.completed ? 'completed-title' : ''}">${titleDisplay}</span>
                    <div class="clip-header-right">
                        <button type="button" class="btn-item-action btn-copy" title="텍스트 복사">
                            <i class="icon copy"></i>
                        </button>
                        <div class="item-actions">
                            <button type="button" class="btn-item-action btn-complete ${clip.completed ? 'is-completed' : ''}" title="${clip.completed ? '완료 취소' : '완료 처리'}">
                                <i class="icon check"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-edit" title="수정">
                                <i class="icon edit"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-secret ${clip.isSecret ? 'is-secret' : ''}" title="${clip.isSecret ? '숨김 해제' : '숨김 설정'}">
                                <i class="icon lock"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-delete" title="삭제">
                                <i class="icon trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="entry-body clip-content">${escapeHTML(clip.content)}</div>
                <div class="entry-date">${clip.date || ''}</div>
            `;

            // 복사: 성공하면 아이콘이 잠깐 체크 표시로 바뀐다
            const btnCopy = card.querySelector(".btn-copy");
            btnCopy.addEventListener("click", async () => {
                const copied = await copyTextToClipboard(clip.content);
                if (!copied) {
                    alert("클립보드로 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.");
                    return;
                }
                const icon = btnCopy.querySelector(".icon");
                btnCopy.classList.add("is-copied");
                btnCopy.title = "복사됨!";
                if (icon) icon.className = "icon check";
                setTimeout(() => {
                    btnCopy.classList.remove("is-copied");
                    btnCopy.title = "텍스트 복사";
                    if (icon) icon.className = "icon copy";
                }, 1200);
            });

            // 완료 처리
            card.querySelector(".btn-complete").addEventListener("click", () => {
                clip.completed = !clip.completed;
                saveClips(clips);
            });

            // 수정 (버튼 / 카드 더블클릭)
            card.querySelector(".btn-edit").addEventListener("click", () => editClip(clip));
            card.addEventListener("dblclick", (e) => {
                if (!e.target.closest(".btn-item-action")) editClip(clip);
            });

            // 숨김(자물쇠) 설정 / 해제
            card.querySelector(".btn-secret").addEventListener("click", () => {
                clip.isSecret = !clip.isSecret;
                saveClips(clips);
            });

            // 삭제
            card.querySelector(".btn-delete").addEventListener("click", () => {
                if (confirm("이 CLIP을 삭제하시겠습니까?")) {
                    saveClips(clips.filter(cl => cl.id !== clip.id));
                }
            });

            // 드래그 앤 드롭 위치 변경 등록
            attachDragAndDrop({
                element: card,
                itemId: clip.id,
                type: "clips",
                onReorder: (draggedId, targetId, position) => {
                    const fullList = getClips();
                    const updated = reorderArray(fullList, draggedId, targetId, position);
                    saveClips(updated);
                }
            });

            clipList.appendChild(card);
        });

        appendListAddButton(clipList, false, "새 CLIP 등록", openAddClipModal);
    }

    // CLIP 리스트 하단 빈 영역 / + 버튼 위 드롭 처리 (맨 마지막으로 이동)
    setupContainerDrop(clipList, "clips", (draggedId) => {
        const fullList = getClips();
        const visible = fullList.filter(cl => showClipSecrets || !cl.isSecret);
        const updated = moveToLastVisible(fullList, visible, draggedId);
        saveClips(updated);
    });


    /* ========================================================
       7. 유틸리티 함수
    ======================================================== */
    // 리스트 맨 마지막에 + 추가 버튼을 붙인다 (데이터가 없으면 중앙 배치)
    function appendListAddButton(listEl, isEmpty, title, onClick) {
        listEl.classList.toggle("is-empty", isEmpty);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-list-add";
        btn.title = title;
        btn.setAttribute("aria-label", title);
        btn.innerHTML = `<i class="icon plus"></i>`;
        btn.addEventListener("click", onClick);
        listEl.appendChild(btn);
    }

    function formatDateKey(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function escapeHTML(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ========================================================
       7.5. 개인(프라이빗) 모드 토글 (사람 아이콘)
       - 꺼짐(기본): 일반 데이터 / 켜짐: 개인 데이터 (키 접두사 milestonestudio_private_)
       - 개인 모드 데이터는 처음엔 비어 있음(샘플 데이터 없음), 설정은 공통
    ======================================================== */
    const btnTogglePrivate = document.getElementById("btnTogglePrivate");
    const privateBadge = document.getElementById("privateBadge");

    function updatePrivateModeUI() {
        document.documentElement.setAttribute("data-private", isPrivateMode ? "1" : "0");
        if (privateBadge) privateBadge.hidden = !isPrivateMode;
        if (btnTogglePrivate) {
            btnTogglePrivate.classList.toggle("active", isPrivateMode);
            btnTogglePrivate.setAttribute("aria-pressed", isPrivateMode ? "true" : "false");
            btnTogglePrivate.title = isPrivateMode
                ? "개인 모드 켜짐 (클릭하여 끄기)"
                : "개인 모드 꺼짐 (클릭하여 켜기)";
        }
    }

    function setPrivateMode(on) {
        isPrivateMode = !!on;
        // 검색어 초기화 (이전 모드의 검색 결과가 남지 않도록)
        Object.keys(searchQueries).forEach(resetSearch);

        updatePrivateModeUI();

        // 숨김 항목 표시도 해제하고 5개 영역을 현재 모드의 데이터로 다시 그림
        setAllSecrets(false);
    }

    if (btnTogglePrivate) {
        btnTogglePrivate.addEventListener("click", () => setPrivateMode(!isPrivateMode));
    }

    updatePrivateModeUI();


    /* ========================================================
       7.6. 목록 최상단 / 최하단 이동 버튼
       - 물음표 도움말 아이콘 옆의 화살표 버튼 (data-scroll-target = 스크롤되는 목록 id, data-scroll-dir = top | bottom)
       - 목록은 렌더링 때마다 내용이 바뀌므로 클릭하는 순간의 scrollHeight 로 맨 아래를 계산한다
    ======================================================== */
    document.querySelectorAll(".btn-scroll-nav").forEach((btn) => {
        btn.addEventListener("click", () => {
            const list = document.getElementById(btn.dataset.scrollTarget);
            if (!list) return;
            const toTop = btn.dataset.scrollDir === "top";
            const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            list.scrollTo({
                top: toTop ? 0 : list.scrollHeight,
                behavior: reduceMotion ? "auto" : "smooth"
            });
        });
    });

    // 화살표 옆 + 버튼: 목록 맨 아래의 + 버튼과 똑같은 추가 모달을 연다
    const addModalOpeners = {
        milestone: openAddMilestoneModal,
        footstep: openAddFootstepModal,
        infomap: openAddInfomapModal,
        bookmark: openAddBookmarkModal,
        clip: openAddClipModal,
        contact: openAddContactModal,
        wallet: openAddWalletModal
    };

    document.querySelectorAll(".btn-scroll-add").forEach((btn) => {
        btn.addEventListener("click", () => {
            const openAddModal = addModalOpeners[btn.dataset.addType];
            if (openAddModal) openAddModal();
        });
    });


    /* ========================================================
       8. 최초 렌더링 호출
    ======================================================== */
    renderMilestones();
    renderFootsteps();
    renderInfomaps();
    renderBookmarks();
    renderClips();
    renderContacts();
    renderWallets();

});
