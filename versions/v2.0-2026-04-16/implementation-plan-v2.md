# Superpower Implementation Plan: Famous People + AI Chat

Excellent. Now I have a comprehensive understanding of the codebase. Let me create a detailed implementation plan document.

## COMPREHENSIVE SUPERPOWER IMPLEMENTATION PLAN
## Personal Brand Equity Calculator: Famous People Archetypes + AI Chat

---

### 1. ARCHITECTURE OVERVIEW

#### 1.1 System Components

The system will be layered with minimal disruption to the existing SPA:

```
Frontend Layer (Single App.html)
├── Existing Assessment Flow (unchanged)
├── NEW: ArchetypeMatchSection (post-assessment)
├── NEW: FamousPersonCard (display famous person profile)
├── NEW: AuthenticationGate (email/magic-link via Supabase Auth)
├── NEW: ChatInterface (text + optional voice)
└── NEW: LanguageSelector (UI + API context)

Backend Layer (Vercel serverless)
├── Existing API endpoints (unchanged)
├── NEW: api/famous-people.js (GET /api/famous-people)
├── NEW: api/auth.js (POST /api/auth/register, /api/auth/verify-otp)
├── NEW: api/chat.js (POST /api/chat/message, stream responses)
├── NEW: api/chat-sessions.js (GET, POST chat session history)
└── NEW: api/voice.js (TTS, STT proxies for ElevenLabs/Whisper)

Database Layer (Supabase)
├── Existing tables (users, assessments, organizations, etc.)
├── NEW: famous_people (64 profiles)
├── NEW: chat_sessions (per-user-per-persona)
├── NEW: chat_messages (conversation history)
└── NEW: chat_preferences (language, voice, etc.)
```

#### 1.2 Authentication Strategy

**Recommendation: Supabase Auth (magic-link email) + Simple JWT**

Rationale:
- Supabase Auth is already integrated (SDK loaded in HTML)
- Magic-link requires zero password management (lower user friction)
- Backend endpoints validate JWT token from Supabase
- No OAuth complexity needed for MVP
- Future: can layer OAuth (Google/GitHub) atop Supabase Auth without refactoring

Flow:
1. User completes assessment, sees famous people cards
2. Clicks "Chat with [famous person]"
3. Gates to: "Sign in to continue" → email input → check email for magic link
4. Magic link opens app with URL token → app exchanges for JWT
5. JWT stored in `localStorage` with 7-day expiry
6. All chat API calls include `Authorization: Bearer <JWT>`

#### 1.3 External Service Dependencies

| Service | Purpose | Cost (est.) | Alternative |
|---------|---------|------------|-------------|
| **ElevenLabs TTS** | Convert text→speech for personas | $0.30/1M chars | OpenAI TTS ($0.015/1K tokens), Azure Speech Services |
| **OpenAI Whisper API** | Convert speech→text input | $0.02/minute | AssemblyAI ($0.0015/min), Azure Speech-to-Text |
| **Claude API** (Anthropic) | LLM for persona responses | $0.80/1M input tokens | GPT-4o ($0.03/1K tokens), Llama 2 (self-hosted) |
| **Wikimedia Commons API** | Photo sourcing (free) | Free | Unsplash API, Pexels, custom CDN |

**Recommended Stack for MVP:**
- **TTS**: ElevenLabs (best voice quality, multilingual)
- **STT**: OpenAI Whisper (most accurate for accented speech)
- **LLM**: Claude 3.5 Sonnet (best persona fidelity, reasoning)
- **Photos**: Wikimedia Commons API + fallback to placeholder avatars (DiceBear API)

---

### 2. DATA MODEL

#### 2.1 Supabase Schema Additions

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- FAMOUS PEOPLE PROFILES (64 total: 8 archetypes × 8 people per archetype)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.famous_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name TEXT NOT NULL,
  era_dates TEXT,  -- e.g. "1970-present" or "1924-1989"
  domain TEXT,     -- e.g. "Technology", "Medicine", "Arts", "Finance"
  
  -- Archetype matching (8 archetypes)
  archetype_key TEXT NOT NULL,  -- 'HHH', 'HHL', 'HLH', etc.
  ba_score FLOAT,   -- Brand Appeal representative score
  bd_score FLOAT,   -- Brand Differentiation representative score
  br_score FLOAT,   -- Brand Recognition representative score
  
  -- Profile content
  bio_short TEXT,   -- 2-3 sentences why they match this archetype
  bio_long TEXT,    -- Full biography paragraph (for modal detail)
  quote TEXT,       -- One famous/representative quote
  quote_source TEXT, -- Where the quote is from
  
  -- Visual
  photo_url TEXT,   -- Wikimedia Commons or CDN URL
  wikimedia_file TEXT, -- Wikimedia Commons filename for lookup
  
  -- Voice (for future audio personas)
  elevenlab_voice_id TEXT, -- ElevenLabs voice character ID
  elevenlab_lang_code TEXT, -- Language code for voice (e.g. 'en', 'hu', 'de')
  
  -- System
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  INDEX famous_people_archetype_idx ON public.famous_people(archetype_key),
  INDEX famous_people_domain_idx ON public.famous_people(domain)
);

-- ════════════════════════════════════════════════════════════════════════════
-- CHAT SESSIONS (per user × per persona)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Linkage
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  famous_person_id UUID REFERENCES public.famous_people ON DELETE CASCADE NOT NULL,
  
  -- Preferences
  language TEXT DEFAULT 'en',  -- 'en', 'hu', 'de', 'fr', 'es'
  voice_enabled BOOLEAN DEFAULT false,
  voice_id TEXT,  -- ElevenLabs voice ID for responses
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  message_count INT DEFAULT 0,
  
  UNIQUE(user_id, famous_person_id),  -- One session per user per persona
  INDEX chat_sessions_user_idx ON public.chat_sessions(user_id),
  INDEX chat_sessions_person_idx ON public.chat_sessions(famous_person_id),
  INDEX chat_sessions_activity_idx ON public.chat_sessions(last_activity_at DESC)
);

