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
        const user = await DB.prepare("SELECT * FROM users WHERE email = ? AND password = ?")
            .bind(email, password).first()
        
        if (user) {
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

export default app
