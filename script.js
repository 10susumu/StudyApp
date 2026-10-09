const WORKER_BASE_URL = 'https://study-image-api.s-i-19921029.workers.dev';

const CONFIG = {
    DATASETS: {
        "enshu1": {
            Q_DATA: `${WORKER_BASE_URL}/data/enshu1/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/enshu1/explanations`
        },
        "enshu2": {
            Q_DATA: `${WORKER_BASE_URL}/data/enshu2/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/enshu2/explanations`
        },
        "enshu3": {
            Q_DATA: `${WORKER_BASE_URL}/data/enshu3/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/enshu3/explanations`
        },
        "mogi1": {
            Q_DATA: `${WORKER_BASE_URL}/data/mogi1/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/mogi1/explanations`
        },
        "mogi2": {
            Q_DATA: `${WORKER_BASE_URL}/data/mogi2/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/mogi2/explanations`
        },
        "renshu1": {
            Q_DATA: `${WORKER_BASE_URL}/data/renshu1/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/renshu1/explanations`
        },
        "renshu2": {
            Q_DATA: `${WORKER_BASE_URL}/data/renshu2/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/renshu2/explanations`
        },
        "renshu3": {
            Q_DATA: `${WORKER_BASE_URL}/data/renshu3/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/renshu3/explanations`
        },
        "renshu4": {
            Q_DATA: `${WORKER_BASE_URL}/data/renshu4/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/renshu4/explanations`
        },
        "renshu5": {
            Q_DATA: `${WORKER_BASE_URL}/data/renshu5/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/renshu5/explanations`
        },
        "renshu6": {
            Q_DATA: `${WORKER_BASE_URL}/data/renshu6/questions`,
            E_DATA: `${WORKER_BASE_URL}/data/renshu6/explanations`
        }
    },
    IMAGE_API: `${WORKER_BASE_URL}/assets/image/`
};


let appPassword = null;
const SAVE_DEBOUNCE_MS = 1000;
const SAVE_RETRY_DELAY_MS = 5000;
let saveRemoteStateTimer = null;
let saveRemoteStatePending = false;
let saveRemoteStateInProgress = false;
let saveRemoteStateKeepalivePending = false;
let lastSavedRemoteState = null;

let state = {
    questions: [],
    explanations: [],
    currentList: [],
    currentIndex: 0,
    resultsByDataset: {},
    mode: 'normal',
    lastViewedQuestionIdByDataset: {},
    lastViewedQuestionId: null,
    dataset: "enshu2"   // ★追加
};


const dom = {
    qNumber: null,
    qText: document.getElementById('question-text'),
    choices: document.getElementById('choices-container'),
    exp: document.getElementById('explanation-container'),
    form: document.getElementById('answer-form'),
    validMsg: document.getElementById('validation-msg'),
    scoreC: document.getElementById('correct-count'),
    scoreW: document.getElementById('wrong-count'),
    scoreP: document.getElementById('score-percent'),
    currentIdx: document.getElementById('current-idx'),
    totalIdx: document.getElementById('total-idx'),
    imageContainer: document.getElementById('image-container'),
    pageSelect: document.getElementById('page-select')
};

function normalizeResult(value) {
    if (value == null) {
        return { attempts: 0, wrongs: 0, lastResult: null };
    }

    if (typeof value === 'boolean') {
        return {
            attempts: 1,
            wrongs: value ? 0 : 1,
            lastResult: value
        };
    }

    return {
        attempts: Number(value.attempts) || 0,
        wrongs: Number(value.wrongs) || 0,
        lastResult: typeof value.lastResult === 'boolean' ? value.lastResult : null
    };
}

function getCurrentResults() {
    if (!state.resultsByDataset[state.dataset]) {
        state.resultsByDataset[state.dataset] = {};
    }
    return state.resultsByDataset[state.dataset];
}

function getQuestionStats(questionId) {
    return normalizeResult(getCurrentResults()[questionId]);
}

function setQuestionResult(questionId, isCorrect) {
    const results = getCurrentResults();
    const prev = normalizeResult(results[questionId]);
    const next = {
        attempts: prev.attempts + 1,
        wrongs: prev.wrongs + (isCorrect ? 0 : 1),
        lastResult: isCorrect
    };

    results[questionId] = next;
    return next;
}

