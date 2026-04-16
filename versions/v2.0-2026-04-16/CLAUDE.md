# Personal Branding Kalkulator — Project Context & Superpowers

## Project Overview

A Myers-Briggs-style **Personal Brand Equity (PBE) Calculator** built on Péter Szántó's PhD dissertation *"Understanding and Quantifying Personal Branding"* (Budapest Business University, Doctoral School of Entrepreneurship and Business).

The app measures a person's Personal Brand Equity across three scientifically validated dimensions using a slider-based questionnaire (inspired by 16personalities.com), assigns one of 8 **Personal Brand Archetypes**, and delivers specific, data-driven development recommendations.

---

## Core Model: Personal Brand Equity Scale (PBES)

### The Three Dimensions of Personal Brand Equity

**1. Brand Appeal (BA)** — *How compelling and positively perceived is the person?*
- Sub-variables: Image, Reputation, Likability, Credibility, Impression Management, Status
- Measures: Professional image, personal story clarity, value alignment, distinctiveness of work

**2. Brand Differentiation (BD)** — *How uniquely valuable is what they offer?*
- Sub-variables: Expertise, Legitimacy, Visibility, Trustworthiness, Knowledge, Branding, Online Presence
- Measures: Reputation for high-value results, expertise access, professional value delivery, preference as a collaborator

**3. Brand Recognition (BR)** — *How well-known are they in their field?*
- Sub-variables: Pedigree, Fame, Relationships, Celebrity, Industry Fit, Networking, Online Presence
- Measures: Known-ness in field, expert status, contact frequency, recommendation frequency, online profile strength

### Key Statistical Findings (from dissertation)
```
BA → BD:  β = 0.781  *** (extremely strong — appeal drives differentiation)
BA → BR:  β = 0.376  ***
BD → BR:  β = 0.347  ***

sPBE ↔ ePBE: r = 0.631 (self and external ratings strongly correlate)
Overall PBE positively correlates with career success metrics
```

### Two PBE Types
- **sPBE** (self-rated Personal Brand Equity): Individual's own assessment
- **ePBE** (externally-rated): How colleagues/peers rate the individual

Because sPBE and ePBE are highly correlated (r=0.631), self-assessment is a valid proxy for external perception.

---

## The 28-Question Instrument

### Brand Appeal (BA) — 8 questions
| # | Statement | Variable | PBE Type |
|---|-----------|----------|----------|
| 1 | I have a positive professional image among others. | Image | external |
| 2 | I am appealing to work with. | Likability | self |
| 3 | My professional story is clear to others. | Credibility | self |
| 4 | My personal values are reflected in my work. | Impression Management | self |
| 5 | My professional strengths are clear to others. | Status | external |
| 6 | My work stands out from the work of others. | Impression Management | self |
| 7 | My work is distinctly recognizable. | Status | external |
| 8 | My work has a distinctive personal style. | Reputation | external |

### Brand Differentiation (BD) — 8 questions
| # | Statement | Variable | PBE Type |
|---|-----------|----------|----------|
| 9  | I have a reputation for producing high value results. | Expertise | self |
| 10 | My work is highly valued by others. | Trustworthiness | self |
| 11 | Working with me provides access to my expertise. | Knowledge | self |
| 12 | I am regarded as delivering higher professional value compared to others. | Branding | self |
| 13 | Working with me is a rewarding experience. | Trustworthiness | self |
| 14 | Being associated with me offers clear professional benefits. | Online Presence | external |
| 15 | I am a preferred candidate for important projects and tasks. | Knowledge | self |
| 16 | I am considered a stronger professional than most in my field. | Legitimacy | external |

### Brand Recognition (BR) — 8 questions
| # | Statement | Variable | PBE Type |
|---|-----------|----------|----------|
| 17 | I am known in my professional field. | Fame | external |
| 18 | My name is well known in my professional field. | Relationships | self |
| 19 | I am known beyond my immediate professional network. | Celebrity | external |
| 20 | I am regarded as an expert in my professional domain. | Industry Fit | external |
| 21 | I am frequently contacted by others for professional advice or services. | Networking | self |
| 22 | I am often recommended by others to their professional contacts. | Relationships | self |
| 23 | I am more likely to succeed professionally than others in my field. | Pedigree | self |
| 24 | My professional online profile has endorsements and recommendations. | Online Presence | external |

### Brand Intentionality (BI) — 4 questions (enriches recommendations, not used for archetype typing)
| # | Statement |
|---|-----------|
| 25 | I actively manage and develop my personal brand. |
| 26 | I have a clear strategy for increasing my professional visibility. |
| 27 | I regularly create and share content to build my professional reputation. |
| 28 | I consciously work on expanding and deepening my professional network. |

### Scoring Algorithm
```
Raw score per question: 1-5 (Likert)
Normalized score: (raw - 1) / 4 × 100  →  range: 0–100
Dimension score: mean of all questions in that dimension
Archetype threshold: score ≥ 60 = "High", score < 60 = "Low"

Overall PBE (weighted by regression coefficients):
  PBE = (BA × 0.45) + (BD × 0.35) + (BR × 0.20)
```

---