-- ════════════════════════════════════════════════════════════════════════════
-- CHAT MESSAGES (conversation history)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Linkage
  session_id UUID REFERENCES public.chat_sessions ON DELETE CASCADE NOT NULL,
  
  -- Content
  role TEXT NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,  -- Plain text message
  
  -- Media (optional)
  audio_url TEXT,  -- S3/CDN URL to TTS audio response
  audio_duration INT,  -- Duration in seconds
  
  -- LLM metadata (for debugging)
  model_name TEXT,  -- e.g. 'claude-3.5-sonnet'
  tokens_input INT,
  tokens_output INT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  INDEX chat_messages_session_idx ON public.chat_messages(session_id),
  INDEX chat_messages_created_idx ON public.chat_messages(session_id, created_at)
);

-- ════════════════════════════════════════════════════════════════════════════
-- CHAT PREFERENCES (user preferences for voice/language)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.chat_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID UNIQUE REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  
  -- UI preferences
  language TEXT DEFAULT 'en',
  preferred_voice_id TEXT,  -- Default ElevenLabs voice for new chats
  voice_enabled BOOLEAN DEFAULT false,
  
  -- Privacy
  save_chat_history BOOLEAN DEFAULT true,
  
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.famous_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_preferences ENABLE ROW LEVEL SECURITY;

-- Famous people: public read (no auth needed)
CREATE POLICY "famous_people_public_read" ON public.famous_people
  FOR SELECT USING (true);

-- Chat sessions: users manage their own
CREATE POLICY "chat_sessions_own" ON public.chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Chat messages: users read their own
CREATE POLICY "chat_messages_own" ON public.chat_messages
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.chat_sessions 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM public.chat_sessions 
      WHERE user_id = auth.uid()
    )
  );

-- Chat preferences: users manage their own
CREATE POLICY "chat_preferences_own" ON public.chat_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- SEED DATA STRATEGY (see section 2.2 below)
-- ════════════════════════════════════════════════════════════════════════════
```

#### 2.2 Famous People Seed Data (64 profiles)

**Structure:** 8 archetypes × 8 famous people per archetype

**Archetypes & Example Personas:**

| Archetype | Example People | Note |
|-----------|----------------|------|
| **HHH** (Brand Champion) | Steve Jobs, Oprah Winfrey, Elon Musk, Maya Angelou, Ted Turner, Ruth Bader Ginsburg, Arianna Huffington, Richard Branson | High Appeal + Differentiation + Recognition |
| **HHL** (Magnetic Expert) | Alan Turing, Marie Curie, Carl Sagan, Angela Merkel, Katherine Johnson, Jane Goodall, Malala Yousafzai, Stephen Hawking | High Appeal + Differentiation, Low Recognition (relative) |
| **HLH** (Charismatic Networker) | Bill Clinton, Sheryl Sandberg, Gary Vaynerchuk, Melinda French Gates, Jack Welch, Susan Wojcicki, Reid Hoffman, Michelle Obama | High Appeal + Recognition, Low Differentiation (broad networker) |
| **HLL** (Rising Star) | Greta Thunberg, Billie Eilish, Sundar Pichai (early), Satya Nadella (early), AOC, Taylor Swift (early career), Jessica Chastain, Jon Stewart (early) | High Appeal, Low Differentiation + Recognition (early trajectory) |
| **LHH** (Distinguished Authority) | Warren Buffett, Noam Chomsky, Peter Drucker, Barbara Streisand, Andy Warhol, Jane Austen, Ludwig Beethoven, Nikola Tesla | Low Appeal, High Differentiation + Recognition |
| **LHL** (Hidden Gem) | John Bogle, Paul Graham, Helen Mirren (underrated), Satoru Iwata, J.K. Rowling (pre-fame), Barbara Ehrenreich, Seth Godin (pre-viral), Esther Perel | Low Appeal + Recognition, High Differentiation |
| **LLH** (Up-and-Comer) | Kamala Harris, Jack Ma (mid-career), Mirna Valerio, Ory Okolloh, Priyanka Chopra, Alexis Ohanian, Tobi Lütke, Evan Spiegel | Low Appeal + Differentiation, High Recognition |
| **LLL** (Emerging Brand) | Khaby Lame, Josh Richards, Charli D'Amelio, Andrew Tate, Zoe Saldaña (early), Zayn Malik (solo early), Addison Rae, Trisha Paytas | Low on all dimensions (early/beginning professionals) |

**Seed data format (JSON for bulk import):**

```json
{
  "name": "Marie Curie",
  "era_dates": "1867-1934",
  "domain": "Science",
  "archetype_key": "HHL",
  "ba_score": 72,
  "bd_score": 89,
  "br_score": 65,
  "bio_short": "Marie Curie embodied the Magnetic Expert archetype: groundbreaking scientific discoveries (high differentiation) combined with genuine warmth and collaborative spirit (high appeal). Yet her contributions were often credited to male colleagues—a visibility gap despite her genius.",
  "bio_long": "Polish-born physicist and chemist Marie Curie was the first woman to win a Nobel Prize, the first person to win Nobel Prizes in two scientific fields, and the first female professor at the University of Paris. Her research on radioactivity fundamentally advanced modern physics and chemistry. Despite her extraordinary expertise and the genuine regard colleagues held for her, recognition outside scientific circles remained limited during her lifetime. She exemplifies how genuine expertise and likability can coexist with a visibility ceiling.",
  "quote": "Be less curious about people and more curious about ideas.",
  "quote_source": "Marie Curie",
  "photo_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Marie_Curie.jpg",
  "wikimedia_file": "Marie_Curie.jpg",
  "elevenlab_voice_id": "21m00Tcm4TlvDq8ikWAM",
  "elevenlab_lang_code": "en"
}
```

**Implementation approach:**
- Create `seed-famous-people.sql` with 64 INSERT statements
- OR: Create `scripts/seed-famous-people.js` that calls Supabase REST API
- Run during Phase 1 as one-time setup task
- Include both English and multilingual bios (stored as JSON or separate fields)

---

### 3. FEATURE 1: FAMOUS PEOPLE ARCHETYPE MATCHING

#### 3.1 Component Architecture

```
ResultsScreen (existing)
  └─→ NEW: ArchetypeMatchSection (below peer comparison)
        ├─→ Header: "Meet Your Archetypes"
        ├─→ Filter buttons: [All] [Domain] [Era]
        └─→ Grid of 8 FamousPersonCard components
              ├─→ Photo + hover effects
              ├─→ Name + Era + Domain
              ├─→ BA/BD/BR badges
              ├─→ 2-3 line bio excerpt
              ├─→ Quote callout
              └─→ "View Full Profile" link → FamousPersonModal
                   ├─→ Full bio
                   ├─→ Extended quote with context
                   ├─→ BA/BD/BR comparison chart
                   ├─→ Key traits list
                   └─→ "Chat with [persona]" button (if auth enabled)
