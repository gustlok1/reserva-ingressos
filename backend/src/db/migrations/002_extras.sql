-- Extras pós-entrega: papel do usuário (admin), subtítulo e imagem dos eventos.
-- Migration nova em vez de editar a 001: bancos que já rodaram a 001 recebem só esta parte.

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

ALTER TABLE events ADD COLUMN subtitle TEXT; -- ex.: "Camarote All Inclusive"
ALTER TABLE events ADD COLUMN image_url TEXT; -- caminho (/images/...) ou URL http(s); vazio = imagem padrão

-- Preenche os eventos que o seed já tinha criado antes desta migration.
UPDATE events SET subtitle = 'Pista Premium', image_url = '/images/evento-padrao.jpg' WHERE slug = 'rock-na-arena';
UPDATE events SET subtitle = 'Arquibancada Central', image_url = '/images/evento-padrao.jpg' WHERE slug = 'final-do-campeonato';
UPDATE events SET subtitle = 'Camarote All Inclusive', image_url = '/images/evento-padrao.jpg' WHERE slug = 'camarote-noite-eletronica';
