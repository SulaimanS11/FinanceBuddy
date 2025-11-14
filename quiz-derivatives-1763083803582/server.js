const express = require('express');
const path = require('path');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI
const GEMINI_API_KEY = 'AIzaSyC8ryNHEtCeQolwm6zHUWuoReHEmnaoeV4';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 500,
  }
});

// Study mode state
let studyMode = true; // Default: study mode is active

// Middleware
app.use(cors());
app.use(express.json());

// Password protection middleware
const PASSWORD = 'admin';
app.use((req, res, next) => {
  // Skip password check for health endpoint
  if (req.path === '/health') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Derivatives Quiz Server"');
    return res.status(401).send('Authentication required');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (password !== PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Derivatives Quiz Server"');
    return res.status(401).send('Invalid password');
  }

  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Quiz frontend route
app.get('/quiz', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'quiz-frontend.html'));
});

// Gemini API endpoint for followup questions - REAL API
app.post('/api/gemini/ask', async (req, res) => {
  console.log('Gemini question asked:', req.body);

  const { question, context, topic } = req.body;

  if (!question) {
    return res.status(400).json({
      success: false,
      error: 'Question is required'
    });
  }

  try {
    // Build a contextual prompt for better finance-focused responses
    const prompt = `You are a knowledgeable finance tutor helping students learn about Derivatives. 

Context: The student just answered a quiz question about: "${context}"

Student's follow-up question: ${question}

Please provide a clear, educational answer that:
- Is accurate and informative
- Uses simple language suitable for learners
- Includes relevant examples when helpful
- Stays focused on Derivatives and finance topics
- Is concise (2-3 paragraphs maximum)

Answer:`;

    console.log('Calling real Gemini API...');
    console.log('Question:', question);
    console.log('Context:', context);

    // Call real Gemini API
    const result = await model.generateContent(prompt);
    const response = result.response;
    
    // Check if response is blocked
    if (!response) {
      throw new Error('No response from Gemini API');
    }

    const answer = response.text();
    
    if (!answer) {
      throw new Error('Empty response from Gemini API');
    }

    console.log('Gemini API response received successfully');
    console.log('Answer length:', answer.length);

    res.json({
      success: true,
      answer: answer,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get response from Gemini: ' + error.message
    });
  }
});

// Quiz export endpoint with generated questions
app.post('/api/quiz/export', (req, res) => {
  console.log('Quiz export requested:', req.body);
  
  const quizData = {
    success: true,
    data: {
      quiz: {
        title: "Derivatives Quiz - " + new Date().toLocaleDateString(),
        questions: [
        {
                "question": "According to the text, what is the primary characteristic that defines a derivative?",
                "answers": [
                        "Its value is fixed regardless of market conditions.",
                        "It is a contract exclusively for commodities.",
                        "Its value depends on the value of another security or asset.",
                        "It is only traded by institutions, not individual investors."
                ],
                "correct": 2,
                "explanation": "The text states that derivatives 'are securities whose value depends on the value of another security or asset.'"
        },
        {
                "question": "What fundamental risk and return characteristic of derivatives is described as providing exposure to the underlying asset for a small fraction of its value?",
                "answers": [
                        "Diversification",
                        "Liquidity",
                        "Leverage",
                        "Hedging"
                ],
                "correct": 2,
                "explanation": "The text explicitly defines this characteristic as 'leverage,' noting it provides exposure for a small fraction of the asset's value."
        },
        {
                "question": "Based on the text, how does the value of an option contract to buy shares at a fixed price change in relation to the underlying shares?",
                "answers": [
                        "It decreases in value as the shares increase in value.",
                        "It remains constant regardless of the share price.",
                        "It increases in value as the shares increase in value.",
                        "It is inversely related to the shares' value changes."
                ],
                "correct": 2,
                "explanation": "The text states, 'as those shares increase in value, the option contract should increase in value as well.'"
        },
        {
                "question": "According to the provided text, what is a defining characteristic of derivatives?",
                "answers": [
                        "Their value is always fixed regardless of market conditions.",
                        "They are securities whose value depends on the value of another security or asset.",
                        "They are direct ownership stakes in physical commodities only.",
                        "Their value is determined solely by the buyer and seller without reference to an underlying asset."
                ],
                "correct": 1,
                "explanation": "Derivatives are defined as securities whose value depends on the value of another security or asset, such as shares or commodities, as stated in the text."
        },
        {
                "question": "The textbook content mentions a fundamental risk and return characteristic of derivatives where they provide exposure to an underlying asset for a small fraction of the asset's value. What is this characteristic called?",
                "answers": [
                        "Diversification",
                        "Hedging",
                        "Leverage",
                        "Arbitrage"
                ],
                "correct": 2,
                "explanation": "The text explicitly states that providing exposure to the underlying asset for a small fraction of its value is a characteristic known as leverage. This allows for amplified gains or losses relative to the capital invested."
        }
],
        metadata: {
          topic: "Derivatives",
          difficulty: ["beginner", "intermediate"],
          sourceSystem: "FinanceBuddy CLI",
          exportedAt: new Date().toISOString(),
          generatedBy: "Gemini AI"
        }
      },
      exportedAt: new Date().toISOString(),
      questionCount: 5,
      originalSessionId: req.body.sessionId || "generated-session-" + Date.now()
    }
  };
  
  res.json(quizData);
});

// Study mode endpoints
app.get('/api/study-mode', (req, res) => {
  res.json({
    success: true,
    studyMode: studyMode
  });
});

app.post('/api/study-mode/toggle', (req, res) => {
  studyMode = !studyMode;
  console.log(`Study mode ${studyMode ? 'enabled' : 'disabled'}`);
  res.json({
    success: true,
    studyMode: studyMode,
    message: `Study mode ${studyMode ? 'enabled' : 'disabled'}`
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Derivatives Quiz Server',
    version: '1.0.0',
    quizFrontend: '/quiz',
    studyMode: studyMode,
    subject: 'Derivatives',
    questionCount: 5,
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Derivatives Quiz Server',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Derivatives Quiz Server running on port ${PORT}`);
  console.log(`📚 Quiz Frontend: http://localhost:${PORT}/quiz`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 Root endpoint: http://localhost:${PORT}/`);
  console.log(`📖 Subject: Derivatives`);
  console.log(`❓ Questions: 5`);
});
