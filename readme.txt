StudyApp/
│
├── index.html
├── style.css
├── script.js
│
├── data/                <-- JSON格納用フォルダ
│   ├── questions.json
│   └── explanations.json
│
└── assets/              <-- 画像格納用フォルダ
    └── images/
        ├── image_001.png
        └── image_002.png


# questions 出力フォーマット
[
  {
    "question_id": number,
    "question_text": string,
    "question_image": null,
    "answer_type": "single" | "multiple",
    "answer_count": number,
    "choices": [
      { "label": string, "text": string }
    ]
  }
]

# explanations 出力フォーマット
[
  {
    "question_id": number,
    "correct_answers": [string],
    "explanation_text": string
  }
]


https://raw.githubusercontent.com/10susumu/StudyApp/main/script.js
https://raw.githubusercontent.com/10susumu/StudyApp/main/index.html
https://raw.githubusercontent.com/10susumu/StudyApp/main/style.css
https://raw.githubusercontent.com/10susumu/StudyApp/main/data/questions.json
https://raw.githubusercontent.com/10susumu/StudyApp/main/data/explanations.json