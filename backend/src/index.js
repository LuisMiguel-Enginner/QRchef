import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Habilita o CORS para que o seu frontend consiga conversar com o backend
app.use('*', cors({
    origin: '*', // Em produção, você pode restringir para 'https://q-rchef.vercel.app'
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
    credentials: true,
}))

// Rota raiz para evitar o erro 404
app.get('/', (c) => {
    return c.json({ 
        message: "QRchef API rodando com sucesso!",
        status: "online"
    })
})

// Rota para salvar Leads (Interessados na Landing Page)
app.post('/leads', async (c) => {
    const { email } = await c.req.json()
    const { DB } = c.env
    try {
        await DB.prepare("INSERT INTO leads (email) VALUES (?)").bind(email).run()
        return c.json({ success: true, message: "Lead salvo com sucesso!" })
    } catch (e) {
        return c.json({ success: false, message: "Erro ao salvar lead." }, 500)
    }
})

// Rota de Cadastro de Restaurante
app.post('/auth/register', async (c) => {
    const { name, email, password } = await c.req.json()
    const { DB } = c.env
    
    if (!name || !email || !password) {
        return c.json({ success: false, message: "Preencha todos os campos!" }, 400)
    }

    try {
        await DB.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)")
            .bind(name, email, password).run()
        return c.json({ success: true, message: "Conta criada com sucesso!" })
    } catch (e) {
        return c.json({ success: false, message: "Este e-mail já está em uso." }, 400)
    }
})

// Rota de Login
app.post('/auth/login', async (c) => {
    const { email, password } = await c.req.json()
    const { DB } = c.env
    
    try {
        const user = await DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
        
        if (user && password.trim() === user.password.trim()) {
            return c.json({ 
                success: true,
                token: 'sessao_' + btoa(email), // Token simulado
                user: { id: user.id, name: user.name, email: user.email } 
            })
        }
        return c.json({ success: false, message: "E-mail ou senha incorretos." }, 401)
    } catch (e) {
        return c.json({ success: false, message: "Erro no servidor." }, 500)
    }
})

// Rota para Estatísticas do Painel Administrativo
app.get('/admin/stats', async (c) => {
    const { DB } = c.env
    try {
        // Total de Clientes (Usuários que não são administradores)
        const totalClients = await DB.prepare("SELECT COUNT(*) as count FROM users WHERE email NOT IN ('admin@sistema.com', 'adminsistema@sistema.com')").first()
        
        // Receita Total (Soma da tabela sales)
        const totalRevenue = await DB.prepare("SELECT SUM(amount) as total FROM sales").first()
        
        // Sistemas Ativos (Assinaturas com status 'active')
        const activeSystems = await DB.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'").first()

        // Atividade Recente (Últimas 5 vendas com nomes de usuários)
        const recentActivity = await DB.prepare(`
            SELECT s.amount, s.created_at, u.name 
            FROM sales s 
            JOIN users u ON s.user_id = u.id 
            ORDER BY s.created_at DESC LIMIT 5
        `).all()

        return c.json({
            success: true,
            stats: {
                totalClients: totalClients.count || 0,
                totalRevenue: totalRevenue.total || 0,
                activeSystems: activeSystems.count || 0
            },
            recentActivity: recentActivity.results || []
        })
    } catch (e) {
        console.error('Erro ao buscar estatísticas:', e)
        return c.json({ success: false, message: "Erro ao buscar dados do painel." }, 500)
    }
})

// Rota para Listagem de Clientes (Admin)
app.get('/admin/clients', async (c) => {
    const { DB } = c.env
    try {
        const clients = await DB.prepare(`
            SELECT u.id, u.name, u.email, s.plan_id as plan, s.status
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            WHERE u.email NOT IN ('admin@sistema.com', 'adminsistema@sistema.com')
            ORDER BY u.created_at DESC
        `).all()
        
        return c.json({ success: true, clients: clients.results || [] })
    } catch (e) {
        return c.json({ success: false, message: "Erro ao buscar clientes." }, 500)
    }
})

