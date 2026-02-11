const STORAGE_KEY = 'studyapp_state';

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
    } catch {
        console.warn('保存データの読み込みに失敗');
    }
}

const CONFIG = {
    Q_DATA: './data/questions.json',
    E_DATA: './data/explanations.json',
    IMAGE_DATA: './assets/',
};

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
    qNumber: null
};

async function init() {
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
    render();
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

    // ★ 前回から再開
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

function render() {
    const list = state.currentList;

    if (!dom.qNumber) {
        dom.qNumber = document.createElement('div');
        dom.qNumber.className = 'question-number';
        dom.qText.before(dom.qNumber);
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

    // ★ 通常モードのみ履歴保存
    if (state.mode === 'normal') {
        state.lastViewedQuestionId = q.question_id;
        saveState();
        updateResumeButton();
    }

    dom.qNumber.textContent = `問題ID：${q.question_id}`;

    // ★ 問題画像表示処理
    if (q.question_image) {
        const imgPath = CONFIG.IMAGE_DATA + q.question_image;

        dom.imageContainer = document.getElementById('image-container');
    dom.imageContainer.innerHTML = '';

    const img = document.createElement('img');
    img.src = imgPath;
    img.alt = '問題画像';
    img.className = 'question-img';

    // ★ 画像読み込み失敗時
    img.onerror = () => {
        dom.imageContainer.style.display = 'none';
        dom.qText.style.display = 'block';
        dom.qText.textContent = q.question_text;
    };

    dom.qText.style.display = 'none';
    dom.imageContainer.appendChild(img);
        dom.imageContainer.style.display = 'block';

    } else {
        dom.imageContainer = document.getElementById('image-container');
        dom.imageContainer.innerHTML = '';
        dom.imageContainer.style.display = 'none';
        dom.qText.style.display = 'block';
        dom.qText.textContent = q.question_text;
    }

    // ★ answer_type に応じて input type 切替
    const inputType = q.answer_type === 'multiple' ? 'checkbox' : 'radio';

    q.choices.forEach(c => {
        const label = document.createElement('label');
        label.className = 'choice-item';

        const input = document.createElement('input');
        input.type = inputType;
        input.name = 'ans';
        input.value = c.label;

        label.appendChild(input);

        // ★ ここを textContent に変更
        label.appendChild(
            document.createTextNode(` ${c.label}: ${c.text}`)
        );

        dom.choices.appendChild(label);
    });

    document.getElementById('current-idx').textContent = state.currentIndex + 1;
    document.getElementById('total-idx').textContent = list.length;
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
