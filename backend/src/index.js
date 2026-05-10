import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Habilita o CORS para que o seu frontend consiga conversar com o backend
app.use('*', cors())

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

export default app
