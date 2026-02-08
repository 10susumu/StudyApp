// ===============================
// StudyApp — script.js 修正版
// ===============================
const CONFIG = {
  Q_DATA: './data/questions.json',
  E_DATA: './data/explanations.json'
};

let state = {
  questions: [],
  explanations: [],
  currentIndex: 0,
  results: {},
  mode: 'normal'
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
  const [qRes, eRes] = await Promise.all([
    fetch(CONFIG.Q_DATA),
    fetch(CONFIG.E_DATA)
  ]);
  state.questions = await qRes.json();
  state.explanations = await eRes.json();
  setupModeButtons();
  loadMode();
}

function setupModeButtons() {
  const nm = document.getElementById('normal-mode-btn');
  const rm = document.getElementById('resume-btn');
  const wm = document.getElementById('wrong-only-btn');
  const mi = document.getElementById('mode-indicator');

  nm.onclick = () => {
    state.mode = 'normal';
    clearModes();
    nm.classList.add('active');
    mi.textContent = '現在のモード：通常';
    state.currentIndex = 0;
    state.results = {};
    render();
  };

  rm.onclick = () => {
    state.mode = 'resume';
    clearModes();
    rm.classList.add('active');
    mi.textContent = '現在のモード：前回から再開';
    render();
  };

  wm.onclick = () => {
    state.mode = 'wrong';
    clearModes();
    wm.classList.add('active');
    mi.textContent = '現在のモード：不正解のみ';
    render();
  };
}

function clearModes() {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
}

function loadMode() {
  render();
}

function getCurrentList() {
  if (state.mode === 'wrong') {
    return state.questions.filter(q => state.results[q.question_id] === false);
  }
  return state.questions;
}

function render() {
  const list = getCurrentList();
if (list.length === 0) {
  dom.qText.textContent = '不正解の問題はありません';
  dom.choices.innerHTML = '';
  dom.exp.classList.add('hidden');
  document.getElementById('current-idx').textContent = 0;
  document.getElementById('total-idx').textContent = 0;
  return;
}

  if (list.length === 0) return;
  const q = list[state.currentIndex];
  dom.choices.innerHTML = '';
  dom.validMsg.classList.add('hidden');
  dom.exp.classList.add('hidden');

  const hint = q.answer_type === 'multiple' ? ` (${q.answer_count}つ選択)` : '';
  dom.qText.textContent = q.question_text + hint;

  q.choices.forEach(c => {
    const inputType = q.answer_type === 'single' ? 'radio' : 'checkbox';
    const label = document.createElement('label');
    label.innerHTML = `<input type="${inputType}" name="ans" value="${c.label}"> ${c.label}: ${c.text}`;
    dom.choices.appendChild(label);
  });

  document.getElementById('current-idx').textContent = state.currentIndex + 1;
  document.getElementById('total-idx').textContent = list.length;

  document.getElementById('prev-btn').disabled = state.currentIndex === 0;
  document.getElementById('next-btn').disabled = state.currentIndex >= list.length - 1;

  updateScore();
}

dom.form.onsubmit = (e) => {
  e.preventDefault();
  const selected = Array.from(new FormData(dom.form).getAll('ans'));
  if (selected.length === 0) {
    dom.validMsg.classList.remove('hidden');
    return;
  }
  const list = getCurrentList();
  const q = list[state.currentIndex];
  const ansData = state.explanations.find(ex => ex.question_id === q.question_id);
  const isCorrect = JSON.stringify(selected.sort()) === JSON.stringify(ansData.correct_answers.sort());
  state.results[q.question_id] = isCorrect;
  dom.exp.classList.remove('hidden');
  dom.exp.className = isCorrect ? 'correct-ui' : 'wrong-ui';
  document.getElementById('result-badge').textContent = isCorrect ? '✓ 正解' : '× 不正解';
  document.getElementById('correct-answer-text').textContent = ansData.correct_answers.join(', ');
  document.getElementById('explanation-text').textContent = ansData.explanation_text;
  updateScore();
  if (state.mode === 'wrong' && isCorrect) {
  const remaining = getCurrentList();
  if (remaining.length === 0) {
    state.mode = 'normal';
    clearModes();
    document.getElementById('normal-mode-btn').classList.add('active');
    document.getElementById('mode-indicator').textContent = '現在のモード：通常';
    state.currentIndex = 0;
    render();
    return;
  }
}

};

document.getElementById('prev-btn').onclick = () => {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    render();
  }
};

document.getElementById('next-btn').onclick = () => {
  const list = getCurrentList();
  if (state.currentIndex < list.length - 1) {
    state.currentIndex++;
    render();
  }
};

function updateScore() {
  const values = Object.values(state.results);
  dom.scoreC.textContent = values.filter(v => v).length;
  dom.scoreW.textContent = values.filter(v => !v).length;
  dom.scoreP.textContent = state.questions.length > 0
    ? Math.round((values.filter(v => v).length / state.questions.length) * 100)
    : 0;
}

init();
