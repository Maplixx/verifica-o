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
    UNVERIFIED_ROLE_ID: process.env.UNVERIFIED_ROLE_ID,
    OWNER_ID: process.env.OWNER_ID
};

const DB_FILE = 'users.json';
const CONFIG_FILE = 'custom_config.json';
const SERVERS_FILE = 'servers.json';
const ADMINS_FILE = 'admins.json';

let usersDB = {};
if (fs.existsSync(DB_FILE)) usersDB = JSON.parse(fs.readFileSync(DB_FILE));

let botConfig = {
    description: 'Para garantir a segurança de todos contra contas fakes e raids, e para liberar seu acesso aos **Canais**, **Sorteios** e **Eventos**, você precisa se verificar.\n\nClique no botão abaixo para autenticar sua conta de forma segura.',
    image: 'https://i.imgur.com/8Q6QgXq.gif',
    notifyChannelId: null
};
if (fs.existsSync(CONFIG_FILE)) {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));
    botConfig = { ...botConfig, ...savedConfig };
}

let serversDB = [];
if (fs.existsSync(SERVERS_FILE)) serversDB = JSON.parse(fs.readFileSync(SERVERS_FILE));

let adminsDB = [];
if (fs.existsSync(ADMINS_FILE)) adminsDB = JSON.parse(fs.readFileSync(ADMINS_FILE));

function saveUser(userId, accessToken, refreshToken, expiresIn) {
    const expiresAt = Date.now() + (expiresIn * 1000);
    const verifiedAt = usersDB[userId]?.verifiedAt || Date.now();
    usersDB[userId] = { accessToken, refreshToken, expiresAt, verifiedAt };
    fs.writeFileSync(DB_FILE, JSON.stringify(usersDB, null, 2));
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2));
}

function saveAdmins() {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(adminsDB, null, 2));
}

function logServerAction(guild, action) {
    const entry = {
        serverName: guild.name,
        serverId: guild.id,
        action: action, 
        date: new Date().toLocaleString('pt-BR'),
        memberCount: guild.memberCount
    };
    serversDB.push(entry);
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(serversDB, null, 2));
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
            } catch (err) { }
            
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                await member.roles.add(config.ROLE_ID);
                if (config.UNVERIFIED_ROLE_ID) {
                    await member.roles.remove(config.UNVERIFIED_ROLE_ID).catch(() => {});
                }
                if (botConfig.notifyChannelId) {
                    const notifyChannel = guild.channels.cache.get(botConfig.notifyChannelId);
                    if (notifyChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Nova Verificação')
                            .setDescription(`O usuário <@${userId}> acabou de se verificar com sucesso!`)
                            .setColor('Green')
                            .setTimestamp();
                        notifyChannel.send({ embeds: [embed] }).catch(() => {});
                    }
                }
            }
        }
        res.send(getHtml('success'));
    } catch (error) {
        const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
        res.send(getHtml('error', errorMsg));
    }
});

