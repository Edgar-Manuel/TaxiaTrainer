-- Seed: achievements catalog and the first city (Santander).
-- Street/place data itself is loaded with `npm run import:city -- --slug santander`.

insert into public.achievements (code, name, description, icon, xp_reward, criteria) values
  ('first_session', 'Primera carrera', 'Completa tu primera sesión de entrenamiento', '🚕', 20, '{"type": "sessions", "threshold": 1}'),
  ('streak_3', 'Constancia', 'Mantén una racha de 3 días', '🔥', 30, '{"type": "streak", "threshold": 3}'),
  ('streak_7', 'Semana perfecta', 'Mantén una racha de 7 días', '🔥', 70, '{"type": "streak", "threshold": 7}'),
  ('streak_30', 'Imparable', 'Mantén una racha de 30 días', '🌋', 300, '{"type": "streak", "threshold": 30}'),
  ('streets_10', 'Novato del callejero', 'Domina 10 calles', '🗺️', 25, '{"type": "streets_mastered", "threshold": 10}'),
  ('streets_50', 'Conocedor', 'Domina 50 calles', '🗺️', 100, '{"type": "streets_mastered", "threshold": 50}'),
  ('streets_200', 'Callejero humano', 'Domina 200 calles', '🧠', 400, '{"type": "streets_mastered", "threshold": 200}'),
  ('perfect_session', 'Sesión perfecta', 'Termina una sesión sin fallos', '💯', 50, '{"type": "perfect_sessions", "threshold": 1}'),
  ('exam_pass', 'Apto', 'Aprueba un examen oficial simulado', '📝', 150, '{"type": "exams_passed", "threshold": 1}'),
  ('exam_ace', 'Matrícula de honor', 'Saca más de un 90% en un examen', '🎓', 250, '{"type": "exam_score_90", "threshold": 1}'),
  ('xp_1000', 'Motor caliente', 'Acumula 1.000 XP', '⚡', 50, '{"type": "xp", "threshold": 1000}'),
  ('xp_10000', 'Taxista veterano', 'Acumula 10.000 XP', '🏆', 200, '{"type": "xp", "threshold": 10000}'),
  ('night_owl', 'Turno de noche', 'Estudia después de las 23:00', '🌙', 25, '{"type": "night_session", "threshold": 1}'),
  ('early_bird', 'Primer turno', 'Estudia antes de las 07:00', '🌅', 25, '{"type": "early_session", "threshold": 1}'),
  ('places_25', 'Guía turístico', 'Domina 25 lugares importantes', '🏛️', 100, '{"type": "places_mastered", "threshold": 25}'),
  ('neighborhoods_all', 'Señor de los barrios', 'Domina todos los barrios de una ciudad', '🏘️', 200, '{"type": "neighborhoods_mastered_pct", "threshold": 100}')
on conflict (code) do nothing;

insert into public.cities (slug, name, country, center, bbox, osm_relation_id, status, published)
values (
  'santander',
  'Santander',
  'ES',
  '[-3.8044, 43.4623]',
  '[-3.8760, 43.4230, -3.7570, 43.4950]',
  340041,
  'draft',
  true
)
on conflict (slug) do nothing;