// Rota para Deletar Cliente (Admin)
app.delete('/admin/clients/:id', async (c) => {
    const id = c.req.param('id')
    const { DB } = c.env
    try {
        // Deleta assinaturas primeiro por causa da Foreign Key
        await DB.prepare("DELETE FROM subscriptions WHERE user_id = ?").bind(id).run()
        // Deleta as vendas relacionadas
        await DB.prepare("DELETE FROM sales WHERE user_id = ?").bind(id).run()
        // Por fim, deleta o usuário
        await DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run()
        
        return c.json({ success: true, message: "Cliente removido com sucesso." })
    } catch (e) {
        console.error('Erro ao deletar cliente:', e)
        return c.json({ success: false, message: "Erro ao remover cliente." }, 500)
    }
})

// Rota para verificar cliente por nome e e-mail (Admin)
app.get('/admin/verify-client', async (c) => {
    const name = c.req.query('name')
    const email = c.req.query('email')
    const { DB } = c.env

    try {
        const client = await DB.prepare("SELECT id, name, email FROM users WHERE name = ? AND email = ?")
            .bind(name, email).first()
        
        if (client) {
            return c.json({ success: true, client })
        }
        return c.json({ success: false, message: "Cliente não encontrado no banco de dados." })
    } catch (e) {
        return c.json({ success: false, message: "Erro ao verificar cliente." }, 500)
    }
})

// Rota para realizar a implantação de um sistema (Admin)
app.post('/admin/deploy-system', async (c) => {
    const { userId, templateId, features } = await c.req.json()
    const { DB } = c.env

    try {
        // Registra o sistema na tabela subscriptions (ou similar)
        // Por enquanto, vamos usar a tabela subscriptions como base
        await DB.prepare("INSERT INTO subscriptions (user_id, plan_id, status) VALUES (?, ?, ?)")
            .bind(userId, templateId, 'active').run()
        
        return c.json({ success: true, message: "Sistema implantado com sucesso!" })
    } catch (e) {
        console.error('Erro no deploy:', e)
        return c.json({ success: false, message: "Erro ao realizar implantação." }, 500)
    }
})

// Rota para buscar sistemas do usuário (Cliente)
app.get('/client/systems/:userId', async (c) => {
    const userId = c.req.param('userId')
    const { DB } = c.env

    try {
        const systems = await DB.prepare(`
            SELECT id, plan_id as name, status, created_at 
            FROM subscriptions 
            WHERE user_id = ?
        `).bind(userId).all()
        
        return c.json({ success: true, systems: systems.results || [] })
    } catch (e) {
        return c.json({ success: false, message: "Erro ao buscar sistemas." }, 500)
    }
})

// ─── HELPERS DE AUTENTICAÇÃO ───────────────────────────────────────────────── 
const ADMIN_EMAILS = ['admin@sistema.com', 'adminsistema@sistema.com', 'adminsistema2@sistema.com'];

function getUserIdFromToken(c) { 
  const auth = c.req.header('Authorization') || ''; 
  const token = auth.replace('Bearer ', ''); 
  if (!token.startsWith('sessao_')) return null; 
  try { 
    return atob(token.replace('sessao_', '')); 
  } catch { 
    return null; 
  } 
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(email);
}

const BASIC_PLAN_TEMPLATES = ['elite', 'quick', 'basic', 'pro'];
const PREMIUM_PLAN_TEMPLATES = ['coffee', 'premium'];

function isBasicPlanTemplate(templateId) {
  return BASIC_PLAN_TEMPLATES.includes(templateId);
}

function subscriptionPlanIdForTemplate(templateId) {
  return isBasicPlanTemplate(templateId) ? 'basic' : (PREMIUM_PLAN_TEMPLATES.includes(templateId) ? 'premium' : 'pro');
}

