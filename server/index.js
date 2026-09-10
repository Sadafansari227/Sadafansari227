
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");
const Database = require("better-sqlite3");

dotenv.config();

const db = new Database("career_advisor.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        skills TEXT NOT NULL,
        interests TEXT NOT NULL,
        background TEXT NOT NULL,
        career TEXT,
        match_score INTEGER,
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

console.log("📊 SQLite database connected");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

app.get("/", (req, res) => {
    res.json({
        message: "AI Career Advisor backend is running 🚀"
    });
});

// Get all student records for the database dashboard
app.get("/api/students", (req, res) => {
    try {
        const students = db
            .prepare("SELECT * FROM students ORDER BY id DESC")
            .all();

        res.json({
            success: true,
            students: students
        });
    } catch (error) {
        console.error("Database Error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to retrieve student records."
        });
    }
});

app.post("/api/career-advice", async (req, res) => {
    try {
       const { name, email, skills, interests, background } = req.body;

if (!skills || !interests || !background) {
            return res.status(400).json({
                error: "Skills, interests and background are required."
            });
        }

       const prompt = `
You are an expert AI career advisor and career assessment system for college students.

Analyze the student's profile carefully and create a realistic, personalized career dashboard.

Student Profile:
Skills: ${skills}
Interests: ${interests}
Academic Background: ${background}
IMPORTANT RULES:

1. Return ONLY valid JSON.
2. Do not use Markdown.
3. Do not use code fences.
4. Do not add explanations outside the JSON.
5. Never invent skills that the student did not mention.
6. Be realistic about the student's current level.
7. Do not give a high match score simply to encourage the student.
8. Major skill gaps MUST reduce the match score.
9. The match score represents how well the student's CURRENT profile matches the recommended career.
10. Consider skills, interests, academic background, transferable skills, and normally required career skills.
11. Match scores must be between 45 and 95.
12. Do not give 90+ unless the student's current skills strongly match the career requirements.
13. Identify genuine skill gaps that the student should work on.
14. Recommend practical projects that can realistically be completed by a college student.
15. The roadmap must progress logically from Foundation to Skill Building to Advanced to Job Ready.
16. Provide exactly 2 alternative careers.
17. Alternative careers must be meaningfully different from the primary career.
18. Do not repeat the same skill unnecessarily.
19. Do not assume experience, certifications, internships, tools, or technologies that the student did not mention.

CAREER MATCHING:

Evaluate the student's profile using these approximate priorities:

- Skills compatibility: 40%
- Interests compatibility: 25%
- Academic background compatibility: 20%
- Transferable skills: 10%
- Skill-gap penalty: 5%

Choose the strongest career direction based on the student's actual profile.

Do not choose a career simply because it is popular.

The primary career must have the highest compatibility with the student's profile.

The two alternative careers must also be realistic choices based on the student's profile.

For the primary career, explain why it fits using specific evidence from the student's skills, interests, academic background, and transferable strengths.

SKILL ANALYSIS:

Clearly distinguish between:

- Skills the student already has
- Skills that need improvement
- Important skills that are currently missing

Never claim that the student already possesses a skill unless it appears in their profile.

ROADMAP:

Create four stages:

Foundation
Skill Building
Advanced
Job Ready

Each stage should contain realistic, practical learning goals.

PROJECTS:

Recommend exactly 3 projects:

1. Beginner
2. Intermediate
3. Advanced

Projects must directly help the student develop the skills required for the recommended career.

LEARNING PLAN:

Provide exactly 4 practical next steps.

Avoid generic advice such as "work hard" or "keep learning."

Make every recommendation actionable.

CONSISTENCY:

For the same student profile, keep the primary career direction generally consistent.

Small score variations are acceptable, but do not randomly switch between unrelated careers.

REALISM:

This is a career assessment, not a guarantee.

Do not claim that the student is guaranteed to get a job or that a career is "perfect" for them.

The recommendation should represent the strongest current career direction based on the information provided.
Use exactly this JSON structure:

{
  "career": {
    "title": "string",
    "matchScore": 0,
    "summary": "string",
    "whyFit": [
      "string",
      "string",
      "string"
    ]
  },

  "alternativeCareers": [
    {
      "title": "string",
      "matchScore": 0,
      "reason": "string",
      "skillGap": "Low"
    },
    {
      "title": "string",
      "matchScore": 0,
      "reason": "string",
      "skillGap": "Medium"
    }
  ],

  "skillMatch": [
    {
      "skill": "string",
      "score": 0
    }
  ],

  "skillGaps": [
    "string",
    "string",
    "string"
  ],

  "roadmap": [
    {
      "stage": "Foundation",
      "duration": "string",
      "goals": [
        "string",
        "string"
      ]
    },
    {
      "stage": "Skill Building",
      "duration": "string",
      "goals": [
        "string",
        "string"
      ]
    },
    {
      "stage": "Advanced",
      "duration": "string",
      "goals": [
        "string",
        "string"
      ]
    },
    {
      "stage": "Job Ready",
      "duration": "string",
      "goals": [
        "string",
        "string"
      ]
    }
  ],

  "projects": [
    {
      "title": "string",
      "difficulty": "Beginner",
      "description": "string"
    },
    {
      "title": "string",
      "difficulty": "Intermediate",
      "description": "string"
    },
    {
      "title": "string",
      "difficulty": "Advanced",
      "description": "string"
    }
  ],

  "roles": {
    "entry": [
      "string",
      "string",
      "string"
    ],
    "mid": [
      "string",
      "string",
      "string"
    ],
    "advanced": [
      "string",
      "string",
      "string"
    ]
  },

  "learningPlan": [
    "string",
    "string",
    "string",
    "string"
  ]
}
`;

const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
});

const rawText = response.text.trim();

let careerData;

try {
    careerData = JSON.parse(rawText);
} catch (parseError) {
    console.error("JSON Parse Error:", parseError);
    console.error("Gemini Response:", rawText);

    return res.status(500).json({
        success: false,
        error: "AI returned an invalid career recommendation."
    });
}


const insertStudent = db.prepare(`
    INSERT INTO students (
        name,
        email,
        skills,
        interests,
        background,
        career,
        match_score
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertStudent.run(
    name || "",
    email || "",
    skills,
    interests,
    background,
    careerData.career.title,
    careerData.career.matchScore
);

res.json({
    success: true,
    data: careerData
});

    } catch (error) {
        console.error("Gemini Error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to generate career advice."
        });
    }
});

app.get("/api/students", (req, res) => {
    try {
        const students = db.prepare("SELECT * FROM students ORDER BY id DESC").all();

        res.json({
            success: true,
            students: students
        });
    } catch (error) {
        console.error("Database Error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to fetch students from database."
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Career Advisor backend running on port ${PORT}`);
});