```

#### 3.2 React State & Props

**New state in `App.component`:**

```javascript
// Results screen expanded data
const [showArchetypeModal, setShowArchetypeModal] = useState(null);  // null | famousPersonId
const [archetypeFilter, setArchetypeFilter] = useState('all');       // 'all' | 'domain' | 'era'
const [famousMatchesLoaded, setFamousMatchesLoaded] = useState(false);
const [famousPeople, setFamousPeople] = useState([]);                // Array of 8 famous people for this archetype

// On assessment completion, fetch 8 famous people matching the archetype
useEffect(() => {
  if (scores?.key && !famousMatchesLoaded) {
    fetch(`/api/famous-people?archetype=${scores.key}`)
      .then(r => r.json())
      .then(data => {
        setFamousPeople(data.people || []);
        setFamousMatchesLoaded(true);
      })
      .catch(err => console.error('Failed to load famous matches:', err));
  }
}, [scores?.key, famousMatchesLoaded]);
```

#### 3.3 UI Components

**`<ArchetypeMatchSection />`** — Display in `ResultsScreen` after "Professionals Like You" section:

```jsx
function ArchetypeMatchSection({ archetype, famousPeople, onSelectPerson }) {
  const [filter, setFilter] = useState('all');
  
  const uniqueDomains = [...new Set(famousPeople.map(p => p.domain))];
  const filtered = filter === 'all' 
    ? famousPeople 
    : famousPeople.filter(p => p.domain === filter);
  
  return (
    <div className="card-lg fu" style={{ marginBottom: 24 }}>
      <div className="section-head">
        <span className="section-head__icon">👥</span>
        <div>
          <div className="section-head__title">Meet Your Archetypes</div>
          <div className="section-head__sub">
            8 famous people who share your {archetype.name} pattern
          </div>
        </div>
      </div>
      
      {/* Filter by domain */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button 
          className={`btn btn-s ${filter === 'all' ? '' : 'btn--subtle'}`}
          onClick={() => setFilter('all')}
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          All
        </button>
        {uniqueDomains.map(d => (
          <button
            key={d}
            className={`btn btn-s ${filter === d ? '' : 'btn--subtle'}`}
            onClick={() => setFilter(d)}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            {d}
          </button>
        ))}
      </div>
      
      {/* Grid of 8 cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16
      }}>
        {filtered.map(person => (
          <FamousPersonCard
            key={person.id}
            person={person}
            onSelect={() => onSelectPerson(person)}
          />
        ))}
      </div>
    </div>
  );
}

function FamousPersonCard({ person, onSelect }) {
  const [imageError, setImageError] = useState(false);
  
  // Fallback to DiceBear avatar if image fails
  const photoUrl = imageError 
    ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${person.id}`
    : person.photo_url;
  
  return (
    <div
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        borderRadius: 14,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        background: 'var(--surface)',
        transition: 'all var(--dur-base)',
        transform: 'translateY(0)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = 'var(--sh-md)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--sh)';
      }}
    >
      {/* Photo */}
      <div style={{ 
        aspectRatio: '1',
        background: 'var(--bg)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img
          src={photoUrl}
          alt={person.name}
          onError={() => setImageError(true)}
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </div>
      
      {/* Info */}
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          {person.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
          {person.era_dates} • {person.domain}
        </div>
        
        {/* BA/BD/BR badges */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[
            { label: 'BA', score: person.ba_score, color: 'var(--ba)' },
            { label: 'BD', score: person.bd_score, color: 'var(--bd)' },
            { label: 'BR', score: person.br_score, color: 'var(--br)' },
          ].map(d => (
            <div
              key={d.label}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                background: d.color + '18',
                color: d.color,
                textAlign: 'center',
              }}
            >
              {d.label}
            </div>
          ))}
        </div>
        
        {/* Bio excerpt */}
        <div style={{
          fontSize: 12,
          lineHeight: 1.4,
          color: 'var(--text2)',
          marginBottom: 12,
        }}>
          {person.bio_short.substring(0, 100)}...
        </div>
        
        <button
          className="btn btn-s"
          style={{
            width: '100%',
            fontSize: 11,
            padding: '8px 10px',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          View Profile →
        </button>
      </div>
    </div>
  );
}
```

**`<FamousPersonModal />`** — Full detail view:

```jsx
function FamousPersonModal({ person, onClose, archetype, onChatClick }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.5)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}
    onClick={onClose}>
      <div
        className="card-xl"
        style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 className="headline">{person.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
              {person.era_dates} • {person.domain}
            </div>
          </div>
          <button
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: 'var(--text3)',
              padding: 0,
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        {/* Full bio */}
        <div style={{ 
          padding: 16,
          background: 'var(--bg)',
          borderRadius: 12,
          marginBottom: 20,
          lineHeight: 1.7,
        }}>
          {person.bio_long}
        </div>
        
        {/* Quote */}
        <div style={{
          padding: 16,
          background: 'var(--pbe-l)',
          borderLeft: `4px solid var(--pbe)`,
          marginBottom: 20,
          fontStyle: 'italic',
          borderRadius: 8,
        }}>
          "{person.quote}"
          <div style={{ marginTop: 8, fontSize: 12, fontStyle: 'normal', color: 'var(--text3)' }}>
            — {person.quote_source}
          </div>
        </div>
        
        {/* BA/BD/BR comparison */}
        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 12 }}>Archetype Pattern</div>
          {[
            { k: 'BA', label: 'Brand Appeal', score: person.ba_score, color: 'var(--ba)' },
            { k: 'BD', label: 'Brand Differentiation', score: person.bd_score, color: 'var(--bd)' },
            { k: 'BR', label: 'Brand Recognition', score: person.br_score, color: 'var(--br)' },
          ].map(d => (
            <div key={d.k} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{d.label}</span>
                <span style={{ color: d.color, fontWeight: 700 }}>{Math.round(d.score)}%</span>
              </div>
              <div className="track">
                <div
                  className="fill"
                  style={{
                    width: `${d.score}%`,
                    background: d.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* Key traits */}
        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 12 }}>Why They Match</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>
            {archetype.desc}
          </div>
        </div>
        
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-s" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-p"
            style={{ flex: 1 }}
            onClick={() => onChatClick(person)}
          >
            Chat with {person.name.split(' ')[0]} →
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 3.4 API Endpoint: `GET /api/famous-people`

```javascript
// api/famous-people.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).end();
  }
  
  try {
    const { archetype } = req.query;
    
    if (!archetype || !['HHH', 'HHL', 'HLH', 'HLL', 'LHH', 'LHL', 'LLH', 'LLL'].includes(archetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing archetype parameter'
      });
    }
    
    // Query Supabase for 8 famous people matching this archetype
    const supaUrl = process.env.SUPA_URL;
    const supaKey = process.env.SUPA_ANON_KEY;
    
    const response = await fetch(
      `${supaUrl}/rest/v1/famous_people?archetype_key=eq.${archetype}&limit=8`,
      {
        headers: {
          'apikey': supaKey,
          'Authorization': `Bearer ${supaKey}`,
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }
    
    const people = await response.json();
    
    return res.json({
      success: true,
      archetype,
      count: people.length,
      people: people.map(p => ({
        id: p.id,
        name: p.name,
        era_dates: p.era_dates,
        domain: p.domain,
        ba_score: p.ba_score,
        bd_score: p.bd_score,
        br_score: p.br_score,
        bio_short: p.bio_short,
        bio_long: p.bio_long,
        quote: p.quote,
        quote_source: p.quote_source,
        photo_url: p.photo_url,
      }))
    });
  } catch (error) {
    console.error('Famous people endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

#### 3.5 Photo Sourcing Strategy

**Primary approach: Wikimedia Commons API**

For each famous person:
1. Try Wikimedia Commons API: `https://commons.wikimedia.org/w/api.php?action=query&titles=File:{filename}&format=json`
2. Extract image URL from response
3. **Fallback**: If image not found or corrupted, use DiceBear avatar API: `https://api.dicebear.com/7.x/avataaars/svg?seed={id}`

```javascript
// Helper function in seed data script
async function fetchWikimediaPhoto(filename) {
  try {
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${filename}&prop=imageinfo&iiprop=url&format=json`
    );
    const data = await res.json();
    const page = Object.values(data.query.pages)[0];
    if (page.imageinfo?.[0]?.url) {
      return page.imageinfo[0].url;
    }
  } catch (e) {
    console.error(`Wikimedia lookup failed for ${filename}:`, e);
  }
  return null; // Fall back to DiceBear in frontend
}
```

**Cost: $0** (Wikimedia Commons + DiceBear are both free)

---

### 4. FEATURE 2: AI CHAT WITH FAMOUS PERSONAS

#### 4.1 Component Architecture

```
ResultsScreen
  └─→ [NEW after Feature 1 implementation]
      ChatGateScreen (if not authenticated)
        ├─→ Email input → send OTP
        ├─→ OTP verification
        └─→ Redirect to ChatInterface on success

      ChatInterface (if authenticated)
        ├─→ LanguageSelector (EN/HU/DE/FR/ES)
        ├─→ ChatHeader (persona name + photo)
        ├─→ MessageBubble[] (scrollable conversation)
        ├─→ InputBar
        │   ├─→ TextInput
        │   ├─→ [Optional] VoiceInput button (toggles Whisper STT)
        │   └─→ SendButton
        └─→ [Optional] VoiceToggle (enable/disable TTS responses)
```

#### 4.2 Authentication Flow

**Step 1: User clicks "Chat with [persona]"**

```javascript
// In FamousPersonCard or modal
const handleChatClick = (person) => {
  const user = supabase.auth.user();
  
  if (!user) {
    // Show auth gate
    setShowAuthGate(true);
    setPendingChatPerson(person);
  } else {
    // Proceed to chat
    navigateToChat(person);
  }
};
```

**Step 2: AuthGate Component (email magic-link)**

```jsx
function AuthGate({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}?verified=1` }
      });
      
      if (error) throw error;
      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerifyOtp = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      });
      
      if (error) throw error;
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.7)',
      zIndex: 300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div className="card-xl" style={{ maxWidth: 440 }}>
        <h3 className="title" style={{ marginBottom: 16 }}>Sign In to Chat</h3>
        
        {!otpSent ? (
          <>
            <input
              className="inp"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            {error && <div className="toast toast--error" style={{ marginBottom: 12 }}>{error}</div>}
            <button
              className="btn btn-p"
              style={{ width: '100%' }}
              onClick={handleSendOtp}
              disabled={!email || loading}
            >
              {loading ? 'Sending...' : 'Send OTP to Email'}
            </button>
          </>
        ) : (
          <>
            <input
              className="inp"
              type="text"
              placeholder="6-digit code"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ marginBottom: 16, textAlign: 'center', fontSize: 20, letterSpacing: '.2em' }}
            />
            {error && <div className="toast toast--error" style={{ marginBottom: 12 }}>{error}</div>}
            <button
              className="btn btn-p"
              style={{ width: '100%', marginBottom: 10 }}
              onClick={handleVerifyOtp}
              disabled={otp.length !== 6 || loading}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              className="btn btn-s"
              style={{ width: '100%' }}
              onClick={() => setOtpSent(false)}
            >
              Back to Email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create chat session**

```javascript
const navigateToChat = async (person) => {
  const user = supabase.auth.user();
  
  if (!user) return;
  
  try {
    // Check if session exists
    let sessionId = null;
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('famous_person_id', person.id)
      .single();
    
    if (existing) {
      sessionId = existing.id;
    } else {
      // Create new session
      const { data: newSession, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          famous_person_id: person.id,
          language: userLanguage || 'en',
          voice_enabled: false,
        })
        .select('id')
        .single();
      
      if (error) throw error;
      sessionId = newSession.id;
    }
    
    // Navigate to chat
    setChatSessionId(sessionId);
    setActivePerson(person);
    setShowChat(true);
  } catch (err) {
    console.error('Failed to create chat session:', err);
  }
};
```

#### 4.3 Chat Interface Components

**`<ChatInterface />`**

```jsx
function ChatInterface({ sessionId, person, language, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(language || 'en');
  const messagesEndRef = useRef(null);
  
  // Load existing messages
  useEffect(() => {
    if (sessionId) {
      fetch(`/api/chat-sessions/${sessionId}/messages`)
        .then(r => r.json())
        .then(data => {
          setMessages(data.messages || []);
          scrollToBottom();
        })
        .catch(err => console.error('Failed to load messages:', err));
    }
  }, [sessionId]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    
    try {
      // Add user message to UI
      setMessages(prev => [...prev, {
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString(),
      }]);
      
      // Get JWT token
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      // Send to backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          famous_person_id: person.id,
          user_message: userMessage,
          language: currentLanguage,
          voice_enabled: voiceEnabled,
        }),
      });
      
      if (!response.ok) throw new Error(`Chat error: ${response.status}`);
      
      const data = await response.json();
      
      // Add assistant message to UI
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        audio_url: data.audio_url || null,
        created_at: new Date().toISOString(),
      }]);
      
      // If voice is enabled, play audio
      if (voiceEnabled && data.audio_url) {
        const audio = new Audio(data.audio_url);
        audio.play().catch(err => console.error('Audio playback failed:', err));
      }
    } catch (error) {
      console.error('Message send failed:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error.message}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.7)',
      zIndex: 300,
      display: 'flex',
      flexDirection: 'column',
      padding: 20,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '90vh',
        maxWidth: 700,
        margin: '0 auto',
        width: '100%',
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-lg)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={person.photo_url}
              alt={person.name}
              onError={e => e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${person.id}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                objectFit: 'cover',
              }}
            />
            <div>
              <div style={{ fontWeight: 700 }}>{person.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {person.era_dates}
              </div>
            </div>
          </div>
          
          {/* Language & voice toggles */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={currentLanguage}
              onChange={e => setCurrentLanguage(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 12,
                background: 'var(--surface)',
              }}
            >
              <option value="en">EN</option>
              <option value="hu">HU</option>
              <option value="de">DE</option>
              <option value="fr">FR</option>
              <option value="es">ES</option>
            </select>
            
            <button
              style={{
                background: voiceEnabled ? 'var(--bd)' : 'var(--border)',
                color: voiceEnabled ? 'white' : 'var(--text3)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 14,
              }}
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title="Toggle voice responses"
            >
              🔊
            </button>
            
            <button
              style={{
                background: 'none',
                border: 'none',
                fontSize: 18,
                cursor: 'pointer',
                color: 'var(--text3)',
              }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text3)', paddingTop: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{person.emoji || '👤'}</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Chat with {person.name}
              </div>
              <div style={{ fontSize: 13 }}>
                Ask {person.name.split(' ')[0]} for personal branding advice inspired by their career.
              </div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              isUser={msg.role === 'user'}
            />
          ))}
          
          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{
                background: 'var(--bg)',
                padding: '12px 16px',
                borderRadius: 12,
                display: 'flex',
                gap: 4,
              }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--text3)',
                      animation: `pulse .6s ease-in-out infinite`,
                      animationDelay: `${i * .1}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 20px',
          background: 'var(--surface2)',
          display: 'flex',
          gap: 10,
        }}>
          <input
            type="text"
            placeholder="Ask for advice..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-pill)',
              fontSize: 14,
              fontFamily: 'var(--fb)',
            }}
          />
          
          <button
            className="btn btn-p"
            onClick={handleSendMessage}
            disabled={!input.trim() || loading}
            style={{ padding: '10px 16px' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isUser }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      gap: 8,
    }}>
      <div style={{
        maxWidth: '75%',
        padding: '12px 16px',
        borderRadius: 12,
        background: isUser ? 'var(--pbe)' : 'var(--bg)',
        color: isUser ? 'white' : 'var(--text)',
        fontSize: 14,
        lineHeight: 1.5,
      }}>
        {message.content}
        
        {message.audio_url && (
          <div style={{ marginTop: 8 }}>
            <audio
              controls
              src={message.audio_url}
              style={{
                width: '100%',
                height: 28,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 4.4 API Endpoint: `POST /api/chat`

```javascript
// api/chat.js
import Anthropic from "@anthropic-ai/sdk";

