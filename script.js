const CONFIG = {
    Q_DATA: './data/questions.json',
    E_DATA: './data/explanations.json',
    IMG_DIR: './assets/images/'
};

let state = {
    questions: [],
    explanations: [],
    currentIndex: 0,
    results: {} // question_id: boolean
};

const dom = {
    qText: document.getElementById('question-text'),
    qImage: document.getElementById('image-container'),
    choices: document.getElementById('choices-container'),
    exp: document.getElementById('explanation-container'),
    form: document.getElementById('answer-form'),
    validMsg: document.getElementById('validation-msg'),
    scoreC: document.getElementById('correct-count'),
    scoreW: document.getElementById('wrong-count'),
    scoreP: document.getElementById('score-percent')
};

async function init() {
    try {
        const [qRes, eRes] = await Promise.all([fetch(CONFIG.Q_DATA), fetch(CONFIG.E_DATA)]);
        if (!qRes.ok || !eRes.ok) throw new Error();
        state.questions = await qRes.json();
        state.explanations = await eRes.json();
        render();
    } catch (e) {
        document.getElementById('error-message').textContent = "Failed to fetch: サーバーを起動して実行してください。";
        document.getElementById('error-message').classList.remove('hidden');
    }
}

function render() {
    const q = state.questions[state.currentIndex];
    dom.validMsg.classList.add('hidden');
    dom.exp.classList.add('hidden');
    dom.choices.innerHTML = '';
    
    // 問題文に（○つ選択）を付与
    const hint = q.answer_type === 'multiple' ? ` <span class="select-count-hint">(${q.answer_count}つ選択)</span>` : '';
    dom.qText.innerHTML = q.question_text + hint;
    
    dom.qImage.innerHTML = q.question_image ? `<img src="${CONFIG.IMG_DIR}${q.question_image}">` : '';
    
    q.choices.forEach(c => {
        const inputType = q.answer_type === 'single' ? 'radio' : 'checkbox';
        const label = document.createElement('label');
        label.className = 'choice-label';
        label.innerHTML = `<input type="${inputType}" name="ans" value="${c.label}"> ${c.label}: ${c.text}`;
        dom.choices.appendChild(label);
    });

    document.getElementById('current-idx').textContent = state.currentIndex + 1;
    document.getElementById('total-idx').textContent = state.questions.length;
    document.getElementById('prev-btn').disabled = state.currentIndex === 0;
    document.getElementById('next-btn').disabled = state.currentIndex === state.questions.length - 1;
    updateScore();
}

dom.form.onsubmit = (e) => {
    e.preventDefault();
    const selected = Array.from(new FormData(dom.form).getAll('ans'));
    
    if (selected.length === 0) {
        dom.validMsg.classList.remove('hidden');
        return;
    }
    dom.validMsg.classList.add('hidden');

    const ansData = state.explanations.find(ex => ex.question_id === state.questions[state.currentIndex].question_id);
    const isCorrect = JSON.stringify(selected.sort()) === JSON.stringify(ansData.correct_answers.sort());

    // スコア記録
    state.results[ansData.question_id] = isCorrect;
    updateScore();

    // 結果表示
    dom.exp.classList.remove('hidden');
    dom.exp.className = isCorrect ? 'correct-ui' : 'wrong-ui';
    document.getElementById('result-badge').textContent = isCorrect ? "✓ 正解" : "× 不正解";
    document.getElementById('correct-answer-text').textContent = ansData.correct_answers.join(', ');
    document.getElementById('explanation-text').textContent = ansData.explanation_text;
};

function updateScore() {
    const values = Object.values(state.results);
    const correct = values.filter(v => v === true).length;
    const wrong = values.filter(v => v === false).length;
    const percent = state.questions.length > 0 ? Math.round((correct / state.questions.length) * 100) : 0;

    dom.scoreC.textContent = correct;
    dom.scoreW.textContent = wrong;
    dom.scoreP.textContent = percent;
}

document.getElementById('prev-btn').onclick = () => { if(state.currentIndex > 0) { state.currentIndex--; render(); }};
document.getElementById('next-btn').onclick = () => { if(state.currentIndex < state.questions.length-1) { state.currentIndex++; render(); }};

init();