client.on('guildCreate', guild => logServerAction(guild, 'ENTROU'));
client.on('guildDelete', guild => logServerAction(guild, 'SAIU'));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isOwner = message.author.id === config.OWNER_ID;
    const isAdmin = isOwner || adminsDB.includes(message.author.id);

    if (message.content.startsWith('!definiradm')) {
        if (!isOwner) return;
        message.delete().catch(() => {});
        const user = message.mentions.users.first();
        if (!user) return message.channel.send('Mencione alguém.').then(m => setTimeout(() => m.delete(), 3000));
        
        if (!adminsDB.includes(user.id)) {
            adminsDB.push(user.id);
            saveAdmins();
            message.channel.send(`✅ **${user.tag}** agora é Administrador.`);
        }
        return;
    }

    if (message.content.startsWith('!retiraradm')) {
        if (!isOwner) return;
        message.delete().catch(() => {});
        const user = message.mentions.users.first();
        if (!user) return;
        if (adminsDB.includes(user.id)) {
            adminsDB = adminsDB.filter(id => id !== user.id);
            saveAdmins();
            message.channel.send(`🗑️ **${user.tag}** removido dos Administradores.`);
        }
        return;
    }

    if (!isAdmin) return; 

    // --- COMANDO !CHECKUSER (DEBUG) ---
    if (message.content.startsWith('!checkuser')) {
        const userId = message.content.split(' ')[1] || message.mentions.users.first()?.id;
        if (!userId) return message.reply('Coloque o ID ou mencione o user.');
        
        const userData = usersDB[userId];
        if (!userData) return message.reply('❌ Usuário NÃO consta no banco de dados.');
        
        const validToken = await getValidAccessToken(userId);
        if (validToken) return message.reply(`✅ Usuário verificado e Token Válido! (Pode ser puxado).`);
        else return message.reply(`⚠️ Usuário está no banco, mas o Token expirou ou foi revogado (Precisa verificar de novo).`);
    }

    if (message.content === '!avisosverify') {
        message.delete().catch(() => {});
        botConfig.notifyChannelId = message.channel.id;
        saveConfig();
        message.channel.send(`✅ Canal de notificações definido: <#${message.channel.id}>.`);
        return;
    }

    if (message.content === '!sconfig') {
        message.delete().catch(() => {});
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Configuração')
            .setDescription('Personalize a mensagem.')
            .setColor('DarkButNotBlack')
            .addFields({ name: 'Imagem Atual', value: botConfig.image });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_config_desc').setLabel('📝 Alterar Descrição').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('btn_config_img').setLabel('🖼️ Alterar Imagem').setStyle(ButtonStyle.Secondary)
        );
        return message.channel.send({ embeds: [embed], components: [row] });
    }

    if (message.content === '!setup') {
        message.delete().catch(() => {});
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&redirect_uri=${encodeURIComponent(config.REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join`;
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Verificação Obrigatória')
            .setDescription(botConfig.description)
            .setColor('Red')
            .setFooter({ text: 'Sistema de Proteção Anti-Raid' })
            .setImage(botConfig.image);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('🔓 Verificar Agora').setStyle(ButtonStyle.Link).setURL(authUrl)
        );
        return message.channel.send({ embeds: [embed], components: [row] });
    }

    if (message.content === '!reset') {
        message.delete().catch(() => {});
        if (!isOwner) return;
        usersDB = {}; 
        fs.writeFileSync(DB_FILE, JSON.stringify(usersDB, null, 2));
        message.channel.send('⚠️ Banco de Dados Resetado.');
    }

    if (message.content.startsWith('!puxar')) {
        message.delete().catch(() => {});
        const targetGuildId = message.content.split(' ')[1];
        const targetGuild = client.guilds.cache.get(targetGuildId);
        if (!targetGuild) return message.channel.send('Servidor não encontrado ou bot não é Admin nele.').then(m => setTimeout(() => m.delete(), 5000));

        const statusMsg = await message.channel.send(`🔄 Puxando para **${targetGuild.name}**... Aguarde.`);
        
        const users = Object.keys(usersDB);
        let success = 0;
        let fail = 0;
        let errorCounts = { "Token Inválido": 0, "Sem Permissão": 0, "Outros": 0 };

        for (const userId of users) {
            // Verifica se ja esta no server
            let member = targetGuild.members.cache.get(userId);
            if (!member) { try { member = await targetGuild.members.fetch(userId); } catch (e) {} }

            if (member) {
                success++; // Ja esta la
                continue;
            }

            const validToken = await getValidAccessToken(userId);
            if (validToken) {
                try {
                    await targetGuild.members.add(userId, { accessToken: validToken });
                    success++;
                } catch (e) {
                    fail++;
                    const msg = e.message.toLowerCase();
                    if (msg.includes('missing permissions')) errorCounts["Sem Permissão"]++;
                    else errorCounts["Outros"]++;
                    console.log(`Erro ao puxar ${userId}: ${e.message}`);
                }
            } else {
                fail++;
                errorCounts["Token Inválido"]++;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        
        let errorDetails = Object.entries(errorCounts).map(([k, v]) => v > 0 ? `\n- ${k}: ${v}` : '').join('');
        statusMsg.edit(`✅ **Finalizado!**\n📥 Sucessos: ${success}\n❌ Falhas: ${fail}${errorDetails}`);
    }

    if (message.content === '!members') {
        message.delete().catch(() => {});
        // Mesma logica do !puxar mas para o server atual
        const targetGuild = message.guild;
        const statusMsg = await message.channel.send(`🔄 Iniciando puxada...`);
        const users = Object.keys(usersDB);
        let success = 0;
        let fail = 0;

        for (const userId of users) {
            let member = targetGuild.members.cache.get(userId);
            if (!member) { try { member = await targetGuild.members.fetch(userId); } catch (e) {} }
            if (member) { success++; continue; }

            const validToken = await getValidAccessToken(userId);
            if (validToken) {
                try {
                    await targetGuild.members.add(userId, { accessToken: validToken });
                    success++;
                } catch (e) { fail++; }
            } else { fail++; }
            await new Promise(r => setTimeout(r, 1000));
        }
        statusMsg.edit(`✅ **Finalizado!**\n📥 Sucessos: ${success}\n❌ Falhas: ${fail}`);
    }

    if (message.content === '!gerarlink') {
        message.delete().catch(() => {});
        const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&permissions=8&scope=bot`;
        message.channel.send({ content: `Link ADM: ${inviteUrl}` });
    }

    if (message.content === '!quit') {
        message.delete().catch(() => {});
        await message.channel.send('👋 Saindo...');
        await message.guild.leave();
    }

    if (message.content.startsWith('!unverify')) {
        message.delete().catch(() => {});
        if (!config.UNVERIFIED_ROLE_ID || !config.ROLE_ID) return message.channel.send('Configure IDs no Railway.');

        const mentions = message.mentions.users;
        const guild = message.guild;
        const members = await guild.members.fetch(); 
        let count = 0;

        const msg = await message.channel.send('🔄 Resetando cargos...');

        for (const [id, member] of members) {
            if (member.user.bot || id === config.OWNER_ID || adminsDB.includes(id) || mentions.has(id)) continue;
            try {
                await member.roles.set([config.UNVERIFIED_ROLE_ID]);
                count++;
            } catch (e) { }
            await new Promise(r => setTimeout(r, 500)); 
        }
        msg.edit(`✅ **Concluído!** ${count} resetados.`);
    }

    if (message.content === '!countm') {
        message.delete().catch(() => {});
        const guild = message.guild;
        const verifiedMembers = [];
        
        for (const [userId, data] of Object.entries(usersDB)) {
            const member = guild.members.cache.get(userId);
            if (member && member.roles.cache.has(config.ROLE_ID)) {
                const dateStr = data.verifiedAt ? new Date(data.verifiedAt).toLocaleDateString('pt-BR') : '?';
                verifiedMembers.push(`<@${userId}> (${dateStr})`);
            }
        }
        if (verifiedMembers.length === 0) return message.channel.send('Ninguém verificado aqui.');
        
        let currentMsg = `📊 **Verificados: ${verifiedMembers.length}**\n\n`;
        for (const line of verifiedMembers) {
            if (currentMsg.length + line.length > 1900) {
                await message.channel.send(currentMsg);
                currentMsg = '';
            }
            currentMsg += line + '\n';
        }
        if (currentMsg) await message.channel.send(currentMsg);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.user.bot) return;
    const isOwner = interaction.user.id === config.OWNER_ID;
    const isAdmin = isOwner || adminsDB.includes(interaction.user.id);
    if (!isAdmin) return;

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
            await interaction.reply({ content: '✅ Atualizado!', ephemeral: true });
        }
        if (interaction.customId === 'modal_img_submit') {
            botConfig.image = interaction.fields.getTextInputValue('input_img');
            saveConfig();
            await interaction.reply({ content: '✅ Atualizado!', ephemeral: true });
        }
    }
});

app.listen(config.PORT, () => {});
client.login(config.TOKEN);