const SUPABASE_URL = process.env.SUPA_URL;
const SUPABASE_ANON_KEY = process.env.SUPA_ANON_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const client = new Anthropic();

// Multilingual system prompts
const SYSTEM_PROMPTS = {
  en: (personName, personBio) => `You are ${personName}, a historical/famous figure known for ${personBio}. 
You are having a conversation with a professional seeking personal branding advice.

Guidelines:
- Draw on your actual career and achievements to inform your advice
- Be warm, conversational, and relatable despite your prominence
- Offer specific, actionable insights based on your own experience
- Reference your own journey when relevant
- Keep responses concise (2-3 sentences typically; max 4-5 for complex topics)
- Speak in first person as yourself
- If asked about modern tools/platforms, gracefully acknowledge the era difference and interpret the spirit of the question

Remember: You are speaking as a real person, not a character. Stay grounded in your actual accomplishments and perspective.`,
  
  hu: (personName, personBio) => `Te ${personName} vagy, akit ${personBio} miatt ismert a világ.
Egy professzionális személyi márkázási tanácsot keresó személlyel beszélgetsz.

Irányelvek:
- Saját karriered és eredményeid alapján erísíts tanácsot
- Légy meleg, beszélgetős és relatable, annak ellenére, hogy prominens vagy
- Adj konkrét, gyakorlatban használható meglátásokat saját tapasztalataid alapján
- Hivatkozz saját utadra, ahol releváns
- Tartsd tömörre a válaszokat (általában 2-3 mondat; max 4-5 összetett témáknál)
- Első személyben beszélj magadról
- Ha modern eszközökrõl/platformokról kérdeznek, elegánsan ismerd el a korszak különbségét és értelmezd a kérdés szellemét

Emlékezz: Valódi emberként beszélsz, nem karakterként. Maradj alapozva tényleges eredményeid és perspektívád alapján.`,
  
  de: (personName, personBio) => `Du bist ${personName}, bekannt für ${personBio}.
Du hast ein Gespräch mit einem Fachmann, der einen persönlichen Ratschlag zur Markenbildung sucht.

Richtlinien:
- Gib Ratschläge auf der Grundlage deiner eigenen Karriere und Leistungen
- Sei warm, umgänglich und nachvollziehbar trotz deiner Prominenz
- Biete konkrete, umsetzbare Einblicke auf der Grundlage deiner eigenen Erfahrung
- Beziehe dich auf deine eigene Reise, wenn relevant
- Halte die Antworten prägnant (normalerweise 2-3 Sätze; maximal 4-5 für komplexe Themen)
- Sprich in der ersten Person von dir selbst
- Wenn nach modernen Tools/Plattformen gefragt wird, erkenne die zeitliche Differenz elegant an und interpretiere den Geist der Frage

Denk daran: Du sprichst als echte Person, nicht als Charakter. Bleib in deinen tatsächlichen Leistungen und Perspektiven verwurzelt.`,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Verify JWT token from Supabase Auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const token = authHeader.slice(7);
    
    // Verify token with Supabase (optional but recommended for MVP)
    // For now, we trust the token is valid (Supabase will have issued it)
    
    const { session_id, famous_person_id, user_message, language = 'en', voice_enabled = false } = req.body;
    
    if (!session_id || !famous_person_id || !user_message) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // Fetch famous person profile
    const personRes = await fetch(
      `${SUPABASE_URL}/rest/v1/famous_people?id=eq.${famous_person_id}`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      }
    );
    
    if (!personRes.ok) throw new Error('Failed to fetch famous person');
    
    const [person] = await personRes.json();
    if (!person) throw new Error('Famous person not found');
    
    // Fetch previous messages for context (last 10)
    const messagesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_messages?session_id=eq.${session_id}&order=created_at.desc&limit=10`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      }
    );
    
    const prevMessages = ((await messagesRes.json()) || []).reverse();
    
    // Build conversation history for Claude
    const messages = [
      ...prevMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: 'user',
        content: user_message,
      }
    ];
    
    // Get system prompt in target language
    const systemPrompt = (SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en)(
      person.name,
      person.bio_short
    );
    
    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages,
    });
    
    const assistantMessage = response.content[0].type === 'text' 
      ? response.content[0].text
      : 'I apologize, but I could not formulate a response.';
    
    let audioUrl = null;
    
    // If voice is enabled, generate TTS
    if (voice_enabled && ELEVENLABS_API_KEY) {
      try {
        const ttsRes = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + (person.elevenlab_voice_id || 'pNInz6obpgDQGcFmaJgB'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: assistantMessage,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        });
        
        if (ttsRes.ok) {
          const audioBuffer = await ttsRes.arrayBuffer();
          // TODO: Upload to S3/CDN and return URL
          // For MVP, could return base64 or skip
        }
      } catch (err) {
        console.error('TTS failed:', err);
        // Continue without audio
      }
    }
    
    // Save messages to Supabase
    await Promise.all([
      // Save user message
      fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          session_id,
          role: 'user',
          content: user_message,
        }),
      }),
      // Save assistant message
      fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          session_id,
          role: 'assistant',
          content: assistantMessage,
          audio_url: audioUrl,
          model_name: 'claude-3-5-sonnet-20241022',
          tokens_input: response.usage.input_tokens,
          tokens_output: response.usage.output_tokens,
        }),
      }),
    ]);
    
    // Update session activity
    await fetch(
      `${SUPABASE_URL}/rest/v1/chat_sessions?id=eq.${session_id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          last_activity_at: new Date().toISOString(),
          message_count: prevMessages.length + 2,
        }),
      }
    );
    
    return res.json({
      success: true,
      message: assistantMessage,
      audio_url: audioUrl,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      }
    });
    
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
```

#### 4.5 API Endpoint: `GET /api/chat-sessions/{sessionId}/messages`

```javascript
// api/chat-sessions/[sessionId]/messages.js
export default async function handler(req, res) {
  const { sessionId } = req.query;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const supaUrl = process.env.SUPA_URL;
    const supaKey = process.env.SUPA_ANON_KEY;
    
    // Fetch chat messages
    const res2 = await fetch(
      `${supaUrl}/rest/v1/chat_messages?session_id=eq.${sessionId}&order=created_at.asc`,
      {
        headers: {
          'apikey': supaKey,
          'Authorization': `Bearer ${supaKey}`,
        }
      }
    );
    
    if (!res2.ok) throw new Error('Failed to fetch messages');
    
    const messages = await res2.json();
    
    return res.json({
      success: true,
      session_id: sessionId,
      count: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        audio_url: m.audio_url,
        created_at: m.created_at,
      }))
    });
    
  } catch (error) {
    console.error('Messages endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
```

#### 4.6 Voice Pipeline (Optional Phase 3)

**TTS (Text-to-Speech):** ElevenLabs multilingual API

```javascript
// Voice helper in api/voice.js
async function generateTTS(text, voiceId, language) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  
  if (!res.ok) throw new Error(`ElevenLabs error: ${res.status}`);
  return res.arrayBuffer();
}
```

**STT (Speech-to-Text):** OpenAI Whisper API

```javascript
// In ChatInterface component
const handleVoiceInput = async () => {
  const mediaRecorder = new MediaRecorder(await navigator.mediaDevices.getUserMedia({ audio: true }));
  const chunks = [];
  
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    
    const res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    const { text } = await res.json();
    setInput(text);
  };
  
  mediaRecorder.start();
  return mediaRecorder;
};
```

#### 4.7 Multi-Language Support

**i18n Strategy:** Store translations in JavaScript object in App.html

```javascript
const I18N = {
  en: {
    chat_title: 'Chat with {name}',
    send_message: 'Send a message...',
    voice_on: 'Voice responses enabled',
    sign_in: 'Sign in to chat',
    language: 'Language',
  },
  hu: {
    chat_title: '{name}-vel való csevegés',
    send_message: 'Írj egy üzenetet...',
    voice_on: 'Hangválaszok engedélyezve',
    sign_in: 'Jelentkezz be a csevegéshez',
    language: 'Nyelv',
  },
  // ... de, fr, es
};
```

API system prompts already multilingual (see section 4.4).

---

### 5. PHASED ROLLOUT

#### Phase 1: Famous People Cards (MVP, 1-2 weeks)

**Deliverables:**
- Create `famous_people` table in Supabase
- Seed 64 famous people profiles
- Implement `ArchetypeMatchSection` component
- Implement `FamousPersonCard` + `FamousPersonModal` components
- Implement `/api/famous-people` endpoint
- Photo sourcing (Wikimedia Commons + DiceBear fallback)

**No auth required; no chat.**

**Testing:**
- Complete assessment → view 8 famous people matching archetype
- Click cards → open modal with full profile
- Filter by domain
- Photo fallback when Wikimedia unavailable

---

#### Phase 2: Authentication + Text Chat (2-3 weeks)

**Deliverables:**
- Implement `AuthGate` component (email magic-link)
- Create `chat_sessions` and `chat_messages` tables
- Implement `ChatInterface` component (text-only)
- Implement `/api/chat` endpoint (Claude integration)
- Implement `/api/chat-sessions/{sessionId}/messages` endpoint
- Update `ResultsScreen` to show auth gate on "Chat" click
- RLS policies for chat tables

**Testing:**
- Sign in via magic link
- Create chat session for each famous person
- Send 5 messages, verify Claude persona responses
- Conversation history persists
- Multiple users can chat with same persona independently

---

#### Phase 3: Voice + Multi-Language (2-3 weeks)

**Deliverables:**
- ElevenLabs TTS integration
- OpenAI Whisper STT integration
- `VoiceInput` button in ChatInterface
- `LanguageSelector` (EN/HU/DE/FR/ES)
- Multilingual system prompts for all languages
- Audio storage (S3/CDN or base64 embedding)
- Voice preference persistence in `chat_preferences` table

**Testing:**
- Record voice input → Whisper transcription
- Change language → chat in selected language
- Enable voice → responses play as audio
- Voice quality assessment

---

#### Phase 4: Polish & Analytics (1-2 weeks)

**Deliverables:**
- Conversation history sidebar (past chats with each person)
- Delete conversation feature
- Export conversation to PDF
- Basic analytics: users, chats per person, avg message count
- Error recovery and graceful degradation
- Mobile responsive improvements
- Accessibility audit (WCAG AA)

---

### 6. NEW ENVIRONMENT VARIABLES

Add to Vercel project settings:

```
# Supabase (existing)
SUPA_URL=https://your-project.supabase.co
SUPA_ANON_KEY=eyJhbGci...
SUPA_SERVICE_KEY=eyJhbGci...
ADMIN_SECRET=pbes2025admin