function setupAuth() {
    const btn = document.getElementById("auth-btn");
    const status = document.getElementById("auth-status");

    btn.onclick = async () => {
        const pass = document.getElementById("auth-password").value;
        if (!pass) return;

        appPassword = pass;
        status.textContent = "認証済";
        document.getElementById("auth-area").classList.add('hidden');

        await loadRemoteState();
        const datasetSelect = document.getElementById('dataset-select');
        if (datasetSelect) {
            datasetSelect.value = state.dataset;
        }

        const ds = CONFIG.DATASETS[state.dataset];

        const [qRes, eRes] = await Promise.all([
            fetch(ds.Q_DATA, {
                headers: { "X-Auth-Password": appPassword }
            }),
            fetch(ds.E_DATA, {
                headers: { "X-Auth-Password": appPassword }
            })
        ]);

        state.questions = await qRes.json();
        state.explanations = await eRes.json();

        buildCurrentList();
        const lastViewedQuestionId = state.lastViewedQuestionIdByDataset[state.dataset];
        state.lastViewedQuestionId = lastViewedQuestionId ?? null;
        if (state.mode === 'normal' && lastViewedQuestionId != null) {
            const lastViewedIndex = state.currentList.findIndex(
                q => q.question_id === lastViewedQuestionId
            );
            if (lastViewedIndex !== -1) {
                state.currentIndex = lastViewedIndex;
            }
        }
        updateScore();
        await render();
    };
}

async function init() {
    setupAuth();
    setupModeButtons();
    setupNavButtons();
    document.getElementById('reset-score-btn').onclick = resetScore;

    dom.pageSelect.onchange = async (e) => {
        state.currentIndex = Number(e.target.value);
        saveRemoteState();
        await render();
    };

    // ★ dataset復元をUIへ反映
    const datasetSelect = document.getElementById('dataset-select');
    if (datasetSelect) {
        datasetSelect.value = state.dataset;
    }

    buildCurrentList();

    if (state.currentIndex >= state.currentList.length) {
        state.currentIndex = 0;
    }

    await render();

    datasetSelect.onchange = async (e) => {
        state.dataset = e.target.value;
        state.currentIndex = 0;
        saveRemoteState();

        if (!appPassword) return;

        const ds = CONFIG.DATASETS[state.dataset];

        const [qRes, eRes] = await Promise.all([
            fetch(ds.Q_DATA, {
                headers: { "X-Auth-Password": appPassword }
            }),
            fetch(ds.E_DATA, {
                headers: { "X-Auth-Password": appPassword }
            })
        ]);

        state.questions = await qRes.json();
        state.explanations = await eRes.json();

        buildCurrentList();
        updateScore();
        await render();
    };
}

function setupModeButtons() {
    const nm = document.getElementById('normal-mode-btn');
    const wm = document.getElementById('wrong-only-btn');
    const hm = document.getElementById('hard-mode-btn');
    const sm = document.getElementById('shuffle-mode-btn');

    async function activate(btn, mode) {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = mode;
        state.currentList = [];   // ★ shuffle再生成用に空にする
        buildCurrentList();
        state.currentIndex = 0;
        saveRemoteState();
        await render();
    }

    nm.onclick = () => activate(nm, 'normal');
    wm.onclick = () => activate(wm, 'wrong');
    hm.onclick = () => activate(hm, 'hard');
    sm.onclick = () => activate(sm, 'shuffle');
}

function setupNavButtons() {
    async function navigate(offset) {
        const nextIndex = state.currentIndex + offset;
        if (nextIndex < 0 || nextIndex >= state.currentList.length) {
            return;
        }

        state.currentIndex = nextIndex;
        saveRemoteState();
        await render();
    }

    ['prev-btn', 'prev-btn-top'].forEach(id => {
        document.getElementById(id).onclick = () => navigate(-1);
    });

    ['next-btn', 'next-btn-top'].forEach(id => {
        document.getElementById(id).onclick = () => navigate(1);
    });

    document.addEventListener('keydown', event => {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        if (event.target instanceof Element &&
            event.target.closest('input, textarea, select, [contenteditable="true"]')) {
            return;
        }

        const key = event.key.toLowerCase();
        if (key === 'j') {
            navigate(-1);
        } else if (key === 'l') {
            navigate(1);
        }
    });
}

