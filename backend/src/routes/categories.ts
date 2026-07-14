import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';

export default async function categoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/categories', async () => {
    return db.prepare('SELECT * FROM categories ORDER BY is_system DESC, name').all();
  });

  app.post('/api/categories', async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      icon: z.string().default('pricetag'),
      color: z.string().default('#5260ff'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Неверные данные' });

    try {
      const info = db
        .prepare('INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)')
        .run(parsed.data.name, parsed.data.icon, parsed.data.color);
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    } catch {
      return reply.code(409).send({ error: 'Категория с таким названием уже есть' });
    }
  });

  app.delete('/api/categories/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const cat = db.prepare('SELECT is_system FROM categories WHERE id = ?').get(id) as
      | { is_system: number }
      | undefined;
    if (!cat) return reply.code(404).send({ error: 'Не найдено' });
    if (cat.is_system) return reply.code(400).send({ error: 'Системную категорию нельзя удалить' });
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return { ok: true };
  });
}
