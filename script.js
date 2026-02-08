// ===============================
// script.js（最終修正版）
// ===============================
const STORAGE_KEY = 'studyapp_state';

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: state.mode,
        results: state.results,
        currentIndex: state.currentIndex
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
    } catch {
        console.warn('保存データの読み込みに失敗');
    }
}

const CONFIG = {
    Q_DATA: './data/questions.json',
    E_DATA: './data/explanations.json'
};

let state = {
    questions: [],
    explanations: [],
    currentList: [],
    currentIndex: 0,
    results: {},
    mode: 'normal'
};

// DOM
const dom = {
    qText: document.getElementById('question-text'),
    choices: document.getElementById('choices-container'),
    exp: document.getElementById('explanation-container'),
    form: document.getElementById('answer-form'),
    validMsg: document.getElementById('validation-msg'),
    scoreC: document.getElementById('correct-count'),
    scoreW: document.getElementById('wrong-count'),
    scoreP: document.getElementById('score-percent'),

    // ★追加
    qNumber: null
};


// ========================
// init
// ========================
async function init() {
    const [qRes, eRes] = await Promise.all([
        fetch(CONFIG.Q_DATA),
        fetch(CONFIG.E_DATA)
    ]);
    state.questions = await qRes.json();
    state.explanations = await eRes.json();


    setupModeButtons();
    setupNavButtons();

    loadState();          // ★追加
    buildCurrentList();

    // indexが範囲外にならないよう補正
    if (state.currentIndex >= state.currentList.length) {
        state.currentIndex = 0;
    }

    render();

}

// ========================
// モード UI
// ========================
function setupModeButtons() {
    const nm = document.getElementById('normal-mode-btn');
    const rm = document.getElementById('resume-btn');
    const wm = document.getElementById('wrong-only-btn');
    const sm = document.getElementById('shuffle-mode-btn');
    const mi = document.getElementById('mode-indicator');

    function activate(btn, text, mode) {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('mode-indicator').textContent = text;

        state.mode = mode;
        buildCurrentList();
        state.currentIndex = 0;

        saveState();   // ★追加
        render();
    }


    nm.onclick = () => activate(nm, '現在のモード：通常', 'normal');
    rm.onclick = () => activate(rm, '現在のモード：前回から再開', 'resume');
    wm.onclick = () => activate(wm, '現在のモード：不正解のみ', 'wrong');
    sm.onclick = () => activate(sm, '現在のモード：ランダム', 'shuffle');
}

// ========================
// ナビ
// ========================
function setupNavButtons() {
    ['prev-btn', 'prev-btn-top'].forEach(id => {
        document.getElementById(id).onclick = () => {
            if (state.currentIndex > 0) {
                state.currentIndex--;
                saveState();
                render();
            }
        };
    });
    ['next-btn', 'next-btn-top'].forEach(id => {
        document.getElementById(id).onclick = () => {
            if (state.currentIndex < state.currentList.length - 1) {
                state.currentIndex++;
                saveState();
                render();
            }
        };
    });
}

// ========================
// 出題リスト
// ========================
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

    state.currentIndex = 0;
}

// ========================
// render
// ========================
function render() {
    const list = state.currentList;

    // 問題番号DOM生成（初回のみ）
    if (!dom.qNumber) {
        dom.qNumber = document.createElement('div');
        dom.qNumber.id = 'question-number';
        dom.qNumber.className = 'question-number';
        dom.qText.parentNode.insertBefore(dom.qNumber, dom.qText);
    }

    dom.form.reset();
    dom.choices.innerHTML = '';
    dom.exp.classList.add('hidden');
    dom.validMsg.classList.add('hidden');

    if (!list.length) {
        dom.qText.textContent = '出題できる問題がありません';
        dom.qNumber.style.display = 'none';
        return;
    }

    const q = list[state.currentIndex];

    // ★全モード共通で問題番号表示
    dom.qNumber.textContent = `問題ID：${q.question_id}`;
    dom.qNumber.style.display = 'block';

    const hint = q.answer_type === 'multiple'
        ? ` (${q.answer_count}つ選択)`
        : '';

    dom.qText.textContent = q.question_text + hint;

    q.choices.forEach(c => {
        const type = q.answer_type === 'single' ? 'radio' : 'checkbox';
        const label = document.createElement('label');
        label.className = 'choice-item';
        label.innerHTML =
            `<input type="${type}" name="ans" value="${c.label}">
       ${c.label}: ${c.text}`;
        dom.choices.appendChild(label);
    });

    document.getElementById('current-idx').textContent = state.currentIndex + 1;
    document.getElementById('total-idx').textContent = list.length;

    ['prev-btn', 'prev-btn-top'].forEach(id =>
        document.getElementById(id).disabled = state.currentIndex === 0
    );
    ['next-btn', 'next-btn-top'].forEach(id =>
        document.getElementById(id).disabled = state.currentIndex >= list.length - 1
    );

    updateScore();
}


// ========================
// 回答処理
// ========================
dom.form.onsubmit = e => {
    e.preventDefault();

    const selected = Array.from(new FormData(dom.form).getAll('ans'));
    if (!selected.length) {
        dom.validMsg.classList.remove('hidden');
        return;
    }

    const q = state.currentList[state.currentIndex];
    const ex = state.explanations.find(e => e.question_id === q.question_id);
    const correct = ex.correct_answers.sort();
    const isCorrect = JSON.stringify(selected.sort()) === JSON.stringify(correct);

    state.results[q.question_id] = isCorrect;
    saveState();   // ★追加

    document.querySelectorAll('.choice-item').forEach(l => {
        const v = l.querySelector('input').value;
        if (!isCorrect && correct.includes(v)) {
            l.classList.add('correct-highlight');
        }
    });

    dom.exp.classList.remove('hidden');
    dom.exp.className = isCorrect ? 'correct-ui' : 'wrong-ui';
    document.getElementById('result-badge').textContent = isCorrect ? '✓ 正解' : '× 不正解';
    document.getElementById('correct-answer-text').textContent = correct.join(', ');
    document.getElementById('explanation-text').textContent = ex.explanation_text;

    updateScore();
};

// ========================
// スコア
// ========================
function updateScore() {
    const v = Object.values(state.results);
    dom.scoreC.textContent = v.filter(x => x).length;
    dom.scoreW.textContent = v.filter(x => !x).length;
    dom.scoreP.textContent = state.questions.length
        ? Math.round((v.filter(x => x).length / state.questions.length) * 100)
        : 0;
}

init();
