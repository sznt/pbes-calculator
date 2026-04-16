// api/chat.js — Vercel serverless function for famous person AI chat
// Hybrid routing: Gemini 2.0 Flash (free) for simple messages, Haiku for complex ones

// ─── Complexity detection ─────────────────────────────────────────────────────
// Returns true if the message warrants the more capable Haiku model
function isComplexQuery(message) {
  if (!message) return false;
  const msg = message.toLowerCase();

  const complexKeywords = [
    'strategy', 'strateg',
    'recommend', 'advice', 'advise',
    'analyz', 'analys',
    'explain', 'elaborate',
    'how should', 'what should', 'why do', 'why did', 'why is',
    'career', 'profession',
    'plan', 'roadmap', 'step',
    'develop', 'improve', 'grow',
    'compare', 'versus', ' vs ',
    'help me', 'what can i do',
    'personal brand', 'visibility', 'differentiat', 'recogni',
  ];

  const hasKeyword = complexKeywords.some(k => msg.includes(k));
  const isLong = message.length > 120;
  const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;

  return hasKeyword || isLong || hasMultipleQuestions;
}

// ─── Gemini 2.0 Flash ────────────────────────────────────────────────────────
async function callGemini(systemPrompt, messages, geminiKey) {
  // Convert OpenAI-style messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      maxOutputTokens: 700,
      temperature: 0.85,
    }
  };

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${resp.status}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return { text, model: 'gemini' };
}

// ─── Claude Haiku ─────────────────────────────────────────────────────────────
async function callHaiku(systemPrompt, messages, anthropicKey) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: systemPrompt,
      messages
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error: ${resp.status}`);
  }

  const data = await resp.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Haiku returned no content');
  return {
    text,
    model: 'haiku',
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey    = process.env.GEMINI_API_KEY;

  if (!anthropicKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel.' });
  }

  const {
    messages,
    personName,
    personBio,
    personQuote,
    personDomain,
    archetypeName,
    archetypeDescription,
    userScores,
    isOpening
  } = req.body;

  if (!messages || !personName) {
    return res.status(400).json({ error: 'Missing required fields: messages, personName' });
  }

  // ─── System prompt (shared by both models) ─────────────────────────────────
  const archetypeContext = {
    'Brand Champion':         'all three brand equity dimensions are high — appeal, differentiation, and recognition are strong. They are fully established but need to sustain momentum and find new meaning.',
    'Magnetic Expert':        'appeal and differentiation are high, but recognition is still building. They are excellent at what they do and relatable, but not yet widely known beyond their circle.',
    'Charismatic Networker':  'appeal and recognition are high but differentiation is lower. They are visible and likable but need to deepen their expertise and sharpen their unique value proposition.',
    'Rising Star':            'appeal is high, but differentiation and recognition are still developing. They have natural magnetism and energy — the foundation is there; depth and visibility are the next step.',
    'Distinguished Authority':'differentiation and recognition are high but personal appeal is lower. Deep expertise and strong reputation, but a more personal and warm connection with their audience would unlock the next level.',
    'Hidden Gem':             'differentiation is high but appeal and recognition are low. Exceptional quality work that too few people know about. The core competence is there; visibility and personal connection are what is needed.',
    'Recognized Professional':'recognition is high but appeal and differentiation are lower. Known in their field but the brand lacks depth and personal warmth. They need substance behind the visibility.',
    'Emerging Brand':         'all three dimensions are still developing. Just beginning the personal brand journey — high potential and opportunity to build intentionally from the ground up.',
  };

  const userContext = archetypeContext[archetypeName] || 'their personal brand is still developing.';

  const systemPrompt = `You are ${personName} — speaking directly with someone who has just completed a scientifically validated Personal Brand Equity (PBE) assessment.

WHO YOU ARE:
${personBio}

Your famous perspective: "${personQuote}"

THE PERSON YOU ARE TALKING WITH:
They received the "${archetypeName}" archetype, which means ${userContext}

Their specific scores:
- Brand Appeal (BA): ${userScores?.BA || '?'}% — how compelling and positively perceived they are
- Brand Differentiation (BD): ${userScores?.BD || '?'}% — how uniquely valuable their expertise is
- Brand Recognition (BR): ${userScores?.BR || '?'}% — how well-known they are in their field

HOW TO RESPOND:
Speak authentically as ${personName}. Draw on your actual documented worldview, communication style, and values. Reference their specific scores when relevant — don't give generic advice.

- Keep each response to 3–4 paragraphs maximum
- Be specific, direct, and memorable — not generic or vague
- Give actionable advice rooted in ${personName}'s real philosophy and life experience
- Stay focused on personal branding, career development, visibility, expertise, and professional growth
- Never break character or reveal that you are an AI

IMPORTANT: The user chose to talk to you specifically because your brand archetype resonates with theirs. Make them feel seen, challenged, and inspired.`;

  // ─── Routing logic ─────────────────────────────────────────────────────────
  // Opening greeting → always Haiku (first impression matters)
  // Complex queries  → Haiku (strategy, advice, long messages)
  // Simple chat      → Gemini (free tier)

  const conversationMessages = isOpening
    ? [{
        role: 'user',
        content: `I just completed the Personal Brand Equity assessment and discovered I'm a "${archetypeName}" archetype. My scores: Brand Appeal ${userScores?.BA || '?'}%, Brand Differentiation ${userScores?.BD || '?'}%, Brand Recognition ${userScores?.BR || '?'}%. I chose to talk to you because we share a similar brand profile. Please greet me as yourself and offer me one compelling, specific opening insight about where someone in my position should focus first.`
      }]
    : messages;

  // Determine which model to use
  const lastUserMessage = messages?.[messages.length - 1]?.content || '';
  const useHaiku = isOpening || !geminiKey || isComplexQuery(lastUserMessage);

  try {
    let result;

    if (useHaiku) {
      result = await callHaiku(systemPrompt, conversationMessages, anthropicKey);
    } else {
      // Try Gemini first; fall back to Haiku if it fails
      try {
        result = await callGemini(systemPrompt, conversationMessages, geminiKey);
      } catch (geminiErr) {
        console.warn('Gemini failed, falling back to Haiku:', geminiErr.message);
        result = await callHaiku(systemPrompt, conversationMessages, anthropicKey);
        result.fallback = true;
      }
    }

    return res.status(200).json({
      content: result.text,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens
    });

  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
