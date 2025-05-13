-- insertdummydata.sql
-- Script to insert one week of dummy data for Sinagtala application

-- Insert dummy users
INSERT INTO users (id, email, username, password, created_at) VALUES
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'user2@example.com', 'janedoe', crypt('password456', gen_salt('bf')), '2025-05-02 11:30:00'),
('c3d4e5f6-a7b8-69c0-1d2e-f3a4b5c6d7e8', 'user3@example.com', 'bobsmith', crypt('password789', gen_salt('bf')), '2025-05-03 09:15:00');

-- Insert dummy password reset requests
INSERT INTO password_resets (user_id, token, created_at, expires_at, used) VALUES
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'reset-token-2', '2025-05-04 09:45:00', '2025-05-05 09:45:00', true);

-- Insert dummy mood entries for User 2 (one week of data)
INSERT INTO moodentries (user_id, mood, note, timestamp) VALUES
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Content', 'Had a good day with family. We went to the park and had ice cream.', '2025-05-02 20:00:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Drained', 'Long day at work. Multiple meetings and tight deadlines.', '2025-05-03 21:30:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Irritated', 'Traffic was terrible today. Spent 2 hours commuting.', '2025-05-04 19:45:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Calm', 'Enjoyed a peaceful evening reading my favorite book.', '2025-05-05 20:15:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Hopeful', 'New project starting tomorrow. Looking forward to the challenges.', '2025-05-06 21:00:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Anxious', 'Worried about project deadline. Need to finish by Friday.', '2025-05-07 19:30:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Energized', 'Great news today! Got promoted at work!', '2025-05-08 20:45:00');

-- Insert dummy chat logs for User 2
INSERT INTO chatlogs (user_id, message, sender, timestamp) VALUES
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Hi Tala, I had a great day with my family.', 'user', '2025-05-02 21:00:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'That sounds lovely, Jane! Would you like to share more about it?', 'tala', '2025-05-02 21:00:15'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'We went to the park and had ice cream. It was nice to spend quality time together.', 'user', '2025-05-02 21:00:45'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Those simple moments with loved ones can be so precious. How did spending time with your family make you feel?', 'tala', '2025-05-02 21:01:00'),

('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Work was exhausting today.', 'user', '2025-05-03 22:00:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'I''m sorry to hear that. What made work particularly challenging today?', 'tala', '2025-05-03 22:00:10'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'Too many meetings and deadlines. Barely had time to breathe.', 'user', '2025-05-03 22:00:30'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 'That sounds overwhelming. Have you been able to take any breaks to recharge?', 'tala', '2025-05-03 22:00:45');

-- Insert dummy user summaries
INSERT INTO user_summaries (user_id, summary_data, created_at, updated_at) VALUES
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', 
 '{
   "mood_trends": {
     "content": 2,
     "drained": 1,
     "irritated": 1,
     "calm": 1,
     "hopeful": 1,
     "anxious": 1,
     "energized": 1
   },
   "common_topics": ["work", "family", "traffic", "projects", "deadlines"],
   "recommendations": [
     "Work-life balance strategies",
     "Stress management techniques",
     "Time management skills",
     "Mindfulness practices",
     "Regular breaks during work"
   ],
   "positive_activities": ["family time", "reading", "outdoor activities"]
 }', 
 '2025-05-05 12:30:00', '2025-05-05 12:30:00');

-- Insert dummy day summaries for User 2
INSERT INTO day_summaries (user_id, date, summary, created_at) VALUES
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', '2025-05-02', 'You enjoyed quality time with your family at the park and felt content. The ice cream outing brought joy, and we discussed the importance of nurturing these social connections.', '2025-05-02 23:30:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', '2025-05-03', 'You felt drained after a long workday filled with meetings and deadlines. We explored recovery strategies and setting healthy work boundaries to prevent burnout.', '2025-05-03 23:30:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', '2025-05-04', 'A challenging commute with heavy traffic left you feeling irritated. We discussed practical coping mechanisms for daily stressors and ways to make commute time more enjoyable.', '2025-05-04 23:30:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', '2025-05-05', 'You experienced a calm evening with your favorite book. We discussed the value of creating more peaceful moments in your daily routine and the benefits of reading for relaxation.', '2025-05-05 23:30:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', '2025-05-06', 'You expressed hope about your new project opportunity. We discussed managing expectations, setting realistic goals, and maintaining a positive mindset while facing new challenges.', '2025-05-06 23:30:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', '2025-05-07', 'Project deadline concerns caused anxiety today. We explored effective time management strategies, prioritization techniques, and ways to break down large tasks into manageable steps.', '2025-05-07 23:30:00'),
('b2c3d4e5-f6a7-58b9-0c1d-e2f3a4b5c6d7', '2025-05-08', 'You felt energized after receiving news about your promotion. We celebrated this achievement and discussed how this positive development aligns with your personal growth journey.', '2025-05-08 23:30:00');
