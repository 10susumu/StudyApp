const STORAGE_KEY = 'studyapp_state';

const CONFIG = {
    Q_DATA: './data/questions.json',
    E_DATA: './data/explanations.json',
    IMAGE_API: 'https://study-image-api.s-i-19921029.workers.dev/image/'
};

let appPassword = null;

let state = {
    questions: [],
    explanations: [],
    currentList: [],
    currentIndex: 0,
    results: {},
    mode: 'normal',
    lastViewedQuestionId: null
};

const dom = {
    qText: document.getElementById('question-text'),
    choices: document.getElementById('choices-container'),
    exp: document.getElementById('explanation-container'),
    form: document.getElementById('answer-form'),
    validMsg: document.getElementById('validation-msg'),
    scoreC: document.getElementById('correct-count'),
    scoreW: document.getElementById('wrong-count'),
    scoreP: document.getElementById('score-percent'),
    resumeBtn: document.getElementById('resume-btn'),
    currentIdx: document.getElementById('current-idx'),
    totalIdx: document.getElementById('total-idx'),
    qNumber: null,
    imageContainer: document.getElementById('image-container')
};

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: state.mode,
        results: state.results,
        currentIndex: state.currentIndex,
        lastViewedQuestionId: state.lastViewedQuestionId ?? null
    }));
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const saved = JSON.parse(raw);
        state.mode = saved.mode || 'normal';
        state.results = saved.results || {};
        state.currentIndex = saved.currentIndex || 0;
        state.lastViewedQuestionId = saved.lastViewedQuestionId ?? null;
    } catch {}
}

function setupAuth() {
    const btn = document.getElementById("auth-btn");
    const status = document.getElementById("auth-status");

    btn.onclick = () => {
        const pass = document.getElementById("auth-password").value;
        if (!pass) return;
        appPassword = pass;
        status.textContent = "認証済";
    };
}

async function init() {
    setupAuth();

    const [qRes, eRes] = await Promise.all([
        fetch(CONFIG.Q_DATA),
        fetch(CONFIG.E_DATA)
    ]);

    state.questions = await qRes.json();
    state.explanations = await eRes.json();

    setupModeButtons();
    setupNavButtons();

    loadState();
    buildCurrentList();

    if (state.currentIndex >= state.currentList.length) {
        state.currentIndex = 0;
    }

    updateResumeButton();
    await render();
}

function setupModeButtons() {
    const nm = document.getElementById('normal-mode-btn');
    const wm = document.getElementById('wrong-only-btn');
    const sm = document.getElementById('shuffle-mode-btn');

    function activate(btn, text, mode) {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('mode-indicator').textContent = text;
        state.mode = mode;
        buildCurrentList();
        state.currentIndex = 0;
        saveState();
        updateResumeButton();
        render();
    }

    nm.onclick = () => activate(nm, '現在のモード：通常', 'normal');
    wm.onclick = () => activate(wm, '現在のモード：不正解のみ', 'wrong');
    sm.onclick = () => activate(sm, '現在のモード：ランダム', 'shuffle');

    dom.resumeBtn.onclick = () => {
        if (!state.lastViewedQuestionId) return;
        state.mode = 'normal';
        buildCurrentList();
        const idx = state.currentList.findIndex(
            q => q.question_id === state.lastViewedQuestionId
        );
        if (idx !== -1) {
            state.currentIndex = idx;
            render();
        }
    };
}

function updateResumeButton() {
    dom.resumeBtn.disabled = state.lastViewedQuestionId == null;
}

function setupNavButtons() {
    ['prev-btn', 'prev-btn-top'].forEach(id => {
        document.getElementById(id).onclick = async () => {
            if (state.currentIndex > 0) {
                state.currentIndex--;
                saveState();
                await render();
            }
        };
    });

    ['next-btn', 'next-btn-top'].forEach(id => {
        document.getElementById(id).onclick = async () => {
            if (state.currentIndex < state.currentList.length - 1) {
                state.currentIndex++;
                saveState();
                await render();
            }
        };
    });
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildCurrentList() {
    let base = state.mode === 'wrong'
        ? state.questions.filter(q => state.results[q.question_id] === false)
        : state.questions;

    state.currentList = state.mode === 'shuffle'
        ? shuffleArray(base)
        : [...base];
}

async function render() {
    const list = state.currentList;

    if (!list.length) {
        dom.qText.textContent = '出題できる問題がありません';
        return;
    }

    const q = list[state.currentIndex];

    if (q.question_image) {
        if (!appPassword) {
            dom.imageContainer.innerHTML = "パスワード認証が必要です";
            dom.qText.style.display = 'none';
        } else {
            const imageId = q.question_image.replace('.jpg','');

            const res = await fetch(
                CONFIG.IMAGE_API + imageId,
                { headers: { "X-Auth-Password": appPassword } }
            );

            if (!res.ok) {
                dom.imageContainer.innerHTML = "画像取得失敗";
            } else {
                const blob = await res.blob();
                const imgUrl = URL.createObjectURL(blob);
                dom.imageContainer.innerHTML = '';
                const img = document.createElement('img');
                img.src = imgUrl;
                img.className = 'question-img';
                dom.imageContainer.appendChild(img);
            }
            dom.qText.style.display = 'none';
        }
    } else {
        dom.imageContainer.innerHTML = '';
        dom.qText.style.display = 'block';
        dom.qText.textContent = q.question_text;
    }

    dom.currentIdx.textContent = state.currentIndex + 1;
    dom.totalIdx.textContent = list.length + " ";
}

init();