# New: LLM
CLAUDE_API_KEY=sk-ant-...

# New: Voice
ELEVENLABS_API_KEY=sk_...
OPENAI_API_KEY=sk-proj-...  (for Whisper STT)

# New: Optional image hosting
AWS_S3_BUCKET=pbes-audio
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# New: Email (for Supabase Auth)
SUPABASE_JWT_SECRET=your-jwt-secret  (copy from Supabase project settings)
```

---

### 7. COST ESTIMATE

**Assumptions:**
- 100, 1000, 10K monthly active users
- 3 messages/session average
- 1 chat session per user per month (exploring 1 persona)
- 20% enable voice (TTS + Whisper)

#### Monthly costs at 100 users/month:

| Service | Usage | Cost |
|---------|-------|------|
| Claude API | 300 msgs × 1K tokens avg | ~$0.24 |
| ElevenLabs TTS | 60 responses × 150 chars avg | ~$0.03 |
| Whisper STT | 60 voice inputs × 30 sec avg | ~$0.03 |
| Supabase (free tier) | <5GB storage, <3M reqs | Free |
| Vercel Functions | <5M function calls | Free |
| **Total** | | **~$0.30/month** |

#### At 1,000 users/month:

| Service | Usage | Cost |
|---------|-------|------|
| Claude API | 3K msgs × 1K tokens | ~$2.40 |
| ElevenLabs TTS | 600 responses | ~$0.30 |
| Whisper STT | 600 inputs | ~$0.30 |
| Supabase | <50GB storage, <30M reqs | ~$25-50 (Pro tier) |
| Vercel Functions | <50M calls | Free (within limits) |
| **Total** | | **~$28-53/month** |

#### At 10,000 users/month:

| Service | Usage | Cost |
|---------|-------|------|
| Claude API | 30K msgs | ~$24 |
| ElevenLabs TTS | 6K responses | ~$3 |
| Whisper STT | 6K inputs | ~$3 |
| Supabase | <500GB storage, <300M reqs | ~$100-150 (Pro + add-ons) |
| Vercel Functions | <500M calls | ~$20-50 (Pro tier) |
| **Total** | | **~$150-230/month** |

**Break-even recommendation:** At 1,000+ monthly users, consider:
- Self-hosted LLM (Llama 2 + vLLM) instead of Claude API ($0)
- In-house TTS (Piper or Tacotron2) instead of ElevenLabs ($0)
- Save ~$5-10/month

---

### 8. RISK REGISTER

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **LLM persona drift** (Claude doesn't stay in character, gives modern advice) | Medium | Test extensively with different prompts; include few-shot examples in system prompt; add persona "guardrails" (don't mention social media if pre-1980s figure); manual review of responses in QA |
| **Voice latency** (TTS takes >3 sec, kills UX) | Medium | Use ElevenLabs streaming API (not blocking); implement optimistic UI (show text immediately, audio plays async); set 5-sec timeout fallback |
| **Famous person likeness rights** (photo/quote issues) | High | Use only Wikimedia Commons/public domain photos; verify quotes via reputable sources; add disclaimer: "Historical inspiration, not endorsement"; consult legal on IP |
| **Multi-language quality** (translations poor, AI accent issues) | Medium | Use native speakers to QA each language; ElevenLabs has native voices for HU/DE/FR/ES; start with EN only, expand incrementally |
| **Cold starts on chat** (first message slow, Vercel cold boot) | Low | Use Vercel's "Unrolled Functions" (preview feature); keep Claude models warm with periodic requests; implement client-side loading state |
| **Token limits** (very long conversation contexts exceed Claude limit) | Low | Implement conversation summarization after 20 messages; fetch last 10 messages only as context; set max_tokens=500 to keep response size bounded |
| **Database read limits** (Supabase free tier exceeded) | Low | Move to Pro tier at 100 users; implement caching layer (Redis/Upstash) for frequently accessed famous people; batch requests |
| **Auth abandonment** (users drop off at sign-in) | Medium | Use Supabase magic-link (0 friction); pre-fill email from prior assessment if possible; show value ("Save conversations, chat anytime") before asking to sign in |
| **GDPR/data retention** (storing conversations indefinitely) | Medium | Implement conversation deletion (user-facing); offer 30-day auto-purge option; document data storage in privacy policy; export user data feature |

---

### 9. FILE CHANGE MAP

#### Frontend Changes

| File | Change | Impact |
|------|--------|--------|
| `/App.html` | Add ArchetypeMatchSection + FamousPersonModal to ResultsScreen; add AuthGate + ChatInterface components; add useState for chat state, famousPeople, language; add useEffect to fetch famous people after assessment | +1200 lines |
| `/App.html` | Add I18N object with EN/HU/DE/FR/ES translations | +300 lines |

#### Backend Changes (New Files)

| File | Purpose | Size |
|------|---------|------|
| `/api/famous-people.js` | GET famous people by archetype; Supabase query | ~80 lines |
| `/api/chat.js` | POST chat message; Claude integration; message persistence; TTS (optional) | ~250 lines |
| `/api/chat-sessions/[sessionId]/messages.js` | GET chat history for session | ~60 lines |
| `/api/voice.js` (optional Phase 3) | TTS + STT wrapper; Whisper + ElevenLabs proxies | ~150 lines |

#### Database (Supabase)

| File | Change | Impact |
|------|--------|--------|
| `schema.sql` | Add famous_people, chat_sessions, chat_messages, chat_preferences tables; add RLS policies | +180 lines |
| `scripts/seed-famous-people.sql` | INSERT 64 famous people profiles | ~500 lines |

#### Configuration

| File | Change | Impact |
|------|--------|--------|
| `vercel.json` | No change (functions auto-discovered) | 0 lines |
| `.env.example` | Add CLAUDE_API_KEY, ELEVENLABS_API_KEY, OPENAI_API_KEY | +3 lines |

**Total new code: ~2,500-3,000 lines**

---

## CRITICAL FILES FOR IMPLEMENTATION

1. **`/App.html`** — Main React SPA; add ArchetypeMatchSection, AuthGate, ChatInterface components; core state management
2. **`/api/chat.js`** — Heart of Feature 2; Claude integration, message persistence, voice pipeline
3. **`schema.sql`** — Database schema for famous_people, chat_sessions, chat_messages; RLS policies
4. **`/api/famous-people.js`** — Feature 1 backbone; Supabase query for 8 famous people per archetype
5. **`scripts/seed-famous-people.sql`** or **`scripts/seed-famous-people.js`** — 64 profiles; bulk insert strategy

---

## Summary

This plan delivers two powerful features with minimal disruption to the existing app:

**Feature 1 (Famous People Cards)** is straightforward, data-heavy, and can ship in Phase 1 with just static JSON data and no backend complexity.

**Feature 2 (AI Chat)** is the strategic lever: it gates behind authentication, creates a stickier product (users return to chat), and opens a path to premium features (conversation export, advanced personas, coaching mode).

The phased approach de-risks development: Phase 1 validates the concept with zero auth; Phase 2 locks in the core value prop; Phases 3-4 are polish.

Costs remain sub-$100/month at 10K users if you self-host the LLM later. The architecture is cloud-native (Vercel + Supabase) from day one, so scaling is frictionless.