// ページプルダウン初期化関数追加
function updatePageSelect() {
    if (!dom.pageSelect) return;

    dom.pageSelect.innerHTML = '';

    state.currentList.forEach((_, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = index + 1;
        dom.pageSelect.appendChild(option);
    });

    dom.pageSelect.value = state.currentIndex;
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
    let base = state.questions;

    if (state.mode === 'wrong') {
        base = state.questions.filter(q => getQuestionStats(q.question_id).lastResult === false);
    } else if (state.mode === 'hard') {
        base = state.questions
            .map(q => ({ question: q, stats: getQuestionStats(q.question_id) }))
            .filter(item => item.stats.wrongs > 0)
            .sort((a, b) => {
                const ratioA = a.stats.attempts ? a.stats.wrongs / a.stats.attempts : 0;
                const ratioB = b.stats.attempts ? b.stats.wrongs / b.stats.attempts : 0;
                if (ratioB !== ratioA) return ratioB - ratioA;
                if (b.stats.wrongs !== a.stats.wrongs) return b.stats.wrongs - a.stats.wrongs;
                return b.stats.attempts - a.stats.attempts;
            })
            .map(item => item.question);
    }

    if (state.mode === 'shuffle') {
        if (!state.currentList.length) {
            state.currentList = shuffleArray(base);
        }
    } else {
        state.currentList = [...base];
    }

    if (state.currentIndex >= state.currentList.length) {
        state.currentIndex = 0;
    }

    updatePageSelect();
}

async function render() {
    const list = state.currentList;

    if (!dom.qNumber) {
        dom.qNumber = document.createElement('span');
        dom.qNumber.className = 'question-number';
        // dom.qText.before(dom.qNumber);
        dom.totalIdx.after(dom.qNumber);
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

    // Save the current position while in normal mode.
    if (state.mode === 'normal') {
        state.lastViewedQuestionId = q.question_id;
        state.lastViewedQuestionIdByDataset[state.dataset] = q.question_id;
        saveRemoteState();
    }

    dom.qNumber.style.display = 'inline';
    dom.qNumber.textContent = `問題ID：${q.question_id}`;

    // ★ 問題画像表示処理
    if (q.question_image) {
        if (!appPassword) {
            dom.imageContainer.innerHTML = "パスワード認証が必要です";
            dom.qText.style.display = 'none';
        } else {
            const imageId = q.question_image.replace('.jpg', '');

            const res = await fetch(
                CONFIG.IMAGE_API + imageId,
                { headers: { "X-Auth-Password": appPassword } }
            );

            if (!res.ok) {
                // ★ 画像読み込み失敗時
                dom.imageContainer.style.display = 'none';
                dom.qText.style.display = 'block';
                dom.qText.textContent = q.question_text;
                // dom.imageContainer.innerHTML = "画像取得失敗";

            } else {
                const blob = await res.blob();
                const imgUrl = URL.createObjectURL(blob);
                dom.imageContainer.innerHTML = '';
                const img = document.createElement('img');
                img.src = imgUrl;
                img.className = 'question-img';

                dom.qText.style.display = 'none';
                dom.imageContainer.appendChild(img);
                dom.imageContainer.style.display = 'block';
            }
        }
    } else {
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

        const text = `${c.label}: ${c.text}`;
        const parts = text.split('\n');

        const textSpan = document.createElement('span');
        textSpan.className = 'choice-text';

        parts.forEach((line, index) => {
            if (index > 0) {
                textSpan.appendChild(document.createTextNode('\u0020\u0020\u0020'));
            }
            textSpan.appendChild(document.createTextNode(line));
            if (index < parts.length - 1) {
                textSpan.appendChild(document.createElement('br'));
            }
        });

        label.appendChild(textSpan);
        dom.choices.appendChild(label);
        
    });

    dom.currentIdx.textContent = state.currentIndex + 1;
    dom.totalIdx.textContent = list.length + " ";

    // updatePageSelect();
    if (dom.pageSelect) {
        dom.pageSelect.value = state.currentIndex;
    }
}

