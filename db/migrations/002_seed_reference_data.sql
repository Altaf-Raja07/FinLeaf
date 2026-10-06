-- Financial seed data: rewards, offset projects, and literacy lessons.
-- Idempotent, so re-running the seed converges instead of duplicating.

INSERT INTO rewards (code, title, description, points_cost, kind, icon) VALUES
  ('bus-discount',   'Bus pass discount',        'Ride the bus twice this month',      200, 'discount', 'bus'),
  ('local-recharge', 'Recharge at a local vendor','Recharge your phone locally',       150, 'discount', 'store'),
  ('tree-sapling',   'Tree sapling sponsored',   'Plant one tree with us',             600, 'donation', 'tree'),
  ('cookstove',      'Clean cookstove contribution', 'Fund a cleaner stove',         800, 'donation', 'stove')
ON CONFLICT (code) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      points_cost = EXCLUDED.points_cost,
      kind = EXCLUDED.kind,
      icon = EXCLUDED.icon;

INSERT INTO offset_projects (code, title, location, points_cost, co2e_kg, outcome) VALUES
  ('trees-doddawadi',   'Trees for Doddawadi',    'Dharwad district, Karnataka', 600,  720.00, '1,200 trees planted'),
  ('clean-cookstoves',  'Cleaner cookstoves',      'Rural Karnataka',             800,  910.00, '310 cookstoves funded'),
  ('mangrove-coast',    'Mangrove restoration',   'Coastal Karnataka',          1100, 1480.00, '4,500 saplings')
ON CONFLICT (code) DO UPDATE
  SET title = EXCLUDED.title,
      location = EXCLUDED.location,
      points_cost = EXCLUDED.points_cost,
      co2e_kg = EXCLUDED.co2e_kg,
      outcome = EXCLUDED.outcome;

INSERT INTO lessons (slug, title, summary, minutes, body, quiz) VALUES
  (
    'keeping-savings-safe',
    'How to keep your savings safe',
    'Four habits that protect the money you have set aside.',
    4,
    '[
      {"heading": "Keep one account for one purpose", "text": "Savings work best when they live apart from the money you spend this week. A separate goal makes it harder to spend by accident."},
      {"heading": "Check the balance on a fixed day", "text": "Pick one day each week and look at your transactions. Surprises appear early when they are small."},
      {"heading": "Save before you spend", "text": "Moving a little money aside right after you are paid means the savings already happen, and there is nothing left to forget."},
      {"heading": "Treat any request for your PIN as a warning", "text": "No real bank asks for your PIN, OTP, or password over a phone call. If someone does, it is not your bank."}
    ]',
    '[
      {"question": "A caller says they are from your bank and ask for your OTP. What should you do?",
       "options": ["Share it so they can help quickly", "End the call and never share an OTP", "Share it if they know your name"],
       "answer": 1},
      {"question": "What is the safest place to keep savings?",
       "options": ["In the same account you spend from", "In a separate goal or account", "Written on a note at home"],
       "answer": 1},
      {"question": "How often should you check your transactions?",
       "options": ["Only when something is wrong", "On a fixed day each week", "Every hour"],
       "answer": 1}
    ]'
  ),
  (
    'on-time-bills',
    'Why paying bills on time matters',
    'On-time payments are the strongest signal in your trust score.',
    6,
    '[
      {"heading": "What counts as on time", "text": "We compare the date a bill was due with the date you paid. Paying before the due date always counts as on time."},
      {"heading": "It is the biggest single factor", "text": "Of the five things that build your trust score, paying on time moves it the most. Missing one bill costs more than a quiet month does."},
      {"heading": "Set one reminder, not five", "text": "Pick a single day each month. One reminder you keep is worth more than five you cancel."},
      {"heading": "If you are late once", "text": "It lowers the score a little, not permanently. Paying the next one on time restores it steadily."}
    ]',
    '[
      {"question": "Which action raises your trust score the most?",
       "options": ["Sending money often", "Paying bills on time", "Changing your language"],
       "answer": 1},
      {"question": "What happens to your score after one late bill?",
       "options": ["It is permanently reduced", "It drops a little and recovers", "It is set to zero"],
       "answer": 1},
      {"question": "How many reminders should you set each month?",
       "options": ["One you will actually keep", "Five separate ones", "None"],
       "answer": 0}
    ]'
  ),
  (
    'understanding-trust-score',
    'Understanding your trust score',
    'What the score measures, and what it deliberately ignores.',
    5,
    '[
      {"heading": "It replaces a credit history", "text": "Traditional loans need years of repayment records. FinLeaf reads the way you already use your account instead."},
      {"heading": "Five factors", "text": "Regular savings, on-time bill payments, consistent activity, how long your account has been open, and activity in your family group."},
      {"heading": "What is never used", "text": "Gender, caste, religion, and any government ID number play no part. This is enforced in the model, not just promised."},
      {"heading": "It is an estimate", "text": "The score comes from a model trained on simulated behaviour. It illustrates the idea; it is not a credit decision by a real lender."}
    ]',
    '[
      {"question": "Which of these is deliberately excluded from scoring?",
       "options": ["How often you save", "Gender", "How old your account is"],
       "answer": 1},
      {"question": "How many factors build the score?",
       "options": ["Two", "Five", "Twelve"],
       "answer": 1},
      {"question": "What replaces a traditional credit history?",
       "options": ["A longer application form", "How you use your account", "A guarantor"],
       "answer": 1}
    ]'
  )
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      minutes = EXCLUDED.minutes,
      body = EXCLUDED.body,
      quiz = EXCLUDED.quiz;