## The 8 Personal Brand Archetypes

Based on High (H ≥ 60) or Low (L < 60) scores on BA, BD, BR:

| BA | BD | BR | Archetype Name | Core Focus |
|----|----|----|----------------|------------|
| H  | H  | H  | **The Brand Champion** | Scale and sustain |
| H  | H  | L  | **The Magnetic Expert** | Boost visibility |
| H  | L  | H  | **The Charismatic Networker** | Deepen expertise |
| H  | L  | L  | **The Rising Star** | Build depth + visibility |
| L  | H  | H  | **The Distinguished Authority** | Add personal appeal |
| L  | H  | L  | **The Hidden Gem** | Increase visibility + appeal |
| L  | L  | H  | **The Recognized Professional** | Add depth and appeal |
| L  | L  | L  | **The Emerging Brand** | Build all three foundations |

### Archetype Profiles

#### The Brand Champion (HHH)
You possess the complete trifecta of personal brand equity. Your professional image is compelling, your expertise is distinctly differentiated, and you're recognized across your industry.
- **Strengths**: All-around strong brand, natural influencer, sought after by clients and employers
- **Growth areas**: Sustaining momentum, evolving with industry changes, giving back through mentorship
- **Key recommendations**: Author a book or signature course; keynote at major conferences; build strategic thought-leader partnerships; create a personal brand advisory board; invest in visual brand consistency.

#### The Magnetic Expert (HHL)
You're both appealing and highly differentiated — people love working with you and you deliver clear, unique value. Not enough people outside your immediate circle know about you yet.
- **Strengths**: Deep expertise, strong relationships, high client satisfaction
- **Growth areas**: Industry visibility, public thought leadership, online presence
- **Key recommendations**: Publish on LinkedIn 2-3x per week; speak at 3-5 conferences per year; pitch podcasts in your niche; optimize LinkedIn with accomplishment-focused language; build a case study portfolio.

#### The Charismatic Networker (HLH)
You're visible and likable — people know you and enjoy your company. Your next growth phase requires deepening your expertise and creating a clearer value proposition.
- **Strengths**: Strong network, excellent likability reputation, good industry visibility
- **Growth areas**: Specialized expertise, unique value proposition, content authority
- **Key recommendations**: Choose one niche and commit to becoming the go-to expert; invest in certifications or postgraduate study; create a signature methodology; document unique insights in writing; find a mentor who is a recognized domain authority.

#### The Rising Star (HLL)
You have a magnetic quality that draws people in. Channel that energy into building deeper expertise and becoming more visible beyond your immediate circle.
- **Strengths**: Natural likability, positive professional image, strong growth foundation
- **Growth areas**: Expertise development, industry visibility, online presence
- **Key recommendations**: Identify your core expertise and create a 12-month learning roadmap; document your learning journey publicly; seek stretch projects; join a mastermind group; activate your network deliberately (1 new connection per week).

#### The Distinguished Authority (LHH)
You're a recognized expert with strong differentiated position. Colleagues and clients value your expertise and your reputation precedes you. Adding warmth and a compelling personal narrative will unlock the next level.
- **Strengths**: Deep expertise, strong recognition, high professional value delivery
- **Growth areas**: Personal appeal, storytelling, relationship warmth
- **Key recommendations**: Work with a communications coach; blend professional insights with personal perspective on social media; mentor others to build warmth; actively network at events (not just speak); invest in professional photography and visual brand refresh.

#### The Hidden Gem (LHL)
You have exceptional expertise and deliver outstanding value. Too few people know about you. You're the best-kept secret in your field — and it's time to change that.
- **Strengths**: Deep expertise, high-quality work, strong value delivery
- **Growth areas**: Visibility, appeal, overcoming reluctance to self-promote
- **Key recommendations**: Commit to weekly LinkedIn posting; write about your process and unique insights; join professional associations and take leadership roles; collect LinkedIn recommendations; partner with someone who has complementary visibility for collaboration.

#### The Recognized Professional (LLH)
You're known in your field, but your brand lacks the depth and personal warmth that creates true influence. Time to build substance behind the recognition.
- **Strengths**: Industry visibility, professional recognition, established presence
- **Growth areas**: Depth of expertise, personal appeal, value proposition clarity
- **Key recommendations**: Define and communicate your signature expertise consistently; invest in one deep specialty area; work on intentional relationship-building; create original insights (not just curated content); develop a clear "professional promise" — what people can always count on you for.

#### The Emerging Brand (LLL)
At the beginning of an exciting journey. Every great personal brand started at zero. With a clear direction and consistent effort, you can build something remarkable.
- **Strengths**: Fresh perspective, high growth potential, opportunity to build intentionally from scratch
- **Growth areas**: All three dimensions — appeal, differentiation, and recognition
- **Key recommendations**: Define your professional identity (what do you want to be known for in 3 years?); optimize LinkedIn profile completely; choose one expertise area and start creating content; set a goal of 10 meaningful new connections per month; find a role model whose personal brand you admire and study their approach.

---

## Application Modes

### Individual Mode
1. Self-assessment: 28-question Myers-Briggs-style questionnaire
2. Optional: Share link with peers for external ratings
3. Optional: Add social media profiles for enrichment
4. Results: Archetype + dimension scores + personalized recommendations