// ========================
// 回答処理
// ========================
dom.form.onsubmit = async e => {
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

    setQuestionResult(q.question_id, isCorrect);
    saveRemoteState();

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
    const values = Object.values(getCurrentResults()).map(normalizeResult);
    dom.scoreC.textContent = values.filter(v => v.lastResult === true).length;
    dom.scoreW.textContent = values.filter(v => v.lastResult === false).length;
    dom.scoreP.textContent = state.questions.length
        ? Math.round((values.filter(v => v.lastResult === true).length / state.questions.length) * 100)
        : 0;
}

async function resetScore() {
    state.resultsByDataset[state.dataset] = {};
    saveRemoteState();
    updateScore();
    buildCurrentList();

    if (state.currentIndex >= state.currentList.length) {
        state.currentIndex = 0;
    }

    await render();
}


init();

function getRemoteStateSnapshot() {
    return {
        mode: state.mode,
        resultsByDataset: state.resultsByDataset,
        currentIndex: state.currentIndex,
        lastViewedQuestionIdByDataset: state.lastViewedQuestionIdByDataset,
        lastViewedQuestionId: state.lastViewedQuestionId,
        dataset: state.dataset
    };
}

function saveRemoteState() {
    if (!appPassword) return;

    saveRemoteStatePending = true;
    clearTimeout(saveRemoteStateTimer);
    saveRemoteStateTimer = setTimeout(() => {
        saveRemoteStateTimer = null;
        flushRemoteState();
    }, SAVE_DEBOUNCE_MS);
}

function flushRemoteState(keepalive = false) {
    if (!appPassword || !saveRemoteStatePending) return;

    clearTimeout(saveRemoteStateTimer);
    saveRemoteStateTimer = null;
    if (saveRemoteStateInProgress) {
        saveRemoteStateKeepalivePending = saveRemoteStateKeepalivePending || keepalive;
        return;
    }

    const body = JSON.stringify(getRemoteStateSnapshot());
    if (body === lastSavedRemoteState) {
        saveRemoteStatePending = false;
        saveRemoteStateKeepalivePending = false;
        return;
    }

    const password = appPassword;
    saveRemoteStateInProgress = true;
    fetch(`${WORKER_BASE_URL}/saveState`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Auth-Password": password
        },
        body,
        keepalive
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Save state request failed: ${response.status}`);
            }
            lastSavedRemoteState = body;
        })
        .catch(error => {
            console.error("Failed to save remote state:", error);
            saveRemoteStatePending = true;
        })
        .finally(() => {
            saveRemoteStateInProgress = false;
            if (saveRemoteStatePending && saveRemoteStateTimer === null) {
                const shouldKeepalive = saveRemoteStateKeepalivePending;
                saveRemoteStateKeepalivePending = false;
                if (shouldKeepalive || lastSavedRemoteState === body) {
                    flushRemoteState(shouldKeepalive);
                } else {
                    saveRemoteStateTimer = setTimeout(() => {
                        saveRemoteStateTimer = null;
                        flushRemoteState();
                    }, SAVE_RETRY_DELAY_MS);
                }
            }
        });
}

window.addEventListener('pagehide', () => {
    if (!saveRemoteStatePending) return;

    clearTimeout(saveRemoteStateTimer);
    saveRemoteStateTimer = null;
    flushRemoteState(true);
});

async function loadRemoteState() {
    if (!appPassword) return;

    lastSavedRemoteState = null;

    const res = await fetch(`${WORKER_BASE_URL}/loadState`, {
        headers: {
            "X-Auth-Password": appPassword
        }
    });

    if (!res.ok) return;

    const saved = await res.json();

    state.mode = saved.mode || "normal";
    state.resultsByDataset = saved.resultsByDataset || {};
    state.currentIndex = saved.currentIndex || 0;
    state.lastViewedQuestionIdByDataset = saved.lastViewedQuestionIdByDataset || {};
    state.dataset = saved.dataset || "enshu2";
    state.lastViewedQuestionId =
        saved.lastViewedQuestionId ?? state.lastViewedQuestionIdByDataset[state.dataset] ?? null;
    lastSavedRemoteState = JSON.stringify(getRemoteStateSnapshot());
}