async function userHasActiveBasicPlan(DB, userId) {
  const sub = await DB.prepare(`
    SELECT plan_id FROM subscriptions
    WHERE user_id = ? AND status = 'active'
    ORDER BY id DESC LIMIT 1
  `).bind(userId).first();
  if (!sub) return false;
  return sub.plan_id === 'basic' || BASIC_PLAN_TEMPLATES.includes(sub.plan_id);
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getUserFromToken(c) {
  const email = getUserIdFromToken(c);
  if (!email) return null;
  const user = await c.env.DB.prepare('SELECT id, name, email FROM users WHERE email = ?').bind(email).first();
  return user || null;
}

function menuLink(slug) {
  return `https://qrchef-worker.luismiguelgomesoliveira-014.workers.dev/cardapio/${slug}`;
}

async function createRestaurantForUser(DB, userId, nome, cor_primaria, slugHint, templateId) {
  const finalSlug = slugify(slugHint || nome);
  try {
    await DB.prepare(
      'INSERT INTO restaurants (user_id, slug, nome, cor_primaria, template_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, finalSlug, nome, cor_primaria || '#e63946', templateId || null).run();
  } catch {
    await DB.prepare(
      'INSERT INTO restaurants (user_id, slug, nome, cor_primaria) VALUES (?, ?, ?, ?)'
    ).bind(userId, finalSlug, nome, cor_primaria || '#e63946').run();
  }
  return { slug: finalSlug, link: menuLink(finalSlug) };
}

// Status do plano do cliente (assinatura)
app.get('/client/plan-status', async (c) => {
  const user = await getUserFromToken(c);
  if (!user) return c.json({ success: false, message: 'Não autenticado.' }, 401);

  const { DB } = c.env;
  try {
    const hasBasic = await userHasActiveBasicPlan(DB, user.id);
    const sub = await DB.prepare(`
      SELECT plan_id, status, created_at FROM subscriptions
      WHERE user_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `).bind(user.id).first();

    const hasPremium = sub?.plan_id === 'premium';

    return c.json({
      success: true,
      hasBasic,
      hasPremium,
      plan: sub?.plan_id || null,
      status: sub?.status || null
    });
  } catch (e) {
    return c.json({ success: false, message: 'Erro ao consultar plano.' }, 500);
  }
});

// ─── SOLICITAÇÃO DE COMPRA (CLIENTE) ───────────────────────────────────────── 
app.post('/purchase/request', async (c) => {
  const user = await getUserFromToken(c);
  if (!user) return c.json({ success: false, message: 'Não autenticado.' }, 401);

  const { template_id, system_name, restaurant_name, cor_primaria, amount, payment_method } = await c.req.json();
  const { DB } = c.env;

  if (!template_id || !restaurant_name || !payment_method || amount == null) {
    return c.json({ success: false, message: 'Preencha todos os campos da solicitação.' }, 400);
  }

  if (!isBasicPlanTemplate(template_id)) {
    const hasBasic = await userHasActiveBasicPlan(DB, user.id);
    if (!hasBasic) {
      return c.json({
        success: false,
        message: 'Assine o Plano Básico primeiro (Elite, Quick Bite, Green Garden ou Pizza Express).'
      }, 403);
    }
  }

  try {
    const result = await DB.prepare(`
      INSERT INTO purchase_requests (
        user_id, template_id, system_name, restaurant_name, cor_primaria,
        amount, payment_method, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'awaiting_admin')
    `).bind(
      user.id,
      template_id,
      system_name || template_id,
      restaurant_name,
      cor_primaria || '#e63946',
      Number(amount),
      payment_method
    ).run();

    return c.json({
      success: true,
      requestId: result.meta.last_row_id,
      message: 'Solicitação registrada. Aguarde a confirmação do administrador.'
    });
  } catch (e) {
    console.error('Erro ao criar solicitação:', e);
    return c.json({ success: false, message: 'Erro ao registrar solicitação. Execute a migração 0004 no banco D1.' }, 500);
  }
});

app.get('/purchase/request/:id', async (c) => {
  const user = await getUserFromToken(c);
  if (!user) return c.json({ success: false, message: 'Não autenticado.' }, 401);

  const id = c.req.param('id');
  const { DB } = c.env;

  try {
    const req = await DB.prepare(`
      SELECT id, template_id, system_name, restaurant_name, amount, payment_method,
             status, restaurant_slug, menu_link, created_at, approved_at
      FROM purchase_requests
      WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();

    if (!req) return c.json({ success: false, message: 'Solicitação não encontrada.' }, 404);
    return c.json({ success: true, request: req });
  } catch (e) {
    return c.json({ success: false, message: 'Erro ao consultar solicitação.' }, 500);
  }
});

// ─── SOLICITAÇÕES PENDENTES (ADMIN) ────────────────────────────────────────── 
app.get('/admin/purchase-requests', async (c) => {
  const email = getUserIdFromToken(c);
  if (!email || !isAdminEmail(email)) {
    return c.json({ success: false, message: 'Acesso negado.' }, 403);
  }

  const status = c.req.query('status') || 'awaiting_admin';
  const { DB } = c.env;

  try {
    const { results } = await DB.prepare(`
      SELECT pr.*, u.name as user_name, u.email as user_email
      FROM purchase_requests pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.status = ?
      ORDER BY pr.created_at ASC
    `).bind(status).all();

    return c.json({ success: true, requests: results || [] });
  } catch (e) {
    console.error('Erro ao listar solicitações:', e);
    return c.json({ success: false, message: 'Erro ao buscar solicitações.' }, 500);
  }
});

app.post('/admin/purchase-requests/:id/approve', async (c) => {
  const email = getUserIdFromToken(c);
  if (!email || !isAdminEmail(email)) {
    return c.json({ success: false, message: 'Acesso negado.' }, 403);
  }

  const id = c.req.param('id');
  const { DB } = c.env;

  try {
    const req = await DB.prepare('SELECT * FROM purchase_requests WHERE id = ?').bind(id).first();
    if (!req) return c.json({ success: false, message: 'Solicitação não encontrada.' }, 404);
    if (req.status === 'approved') {
      return c.json({
        success: true,
        slug: req.restaurant_slug,
        link: req.menu_link,
        message: 'Solicitação já aprovada.'
      });
    }

    const { slug, link } = await createRestaurantForUser(
      DB, req.user_id, req.restaurant_name, req.cor_primaria, req.restaurant_name, req.template_id
    );

    const planId = subscriptionPlanIdForTemplate(req.template_id);
    await DB.prepare(`
      INSERT INTO subscriptions (user_id, plan_id, status) VALUES (?, ?, 'active')
    `).bind(req.user_id, planId).run();

    await DB.prepare(`
      UPDATE purchase_requests
      SET status = 'approved', restaurant_slug = ?, menu_link = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(slug, link, id).run();

    return c.json({ success: true, slug, link, message: 'Solicitação aprovada e cardápio ativado!' });
  } catch (e) {
    console.error('Erro ao aprovar:', e);
    const msg = String(e).includes('UNIQUE') ? 'Esse nome de restaurante já está em uso.' : 'Erro ao aprovar solicitação.';
    return c.json({ success: false, message: msg }, 500);
  }
});

app.post('/admin/purchase-requests/:id/reject', async (c) => {
  const email = getUserIdFromToken(c);
  if (!email || !isAdminEmail(email)) {
    return c.json({ success: false, message: 'Acesso negado.' }, 403);
  }

  const id = c.req.param('id');
  const { DB } = c.env;

  try {
    await DB.prepare(`
      UPDATE purchase_requests SET status = 'rejected' WHERE id = ? AND status = 'awaiting_admin'
    `).bind(id).run();
    return c.json({ success: true, message: 'Solicitação recusada.' });
  } catch (e) {
    return c.json({ success: false, message: 'Erro ao recusar solicitação.' }, 500);
  }
});

// ─── CRIAR RESTAURANTE (SOMENTE ADMIN) ─────────────────────────────────────── 
app.post('/restaurant/create', async (c) => { 
  const email = getUserIdFromToken(c); 
  if (!email) return c.json({ success: false, message: 'Não autenticado.' }, 401); 
  if (!isAdminEmail(email)) {
    return c.json({
      success: false,
      message: 'Use o fluxo de aquisição. Seu cardápio será liberado após confirmação do administrador.'
    }, 403);
  }

  const { nome, slug, cor_primaria } = await c.req.json(); 
  const { DB } = c.env; 

  const user = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first(); 
  if (!user) return c.json({ success: false, message: 'Usuário não encontrado.' }, 404); 

  try { 
    const { slug: finalSlug, link } = await createRestaurantForUser(DB, user.id, nome, cor_primaria, slug || nome);
    return c.json({ success: true, slug: finalSlug, link }); 
  } catch (e) { 
    return c.json({ success: false, message: 'Esse nome já está em uso.' }, 409); 
  } 
}); 

// ─── LISTAR RESTAURANTES DO USUÁRIO ────────────────────────────────────────── 
app.get('/restaurant/mine', async (c) => { 
  const email = getUserIdFromToken(c); 
  if (!email) return c.json({ success: false, message: 'Não autenticado.' }, 401); 

  const { DB } = c.env; 
  const user = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first(); 
  if (!user) return c.json({ success: false, message: 'Usuário não encontrado.' }, 404); 

  const { results } = await DB.prepare( 
    'SELECT * FROM restaurants WHERE user_id = ?' 
  ).bind(user.id).all(); 

  return c.json({ success: true, restaurants: results }); 
}); 

// ─── ADICIONAR ITEM AO CARDÁPIO ─────────────────────────────────────────────── 
app.post('/restaurant/:slug/items', async (c) => { 
  const email = getUserIdFromToken(c); 
  if (!email) return c.json({ success: false, message: 'Não autenticado.' }, 401); 

  const slug = c.req.param('slug'); 
  const { nome, descricao, preco, categoria, foto_url } = await c.req.json(); 
  const { DB } = c.env; 

  const user = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!user) return c.json({ success: false, message: 'Usuário não encontrado.' }, 404);

  const restaurant = await DB.prepare( 
    'SELECT * FROM restaurants WHERE slug = ? AND user_id = ?' 
  ).bind(slug, user.id).first(); 

  if (!restaurant) return c.json({ success: false, message: 'Restaurante não encontrado.' }, 404); 

  // --- LÓGICA DE LIMITES POR PLANO ---
  // Busca o plano do usuário (Simulado: assume Pro se não houver tabela de planos ativa)
  // No futuro: const subscription = await DB.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').bind(user.id).first();
  const plan = 'pro'; // Simulação por enquanto

  if (plan === 'basic') {
    const { count } = await DB.prepare('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?').bind(restaurant.id).first();
    if (count >= 20) {
      return c.json({ success: false, message: 'Limite de 20 itens atingido no Plano Básico. Faça upgrade para o Plano Pro!' }, 403);
    }
  }

  await DB.prepare( 
    'INSERT INTO menu_items (restaurant_id, categoria, nome, descricao, preco, foto_url) VALUES (?, ?, ?, ?, ?, ?)' 
  ).bind(restaurant.id, categoria, nome, descricao, preco, foto_url || null).run(); 

  return c.json({ success: true, message: 'Item adicionado!' }); 
}); 

// ─── CARDÁPIO PÚBLICO (o que o cliente final vê) ───────────────────────────── 
app.get('/cardapio/:slug', async (c) => { 
  const slug = c.req.param('slug'); 
  const { DB } = c.env; 

  const restaurant = await DB.prepare( 
    'SELECT * FROM restaurants WHERE slug = ? AND ativo = 1' 
  ).bind(slug).first(); 

  if (!restaurant) { 
    return c.html('<h1 style="font-family:sans-serif;padding:40px">Cardápio não encontrado.</h1>', 404); 
  } 
                                                                                                       
  const { results: items } = await DB.prepare( 
    'SELECT * FROM menu_items WHERE restaurant_id = ? AND disponivel = 1 ORDER BY categoria, nome' 
  ).bind(restaurant.id).all(); 

  // Agrupa por categoria 
  const categorias = {}; 
  for (const item of items) { 
    if (!categorias[item.categoria]) categorias[item.categoria] = []; 
    categorias[item.categoria].push(item); 
  } 

  const categoriasArray = Object.keys(categorias); 
  const cor = restaurant.cor_primaria || '#ff4757'; 

  // --- RECURSOS POR PLANO NO FRONTEND ---
  const plan = 'pro'; // Simulado
  const config = {
    hasSearch: plan !== 'basic',
    hasWhatsApp: plan !== 'basic',
    hasAnimations: plan === 'premium',
    maxItems: plan === 'basic' ? 20 : Infinity
  };

  // Gera o JS com os dados reais do banco 
  const menuDataJS = ` 
    const menuData = { 
      planConfig: ${JSON.stringify(config)},
      categories: ${JSON.stringify(categoriasArray)}, 
      items: ${JSON.stringify(items.map(i => ({ 
        category: i.categoria, 
        name: i.nome, 
        desc: i.descricao || '', 
        price: i.preco, 
        img: i.foto_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400' 
      })))} 
    }; 
    const restaurantName = ${JSON.stringify(restaurant.nome)}; 
    const primaryColor = ${JSON.stringify(cor)}; 
  `; 

  const html = `<!DOCTYPE html> 
<html lang="pt-BR"> 
<head> 
  <meta charset="UTF-8"> 
  <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
  <title>${restaurant.nome} | Cardápio</title> 
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"> 
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"> 
  <style> 
    :root { 
      --primary: ${cor}; 
      --primary-light: ${cor}22; 
      --bg: #f8f9fa; 
      --card-bg: #ffffff; 
      --text: #1a1a1a; 
      --text-muted: #718096; 
      --radius-lg: 24px; 
      --radius-md: 16px; 
      --shadow: 0 10px 30px -5px rgba(0,0,0,0.05); 
      --transition: all 0.3s cubic-bezier(0.4,0,0.2,1); 
    } 
    * { margin:0; padding:0; box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; -webkit-tap-highlight-color:transparent; } 
    body { background:var(--bg); color:var(--text); padding-bottom:120px; line-height:1.6; overflow-x:hidden; } 

    .loading-screen { position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:1000; display:flex; align-items:center; justify-content:center; transition:opacity 0.5s ease,visibility 0.5s; } 
    .loading-screen.hidden { opacity:0; visibility:hidden; } 

    header { background:rgba(255,255,255,0.8); backdrop-filter:blur(15px); padding:20px; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:100; border-bottom:1px solid rgba(0,0,0,0.03); } 
    .logo-icon { width:32px; height:32px; background:var(--primary); border-radius:10px; display:flex; align-items:center; justify-content:center; color:white; font-size:16px; } 
    .logo-text { font-weight:800; font-size:18px; color:var(--text); letter-spacing:-0.5px; margin-left:10px; } 

    .hero { padding:30px 20px; background:linear-gradient(180deg,#fff 0%,var(--bg) 100%); } 
    .hero h1 { font-size:32px; font-weight:800; letter-spacing:-1px; margin-bottom:8px; } 
    .hero p { color:var(--text-muted); font-size:15px; font-weight:500; } 

    .categories { display:flex; gap:12px; padding:0 20px 25px; overflow-x:auto; scrollbar-width:none; position:sticky; top:72px; background:var(--bg); z-index:90; } 
    .categories::-webkit-scrollbar { display:none; } 
    .cat-pill { padding:12px 24px; background:var(--card-bg); border-radius:100px; white-space:nowrap; font-size:14px; font-weight:700; cursor:pointer; border:1px solid rgba(0,0,0,0.03); transition:var(--transition); color:var(--text-muted); box-shadow:var(--shadow); } 
    .cat-pill.active { background:var(--primary); color:#fff; border-color:var(--primary); transform:scale(1.05); box-shadow:0 10px 20px -5px ${cor}55; } 

    .menu-items { padding:0 20px; } 
    .section-title { font-size:20px; margin-bottom:20px; font-weight:800; letter-spacing:-0.5px; display:flex; align-items:center; gap:10px; } 
    .section-title::after { content:''; flex:1; height:1px; background:rgba(0,0,0,0.05); } 

    .item-card { background:var(--card-bg); border-radius:var(--radius-lg); padding:15px; margin-bottom:20px; display:flex; gap:15px; align-items:center; box-shadow:var(--shadow); border:1px solid rgba(0,0,0,0.02); transition:var(--transition); cursor:pointer; } 
    .item-card:active { transform:scale(0.97); } 
    .item-img { width:100px; height:100px; border-radius:var(--radius-md); object-fit:cover; flex-shrink:0; box-shadow:0 5px 15px rgba(0,0,0,0.08); } 
    .item-img-placeholder { width:100px; height:100px; border-radius:var(--radius-md); background:#f0f0f0; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:28px; } 
    .item-info { flex:1; min-width:0; } 
    .item-info h4 { font-size:16px; font-weight:700; margin-bottom:4px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } 
    .item-info p { font-size:13px; color:var(--text-muted); line-height:1.4; margin-bottom:10px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; } 
    .item-footer { display:flex; justify-content:space-between; align-items:center; } 
    .item-price { font-weight:800; color:var(--primary); font-size:17px; letter-spacing:-0.5px; } 
    .btn-add { width:36px; height:36px; background:var(--primary-light); color:var(--primary); border-radius:12px; display:flex; align-items:center; justify-content:center; transition:var(--transition); } 
    .item-card:hover .btn-add { background:var(--primary); color:white; } 

    .empty-state { text-align:center; padding:60px 20px; color:var(--text-muted); } 
    .empty-state i { font-size:48px; margin-bottom:16px; display:block; opacity:0.3; } 

    .cart-bar { position:fixed; bottom:30px; left:20px; right:20px; background:#1a1a1a; color:#fff; padding:18px 24px; border-radius:20px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 20px 40px rgba(0,0,0,0.3); z-index:200; transform:translateY(150%); transition:all 0.5s cubic-bezier(0.175,0.885,0.32,1.275); cursor:pointer; } 
    .cart-bar.active { transform:translateY(0); } 
    .cart-badge { background:var(--primary); color:white; width:24px; height:24px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; } 
    .cart-label { font-weight:700; font-size:15px; margin-left:12px; } 
    .cart-total { font-weight:800; font-size:16px; color:var(--primary); } 

    .modal-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); z-index:500; display:none; opacity:0; transition:opacity 0.3s ease; } 
    .modal-overlay.active { display:block; opacity:1; } 
    .checkout-modal { position:fixed; bottom:0; left:0; width:100%; background:#fff; border-radius:32px 32px 0 0; z-index:501; padding:30px 24px; transform:translateY(100%); transition:transform 0.4s cubic-bezier(0.23,1,0.32,1); max-height:90vh; overflow-y:auto; } 
    .modal-overlay.active ~ .checkout-modal { transform:translateY(0); } 
    .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; } 
    .modal-header h3 { font-size:22px; font-weight:800; } 
    .order-summary { background:var(--bg); border-radius:var(--radius-md); padding:20px; margin-bottom:25px; } 
    .order-item { display:flex; justify-content:space-between; margin-bottom:12px; font-size:14px; font-weight:600; } 
    .order-total-row { margin-top:15px; padding-top:15px; border-top:1px dashed rgba(0,0,0,0.1); display:flex; justify-content:space-between; font-weight:800; font-size:18px; } 
    .input-group { margin-bottom:20px; } 
    .input-group label { display:block; font-size:13px; font-weight:700; color:var(--text-muted); margin-bottom:8px; } 
    .input-group input, .input-group select { width:100%; padding:15px; background:var(--bg); border:1px solid rgba(0,0,0,0.05); border-radius:12px; font-size:14px; font-weight:600; outline:none; } 
    .btn-finish { width:100%; padding:20px; background:var(--primary); color:#fff; border:none; border-radius:16px; font-weight:800; font-size:16px; cursor:pointer; } 

    .btn-whatsapp-float { position:fixed; right:20px; bottom:110px; width:56px; height:56px; background:#25D366; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 10px 25px rgba(37,211,102,0.3); cursor:pointer; z-index:150; } 
  </style> 
</head> 
<body> 
  <div class="loading-screen" id="loader"> 
    <div class="logo-icon"><i class="fas fa-utensils fa-spin"></i></div> 
  </div> 

  <header> 
    <div style="display:flex;align-items:center;"> 
      <div class="logo-icon"><i class="fas fa-utensils"></i></div> 
      <div class="logo-text" id="resName"></div> 
    </div> 
  </header> 

  <section class="hero"> 
    <h1 id="heroTitle"></h1> 
    <p>Navegue pelo cardápio e faça seu pedido.</p> 
  </section> 

  <nav class="categories" id="categoryNav"></nav> 
  <main class="menu-items" id="itemsContainer"></main> 

  <div class="btn-whatsapp-float"><i class="fab fa-whatsapp"></i></div> 

  <div class="cart-bar" id="cartBar" onclick="openCheckout()"> 
    <div style="display:flex;align-items:center;"> 
      <div class="cart-badge" id="cartCount">0</div> 
      <div class="cart-label">Ver meu pedido</div> 
    </div> 
    <div class="cart-total" id="cartTotal">R$ 0,00</div> 
  </div> 

  <div class="modal-overlay" id="modalOverlay" onclick="closeCheckout()"></div> 
   <div class="checkout-modal" id="checkoutModal"> 
     <div class="modal-header"> 
       <h3>Finalizar Pedido</h3> 
       <i class="fas fa-times" style="font-size:24px;color:#718096;cursor:pointer;" onclick="closeCheckout()"></i> 
     </div> 
     <div class="order-summary" id="orderSummary"></div> 
     <div class="input-group"><label>NOME</label><input type="text" placeholder="Seu nome"></div> 
     <div class="input-group"><label>FORMA DE RECEBIMENTO</label> 
       <select><option>Entrega (Delivery)</option><option>Retirada no Local</option><option>Mesa</option></select> 
     </div> 
     <div class="input-group"><label>ENDEREÇO / MESA</label><input type="text" placeholder="Endereço ou número da mesa"></div> 
     <button class="btn-finish" onclick="finishOrder()"><i class="fab fa-whatsapp" style="margin-right:10px;"></i>ENVIAR PARA WHATSAPP</button> 
   </div> 
 
   <script> 
     ${menuDataJS} 
 
     let cart = []; 
     let currentCategory = menuData.categories[0] || ''; 
 
     document.getElementById('resName').textContent = restaurantName; 
     document.getElementById('heroTitle').textContent = restaurantName; 
 
     window.addEventListener('load', () => { 
       setTimeout(() => document.getElementById('loader').classList.add('hidden'), 800); 
       if (menuData.categories.length === 0) { 
         document.getElementById('itemsContainer').innerHTML = '<div class="empty-state"><i class="fas fa-utensils"></i><p>Cardápio em breve!</p></div>'; 
         return; 
       } 
       renderCategories(); 
       renderItems(); 
     }); 
 
     function renderCategories() { 
       document.getElementById('categoryNav').innerHTML = menuData.categories.map(cat => 
         '<div class="cat-pill ' + (cat === currentCategory ? 'active' : '') + '" onclick="setCategory(\\'' + cat + '\\')">' + cat + '</div>' 
       ).join(''); 
     } 
 
     function setCategory(cat) { 
       currentCategory = cat; 
       renderCategories(); 
       const c = document.getElementById('itemsContainer'); 
       c.style.opacity = '0'; 
       setTimeout(() => { renderItems(); c.style.opacity = '1'; }, 200); 
     } 
 
     function renderItems() { 
       const filtered = menuData.items.filter(i => i.category === currentCategory); 
       document.getElementById('itemsContainer').innerHTML = 
         '<h3 class="section-title">' + currentCategory + '</h3>' + 
         filtered.map(item => 
           '<div class="item-card" onclick="addToCart(\\'' + item.name.replace(/'/g, "\\\\'") + '\\',' + item.price + ')">' + 
           (item.img 
             ? '<img src="' + item.img + '" class="item-img" onerror="this.parentNode.innerHTML=\\'<div class=item-img-placeholder><i class=fas fa-image></i></div>\\'">' 
             : '<div class="item-img-placeholder"><i class="fas fa-image"></i></div>') + 
           '<div class="item-info"><h4>' + item.name + '</h4><p>' + item.desc + '</p>' + 
           '<div class="item-footer"><div class="item-price">R$ ' + item.price.toFixed(2).replace('.',',') + '</div>' + 
           '<div class="btn-add"><i class="fas fa-plus"></i></div></div></div></div>' 
         ).join(''); 
     } 
 
     function addToCart(name, price) { 
       cart.push({ name, price }); 
       const bar = document.getElementById('cartBar'); 
       bar.classList.add('active'); 
       document.getElementById('cartCount').textContent = cart.length; 
       const sum = cart.reduce((a, i) => a + i.price, 0); 
       document.getElementById('cartTotal').textContent = 'R$ ' + sum.toFixed(2).replace('.',','); 
     } 
 
     function openCheckout() { 
       const sum = cart.reduce((a, i) => a + i.price, 0); 
       document.getElementById('orderSummary').innerHTML = 
         cart.map(i => '<div class="order-item"><span>1x ' + i.name + '</span><span>R$ ' + i.price.toFixed(2).replace('.',',') + '</span></div>').join('') + 
         '<div class="order-total-row"><span>Total</span><span>R$ ' + sum.toFixed(2).replace('.',',') + '</span></div>'; 
       document.getElementById('modalOverlay').classList.add('active'); 
       document.getElementById('checkoutModal').style.transform = 'translateY(0)'; 
     } 
 
     function closeCheckout() { 
       document.getElementById('modalOverlay').classList.remove('active'); 
       document.getElementById('checkoutModal').style.transform = 'translateY(100%)'; 
     } 
 
     function finishOrder() { 
       const sum = cart.reduce((a, i) => a + i.price, 0); 
       alert('Pedido de R$ ' + sum.toFixed(2) + ' enviado!'); 
       cart = []; 
       document.getElementById('cartBar').classList.remove('active'); 
       closeCheckout(); 
     } 
   </script> 
 </body> 
 </html>`; 
 
  return c.html(html); 
}); 

export default app