### Organizational Mode
1. Admin creates organization and invites team members
2. Each member completes self-assessment
3. Optional: Peer-rating (members rate each other)
4. Team dashboard: Aggregate brand profiles, team composition insights
5. Manager view: Development opportunities by person and team
6. Export: PDF report per person or team summary

---

## External Data Integration (Social Profile Scraping)

### Planned Sources
| Platform | Data Points | Affects |
|----------|-------------|---------|
| LinkedIn | Connections, endorsements, recommendations, posts, engagement | BA, BD, BR |
| Twitter/X | Followers, engagement rate, content themes | BA, BR |
| Facebook | Professional presence, page followers | BA, BR |
| Google Scholar | Publications, citations, h-index | BD (expertise) |
| ResearchGate | Academic profile metrics | BD (expertise) |
| Conference databases | Speaking history, presentation count | BR, BD |

### Score Adjustment Logic
```
LinkedIn endorsements (>10): +5% BD
LinkedIn recommendations (>3): +5% BA
LinkedIn followers (>500): +5% BR
Twitter followers (>1000): +10% BR
Academic publications (>0): +10% BD per 5 papers
Conference presentations (>0): +5% BR per presentation
h-index (>5): +15% BD
```

---

## Technical Architecture

### Current Build
- **Frontend**: React single-page app (JSX) with Tailwind CSS
- **State management**: React hooks (useState, useReducer)
- **Visualization**: recharts for dimension bars
- **Animation**: CSS keyframes + inline transitions

### Planned Backend
- **API**: Python FastAPI
- **Database**: PostgreSQL (users, organizations, assessments, peer ratings)
- **Cache**: Redis (session data, scraping results)
- **Scraping**: Playwright + BeautifulSoup (social profiles), Scholarly (Google Scholar)
- **Auth**: JWT + OAuth (LinkedIn SSO)
- **Hosting**: Docker + cloud deployment

### Database Schema (planned)
```sql
users (id, email, name, org_id, role, created_at)
organizations (id, name, plan, admin_id)
assessments (id, user_id, type[self|peer], target_user_id, scores_json, archetype, created_at)
social_profiles (user_id, platform, url, scraped_data_json, last_scraped)
peer_invitations (id, from_user_id, to_email, assessment_id, completed_at)
```

---

## MBTI Analogy Mapping

| MBTI | PBES Analog | Description |
|------|-------------|-------------|
| E/I (Energy) | BA high/low | High BA = outwardly appealing; Low BA = more internal focus |
| S/N (Information) | BD high/low | High BD = concrete expertise; Low BD = still building |
| T/F (Decisions) | Results vs. Relationships | Hard metrics vs. soft relationships |
| J/P (Lifestyle) | BI high/low | Strategic/planned (J) vs. Natural/organic (P) branding |
| 16 Types | 8 Archetypes | 3 dimensions × High/Low = 8 types |

---

## Superpower Configuration

Claude working on this project has special knowledge of:

1. **Complete PBES Instrument**: All 36+ variable pool questions from Appendix 1, mapped to dimensions, with variable names and self/external PBE classification
2. **Statistical Model**: Regression coefficients (BA→BD β=0.781, BA→BR β=0.376, BD→BR β=0.347), correlation between sPBE and ePBE (r=0.631)
3. **Archetype System**: Full profiles for all 8 archetypes including descriptions, strengths, growth areas, and 5 specific recommendations each
4. **Questionnaire Design**: 28-question instrument with scoring algorithm calibrated to the dissertation's findings
5. **MBTI Methodology**: 16personalities.com UX patterns (slider questions, progress bar, animated reveal, dimension bars, profile pages with strengths/careers/relationships sections)
6. **Frontend-Design Skill**: Production-grade UI with distinctive aesthetics, avoiding generic patterns
7. **Social Scraping Plan**: Which platforms to scrape, what data points to collect, and how they adjust scores
8. **Organizational Mode**: Multi-tenancy design, peer-rating system, admin dashboard concept

---

## File Structure

```
Personal Branding kalkulátor/
├── CLAUDE.md                          ← This file (project context)
├── App.jsx                            ← Main React application
├── implementation-plan.md            ← Detailed technical plan
└── Disszertáció Final!.pdf           ← Source PhD dissertation (read-only)
```

---

## Key Design Principles

1. **Scientifically grounded**: Every archetype, question, and recommendation is rooted in the PBES model
2. **Myers-Briggs UX inspiration**: Slider questions, progress bar, dramatic type reveal, detailed profile with sections
3. **Actionable output**: Specific, personalized, prioritized recommendations for each archetype
4. **Dual-rating**: Both self-assessment and peer ratings supported (like sPBE and ePBE in the dissertation)
5. **External enrichment**: Social profile data adds a third data source beyond self and peer ratings
6. **Organizational scalability**: Multi-user and team features planned from the start

---

*Project by Péter Szántó | Based on PhD dissertation "Understanding and Quantifying Personal Branding" | Budapest Business University, Doctoral School of Entrepreneurship and Business*
