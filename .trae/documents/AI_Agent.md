# Habyss AI Agent Implementation Specification

## Executive Summary
Implement an intelligent, context-aware AI agent that lives within the Habyss app as a floating assistant. Users can tap the logo to interact with an AI that understands their goals, analyzes their data, and creates personalized habit sequences optimized for success.

---

## UI/UX Design Specifications

### Floating Logo Button

**Visual Design:**
- Position: Bottom-right corner (adjustable, draggable by user)
- Size: 56dp x 56dp (standard FAB size)
- Logo: Habyss "H" hexagon with gradient (blue #4A6FA5 to #7B9FD3)
- Shadow: Elevation 6dp with subtle glow effect
- Animation: Gentle breathing animation (scale 1.0 to 1.05, 2s cycle)
- State indicators:
  - Idle: Breathing animation
  - Thinking: Pulsing glow effect
  - New suggestion: Small red notification dot
  - Processing: Circular progress indicator around edge

**Interaction States:**
- Tap: Opens AI modal
- Long press: Quick action menu (analyze progress, suggest habits, view insights)
- Drag: Repositions button (snaps to corners or edges)
- Haptic feedback on all interactions

**Accessibility:**
- Content description: "Habyss AI Assistant"
- Minimum touch target: 48dp x 48dp
- High contrast mode support
- Screen reader compatible

---

### AI Modal Interface

**Modal Design:**
- Presentation: Bottom sheet (Android) / Modal sheet (iOS)
- Height: 75% of screen, expandable to fullscreen
- Corner radius: 24dp top corners
- Backdrop: Semi-transparent blur (#000000 40% opacity)
- Dismissible: Swipe down or tap backdrop

**Modal Header:**
```
┌─────────────────────────────────────┐
│  🤖 Habyss AI Assistant             │
│  Here to help you build better      │
│  habits based on your goals         │
│                                  [✕] │
└─────────────────────────────────────┘
```

**Modal Components:**

1. **Conversation Area** (60% height)
   - Messages displayed in chat format
   - AI messages: Left-aligned, light background
   - User messages: Right-aligned, accent color background
   - Typing indicator: Animated dots while AI processes
   - Rich content support: Cards, buttons, habit previews
   - Auto-scroll to latest message
   - Timestamp on each message

2. **Quick Action Chips** (Above input)
   - "Create habit sequence from goal"
   - "Analyze my progress"
   - "Suggest improvements"
   - "Review my habits"
   - Horizontally scrollable
   - Context-aware suggestions based on user data

3. **Input Area** (Bottom, 40% height when keyboard visible)
   - Multi-line text input with auto-expand
   - Placeholder: "Ask me anything about your habits..."
   - Send button: Icon changes to microphone when empty (voice input)
   - Attachment button: Share goal details, screenshots
   - Character counter (appears after 200 chars)

4. **Context Banner** (Collapsible)
   - Shows relevant context: "I can see you have 3 active goals"
   - Current streak info
   - Recent achievements
   - Tappable to expand full context view

---

## AI Agent Core Capabilities

### 1. Natural Language Understanding (NLU)

**Intent Recognition:**
- Goal creation and modification
- Habit sequence generation
- Progress analysis requests
- Troubleshooting and optimization
- Motivational support
- Schedule adjustments
- Integration management
- Data insights and reports

**Entity Extraction:**
- Goal types: fitness, learning, financial, wellness, productivity
- Time frames: daily, weekly, monthly, quarterly, yearly
- Metrics: steps, hours, pages, dollars, workouts, sessions
- Preferences: morning/evening person, intensity level, available time
- Constraints: budget, time availability, physical limitations

**Sentiment Analysis:**
- Detect frustration or discouragement
- Recognize excitement and motivation
- Adjust tone and suggestions accordingly
- Provide empathetic responses

### 2. Goal Analysis & Understanding

**Goal Decomposition Engine:**
```python
class GoalAnalyzer:
    def analyze_goal(self, goal_text, user_context):
        """
        Parse user goal and extract actionable components
        """
        components = {
            'primary_objective': str,      # Main goal
            'target_metrics': dict,        # Measurable outcomes
            'timeline': datetime,          # Goal deadline
            'difficulty': float,           # 0-1 scale
            'category': str,              # Goal domain
            'sub_goals': list,            # Breakdown of goal
            'dependencies': list,         # Required prerequisites
            'obstacles': list,            # Predicted challenges
            'success_indicators': list    # How to measure success
        }
        return components
```

**Goal Examples with AI Processing:**

Example 1: "I want to lose 20 pounds in 6 months"
- Primary: Weight loss
- Metrics: -20 lbs, 6 months
- Sub-goals: Calorie deficit, exercise routine, sleep optimization
- Habits generated: Daily weigh-in, meal tracking, 3x weekly cardio, 2x weekly strength training, 7-8 hours sleep

Example 2: "Learn Spanish to conversational fluency by summer"
- Primary: Language acquisition
- Metrics: B1-B2 level, ~5 months
- Sub-goals: Vocabulary (1500 words), grammar basics, speaking practice
- Habits generated: 30min daily Duolingo, 15min conversation practice, 1hr weekly iTalki session, daily Spanish podcast listening

Example 3: "Save $10,000 for emergency fund this year"
- Primary: Financial security
- Metrics: $10k saved, 12 months
- Sub-goals: Budget creation, expense reduction, income increase
- Habits generated: Weekly budget review, daily expense tracking, bi-weekly savings transfer, monthly financial check-in

### 3. Habit Sequence Generation

**Sequencing Algorithm:**

```python
class HabitSequenceGenerator:
    """
    Generates scientifically-backed habit sequences
    """
    
    def generate_sequence(self, goal, user_profile):
        # Phase 1: Foundation Building (Week 1-2)
        foundation_habits = self.create_keystone_habits(
            difficulty='easy',
            frequency='daily',
            time_investment='5-10 minutes'
        )
        
        # Phase 2: Core Habits (Week 3-6)
        core_habits = self.create_primary_habits(
            difficulty='moderate',
            frequency='daily',
            time_investment='15-30 minutes',
            builds_on=foundation_habits
        )
        
        # Phase 3: Optimization (Week 7+)
        advanced_habits = self.create_advanced_habits(
            difficulty='challenging',
            frequency='3-5x weekly',
            time_investment='30-60 minutes',
            builds_on=core_habits
        )
        
        return self.sequence_with_progressive_overload(
            [foundation_habits, core_habits, advanced_habits]
        )
```

**Habit Sequencing Principles:**

1. **Start Small (Atomic Habits Methodology)**
   - Begin with habits taking < 2 minutes
   - Build momentum before complexity
   - Early wins boost motivation

2. **Habit Stacking**
   - Attach new habits to existing routines
   - Use environmental cues
   - Create implementation intentions

3. **Progressive Overload**
   - Gradually increase difficulty
   - Add habits only after previous ones stabilize (2-3 week intervals)
   - Monitor completion rates before advancing

4. **Time Optimization**
   - Schedule habits at biologically optimal times
   - Consider chronotype (morning/evening person)
   - Account for energy levels throughout day

5. **Variety and Engagement**
   - Mix habit types to prevent boredom
   - Include both process and outcome habits
   - Balance challenging and enjoyable activities

**Generated Sequence Example:**
```json
{
  "goal": "Run a marathon in 6 months",
  "sequence": [
    {
      "phase": 1,
      "name": "Foundation",
      "duration_weeks": 2,
      "habits": [
        {
          "name": "Morning walk",
          "frequency": "daily",
          "duration": "10 minutes",
          "time": "7:00 AM",
          "stack_trigger": "After morning coffee",
          "rationale": "Build walking habit before running"
        },
        {
          "name": "Dynamic stretching",
          "frequency": "daily",
          "duration": "5 minutes",
          "time": "7:15 AM",
          "stack_trigger": "After morning walk",
          "rationale": "Injury prevention and flexibility"
        },
        {
          "name": "Sleep 8 hours",
          "frequency": "daily",
          "time": "10:00 PM bedtime",
          "rationale": "Recovery is critical for training"
        }
      ]
    },
    {
      "phase": 2,
      "name": "Base Building",
      "duration_weeks": 8,
      "habits": [
        {
          "name": "Run/walk intervals",
          "frequency": "3x weekly",
          "duration": "20 minutes",
          "progression": "Add 10% distance weekly",
          "days": ["Monday", "Wednesday", "Saturday"],
          "rationale": "Build cardiovascular base safely"
        },
        {
          "name": "Strength training",
          "frequency": "2x weekly",
          "duration": "30 minutes",
          "days": ["Tuesday", "Thursday"],
          "focus": "Legs, core, stability",
          "rationale": "Prevent injury, improve running economy"
        },
        {
          "name": "Post-run nutrition",
          "frequency": "after each run",
          "content": "Protein + carbs within 30 min",
          "rationale": "Optimize recovery"
        }
      ]
    },
    {
      "phase": 3,
      "name": "Race Preparation",
      "duration_weeks": 12,
      "habits": [
        {
          "name": "Long run",
          "frequency": "weekly",
          "duration": "60-120 minutes",
          "day": "Sunday",
          "progression": "Increase 1 mile weekly, peak 20 miles",
          "rationale": "Build endurance for marathon distance"
        },
        {
          "name": "Tempo runs",
          "frequency": "weekly",
          "duration": "30-45 minutes",
          "day": "Wednesday",
          "pace": "10K race pace",
          "rationale": "Improve lactate threshold"
        },
        {
          "name": "Recovery runs",
          "frequency": "2x weekly",
          "duration": "30 minutes",
          "days": ["Monday", "Friday"],
          "pace": "Easy, conversational",
          "rationale": "Active recovery, maintain fitness"
        },
        {
          "name": "Weekly mileage tracking",
          "frequency": "weekly",
          "task": "Review total mileage and adjust",
          "rationale": "Prevent overtraining"
        }
      ]
    }
  ]
}
```

---

## Advanced AI Capabilities

### 4. Contextual Intelligence

**User Profile Analysis:**
```python
class UserContextEngine:
    """
    Builds comprehensive user profile for personalized recommendations
    """
    
    def build_context(self, user_id):
        context = {
            # Historical performance
            'completion_rates': self.calculate_completion_rates(),
            'best_performing_habits': self.identify_successful_habits(),
            'struggle_patterns': self.identify_failure_patterns(),
            'peak_productivity_times': self.analyze_completion_times(),
            'streak_data': self.get_streak_history(),
            
            # Personal attributes
            'chronotype': self.determine_chronotype(),  # Morning/evening person
            'motivation_style': self.determine_motivation(),  # Intrinsic/extrinsic
            'commitment_level': self.assess_commitment(),
            'available_time': self.calculate_free_time(),
            'stress_level': self.infer_stress_level(),
            
            # External factors
            'seasonal_patterns': self.detect_seasonal_trends(),
            'work_schedule': self.infer_work_patterns(),
            'social_support': self.assess_accountability(),
            
            # Integrated data (if connected)
            'fitness_level': self.get_fitness_metrics(),
            'sleep_quality': self.get_sleep_data(),
            'financial_habits': self.get_spending_patterns(),
            'learning_pace': self.get_education_progress(),
            
            # Preferences
            'communication_style': self.determine_preferred_tone(),
            'detail_preference': self.assess_detail_level(),
            'challenge_appetite': self.gauge_difficulty_preference()
        }
        return context
```

**Real-time Context Awareness:**
- Current time of day influences suggestions
- Recent habit completions inform recommendations
- Streak status affects motivation messaging
- Integration data provides deeper insights
- Past conversation history maintains continuity

### 5. Predictive Analytics

**Habit Success Prediction:**
```python
class SuccessPredictionModel:
    """
    ML model to predict habit success probability
    """
    
    def predict_success(self, habit, user_profile):
        features = {
            # Habit characteristics
            'difficulty': habit.difficulty_score,
            'time_required': habit.duration_minutes,
            'frequency': habit.times_per_week,
            'time_of_day': habit.scheduled_time,
            'intrinsic_reward': habit.enjoyment_score,
            
            # User factors
            'past_success_rate': user_profile.completion_rate,
            'similar_habit_performance': self.get_similar_performance(),
            'current_streak': user_profile.current_streak,
            'stress_level': user_profile.stress_score,
            'available_time': user_profile.free_time_minutes,
            
            # Environmental factors
            'season': self.get_current_season(),
            'day_of_week': self.get_day_type(),
            'weather_dependency': habit.outdoor_required,
            'social_support': user_profile.accountability_score
        }
        
        success_probability = self.ml_model.predict(features)
        
        # Return probability with explanation
        return {
            'probability': success_probability,
            'confidence': self.calculate_confidence(),
            'top_success_factors': self.get_top_factors(positive=True),
            'top_risk_factors': self.get_top_factors(positive=False),
            'recommendations': self.generate_optimization_suggestions()
        }
```

**Churn Prevention:**
- Detect early warning signs of abandonment
- Intervene proactively with encouragement
- Suggest habit modifications before failure
- Identify optimal re-engagement timing

### 6. Adaptive Learning

**Continuous Improvement Loop:**
```python
class AdaptiveLearningEngine:
    """
    Learns from user interactions and outcomes
    """
    
    def learn_from_interaction(self, interaction_data):
        # Update user preference model
        self.preference_model.update(
            liked=interaction_data.positive_feedback,
            disliked=interaction_data.negative_feedback
        )
        
        # Refine habit recommendation algorithm
        if interaction_data.habit_completed:
            self.success_model.add_positive_example()
        else:
            self.success_model.add_negative_example()
            self.failure_analyzer.analyze_why_failed()
        
        # Adjust communication style
        self.tone_optimizer.update_based_on_engagement(
            message_length=interaction_data.response_length,
            emoji_usage=interaction_data.emoji_present,
            detail_level=interaction_data.detail_requested
        )
        
        # Personalize timing
        self.timing_optimizer.record_interaction_time(
            timestamp=interaction_data.time,
            engagement_score=interaction_data.engagement
        )
```

**A/B Testing Framework:**
- Test different habit sequences
- Compare motivational messaging approaches
- Optimize notification timing
- Evaluate UI variations

---

## Technical Implementation

### AI Model Architecture

**Primary Model: Large Language Model (LLM)**
- **Recommendation**: GPT-4 Turbo or Claude Sonnet 4.5
- **Reasoning**: Superior reasoning, context understanding, nuanced language
- **Fallback**: GPT-3.5 Turbo for faster, lower-cost interactions

**Model Configuration:**
```python
ai_config = {
    'model': 'gpt-4-turbo',
    'temperature': 0.7,  # Balance creativity and consistency
    'max_tokens': 1000,
    'top_p': 0.9,
    'frequency_penalty': 0.3,  # Reduce repetition
    'presence_penalty': 0.3,   # Encourage topic variety
    'stream': True  # Enable real-time streaming responses
}
```

**System Prompt Engineering:**
```python
SYSTEM_PROMPT = """
You are the Habyss AI Assistant, an expert in habit formation, behavior psychology, and goal achievement. Your role is to help users build sustainable habits that lead to their goals.

## Core Competencies:
- Behavior psychology (habit formation, motivation, willpower)
- Progressive goal setting and achievement
- Time management and productivity
- Health and fitness coaching
- Financial planning and budgeting
- Learning and skill acquisition
- Emotional intelligence and support

## Communication Style:
- Encouraging and supportive, never judgmental
- Clear and concise, avoiding jargon unless requested
- Data-driven but empathetic
- Proactive in offering help
- Honest about limitations and challenges

## Key Principles:
1. Start small - recommend atomic habits that build momentum
2. Be specific - vague habits fail, specific habits succeed
3. Consider context - personalize based on user's life situation
4. Science-backed - base recommendations on research
5. Sustainable - prioritize long-term success over quick wins

## Capabilities:
- Analyze goals and create detailed habit sequences
- Review progress and provide actionable insights
- Adjust plans based on performance and feedback
- Predict potential obstacles and provide solutions
- Celebrate wins and provide motivation during setbacks

## Available User Context:
{user_context}

## Current Conversation Context:
{conversation_history}

Always consider the user's complete profile when making recommendations.
"""
```

### Context Management System

**Conversation Memory:**
```python
class ConversationMemory:
    """
    Manages conversation history and context
    """
    
    def __init__(self, user_id):
        self.user_id = user_id
        self.short_term_memory = []  # Last 10 interactions
        self.long_term_memory = {}   # Key insights stored permanently
        self.working_context = {}    # Current session context
    
    def add_interaction(self, user_message, ai_response):
        interaction = {
            'timestamp': datetime.now(),
            'user_message': user_message,
            'ai_response': ai_response,
            'sentiment': self.analyze_sentiment(user_message),
            'intent': self.extract_intent(user_message),
            'entities': self.extract_entities(user_message)
        }
        
        self.short_term_memory.append(interaction)
        
        # Maintain sliding window
        if len(self.short_term_memory) > 10:
            self.short_term_memory.pop(0)
        
        # Extract and store important information
        if self.is_important_info(interaction):
            self.store_in_long_term(interaction)
    
    def get_context_for_prompt(self, max_tokens=2000):
        """
        Build context string for LLM prompt
        """
        context = []
        
        # Add recent conversation
        for interaction in self.short_term_memory[-5:]:
            context.append(f"User: {interaction['user_message']}")
            context.append(f"Assistant: {interaction['ai_response']}")
        
        # Add relevant long-term memories
        relevant_memories = self.retrieve_relevant_memories()
        context.extend(relevant_memories)
        
        # Add user profile summary
        context.append(self.generate_profile_summary())
        
        return "\n".join(context)
```

**Dynamic Context Injection:**
- User profile data
- Recent habit completions
- Active goals and progress
- Integration data (steps, workouts, etc.)
- Streak information
- Recent achievements
- Upcoming deadlines
- Seasonal/time-based context

### RAG (Retrieval-Augmented Generation)

**Knowledge Base Structure:**
```python
class HabitKnowledgeBase:
    """
    Vector database of habit formation knowledge
    """
    
    def __init__(self):
        self.vector_db = ChromaDB()  # or Pinecone, Weaviate
        self.embedding_model = OpenAIEmbeddings()
        
        # Knowledge sources
        self.sources = [
            'atomic_habits_james_clear',
            'power_of_habit_charles_duhigg',
            'tiny_habits_bj_fogg',
            'habit_formation_research_papers',
            'behavioral_psychology_studies',
            'success_stories_database',
            'common_pitfalls_database',
            'domain_specific_guides'  # fitness, learning, finance, etc.
        ]
    
    def retrieve_relevant_knowledge(self, query, k=5):
        """
        Find most relevant knowledge for current query
        """
        query_embedding = self.embedding_model.embed(query)
        
        results = self.vector_db.similarity_search(
            embedding=query_embedding,
            k=k,
            filter={'verified': True}  # Only high-quality sources
        )
        
        return [result.content for result in results]
    
    def augment_prompt(self, user_query, user_context):
        """
        Enhance prompt with relevant knowledge
        """
        # Retrieve relevant information
        knowledge = self.retrieve_relevant_knowledge(user_query)
        
        augmented_prompt = f"""
        User Query: {user_query}
        
        Relevant Knowledge:
        {self.format_knowledge(knowledge)}
        
        User Context:
        {user_context}
        
        Based on the above knowledge and user context, provide a helpful response.
        """
        
        return augmented_prompt
```

**Knowledge Categories:**
- Habit formation strategies
- Domain-specific best practices (fitness, learning, etc.)
- Common obstacles and solutions
- Motivational techniques
- Schedule optimization
- Success stories and case studies
- Scientific research findings
- Cultural and individual differences

### Function Calling / Tool Use

**Available Tools:**
```python
tools = [
    {
        'name': 'create_habit_sequence',
        'description': 'Generate a personalized habit sequence for a goal',
        'parameters': {
            'goal': 'string',
            'timeline': 'string',
            'difficulty': 'easy|moderate|challenging',
            'time_available': 'number (minutes per day)'
        }
    },
    {
        'name': 'analyze_progress',
        'description': 'Analyze user progress on habits and goals',
        'parameters': {
            'habit_ids': 'array of strings',
            'time_period': 'string (7d, 30d, 90d, all)'
        }
    },
    {
        'name': 'suggest_habit_modification',
        'description': 'Recommend changes to struggling habits',
        'parameters': {
            'habit_id': 'string',
            'issue': 'string (too_hard, no_time, forgot, unmotivated)'
        }
    },
    {
        'name': 'predict_success',
        'description': 'Predict success probability for a proposed habit',
        'parameters': {
            'habit': 'object (habit details)'
        }
    },
    {
        'name': 'find_optimal_time',
        'description': 'Find best time to schedule a habit',
        'parameters': {
            'habit_type': 'string',
            'duration': 'number (minutes)',
            'flexibility': 'low|medium|high'
        }
    },
    {
        'name': 'get_integration_data',
        'description': 'Fetch data from connected integrations',
        'parameters': {
            'integration': 'string',
            'data_type': 'string',
            'time_range': 'string'
        }
    },
    {
        'name': 'create_visualization',
        'description': 'Generate progress chart or visualization',
        'parameters': {
            'data_source': 'string',
            'visualization_type': 'line|bar|heatmap|streak',
            'time_period': 'string'
        }
    },
    {
        'name': 'set_reminder',
        'description': 'Schedule a habit reminder or check-in',
        'parameters': {
            'habit_id': 'string',
            'time': 'string (ISO format)',
            'message': 'string'
        }
    }
]
```

**Tool Usage Example:**
```python
# User: "Create a habit sequence to help me run a 5K in 3 months"

# AI determines it needs to use create_habit_sequence tool
function_call = {
    'name': 'create_habit_sequence',
    'arguments': {
        'goal': 'Run a 5K race in 3 months',
        'timeline': '12 weeks',
        'difficulty': 'moderate',
        'time_available': 45
    }
}

# Execute function
result = execute_function(function_call)

# AI uses result to formulate response
response = f"""
I've created a personalized 12-week running program for you! Here's your habit sequence:

**Phase 1 (Weeks 1-4): Foundation**
{result['phase_1_habits']}

**Phase 2 (Weeks 5-8): Building Endurance**
{result['phase_2_habits']}

**Phase 3 (Weeks 9-12): Race Preparation**
{result['phase_3_habits']}

I've scheduled these habits based on your available time and energy levels. Would you like me to adjust anything?
"""
```

---

## Data Infrastructure

### Database Schema

```sql
-- AI Conversations
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    goal_context TEXT,
    outcome TEXT  -- sequence_created, question_answered, etc.
);

-- AI Messages
CREATE TABLE ai_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES ai_conversations(id),
    role VARCHAR(20),  -- user, assistant, system
    content TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    tokens_used INTEGER,
    function_calls JSONB,
    sentiment_score FLOAT,
    intent VARCHAR(100)
);

-- Generated Habit Sequences
CREATE TABLE habit_sequences (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    conversation_id UUID REFERENCES ai_conversations(id),
    goal_id UUID REFERENCES goals(id),
    name VARCHAR(255),
    description TEXT,
    total_phases INTEGER,
    created_by_ai BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50)  -- draft, active, paused, completed, abandoned
);

-- Sequence Phases
CREATE TABLE sequence_phases (
    id UUID PRIMARY KEY,
    sequence_id UUID REFERENCES habit_sequences(id),
    phase_number INTEGER,
    name VARCHAR(255),
    duration_weeks INTEGER,
    start_date DATE,
    end_date DATE,
    success_criteria JSONB
);

-- Phase Habits (links habits to phases)
CREATE TABLE phase_habits (
    id UUID PRIMARY KEY,
    phase_id UUID REFERENCES sequence_phases(id),
    habit_id UUID REFERENCES habits(id),
    introduction_day INTEGER,  -- Day within phase to introduce habit
    rationale TEXT,
    ai_notes TEXT
);

-- AI Learning Data
CREATE TABLE ai_learning_data (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100),  -- recommendation_accepted, habit_completed, sequence_abandoned
    event_data JSONB,
    timestamp TIMESTAMP DEFAULT NOW(),
    feedback_score INTEGER  -- -1 (negative), 0 (neutral), 1 (positive)
);

-- User AI Preferences
CREATE TABLE user_ai_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    communication_style VARCHAR(50),  -- concise, detailed, encouraging, direct
    detail_level VARCHAR(50),  -- minimal, moderate, comprehensive
    emoji_preference VARCHAR(50),  -- never, rarely, sometimes, often
    notification_frequency VARCHAR(50),  -- minimal, moderate, active
    proactive_suggestions BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Architecture

```python
# FastAPI endpoint structure

@app.post("/api/ai/chat")
async def ai_chat(
    request: AIChatRequest,
    user: User = Depends(get_current_user)
):
    """
    Main AI chat endpoint
    """
    # Load user context
    context = await context_engine.build_context(user.id)
    
    # Retrieve conversation history
    conversation = await get_or_create_conversation(user.id)
    
    # Augment prompt with relevant knowledge
    augmented_prompt = await knowledge_base.augment_prompt(
        user_query=request.message,
        user_context=context
    )
    
    # Generate AI response (streaming)
    async for chunk in ai_service.generate_response(
        messages=conversation.get_messages(),
        new_message=request.message,
        context=augmented_prompt,
        tools=tools,
        stream=True
    ):
        # Stream response to client
        yield {
            'type': 'content',
            'data': chunk
        }
    
    # Save conversation
    await conversation.add_message(
        role='user',
        content=request.message
    )
    await conversation.add_message(
        role='assistant',
        content=response
    )
    
    # Learn from interaction
    await learning_engine.learn_from_interaction({
        'user_id': user.id,
        'query': request.message,
        'response': response,
        'context': context
    })


@app.post("/api/ai/create-sequence")
async def create_habit_sequence(
    request: SequenceRequest,
    user: User = Depends(get_current_user)
):
    """
    Generate habit sequence from goal
    """
    # Generate sequence using AI
    sequence = await ai_service.generate_habit_sequence(
        goal=request.goal,
        user_profile=await get_user_profile(user.id),
        preferences=request.preferences
    )
    
    # Validate and optimize
    validated_sequence = await sequence_validator.validate(sequence)
    
    # Save to database
    saved_sequence = await db.save_habit_sequence(
        user_id=user.id,
        sequence=validated_sequence
    )
    
    return saved_sequence


@app.get("/api/ai/insights")
async def get_ai_insights(
    user: User = Depends(get_current_user)
):
    """
    Get AI-generated insights about user's habits
    """
    # Analyze user data
    insights = await insight_engine.generate_insights(
        user_id=user.id,
        time_period='30d'
    )
    
    return {
        'insights': insights,
        'suggestions': await ai_service.generate_suggestions(insights),
        'predictions': await prediction_model.predict_outcomes(user.id)
    }
```

---

## Performance Optimization

### Response Time Targets
- Initial response: < 1 second
- Streaming first token: < 500ms
- Complete response: < 5 seconds
- Function execution: